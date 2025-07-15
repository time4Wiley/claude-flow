import { EventEmitter } from 'events';
import { writeFile, readFile, mkdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { ConfigManager } from '../core/config.js';
export interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  status: 'planned' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  estimatedDuration: number; // in hours
  actualDuration?: number;
  dependencies: string[];
  assignedTeam: string[];
  deliverables: string[];
  risks: ProjectRisk[];
  milestones: ProjectMilestone[];
  budget: {
    estimated: number;
    actual: number;
    currency: string;
  };
  resources: ProjectResource[];
  completionPercentage: number;
  qualityMetrics: {
    testCoverage: number;
    codeQuality: number;
    documentation: number;
    securityScore: number;
  };
}
export interface ProjectRisk {
  id: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  status: 'open' | 'mitigated' | 'closed';
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ProjectMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'pending' | 'achieved' | 'missed' | 'at-risk';
  dependencies: string[];
  deliverables: string[];
  successCriteria: string[];
}
export interface ProjectResource {
  id: string;
  name: string;
  type: 'human' | 'infrastructure' | 'software' | 'hardware';
  availability: number; // percentage
  cost: {
    amount: number;
    currency: string;
    period: 'hour' | 'day' | 'week' | 'month';
  };
  skills: string[];
  allocation: {
    phaseId: string;
    percentage: number;
    startDate: Date;
    endDate: Date;
  }[];
}
export interface Project {
  id: string;
  name: string;
  description: string;
  type: 'web-app' | 'api' | 'microservice' | 'infrastructure' | 'research' | 'migration' | 'custom';
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  stakeholders: string[];
  phases: ProjectPhase[];
  budget: {
    total: number;
    spent: number;
    remaining: number;
    currency: string;
  };
  timeline: {
    plannedStart: Date;
    plannedEnd: Date;
    actualStart?: Date;
    actualEnd?: Date;
  };
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  auditLog: ProjectAuditEntry[];
  collaboration: {
    teamMembers: TeamMember[];
    communication: CommunicationChannel[];
    sharedResources: string[];
  };
  qualityGates: QualityGate[];
  complianceRequirements: ComplianceRequirement[];
}
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  availability: number;
  permissions: string[];
  joinDate: Date;
  status: 'active' | 'inactive' | 'on-leave';
}
export interface CommunicationChannel {
  id: string;
  name: string;
  type: 'slack' | 'teams' | 'email' | 'webhook' | 'custom';
  configuration: Record<string, unknown>;
  isActive: boolean;
}
export interface QualityGate {
  id: string;
  name: string;
  phase: string;
  criteria: {
    metric: string;
    threshold: number;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  }[];
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  executedAt?: Date;
  results: Record<string, number>;
}
export interface ComplianceRequirement {
  id: string;
  name: string;
  framework: string; // e.g., 'SOC2', 'GDPR', 'HIPAA', 'PCI-DSS'
  description: string;
  status: 'not-started' | 'in-progress' | 'compliant' | 'non-compliant';
  evidence: string[];
  reviewer: string;
  reviewDate?: Date;
  dueDate: Date;
}
export interface ProjectAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
export interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProjectDuration: number;
  budgetVariance: number;
  resourceUtilization: number;
  qualityScore: number;
  riskScore: number;
  teamProductivity: number;
  customerSatisfaction: number;
}
export interface ProjectReport {
  id: string;
  projectId: string;
  type: 'status' | 'financial' | 'quality' | 'risk' | 'resource' | 'compliance';
  title: string;
  summary: string;
  details: Record<string, unknown>;
  recommendations: string[];
  generatedAt: Date;
  generatedBy: string;
  format: 'json' | 'pdf' | 'html' | 'csv';
  recipients: string[];
}
export class ProjectManager extends EventEmitter {
  private projects: Map<string, Project> = new Map();
  private projectsPath: string;
  private logger: Logger;
  private config: ConfigManager;
  constructor(
    projectsPath: string = './projects',
    logger?: _Logger,
    config?: ConfigManager
  ) {
    super();
    this.projectsPath = projectsPath;
    this.logger = logger || new Logger({ level: 'info', format: 'text', destination: 'console' });
    this.config = config || ConfigManager.getInstance();
  }
  async initialize(): Promise<void> {
    try {
      await mkdir(this._projectsPath, { recursive: true });
      await this.loadProjects();
      this.logger.info('Project Manager initialized successfully');
    } catch (_error) {
      this.logger.error('Failed to initialize Project Manager', { error });
      throw error;
    }
  }
  async createProject(projectData: Partial<Project>): Promise<Project> {
    const _project: Project = {
      id: projectData.id || `project-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`,
      name: projectData.name || 'Unnamed Project',
      description: projectData.description || '',
      type: projectData.type || 'custom',
      status: 'planning',
      priority: projectData.priority || 'medium',
      owner: projectData.owner || 'system',
      stakeholders: projectData.stakeholders || [],
      phases: projectData.phases || [],
      budget: projectData.budget || {
        total: 0,
        spent: 0,
        remaining: 0,
        currency: 'USD'
      },
      timeline: {
        plannedStart: projectData.timeline?.plannedStart || new Date(),
        plannedEnd: projectData.timeline?.plannedEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        actualStart: projectData.timeline?.actualStart,
        actualEnd: projectData.timeline?.actualEnd
      },
      tags: projectData.tags || [],
      metadata: projectData.metadata || { /* empty */ },
      createdAt: new Date(),
      updatedAt: new Date(),
      auditLog: [],
      collaboration: {
        teamMembers: [],
        communication: [],
        sharedResources: []
      },
      qualityGates: [],
      complianceRequirements: []
    };
    // Add initial audit entry
    this.addAuditEntry(_project, 'system', 'project_created', 'project', {
      projectId: project._id,
      projectName: project.name
    });
    this.projects.set(project._id, project);
    await this.saveProject(project);
    this.emit('project:created', project);
    this.logger.info(`Project created: ${project.name} (${project.id})`);
    return project;
  }
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const _updatedProject = { ...project, ...updates, updatedAt: new Date() };
    // Add audit entry
    this.addAuditEntry(_updatedProject, 'system', 'project_updated', 'project', {
      _projectId,
      changes: Object.keys(updates)
    });
    this.projects.set(_projectId, updatedProject);
    await this.saveProject(updatedProject);
    this.emit('project:updated', updatedProject);
    this.logger.info(`Project updated: ${project.name} (${projectId})`);
    return updatedProject;
  }
  async deleteProject(projectId: string, userId: string = 'system'): Promise<void> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    // Add audit entry before deletion
    this.addAuditEntry(_project, _userId, 'project_deleted', 'project', {
      _projectId,
      projectName: project.name
    });
    this.projects.delete(projectId);
    
    // Archive project instead of deleting
    const _archivePath = join(this._projectsPath, 'archived');
    await mkdir(_archivePath, { recursive: true });
    await writeFile(
      join(_archivePath, `${projectId}.json`),
      JSON.stringify(_project, null, 2)
    );
    this.emit('project:deleted', { _projectId, project });
    this.logger.info(`Project archived: ${project.name} (${projectId})`);
  }
  async getProject(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) || null;
  }
  async listProjects(filters?: {
    status?: Project['status'];
    type?: Project['type'];
    priority?: Project['priority'];
    owner?: string;
    tags?: string[];
  }): Promise<Project[]> {
    let _projects = Array.from(this.projects.values());
    if (filters) {
      if (filters.status) {
        projects = projects.filter(p => p.status === filters.status);
      }
      if (filters.type) {
        projects = projects.filter(p => p.type === filters.type);
      }
      if (filters.priority) {
        projects = projects.filter(p => p.priority === filters.priority);
      }
      if (filters.owner) {
        projects = projects.filter(p => p.owner === filters.owner);
      }
      if (filters.tags && filters.tags.length > 0) {
        projects = projects.filter(p => 
          filters.tags!.some(tag => p.tags.includes(tag))
        );
      }
    }
    return projects.sort((_a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
  async addPhase(projectId: string, phase: Omit<_ProjectPhase, 'id'>): Promise<ProjectPhase> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const _newPhase: ProjectPhase = {
      id: `phase-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`,
      ...phase
    };
    project.phases.push(newPhase);
    project.updatedAt = new Date();
    this.addAuditEntry(_project, 'system', 'phase_added', 'phase', {
      _projectId,
      phaseId: newPhase._id,
      phaseName: newPhase.name
    });
    await this.saveProject(project);
    this.emit('phase:added', { _project, phase: newPhase });
    return newPhase;
  }
  async updatePhase(projectId: string, phaseId: string, updates: Partial<ProjectPhase>): Promise<ProjectPhase> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const _phaseIndex = project.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) {
      throw new Error(`Phase not found: ${phaseId}`);
    }
    const _updatedPhase = { ...project.phases[phaseIndex], ...updates };
    project.phases[phaseIndex] = updatedPhase;
    project.updatedAt = new Date();
    this.addAuditEntry(_project, 'system', 'phase_updated', 'phase', {
      _projectId,
      _phaseId,
      changes: Object.keys(updates)
    });
    await this.saveProject(project);
    this.emit('phase:updated', { _project, phase: updatedPhase });
    return updatedPhase;
  }
  async addTeamMember(projectId: string, member: TeamMember): Promise<void> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    project.collaboration.teamMembers.push(member);
    project.updatedAt = new Date();
    this.addAuditEntry(_project, 'system', 'team_member_added', 'team', {
      _projectId,
      memberId: member._id,
      memberName: member.name
    });
    await this.saveProject(project);
    this.emit('team:member_added', { _project, member });
  }
  async removeTeamMember(projectId: string, memberId: string): Promise<void> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const _memberIndex = project.collaboration.teamMembers.findIndex(m => m.id === memberId);
    if (memberIndex === -1) {
      throw new Error(`Team member not found: ${memberId}`);
    }
    const _member = project.collaboration.teamMembers[memberIndex];
    project.collaboration.teamMembers.splice(_memberIndex, 1);
    project.updatedAt = new Date();
    this.addAuditEntry(_project, 'system', 'team_member_removed', 'team', {
      _projectId,
      _memberId,
      memberName: member.name
    });
    await this.saveProject(project);
    this.emit('team:member_removed', { _project, memberId });
  }
  async getProjectMetrics(projectId?: string): Promise<ProjectMetrics> {
    const _projects = projectId ? 
      [this.projects.get(projectId)].filter(Boolean) as Project[] :
      Array.from(this.projects.values());
    const _totalProjects = projects.length;
    const _activeProjects = projects.filter(p => p.status === 'active').length;
    const _completedProjects = projects.filter(p => p.status === 'completed').length;
    const _completedProjectsWithDuration = projects.filter(p => 
      p.status === 'completed' && p.timeline.actualStart && p.timeline.actualEnd
    );
    const _averageProjectDuration = completedProjectsWithDuration.length > 0 ?
      completedProjectsWithDuration.reduce((_sum, p) => {
        const _duration = p.timeline.actualEnd!.getTime() - p.timeline.actualStart!.getTime();
        return sum + (duration / (1000 * 60 * 60 * 24)); // Convert to days
      }, 0) / completedProjectsWithDuration.length : 0;
    const _budgetVariance = projects.reduce((_sum, p) => {
      if (p.budget.total > 0) {
        return sum + ((p.budget.spent - p.budget.total) / p.budget.total);
      }
      return sum;
    }, 0) / Math.max(projects._length, 1);
    const _resourceUtilization = projects.reduce((_sum, p) => {
      const _totalResources = p.phases.reduce((_phaseSum, phase) => 
        phaseSum + phase.resources.length, 0
      );
      const _utilizedResources = p.phases.reduce((_phaseSum, phase) => 
        phaseSum + phase.resources.filter(r => r.availability > 0).length, 0
      );
      return sum + (totalResources > 0 ? utilizedResources / totalResources : 0);
    }, 0) / Math.max(projects._length, 1);
    const _qualityScore = projects.reduce((_sum, p) => {
      const _phaseQuality = p.phases.reduce((_phaseSum, phase) => {
        const _metrics = phase.qualityMetrics;
        return phaseSum + (metrics.testCoverage + metrics.codeQuality + 
                          metrics.documentation + metrics.securityScore) / 4;
      }, 0) / Math.max(p.phases._length, 1);
      return sum + phaseQuality;
    }, 0) / Math.max(projects._length, 1);
    return {
      totalProjects,
      activeProjects,
      completedProjects,
      averageProjectDuration,
      budgetVariance,
      resourceUtilization,
      qualityScore,
      riskScore: 0, // Calculate based on risk assessment
      teamProductivity: 0, // Calculate based on velocity metrics
      customerSatisfaction: 0 // Calculate based on feedback
    };
  }
  async generateReport(
    projectId: string,
    type: ProjectReport['type'],
    userId: string = 'system'
  ): Promise<ProjectReport> {
    const _project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const _report: ProjectReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`,
      projectId,
      type,
      title: `${type.toUpperCase()} Report - ${project.name}`,
      summary: '',
      details: { /* empty */ },
      recommendations: [],
      generatedAt: new Date(),
      generatedBy: userId,
      format: 'json',
      recipients: []
    };
    switch (type) {
      case 'status':
        {
report.summary = `Project ${project.name
}} is currently ${project.status}`;
        report.details = {
          status: project.status,
          progress: this.calculateProjectProgress(project),
          phases: project.phases.map(p => ({
            name: p._name,
            status: p._status,
            completion: p.completionPercentage
          })),
          timeline: project.timeline,
          nextMilestones: this.getUpcomingMilestones(project)
        };
        break;
      case 'financial':
        {
report.summary = `Budget utilization: ${((project.budget.spent / project.budget.total) * 100).toFixed(1)
}}%`;
        report.details = {
          budget: project.budget,
          costBreakdown: this.calculateCostBreakdown(project),
          variance: project.budget.spent - project.budget.total,
          projectedCost: this.projectFinalCost(project)
        };
        break;
      case 'quality': {
        const _qualityMetrics = this.calculateQualityMetrics(project);
        report.summary = `Overall quality score: ${qualityMetrics.overall.toFixed(1)}%`;
        report.details = {
          qualityMetrics,
          qualityGates: project.qualityGates,
          recommendations: this.generateQualityRecommendations(project)
        };
        break;
      }
      case 'risk': {
        const _risks = this.getAllRisks(project);
        report.summary = `${risks.filter(r => r.status === 'open').length} open risks identified`;
        report.details = {
          risks,
          riskMatrix: this.generateRiskMatrix(risks),
          mitigation: this.generateRiskMitigation(risks)
        };
        break;
      }
      case 'resource':
        {
report.summary = `${project.collaboration.teamMembers.length
}} team members, ${this.getTotalResources(project)} resources allocated`;
        report.details = {
          teamMembers: project.collaboration.teamMembers,
          resourceAllocation: this.calculateResourceAllocation(project),
          utilization: this.calculateResourceUtilization(project),
          capacity: this.calculateCapacity(project)
        };
        break;
      case 'compliance': {
        const _compliance = this.calculateComplianceStatus(project);
        report.summary = `${compliance.compliant} of ${compliance.total} requirements met`;
        report.details = {
          requirements: project.complianceRequirements,
          status: compliance,
          gaps: this.identifyComplianceGaps(project),
          recommendations: this.generateComplianceRecommendations(project)
        };
        break;
      }
    }
    this.addAuditEntry(_project, _userId, 'report_generated', 'report', {
      _projectId,
      reportId: report._id,
      reportType: type
    });
    this.emit('report:generated', { _project, report });
    return report;
  }
  private async loadProjects(): Promise<void> {
    try {
      const _files = await readdir(this.projectsPath);
      const _projectFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'));
      for (const file of projectFiles) {
        try {
          const _content = await readFile(join(this._projectsPath, file), 'utf-8');
          const _project: Project = JSON.parse(content);
          this.projects.set(project._id, project);
        } catch (_error) {
          this.logger.error(`Failed to load project file: ${file}`, { error });
        }
      }
      this.logger.info(`Loaded ${this.projects.size} projects`);
    } catch (_error) {
      this.logger.error('Failed to load projects', { error });
    }
  }
  private async saveProject(project: Project): Promise<void> {
    const _filePath = join(this._projectsPath, `${project.id}.json`);
    await writeFile(_filePath, JSON.stringify(_project, null, 2));
  }
  private addAuditEntry(
    project: _Project,
    userId: string,
    action: string,
    target: string,
    details: Record<string, unknown>
  ): void {
    const _entry: ProjectAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`,
      timestamp: new Date(),
      userId,
      action,
      target,
      details
    };
    project.auditLog.push(entry);
  }
  private calculateProjectProgress(project: Project): number {
    if (project.phases.length === 0) return 0;
    
    const _totalProgress = project.phases.reduce((_sum, phase) => 
      sum + phase.completionPercentage, 0
    );
    
    return totalProgress / project.phases.length;
  }
  private getUpcomingMilestones(project: Project): ProjectMilestone[] {
    const _allMilestones = project.phases.flatMap(p => p.milestones);
    const _now = new Date();
    
    return allMilestones
      .filter(m => m.status === 'pending' && m.targetDate > now)
      .sort((_a, b) => a.targetDate.getTime() - b.targetDate.getTime())
      .slice(_0, 5);
  }
  private calculateCostBreakdown(project: Project): Record<string, number> {
    const _breakdown: Record<string, number> = { /* empty */ };
    
    for (const phase of project.phases) {
      for (const resource of phase.resources) {
        const _category = resource.type;
        const _cost = resource.cost.amount;
        breakdown[category] = (breakdown[category] || 0) + cost;
      }
    }
    
    return breakdown;
  }
  private projectFinalCost(project: Project): number {
    const _progress = this.calculateProjectProgress(project);
    if (progress === 0) return project.budget.total;
    
    return (project.budget.spent / progress) * 100;
  }
  private calculateQualityMetrics(project: Project): unknown {
    const _allMetrics = project.phases.map(p => p.qualityMetrics);
    if (allMetrics.length === 0) {
      return { overall: 0, testCoverage: 0, codeQuality: 0, documentation: 0, securityScore: 0 };
    }
    const _averages = {
      testCoverage: allMetrics.reduce((_sum, m) => sum + m.testCoverage, 0) / allMetrics.length,
      codeQuality: allMetrics.reduce((_sum, m) => sum + m.codeQuality, 0) / allMetrics.length,
      documentation: allMetrics.reduce((_sum, m) => sum + m.documentation, 0) / allMetrics.length,
      securityScore: allMetrics.reduce((_sum, m) => sum + m.securityScore, 0) / allMetrics.length
    };
    const _overall = (averages.testCoverage + averages.codeQuality + 
                    averages.documentation + averages.securityScore) / 4;
    return { overall, ...averages };
  }
  private generateQualityRecommendations(project: Project): string[] {
    const _recommendations: string[] = [];
    const _metrics = this.calculateQualityMetrics(project);
    if (metrics.testCoverage < 80) {
      recommendations.push('Increase test coverage to at least 80%');
    }
    if (metrics.codeQuality < 70) {
      recommendations.push('Improve code quality through refactoring and code reviews');
    }
    if (metrics.documentation < 60) {
      recommendations.push('Enhance documentation coverage for better maintainability');
    }
    if (metrics.securityScore < 85) {
      recommendations.push('Address security vulnerabilities and implement security best practices');
    }
    return recommendations;
  }
  private getAllRisks(project: Project): ProjectRisk[] {
    return project.phases.flatMap(p => p.risks);
  }
  private generateRiskMatrix(risks: ProjectRisk[]): unknown {
    const _matrix = {
      low: { low: 0, medium: 0, high: 0 },
      medium: { low: 0, medium: 0, high: 0 },
      high: { low: 0, medium: 0, high: 0 }
    };
    for (const risk of risks) {
      if (risk.status === 'open') {
        matrix[risk.probability][risk.impact]++;
      }
    }
    return matrix;
  }
  private generateRiskMitigation(risks: ProjectRisk[]): unknown {
    const _openRisks = risks.filter(r => r.status === 'open');
    const _highPriorityRisks = openRisks.filter(r => 
      (r.probability === 'high' && r.impact === 'high') ||
      (r.probability === 'high' && r.impact === 'medium') ||
      (r.probability === 'medium' && r.impact === 'high')
    );
    return {
      totalRisks: risks.length,
      openRisks: openRisks.length,
      highPriorityRisks: highPriorityRisks.length,
      mitigationActions: highPriorityRisks.map(r => ({
        risk: r._description,
        mitigation: r._mitigation,
        assignedTo: r.assignedTo
      }))
    };
  }
  private getTotalResources(project: Project): number {
    return project.phases.reduce((_sum, phase) => sum + phase.resources.length, 0);
  }
  private calculateResourceAllocation(project: Project): unknown {
    const _allocation: Record<string, number> = { /* empty */ };
    
    for (const phase of project.phases) {
      for (const resource of phase.resources) {
        allocation[resource.type] = (allocation[resource.type] || 0) + 1;
      }
    }
    
    return allocation;
  }
  private calculateResourceUtilization(project: Project): unknown {
    const _utilization: Record<string, number> = { /* empty */ };
    
    for (const phase of project.phases) {
      for (const resource of phase.resources) {
        utilization[resource.type] = (utilization[resource.type] || 0) + resource.availability;
      }
    }
    
    return utilization;
  }
  private calculateCapacity(project: Project): unknown {
    const _teamSize = project.collaboration.teamMembers.length;
    const _totalAvailability = project.collaboration.teamMembers.reduce(
      (_sum, member) => sum + member.availability, 0
    );
    
    return {
      teamSize,
      totalAvailability,
      averageAvailability: teamSize > 0 ? totalAvailability / teamSize : 0
    };
  }
  private calculateComplianceStatus(project: Project): unknown {
    const _requirements = project.complianceRequirements;
    const _total = requirements.length;
    const _compliant = requirements.filter(r => r.status === 'compliant').length;
    const _inProgress = requirements.filter(r => r.status === 'in-progress').length;
    const _nonCompliant = requirements.filter(r => r.status === 'non-compliant').length;
    
    return {
      total,
      compliant,
      inProgress,
      nonCompliant,
      compliancePercentage: total > 0 ? (compliant / total) * 100 : 0
    };
  }
  private identifyComplianceGaps(project: Project): ComplianceRequirement[] {
    return project.complianceRequirements.filter(r => 
      r.status === 'not-started' || r.status === 'non-compliant'
    );
  }
  private generateComplianceRecommendations(project: Project): string[] {
    const _gaps = this.identifyComplianceGaps(project);
    const _recommendations: string[] = [];
    
    for (const gap of gaps) {
      recommendations.push(
        `Address ${gap.framework} requirement: ${gap.name} (Due: ${gap.dueDate.toLocaleDateString()})`
      );
    }
    
    return recommendations;
  }
}