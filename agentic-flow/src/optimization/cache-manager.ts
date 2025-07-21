/**
 * Multi-tier Caching System with 90% Hit Rate Target
 * Implements L1/L2/L3 caching with intelligent eviction
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { CompletionResponse } from '../providers/types';
import { logger } from '../utils/logger';

/**
 * Cache configuration
 */
export interface CacheConfig {
  l1Size: number; // Hot cache
  l2Size: number; // Warm cache  
  l3Size: number; // Cold cache
  defaultTTL: number;
  enableCompression: boolean;
  enablePredictiveWarming: boolean;
  enableDistributed: boolean;
}

/**
 * Cache entry with rich metadata
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number;
  compressedSize?: number;
  hitCount: number;
  lastAccess: number;
  createdAt: number;
  expiresAt: number;
  cost: number; // Cost saved by this cache entry
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  avgHitLatency: number;
  avgMissLatency: number;
  totalCostSaved: number;
  memoryUsage: {
    l1: number;
    l2: number;
    l3: number;
    total: number;
  };
}

/**
 * Eviction policy
 */
export enum EvictionPolicy {
  LRU = 'lru',
  LFU = 'lfu',
  COST_AWARE = 'cost_aware',
  ADAPTIVE = 'adaptive'
}

/**
 * Advanced multi-tier cache manager
 */
export class CacheManager extends EventEmitter {
  private config: CacheConfig;
  
  // Three-tier cache structure
  private l1Cache: Map<string, CacheEntry> = new Map(); // Hot - most frequently accessed
  private l2Cache: Map<string, CacheEntry> = new Map(); // Warm - moderately accessed
  private l3Cache: Map<string, CacheEntry> = new Map(); // Cold - least accessed
  
  // Cache indices for fast lookup
  private tagIndex: Map<string, Set<string>> = new Map();
  private expirationIndex: Map<number, Set<string>> = new Map();
  
  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    hitRate: 0,
    avgHitLatency: 0,
    avgMissLatency: 0,
    totalCostSaved: 0,
    memoryUsage: {
      l1: 0,
      l2: 0,
      l3: 0,
      total: 0
    }
  };
  
  // Performance tracking
  private hitLatencies: number[] = [];
  private missLatencies: number[] = [];
  
  // Predictive warming
  private accessPatterns: Map<string, number[]> = new Map();
  private warmingQueue: Set<string> = new Set();

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      l1Size: 1000,    // 1K entries in L1
      l2Size: 5000,    // 5K entries in L2
      l3Size: 20000,   // 20K entries in L3
      defaultTTL: 3600000, // 1 hour
      enableCompression: true,
      enablePredictiveWarming: true,
      enableDistributed: false,
      ...config
    };
    
    // Start background tasks
    this.startMaintenanceTasks();
    
    if (this.config.enablePredictiveWarming) {
      this.startPredictiveWarming();
    }
  }

  /**
   * Get value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    // Check L1 first
    let entry = this.l1Cache.get(key);
    if (entry && this.isValid(entry)) {
      this.recordHit(entry, Date.now() - startTime, 'l1');
      return entry.value as T;
    }
    
    // Check L2
    entry = this.l2Cache.get(key);
    if (entry && this.isValid(entry)) {
      this.recordHit(entry, Date.now() - startTime, 'l2');
      this.promoteToL1(key, entry);
      return entry.value as T;
    }
    
    // Check L3
    entry = this.l3Cache.get(key);
    if (entry && this.isValid(entry)) {
      this.recordHit(entry, Date.now() - startTime, 'l3');
      this.promoteToL2(key, entry);
      return entry.value as T;
    }
    
    // Cache miss
    this.recordMiss(Date.now() - startTime);
    return null;
  }

  /**
   * Set value in cache
   */
  public async set<T = any>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      cost?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const size = this.estimateSize(value);
    const compressedSize = this.config.enableCompression 
      ? await this.compress(value) 
      : size;
    
    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      compressedSize,
      hitCount: 0,
      lastAccess: Date.now(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (options.ttl || this.config.defaultTTL),
      cost: options.cost || 0,
      tags: options.tags || [],
      metadata: options.metadata || {}
    };
    
    // Add to L1 (hot cache)
    this.l1Cache.set(key, entry);
    this.updateMemoryUsage();
    
    // Update indices
    this.updateIndices(entry);
    
    // Evict if necessary
    await this.evictIfNeeded();
    
    // Track access pattern
    this.trackAccessPattern(key);
    
    this.emit('cache:set', { key, tier: 'l1' });
  }

  /**
   * Delete from cache
   */
  public async delete(key: string): Promise<boolean> {
    let deleted = false;
    
    if (this.l1Cache.delete(key)) deleted = true;
    if (this.l2Cache.delete(key)) deleted = true;
    if (this.l3Cache.delete(key)) deleted = true;
    
    if (deleted) {
      this.removeFromIndices(key);
      this.updateMemoryUsage();
      this.emit('cache:delete', { key });
    }
    
    return deleted;
  }

  /**
   * Clear all caches
   */
  public async clear(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.l3Cache.clear();
    this.tagIndex.clear();
    this.expirationIndex.clear();
    this.resetStats();
    this.updateMemoryUsage();
    this.emit('cache:clear');
  }

  /**
   * Get entries by tag
   */
  public async getByTag(tag: string): Promise<CacheEntry[]> {
    const keys = this.tagIndex.get(tag) || new Set();
    const entries: CacheEntry[] = [];
    
    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        entries.push(entry as any);
      }
    }
    
    return entries;
  }

  /**
   * Invalidate entries by tag
   */
  public async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag) || new Set();
    let count = 0;
    
    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Warm cache with predicted entries
   */
  public async warmCache(predictions: { key: string; value: any }[]): Promise<void> {
    for (const { key, value } of predictions) {
      await this.set(key, value, { 
        metadata: { warmed: true, warmTime: Date.now() }
      });
    }
  }

  /**
   * Check if entry is valid (not expired)
   */
  private isValid(entry: CacheEntry): boolean {
    return entry.expiresAt > Date.now();
  }

  /**
   * Record cache hit
   */
  private recordHit(entry: CacheEntry, latency: number, tier: string): void {
    entry.hitCount++;
    entry.lastAccess = Date.now();
    
    this.stats.hits++;
    this.hitLatencies.push(latency);
    if (this.hitLatencies.length > 1000) {
      this.hitLatencies.shift();
    }
    
    // Update cost saved
    if (entry.cost > 0) {
      this.stats.totalCostSaved += entry.cost;
    }
    
    this.updateHitRate();
    this.emit('cache:hit', { key: entry.key, tier, latency });
  }

  /**
   * Record cache miss
   */
  private recordMiss(latency: number): void {
    this.stats.misses++;
    this.missLatencies.push(latency);
    if (this.missLatencies.length > 1000) {
      this.missLatencies.shift();
    }
    
    this.updateHitRate();
    this.emit('cache:miss', { latency });
  }

  /**
   * Update hit rate and latency stats
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    
    // Update average latencies
    if (this.hitLatencies.length > 0) {
      this.stats.avgHitLatency = 
        this.hitLatencies.reduce((a, b) => a + b, 0) / this.hitLatencies.length;
    }
    
    if (this.missLatencies.length > 0) {
      this.stats.avgMissLatency = 
        this.missLatencies.reduce((a, b) => a + b, 0) / this.missLatencies.length;
    }
  }

  /**
   * Promote entry from L2 to L1
   */
  private promoteToL1(key: string, entry: CacheEntry): void {
    this.l2Cache.delete(key);
    this.l1Cache.set(key, entry);
    this.emit('cache:promote', { key, from: 'l2', to: 'l1' });
  }

  /**
   * Promote entry from L3 to L2
   */
  private promoteToL2(key: string, entry: CacheEntry): void {
    this.l3Cache.delete(key);
    this.l2Cache.set(key, entry);
    this.emit('cache:promote', { key, from: 'l3', to: 'l2' });
  }

  /**
   * Demote entry from L1 to L2
   */
  private demoteToL2(key: string, entry: CacheEntry): void {
    this.l1Cache.delete(key);
    this.l2Cache.set(key, entry);
    this.emit('cache:demote', { key, from: 'l1', to: 'l2' });
  }

  /**
   * Demote entry from L2 to L3
   */
  private demoteToL3(key: string, entry: CacheEntry): void {
    this.l2Cache.delete(key);
    this.l3Cache.set(key, entry);
    this.emit('cache:demote', { key, from: 'l2', to: 'l3' });
  }

  /**
   * Evict entries if cache is full
   */
  private async evictIfNeeded(): Promise<void> {
    // Evict from L1 if needed
    if (this.l1Cache.size > this.config.l1Size) {
      await this.evictFromL1();
    }
    
    // Evict from L2 if needed
    if (this.l2Cache.size > this.config.l2Size) {
      await this.evictFromL2();
    }
    
    // Evict from L3 if needed
    if (this.l3Cache.size > this.config.l3Size) {
      await this.evictFromL3();
    }
  }

  /**
   * Evict from L1 using cost-aware LRU
   */
  private async evictFromL1(): Promise<void> {
    const entries = Array.from(this.l1Cache.entries())
      .map(([key, entry]) => ({ key, entry, score: this.calculateEvictionScore(entry) }))
      .sort((a, b) => a.score - b.score);
    
    const toEvict = Math.floor(this.config.l1Size * 0.1); // Evict 10%
    
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const { key, entry } = entries[i];
      this.demoteToL2(key, entry);
      this.stats.evictions++;
    }
  }

  /**
   * Evict from L2
   */
  private async evictFromL2(): Promise<void> {
    const entries = Array.from(this.l2Cache.entries())
      .map(([key, entry]) => ({ key, entry, score: this.calculateEvictionScore(entry) }))
      .sort((a, b) => a.score - b.score);
    
    const toEvict = Math.floor(this.config.l2Size * 0.1);
    
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const { key, entry } = entries[i];
      this.demoteToL3(key, entry);
      this.stats.evictions++;
    }
  }

  /**
   * Evict from L3
   */
  private async evictFromL3(): Promise<void> {
    const entries = Array.from(this.l3Cache.entries())
      .map(([key, entry]) => ({ key, entry, score: this.calculateEvictionScore(entry) }))
      .sort((a, b) => a.score - b.score);
    
    const toEvict = Math.floor(this.config.l3Size * 0.1);
    
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const { key } = entries[i];
      this.l3Cache.delete(key);
      this.removeFromIndices(key);
      this.stats.evictions++;
    }
  }

  /**
   * Calculate eviction score (higher = keep longer)
   */
  private calculateEvictionScore(entry: CacheEntry): number {
    const age = Date.now() - entry.createdAt;
    const recency = Date.now() - entry.lastAccess;
    const frequency = entry.hitCount;
    const costValue = entry.cost;
    
    // Cost-aware scoring: prioritize high-cost entries
    const costWeight = 10;
    const frequencyWeight = 5;
    const recencyWeight = 2;
    
    return (costValue * costWeight) + 
           (frequency * frequencyWeight) - 
           (recency / 1000 * recencyWeight) - 
           (age / 10000);
  }

  /**
   * Update cache indices
   */
  private updateIndices(entry: CacheEntry): void {
    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(entry.key);
    }
    
    // Update expiration index
    const expirationBucket = Math.floor(entry.expiresAt / 60000); // 1-minute buckets
    if (!this.expirationIndex.has(expirationBucket)) {
      this.expirationIndex.set(expirationBucket, new Set());
    }
    this.expirationIndex.get(expirationBucket)!.add(entry.key);
  }

  /**
   * Remove from indices
   */
  private removeFromIndices(key: string): void {
    // Remove from tag index
    for (const [tag, keys] of this.tagIndex) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    }
    
    // Remove from expiration index
    for (const [bucket, keys] of this.expirationIndex) {
      keys.delete(key);
      if (keys.size === 0) {
        this.expirationIndex.delete(bucket);
      }
    }
  }

  /**
   * Start background maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanupExpired();
    }, 60000);
    
    // Update memory usage every 5 seconds
    setInterval(() => {
      this.updateMemoryUsage();
    }, 5000);
    
    // Rebalance caches every 5 minutes
    setInterval(() => {
      this.rebalanceCaches();
    }, 300000);
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    
    // Check all caches
    for (const cache of [this.l1Cache, this.l2Cache, this.l3Cache]) {
      for (const [key, entry] of cache) {
        if (!this.isValid(entry)) {
          cache.delete(key);
          this.removeFromIndices(key);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
      this.updateMemoryUsage();
    }
  }

  /**
   * Rebalance cache tiers based on access patterns
   */
  private rebalanceCaches(): void {
    // Move frequently accessed L2 entries to L1
    const l2Entries = Array.from(this.l2Cache.entries())
      .map(([key, entry]) => ({ key, entry, score: entry.hitCount / (Date.now() - entry.createdAt) }))
      .sort((a, b) => b.score - a.score);
    
    const promoteCount = Math.min(10, l2Entries.length);
    for (let i = 0; i < promoteCount; i++) {
      const { key, entry } = l2Entries[i];
      if (entry.hitCount > 5) {
        this.promoteToL1(key, entry);
      }
    }
    
    // Similar for L3 to L2
    const l3Entries = Array.from(this.l3Cache.entries())
      .map(([key, entry]) => ({ key, entry, score: entry.hitCount / (Date.now() - entry.createdAt) }))
      .sort((a, b) => b.score - a.score);
    
    const promoteFromL3 = Math.min(20, l3Entries.length);
    for (let i = 0; i < promoteFromL3; i++) {
      const { key, entry } = l3Entries[i];
      if (entry.hitCount > 3) {
        this.promoteToL2(key, entry);
      }
    }
  }

  /**
   * Track access patterns for predictive warming
   */
  private trackAccessPattern(key: string): void {
    if (!this.config.enablePredictiveWarming) return;
    
    const hour = new Date().getHours();
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, new Array(24).fill(0));
    }
    
    const pattern = this.accessPatterns.get(key)!;
    pattern[hour]++;
  }

  /**
   * Start predictive cache warming
   */
  private startPredictiveWarming(): void {
    // Analyze patterns every 30 minutes
    setInterval(() => {
      this.analyzePatternsAndWarm();
    }, 1800000);
  }

  /**
   * Analyze patterns and warm cache
   */
  private async analyzePatternsAndWarm(): Promise<void> {
    const currentHour = new Date().getHours();
    const nextHour = (currentHour + 1) % 24;
    
    // Find keys likely to be accessed in the next hour
    const predictions: string[] = [];
    
    for (const [key, pattern] of this.accessPatterns) {
      const nextHourAccesses = pattern[nextHour];
      const totalAccesses = pattern.reduce((a, b) => a + b, 0);
      
      // If >20% of accesses happen in next hour, warm it
      if (totalAccesses > 10 && nextHourAccesses / totalAccesses > 0.2) {
        predictions.push(key);
      }
    }
    
    // Warm predicted keys
    for (const key of predictions.slice(0, 100)) { // Limit to 100 keys
      this.warmingQueue.add(key);
    }
    
    logger.info(`Predictive warming: ${predictions.length} keys identified`);
  }

  /**
   * Estimate size of value
   */
  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per char
    }
    return JSON.stringify(value).length * 2;
  }

  /**
   * Compress value (placeholder)
   */
  private async compress(value: any): Promise<number> {
    // Actual compression would be implemented here
    return this.estimateSize(value) * 0.7; // Assume 30% compression
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryUsage(): void {
    this.stats.memoryUsage.l1 = this.calculateCacheSize(this.l1Cache);
    this.stats.memoryUsage.l2 = this.calculateCacheSize(this.l2Cache);
    this.stats.memoryUsage.l3 = this.calculateCacheSize(this.l3Cache);
    this.stats.memoryUsage.total = 
      this.stats.memoryUsage.l1 + 
      this.stats.memoryUsage.l2 + 
      this.stats.memoryUsage.l3;
  }

  /**
   * Calculate cache size in bytes
   */
  private calculateCacheSize(cache: Map<string, CacheEntry>): number {
    let size = 0;
    for (const entry of cache.values()) {
      size += entry.compressedSize || entry.size;
    }
    return size;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      avgHitLatency: 0,
      avgMissLatency: 0,
      totalCostSaved: 0,
      memoryUsage: {
        l1: 0,
        l2: 0,
        l3: 0,
        total: 0
      }
    };
    this.hitLatencies = [];
    this.missLatencies = [];
  }

  /**
   * Get current statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache sizes
   */
  public getCacheSizes(): { l1: number; l2: number; l3: number } {
    return {
      l1: this.l1Cache.size,
      l2: this.l2Cache.size,
      l3: this.l3Cache.size
    };
  }

  /**
   * Export cache for persistence
   */
  public async export(): Promise<any> {
    return {
      l1: Array.from(this.l1Cache.entries()),
      l2: Array.from(this.l2Cache.entries()),
      l3: Array.from(this.l3Cache.entries()),
      stats: this.stats,
      patterns: Array.from(this.accessPatterns.entries())
    };
  }

  /**
   * Import cache from persistence
   */
  public async import(data: any): Promise<void> {
    this.clear();
    
    // Restore caches
    for (const [key, entry] of data.l1 || []) {
      this.l1Cache.set(key, entry);
    }
    for (const [key, entry] of data.l2 || []) {
      this.l2Cache.set(key, entry);
    }
    for (const [key, entry] of data.l3 || []) {
      this.l3Cache.set(key, entry);
    }
    
    // Restore stats
    if (data.stats) {
      this.stats = data.stats;
    }
    
    // Restore patterns
    if (data.patterns) {
      this.accessPatterns = new Map(data.patterns);
    }
    
    // Rebuild indices
    for (const cache of [this.l1Cache, this.l2Cache, this.l3Cache]) {
      for (const entry of cache.values()) {
        this.updateIndices(entry);
      }
    }
    
    this.updateMemoryUsage();
  }
}

/**
 * Factory function to create cache manager
 */
export function createCacheManager(config?: Partial<CacheConfig>): CacheManager {
  return new CacheManager(config);
}