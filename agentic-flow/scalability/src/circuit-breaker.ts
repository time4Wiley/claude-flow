/**
 * Circuit Breaker Pattern Implementation
 * 
 * Provides fault tolerance and prevents cascading failures
 * in the distributed microservices architecture
 */

import { EventEmitter } from 'events';
import { promisify } from 'util';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  rollingWindowSize: number;
}

export interface CircuitBreakerMetrics {
  requests: number;
  failures: number;
  successes: number;
  rejections: number;
  timeouts: number;
  fallbacks: number;
  state: CircuitState;
  lastStateChange: Date;
  lastFailureTime?: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private rejections: number = 0;
  private timeouts: number = 0;
  private fallbacks: number = 0;
  private lastFailureTime?: Date;
  private lastStateChange: Date = new Date();
  private nextAttempt?: Date;
  private rollingWindow: boolean[] = [];
  private resetTimer?: NodeJS.Timeout;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
    private readonly fallbackFunction?: Function
  ) {
    super();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.allowRequest()) {
      return this.handleRejection();
    }

    this.requests++;
    const start = Date.now();

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess(Date.now() - start);
      return result;
    } catch (error) {
      this.onFailure(error, Date.now() - start);
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  private allowRequest(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt && Date.now() >= this.nextAttempt.getTime()) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        this.timeouts++;
        reject(new CircuitBreakerTimeoutError(`Operation timed out after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(duration: number): void {
    this.successes++;
    this.updateRollingWindow(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    }

    this.emit('success', {
      circuit: this.name,
      duration,
      state: this.state
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: any, duration: number): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.updateRollingWindow(false);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.shouldTrip()) {
        this.transitionToOpen();
      }
    }

    this.emit('failure', {
      circuit: this.name,
      error,
      duration,
      state: this.state
    });
  }

  /**
   * Handle rejection when circuit is open
   */
  private async handleRejection<T>(): Promise<T> {
    this.rejections++;

    this.emit('rejection', {
      circuit: this.name,
      state: this.state
    });

    if (this.fallbackFunction) {
      this.fallbacks++;
      try {
        return await this.fallbackFunction();
      } catch (fallbackError) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN and fallback failed`,
          fallbackError
        );
      }
    }

    throw new CircuitBreakerOpenError(
      `Circuit breaker '${this.name}' is OPEN`
    );
  }

  /**
   * Update rolling window for error rate calculation
   */
  private updateRollingWindow(success: boolean): void {
    this.rollingWindow.push(success);
    
    if (this.rollingWindow.length > this.options.rollingWindowSize) {
      this.rollingWindow.shift();
    }
  }

  /**
   * Check if circuit should trip to OPEN state
   */
  private shouldTrip(): boolean {
    if (this.rollingWindow.length < this.options.volumeThreshold) {
      return false;
    }

    const failureCount = this.rollingWindow.filter(success => !success).length;
    const errorRate = (failureCount / this.rollingWindow.length) * 100;

    return errorRate >= this.options.errorThresholdPercentage;
  }

  /**
   * State transitions
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastStateChange = new Date();
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
    this.successes = 0;

    this.emit('stateChange', {
      circuit: this.name,
      from: this.state,
      to: CircuitState.OPEN,
      reason: 'failure_threshold_exceeded'
    });

    // Set timer to transition to half-open
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.options.resetTimeout);
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = new Date();
    this.successes = 0;
    this.failures = 0;

    this.emit('stateChange', {
      circuit: this.name,
      from: previousState,
      to: CircuitState.HALF_OPEN,
      reason: 'reset_timeout_expired'
    });
  }

  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.lastStateChange = new Date();
    this.failures = 0;
    this.rollingWindow = [];

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.emit('stateChange', {
      circuit: this.name,
      from: previousState,
      to: CircuitState.CLOSED,
      reason: 'success_threshold_met'
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      requests: this.requests,
      failures: this.failures,
      successes: this.successes,
      rejections: this.rejections,
      timeouts: this.timeouts,
      fallbacks: this.fallbacks,
      state: this.state,
      lastStateChange: this.lastStateChange,
      lastFailureTime: this.lastFailureTime,
      consecutiveFailures: this.rollingWindow.filter(s => !s).length,
      consecutiveSuccesses: this.rollingWindow.filter(s => s).length
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.rejections = 0;
    this.timeouts = 0;
    this.fallbacks = 0;
    this.rollingWindow = [];
    this.lastFailureTime = undefined;
    this.lastStateChange = new Date();
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.emit('reset', {
      circuit: this.name
    });
  }

  /**
   * Force circuit to open state
   */
  open(): void {
    this.transitionToOpen();
  }

  /**
   * Force circuit to closed state
   */
  close(): void {
    this.transitionToClosed();
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }
}

/**
 * Circuit Breaker Factory for managing multiple circuits
 */
export class CircuitBreakerFactory {
  private static instance: CircuitBreakerFactory;
  private circuits: Map<string, CircuitBreaker> = new Map();
  private defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    successThreshold: 3,
    timeout: 3000, // 3 seconds
    volumeThreshold: 10,
    errorThresholdPercentage: 50,
    rollingWindowSize: 100
  };

  private constructor() {}

  static getInstance(): CircuitBreakerFactory {
    if (!CircuitBreakerFactory.instance) {
      CircuitBreakerFactory.instance = new CircuitBreakerFactory();
    }
    return CircuitBreakerFactory.instance;
  }

  /**
   * Create or get a circuit breaker
   */
  create(
    name: string,
    options?: Partial<CircuitBreakerOptions>,
    fallback?: Function
  ): CircuitBreaker {
    if (this.circuits.has(name)) {
      return this.circuits.get(name)!;
    }

    const circuitOptions = {
      ...this.defaultOptions,
      ...options
    };

    const circuit = new CircuitBreaker(name, circuitOptions, fallback);
    this.circuits.set(name, circuit);

    return circuit;
  }

  /**
   * Get a circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.circuits);
  }

  /**
   * Get metrics for all circuits
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    this.circuits.forEach((circuit, name) => {
      metrics[name] = circuit.getMetrics();
    });

    return metrics;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.forEach(circuit => circuit.reset());
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.circuits.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.circuits.clear();
  }
}

/**
 * Custom error classes
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly cause?: any) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreakerOpenError extends CircuitBreakerError {
  constructor(message: string, cause?: any) {
    super(message, cause);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends CircuitBreakerError {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

/**
 * Decorators for class methods
 */
export function CircuitBreaker(options?: Partial<CircuitBreakerOptions>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const circuitName = `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = async function (...args: any[]) {
      const factory = CircuitBreakerFactory.getInstance();
      const circuit = factory.create(circuitName, options);
      
      return circuit.execute(() => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}

/**
 * Example usage with decorators:
 * 
 * class UserService {
 *   @CircuitBreaker({ 
 *     timeout: 5000, 
 *     failureThreshold: 3,
 *     resetTimeout: 30000 
 *   })
 *   async getUser(id: string): Promise<User> {
 *     return await this.api.get(`/users/${id}`);
 *   }
 * }
 */