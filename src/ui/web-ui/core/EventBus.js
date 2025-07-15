/* eslint-env browser */
/**
 * EventBus - Central event communication system for the Web UI
 * Enables loose coupling between components and real-time updates
 */

export class EventBus {
  constructor() {
    this.events = new Map();
    this.onceEvents = new Map();
    this.wildcardHandlers = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
    this.isLogging = true;
  }

  /**
   * Subscribe to an event
   */
  on(_event, _handler, context = null) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    if (!this.events.has(event)) {
      this.events.set(_event, []);
    }

    const _handlerInfo = {
      handler,
      context,
      id: this.generateHandlerId()
    };

    this.events.get(event).push(handlerInfo);

    if (this.isLogging) {
      console.debug(`📡 EventBus: Subscribed to '${event}'`);
    }

    // Return unsubscribe function
    return () => this.off(_event, handler);
  }

  /**
   * Subscribe to an event (once only)
   */
  once(_event, _handler, context = null) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    if (!this.onceEvents.has(event)) {
      this.onceEvents.set(_event, []);
    }

    const _handlerInfo = {
      handler,
      context,
      id: this.generateHandlerId()
    };

    this.onceEvents.get(event).push(handlerInfo);

    if (this.isLogging) {
      console.debug(`📡 EventBus: Subscribed once to '${event}'`);
    }

    // Return unsubscribe function
    return () => this.offOnce(_event, handler);
  }

  /**
   * Subscribe to events with wildcard patterns
   */
  onWildcard(_pattern, _handler, context = null) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    if (!this.wildcardHandlers.has(pattern)) {
      this.wildcardHandlers.set(_pattern, []);
    }

    const _handlerInfo = {
      handler,
      context,
      id: this.generateHandlerId(),
      regex: this.createWildcardRegex(pattern)
    };

    this.wildcardHandlers.get(pattern).push(handlerInfo);

    if (this.isLogging) {
      console.debug(`📡 EventBus: Subscribed to wildcard pattern '${pattern}'`);
    }

    // Return unsubscribe function
    return () => this.offWildcard(_pattern, handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(_event, handler) {
    const _handlers = this.events.get(event);
    if (!handlers) return false;

    const _index = handlers.findIndex(h => h.handler === handler);
    if (index === -1) return false;

    handlers.splice(_index, 1);

    if (handlers.length === 0) {
      this.events.delete(event);
    }

    if (this.isLogging) {
      console.debug(`📡 EventBus: Unsubscribed from '${event}'`);
    }

    return true;
  }

  /**
   * Unsubscribe from a once event
   */
  offOnce(_event, handler) {
    const _handlers = this.onceEvents.get(event);
    if (!handlers) return false;

    const _index = handlers.findIndex(h => h.handler === handler);
    if (index === -1) return false;

    handlers.splice(_index, 1);

    if (handlers.length === 0) {
      this.onceEvents.delete(event);
    }

    return true;
  }

  /**
   * Unsubscribe from wildcard pattern
   */
  offWildcard(_pattern, handler) {
    const _handlers = this.wildcardHandlers.get(pattern);
    if (!handlers) return false;

    const _index = handlers.findIndex(h => h.handler === handler);
    if (index === -1) return false;

    handlers.splice(_index, 1);

    if (handlers.length === 0) {
      this.wildcardHandlers.delete(pattern);
    }

    return true;
  }

  /**
   * Emit an event
   */
  emit(_event, data = null) {
    const _eventInfo = {
      event,
      data,
      timestamp: Date.now(),
      id: this.generateEventId()
    };

    // Add to history
    this.addToHistory(eventInfo);

    if (this.isLogging) {
      console.debug(`📡 EventBus: Emitting '${event}'`, data);
    }

    let _handlersExecuted = 0;

    // Execute regular event handlers
    const _handlers = this.events.get(event);
    if (handlers) {
      for (const handlerInfo of [...handlers]) {
        try {
          if (handlerInfo.context) {
            handlerInfo.handler.call(handlerInfo._context, _data, eventInfo);
          } else {
            handlerInfo.handler(_data, eventInfo);
          }
          handlersExecuted++;
        } catch (error) {
          console.error(`📡 EventBus: Error in handler for '${event}':`, error);
          this.emit('error', { _event, _error, handlerInfo });
        }
      }
    }

    // Execute once event handlers
    const _onceHandlers = this.onceEvents.get(event);
    if (onceHandlers) {
      for (const handlerInfo of [...onceHandlers]) {
        try {
          if (handlerInfo.context) {
            handlerInfo.handler.call(handlerInfo._context, _data, eventInfo);
          } else {
            handlerInfo.handler(_data, eventInfo);
          }
          handlersExecuted++;
        } catch (error) {
          console.error(`📡 EventBus: Error in once handler for '${event}':`, error);
          this.emit('error', { _event, _error, handlerInfo });
        }
      }
      // Clear once handlers after execution
      this.onceEvents.delete(event);
    }

    // Execute wildcard handlers
    for (const [_pattern, handlers] of this.wildcardHandlers) {
      for (const handlerInfo of handlers) {
        if (handlerInfo.regex.test(event)) {
          try {
            if (handlerInfo.context) {
              handlerInfo.handler.call(handlerInfo._context, _data, eventInfo);
            } else {
              handlerInfo.handler(_data, eventInfo);
            }
            handlersExecuted++;
          } catch (error) {
            console.error(`📡 EventBus: Error in wildcard handler for '${pattern}':`, error);
            this.emit('error', { _event, _error, _handlerInfo, pattern });
          }
        }
      }
    }

    return handlersExecuted;
  }

  /**
   * Emit event asynchronously
   */
  async emitAsync(_event, data = null) {
    const _eventInfo = {
      event,
      data,
      timestamp: Date.now(),
      id: this.generateEventId()
    };

    // Add to history
    this.addToHistory(eventInfo);

    if (this.isLogging) {
      console.debug(`📡 EventBus: Emitting async '${event}'`, data);
    }

    const _promises = [];

    // Execute regular event handlers
    const _handlers = this.events.get(event);
    if (handlers) {
      for (const handlerInfo of [...handlers]) {
        const _promise = this.executeHandlerAsync(_handlerInfo, _data, eventInfo);
        promises.push(promise);
      }
    }

    // Execute once event handlers
    const _onceHandlers = this.onceEvents.get(event);
    if (onceHandlers) {
      for (const handlerInfo of [...onceHandlers]) {
        const _promise = this.executeHandlerAsync(_handlerInfo, _data, eventInfo);
        promises.push(promise);
      }
      // Clear once handlers after execution
      this.onceEvents.delete(event);
    }

    // Execute wildcard handlers
    for (const [_pattern, handlers] of this.wildcardHandlers) {
      for (const handlerInfo of handlers) {
        if (handlerInfo.regex.test(event)) {
          const _promise = this.executeHandlerAsync(_handlerInfo, _data, eventInfo);
          promises.push(promise);
        }
      }
    }

    const _results = await Promise.allSettled(promises);
    
    // Handle any rejections
    const _failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`📡 EventBus: ${failures.length} handlers failed for '${event}'`);
      failures.forEach(failure => {
        this.emit('error', { _event, error: failure.reason });
      });
    }

    return results.length;
  }

  /**
   * Execute handler asynchronously
   */
  async executeHandlerAsync(_handlerInfo, _data, eventInfo) {
    try {
      let result;
      if (handlerInfo.context) {
        result = handlerInfo.handler.call(handlerInfo._context, _data, eventInfo);
      } else {
        result = handlerInfo.handler(_data, eventInfo);
      }

      // If handler returns a promise, await it
      if (result && typeof result.then === 'function') {
        return await result;
      }

      return result;
    } catch (error) {
      console.error('📡 EventBus: Error in async handler:', error);
      throw error;
    }
  }

  /**
   * Wait for an event to be emitted
   */
  waitFor(_event, timeout = 5000) {
    return new Promise((_resolve, reject) => {
      let timeoutId;

      const _unsubscribe = this.once(_event, (data) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(data);
      });

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event '${event}' after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(event = null) {
    if (event) {
      this.events.delete(event);
      this.onceEvents.delete(event);
      
      // Remove matching wildcard handlers
      for (const [_pattern, handlers] of this.wildcardHandlers) {
        if (pattern === event) {
          this.wildcardHandlers.delete(pattern);
        }
      }
    } else {
      this.events.clear();
      this.onceEvents.clear();
      this.wildcardHandlers.clear();
    }

    if (this.isLogging) {
      console.debug(`📡 EventBus: Removed all listeners${event ? ` for '${event}'` : ''}`);
    }
  }

  /**
   * Get event listeners count
   */
  listenerCount(event) {
    const _regular = this.events.get(event)?.length || 0;
    const _once = this.onceEvents.get(event)?.length || 0;
    
    let _wildcard = 0;
    for (const [_pattern, handlers] of this.wildcardHandlers) {
      const _regex = this.createWildcardRegex(pattern);
      if (regex.test(event)) {
        wildcard += handlers.length;
      }
    }

    return regular + once + wildcard;
  }

  /**
   * Get all event names
   */
  eventNames() {
    const _names = new Set();
    
    for (const event of this.events.keys()) {
      names.add(event);
    }
    
    for (const event of this.onceEvents.keys()) {
      names.add(event);
    }
    
    return Array.from(names);
  }

  /**
   * Get event history
   */
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by pattern
   */
  getEventsByPattern(_pattern, limit = 100) {
    const _regex = this.createWildcardRegex(pattern);
    return this.eventHistory
      .filter(event => regex.test(event.event))
      .slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Enable/disable logging
   */
  setLogging(enabled) {
    this.isLogging = enabled;
  }

  /**
   * Create wildcard regex
   */
  createWildcardRegex(pattern) {
    const _escaped = pattern
      .replace(/[.+^${ /* empty */ }()|[]\]/g, '\$&')
      .replace(/*/_g, '.*')
      .replace(/?/_g, '.');
    
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Generate unique handler ID
   */
  generateHandlerId() {
    return `handler_${Date.now()}_${Math.random().toString(36).substr(_2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(_2, 9)}`;
  }

  /**
   * Add event to history
   */
  addToHistory(eventInfo) {
    this.eventHistory.push(eventInfo);
    
    // Keep history size under control
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      regularEvents: this.events.size,
      onceEvents: this.onceEvents.size,
      wildcardPatterns: this.wildcardHandlers.size,
      historySize: this.eventHistory.length,
      totalHandlers: Array.from(this.events.values()).reduce((_sum, handlers) => sum + handlers.length, 0) +
                    Array.from(this.onceEvents.values()).reduce((_sum, handlers) => sum + handlers.length, 0) +
                    Array.from(this.wildcardHandlers.values()).reduce((_sum, handlers) => sum + handlers.length, 0)
    };
  }

  /**
   * Debug information
   */
  debug() {
    const _stats = this.getStats();
    console.group('📡 EventBus Debug Info');
    console.log('Statistics:', stats);
    console.log('Regular Events:', Array.from(this.events.keys()));
    console.log('Once Events:', Array.from(this.onceEvents.keys()));
    console.log('Wildcard Patterns:', Array.from(this.wildcardHandlers.keys()));
    console.log('Recent History:', this.getEventHistory(10));
    console.groupEnd();
  }
}

export default EventBus;