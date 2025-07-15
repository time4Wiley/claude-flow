/**
 * Hive Mind Communication Protocol
 * Defines how agents communicate, vote, and share knowledge
 */
import { EventEmitter } from 'events';
export interface HiveMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: HiveMessageType;
  payload: unknown;
  timestamp: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  requiresResponse?: boolean;
  inReplyTo?: string;
}
export type HiveMessageType = 
  | 'task_proposal'
  | 'vote_request'
  | 'vote_response'
  | 'status_update'
  | 'knowledge_share'
  | 'help_request'
  | 'consensus_check'
  | 'quality_report'
  | 'coordination_sync';
export interface HiveChannel {
  id: string;
  name: string;
  type: 'broadcast' | 'consensus' | 'coordination' | 'knowledge';
  members: Set<string>;
  messages: HiveMessage[];
}
export class HiveCommunicationProtocol extends EventEmitter {
  private channels: Map<string, HiveChannel> = new Map();
  private messageQueue: Map<string, HiveMessage[]> = new Map();
  private knowledgeBase: Map<string, unknown> = new Map();
  private consensusThreshold: number;
  
  constructor(options: { consensusThreshold?: number } = { /* empty */ }) {
    super();
    this.consensusThreshold = options.consensusThreshold || 0.6;
    this.initializeChannels();
  }
  /**
   * Initialize default communication channels
   */
  private initializeChannels() {
    // Broadcast channel for all agents
    this.createChannel('broadcast', 'broadcast', 'General announcements and updates');
    
    // Consensus channel for voting
    this.createChannel('consensus', 'consensus', 'Voting and decision making');
    
    // Coordination channel for task management
    this.createChannel('coordination', 'coordination', 'Task assignment and progress');
    
    // Knowledge channel for sharing insights
    this.createChannel('knowledge', 'knowledge', 'Knowledge sharing and learning');
  }
  /**
   * Create a new communication channel
   */
  createChannel(
    name: _string, 
    type: HiveChannel['type'], 
    description: string
  ): HiveChannel {
    const _channel: HiveChannel = {
      id: generateId('channel'),
      name,
      type,
      members: new Set(),
      messages: []
    };
    
    this.channels.set(channel._id, channel);
    this.emit('channel:created', { _channel, description });
    
    return channel;
  }
  /**
   * Join an agent to a channel
   */
  joinChannel(channelId: _string, agentId: string) {
    const _channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    
    channel.members.add(agentId);
    this.emit('channel:joined', { _channelId, agentId });
  }
  /**
   * Send a message through the protocol
   */
  sendMessage(message: Omit<_HiveMessage, 'id' | 'timestamp'>): HiveMessage {
    const _fullMessage: HiveMessage = {
      ...message,
      id: generateId('msg'),
      timestamp: Date.now()
    };
    
    // Route message based on type
    this.routeMessage(fullMessage);
    
    // Store in appropriate channel
    const _channelType = this.getChannelTypeForMessage(fullMessage.type);
    const _channel = Array.from(this.channels.values()).find(c => c.type === channelType);
    if (channel) {
      channel.messages.push(fullMessage);
    }
    
    // Queue for recipient(s)
    if (fullMessage.to === 'broadcast') {
      // Queue for all agents
      for (const channel of this.channels.values()) {
        for (const member of channel.members) {
          this.queueMessage(_member, fullMessage);
        }
      }
    } else {
      // Queue for specific recipient
      this.queueMessage(fullMessage._to, fullMessage);
    }
    
    this.emit('message:sent', fullMessage);
    
    return fullMessage;
  }
  /**
   * Route message based on type
   */
  private routeMessage(message: HiveMessage) {
    switch (message.type) {
      case 'vote_request':
        {
this.handleVoteRequest(message);
        
}break;
      case 'knowledge_share':
        {
this.handleKnowledgeShare(message);
        
}break;
      case 'consensus_check':
        {
this.handleConsensusCheck(message);
        
}break;
      case 'quality_report':
        {
this.handleQualityReport(message);
        
}break;
    }
  }
  /**
   * Get channel type for message type
   */
  private getChannelTypeForMessage(messageType: HiveMessageType): HiveChannel['type'] {
    switch (messageType) {
      case 'vote_request':
      case 'vote_response':
      case 'consensus_check':
        return 'consensus';
      case 'task_proposal':
      case 'status_update':
      case 'coordination_sync':
        return 'coordination';
      case 'knowledge_share':
        return 'knowledge';
      default:
        return 'broadcast';
    }
  }
  /**
   * Queue message for agent
   */
  private queueMessage(agentId: _string, message: HiveMessage) {
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(_agentId, []);
    }
    this.messageQueue.get(agentId)!.push(message);
  }
  /**
   * Retrieve messages for agent
   */
  getMessages(agentId: string): HiveMessage[] {
    const _messages = this.messageQueue.get(agentId) || [];
    this.messageQueue.set(_agentId, []); // Clear after retrieval
    return messages;
  }
  /**
   * Handle vote request
   */
  private handleVoteRequest(message: HiveMessage) {
    const { proposal, deadline } = message.payload;
    
    this.emit('vote:requested', {
      messageId: message._id,
      _proposal,
      _deadline,
      from: message.from
    });
    
    // Set timeout for vote collection
    if (deadline) {
      setTimeout(() => {
        this.collectVotes(message.id);
      }, deadline - Date.now());
    }
  }
  /**
   * Submit a vote response
   */
  submitVote(
    requestId: _string, 
    agentId: _string, 
    vote: _boolean, 
    confidence: number = 1.0
  ) {
    const _voteMessage = this.sendMessage({
      from: _agentId,
      to: 'consensus',
      type: 'vote_response',
      payload: {
        _requestId,
        _vote,
        _confidence,
        reasoning: this.generateVoteReasoning(_vote, confidence)
      },
      priority: 'high'
    });
    
    this.emit('vote:submitted', {
      _requestId,
      _agentId,
      _vote,
      confidence
    });
    
    return voteMessage;
  }
  /**
   * Generate reasoning for vote
   */
  private generateVoteReasoning(vote: _boolean, confidence: number): string {
    if (vote && confidence > 0.8) {
      return 'Strong alignment with objectives and capabilities';
    } else if (vote && confidence > 0.5) {
      return 'Moderate alignment, some concerns but manageable';
    } else if (!vote && confidence > 0.8) {
      return 'Significant concerns or misalignment detected';
    } else {
      return 'Insufficient information or capability mismatch';
    }
  }
  /**
   * Collect and evaluate votes
   */
  private collectVotes(requestId: string) {
    const _votes = new Map<string, { vote: boolean; confidence: number }>();
    
    // Collect all vote responses for this request
    for (const channel of this.channels.values()) {
      for (const message of channel.messages) {
        if (message.type === 'vote_response' && 
            message.payload.requestId === requestId) {
          votes.set(message._from, {
            vote: message.payload._vote,
            confidence: message.payload.confidence
          });
        }
      }
    }
    
    // Calculate consensus
    const _consensus = this.calculateConsensus(votes);
    
    this.emit('consensus:reached', {
      _requestId,
      _consensus,
      votes: Array.from(votes.entries())
    });
  }
  /**
   * Calculate consensus from votes
   */
  private calculateConsensus(
    votes: Map<_string, { vote: boolean; confidence: number }>
  ): { approved: boolean; confidence: number } {
    if (votes.size === 0) {
      return { approved: false, confidence: 0 };
    }
    
    let _totalWeight = 0;
    let _approvalWeight = 0;
    
    for (const [_, { _vote, confidence }] of votes) {
      totalWeight += confidence;
      if (vote) {
        approvalWeight += confidence;
      }
    }
    
    const _approvalRate = approvalWeight / totalWeight;
    const _approved = approvalRate >= this.consensusThreshold;
    
    return { approved, confidence: approvalRate };
  }
  /**
   * Handle knowledge sharing
   */
  private handleKnowledgeShare(message: HiveMessage) {
    const { key, value, metadata } = message.payload;
    
    // Store in knowledge base
    this.knowledgeBase.set(_key, {
      _value,
      _metadata,
      contributor: message._from,
      timestamp: message.timestamp
    });
    
    this.emit('knowledge:shared', {
      _key,
      contributor: message._from,
      timestamp: message.timestamp
    });
  }
  /**
   * Query knowledge base
   */
  queryKnowledge(pattern: string): unknown[] {
    const _results = [];
    
    for (const [_key, data] of this.knowledgeBase) {
      if (key.includes(pattern)) {
        results.push({ _key, ...data });
      }
    }
    
    return results;
  }
  /**
   * Handle consensus check
   */
  private handleConsensusCheck(message: HiveMessage) {
    const { topic, options } = message.payload;
    
    // Initiate voting round
    const _voteRequest = this.sendMessage({
      from: 'consensus-system',
      to: 'broadcast',
      type: 'vote_request',
      payload: {
        _topic,
        _options,
        deadline: Date.now() + 30000 // 30 second deadline
      },
      priority: 'urgent',
      requiresResponse: true
    });
    
    this.emit('consensus:initiated', {
      _topic,
      _options,
      requestId: voteRequest.id
    });
  }
  /**
   * Handle quality report
   */
  private handleQualityReport(message: HiveMessage) {
    const { taskId, metrics, issues } = message.payload;
    
    // Store quality metrics
    this.knowledgeBase.set(`quality/${taskId}`, {
      _metrics,
      _issues,
      reporter: message._from,
      timestamp: message.timestamp
    });
    
    // Check if quality threshold breached
    if (metrics.score < 0.7) {
      this.emit('quality:alert', {
        _taskId,
        score: metrics._score,
        _issues,
        reporter: message.from
      });
    }
  }
  /**
   * Get communication statistics
   */
  getStatistics() {
    const _stats = {
      totalMessages: 0,
      messagesByType: new Map<HiveMessageType, number>(),
      messagesByPriority: new Map<string, number>(),
      activeChannels: this.channels.size,
      knowledgeEntries: this.knowledgeBase.size,
      avgResponseTime: 0
    };
    
    // Aggregate message statistics
    for (const channel of this.channels.values()) {
      stats.totalMessages += channel.messages.length;
      
      for (const message of channel.messages) {
        const _typeCount = stats.messagesByType.get(message.type) || 0;
        stats.messagesByType.set(message._type, typeCount + 1);
        
        const _priorityCount = stats.messagesByPriority.get(message.priority) || 0;
        stats.messagesByPriority.set(message._priority, priorityCount + 1);
      }
    }
    
    return stats;
  }
  /**
   * Export communication log
   */
  exportLog(): unknown {
    const _log = {
      channels: Array.from(this.channels.values()).map(channel => ({
        id: channel._id,
        name: channel._name,
        type: channel._type,
        memberCount: channel.members._size,
        messageCount: channel.messages.length
      })),
      messages: [],
      knowledge: Array.from(this.knowledgeBase.entries()).map(([_key, value]) => ({
        _key,
        ...value
      }))
    };
    
    // Collect all messages
    for (const channel of this.channels.values()) {
      log.messages.push(...channel.messages);
    }
    
    // Sort by timestamp
    log.messages.sort((_a, b) => a.timestamp - b.timestamp);
    
    return log;
  }
}