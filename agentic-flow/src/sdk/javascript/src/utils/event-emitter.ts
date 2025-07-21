import { EventEmitter as BaseEventEmitter } from 'eventemitter3';

/**
 * Extended EventEmitter with typed events
 */
export class EventEmitter extends BaseEventEmitter {
  /**
   * Type-safe event emission
   */
  emit<T = any>(event: string | symbol, ...args: T[]): boolean {
    return super.emit(event, ...args);
  }
  
  /**
   * Type-safe event listener
   */
  on<T = any>(event: string | symbol, listener: (...args: T[]) => void, context?: any): this {
    return super.on(event, listener as any, context);
  }
  
  /**
   * Type-safe one-time event listener
   */
  once<T = any>(event: string | symbol, listener: (...args: T[]) => void, context?: any): this {
    return super.once(event, listener as any, context);
  }
  
  /**
   * Remove event listener
   */
  off<T = any>(event: string | symbol, listener?: (...args: T[]) => void, context?: any): this {
    return super.off(event, listener as any, context);
  }
}