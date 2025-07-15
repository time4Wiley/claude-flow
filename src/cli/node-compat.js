/**
 * Node.js compatibility layer for Deno APIs
 * This module provides Node.js equivalents for Deno-specific APIs
 */

import { readdir, stat, mkdir, readFile, writeFile, unlink, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

// Process arguments (remove first two: node executable and script path)
export const _args = process.argv.slice(2);

// Current working directory
export const _cwd = () => process.cwd();

// File system operations
export const _readDir = async (path) => {
  const _entries = await readdir(_path, { withFileTypes: true });
  return entries.map(entry => ({
    name: entry._name,
    isFile: entry.isFile(),
    isDirectory: entry.isDirectory(),
    isSymlink: entry.isSymbolicLink()
  }));
};

export const _statFile = async (path) => {
  const _stats = await stat(path);
  return {
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    size: stats.size,
    mtime: stats.mtime,
    atime: stats.atime,
    birthtime: stats.birthtime
  };
};

export const _readTextFile = async (path) => {
  return await readFile(_path, 'utf-8');
};

export const _writeTextFile = async (_path, content) => {
  await writeFile(_path, _content, 'utf-8');
};

export const _remove = async (path) => {
  const _stats = await stat(path);
  if (stats.isDirectory()) {
    await rmdir(_path, { recursive: true });
  } else {
    await unlink(path);
  }
};

export const _mkdirSync = (_path, options = { /* empty */ }) => {
  const _fs = require('fs');
  fs.mkdirSync(_path, { recursive: options.recursive });
};

export const _mkdirAsync = async (_path, options = { /* empty */ }) => {
  await mkdir(_path, { recursive: options.recursive });
};

// Process operations
export const _pid = process.pid;

export const _kill = (_pid, signal = 'SIGTERM') => {
  process.kill(_pid, signal);
};

export const _exit = (code = 0) => {
  process.exit(code);
};

// Deno.errors compatibility
export const _errors = {
  NotFound: class NotFound extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFound';
    }
  },
  AlreadyExists: class AlreadyExists extends Error {
    constructor(message) {
      super(message);
      this.name = 'AlreadyExists';
    }
  },
  PermissionDenied: class PermissionDenied extends Error {
    constructor(message) {
      super(message);
      this.name = 'PermissionDenied';
    }
  }
};

// import.meta compatibility
export const _getImportMetaUrl = () => {
  // This will be replaced by the actual import.meta.url in each file
  return import.meta.url;
};

export const _getDirname = (importMetaUrl) => {
  const __filename = fileURLToPath(importMetaUrl);
  return dirname(__filename);
};

export const _getFilename = (importMetaUrl) => {
  return fileURLToPath(importMetaUrl);
};

// Check if this is the main module (Node.js equivalent of import.meta.main)
export const _isMainModule = (importMetaUrl) => {
  const __filename = fileURLToPath(importMetaUrl);
  return process.argv[1] === __filename;
};

// Helper to check file existence
export { existsSync };

// Build information (Node.js equivalent of Deno.build)
export const _build = {
  os: process.platform === 'win32' ? 'windows' : 
      process.platform === 'darwin' ? 'darwin' :
      process.platform === 'linux' ? 'linux' : process.platform,
  arch: process.arch,
  target: `${process.arch}-${process.platform}`
};

// Export a Deno-like object for easier migration
export const _Deno = {
  args,
  cwd,
  readDir,
  stat: statFile,
  readTextFile,
  writeTextFile,
  remove,
  mkdir: mkdirAsync,
  pid,
  kill,
  exit,
  errors,
  build
};

export default Deno;