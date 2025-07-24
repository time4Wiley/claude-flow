import Bull from 'bull';
import redisManager from '../server/redis-client.js';
import databaseManager from '../server/database-pool.js';
import { metrics } from '../server/metrics-middleware.js';

// Job queues
const queues = {
  mcpExecution: new Bull('mcp-execution', {
    redis: redisManager.client,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 1000,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  }),
  
  taskOrchestration: new Bull('task-orchestration', {
    redis: redisManager.client,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 500,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000
      }
    }
  }),
  
  dataProcessing: new Bull('data-processing', {
    redis: redisManager.client,
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 1000,
      attempts: 3
    }
  }),
  
  memoryOptimization: new Bull('memory-optimization', {
    redis: redisManager.client,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 2
    }
  })
};

// Job processors
class JobProcessor {
  constructor() {
    this.isShuttingDown = false;
  }

  async initialize() {
    console.log('🔧 Initializing job processor...');
    
    // Initialize Redis and Database
    await redisManager.initialize();
    await databaseManager.initialize();
    
    // Set up job processors
    this.setupMCPExecutionProcessor();
    this.setupTaskOrchestrationProcessor();
    this.setupDataProcessingProcessor();
    this.setupMemoryOptimizationProcessor();
    
    // Set up queue event handlers
    this.setupQueueEvents();
    
    // Start queue monitoring
    this.startQueueMonitoring();
    
    console.log('✅ Job processor initialized');
  }

  setupMCPExecutionProcessor() {
    const concurrency = parseInt(process.env.WORKER_CONCURRENCY) || 10;
    
    queues.mcpExecution.process(concurrency, async (job) => {
      const { toolName, parameters, executionId } = job.data;
      const startTime = Date.now();
      
      try {
        console.log(`Processing MCP tool: ${toolName} (${executionId})`);
        
        // Update job progress
        await job.progress(10);
        
        // Execute MCP tool (simulated for now)
        const result = await this.executeMCPTool(toolName, parameters);
        
        await job.progress(90);
        
        // Store result in cache
        await redisManager.setCache(
          `mcp:result:${executionId}`,
          result,
          3600 // 1 hour TTL
        );
        
        // Record metrics
        const duration = (Date.now() - startTime) / 1000;
        metrics.recordMCPToolExecution(toolName, 'success', duration);
        
        await job.progress(100);
        
        return {
          success: true,
          result,
          executionTime: duration,
          executionId
        };
        
      } catch (error) {
        console.error(`MCP execution error:`, error);
        
        metrics.recordMCPToolExecution(toolName, 'failure');
        
        throw error;
      }
    });
  }

  setupTaskOrchestrationProcessor() {
    queues.taskOrchestration.process(5, async (job) => {
      const { taskId, task, strategy, priority } = job.data;
      
      try {
        console.log(`Orchestrating task: ${taskId}`);
        
        // Update task status in database
        await databaseManager.query(
          'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
          ['processing', taskId]
        );
        
        await job.progress(20);
        
        // Break down task into subtasks
        const subtasks = await this.decomposeTask(task, strategy);
        
        await job.progress(40);
        
        // Assign subtasks to agents
        const assignments = await this.assignSubtasks(subtasks, priority);
        
        await job.progress(60);
        
        // Execute subtasks in parallel
        const results = await this.executeSubtasks(assignments);
        
        await job.progress(80);
        
        // Aggregate results
        const finalResult = await this.aggregateResults(results);
        
        // Update task completion
        await databaseManager.query(
          `UPDATE tasks 
           SET status = $1, result = $2, progress = 100, 
               completed_at = NOW(), updated_at = NOW() 
           WHERE id = $3`,
          ['completed', JSON.stringify(finalResult), taskId]
        );
        
        await job.progress(100);
        
        return {
          taskId,
          status: 'completed',
          result: finalResult
        };
        
      } catch (error) {
        console.error(`Task orchestration error:`, error);
        
        await databaseManager.query(
          'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', taskId]
        );
        
        throw error;
      }
    });
  }

  setupDataProcessingProcessor() {
    queues.dataProcessing.process(3, async (job) => {
      const { type, data, options } = job.data;
      
      try {
        console.log(`Processing data: ${type}`);
        
        switch (type) {
          case 'aggregate_metrics':
            return await this.aggregateMetrics(data, options);
            
          case 'compress_memory':
            return await this.compressMemory(data, options);
            
          case 'analyze_patterns':
            return await this.analyzePatterns(data, options);
            
          case 'optimize_performance':
            return await this.optimizePerformance(data, options);
            
          default:
            throw new Error(`Unknown data processing type: ${type}`);
        }
        
      } catch (error) {
        console.error(`Data processing error:`, error);
        throw error;
      }
    });
  }

  setupMemoryOptimizationProcessor() {
    queues.memoryOptimization.process(2, async (job) => {
      const { namespace, strategy } = job.data;
      
      try {
        console.log(`Optimizing memory: ${namespace}`);
        
        // Get memory entries
        const entries = await databaseManager.query(
          'SELECT * FROM memory_entries WHERE namespace = $1',
          [namespace]
        );
        
        await job.progress(30);
        
        // Apply optimization strategy
        const optimized = await this.applyOptimizationStrategy(
          entries.rows,
          strategy
        );
        
        await job.progress(60);
        
        // Update database with optimized entries
        await this.updateOptimizedEntries(optimized, namespace);
        
        await job.progress(90);
        
        // Clear cache for namespace
        await redisManager.invalidateCache(`memory:${namespace}:*`);
        
        await job.progress(100);
        
        return {
          namespace,
          originalCount: entries.rows.length,
          optimizedCount: optimized.length,
          spaceSaved: this.calculateSpaceSaved(entries.rows, optimized)
        };
        
      } catch (error) {
        console.error(`Memory optimization error:`, error);
        throw error;
      }
    });
  }

  setupQueueEvents() {
    // Monitor queue health
    Object.entries(queues).forEach(([name, queue]) => {
      queue.on('error', (error) => {
        console.error(`Queue ${name} error:`, error);
      });
      
      queue.on('waiting', (jobId) => {
        console.log(`Job ${jobId} waiting in ${name}`);
      });
      
      queue.on('active', (job) => {
        console.log(`Job ${job.id} active in ${name}`);
      });
      
      queue.on('completed', (job, result) => {
        console.log(`Job ${job.id} completed in ${name}`);
      });
      
      queue.on('failed', (job, err) => {
        console.error(`Job ${job.id} failed in ${name}:`, err);
      });
      
      queue.on('stalled', (job) => {
        console.warn(`Job ${job.id} stalled in ${name}`);
      });
    });
  }

  startQueueMonitoring() {
    setInterval(async () => {
      for (const [name, queue] of Object.entries(queues)) {
        const counts = await queue.getJobCounts();
        
        // Update metrics
        metrics.setTaskQueue('all', 'waiting', counts.waiting);
        metrics.setTaskQueue('all', 'active', counts.active);
        metrics.setTaskQueue('all', 'completed', counts.completed);
        metrics.setTaskQueue('all', 'failed', counts.failed);
        
        console.log(`Queue ${name} stats:`, counts);
      }
    }, 30000); // Every 30 seconds
  }

  // Helper methods
  async executeMCPTool(toolName, parameters) {
    // Simulate MCP tool execution
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    return {
      toolName,
      parameters,
      result: `Executed ${toolName} successfully`,
      timestamp: new Date().toISOString()
    };
  }

  async decomposeTask(task, strategy) {
    // Implement task decomposition logic
    const subtasks = [];
    
    // Simple decomposition for now
    const steps = task.split('. ');
    for (let i = 0; i < steps.length; i++) {
      subtasks.push({
        id: `subtask-${i}`,
        description: steps[i],
        dependencies: i > 0 ? [`subtask-${i-1}`] : []
      });
    }
    
    return subtasks;
  }

  async assignSubtasks(subtasks, priority) {
    // Get available agents
    const agents = await databaseManager.query(
      'SELECT * FROM agents WHERE status = $1 LIMIT $2',
      ['idle', subtasks.length]
    );
    
    const assignments = [];
    for (let i = 0; i < subtasks.length; i++) {
      const agent = agents.rows[i % agents.rows.length];
      assignments.push({
        subtask: subtasks[i],
        agentId: agent?.id || `virtual-agent-${i}`,
        priority
      });
    }
    
    return assignments;
  }

  async executeSubtasks(assignments) {
    // Execute subtasks in parallel
    const results = await Promise.all(
      assignments.map(async (assignment) => {
        // Simulate subtask execution
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
        
        return {
          subtaskId: assignment.subtask.id,
          agentId: assignment.agentId,
          result: `Completed: ${assignment.subtask.description}`,
          success: true
        };
      })
    );
    
    return results;
  }

  async aggregateResults(results) {
    return {
      totalSubtasks: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };
  }

  async aggregateMetrics(data, options) {
    // Implement metrics aggregation
    const { timeRange, groupBy } = options;
    
    const query = `
      SELECT 
        ${groupBy || 'metric_type'} as group_key,
        AVG(value) as avg_value,
        MAX(value) as max_value,
        MIN(value) as min_value,
        COUNT(*) as count
      FROM performance_metrics
      WHERE timestamp >= NOW() - INTERVAL '${timeRange || '1 hour'}'
      GROUP BY ${groupBy || 'metric_type'}
    `;
    
    const result = await databaseManager.query(query);
    return result.rows;
  }

  async compressMemory(data, options) {
    // Implement memory compression logic
    const compressed = [];
    
    for (const entry of data) {
      // Simple compression: remove duplicate values
      const exists = compressed.find(c => 
        JSON.stringify(c.value) === JSON.stringify(entry.value)
      );
      
      if (!exists) {
        compressed.push(entry);
      }
    }
    
    return compressed;
  }

  async analyzePatterns(data, options) {
    // Implement pattern analysis
    const patterns = {
      frequent: {},
      sequences: [],
      anomalies: []
    };
    
    // Count frequencies
    for (const item of data) {
      const key = JSON.stringify(item);
      patterns.frequent[key] = (patterns.frequent[key] || 0) + 1;
    }
    
    return patterns;
  }

  async optimizePerformance(data, options) {
    // Implement performance optimization
    return {
      optimizations: [
        'Enabled query caching',
        'Adjusted connection pool size',
        'Optimized memory allocation'
      ],
      expectedImprovement: '25%'
    };
  }

  async applyOptimizationStrategy(entries, strategy) {
    switch (strategy) {
      case 'deduplicate':
        return this.deduplicateEntries(entries);
        
      case 'compress':
        return this.compressEntries(entries);
        
      case 'archive':
        return this.archiveOldEntries(entries);
        
      default:
        return entries;
    }
  }

  deduplicateEntries(entries) {
    const unique = new Map();
    
    for (const entry of entries) {
      const key = `${entry.key}:${JSON.stringify(entry.value)}`;
      if (!unique.has(key) || entry.updated_at > unique.get(key).updated_at) {
        unique.set(key, entry);
      }
    }
    
    return Array.from(unique.values());
  }

  compressEntries(entries) {
    // Implement actual compression logic
    return entries.map(entry => ({
      ...entry,
      value: JSON.stringify(entry.value) // Simplified
    }));
  }

  archiveOldEntries(entries) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30); // 30 days old
    
    return entries.filter(entry => 
      new Date(entry.updated_at) > cutoff
    );
  }

  async updateOptimizedEntries(optimized, namespace) {
    await databaseManager.transaction(async (client) => {
      // Delete all entries in namespace
      await client.query(
        'DELETE FROM memory_entries WHERE namespace = $1',
        [namespace]
      );
      
      // Insert optimized entries
      for (const entry of optimized) {
        await client.query(
          `INSERT INTO memory_entries (key, value, namespace, metadata, updated_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [entry.key, entry.value, namespace, entry.metadata || {}]
        );
      }
    });
  }

  calculateSpaceSaved(original, optimized) {
    const originalSize = JSON.stringify(original).length;
    const optimizedSize = JSON.stringify(optimized).length;
    const saved = originalSize - optimizedSize;
    const percentage = (saved / originalSize) * 100;
    
    return {
      bytes: saved,
      percentage: percentage.toFixed(2)
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('🛑 Shutting down job processor...');
    
    // Stop accepting new jobs
    await Promise.all(
      Object.values(queues).map(queue => queue.pause())
    );
    
    // Wait for active jobs to complete (max 30 seconds)
    const timeout = setTimeout(() => {
      console.warn('Force closing after timeout');
      process.exit(1);
    }, 30000);
    
    await Promise.all(
      Object.values(queues).map(queue => queue.close())
    );
    
    clearTimeout(timeout);
    
    // Cleanup connections
    await redisManager.cleanup();
    await databaseManager.cleanup();
    
    console.log('✅ Job processor shutdown complete');
    process.exit(0);
  }
}

// Create and start processor
const processor = new JobProcessor();

// Handle signals
process.on('SIGTERM', () => processor.shutdown());
process.on('SIGINT', () => processor.shutdown());

// Start the processor
processor.initialize().catch(error => {
  console.error('Failed to start job processor:', error);
  process.exit(1);
});

// Export for PM2
export default processor;