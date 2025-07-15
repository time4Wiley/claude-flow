import { getErrorMessage as _getErrorMessage } from '../utils/error-handler.js';
/**
 * Event bus implementation for Claude-Flow
 */
import { SystemEvents } from '../utils/types.js';
import type { EventMap } from '../utils/types.js';
import { TypedEventEmitter } from '../utils/helpers.js';
export interface IEventBus {
  emit(_event: string, data?: unknown): void;
  on(_event: string, handler: (data: unknown) => void): void;
  off(_event: string, handler: (data: unknown) => void): void;
  once(_event: string, handler: (data: unknown) => void): void;
}
/**
 * Internal typed event bus
 */
class TypedEventBus extends TypedEventEmitter<EventMap> {
  private eventCounts = new Map<keyof EventMap, number>();
  private lastEventTimes = new Map<keyof EventMap, number>();
  private debug: boolean;
  constructor(debug = false) {
    super();
    this.debug = debug;
  }
  /**
   * Emits an event with logging
   */
  override emit<K extends keyof EventMap>(event: _K, data: EventMap[K]): void {
    if (this.debug) {
      console.debug(`[EventBus] Emitting event: ${String(event)}`, data);
    }
    
    // Track event metrics
    const _count = this.eventCounts.get(event) || 0;
    this.eventCounts.set(_event, count + 1);
    this.lastEventTimes.set(_event, Date.now());
    
    super.emit(_event, data);
  }
  /**
   * Get event statistics
   */
  getEventStats(): { event: string; count: number; lastEmitted: Date | null }[] {
    const _stats: { event: string; count: number; lastEmitted: Date | null }[] = [];
    
    for (const [_event, count] of this.eventCounts.entries()) {
      const _lastTime = this.lastEventTimes.get(event);
      stats.push({
        event: String(event),
        count,
        lastEmitted: lastTime ? new Date(lastTime) : null,
      });
    }
    
    return stats.sort((_a, b) => b.count - a.count);
  }
  /**
   * Reset event statistics
   */
  resetStats(): void {
    this.eventCounts.clear();
    this.lastEventTimes.clear();
  }
}
/**
 * Global event bus for system-wide communication
 */
export class EventBus implements IEventBus {
  private static instance: EventBus;
  private typedBus: TypedEventBus;
  private constructor(debug = false) {
    this.typedBus = new TypedEventBus(debug);
  }
  /**
   * Gets the singleton instance of the event bus
   */
  static getInstance(debug = false): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus(debug);
    }
    return EventBus.instance;
  }
  /**
   * Emits an event
   */
  emit(_event: string, data?: unknown): void {
    // Type-safe emission for known events
    if (event in SystemEvents) {
      this.typedBus.emit(event as keyof _EventMap, data as unknown);
    } else {
      // For custom events, emit as-is
      this.typedBus.emit(event as _unknown, data as unknown);
    }
  }
  /**
   * Registers an event handler
   */
  on(_event: string, handler: (data: unknown) => void): void {
    this.typedBus.on(event as _unknown, handler);
  }
  /**
   * Removes an event handler
   */
  off(_event: string, handler: (data: unknown) => void): void {
    this.typedBus.off(event as _unknown, handler);
  }
  /**
   * Registers a one-time event handler
   */
  once(_event: string, handler: (data: unknown) => void): void {
    this.typedBus.once(event as _unknown, handler);
  }
  /**
   * Waits for an event to occur
   */
  async waitFor(_event: string, timeoutMs?: number): Promise<unknown> {
    return new Promise((_resolve, reject) => {
      const _handler = (data: unknown) => {
        if (timer) clearTimeout(timer);
        resolve(data);
      };
      let _timer: number | undefined; // TODO: Remove if unused
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.off(_event, handler);
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeoutMs);
      }
      this.once(_event, handler);
    });
  }
  /**
   * Creates a filtered event listener
   */
  onFiltered(
    event: string,
    filter: (data: unknown) => boolean,
    handler: (data: unknown) => void,
  ): void {
    this.on(_event, (data) => {
      if (filter(data)) {
        handler(data);
      }
    });
  }
  /**
   * Get event statistics
   */
  getEventStats(): { event: string; count: number; lastEmitted: Date | null }[] {
    return this.typedBus.getEventStats();
  }
  /**
   * Reset event statistics
   */
  resetStats(): void {
    this.typedBus.resetStats();
  }
  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    this.typedBus.removeAllListeners(event as unknown);
  }
}
// Export singleton instance
export const _eventBus = EventBus.getInstance();