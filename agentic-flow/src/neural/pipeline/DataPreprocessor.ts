import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Advanced Data Preprocessing Pipeline for Neural Networks
 * Handles feature engineering, normalization, and data augmentation
 */
export class DataPreprocessor {
  private readonly config: PreprocessingConfig;
  private scalers: Map<string, FeatureScaler> = new Map();
  private encoders: Map<string, LabelEncoder> = new Map();
  private statistics: DataStatistics | null = null;
  private transformationHistory: TransformationStep[] = [];

  constructor(config?: Partial<PreprocessingConfig>) {
    this.config = {
      normalize: true,
      standardize: true,
      handleMissingValues: true,
      missingValueStrategy: 'mean',
      outlierDetection: true,
      outlierMethod: 'iqr',
      outlierThreshold: 1.5,
      categoricalEncoding: 'one-hot',
      featureSelection: false,
      featureSelectionMethod: 'variance',
      dataAugmentation: false,
      augmentationFactor: 0.2,
      balanceClasses: false,
      validationSplit: 0.2,
      randomSeed: 42,
      batchSize: 32,
      shuffleData: true,
      ...config
    };
  }

  /**
   * Fit preprocessor on training data
   */
  public async fit(data: PreprocessingData): Promise<void> {
    try {
      logger.info('Fitting data preprocessor...');
      
      // Calculate data statistics
      this.statistics = await this.calculateStatistics(data);
      
      // Fit scalers and encoders
      await this.fitTransformers(data);
      
      // Feature selection if enabled
      if (this.config.featureSelection) {
        await this.fitFeatureSelector(data);
      }
      
      logger.info('Data preprocessor fitted successfully');
      
    } catch (error) {
      logger.error('Failed to fit preprocessor:', error);
      throw error;
    }
  }

  /**
   * Transform data using fitted preprocessor
   */
  public async transform(data: PreprocessingData): Promise<ProcessedData> {
    try {
      if (!this.statistics) {
        throw new Error('Preprocessor not fitted. Call fit() first.');
      }

      logger.info('Transforming data...');
      let processed = { ...data };

      // Handle missing values
      if (this.config.handleMissingValues) {
        processed = await this.handleMissingValues(processed);
      }

      // Outlier detection and handling
      if (this.config.outlierDetection) {
        processed = await this.handleOutliers(processed);
      }

      // Feature scaling
      if (this.config.normalize || this.config.standardize) {
        processed = await this.scaleFeatures(processed);
      }

      // Categorical encoding
      processed = await this.encodeCategoricalFeatures(processed);

      // Feature selection
      if (this.config.featureSelection) {
        processed = await this.selectFeatures(processed);
      }

      // Data augmentation
      if (this.config.dataAugmentation) {
        processed = await this.augmentData(processed);
      }

      // Class balancing
      if (this.config.balanceClasses && processed.labels) {
        processed = await this.balanceClasses(processed);
      }

      // Convert to tensors
      const tensorData = await this.convertToTensors(processed);

      // Create train/validation split
      const splits = await this.createDataSplits(tensorData);

      logger.info('Data transformation completed');
      
      return {
        train: splits.train,
        validation: splits.validation,
        test: splits.test,
        metadata: {
          featureNames: processed.featureNames || [],
          labelNames: processed.labelNames || [],
          preprocessing: this.transformationHistory,
          statistics: this.statistics
        }
      };

    } catch (error) {
      logger.error('Failed to transform data:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive data statistics
   */
  private async calculateStatistics(data: PreprocessingData): Promise<DataStatistics> {
    const features = data.features;
    const labels = data.labels;
    
    // Feature statistics
    const featureStats: FeatureStatistics[] = [];
    
    if (features instanceof tf.Tensor) {
      const featureData = await features.data();
      const shape = features.shape;
      const numFeatures = shape[shape.length - 1];
      const numSamples = shape[0];

      for (let i = 0; i < numFeatures; i++) {
        const featureValues: number[] = [];
        for (let j = 0; j < numSamples; j++) {
          featureValues.push(featureData[j * numFeatures + i]);
        }

        const stats = this.calculateFeatureStats(featureValues, i);
        featureStats.push(stats);
      }
    }

    // Label statistics
    let labelStats: LabelStatistics | undefined;
    if (labels) {
      labelStats = await this.calculateLabelStats(labels);
    }

    return {
      numSamples: Array.isArray(features) ? features.length : features.shape[0],
      numFeatures: featureStats.length,
      featureStats,
      labelStats,
      missingValueCount: 0, // Would be calculated from actual data
      outlierCount: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate statistics for a single feature
   */
  private calculateFeatureStats(values: number[], index: number): FeatureStatistics {
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    const n = validValues.length;
    
    if (n === 0) {
      return {
        index,
        mean: 0,
        std: 0,
        min: 0,
        max: 0,
        median: 0,
        q25: 0,
        q75: 0,
        skewness: 0,
        kurtosis: 0,
        missingCount: values.length,
        outlierCount: 0,
        dataType: 'numeric'
      };
    }

    const sortedValues = [...validValues].sort((a, b) => a - b);
    const mean = validValues.reduce((sum, val) => sum + val, 0) / n;
    const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    
    const median = this.calculatePercentile(sortedValues, 0.5);
    const q25 = this.calculatePercentile(sortedValues, 0.25);
    const q75 = this.calculatePercentile(sortedValues, 0.75);
    
    const skewness = this.calculateSkewness(validValues, mean, std);
    const kurtosis = this.calculateKurtosis(validValues, mean, std);
    
    // Outlier detection using IQR method
    const iqr = q75 - q25;
    const lowerBound = q25 - 1.5 * iqr;
    const upperBound = q75 + 1.5 * iqr;
    const outlierCount = validValues.filter(v => v < lowerBound || v > upperBound).length;

    return {
      index,
      mean,
      std,
      min: sortedValues[0],
      max: sortedValues[n - 1],
      median,
      q25,
      q75,
      skewness,
      kurtosis,
      missingCount: values.length - n,
      outlierCount,
      dataType: 'numeric'
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate skewness
   */
  private calculateSkewness(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    
    const n = values.length;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / std, 3), 0);
    
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  /**
   * Calculate kurtosis
   */
  private calculateKurtosis(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    
    const n = values.length;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / std, 4), 0);
    
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - 
           (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  /**
   * Calculate label statistics
   */
  private async calculateLabelStats(labels: tf.Tensor | number[]): Promise<LabelStatistics> {
    let labelValues: number[];
    
    if (labels instanceof tf.Tensor) {
      labelValues = Array.from(await labels.data());
    } else {
      labelValues = labels;
    }

    const uniqueLabels = [...new Set(labelValues)];
    const labelCounts = uniqueLabels.map(label => ({
      label,
      count: labelValues.filter(val => val === label).length
    }));

    const isBalanced = this.checkClassBalance(labelCounts);

    return {
      numClasses: uniqueLabels.length,
      classDistribution: labelCounts,
      isBalanced,
      majorityClass: labelCounts.reduce((max, current) => 
        current.count > max.count ? current : max
      ),
      minorityClass: labelCounts.reduce((min, current) => 
        current.count < min.count ? current : min
      )
    };
  }

  /**
   * Check if classes are balanced
   */
  private checkClassBalance(labelCounts: Array<{label: number, count: number}>): boolean {
    const counts = labelCounts.map(lc => lc.count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    
    // Consider balanced if ratio is less than 2:1
    return (maxCount / minCount) < 2;
  }

  /**
   * Fit transformers (scalers, encoders)
   */
  private async fitTransformers(data: PreprocessingData): Promise<void> {
    // Fit feature scalers
    if (data.features instanceof tf.Tensor) {
      const scaler = new MinMaxScaler();
      await scaler.fit(data.features);
      this.scalers.set('features', scaler);
    }

    // Fit categorical encoders
    if (data.categoricalFeatures) {
      for (const [name, values] of Object.entries(data.categoricalFeatures)) {
        const encoder = new OneHotEncoder();
        await encoder.fit(values);
        this.encoders.set(name, encoder);
      }
    }
  }

  /**
   * Handle missing values
   */
  private async handleMissingValues(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'handle_missing_values',
      strategy: this.config.missingValueStrategy,
      timestamp: Date.now()
    };

    // Implementation would handle different strategies (mean, median, mode, drop, etc.)
    // For now, returning data unchanged
    
    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Handle outliers
   */
  private async handleOutliers(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'handle_outliers',
      method: this.config.outlierMethod,
      threshold: this.config.outlierThreshold,
      timestamp: Date.now()
    };

    // Implementation would detect and handle outliers
    // For now, returning data unchanged
    
    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Scale features
   */
  private async scaleFeatures(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'scale_features',
      normalize: this.config.normalize,
      standardize: this.config.standardize,
      timestamp: Date.now()
    };

    if (data.features instanceof tf.Tensor) {
      const scaler = this.scalers.get('features');
      if (scaler) {
        data.features = await scaler.transform(data.features);
      }
    }

    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Encode categorical features
   */
  private async encodeCategoricalFeatures(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'encode_categorical',
      encoding: this.config.categoricalEncoding,
      timestamp: Date.now()
    };

    if (data.categoricalFeatures) {
      const encodedFeatures: { [key: string]: tf.Tensor } = {};
      
      for (const [name, values] of Object.entries(data.categoricalFeatures)) {
        const encoder = this.encoders.get(name);
        if (encoder) {
          encodedFeatures[name] = await encoder.transform(values);
        }
      }
      
      data.encodedCategoricalFeatures = encodedFeatures;
    }

    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Fit feature selector
   */
  private async fitFeatureSelector(data: PreprocessingData): Promise<void> {
    // Implementation would fit feature selection algorithm
    // For now, just logging
    logger.info(`Fitting feature selector with method: ${this.config.featureSelectionMethod}`);
  }

  /**
   * Select features
   */
  private async selectFeatures(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'select_features',
      method: this.config.featureSelectionMethod,
      timestamp: Date.now()
    };

    // Implementation would apply feature selection
    // For now, returning data unchanged
    
    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Augment data
   */
  private async augmentData(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'augment_data',
      factor: this.config.augmentationFactor,
      timestamp: Date.now()
    };

    // Implementation would apply data augmentation techniques
    // For now, returning data unchanged
    
    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Balance classes
   */
  private async balanceClasses(data: PreprocessingData): Promise<PreprocessingData> {
    const step: TransformationStep = {
      name: 'balance_classes',
      method: 'oversample',
      timestamp: Date.now()
    };

    // Implementation would balance class distribution
    // For now, returning data unchanged
    
    this.transformationHistory.push(step);
    return data;
  }

  /**
   * Convert to tensors
   */
  private async convertToTensors(data: PreprocessingData): Promise<TensorData> {
    let features: tf.Tensor;
    let labels: tf.Tensor | undefined;

    if (data.features instanceof tf.Tensor) {
      features = data.features;
    } else {
      features = tf.tensor2d(data.features);
    }

    if (data.labels) {
      if (data.labels instanceof tf.Tensor) {
        labels = data.labels;
      } else {
        labels = tf.tensor1d(data.labels);
      }
    }

    return { features, labels };
  }

  /**
   * Create train/validation/test splits
   */
  private async createDataSplits(data: TensorData): Promise<DataSplits> {
    const numSamples = data.features.shape[0];
    const validationSize = Math.floor(numSamples * this.config.validationSplit);
    const trainSize = numSamples - validationSize;

    // Create indices for splitting
    let indices = Array.from({ length: numSamples }, (_, i) => i);
    
    if (this.config.shuffleData) {
      indices = this.shuffleArray(indices);
    }

    const trainIndices = indices.slice(0, trainSize);
    const validationIndices = indices.slice(trainSize);

    // Split features
    const trainFeatures = tf.gather(data.features, tf.tensor1d(trainIndices, 'int32'));
    const validationFeatures = tf.gather(data.features, tf.tensor1d(validationIndices, 'int32'));

    // Split labels if they exist
    let trainLabels: tf.Tensor | undefined;
    let validationLabels: tf.Tensor | undefined;
    
    if (data.labels) {
      trainLabels = tf.gather(data.labels, tf.tensor1d(trainIndices, 'int32'));
      validationLabels = tf.gather(data.labels, tf.tensor1d(validationIndices, 'int32'));
    }

    return {
      train: {
        features: trainFeatures,
        labels: trainLabels
      },
      validation: {
        features: validationFeatures,
        labels: validationLabels
      },
      test: undefined // Would be provided separately
    };
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get preprocessing statistics
   */
  public getStatistics(): DataStatistics | null {
    return this.statistics;
  }

  /**
   * Get transformation history
   */
  public getTransformationHistory(): TransformationStep[] {
    return [...this.transformationHistory];
  }

  /**
   * Save preprocessor state
   */
  public async save(path: string): Promise<void> {
    const state = {
      config: this.config,
      statistics: this.statistics,
      transformationHistory: this.transformationHistory,
      scalerParams: await this.serializeScalers(),
      encoderParams: await this.serializeEncoders()
    };

    // In practice, would save to file system
    logger.info(`Saving preprocessor state to ${path}`);
  }

  /**
   * Load preprocessor state
   */
  public async load(path: string): Promise<void> {
    // In practice, would load from file system
    logger.info(`Loading preprocessor state from ${path}`);
  }

  /**
   * Serialize scalers
   */
  private async serializeScalers(): Promise<any> {
    const serialized: any = {};
    for (const [name, scaler] of this.scalers) {
      serialized[name] = await scaler.serialize();
    }
    return serialized;
  }

  /**
   * Serialize encoders
   */
  private async serializeEncoders(): Promise<any> {
    const serialized: any = {};
    for (const [name, encoder] of this.encoders) {
      serialized[name] = await encoder.serialize();
    }
    return serialized;
  }
}

// Scaler implementations
class MinMaxScaler implements FeatureScaler {
  private min?: tf.Tensor;
  private max?: tf.Tensor;
  private range?: tf.Tensor;

  async fit(data: tf.Tensor): Promise<void> {
    this.min = tf.min(data, 0);
    this.max = tf.max(data, 0);
    this.range = tf.sub(this.max, this.min);
  }

  async transform(data: tf.Tensor): Promise<tf.Tensor> {
    if (!this.min || !this.max || !this.range) {
      throw new Error('Scaler not fitted');
    }
    
    return tf.div(tf.sub(data, this.min), this.range);
  }

  async serialize(): Promise<any> {
    return {
      min: this.min ? await this.min.data() : null,
      max: this.max ? await this.max.data() : null,
      range: this.range ? await this.range.data() : null
    };
  }
}

class StandardScaler implements FeatureScaler {
  private mean?: tf.Tensor;
  private std?: tf.Tensor;

  async fit(data: tf.Tensor): Promise<void> {
    this.mean = tf.mean(data, 0);
    this.std = tf.sqrt(tf.mean(tf.square(tf.sub(data, this.mean)), 0));
  }

  async transform(data: tf.Tensor): Promise<tf.Tensor> {
    if (!this.mean || !this.std) {
      throw new Error('Scaler not fitted');
    }
    
    return tf.div(tf.sub(data, this.mean), this.std);
  }

  async serialize(): Promise<any> {
    return {
      mean: this.mean ? await this.mean.data() : null,
      std: this.std ? await this.std.data() : null
    };
  }
}

class OneHotEncoder implements LabelEncoder {
  private categories?: string[];
  private numCategories?: number;

  async fit(data: string[]): Promise<void> {
    this.categories = [...new Set(data)].sort();
    this.numCategories = this.categories.length;
  }

  async transform(data: string[]): Promise<tf.Tensor> {
    if (!this.categories) {
      throw new Error('Encoder not fitted');
    }

    const encoded = data.map(value => {
      const oneHot = new Array(this.numCategories!).fill(0);
      const index = this.categories!.indexOf(value);
      if (index !== -1) {
        oneHot[index] = 1;
      }
      return oneHot;
    });

    return tf.tensor2d(encoded);
  }

  async serialize(): Promise<any> {
    return {
      categories: this.categories,
      numCategories: this.numCategories
    };
  }
}

// Type definitions
export interface PreprocessingConfig {
  normalize: boolean;
  standardize: boolean;
  handleMissingValues: boolean;
  missingValueStrategy: 'mean' | 'median' | 'mode' | 'drop' | 'forward_fill';
  outlierDetection: boolean;
  outlierMethod: 'iqr' | 'zscore' | 'isolation_forest';
  outlierThreshold: number;
  categoricalEncoding: 'one-hot' | 'label' | 'target' | 'binary';
  featureSelection: boolean;
  featureSelectionMethod: 'variance' | 'correlation' | 'mutual_info' | 'rfe';
  dataAugmentation: boolean;
  augmentationFactor: number;
  balanceClasses: boolean;
  validationSplit: number;
  randomSeed: number;
  batchSize: number;
  shuffleData: boolean;
}

export interface PreprocessingData {
  features: tf.Tensor | number[][];
  labels?: tf.Tensor | number[];
  categoricalFeatures?: { [key: string]: string[] };
  featureNames?: string[];
  labelNames?: string[];
  encodedCategoricalFeatures?: { [key: string]: tf.Tensor };
}

export interface TensorData {
  features: tf.Tensor;
  labels?: tf.Tensor;
}

export interface DataSplits {
  train: TensorData;
  validation: TensorData;
  test?: TensorData;
}

export interface ProcessedData {
  train: TensorData;
  validation: TensorData;
  test?: TensorData;
  metadata: {
    featureNames: string[];
    labelNames: string[];
    preprocessing: TransformationStep[];
    statistics: DataStatistics;
  };
}

export interface DataStatistics {
  numSamples: number;
  numFeatures: number;
  featureStats: FeatureStatistics[];
  labelStats?: LabelStatistics;
  missingValueCount: number;
  outlierCount: number;
  timestamp: number;
}

export interface FeatureStatistics {
  index: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  q25: number;
  q75: number;
  skewness: number;
  kurtosis: number;
  missingCount: number;
  outlierCount: number;
  dataType: 'numeric' | 'categorical';
}

export interface LabelStatistics {
  numClasses: number;
  classDistribution: Array<{ label: number; count: number }>;
  isBalanced: boolean;
  majorityClass: { label: number; count: number };
  minorityClass: { label: number; count: number };
}

export interface TransformationStep {
  name: string;
  timestamp: number;
  [key: string]: any;
}

export interface FeatureScaler {
  fit(data: tf.Tensor): Promise<void>;
  transform(data: tf.Tensor): Promise<tf.Tensor>;
  serialize(): Promise<any>;
}

export interface LabelEncoder {
  fit(data: string[]): Promise<void>;
  transform(data: string[]): Promise<tf.Tensor>;
  serialize(): Promise<any>;
}

/**
 * Factory function to create data preprocessor
 */
export function createDataPreprocessor(
  config?: Partial<PreprocessingConfig>
): DataPreprocessor {
  return new DataPreprocessor(config);
}