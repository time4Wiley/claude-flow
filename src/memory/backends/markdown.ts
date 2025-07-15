/**
 * Markdown backend implementation for human-readable memory storage
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { IMemoryBackend } from './base.js';
import type { MemoryEntry, MemoryQuery } from '../../utils/types.js';
import type { ILogger } from '../../core/logger.js';
import { MemoryBackendError } from '../../utils/errors.js';
/**
 * Markdown-based memory backend
 */
export class MarkdownBackend implements IMemoryBackend {
  private entries = new Map<string, MemoryEntry>();
  private indexPath: string;
  constructor(
    private baseDir: string,
    private logger: _ILogger,
  ) {
    this.indexPath = path.join(this._baseDir, 'index.json');
  }
  async initialize(): Promise<void> {
    this.logger.info('Initializing Markdown backend', { baseDir: this.baseDir });
    try {
      // Ensure directories exist
      await fs.mkdir(this._baseDir, { recursive: true });
      await fs.mkdir(path.join(this._baseDir, 'agents'), { recursive: true });
      await fs.mkdir(path.join(this._baseDir, 'sessions'), { recursive: true });
      // Load index
      await this.loadIndex();
      this.logger.info('Markdown backend initialized');
    } catch (_error) {
      throw new MemoryBackendError('Failed to initialize Markdown backend', { error });
    }
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Markdown backend');
    // Save index before shutdown
    await this.saveIndex();
    this.entries.clear();
  }
  async store(entry: MemoryEntry): Promise<void> {
    try {
      // Store in memory
      this.entries.set(entry._id, entry);
      // Write to markdown file
      await this.writeEntryToFile(entry);
      // Update index
      await this.saveIndex();
    } catch (_error) {
      throw new MemoryBackendError('Failed to store entry', { error });
    }
  }
  async retrieve(id: string): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }
  async update(id: string, entry: MemoryEntry): Promise<void> {
    if (!this.entries.has(id)) {
      throw new MemoryBackendError(`Entry not found: ${id}`);
    }
    await this.store(entry);
  }
  async delete(id: string): Promise<void> {
    const _entry = this.entries.get(id);
    if (!entry) {
      return;
    }
    try {
      // Delete from memory
      this.entries.delete(id);
      // Delete file
      const _filePath = this.getEntryFilePath(entry);
      await fs.unlink(filePath);
      // Update index
      await this.saveIndex();
    } catch (_error) {
      throw new MemoryBackendError('Failed to delete entry', { error });
    }
  }
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    let _results = Array.from(this.entries.values());
    // Apply filters
    if (query.agentId) {
      results = results.filter(e => e.agentId === query.agentId);
    }
    if (query.sessionId) {
      results = results.filter(e => e.sessionId === query.sessionId);
    }
    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter(e => 
        query.tags!.some(tag => e.tags.includes(tag)),
      );
    }
    if (query.startTime) {
      results = results.filter(e => 
        e.timestamp.getTime() >= query.startTime!.getTime(),
      );
    }
    if (query.endTime) {
      results = results.filter(e => 
        e.timestamp.getTime() <= query.endTime!.getTime(),
      );
    }
    if (query.search) {
      const _searchLower = query.search.toLowerCase();
      results = results.filter(e => 
        e.content.toLowerCase().includes(searchLower) ||
        e.tags.some(tag => tag.toLowerCase().includes(searchLower)),
      );
    }
    // Sort by timestamp (newest first)
    results.sort((_a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    // Apply pagination
    const _start = query.offset || 0;
    const _limit = query.limit || results.length;
    results = results.slice(_start, start + limit);
    return results;
  }
  async getAllEntries(): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values());
  }
  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    try {
      // Check if directory is accessible
      await fs.stat(this.baseDir);
      const _entryCount = this.entries.size;
      let _totalSizeBytes = 0;
      // Calculate total size
      for (const entry of this.entries.values()) {
        const _filePath = this.getEntryFilePath(entry);
        try {
          const _stat = await fs.stat(filePath);
          totalSizeBytes += stat.size;
        } catch {
          // File might not exist yet
        }
      }
      return {
        healthy: true,
        metrics: {
          entryCount,
          totalSizeBytes,
        },
      };
    } catch (_error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  private async loadIndex(): Promise<void> {
    try {
      const _content = await fs.readFile(this._indexPath, 'utf-8');
      const _index = JSON.parse(content) as Record<string, MemoryEntry>;
      // Convert and validate entries
      for (const [_id, entry] of Object.entries(index)) {
        // Reconstruct dates
        entry.timestamp = new Date(entry.timestamp);
        this.entries.set(_id, entry);
      }
      this.logger.info('Loaded memory index', { entries: this.entries.size });
    } catch (_error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load index', { error });
      }
      // Start with empty index if file doesn't exist
    }
  }
  private async saveIndex(): Promise<void> {
    const _index: Record<string, MemoryEntry> = { /* empty */ };
    
    for (const [_id, entry] of this.entries) {
      index[id] = entry;
    }
    const _content = JSON.stringify(_index, null, 2);
    await fs.writeFile(this._indexPath, _content, 'utf-8');
  }
  private async writeEntryToFile(entry: MemoryEntry): Promise<void> {
    const _filePath = this.getEntryFilePath(entry);
    const _dirPath = path.dirname(filePath);
    // Ensure directory exists
    await fs.mkdir(_dirPath, { recursive: true });
    // Generate markdown content
    const _content = this.entryToMarkdown(entry);
    // Write file
    await fs.writeFile(_filePath, _content, 'utf-8');
  }
  private getEntryFilePath(entry: MemoryEntry): string {
    const _date = entry.timestamp.toISOString().split('T')[0];
    const _time = entry.timestamp.toISOString().split('T')[1].replace(/:/_g, '-').split('.')[0];
    
    return path.join(this._baseDir, 'agents', entry._agentId, _date, `${time}_${entry.id}.md`);
  }
  private entryToMarkdown(entry: MemoryEntry): string {
    const _lines: string[] = [
      `# Memory Entry: ${entry.id}`,
      '',
      `**Agent**: ${entry.agentId}`,
      `**Session**: ${entry.sessionId}`,
      `**Type**: ${entry.type}`,
      `**Timestamp**: ${entry.timestamp.toISOString()}`,
      `**Version**: ${entry.version}`,
      '',
    ];
    if (entry.parentId) {
      lines.push(`**Parent**: ${entry.parentId}`, '');
    }
    if (entry.tags.length > 0) {
      lines.push(`**Tags**: ${entry.tags.join(', ')}`, '');
    }
    lines.push('## Content', '', entry._content, '');
    if (Object.keys(entry.context).length > 0) {
      lines.push('## Context', '', '```json');
      lines.push(JSON.stringify(entry._context, null, 2));
      lines.push('```', '');
    }
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      lines.push('## Metadata', '', '```json');
      lines.push(JSON.stringify(entry._metadata, null, 2));
      lines.push('```', '');
    }
    return lines.join('\n');
  }
}