/**
 * Security Monitoring Service
 * Real-time security monitoring, threat detection, and incident response
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import {
  SecurityEvent,
  SecurityEventType,
  SecurityIndicator,
  SecurityResponse,
  AuditLog,
  User,
  Tenant
} from '../types';
import { AuditService } from '../audit/audit-service';

export interface SecurityMonitorConfig {
  enableRealTimeAlerts: boolean;
  anomalyDetection: boolean;
  threatIntelligence: boolean;
  alertChannels: {
    email?: string[];
    slack?: {
      webhook: string;
      channel: string;
      severity: ('info' | 'warning' | 'error' | 'critical')[];
    };
    pagerduty?: {
      apiKey: string;
      serviceId: string;
      severity: ('error' | 'critical')[];
    };
    webhook?: {
      url: string;
      headers?: Record<string, string>;
    };
  };
  metrics: {
    authFailures: { threshold: number; window: number };
    apiRateLimit: { threshold: number; window: number };
    suspiciousActivity: { threshold: number; window: number };
    dataAccess: { threshold: number; window: number };
    privilegedActions: { threshold: number; window: number };
  };
  blocklist: {
    ips: string[];
    userAgents: RegExp[];
    countries: string[];
  };
  whitelist: {
    ips: string[];
    domains: string[];
  };
}

interface SecurityMetrics {
  authFailures: Map<string, number[]>;
  apiCalls: Map<string, number[]>;
  suspiciousActivities: Map<string, SecurityEvent[]>;
  dataAccess: Map<string, number[]>;
  privilegedActions: Map<string, number[]>;
}

interface ThreatIntelligence {
  maliciousIPs: Set<string>;
  knownAttackPatterns: RegExp[];
  suspiciousBehaviors: BehaviorPattern[];
  lastUpdated: Date;
}

interface BehaviorPattern {
  name: string;
  description: string;
  pattern: RegExp;
  indicators: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  response: 'log' | 'alert' | 'block' | 'challenge';
}

interface SecurityIncident {
  id: string;
  startTime: Date;
  endTime?: Date;
  events: SecurityEvent[];
  affectedUsers: Set<string>;
  affectedTenants: Set<string>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  response: IncidentResponse;
}

interface IncidentResponse {
  actions: string[];
  blockedIPs: string[];
  suspendedUsers: string[];
  notificationsSent: string[];
  mitigationSteps: string[];
}

export class SecurityMonitor extends EventEmitter {
  private logger: Logger;
  private config: SecurityMonitorConfig;
  private auditService: AuditService;
  private metrics: SecurityMetrics;
  private incidents: Map<string, SecurityIncident> = new Map();
  private threatIntel: ThreatIntelligence;
  private anomalyDetector?: AnomalyDetector;
  private monitoringActive: boolean = false;

  constructor(config: SecurityMonitorConfig, auditService: AuditService) {
    super();
    this.config = config;
    this.logger = new Logger('SecurityMonitor');
    this.auditService = auditService;
    this.metrics = this.initializeMetrics();
    this.threatIntel = this.initializeThreatIntel();
    this.initialize();
  }

  private initialize(): void {
    // Initialize anomaly detection
    if (this.config.anomalyDetection) {
      this.anomalyDetector = new AnomalyDetector();
    }

    // Load threat intelligence
    if (this.config.threatIntelligence) {
      this.loadThreatIntelligence();
    }

    // Start monitoring
    this.startMonitoring();

    this.logger.info('Security monitor initialized', {
      realTimeAlerts: this.config.enableRealTimeAlerts,
      anomalyDetection: this.config.anomalyDetection,
      threatIntelligence: this.config.threatIntelligence
    });
  }

  /**
   * Process security event
   */
  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Add event timestamp if not present
      if (!event.timestamp) {
        event.timestamp = new Date();
      }

      // Check blocklist/whitelist
      const blocked = await this.checkBlocklist(event);
      if (blocked) {
        event.response = {
          action: 'blocked',
          automated: true,
          timestamp: new Date(),
          details: 'Blocked by security policy'
        };
        this.emit('security:blocked', event);
        return;
      }

      // Update metrics
      this.updateMetrics(event);

      // Check for threshold violations
      const violations = this.checkThresholds(event);
      if (violations.length > 0) {
        await this.handleThresholdViolations(event, violations);
      }

      // Anomaly detection
      if (this.config.anomalyDetection && this.anomalyDetector) {
        const anomaly = await this.anomalyDetector.detect(event);
        if (anomaly) {
          event.indicators.push({
            type: 'behavior_anomaly',
            confidence: anomaly.confidence,
            details: anomaly
          });
        }
      }

      // Threat intelligence check
      if (this.config.threatIntelligence) {
        const threats = this.checkThreatIntelligence(event);
        event.indicators.push(...threats);
      }

      // Determine severity and response
      const severity = this.calculateSeverity(event);
      const response = this.determineResponse(event, severity);

      // Execute response
      if (response !== 'log') {
        await this.executeResponse(event, response);
      }

      // Check for incident correlation
      await this.correlateIncident(event);

      // Send alerts if configured
      if (this.config.enableRealTimeAlerts && severity !== 'info') {
        await this.sendAlerts(event);
      }

      // Audit log
      await this.auditService.log({
        tenantId: event.tenantId,
        userId: event.userId,
        action: {
          category: 'system',
          type: 'security_event_processed',
          severity: severity,
          description: `Processed security event: ${event.type}`
        },
        resource: 'security_monitor',
        result: 'success',
        metadata: {
          eventId: event.id,
          eventType: event.type,
          indicators: event.indicators.length,
          response: response
        }
      } as AuditLog);

    } catch (error) {
      this.logger.error('Failed to process security event', error);
    }
  }

  /**
   * Start an investigation
   */
  async startInvestigation(
    criteria: {
      userId?: string;
      tenantId?: string;
      ipAddress?: string;
      timeRange?: { start: Date; end: Date };
      eventTypes?: SecurityEventType[];
    }
  ): Promise<{
    events: SecurityEvent[];
    patterns: any[];
    recommendations: string[];
  }> {
    try {
      this.logger.info('Starting security investigation', criteria);

      // Query audit logs
      const auditLogs = await this.auditService.query({
        userId: criteria.userId,
        tenantId: criteria.tenantId,
        startDate: criteria.timeRange?.start,
        endDate: criteria.timeRange?.end
      });

      // Find related security events
      const events: SecurityEvent[] = [];
      for (const incident of this.incidents.values()) {
        for (const event of incident.events) {
          if (this.matchesCriteria(event, criteria)) {
            events.push(event);
          }
        }
      }

      // Analyze patterns
      const patterns = this.analyzePatterns(events, auditLogs.logs);

      // Generate recommendations
      const recommendations = this.generateRecommendations(patterns);

      // Create investigation report
      await this.auditService.log({
        userId: criteria.userId,
        tenantId: criteria.tenantId,
        action: {
          category: 'system',
          type: 'security_investigation',
          severity: 'medium',
          description: 'Security investigation conducted'
        },
        resource: 'security_investigation',
        result: 'success',
        metadata: {
          criteria,
          eventsFound: events.length,
          patternsDetected: patterns.length
        }
      } as AuditLog);

      return {
        events,
        patterns,
        recommendations
      };
    } catch (error) {
      this.logger.error('Investigation failed', error);
      throw error;
    }
  }

  /**
   * Get security metrics
   */
  getMetrics(
    timeRange?: { start: Date; end: Date }
  ): {
    authFailures: number;
    apiCalls: number;
    suspiciousActivities: number;
    incidents: {
      total: number;
      open: number;
      critical: number;
    };
    topThreats: Array<{ type: string; count: number }>;
  } {
    const now = Date.now();
    const start = timeRange?.start.getTime() || now - 24 * 60 * 60 * 1000;
    const end = timeRange?.end.getTime() || now;

    // Count metrics within time range
    let authFailures = 0;
    let apiCalls = 0;
    let suspiciousActivities = 0;

    for (const timestamps of this.metrics.authFailures.values()) {
      authFailures += timestamps.filter(t => t >= start && t <= end).length;
    }

    for (const timestamps of this.metrics.apiCalls.values()) {
      apiCalls += timestamps.filter(t => t >= start && t <= end).length;
    }

    for (const events of this.metrics.suspiciousActivities.values()) {
      suspiciousActivities += events.filter(e => 
        e.timestamp.getTime() >= start && e.timestamp.getTime() <= end
      ).length;
    }

    // Count incidents
    const incidents = Array.from(this.incidents.values());
    const relevantIncidents = incidents.filter(i => 
      i.startTime.getTime() >= start && i.startTime.getTime() <= end
    );

    // Count threat types
    const threatCounts = new Map<string, number>();
    for (const activities of this.metrics.suspiciousActivities.values()) {
      for (const event of activities) {
        if (event.timestamp.getTime() >= start && event.timestamp.getTime() <= end) {
          threatCounts.set(event.type, (threatCounts.get(event.type) || 0) + 1);
        }
      }
    }

    const topThreats = Array.from(threatCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      authFailures,
      apiCalls,
      suspiciousActivities,
      incidents: {
        total: relevantIncidents.length,
        open: relevantIncidents.filter(i => i.status === 'open').length,
        critical: relevantIncidents.filter(i => i.severity === 'critical').length
      },
      topThreats
    };
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values())
      .filter(i => i.status !== 'resolved')
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Update incident status
   */
  async updateIncidentStatus(
    incidentId: string,
    status: SecurityIncident['status'],
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    incident.status = status;
    if (status === 'resolved') {
      incident.endTime = new Date();
    }

    // Audit log
    await this.auditService.log({
      userId: updatedBy,
      action: {
        category: 'system',
        type: 'incident_status_updated',
        severity: 'medium',
        description: `Updated incident status to ${status}`
      },
      resource: 'security_incident',
      resourceId: incidentId,
      result: 'success',
      metadata: { status, notes }
    } as AuditLog);

    this.emit('incident:updated', { incident });
  }

  /**
   * Private methods
   */
  private initializeMetrics(): SecurityMetrics {
    return {
      authFailures: new Map(),
      apiCalls: new Map(),
      suspiciousActivities: new Map(),
      dataAccess: new Map(),
      privilegedActions: new Map()
    };
  }

  private initializeThreatIntel(): ThreatIntelligence {
    return {
      maliciousIPs: new Set(),
      knownAttackPatterns: [
        /(?:union.*select|select.*from|insert.*into|delete.*from|update.*set)/i, // SQL injection
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi, // XSS
        /\.\.[\\\/]/g, // Path traversal
        /\${.*}/g, // Template injection
      ],
      suspiciousBehaviors: [
        {
          name: 'Rapid Authentication Failures',
          description: 'Multiple failed login attempts in short time',
          pattern: /login_failed/,
          indicators: ['Multiple IPs', 'User enumeration'],
          severity: 'high',
          response: 'block'
        },
        {
          name: 'Data Exfiltration Attempt',
          description: 'Unusual data access patterns',
          pattern: /data_export|bulk_download/,
          indicators: ['Large volume', 'After hours', 'New location'],
          severity: 'critical',
          response: 'alert'
        },
        {
          name: 'Privilege Escalation',
          description: 'Attempts to access unauthorized resources',
          pattern: /unauthorized_access|permission_denied/,
          indicators: ['Role manipulation', 'API abuse'],
          severity: 'critical',
          response: 'block'
        }
      ],
      lastUpdated: new Date()
    };
  }

  private startMonitoring(): void {
    this.monitoringActive = true;

    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Every hour

    // Update threat intelligence
    if (this.config.threatIntelligence) {
      setInterval(() => {
        this.loadThreatIntelligence();
      }, 6 * 60 * 60 * 1000); // Every 6 hours
    }
  }

  private async checkBlocklist(event: SecurityEvent): Promise<boolean> {
    // Check IP blocklist
    if (event.details.ipAddress && 
        this.config.blocklist.ips.includes(event.details.ipAddress)) {
      return true;
    }

    // Check user agent blocklist
    if (event.details.userAgent) {
      for (const pattern of this.config.blocklist.userAgents) {
        if (pattern.test(event.details.userAgent)) {
          return true;
        }
      }
    }

    // Check country blocklist
    if (event.details.country && 
        this.config.blocklist.countries.includes(event.details.country)) {
      return true;
    }

    return false;
  }

  private updateMetrics(event: SecurityEvent): void {
    const now = Date.now();
    const key = event.userId || event.details.ipAddress || 'anonymous';

    switch (event.type) {
      case 'authentication_failure':
        if (!this.metrics.authFailures.has(key)) {
          this.metrics.authFailures.set(key, []);
        }
        this.metrics.authFailures.get(key)!.push(now);
        break;

      case 'rate_limit_exceeded':
        if (!this.metrics.apiCalls.has(key)) {
          this.metrics.apiCalls.set(key, []);
        }
        this.metrics.apiCalls.get(key)!.push(now);
        break;

      case 'suspicious_activity':
      case 'data_breach_attempt':
      case 'authorization_violation':
        if (!this.metrics.suspiciousActivities.has(key)) {
          this.metrics.suspiciousActivities.set(key, []);
        }
        this.metrics.suspiciousActivities.get(key)!.push(event);
        break;
    }

    // Update data access metrics
    if (event.details.action?.includes('data_access')) {
      if (!this.metrics.dataAccess.has(key)) {
        this.metrics.dataAccess.set(key, []);
      }
      this.metrics.dataAccess.get(key)!.push(now);
    }

    // Update privileged action metrics
    if (event.details.privileged) {
      if (!this.metrics.privilegedActions.has(key)) {
        this.metrics.privilegedActions.set(key, []);
      }
      this.metrics.privilegedActions.get(key)!.push(now);
    }
  }

  private checkThresholds(event: SecurityEvent): string[] {
    const violations: string[] = [];
    const now = Date.now();
    const key = event.userId || event.details.ipAddress || 'anonymous';

    // Check auth failures
    const authFailures = this.metrics.authFailures.get(key) || [];
    const recentAuthFailures = authFailures.filter(t => 
      now - t < this.config.metrics.authFailures.window * 1000
    );
    if (recentAuthFailures.length >= this.config.metrics.authFailures.threshold) {
      violations.push('auth_failures_exceeded');
    }

    // Check API rate limit
    const apiCalls = this.metrics.apiCalls.get(key) || [];
    const recentApiCalls = apiCalls.filter(t => 
      now - t < this.config.metrics.apiRateLimit.window * 1000
    );
    if (recentApiCalls.length >= this.config.metrics.apiRateLimit.threshold) {
      violations.push('api_rate_limit_exceeded');
    }

    // Check suspicious activity
    const suspiciousActivities = this.metrics.suspiciousActivities.get(key) || [];
    const recentSuspicious = suspiciousActivities.filter(e => 
      now - e.timestamp.getTime() < this.config.metrics.suspiciousActivity.window * 1000
    );
    if (recentSuspicious.length >= this.config.metrics.suspiciousActivity.threshold) {
      violations.push('suspicious_activity_exceeded');
    }

    return violations;
  }

  private async handleThresholdViolations(
    event: SecurityEvent,
    violations: string[]
  ): Promise<void> {
    for (const violation of violations) {
      const indicator: SecurityIndicator = {
        type: 'policy_violation',
        confidence: 90,
        details: { violation, threshold: this.config.metrics[violation] }
      };
      event.indicators.push(indicator);

      // Create or update incident
      await this.createOrUpdateIncident(event, violation);
    }
  }

  private checkThreatIntelligence(event: SecurityEvent): SecurityIndicator[] {
    const indicators: SecurityIndicator[] = [];

    // Check malicious IPs
    if (event.details.ipAddress && 
        this.threatIntel.maliciousIPs.has(event.details.ipAddress)) {
      indicators.push({
        type: 'ip_reputation',
        confidence: 95,
        details: { source: 'threat_intel', ip: event.details.ipAddress }
      });
    }

    // Check attack patterns
    const eventData = JSON.stringify(event.details);
    for (const pattern of this.threatIntel.knownAttackPatterns) {
      if (pattern.test(eventData)) {
        indicators.push({
          type: 'known_attack_pattern',
          confidence: 85,
          details: { pattern: pattern.toString() }
        });
      }
    }

    // Check suspicious behaviors
    for (const behavior of this.threatIntel.suspiciousBehaviors) {
      if (behavior.pattern.test(event.type) || 
          behavior.pattern.test(eventData)) {
        indicators.push({
          type: 'behavior_anomaly',
          confidence: 80,
          details: { 
            behavior: behavior.name,
            severity: behavior.severity
          }
        });
      }
    }

    return indicators;
  }

  private calculateSeverity(event: SecurityEvent): SecurityEvent['severity'] {
    // Base severity from event
    let score = {
      'info': 1,
      'warning': 2,
      'error': 3,
      'critical': 4
    }[event.severity];

    // Increase based on indicators
    for (const indicator of event.indicators) {
      if (indicator.confidence > 80) {
        score += 0.5;
      }
      if (indicator.type === 'known_attack_pattern') {
        score += 1;
      }
    }

    // Map score back to severity
    if (score >= 4) return 'critical';
    if (score >= 3) return 'error';
    if (score >= 2) return 'warning';
    return 'info';
  }

  private determineResponse(
    event: SecurityEvent,
    severity: SecurityEvent['severity']
  ): 'log' | 'alert' | 'block' | 'challenge' {
    // Check for specific behavior patterns
    for (const behavior of this.threatIntel.suspiciousBehaviors) {
      if (event.indicators.some(i => 
        i.details.behavior === behavior.name
      )) {
        return behavior.response;
      }
    }

    // Default response based on severity
    switch (severity) {
      case 'critical':
        return 'block';
      case 'error':
        return 'alert';
      case 'warning':
        return 'alert';
      default:
        return 'log';
    }
  }

  private async executeResponse(
    event: SecurityEvent,
    response: string
  ): Promise<void> {
    event.response = {
      action: response as any,
      automated: true,
      timestamp: new Date()
    };

    switch (response) {
      case 'block':
        // Block IP or user
        if (event.details.ipAddress) {
          this.config.blocklist.ips.push(event.details.ipAddress);
          event.response.details = `Blocked IP: ${event.details.ipAddress}`;
        }
        if (event.userId) {
          // Emit event to suspend user
          this.emit('security:suspend_user', { userId: event.userId, reason: event.type });
          event.response.details = `Suspended user: ${event.userId}`;
        }
        break;

      case 'challenge':
        // Require additional authentication
        this.emit('security:challenge_required', { event });
        event.response.details = 'Additional authentication required';
        break;

      case 'alert':
        // Alerts are sent separately
        event.response.details = 'Security team alerted';
        break;
    }
  }

  private async correlateIncident(event: SecurityEvent): Promise<void> {
    const key = event.userId || event.details.ipAddress || 'unknown';
    
    // Find existing incident
    let incident: SecurityIncident | undefined;
    for (const inc of this.incidents.values()) {
      if (inc.status !== 'resolved' && 
          (inc.affectedUsers.has(event.userId || '') ||
           inc.events.some(e => e.details.ipAddress === event.details.ipAddress))) {
        incident = inc;
        break;
      }
    }

    if (!incident) {
      // Create new incident if severity warrants it
      if (event.severity === 'error' || event.severity === 'critical') {
        incident = await this.createIncident(event);
      }
    } else {
      // Add event to existing incident
      incident.events.push(event);
      if (event.userId) incident.affectedUsers.add(event.userId);
      if (event.tenantId) incident.affectedTenants.add(event.tenantId);
      
      // Update severity if needed
      if (this.getSeverityScore(event.severity) > this.getSeverityScore(incident.severity)) {
        incident.severity = event.severity;
      }
    }
  }

  private async createIncident(event: SecurityEvent): Promise<SecurityIncident> {
    const incident: SecurityIncident = {
      id: uuidv4(),
      startTime: new Date(),
      events: [event],
      affectedUsers: new Set(event.userId ? [event.userId] : []),
      affectedTenants: new Set(event.tenantId ? [event.tenantId] : []),
      severity: event.severity,
      status: 'open',
      response: {
        actions: [],
        blockedIPs: [],
        suspendedUsers: [],
        notificationsSent: [],
        mitigationSteps: []
      }
    };

    this.incidents.set(incident.id, incident);
    
    // Emit incident created event
    this.emit('incident:created', { incident });

    // Auto-respond to critical incidents
    if (incident.severity === 'critical') {
      await this.autoRespondToIncident(incident);
    }

    return incident;
  }

  private async createOrUpdateIncident(
    event: SecurityEvent,
    violation: string
  ): Promise<void> {
    // Implementation similar to correlateIncident
    await this.correlateIncident(event);
  }

  private async autoRespondToIncident(incident: SecurityIncident): Promise<void> {
    // Block all IPs involved
    for (const event of incident.events) {
      if (event.details.ipAddress && 
          !incident.response.blockedIPs.includes(event.details.ipAddress)) {
        this.config.blocklist.ips.push(event.details.ipAddress);
        incident.response.blockedIPs.push(event.details.ipAddress);
        incident.response.actions.push(`Blocked IP: ${event.details.ipAddress}`);
      }
    }

    // Suspend affected users
    for (const userId of incident.affectedUsers) {
      if (!incident.response.suspendedUsers.includes(userId)) {
        this.emit('security:suspend_user', { userId, reason: 'security_incident' });
        incident.response.suspendedUsers.push(userId);
        incident.response.actions.push(`Suspended user: ${userId}`);
      }
    }

    // Update incident status
    incident.status = 'investigating';
  }

  private async sendAlerts(event: SecurityEvent): Promise<void> {
    const alert = {
      id: event.id,
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp,
      source: event.source,
      details: event.details,
      indicators: event.indicators,
      response: event.response
    };

    // Email alerts
    if (this.config.alertChannels.email) {
      this.emit('alert:email', {
        to: this.config.alertChannels.email,
        subject: `Security Alert: ${event.type}`,
        data: alert
      });
    }

    // Slack alerts
    if (this.config.alertChannels.slack && 
        this.config.alertChannels.slack.severity.includes(event.severity)) {
      this.emit('alert:slack', {
        webhook: this.config.alertChannels.slack.webhook,
        channel: this.config.alertChannels.slack.channel,
        data: alert
      });
    }

    // PagerDuty for critical alerts
    if (this.config.alertChannels.pagerduty && 
        this.config.alertChannels.pagerduty.severity.includes(event.severity)) {
      this.emit('alert:pagerduty', {
        apiKey: this.config.alertChannels.pagerduty.apiKey,
        serviceId: this.config.alertChannels.pagerduty.serviceId,
        data: alert
      });
    }

    // Webhook
    if (this.config.alertChannels.webhook) {
      this.emit('alert:webhook', {
        url: this.config.alertChannels.webhook.url,
        headers: this.config.alertChannels.webhook.headers,
        data: alert
      });
    }
  }

  private matchesCriteria(event: SecurityEvent, criteria: any): boolean {
    if (criteria.userId && event.userId !== criteria.userId) return false;
    if (criteria.tenantId && event.tenantId !== criteria.tenantId) return false;
    if (criteria.ipAddress && event.details.ipAddress !== criteria.ipAddress) return false;
    if (criteria.eventTypes && !criteria.eventTypes.includes(event.type)) return false;
    if (criteria.timeRange) {
      const eventTime = event.timestamp.getTime();
      if (eventTime < criteria.timeRange.start.getTime() || 
          eventTime > criteria.timeRange.end.getTime()) {
        return false;
      }
    }
    return true;
  }

  private analyzePatterns(
    events: SecurityEvent[],
    auditLogs: AuditLog[]
  ): any[] {
    const patterns: any[] = [];

    // Time-based patterns
    const timePatterns = this.findTimePatterns(events);
    patterns.push(...timePatterns);

    // Geographic patterns
    const geoPatterns = this.findGeographicPatterns(events);
    patterns.push(...geoPatterns);

    // Behavioral patterns
    const behaviorPatterns = this.findBehavioralPatterns(events, auditLogs);
    patterns.push(...behaviorPatterns);

    return patterns;
  }

  private findTimePatterns(events: SecurityEvent[]): any[] {
    const patterns: any[] = [];
    
    // Group by hour
    const hourlyGroups = new Map<number, SecurityEvent[]>();
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      if (!hourlyGroups.has(hour)) {
        hourlyGroups.set(hour, []);
      }
      hourlyGroups.get(hour)!.push(event);
    });

    // Find unusual activity times
    for (const [hour, hourEvents] of hourlyGroups.entries()) {
      if ((hour < 6 || hour > 22) && hourEvents.length > 5) {
        patterns.push({
          type: 'after_hours_activity',
          description: `Unusual activity during off-hours (${hour}:00)`,
          events: hourEvents.length,
          severity: 'medium'
        });
      }
    }

    return patterns;
  }

  private findGeographicPatterns(events: SecurityEvent[]): any[] {
    const patterns: any[] = [];
    
    // Group by location
    const locationGroups = new Map<string, SecurityEvent[]>();
    events.forEach(event => {
      const location = event.details.country || 'unknown';
      if (!locationGroups.has(location)) {
        locationGroups.set(location, []);
      }
      locationGroups.get(location)!.push(event);
    });

    // Find distributed attacks
    if (locationGroups.size > 5) {
      patterns.push({
        type: 'distributed_attack',
        description: 'Activity from multiple geographic locations',
        locations: Array.from(locationGroups.keys()),
        severity: 'high'
      });
    }

    return patterns;
  }

  private findBehavioralPatterns(
    events: SecurityEvent[],
    auditLogs: AuditLog[]
  ): any[] {
    const patterns: any[] = [];
    
    // Look for escalation patterns
    const userEvents = new Map<string, SecurityEvent[]>();
    events.forEach(event => {
      if (event.userId) {
        if (!userEvents.has(event.userId)) {
          userEvents.set(event.userId, []);
        }
        userEvents.get(event.userId)!.push(event);
      }
    });

    for (const [userId, userEventList] of userEvents.entries()) {
      // Sort by time
      userEventList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Check for privilege escalation attempts
      const escalationAttempts = userEventList.filter(e => 
        e.type === 'authorization_violation' || 
        e.details.action?.includes('admin')
      );
      
      if (escalationAttempts.length > 3) {
        patterns.push({
          type: 'privilege_escalation_attempt',
          description: 'Multiple attempts to access privileged resources',
          userId,
          attempts: escalationAttempts.length,
          severity: 'critical'
        });
      }
    }

    return patterns;
  }

  private generateRecommendations(patterns: any[]): string[] {
    const recommendations: string[] = [];

    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'after_hours_activity':
          recommendations.push('Enable stricter access controls during off-hours');
          recommendations.push('Implement time-based access policies');
          break;
        
        case 'distributed_attack':
          recommendations.push('Implement geo-blocking for suspicious countries');
          recommendations.push('Enable rate limiting per geographic region');
          break;
        
        case 'privilege_escalation_attempt':
          recommendations.push('Review and restrict user permissions');
          recommendations.push('Implement just-in-time access controls');
          recommendations.push('Enable additional authentication for privileged actions');
          break;
      }
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }

  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean auth failures
    for (const [key, timestamps] of this.metrics.authFailures.entries()) {
      const filtered = timestamps.filter(t => now - t < maxAge);
      if (filtered.length === 0) {
        this.metrics.authFailures.delete(key);
      } else {
        this.metrics.authFailures.set(key, filtered);
      }
    }

    // Clean other metrics similarly
    for (const [key, timestamps] of this.metrics.apiCalls.entries()) {
      const filtered = timestamps.filter(t => now - t < maxAge);
      if (filtered.length === 0) {
        this.metrics.apiCalls.delete(key);
      } else {
        this.metrics.apiCalls.set(key, filtered);
      }
    }

    // Clean suspicious activities
    for (const [key, events] of this.metrics.suspiciousActivities.entries()) {
      const filtered = events.filter(e => 
        now - e.timestamp.getTime() < maxAge
      );
      if (filtered.length === 0) {
        this.metrics.suspiciousActivities.delete(key);
      } else {
        this.metrics.suspiciousActivities.set(key, filtered);
      }
    }

    // Clean resolved incidents older than 7 days
    const incidentMaxAge = 7 * 24 * 60 * 60 * 1000;
    for (const [id, incident] of this.incidents.entries()) {
      if (incident.status === 'resolved' && 
          incident.endTime && 
          now - incident.endTime.getTime() > incidentMaxAge) {
        this.incidents.delete(id);
      }
    }
  }

  private async loadThreatIntelligence(): Promise<void> {
    try {
      // TODO: Implement loading from threat intelligence feeds
      // This would typically fetch from:
      // - IP reputation services
      // - Known malware signatures
      // - Attack pattern databases
      // - Behavioral threat indicators
      
      this.logger.info('Threat intelligence updated');
      this.threatIntel.lastUpdated = new Date();
    } catch (error) {
      this.logger.error('Failed to load threat intelligence', error);
    }
  }

  private getSeverityScore(severity: string): number {
    const scores = {
      'critical': 4,
      'high': 3,
      'error': 3,
      'medium': 2,
      'warning': 2,
      'low': 1,
      'info': 0
    };
    return scores[severity] || 0;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.monitoringActive = false;
    this.removeAllListeners();
  }
}

/**
 * Anomaly Detection using statistical methods
 */
class AnomalyDetector {
  private baselines: Map<string, BaselineMetrics> = new Map();
  private learningPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

  async detect(event: SecurityEvent): Promise<any | null> {
    const key = `${event.type}:${event.userId || event.details.ipAddress}`;
    let baseline = this.baselines.get(key);

    if (!baseline) {
      baseline = this.createBaseline(key);
      this.baselines.set(key, baseline);
    }

    // Update baseline
    this.updateBaseline(baseline, event);

    // Check for anomalies after learning period
    if (Date.now() - baseline.createdAt.getTime() < this.learningPeriod) {
      return null;
    }

    const anomaly = this.checkAnomaly(baseline, event);
    return anomaly;
  }

  private createBaseline(key: string): BaselineMetrics {
    return {
      key,
      createdAt: new Date(),
      eventCount: 0,
      avgInterval: 0,
      stdDevInterval: 0,
      lastEventTime: Date.now(),
      features: new Map()
    };
  }

  private updateBaseline(baseline: BaselineMetrics, event: SecurityEvent): void {
    const now = Date.now();
    const interval = now - baseline.lastEventTime;

    // Update running average and standard deviation
    baseline.eventCount++;
    const oldAvg = baseline.avgInterval;
    baseline.avgInterval = oldAvg + (interval - oldAvg) / baseline.eventCount;
    
    if (baseline.eventCount > 1) {
      baseline.stdDevInterval = Math.sqrt(
        ((baseline.eventCount - 1) * Math.pow(baseline.stdDevInterval, 2) + 
         Math.pow(interval - oldAvg, 2)) / baseline.eventCount
      );
    }

    baseline.lastEventTime = now;

    // Update feature baselines
    this.updateFeatures(baseline, event);
  }

  private updateFeatures(baseline: BaselineMetrics, event: SecurityEvent): void {
    // Extract features from event
    const features = {
      dataSize: event.details.dataSize || 0,
      responseTime: event.details.responseTime || 0,
      errorRate: event.details.errorRate || 0
    };

    for (const [name, value] of Object.entries(features)) {
      if (typeof value === 'number') {
        let feature = baseline.features.get(name);
        if (!feature) {
          feature = { avg: 0, stdDev: 0, count: 0 };
          baseline.features.set(name, feature);
        }

        // Update feature statistics
        feature.count++;
        const oldAvg = feature.avg;
        feature.avg = oldAvg + (value - oldAvg) / feature.count;
        
        if (feature.count > 1) {
          feature.stdDev = Math.sqrt(
            ((feature.count - 1) * Math.pow(feature.stdDev, 2) + 
             Math.pow(value - oldAvg, 2)) / feature.count
          );
        }
      }
    }
  }

  private checkAnomaly(baseline: BaselineMetrics, event: SecurityEvent): any | null {
    const anomalies: any[] = [];

    // Check interval anomaly
    const interval = Date.now() - baseline.lastEventTime;
    const zScoreInterval = Math.abs((interval - baseline.avgInterval) / baseline.stdDevInterval);
    
    if (zScoreInterval > 3) {
      anomalies.push({
        type: 'timing_anomaly',
        description: 'Unusual time interval between events',
        zScore: zScoreInterval
      });
    }

    // Check feature anomalies
    const features = {
      dataSize: event.details.dataSize || 0,
      responseTime: event.details.responseTime || 0,
      errorRate: event.details.errorRate || 0
    };

    for (const [name, value] of Object.entries(features)) {
      if (typeof value === 'number') {
        const feature = baseline.features.get(name);
        if (feature && feature.count > 10) {
          const zScore = Math.abs((value - feature.avg) / feature.stdDev);
          if (zScore > 3) {
            anomalies.push({
              type: 'feature_anomaly',
              feature: name,
              description: `Unusual ${name} value`,
              zScore,
              value,
              expected: feature.avg
            });
          }
        }
      }
    }

    if (anomalies.length === 0) {
      return null;
    }

    // Calculate overall confidence
    const maxZScore = Math.max(...anomalies.map(a => a.zScore || 0));
    const confidence = Math.min(95, 50 + (maxZScore - 3) * 10);

    return {
      anomalies,
      confidence,
      baseline: {
        eventCount: baseline.eventCount,
        avgInterval: baseline.avgInterval
      }
    };
  }
}

interface BaselineMetrics {
  key: string;
  createdAt: Date;
  eventCount: number;
  avgInterval: number;
  stdDevInterval: number;
  lastEventTime: number;
  features: Map<string, {
    avg: number;
    stdDev: number;
    count: number;
  }>;
}