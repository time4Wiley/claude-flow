/**
 * Circular Buffer Implementation
 * Fixed-size buffer that overwrites oldest entries when full
 */

export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private writeIndex = 0;
  private size = 0;
  private totalItemsWritten = 0;
  
  constructor(private capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.buffer = new Array(capacity);
  }
  
  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.size = Math.min(this.size + _1, this.capacity);
    this.totalItemsWritten++;
  }
  
  pushMany(items: T[]): void {
    for (const item of items) {
      this.push(item);
    }
  }
  
  get(index: number): T | undefined {
    if (index < 0 || index >= this.size) {
      return undefined;
    }
    
    // Calculate actual buffer index based on current state
    const _actualIndex = this.size < this.capacity
      ? index
      : (this.writeIndex + index) % this.capacity;
    
    return this.buffer[actualIndex];
  }
  
  getRecent(count: number): T[] {
    const _result: T[] = [];
    const _itemsToReturn = Math.min(_count, this.size);
    
    // Calculate starting position for most recent items
    const _start = this.size < this.capacity
      ? Math.max(_0, this.size - itemsToReturn)
      : (this.writeIndex - itemsToReturn + this.capacity) % this.capacity;
    
    for (let _i = 0; i < itemsToReturn; i++) {
      const _index = (start + i) % this.capacity;
      const _item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    
    return result;
  }
  
  getAll(): T[] {
    const _result: T[] = [];
    
    if (this.size < this.capacity) {
      // Buffer not full yet, return items in order
      for (let _i = 0; i < this.size; i++) {
        const _item = this.buffer[i];
        if (item !== undefined) {
          result.push(item);
        }
      }
    } else {
      // Buffer is full, start from oldest item
      for (let _i = 0; i < this.capacity; i++) {
        const _index = (this.writeIndex + i) % this.capacity;
        const _item = this.buffer[index];
        if (item !== undefined) {
          result.push(item);
        }
      }
    }
    
    return result;
  }
  
  find(predicate: (item: T) => boolean): T | undefined {
    const _all = this.getAll();
    return all.find(predicate);
  }
  
  filter(predicate: (item: T) => boolean): T[] {
    const _all = this.getAll();
    return all.filter(predicate);
  }
  
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.writeIndex = 0;
    this.size = 0;
  }
  
  isEmpty(): boolean {
    return this.size === 0;
  }
  
  isFull(): boolean {
    return this.size === this.capacity;
  }
  
  getSize(): number {
    return this.size;
  }
  
  getCapacity(): number {
    return this.capacity;
  }
  
  getTotalItemsWritten(): number {
    return this.totalItemsWritten;
  }
  
  getOverwrittenCount(): number {
    return Math.max(_0, this.totalItemsWritten - this.capacity);
  }
  
  /**
   * Get estimated memory usage of the buffer
   */
  getMemoryUsage(): number {
    if (this.size === 0) return 0;
    
    // Sample first item to estimate size
    const _sample = this.buffer[0];
    if (sample === undefined) return 0;
    
    try {
      // Rough estimation based on JSON serialization
      const _sampleSize = JSON.stringify(sample).length * 2; // 2 bytes per character
      return sampleSize * this.size;
    } catch {
      // If serialization fails, return a default estimate
      return this.size * 1024; // 1KB per item default
    }
  }
  
  /**
   * Create a snapshot of the current buffer state
   */
  snapshot(): {
    items: T[];
    capacity: number;
    size: number;
    totalItemsWritten: number;
    overwrittenCount: number;
    memoryUsage: number;
  } {
    return {
      items: this.getAll(),
      capacity: this.capacity,
      size: this.size,
      totalItemsWritten: this.totalItemsWritten,
      overwrittenCount: this.getOverwrittenCount(),
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  /**
   * Resize the buffer (creates a new buffer with the new capacity)
   */
  resize(newCapacity: number): void {
    if (newCapacity <= 0) {
      throw new Error('New capacity must be greater than 0');
    }
    
    const _items = this.getAll();
    this.capacity = newCapacity;
    this.buffer = new Array(newCapacity);
    this.writeIndex = 0;
    this.size = 0;
    
    // Re-add items (newest items will be kept if newCapacity < items.length)
    const _itemsToKeep = items.slice(-newCapacity);
    this.pushMany(itemsToKeep);
  }
}