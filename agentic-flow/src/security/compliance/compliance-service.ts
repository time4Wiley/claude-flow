/**
 * Compliance Service
 * Manages compliance frameworks, controls, assessments, and reporting
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import {
  ComplianceFramework,
  ComplianceRequirement,
  ComplianceControl,
  ComplianceAssessment,
  AssessmentFinding,
  RemediationPlan,
  Evidence,
  ControlImplementation,
  AuditLog
} from '../types';
import { AuditService } from '../audit/audit-service';

export interface ComplianceServiceConfig {
  frameworks: ComplianceFramework[];
  automatedAssessment: boolean;
  assessmentSchedule: {
    frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
    frameworks: string[];
  }[];
  evidenceRetention: number; // days
  notificationChannels: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
}

interface ControlEvidence {
  controlId: string;
  evidence: Evidence[];
  lastCollected: Date;
  status: 'current' | 'expired' | 'missing';
}

interface ComplianceScore {
  framework: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  requirementScores: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
}

interface ComplianceGap {
  requirementId: string;
  requirement: string;
  currentState: string;
  targetState: string;
  gap: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  effort: number; // estimated hours
}

export class ComplianceService extends EventEmitter {
  private logger: Logger;
  private config: ComplianceServiceConfig;
  private auditService: AuditService;
  private frameworks: Map<string, ComplianceFramework> = new Map();
  private controls: Map<string, ComplianceControl> = new Map();
  private assessments: Map<string, ComplianceAssessment[]> = new Map();
  private evidence: Map<string, ControlEvidence> = new Map();
  private assessmentTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ComplianceServiceConfig, auditService: AuditService) {
    super();
    this.config = config;
    this.logger = new Logger('ComplianceService');
    this.auditService = auditService;
    this.initialize();
  }

  private initialize(): void {
    // Load frameworks
    this.loadFrameworks();

    // Start automated assessments
    if (this.config.automatedAssessment) {
      this.startAutomatedAssessments();
    }

    // Start evidence collection
    this.startEvidenceCollection();

    this.logger.info('Compliance service initialized', {
      frameworks: this.config.frameworks.map(f => f.name),
      automatedAssessment: this.config.automatedAssessment
    });
  }

  /**
   * Get compliance framework
   */
  async getFramework(frameworkId: string): Promise<ComplianceFramework | null> {
    return this.frameworks.get(frameworkId) || null;
  }

  /**
   * List all frameworks
   */
  async listFrameworks(): Promise<ComplianceFramework[]> {
    return Array.from(this.frameworks.values());
  }

  /**
   * Get compliance requirements for a framework
   */
  async getRequirements(
    frameworkId: string,
    filters?: {
      category?: string;
      priority?: string;
      implemented?: boolean;
    }
  ): Promise<ComplianceRequirement[]> {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) {
      throw new Error(`Framework not found: ${frameworkId}`);
    }

    let requirements = framework.requirements;

    if (filters) {
      if (filters.category) {
        requirements = requirements.filter(r => r.category === filters.category);
      }
      if (filters.priority) {
        requirements = requirements.filter(r => r.priority === filters.priority);
      }
      if (filters.implemented !== undefined) {
        const implementedControlIds = new Set(
          Array.from(this.controls.values())
            .filter(c => c.implementation.status === 'implemented')
            .map(c => c.id)
        );
        
        requirements = requirements.filter(r => {
          const isImplemented = r.controls.every(cId => implementedControlIds.has(cId));
          return isImplemented === filters.implemented;
        });
      }
    }

    return requirements;
  }

  /**
   * Get compliance controls
   */
  async getControls(
    filters?: {
      frameworkId?: string;
      type?: 'technical' | 'administrative' | 'physical';
      status?: string;
      automationLevel?: string;
    }
  ): Promise<ComplianceControl[]> {
    let controls = Array.from(this.controls.values());

    if (filters) {
      if (filters.frameworkId) {
        const framework = this.frameworks.get(filters.frameworkId);
        if (framework) {
          const frameworkControlIds = new Set(framework.controls.map(c => c.id));
          controls = controls.filter(c => frameworkControlIds.has(c.id));
        }
      }
      if (filters.type) {
        controls = controls.filter(c => c.type === filters.type);
      }
      if (filters.status) {
        controls = controls.filter(c => c.implementation.status === filters.status);
      }
      if (filters.automationLevel) {
        controls = controls.filter(c => c.implementation.automationLevel === filters.automationLevel);
      }
    }

    return controls;
  }

  /**
   * Update control implementation
   */
  async updateControlImplementation(
    controlId: string,
    updates: Partial<ControlImplementation>,
    updatedBy: string
  ): Promise<ComplianceControl> {
    try {
      const control = this.controls.get(controlId);
      if (!control) {
        throw new Error(`Control not found: ${controlId}`);
      }

      // Update implementation
      control.implementation = {
        ...control.implementation,
        ...updates
      };

      // Audit log
      await this.auditService.log({
        userId: updatedBy,
        action: {
          category: 'admin',
          type: 'control_updated',
          severity: 'medium',
          description: `Updated compliance control: ${control.name}`
        },
        resource: 'compliance_control',
        resourceId: controlId,
        result: 'success',
        metadata: { updates }
      } as AuditLog);

      this.emit('control:updated', { control });

      return control;
    } catch (error) {
      this.logger.error('Failed to update control', error);
      throw error;
    }
  }

  /**
   * Add evidence for a control
   */
  async addEvidence(
    controlId: string,
    evidence: Omit<Evidence, 'id' | 'collectedAt'>,
    collectedBy: string
  ): Promise<Evidence> {
    try {
      const control = this.controls.get(controlId);
      if (!control) {
        throw new Error(`Control not found: ${controlId}`);
      }

      // Create evidence record
      const evidenceRecord: Evidence = {
        id: uuidv4(),
        ...evidence,
        collectedAt: new Date()
      };

      // Store evidence
      let controlEvidence = this.evidence.get(controlId);
      if (!controlEvidence) {
        controlEvidence = {
          controlId,
          evidence: [],
          lastCollected: new Date(),
          status: 'current'
        };
        this.evidence.set(controlId, controlEvidence);
      }

      controlEvidence.evidence.push(evidenceRecord);
      controlEvidence.lastCollected = new Date();
      controlEvidence.status = 'current';

      // Update control implementation
      control.implementation.evidence.push(evidenceRecord);
      control.implementation.lastTested = new Date();

      // Audit log
      await this.auditService.log({
        userId: collectedBy,
        action: {
          category: 'system',
          type: 'evidence_collected',
          severity: 'low',
          description: `Collected evidence for control: ${control.name}`
        },
        resource: 'compliance_evidence',
        resourceId: evidenceRecord.id,
        result: 'success',
        metadata: { controlId, evidenceType: evidence.type }
      } as AuditLog);

      this.emit('evidence:collected', { controlId, evidence: evidenceRecord });

      return evidenceRecord;
    } catch (error) {
      this.logger.error('Failed to add evidence', error);
      throw error;
    }
  }

  /**
   * Run compliance assessment
   */
  async runAssessment(
    frameworkId: string,
    scope: string[],
    assessedBy: string
  ): Promise<ComplianceAssessment> {
    try {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) {
        throw new Error(`Framework not found: ${frameworkId}`);
      }

      this.logger.info('Starting compliance assessment', { frameworkId, scope });

      // Create assessment
      const assessment: ComplianceAssessment = {
        id: uuidv4(),
        frameworkId,
        assessmentDate: new Date(),
        scope,
        findings: [],
        overallScore: 0,
        status: 'passed',
        nextAssessment: this.calculateNextAssessment(frameworkId)
      };

      // Assess each requirement
      for (const requirement of framework.requirements) {
        if (scope.length > 0 && !scope.includes(requirement.category)) {
          continue;
        }

        const finding = await this.assessRequirement(requirement, framework);
        assessment.findings.push(finding);
      }

      // Calculate overall score
      const scores = assessment.findings.map(f => this.scoreFinding(f));
      assessment.overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Determine status
      const criticalFindings = assessment.findings.filter(
        f => f.status === 'non_compliant' && f.risk === 'critical'
      );
      const highFindings = assessment.findings.filter(
        f => f.status === 'non_compliant' && f.risk === 'high'
      );

      if (criticalFindings.length > 0) {
        assessment.status = 'failed';
      } else if (highFindings.length > 2) {
        assessment.status = 'conditional';
      } else if (assessment.overallScore < 70) {
        assessment.status = 'conditional';
      }

      // Store assessment
      if (!this.assessments.has(frameworkId)) {
        this.assessments.set(frameworkId, []);
      }
      this.assessments.get(frameworkId)!.push(assessment);

      // Generate remediation plans for non-compliant findings
      for (const finding of assessment.findings) {
        if (finding.status === 'non_compliant' && finding.gaps.length > 0) {
          finding.remediationPlan = await this.generateRemediationPlan(
            finding,
            requirement
          );
        }
      }

      // Audit log
      await this.auditService.log({
        userId: assessedBy,
        action: {
          category: 'system',
          type: 'compliance_assessment',
          severity: 'high',
          description: `Completed ${framework.name} compliance assessment`
        },
        resource: 'compliance_assessment',
        resourceId: assessment.id,
        result: 'success',
        metadata: {
          frameworkId,
          overallScore: assessment.overallScore,
          status: assessment.status,
          findingsCount: assessment.findings.length
        }
      } as AuditLog);

      // Send notifications
      await this.sendAssessmentNotifications(assessment, framework);

      this.emit('assessment:completed', { assessment });

      return assessment;
    } catch (error) {
      this.logger.error('Failed to run assessment', error);
      throw error;
    }
  }

  /**
   * Get assessment history
   */
  async getAssessmentHistory(
    frameworkId: string,
    limit?: number
  ): Promise<ComplianceAssessment[]> {
    const assessments = this.assessments.get(frameworkId) || [];
    const sorted = assessments.sort((a, b) => 
      b.assessmentDate.getTime() - a.assessmentDate.getTime()
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get compliance score
   */
  async getComplianceScore(
    frameworkId?: string
  ): Promise<ComplianceScore | ComplianceScore[]> {
    if (frameworkId) {
      return this.calculateComplianceScore(frameworkId);
    }

    // Calculate scores for all frameworks
    const scores: ComplianceScore[] = [];
    for (const [id] of this.frameworks) {
      scores.push(await this.calculateComplianceScore(id));
    }
    
    return scores;
  }

  /**
   * Get compliance gaps
   */
  async getComplianceGaps(
    frameworkId: string,
    priority?: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<ComplianceGap[]> {
    const latestAssessment = await this.getLatestAssessment(frameworkId);
    if (!latestAssessment) {
      throw new Error('No assessment found for framework');
    }

    const framework = this.frameworks.get(frameworkId);
    if (!framework) {
      throw new Error(`Framework not found: ${frameworkId}`);
    }

    const gaps: ComplianceGap[] = [];

    for (const finding of latestAssessment.findings) {
      if (finding.status !== 'compliant') {
        const requirement = framework.requirements.find(
          r => r.id === finding.requirementId
        );
        
        if (!requirement) continue;

        for (const gap of finding.gaps) {
          const complianceGap: ComplianceGap = {
            requirementId: finding.requirementId,
            requirement: requirement.description,
            currentState: finding.status,
            targetState: 'compliant',
            gap,
            impact: finding.risk,
            effort: this.estimateRemediationEffort(finding, requirement)
          };

          if (!priority || complianceGap.impact === priority) {
            gaps.push(complianceGap);
          }
        }
      }
    }

    // Sort by impact and effort
    return gaps.sort((a, b) => {
      const impactWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = impactWeight[a.impact] / a.effort;
      const bScore = impactWeight[b.impact] / b.effort;
      return bScore - aScore;
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    frameworkId: string,
    options?: {
      format?: 'summary' | 'detailed' | 'executive';
      includeEvidence?: boolean;
      includeRemediation?: boolean;
      timeRange?: { start: Date; end: Date };
    }
  ): Promise<any> {
    try {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) {
        throw new Error(`Framework not found: ${frameworkId}`);
      }

      const format = options?.format || 'summary';
      
      // Get assessments in time range
      let assessments = this.assessments.get(frameworkId) || [];
      if (options?.timeRange) {
        assessments = assessments.filter(a => 
          a.assessmentDate >= options.timeRange!.start &&
          a.assessmentDate <= options.timeRange!.end
        );
      }

      const latestAssessment = assessments[assessments.length - 1];
      const score = await this.calculateComplianceScore(frameworkId);
      const gaps = await this.getComplianceGaps(frameworkId);

      let report: any = {
        framework: {
          id: framework.id,
          name: framework.name,
          version: framework.version
        },
        generatedAt: new Date(),
        summary: {
          overallScore: score.overallScore,
          status: latestAssessment?.status || 'not_assessed',
          totalRequirements: framework.requirements.length,
          compliantRequirements: latestAssessment?.findings.filter(
            f => f.status === 'compliant'
          ).length || 0,
          criticalGaps: gaps.filter(g => g.impact === 'critical').length,
          highGaps: gaps.filter(g => g.impact === 'high').length
        }
      };

      if (format === 'detailed' || format === 'executive') {
        report.assessmentHistory = assessments.map(a => ({
          date: a.assessmentDate,
          score: a.overallScore,
          status: a.status,
          findings: a.findings.length
        }));

        report.categoryBreakdown = score.categoryScores;
        
        if (format === 'detailed') {
          report.requirements = framework.requirements.map(req => {
            const finding = latestAssessment?.findings.find(
              f => f.requirementId === req.id
            );
            
            return {
              id: req.id,
              category: req.category,
              description: req.description,
              priority: req.priority,
              status: finding?.status || 'not_assessed',
              gaps: finding?.gaps || [],
              controls: req.controls.map(cId => {
                const control = this.controls.get(cId);
                return {
                  id: cId,
                  name: control?.name,
                  status: control?.implementation.status,
                  automationLevel: control?.implementation.automationLevel
                };
              })
            };
          });

          if (options?.includeEvidence) {
            report.evidence = this.collectReportEvidence(framework);
          }

          if (options?.includeRemediation) {
            report.remediationPlans = latestAssessment?.findings
              .filter(f => f.remediationPlan)
              .map(f => ({
                requirementId: f.requirementId,
                plan: f.remediationPlan
              }));
          }
        }
      }

      // Audit report generation
      await this.auditService.log({
        action: {
          category: 'system',
          type: 'compliance_report_generated',
          severity: 'low',
          description: `Generated ${framework.name} compliance report`
        },
        resource: 'compliance_report',
        result: 'success',
        metadata: { frameworkId, format }
      } as AuditLog);

      return report;
    } catch (error) {
      this.logger.error('Failed to generate compliance report', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private loadFrameworks(): void {
    this.config.frameworks.forEach(framework => {
      this.frameworks.set(framework.id, framework);
      
      // Load controls
      framework.controls.forEach(control => {
        this.controls.set(control.id, control);
      });
    });
  }

  private startAutomatedAssessments(): void {
    this.config.assessmentSchedule.forEach(schedule => {
      schedule.frameworks.forEach(frameworkId => {
        const interval = this.getScheduleInterval(schedule.frequency);
        
        const timer = setInterval(async () => {
          try {
            await this.runAssessment(frameworkId, [], 'system');
          } catch (error) {
            this.logger.error('Automated assessment failed', { frameworkId, error });
          }
        }, interval);

        this.assessmentTimers.set(frameworkId, timer);
      });
    });
  }

  private startEvidenceCollection(): void {
    // Collect evidence based on control frequency
    setInterval(async () => {
      for (const control of this.controls.values()) {
        if (control.frequency === 'continuous') {
          await this.collectControlEvidence(control);
        }
      }
    }, 60 * 60 * 1000); // Hourly for continuous controls

    // Daily evidence collection
    setInterval(async () => {
      for (const control of this.controls.values()) {
        if (control.frequency === 'daily') {
          await this.collectControlEvidence(control);
        }
      }
    }, 24 * 60 * 60 * 1000);
  }

  private async collectControlEvidence(control: ComplianceControl): Promise<void> {
    try {
      // Emit event for evidence collection
      const evidenceRequest = {
        controlId: control.id,
        controlName: control.name,
        type: control.type,
        testProcedures: control.testProcedures,
        evidence: null as Evidence | null
      };

      this.emit('evidence:collect', evidenceRequest);

      // Wait for evidence collection (would be async in real implementation)
      if (evidenceRequest.evidence) {
        await this.addEvidence(control.id, evidenceRequest.evidence, 'system');
      }
    } catch (error) {
      this.logger.error('Evidence collection failed', { controlId: control.id, error });
    }
  }

  private async assessRequirement(
    requirement: ComplianceRequirement,
    framework: ComplianceFramework
  ): Promise<AssessmentFinding> {
    const finding: AssessmentFinding = {
      requirementId: requirement.id,
      status: 'compliant',
      gaps: [],
      risk: 'low'
    };

    // Check all controls for the requirement
    const controlStatuses = requirement.controls.map(controlId => {
      const control = this.controls.get(controlId);
      if (!control) return 'missing';
      
      // Check control implementation
      if (control.implementation.status !== 'implemented') {
        return control.implementation.status;
      }

      // Check evidence currency
      const evidence = this.evidence.get(controlId);
      if (!evidence || evidence.status !== 'current') {
        return 'evidence_missing';
      }

      // Check test results
      if (control.implementation.lastTested) {
        const daysSinceTest = Math.floor(
          (Date.now() - control.implementation.lastTested.getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        
        const maxDays = this.getMaxTestAge(control.frequency);
        if (daysSinceTest > maxDays) {
          return 'test_expired';
        }
      }

      return 'compliant';
    });

    // Determine overall status
    const nonCompliantCount = controlStatuses.filter(s => s !== 'compliant').length;
    
    if (nonCompliantCount === 0) {
      finding.status = 'compliant';
    } else if (nonCompliantCount === controlStatuses.length) {
      finding.status = 'non_compliant';
    } else {
      finding.status = 'partial';
    }

    // Identify gaps
    requirement.controls.forEach((controlId, index) => {
      const status = controlStatuses[index];
      if (status !== 'compliant') {
        const control = this.controls.get(controlId);
        finding.gaps.push(
          `Control ${control?.name || controlId}: ${status.replace('_', ' ')}`
        );
      }
    });

    // Assess risk
    if (finding.status !== 'compliant') {
      finding.risk = requirement.priority as any;
    }

    return finding;
  }

  private scoreFinding(finding: AssessmentFinding): number {
    const statusScores = {
      'compliant': 100,
      'partial': 50,
      'non_compliant': 0,
      'not_applicable': 100
    };

    const riskMultipliers = {
      'critical': 2.0,
      'high': 1.5,
      'medium': 1.0,
      'low': 0.5
    };

    const baseScore = statusScores[finding.status];
    const multiplier = finding.status !== 'compliant' 
      ? riskMultipliers[finding.risk] 
      : 1.0;

    return baseScore / multiplier;
  }

  private async calculateComplianceScore(frameworkId: string): Promise<ComplianceScore> {
    const latestAssessment = await this.getLatestAssessment(frameworkId);
    const framework = this.frameworks.get(frameworkId);
    
    if (!latestAssessment || !framework) {
      return {
        framework: frameworkId,
        overallScore: 0,
        categoryScores: {},
        requirementScores: {},
        trend: 'stable'
      };
    }

    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    const categoryFindings: Record<string, AssessmentFinding[]> = {};

    framework.requirements.forEach(req => {
      if (!categoryFindings[req.category]) {
        categoryFindings[req.category] = [];
      }
      
      const finding = latestAssessment.findings.find(f => f.requirementId === req.id);
      if (finding) {
        categoryFindings[req.category].push(finding);
      }
    });

    for (const [category, findings] of Object.entries(categoryFindings)) {
      const scores = findings.map(f => this.scoreFinding(f));
      categoryScores[category] = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    // Calculate requirement scores
    const requirementScores: Record<string, number> = {};
    latestAssessment.findings.forEach(finding => {
      requirementScores[finding.requirementId] = this.scoreFinding(finding);
    });

    // Calculate trend
    const history = await this.getAssessmentHistory(frameworkId, 3);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (history.length >= 2) {
      const currentScore = latestAssessment.overallScore;
      const previousScore = history[1].overallScore;
      
      if (currentScore > previousScore + 5) {
        trend = 'improving';
      } else if (currentScore < previousScore - 5) {
        trend = 'declining';
      }
    }

    return {
      framework: frameworkId,
      overallScore: latestAssessment.overallScore,
      categoryScores,
      requirementScores,
      trend
    };
  }

  private async getLatestAssessment(
    frameworkId: string
  ): Promise<ComplianceAssessment | null> {
    const assessments = this.assessments.get(frameworkId);
    if (!assessments || assessments.length === 0) {
      return null;
    }
    
    return assessments[assessments.length - 1];
  }

  private calculateNextAssessment(frameworkId: string): Date {
    const schedule = this.config.assessmentSchedule.find(
      s => s.frameworks.includes(frameworkId)
    );
    
    if (!schedule) {
      // Default to quarterly
      const next = new Date();
      next.setMonth(next.getMonth() + 3);
      return next;
    }

    const now = new Date();
    switch (schedule.frequency) {
      case 'continuous':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      case 'quarterly':
        const nextQuarter = new Date(now);
        nextQuarter.setMonth(nextQuarter.getMonth() + 3);
        return nextQuarter;
      case 'annually':
        const nextYear = new Date(now);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;
    }
  }

  private async generateRemediationPlan(
    finding: AssessmentFinding,
    requirement: ComplianceRequirement
  ): Promise<RemediationPlan> {
    const actions = finding.gaps.map((gap, index) => ({
      description: `Remediate: ${gap}`,
      priority: index + 1,
      dependencies: [],
      completed: false
    }));

    // Estimate timeline based on risk
    const timelineMap = {
      'critical': 7,
      'high': 30,
      'medium': 90,
      'low': 180
    };
    
    const timeline = new Date();
    timeline.setDate(timeline.getDate() + timelineMap[finding.risk]);

    return {
      actions,
      timeline,
      responsibleParty: 'Compliance Team',
      estimatedEffort: this.estimateRemediationEffort(finding, requirement),
      status: 'planned'
    };
  }

  private estimateRemediationEffort(
    finding: AssessmentFinding,
    requirement: ComplianceRequirement
  ): number {
    // Base effort on number of gaps and priority
    const baseEffort = finding.gaps.length * 8; // 8 hours per gap
    
    const priorityMultiplier = {
      'critical': 1.5,
      'high': 1.2,
      'medium': 1.0,
      'low': 0.8
    };
    
    return Math.ceil(baseEffort * priorityMultiplier[requirement.priority]);
  }

  private getScheduleInterval(frequency: string): number {
    const intervals = {
      'continuous': 60 * 60 * 1000, // 1 hour
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000,
      'quarterly': 90 * 24 * 60 * 60 * 1000,
      'annually': 365 * 24 * 60 * 60 * 1000
    };
    
    return intervals[frequency] || intervals.quarterly;
  }

  private getMaxTestAge(frequency: string): number {
    const maxAges = {
      'continuous': 1,
      'daily': 2,
      'weekly': 14,
      'monthly': 45,
      'quarterly': 120,
      'annually': 400
    };
    
    return maxAges[frequency] || 90;
  }

  private collectReportEvidence(framework: ComplianceFramework): any[] {
    const reportEvidence: any[] = [];
    
    framework.controls.forEach(control => {
      const evidence = this.evidence.get(control.id);
      if (evidence) {
        reportEvidence.push({
          controlId: control.id,
          controlName: control.name,
          evidence: evidence.evidence.map(e => ({
            id: e.id,
            type: e.type,
            description: e.description,
            collectedAt: e.collectedAt,
            validUntil: e.validUntil,
            status: evidence.status
          }))
        });
      }
    });
    
    return reportEvidence;
  }

  private async sendAssessmentNotifications(
    assessment: ComplianceAssessment,
    framework: ComplianceFramework
  ): Promise<void> {
    const notification = {
      type: 'compliance_assessment',
      framework: framework.name,
      date: assessment.assessmentDate,
      status: assessment.status,
      score: assessment.overallScore,
      criticalFindings: assessment.findings.filter(
        f => f.status === 'non_compliant' && f.risk === 'critical'
      ).length,
      url: `${process.env.APP_URL}/compliance/assessments/${assessment.id}`
    };

    // Send to configured channels
    if (this.config.notificationChannels.email) {
      this.emit('notification:email', {
        to: this.config.notificationChannels.email,
        subject: `Compliance Assessment: ${framework.name}`,
        data: notification
      });
    }

    if (this.config.notificationChannels.slack) {
      this.emit('notification:slack', {
        channel: this.config.notificationChannels.slack,
        data: notification
      });
    }

    if (this.config.notificationChannels.webhook) {
      this.emit('notification:webhook', {
        url: this.config.notificationChannels.webhook,
        data: notification
      });
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Clear assessment timers
    this.assessmentTimers.forEach(timer => clearInterval(timer));
    this.assessmentTimers.clear();
  }
}