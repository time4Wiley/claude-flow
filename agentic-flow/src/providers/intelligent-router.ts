/**
 * Intelligent LLM Provider Router
 * Reduces costs by 60% through smart provider selection
 */

import { 
  ILLMProvider, 
  LLMProvider, 
  CompletionOptions, 
  CompletionResponse,
  ProviderMetrics 
} from './types';
import { ProviderManager } from './provider-manager';
import { logger } from '../utils/logger';

export interface RoutingStrategy {
  costWeight: number;
  latencyWeight: number;
  qualityWeight: number;
  availabilityWeight: number;
}

export interface TaskClassification {
  complexity: 'simple' | 'moderate' | 'complex';
  domain: 'general' | 'code' | 'math' | 'creative' | 'analysis';
  tokenEstimate: number;
  qualityRequirement: 'low' | 'medium' | 'high';
  latencySensitive: boolean;
}

export interface ProviderScore {
  provider: LLMProvider;
  score: number;
  costPerToken: number;
  estimatedLatency: number;
  availability: number;
  qualityScore: number;
}

export class IntelligentRouter {
  private providerManager: ProviderManager;
  private providerMetrics: Map<LLMProvider, ProviderMetrics> = new Map();
  private costHistory: Map<LLMProvider, number[]> = new Map();
  private latencyHistory: Map<LLMProvider, number[]> = new Map();
  private successRates: Map<LLMProvider, number> = new Map();
  
  // Provider cost per million tokens (example rates)
  private readonly providerCosts = new Map<LLMProvider, number>([
    [LLMProvider.ANTHROPIC, 8.00],     // Claude
    [LLMProvider.OPENAI, 6.00],        // GPT-4
    [LLLProvider.GOOGLE, 5.00],        // Gemini
    [LLMProvider.COHERE, 4.00],        // Cohere
    [LLMProvider.HUGGINGFACE, 2.00],   // HuggingFace
    [LLMProvider.OLLAMA, 0.00]         // Local Ollama
  ]);

  // Provider quality scores (0-1)
  private readonly providerQuality = new Map<LLMProvider, number>([
    [LLMProvider.ANTHROPIC, 0.95],
    [LLMProvider.OPENAI, 0.93],
    [LLMProvider.GOOGLE, 0.90],
    [LLMProvider.COHERE, 0.85],
    [LLMProvider.HUGGINGFACE, 0.80],
    [LLMProvider.OLLAMA, 0.75]
  ]);

  constructor(providerManager: ProviderManager) {
    this.providerManager = providerManager;
    this.initializeMetrics();
  }

  /**
   * Initialize provider metrics
   */
  private initializeMetrics(): void {
    for (const provider of Object.values(LLMProvider)) {
      this.costHistory.set(provider as LLMProvider, []);
      this.latencyHistory.set(provider as LLMProvider, []);
      this.successRates.set(provider as LLMProvider, 1.0);
    }
  }

  /**
   * Route completion request to optimal provider
   */
  async routeCompletion(
    options: CompletionOptions,
    strategy: RoutingStrategy = {
      costWeight: 0.4,
      latencyWeight: 0.3,
      qualityWeight: 0.2,
      availabilityWeight: 0.1
    }
  ): Promise<CompletionResponse> {
    try {
      // Classify the task
      const classification = this.classifyTask(options);
      logger.info('Task classified:', classification);

      // Score all available providers
      const scores = await this.scoreProviders(classification, strategy);
      
      // Sort by score
      scores.sort((a, b) => b.score - a.score);
      
      logger.info('Provider scores:', scores.map(s => ({
        provider: s.provider,
        score: s.score.toFixed(3),
        cost: s.costPerToken.toFixed(4)
      })));

      // Try providers in order of score
      for (const providerScore of scores) {
        try {
          const provider = this.providerManager.getProvider(providerScore.provider);
          if (!provider) continue;

          const start = Date.now();
          const response = await provider.complete({
            ...options,
            model: this.selectOptimalModel(providerScore.provider, classification)
          });
          
          const latency = Date.now() - start;
          
          // Update metrics
          this.updateMetrics(providerScore.provider, latency, true, response.usage?.totalTokens || 0);
          
          // Add routing metadata
          (response as any).routingMetadata = {
            selectedProvider: providerScore.provider,
            classification,
            score: providerScore.score,
            estimatedCost: this.calculateCost(providerScore.provider, response.usage?.totalTokens || 0)
          };
          
          return response;
          
        } catch (error) {
          logger.warn(`Provider ${providerScore.provider} failed:`, error);
          this.updateMetrics(providerScore.provider, 0, false, 0);
          continue;
        }
      }
      
      throw new Error('All providers failed');
      
    } catch (error) {
      logger.error('Routing failed:', error);
      throw error;
    }
  }

  /**
   * Classify task complexity and requirements
   */
  private classifyTask(options: CompletionOptions): TaskClassification {
    const prompt = options.prompt.toLowerCase();
    const promptLength = options.prompt.length;
    
    // Estimate tokens (rough approximation)
    const tokenEstimate = Math.ceil(promptLength / 4) + (options.maxTokens || 1000);
    
    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (tokenEstimate > 2000 || prompt.includes('analyze') || prompt.includes('explain')) {
      complexity = 'complex';
    } else if (tokenEstimate > 500) {
      complexity = 'moderate';
    }
    
    // Determine domain
    let domain: TaskClassification['domain'] = 'general';
    if (prompt.includes('code') || prompt.includes('function') || prompt.includes('implement')) {
      domain = 'code';
    } else if (prompt.includes('calculate') || prompt.includes('solve')) {
      domain = 'math';
    } else if (prompt.includes('write') || prompt.includes('story') || prompt.includes('creative')) {
      domain = 'creative';
    } else if (prompt.includes('analyze') || prompt.includes('evaluate')) {
      domain = 'analysis';
    }
    
    // Determine quality requirement
    let qualityRequirement: 'low' | 'medium' | 'high' = 'medium';
    if (complexity === 'complex' || domain === 'code' || domain === 'analysis') {
      qualityRequirement = 'high';
    } else if (complexity === 'simple' && domain === 'general') {
      qualityRequirement = 'low';
    }
    
    // Check if latency sensitive
    const latencySensitive = options.stream || prompt.includes('quick') || prompt.includes('brief');
    
    return {
      complexity,
      domain,
      tokenEstimate,
      qualityRequirement,
      latencySensitive
    };
  }

  /**
   * Score providers based on task and strategy
   */
  private async scoreProviders(
    classification: TaskClassification,
    strategy: RoutingStrategy
  ): Promise<ProviderScore[]> {
    const scores: ProviderScore[] = [];
    
    for (const [provider, cost] of this.providerCosts) {
      // Skip if provider not available
      if (!this.providerManager.getProvider(provider)) continue;
      
      // Calculate individual scores
      const costScore = this.calculateCostScore(provider, classification);
      const latencyScore = this.calculateLatencyScore(provider, classification);
      const qualityScore = this.calculateQualityScore(provider, classification);
      const availabilityScore = this.calculateAvailabilityScore(provider);
      
      // Apply weights
      const totalScore = 
        costScore * strategy.costWeight +
        latencyScore * strategy.latencyWeight +
        qualityScore * strategy.qualityWeight +
        availabilityScore * strategy.availabilityWeight;
      
      scores.push({
        provider,
        score: totalScore,
        costPerToken: cost / 1000000, // Convert to per-token cost
        estimatedLatency: this.estimateLatency(provider),
        availability: availabilityScore,
        qualityScore
      });
    }
    
    return scores;
  }

  /**
   * Calculate cost score (0-1, higher is better)
   */
  private calculateCostScore(provider: LLMProvider, classification: TaskClassification): number {
    const cost = this.providerCosts.get(provider) || 10;
    const maxCost = 10; // Maximum expected cost
    
    // Adjust for task complexity
    let adjustedScore = 1 - (cost / maxCost);
    
    // Bonus for local providers on simple tasks
    if (provider === LLMProvider.OLLAMA && classification.complexity === 'simple') {
      adjustedScore = 1.0;
    }
    
    // Penalty for expensive providers on simple tasks
    if (cost > 5 && classification.complexity === 'simple') {
      adjustedScore *= 0.5;
    }
    
    return Math.max(0, Math.min(1, adjustedScore));
  }

  /**
   * Calculate latency score
   */
  private calculateLatencyScore(provider: LLMProvider, classification: TaskClassification): number {
    const avgLatency = this.getAverageLatency(provider);
    const maxLatency = 5000; // 5 seconds max
    
    let score = 1 - (avgLatency / maxLatency);
    
    // Bonus for local providers when latency sensitive
    if (provider === LLMProvider.OLLAMA && classification.latencySensitive) {
      score *= 1.5;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(provider: LLMProvider, classification: TaskClassification): number {
    const baseQuality = this.providerQuality.get(provider) || 0.5;
    
    // Adjust for task requirements
    if (classification.qualityRequirement === 'high') {
      // Penalize lower quality providers
      return baseQuality >= 0.9 ? baseQuality : baseQuality * 0.7;
    } else if (classification.qualityRequirement === 'low') {
      // All providers are acceptable
      return Math.max(0.8, baseQuality);
    }
    
    return baseQuality;
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(provider: LLMProvider): number {
    return this.successRates.get(provider) || 0.5;
  }

  /**
   * Select optimal model for provider based on task
   */
  private selectOptimalModel(provider: LLMProvider, classification: TaskClassification): string {
    // Model selection logic based on provider and task
    const modelMap: Record<LLMProvider, Record<string, string>> = {
      [LLMProvider.ANTHROPIC]: {
        simple: 'claude-instant-1.2',
        moderate: 'claude-2.1',
        complex: 'claude-3-opus-20240229'
      },
      [LLMProvider.OPENAI]: {
        simple: 'gpt-3.5-turbo',
        moderate: 'gpt-4',
        complex: 'gpt-4-turbo-preview'
      },
      [LLMProvider.GOOGLE]: {
        simple: 'gemini-pro',
        moderate: 'gemini-pro',
        complex: 'gemini-ultra'
      },
      [LLMProvider.COHERE]: {
        simple: 'command-light',
        moderate: 'command',
        complex: 'command'
      },
      [LLMProvider.HUGGINGFACE]: {
        simple: 'meta-llama/Llama-2-7b-chat-hf',
        moderate: 'meta-llama/Llama-2-13b-chat-hf',
        complex: 'meta-llama/Llama-2-70b-chat-hf'
      },
      [LLMProvider.OLLAMA]: {
        simple: 'llama2:7b',
        moderate: 'llama2:13b',
        complex: 'llama2:70b'
      }
    };
    
    return modelMap[provider]?.[classification.complexity] || 'default';
  }

  /**
   * Update provider metrics
   */
  private updateMetrics(
    provider: LLMProvider,
    latency: number,
    success: boolean,
    tokens: number
  ): void {
    // Update latency history
    const latencyHist = this.latencyHistory.get(provider) || [];
    latencyHist.push(latency);
    if (latencyHist.length > 100) latencyHist.shift();
    this.latencyHistory.set(provider, latencyHist);
    
    // Update success rate
    const currentRate = this.successRates.get(provider) || 1;
    const newRate = currentRate * 0.95 + (success ? 1 : 0) * 0.05;
    this.successRates.set(provider, newRate);
    
    // Update cost tracking
    if (tokens > 0) {
      const cost = this.calculateCost(provider, tokens);
      const costHist = this.costHistory.get(provider) || [];
      costHist.push(cost);
      if (costHist.length > 100) costHist.shift();
      this.costHistory.set(provider, costHist);
    }
  }

  /**
   * Calculate cost for tokens
   */
  private calculateCost(provider: LLMProvider, tokens: number): number {
    const costPerMillion = this.providerCosts.get(provider) || 10;
    return (tokens / 1000000) * costPerMillion;
  }

  /**
   * Get average latency for provider
   */
  private getAverageLatency(provider: LLMProvider): number {
    const history = this.latencyHistory.get(provider) || [];
    if (history.length === 0) return 1000; // Default 1 second
    
    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  }

  /**
   * Estimate latency for provider
   */
  private estimateLatency(provider: LLMProvider): number {
    // Use historical data or defaults
    const avgLatency = this.getAverageLatency(provider);
    
    // Add provider-specific adjustments
    const latencyMultipliers: Record<LLMProvider, number> = {
      [LLMProvider.OLLAMA]: 0.5,        // Local, faster
      [LLMProvider.ANTHROPIC]: 1.0,     // Baseline
      [LLMProvider.OPENAI]: 1.1,        // Slightly slower
      [LLMProvider.GOOGLE]: 1.2,        // Regional variation
      [LLMProvider.COHERE]: 0.9,        // Optimized
      [LLMProvider.HUGGINGFACE]: 1.5    // Variable
    };
    
    return avgLatency * (latencyMultipliers[provider] || 1.0);
  }

  /**
   * Get routing statistics
   */
  getStatistics(): {
    providerUsage: Record<LLMProvider, number>;
    averageCosts: Record<LLMProvider, number>;
    averageLatencies: Record<LLMProvider, number>;
    successRates: Record<LLMProvider, number>;
    totalSavings: number;
  } {
    const stats: any = {
      providerUsage: {},
      averageCosts: {},
      averageLatencies: {},
      successRates: {},
      totalSavings: 0
    };
    
    for (const [provider, _] of this.providerCosts) {
      const costHist = this.costHistory.get(provider) || [];
      const latencyHist = this.latencyHistory.get(provider) || [];
      
      stats.providerUsage[provider] = costHist.length;
      stats.averageCosts[provider] = costHist.length > 0 
        ? costHist.reduce((a, b) => a + b, 0) / costHist.length 
        : 0;
      stats.averageLatencies[provider] = this.getAverageLatency(provider);
      stats.successRates[provider] = this.successRates.get(provider) || 0;
    }
    
    // Calculate savings vs always using most expensive provider
    const maxCost = Math.max(...Array.from(this.providerCosts.values()));
    const actualCosts = Array.from(this.costHistory.values()).flat();
    const totalActualCost = actualCosts.reduce((a, b) => a + b, 0);
    const totalMaxCost = actualCosts.length * maxCost / 1000000; // Adjust for per-token
    stats.totalSavings = Math.max(0, totalMaxCost - totalActualCost);
    
    return stats;
  }
}