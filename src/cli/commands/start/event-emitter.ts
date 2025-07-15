/**
 * Simple EventEmitter implementation for process management
 */
type EventHandler = (...args: unknown[]) => void;
export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map();
  on(_event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(_event, []);
    }
    this.events.get(event)!.push(handler);
  }
  emit(_event: string, ...args: unknown[]): void {
    const _handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
  off(_event: string, handler: EventHandler): void {
    const _handlers = this.events.get(event);
    if (handlers) {
      const _index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(_index, 1);
      }
    }
  }
  once(_event: string, handler: EventHandler): void {
    const _onceHandler = (...args: unknown[]) => {
      handler(...args);
      this.off(_event, onceHandler);
    };
    this.on(_event, onceHandler);
  }
}