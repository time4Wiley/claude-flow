import { EventEmitter } from 'events';

export interface AccuracyMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  specificity: number;
  sensitivity: number;
  auc: number;
  confusionMatrix: ConfusionMatrix;
  classificationReport: ClassificationReport;
}

export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  matrix: number[][];
  labels: string[];
}

export interface ClassificationReport {
  perClass: {
    [className: string]: {
      precision: number;
      recall: number;
      f1Score: number;
      support: number;
    };
  };
  macro: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  weighted: {
    precision: number;
    recall: number;
    f1Score: number;
  };
}

export interface AccuracyBenchmarkConfig {
  testDataSize: number;
  validationSplit: number;
  crossValidationFolds: number;
  confidenceThreshold: number;
  classes: string[];
  metrics: string[];
  bootstrap: {
    enabled: boolean;
    samples: number;
    confidenceInterval: number;
  };
}

export interface AccuracyBenchmarkResult {
  config: AccuracyBenchmarkConfig;
  metrics: AccuracyMetrics;
  crossValidationResults: AccuracyMetrics[];
  bootstrapResults?: {
    confidence: number;
    lowerBound: AccuracyMetrics;
    upperBound: AccuracyMetrics;
    standardError: AccuracyMetrics;
  };
  timestamp: Date;
  modelInfo: {
    architecture: string;
    parameters: number;
    version: string;
  };
}

export interface Prediction {
  predicted: string;
  actual: string;
  confidence: number;
  probabilities: { [className: string]: number };
}

export class ModelAccuracyBenchmark extends EventEmitter {
  private results: AccuracyBenchmarkResult[] = [];

  constructor(private config: AccuracyBenchmarkConfig) {
    super();
  }

  async runBenchmark(
    model: any,
    testData: any[],
    labels: string[]
  ): Promise<AccuracyBenchmarkResult> {
    this.emit('benchmarkStart', { config: this.config, dataSize: testData.length });
    
    try {
      // Generate predictions
      const predictions = await this.generatePredictions(model, testData, labels);
      
      // Calculate base metrics
      const baseMetrics = this.calculateMetrics(predictions);
      
      // Cross-validation
      const cvResults = await this.runCrossValidation(model, testData, labels);
      
      // Bootstrap validation (if enabled)
      let bootstrapResults;
      if (this.config.bootstrap.enabled) {
        bootstrapResults = await this.runBootstrapValidation(predictions);
      }
      
      // Compile final result
      const result: AccuracyBenchmarkResult = {
        config: this.config,
        metrics: baseMetrics,
        crossValidationResults: cvResults,
        bootstrapResults,
        timestamp: new Date(),
        modelInfo: await this.getModelInfo(model)
      };
      
      this.results.push(result);
      this.emit('benchmarkComplete', result);
      
      return result;
    } catch (error) {
      this.emit('benchmarkError', error);
      throw error;
    }
  }

  private async generatePredictions(
    model: any,
    testData: any[],
    labels: string[]
  ): Promise<Prediction[]> {
    this.emit('predictionStart', { samples: testData.length });
    
    const predictions: Prediction[] = [];
    const batchSize = 32;
    
    for (let i = 0; i < testData.length; i += batchSize) {
      const batch = testData.slice(i, i + batchSize);
      const batchLabels = labels.slice(i, i + batchSize);
      
      // Simulate model prediction
      const batchPredictions = await this.predictBatch(model, batch, batchLabels);
      predictions.push(...batchPredictions);
      
      if (i % 100 === 0) {
        this.emit('predictionProgress', {
          processed: i,
          total: testData.length,
          progress: (i / testData.length) * 100
        });
      }
    }
    
    this.emit('predictionComplete', { predictions: predictions.length });
    return predictions;
  }

  private async predictBatch(
    model: any,
    batch: any[],
    actualLabels: string[]
  ): Promise<Prediction[]> {
    return new Promise(resolve => {
      setImmediate(() => {
        const predictions = batch.map((sample, index) => {
          // Simulate model prediction with some accuracy
          const probabilities = this.simulateModelPrediction();
          const predicted = this.getBestPrediction(probabilities);
          const confidence = Math.max(...Object.values(probabilities));
          
          return {
            predicted,
            actual: actualLabels[index],
            confidence,
            probabilities
          };
        });
        
        resolve(predictions);
      });
    });
  }

  private simulateModelPrediction(): { [className: string]: number } {
    const probabilities: { [className: string]: number } = {};
    const classes = this.config.classes;
    
    // Generate random probabilities that sum to 1
    const rawProbs = classes.map(() => Math.random());
    const sum = rawProbs.reduce((a, b) => a + b, 0);
    
    classes.forEach((className, index) => {
      probabilities[className] = rawProbs[index] / sum;
    });
    
    return probabilities;
  }

  private getBestPrediction(probabilities: { [className: string]: number }): string {
    return Object.entries(probabilities).reduce((best, [className, prob]) => 
      prob > probabilities[best] ? className : best
    );
  }

  private calculateMetrics(predictions: Prediction[]): AccuracyMetrics {
    const confusionMatrix = this.buildConfusionMatrix(predictions);
    const classificationReport = this.generateClassificationReport(predictions);
    
    // Calculate overall metrics
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = confusionMatrix;
    
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const accuracy = (truePositives + trueNegatives) / predictions.length;
    const specificity = trueNegatives / (trueNegatives + falsePositives) || 0;
    const sensitivity = recall; // Same as recall
    const auc = this.calculateAUC(predictions);
    
    return {
      precision,
      recall,
      f1Score,
      accuracy,
      specificity,
      sensitivity,
      auc,
      confusionMatrix,
      classificationReport
    };
  }

  private buildConfusionMatrix(predictions: Prediction[]): ConfusionMatrix {
    const classes = this.config.classes;
    const matrix: number[][] = Array(classes.length).fill(0).map(() => Array(classes.length).fill(0));
    
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    
    predictions.forEach(pred => {
      const actualIndex = classes.indexOf(pred.actual);
      const predictedIndex = classes.indexOf(pred.predicted);
      
      if (actualIndex >= 0 && predictedIndex >= 0) {
        matrix[actualIndex][predictedIndex]++;
        
        if (pred.actual === pred.predicted) {
          truePositives++;
        } else {
          falsePositives++;
          falseNegatives++;
        }
      }
    });
    
    // For multi-class, calculate macro-averaged values
    trueNegatives = predictions.length - truePositives - falsePositives - falseNegatives;
    
    return {
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      matrix,
      labels: classes
    };
  }

  private generateClassificationReport(predictions: Prediction[]): ClassificationReport {
    const classes = this.config.classes;
    const perClass: { [className: string]: any } = {};
    
    // Calculate per-class metrics
    classes.forEach(className => {
      const classTP = predictions.filter(p => p.actual === className && p.predicted === className).length;
      const classFP = predictions.filter(p => p.actual !== className && p.predicted === className).length;
      const classFN = predictions.filter(p => p.actual === className && p.predicted !== className).length;
      const support = predictions.filter(p => p.actual === className).length;
      
      const precision = classTP / (classTP + classFP) || 0;
      const recall = classTP / (classTP + classFN) || 0;
      const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
      
      perClass[className] = { precision, recall, f1Score, support };
    });
    
    // Calculate macro averages
    const macroAvg = classes.reduce((acc, className) => {
      acc.precision += perClass[className].precision;
      acc.recall += perClass[className].recall;
      acc.f1Score += perClass[className].f1Score;
      return acc;
    }, { precision: 0, recall: 0, f1Score: 0 });
    
    macroAvg.precision /= classes.length;
    macroAvg.recall /= classes.length;
    macroAvg.f1Score /= classes.length;
    
    // Calculate weighted averages
    const totalSupport = Object.values(perClass).reduce((sum: number, cls: any) => sum + cls.support, 0);
    const weightedAvg = classes.reduce((acc, className) => {
      const weight = perClass[className].support / totalSupport;
      acc.precision += perClass[className].precision * weight;
      acc.recall += perClass[className].recall * weight;
      acc.f1Score += perClass[className].f1Score * weight;
      return acc;
    }, { precision: 0, recall: 0, f1Score: 0 });
    
    return {
      perClass,
      macro: macroAvg,
      weighted: weightedAvg
    };
  }

  private calculateAUC(predictions: Prediction[]): number {
    // Simplified AUC calculation for binary classification
    // For multi-class, this would need to be extended
    if (this.config.classes.length !== 2) {
      return this.calculateMultiClassAUC(predictions);
    }
    
    const positive = this.config.classes[0];
    const sortedPreds = predictions
      .filter(p => p.actual === positive || p.predicted === positive)
      .sort((a, b) => b.confidence - a.confidence);
    
    let truePositives = 0;
    let falsePositives = 0;
    let auc = 0;
    const totalPositives = predictions.filter(p => p.actual === positive).length;
    const totalNegatives = predictions.length - totalPositives;
    
    for (const pred of sortedPreds) {
      if (pred.actual === positive) {
        truePositives++;
      } else {
        falsePositives++;
        auc += truePositives;
      }
    }
    
    return totalPositives > 0 && totalNegatives > 0 ? auc / (totalPositives * totalNegatives) : 0;
  }

  private calculateMultiClassAUC(predictions: Prediction[]): number {
    // One-vs-Rest AUC for multi-class
    const classes = this.config.classes;
    let totalAUC = 0;
    
    for (const className of classes) {
      const binaryPreds = predictions.map(pred => ({
        actual: pred.actual === className ? 'positive' : 'negative',
        predicted: pred.predicted === className ? 'positive' : 'negative',
        confidence: pred.probabilities[className] || 0,
        probabilities: { positive: pred.probabilities[className] || 0, negative: 1 - (pred.probabilities[className] || 0) }
      }));
      
      const classAUC = this.calculateAUC(binaryPreds);
      totalAUC += classAUC;
    }
    
    return totalAUC / classes.length;
  }

  private async runCrossValidation(
    model: any,
    data: any[],
    labels: string[]
  ): Promise<AccuracyMetrics[]> {
    this.emit('crossValidationStart', { folds: this.config.crossValidationFolds });
    
    const foldSize = Math.floor(data.length / this.config.crossValidationFolds);
    const results: AccuracyMetrics[] = [];
    
    for (let fold = 0; fold < this.config.crossValidationFolds; fold++) {
      const startIdx = fold * foldSize;
      const endIdx = Math.min(startIdx + foldSize, data.length);
      
      const testData = data.slice(startIdx, endIdx);
      const testLabels = labels.slice(startIdx, endIdx);
      
      // Simulate training on remaining data and testing on fold
      const foldPredictions = await this.generatePredictions(model, testData, testLabels);
      const foldMetrics = this.calculateMetrics(foldPredictions);
      
      results.push(foldMetrics);
      
      this.emit('crossValidationProgress', {
        fold: fold + 1,
        totalFolds: this.config.crossValidationFolds,
        foldAccuracy: foldMetrics.accuracy
      });
    }
    
    this.emit('crossValidationComplete', { results });
    return results;
  }

  private async runBootstrapValidation(predictions: Prediction[]): Promise<any> {
    this.emit('bootstrapStart', { samples: this.config.bootstrap.samples });
    
    const bootstrapResults: AccuracyMetrics[] = [];
    
    for (let i = 0; i < this.config.bootstrap.samples; i++) {
      // Create bootstrap sample
      const sample = this.createBootstrapSample(predictions);
      const metrics = this.calculateMetrics(sample);
      bootstrapResults.push(metrics);
      
      if (i % 100 === 0) {
        this.emit('bootstrapProgress', {
          sample: i + 1,
          totalSamples: this.config.bootstrap.samples
        });
      }
    }
    
    // Calculate confidence intervals
    const confidence = this.config.bootstrap.confidenceInterval;
    const lowerBound = this.calculatePercentile(bootstrapResults, (1 - confidence) / 2);
    const upperBound = this.calculatePercentile(bootstrapResults, 1 - (1 - confidence) / 2);
    const standardError = this.calculateStandardError(bootstrapResults);
    
    this.emit('bootstrapComplete');
    
    return {
      confidence,
      lowerBound,
      upperBound,
      standardError
    };
  }

  private createBootstrapSample(predictions: Prediction[]): Prediction[] {
    const sample: Prediction[] = [];
    for (let i = 0; i < predictions.length; i++) {
      const randomIndex = Math.floor(Math.random() * predictions.length);
      sample.push(predictions[randomIndex]);
    }
    return sample;
  }

  private calculatePercentile(results: AccuracyMetrics[], percentile: number): AccuracyMetrics {
    const sortedAccuracy = results.map(r => r.accuracy).sort((a, b) => a - b);
    const sortedPrecision = results.map(r => r.precision).sort((a, b) => a - b);
    const sortedRecall = results.map(r => r.recall).sort((a, b) => a - b);
    const sortedF1 = results.map(r => r.f1Score).sort((a, b) => a - b);
    
    const index = Math.floor(percentile * results.length);
    
    return {
      accuracy: sortedAccuracy[index],
      precision: sortedPrecision[index],
      recall: sortedRecall[index],
      f1Score: sortedF1[index],
      specificity: 0, // Simplified for bootstrap
      sensitivity: 0,
      auc: 0,
      confusionMatrix: results[0].confusionMatrix, // Reference only
      classificationReport: results[0].classificationReport // Reference only
    };
  }

  private calculateStandardError(results: AccuracyMetrics[]): AccuracyMetrics {
    const n = results.length;
    const means = {
      accuracy: results.reduce((sum, r) => sum + r.accuracy, 0) / n,
      precision: results.reduce((sum, r) => sum + r.precision, 0) / n,
      recall: results.reduce((sum, r) => sum + r.recall, 0) / n,
      f1Score: results.reduce((sum, r) => sum + r.f1Score, 0) / n
    };
    
    const variances = {
      accuracy: results.reduce((sum, r) => sum + Math.pow(r.accuracy - means.accuracy, 2), 0) / (n - 1),
      precision: results.reduce((sum, r) => sum + Math.pow(r.precision - means.precision, 2), 0) / (n - 1),
      recall: results.reduce((sum, r) => sum + Math.pow(r.recall - means.recall, 2), 0) / (n - 1),
      f1Score: results.reduce((sum, r) => sum + Math.pow(r.f1Score - means.f1Score, 2), 0) / (n - 1)
    };
    
    return {
      accuracy: Math.sqrt(variances.accuracy / n),
      precision: Math.sqrt(variances.precision / n),
      recall: Math.sqrt(variances.recall / n),
      f1Score: Math.sqrt(variances.f1Score / n),
      specificity: 0,
      sensitivity: 0,
      auc: 0,
      confusionMatrix: results[0].confusionMatrix,
      classificationReport: results[0].classificationReport
    };
  }

  private async getModelInfo(model: any): Promise<any> {
    return {
      architecture: 'Neural Network', // This would be extracted from the actual model
      parameters: 1000000, // This would be calculated from the actual model
      version: '1.0.0'
    };
  }

  getResults(): AccuracyBenchmarkResult[] {
    return [...this.results];
  }

  getLatestResult(): AccuracyBenchmarkResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  async compareModels(
    model1Result: AccuracyBenchmarkResult,
    model2Result: AccuracyBenchmarkResult
  ): Promise<{
    betterModel: 'model1' | 'model2' | 'equivalent';
    significantDifferences: string[];
    recommendation: string;
  }> {
    const metrics1 = model1Result.metrics;
    const metrics2 = model2Result.metrics;
    
    const differences: string[] = [];
    let score1 = 0;
    let score2 = 0;
    
    // Compare key metrics
    if (Math.abs(metrics1.accuracy - metrics2.accuracy) > 0.01) {
      if (metrics1.accuracy > metrics2.accuracy) {
        differences.push(`Model 1 has higher accuracy (${(metrics1.accuracy * 100).toFixed(1)}% vs ${(metrics2.accuracy * 100).toFixed(1)}%)`);
        score1++;
      } else {
        differences.push(`Model 2 has higher accuracy (${(metrics2.accuracy * 100).toFixed(1)}% vs ${(metrics1.accuracy * 100).toFixed(1)}%)`);
        score2++;
      }
    }
    
    if (Math.abs(metrics1.f1Score - metrics2.f1Score) > 0.01) {
      if (metrics1.f1Score > metrics2.f1Score) {
        differences.push(`Model 1 has higher F1 score (${metrics1.f1Score.toFixed(3)} vs ${metrics2.f1Score.toFixed(3)})`);
        score1++;
      } else {
        differences.push(`Model 2 has higher F1 score (${metrics2.f1Score.toFixed(3)} vs ${metrics1.f1Score.toFixed(3)})`);
        score2++;
      }
    }
    
    if (Math.abs(metrics1.auc - metrics2.auc) > 0.01) {
      if (metrics1.auc > metrics2.auc) {
        differences.push(`Model 1 has higher AUC (${metrics1.auc.toFixed(3)} vs ${metrics2.auc.toFixed(3)})`);
        score1++;
      } else {
        differences.push(`Model 2 has higher AUC (${metrics2.auc.toFixed(3)} vs ${metrics1.auc.toFixed(3)})`);
        score2++;
      }
    }
    
    let betterModel: 'model1' | 'model2' | 'equivalent';
    if (score1 > score2) {
      betterModel = 'model1';
    } else if (score2 > score1) {
      betterModel = 'model2';
    } else {
      betterModel = 'equivalent';
    }
    
    const recommendation = this.generateRecommendation(betterModel, differences);
    
    return {
      betterModel,
      significantDifferences: differences,
      recommendation
    };
  }

  private generateRecommendation(betterModel: string, differences: string[]): string {
    if (betterModel === 'equivalent') {
      return 'Both models perform similarly. Consider other factors like computational efficiency, interpretability, or specific use case requirements.';
    } else if (betterModel === 'model1') {
      return `Model 1 shows better performance across key metrics. ${differences.length > 0 ? 'Key advantages: ' + differences.filter(d => d.includes('Model 1')).join(', ') : ''}`;
    } else {
      return `Model 2 shows better performance across key metrics. ${differences.length > 0 ? 'Key advantages: ' + differences.filter(d => d.includes('Model 2')).join(', ') : ''}`;
    }
  }
}

// Export factory function
export function createAccuracyBenchmark(config: Partial<AccuracyBenchmarkConfig> = {}): ModelAccuracyBenchmark {
  const defaultConfig: AccuracyBenchmarkConfig = {
    testDataSize: 1000,
    validationSplit: 0.2,
    crossValidationFolds: 5,
    confidenceThreshold: 0.5,
    classes: ['class1', 'class2'],
    metrics: ['accuracy', 'precision', 'recall', 'f1Score', 'auc'],
    bootstrap: {
      enabled: true,
      samples: 1000,
      confidenceInterval: 0.95
    }
  };
  
  return new ModelAccuracyBenchmark({ ...defaultConfig, ...config });
}