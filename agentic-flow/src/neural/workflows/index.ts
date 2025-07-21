/**
 * Neural Workflow Engines - Complete Orchestration System
 * 
 * This module provides a comprehensive suite of workflow engines for neural network
 * operations, including training, deployment, monitoring, and management with
 * sophisticated automation and human-in-the-loop capabilities.
 * 
 * @author Agent 2: Workflow Engine and Model Deployment Specialist
 * @version 2.0.0
 */

// Core Workflow Engines
export {
  WorkflowOrchestrationEngine,
  createWorkflowOrchestrationEngine,
  type OrchestrationConfig,
  type WorkflowDefinition,
  type WorkflowStep,
  type WorkflowInputs,
  type WorkflowContext,
  type OrchestrationWorkflow,
  type StepExecution,
  type WorkflowCheckpoint,
  type HumanTask,
  type HumanValidationConfig,
  type WorkflowExecution,
  type ExecutionPlan,
  type ResourceRequirements,
  type ResourceCapacity,
  type ResourceAllocation,
  type ResourceUtilization,
  type RetryPolicy,
  type ExecutionSummary,
  type OrchestrationMetrics
} from './WorkflowOrchestrationEngine';

// Neural Model Deployment Engine
export {
  NeuralModelDeploymentEngine,
  createNeuralModelDeploymentEngine,
  type DeploymentEngineConfig,
  type ModelDeploymentConfig,
  type BlueGreenDeploymentConfig,
  type CanaryDeploymentConfig,
  type DeploymentWorkflow,
  type DeploymentExecution,
  type WorkflowStep as DeploymentWorkflowStep,
  type ValidationResults,
  type OptimizationResults,
  type TrainingResults,
  type TestResults,
  type TestResult,
  type ModelTest,
  type ValidationTest,
  type MonitoringResults,
  type CanaryMonitoringResults,
  type TrafficSwitchStrategy
} from './NeuralModelDeploymentEngine';

// Data Pipeline Engine
export {
  DataPipelineEngine,
  createDataPipelineEngine,
  type DataPipelineConfig,
  type PipelineDefinition,
  type DataSource,
  type DataPipeline,
  type PipelineExecution,
  type ExecutionStep,
  type ProcessedDataset,
  type DataSchema,
  type SchemaField,
  type PreprocessingConfig,
  type PreprocessingStep,
  type ValidationConfig,
  type ValidationRule,
  type ValidationResult,
  type AugmentationConfig,
  type AugmentationTechnique,
  type DataBatch,
  type CachedDataset,
  type PipelineMetrics
} from './DataPipelineEngine';

// Distributed Training Coordinator
export {
  DistributedTrainingCoordinator,
  createDistributedTrainingCoordinator,
  type DistributedTrainingConfig,
  type AgentConfig,
  type TrainingAgent,
  type DistributedTrainingJobConfig,
  type ResourceRequirements as TrainingResourceRequirements,
  type TrainingJob,
  type CommunicationTopology,
  type TrainingJobExecution,
  type TrainingCheckpoint,
  type EpochResults,
  type AgentTrainingResult,
  type RecoveryResult,
  type CoordinatorMetrics
} from './DistributedTrainingCoordinator';

// Performance Monitoring Engine
export {
  PerformanceMonitoringEngine,
  createPerformanceMonitoringEngine,
  type MonitoringConfig,
  type MonitoringTarget,
  type AggregationType,
  type MonitoringInstanceConfig,
  type MonitorInstance,
  type MetricDataPoint,
  type MetricStore,
  type MetricData,
  type TargetMetrics,
  type TimeRange,
  type AggregatedMetricData,
  type AlertCondition,
  type AlertRuleDefinition,
  type AlertRule,
  type TriggeredAlert,
  type WidgetDefinition,
  type MetricWidgetConfig,
  type ChartWidgetConfig,
  type TableWidgetConfig,
  type GaugeWidgetConfig,
  type DashboardDefinition,
  type Dashboard,
  type WidgetData,
  type ChartSeries,
  type TableRow,
  type DashboardData,
  type PerformanceMetrics,
  type PerformanceSummary,
  type SystemStatus
} from './PerformanceMonitoringEngine';

// Workflow Persistence Manager
export {
  WorkflowPersistenceManager,
  createWorkflowPersistenceManager,
  type PersistenceConfig,
  type WorkflowState,
  type WorkflowCheckpoint as PersistenceWorkflowCheckpoint,
  type WorkflowExecution as PersistenceWorkflowExecution,
  type WorkflowDefinition as PersistenceWorkflowDefinition,
  type ExecutionFilters,
  type PersistenceMetrics,
  type CleanupOptions,
  type CleanupResult
} from './WorkflowPersistenceManager';

// Enhanced Neural Workflow Engine (from existing system)
export {
  NeuralWorkflowEngine,
  createNeuralWorkflowEngine,
  type NeuralWorkflowConfig,
  type AgentContext,
  type AgentInfo,
  type TaskContext,
  type WorkflowOptions,
  type WorkflowExecution as NeuralWorkflowExecution,
  type WorkflowStep as NeuralWorkflowStep,
  type TaskClassificationResult,
  type CoordinationPlan,
  type AgentAssignment,
  type CommunicationPlan,
  type Milestone,
  type ContingencyPlan,
  type PerformancePrediction,
  type OptimizedDecision,
  type ActionPriority,
  type ResourceAllocation as NeuralResourceAllocation,
  type Timeline,
  type WorkflowResult,
  type LearnedPattern,
  type NeuralWorkflowStatistics
} from './NeuralWorkflowEngine';

/**
 * Workflow Engine Factory
 * 
 * Creates a complete neural workflow system with all engines integrated
 */
export class NeuralWorkflowSystem {
  private orchestrationEngine: WorkflowOrchestrationEngine;
  private deploymentEngine: NeuralModelDeploymentEngine;
  private dataEngine: DataPipelineEngine;
  private trainingCoordinator: DistributedTrainingCoordinator;
  private monitoringEngine: PerformanceMonitoringEngine;
  private persistenceManager: WorkflowPersistenceManager;

  constructor(config?: Partial<NeuralWorkflowSystemConfig>) {
    const defaultConfig: NeuralWorkflowSystemConfig = {
      orchestration: {},
      deployment: {},
      dataPipeline: {},
      distributedTraining: {},
      monitoring: {},
      persistence: {},
      ...config
    };

    this.orchestrationEngine = new WorkflowOrchestrationEngine(defaultConfig.orchestration);
    this.deploymentEngine = new NeuralModelDeploymentEngine(defaultConfig.deployment);
    this.dataEngine = new DataPipelineEngine(defaultConfig.dataPipeline);
    this.trainingCoordinator = new DistributedTrainingCoordinator(defaultConfig.distributedTraining);
    this.monitoringEngine = new PerformanceMonitoringEngine(defaultConfig.monitoring);
    this.persistenceManager = new WorkflowPersistenceManager(defaultConfig.persistence);
  }

  /**
   * Initialize the complete neural workflow system
   */
  public async initialize(): Promise<void> {
    await Promise.all([
      this.persistenceManager.initialize(),
      this.monitoringEngine.initialize(),
      this.dataEngine.initialize(),
      this.trainingCoordinator.initialize(),
      this.deploymentEngine.initialize(),
      this.orchestrationEngine.initialize()
    ]);
  }

  /**
   * Get the orchestration engine
   */
  public getOrchestrationEngine(): WorkflowOrchestrationEngine {
    return this.orchestrationEngine;
  }

  /**
   * Get the deployment engine
   */
  public getDeploymentEngine(): NeuralModelDeploymentEngine {
    return this.deploymentEngine;
  }

  /**
   * Get the data engine
   */
  public getDataEngine(): DataPipelineEngine {
    return this.dataEngine;
  }

  /**
   * Get the training coordinator
   */
  public getTrainingCoordinator(): DistributedTrainingCoordinator {
    return this.trainingCoordinator;
  }

  /**
   * Get the monitoring engine
   */
  public getMonitoringEngine(): PerformanceMonitoringEngine {
    return this.monitoringEngine;
  }

  /**
   * Get the persistence manager
   */
  public getPersistenceManager(): WorkflowPersistenceManager {
    return this.persistenceManager;
  }

  /**
   * Execute a complete neural workflow
   */
  public async executeWorkflow(
    workflowDefinition: WorkflowDefinition,
    inputs: WorkflowInputs
  ): Promise<string> {
    return this.orchestrationEngine.executeWorkflow(workflowDefinition, inputs);
  }

  /**
   * Get system-wide metrics
   */
  public getSystemMetrics(): SystemMetrics {
    return {
      orchestration: this.orchestrationEngine.getOrchestrationMetrics(),
      training: this.trainingCoordinator.getCoordinatorMetrics(),
      monitoring: this.monitoringEngine.getSystemStatus(),
      deployment: this.deploymentEngine.getModelServerHealth()
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.orchestrationEngine.dispose();
    this.deploymentEngine.dispose();
    this.dataEngine.dispose();
    this.trainingCoordinator.dispose();
    this.monitoringEngine.dispose();
    this.persistenceManager.dispose();
  }
}

export interface NeuralWorkflowSystemConfig {
  orchestration?: Partial<OrchestrationConfig>;
  deployment?: Partial<DeploymentEngineConfig>;
  dataPipeline?: Partial<DataPipelineConfig>;
  distributedTraining?: Partial<DistributedTrainingConfig>;
  monitoring?: Partial<MonitoringConfig>;
  persistence?: Partial<PersistenceConfig>;
}

export interface SystemMetrics {
  orchestration: OrchestrationMetrics;
  training: CoordinatorMetrics;
  monitoring: SystemStatus;
  deployment: any;
}

/**
 * Factory function to create a complete neural workflow system
 */
export function createNeuralWorkflowSystem(
  config?: Partial<NeuralWorkflowSystemConfig>
): NeuralWorkflowSystem {
  return new NeuralWorkflowSystem(config);
}

/**
 * Workflow Templates
 * 
 * Pre-defined workflow templates for common neural network operations
 */
export const WorkflowTemplates = {
  /**
   * Complete ML Pipeline: Data → Training → Deployment
   */
  completeMlPipeline: (): WorkflowDefinition => ({
    id: 'complete-ml-pipeline',
    name: 'Complete ML Pipeline',
    description: 'End-to-end machine learning pipeline with data processing, training, and deployment',
    version: '1.0.0',
    steps: [
      {
        name: 'data_ingestion',
        type: 'data_pipeline',
        config: {
          dataSources: [
            {
              id: 'training_data',
              type: 'file',
              path: './data/training_data.json',
              format: 'json'
            }
          ],
          preprocessing: {
            steps: [
              { type: 'clean', config: { removeNulls: true, trimStrings: true } },
              { type: 'normalize', config: { fields: ['feature1', 'feature2'] } }
            ]
          },
          validation: {
            rules: [
              { type: 'required', field: 'target' },
              { type: 'range', field: 'feature1', min: 0, max: 1 }
            ]
          }
        }
      },
      {
        name: 'model_training',
        type: 'training',
        config: {
          modelConfig: {
            type: 'neural_network',
            layers: [128, 64, 32, 1],
            activation: 'relu'
          },
          epochs: 100,
          stepsPerEpoch: 1000,
          maxAgents: 4
        },
        requiresHumanValidation: true,
        humanValidation: {
          title: 'Validate Training Results',
          description: 'Review model performance metrics and approve for deployment',
          timeout: 3600000 // 1 hour
        }
      },
      {
        name: 'model_deployment',
        type: 'model_deployment',
        config: {
          deploymentType: 'blue-green',
          enableOptimization: true,
          validationTests: [
            { id: 'accuracy_test', name: 'Model Accuracy Test' },
            { id: 'latency_test', name: 'Response Time Test' }
          ]
        }
      }
    ]
  }),

  /**
   * Data Processing Pipeline
   */
  dataProcessingPipeline: (): WorkflowDefinition => ({
    id: 'data-processing-pipeline',
    name: 'Data Processing Pipeline',
    description: 'Advanced data processing with validation and augmentation',
    version: '1.0.0',
    steps: [
      {
        name: 'multi_source_ingestion',
        type: 'data_pipeline',
        config: {
          dataSources: [
            { id: 'db_source', type: 'database', connectionString: 'postgresql://...' },
            { id: 'api_source', type: 'api', url: 'https://api.example.com/data' },
            { id: 'file_source', type: 'file', path: './data/additional.csv', format: 'csv' }
          ],
          preprocessing: {
            steps: [
              { type: 'clean', config: { removeNulls: true } },
              { type: 'transform', config: { 
                transforms: [
                  { type: 'map', sourceField: 'old_name', targetField: 'new_name' }
                ]
              }},
              { type: 'filter', config: {
                conditions: [
                  { field: 'quality_score', operator: 'gt', value: 0.8 }
                ]
              }}
            ]
          },
          validation: {
            schema: {
              fields: [
                { name: 'id', type: 'string', nullable: false, unique: true },
                { name: 'value', type: 'number', nullable: false, unique: false }
              ]
            }
          },
          augmentation: {
            techniques: [
              { type: 'synthetic', config: { count: 1000 } },
              { type: 'noise', config: { level: 0.1 } }
            ]
          }
        }
      }
    ]
  }),

  /**
   * Distributed Training Workflow
   */
  distributedTrainingWorkflow: (): WorkflowDefinition => ({
    id: 'distributed-training-workflow',
    name: 'Distributed Training Workflow',
    description: 'Multi-agent distributed training with fault tolerance',
    version: '1.0.0',
    steps: [
      {
        name: 'setup_training_cluster',
        type: 'training',
        config: {
          modelConfig: {
            type: 'transformer',
            layers: 24,
            hiddenSize: 1024,
            attentionHeads: 16
          },
          epochs: 50,
          stepsPerEpoch: 5000,
          maxAgents: 8,
          resourceRequirements: {
            minCpu: 4,
            minMemory: 16384,
            minGpu: 1
          },
          syncStrategy: 'all_reduce',
          checkpointFrequency: 10
        }
      }
    ]
  }),

  /**
   * Model A/B Testing Workflow
   */
  modelAbTestingWorkflow: (): WorkflowDefinition => ({
    id: 'model-ab-testing-workflow',
    name: 'Model A/B Testing Workflow',
    description: 'Deploy and test multiple model versions with automated analysis',
    version: '1.0.0',
    steps: [
      {
        name: 'deploy_model_a',
        type: 'model_deployment',
        config: {
          modelId: 'model_a',
          deploymentType: 'standard',
          version: '1.0.0'
        }
      },
      {
        name: 'deploy_model_b',
        type: 'model_deployment',
        config: {
          modelId: 'model_b',
          deploymentType: 'canary',
          trafficPercentage: 20,
          duration: 3600000, // 1 hour
          successMetric: 'accuracy'
        }
      },
      {
        name: 'analyze_results',
        type: 'validation',
        config: {
          metrics: ['accuracy', 'latency', 'throughput'],
          duration: 7200000, // 2 hours
          significanceThreshold: 0.95
        },
        requiresHumanValidation: true,
        humanValidation: {
          title: 'Review A/B Test Results',
          description: 'Analyze test results and decide which model to promote',
          assignee: 'ml-team'
        }
      }
    ]
  })
};

/**
 * Workflow Utilities
 */
export const WorkflowUtils = {
  /**
   * Validate a workflow definition
   */
  validateWorkflowDefinition(definition: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];

    if (!definition.id) errors.push('Workflow ID is required');
    if (!definition.name) errors.push('Workflow name is required');
    if (!definition.version) errors.push('Workflow version is required');
    if (!definition.steps || definition.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    for (const [index, step] of definition.steps.entries()) {
      if (!step.name) errors.push(`Step ${index} must have a name`);
      if (!step.type) errors.push(`Step ${index} must have a type`);
      if (!step.config) errors.push(`Step ${index} must have configuration`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Estimate workflow duration
   */
  estimateWorkflowDuration(definition: WorkflowDefinition): WorkflowDurationEstimate {
    const stepEstimates = definition.steps.map(step => {
      switch (step.type) {
        case 'data_pipeline':
          return 300000; // 5 minutes
        case 'training':
          return step.config.epochs * 60000; // 1 minute per epoch
        case 'model_deployment':
          return 600000; // 10 minutes
        case 'validation':
          return 120000; // 2 minutes
        default:
          return 60000; // 1 minute default
      }
    });

    const parallelSteps = definition.steps.filter(step => step.canRunInParallel);
    const sequentialTime = stepEstimates.reduce((sum, time) => sum + time, 0);
    const parallelTime = parallelSteps.length > 0 
      ? Math.max(...parallelSteps.map((_, i) => stepEstimates[i]))
      : 0;

    return {
      estimatedDuration: sequentialTime - parallelTime,
      stepEstimates,
      parallelOptimization: parallelTime > 0
    };
  },

  /**
   * Generate workflow documentation
   */
  generateWorkflowDocumentation(definition: WorkflowDefinition): string {
    const doc = [];
    doc.push(`# ${definition.name}`);
    doc.push(`**Version:** ${definition.version}`);
    doc.push(`**ID:** ${definition.id}`);
    
    if (definition.description) {
      doc.push(`\n${definition.description}`);
    }

    doc.push('\n## Steps\n');

    for (const [index, step] of definition.steps.entries()) {
      doc.push(`### ${index + 1}. ${step.name}`);
      doc.push(`**Type:** ${step.type}`);
      
      if (step.requiresHumanValidation) {
        doc.push('**Requires Human Validation:** Yes');
      }
      
      if (step.canRunInParallel) {
        doc.push('**Can Run in Parallel:** Yes');
      }
      
      doc.push('');
    }

    return doc.join('\n');
  }
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface WorkflowDurationEstimate {
  estimatedDuration: number;
  stepEstimates: number[];
  parallelOptimization: boolean;
}

// Re-export key types for convenience
export type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowInputs,
  OrchestrationConfig,
  DeploymentEngineConfig,
  DataPipelineConfig,
  DistributedTrainingConfig,
  MonitoringConfig,
  PersistenceConfig
};