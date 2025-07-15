// memory.js - Memory management commands
import { printSuccess, printError, printWarning } from '../utils.js';
import { Deno, cwd, exit, existsSync } from '../node-compat.js';

export async function memoryCommand(_subArgs, flags) {
  const _memorySubcommand = subArgs[0];
  const _memoryStore = './memory/memory-store.json';
  
  // Helper to load memory data
  async function loadMemory() {
    try {
      const _content = await Deno.readTextFile(memoryStore);
      return JSON.parse(content);
    } catch {
      return { /* empty */ };
    }
  }
  
  // Helper to save memory data
  async function saveMemory(data) {
    await Deno.mkdir('./memory', { recursive: true });
    await Deno.writeTextFile(_memoryStore, JSON.stringify(_data, null, 2));
  }
  
  switch (memorySubcommand) {
    case 'store':
      {
await storeMemory(_subArgs, _loadMemory, saveMemory);
      
}break;
      
    case 'query':
      {
await queryMemory(_subArgs, loadMemory);
      
}break;
      
    case 'stats':
      {
await showMemoryStats(loadMemory);
      
}break;
      
    case 'export':
      {
await exportMemory(_subArgs, loadMemory);
      
}break;
      
    case 'import':
      {
await importMemory(_subArgs, saveMemory);
      
}break;
      
    case 'clear':
      {
await clearMemory(_subArgs, saveMemory);
      
}break;
      
    case 'list':
      {
await listNamespaces(loadMemory);
      
}break;
      
    default:
      showMemoryHelp();
  }
}

async function storeMemory(_subArgs, _loadMemory, saveMemory) {
  const _key = subArgs[1];
  const _value = subArgs.slice(2).join(' ');
  
  if (!key || !value) {
    printError('Usage: memory store <key> <value>');
    return;
  }
  
  try {
    const _data = await loadMemory();
    const _namespace = getNamespaceFromArgs(subArgs) || 'default';
    
    if (!data[namespace]) {
      data[namespace] = [];
    }
    
    // Remove existing entry with same key
    data[namespace] = data[namespace].filter(e => e.key !== key);
    
    // Add new entry
    data[namespace].push({
      _key,
      _value,
      _namespace,
      timestamp: Date.now()
    });
    
    await saveMemory(data);
    printSuccess('Stored successfully');
    console.log(`📝 Key: ${key}`);
    console.log(`📦 Namespace: ${namespace}`);
    console.log(`💾 Size: ${new TextEncoder().encode(value).length} bytes`);
  } catch (err) {
    printError(`Failed to store: ${err.message}`);
  }
}

async function queryMemory(_subArgs, loadMemory) {
  const _search = subArgs.slice(1).join(' ');
  
  if (!search) {
    printError('Usage: memory query <search>');
    return;
  }
  
  try {
    const _data = await loadMemory();
    const _namespace = getNamespaceFromArgs(subArgs);
    const _results = [];
    
    for (const [_ns, entries] of Object.entries(data)) {
      if (namespace && ns !== namespace) continue;
      
      for (const entry of entries) {
        if (entry.key.includes(search) || entry.value.includes(search)) {
          results.push(entry);
        }
      }
    }
    
    if (results.length === 0) {
      printWarning('No results found');
      return;
    }
    
    printSuccess(`Found ${results.length} results:`);
    
    // Sort by timestamp (newest first)
    results.sort((_a, b) => b.timestamp - a.timestamp);
    
    for (const entry of results.slice(_0, 10)) {
      console.log(`\n📌 ${entry.key}`);
      console.log(`   Namespace: ${entry.namespace}`);
      console.log(`   Value: ${entry.value.substring(_0, 100)}${entry.value.length > 100 ? '...' : ''}`);
      console.log(`   Stored: ${new Date(entry.timestamp).toLocaleString()}`);
    }
    
    if (results.length > 10) {
      console.log(`\n... and ${results.length - 10} more results`);
    }
  } catch (err) {
    printError(`Failed to query: ${err.message}`);
  }
}

async function showMemoryStats(loadMemory) {
  try {
    const _data = await loadMemory();
    let _totalEntries = 0;
    const _namespaceStats = { /* empty */ };
    
    for (const [_namespace, entries] of Object.entries(data)) {
      namespaceStats[namespace] = entries.length;
      totalEntries += entries.length;
    }
    
    printSuccess('Memory Bank Statistics:');
    console.log(`   Total Entries: ${totalEntries}`);
    console.log(`   Namespaces: ${Object.keys(data).length}`);
    console.log(`   Size: ${(new TextEncoder().encode(JSON.stringify(data)).length / 1024).toFixed(2)} KB`);
    
    if (Object.keys(data).length > 0) {
      console.log('\n📁 Namespace Breakdown:');
      for (const [_namespace, count] of Object.entries(namespaceStats)) {
        console.log(`   ${namespace}: ${count} entries`);
      }
    }
  } catch (err) {
    printError(`Failed to get stats: ${err.message}`);
  }
}

async function exportMemory(_subArgs, loadMemory) {
  const _filename = subArgs[1] || `memory-export-${Date.now()}.json`;
  
  try {
    const _data = await loadMemory();
    const _namespace = getNamespaceFromArgs(subArgs);
    
    let _exportData = data;
    if (namespace) {
      exportData = { [namespace]: data[namespace] || [] };
    }
    
    await Deno.writeTextFile(_filename, JSON.stringify(_exportData, null, 2));
    printSuccess(`Memory exported to ${filename}`);
    
    let _totalEntries = 0;
    for (const entries of Object.values(exportData)) {
      totalEntries += entries.length;
    }
    console.log(`📦 Exported ${totalEntries} entries from ${Object.keys(exportData).length} namespace(s)`);
  } catch (err) {
    printError(`Failed to export memory: ${err.message}`);
  }
}

async function importMemory(_subArgs, saveMemory) {
  const _filename = subArgs[1];
  
  if (!filename) {
    printError('Usage: memory import <filename>');
    return;
  }
  
  try {
    const _importContent = await Deno.readTextFile(filename);
    const _importData = JSON.parse(importContent);
    
    // Load existing memory
    const _existingData = await loadMemory();
    
    // Merge imported data
    let _totalImported = 0;
    for (const [_namespace, entries] of Object.entries(importData)) {
      if (!existingData[namespace]) {
        existingData[namespace] = [];
      }
      
      // Add entries that don't already exist (by key)
      const _existingKeys = new Set(existingData[namespace].map(e => e.key));
      const _newEntries = entries.filter(e => !existingKeys.has(e.key));
      
      existingData[namespace].push(...newEntries);
      totalImported += newEntries.length;
    }
    
    await saveMemory(existingData);
    printSuccess(`Imported ${totalImported} new entries from ${filename}`);
  } catch (err) {
    printError(`Failed to import memory: ${err.message}`);
  }
}

async function clearMemory(_subArgs, saveMemory) {
  const _namespace = getNamespaceFromArgs(subArgs);
  
  if (!namespace) {
    printError('Usage: memory clear --namespace <namespace>');
    printWarning('This will clear all entries in the specified namespace');
    return;
  }
  
  try {
    const _data = await loadMemory();
    
    if (!data[namespace]) {
      printWarning(`Namespace '${namespace}' does not exist`);
      return;
    }
    
    const _entryCount = data[namespace].length;
    delete data[namespace];
    
    await saveMemory(data);
    printSuccess(`Cleared ${entryCount} entries from namespace '${namespace}'`);
  } catch (err) {
    printError(`Failed to clear memory: ${err.message}`);
  }
}

async function listNamespaces(loadMemory) {
  try {
    const _data = await loadMemory();
    const _namespaces = Object.keys(data);
    
    if (namespaces.length === 0) {
      printWarning('No namespaces found');
      return;
    }
    
    printSuccess('Available namespaces:');
    for (const namespace of namespaces) {
      const _count = data[namespace].length;
      console.log(`  ${namespace} (${count} entries)`);
    }
  } catch (err) {
    printError(`Failed to list namespaces: ${err.message}`);
  }
}

function getNamespaceFromArgs(subArgs) {
  const _namespaceIndex = subArgs.indexOf('--namespace');
  if (namespaceIndex !== -1 && namespaceIndex + 1 < subArgs.length) {
    return subArgs[namespaceIndex + 1];
  }
  
  const _nsIndex = subArgs.indexOf('--ns');
  if (nsIndex !== -1 && nsIndex + 1 < subArgs.length) {
    return subArgs[nsIndex + 1];
  }
  
  return null;
}

// Helper to load memory data (needed for import function)
async function loadMemory() {
  try {
    const _content = await Deno.readTextFile('./memory/memory-store.json');
    return JSON.parse(content);
  } catch {
    return { /* empty */ };
  }
}

function showMemoryHelp() {
  console.log('Memory commands:');
  console.log('  store <key> <value>    Store a key-value pair');
  console.log('  query <search>         Search for entries');
  console.log('  stats                  Show memory statistics');
  console.log('  export [filename]      Export memory to file');
  console.log('  import <filename>      Import memory from file');
  console.log('  clear --namespace <ns> Clear a namespace');
  console.log('  list                   List all namespaces');
  console.log();
  console.log('Options:');
  console.log('  --namespace <ns>       Specify namespace for operations');
  console.log('  --ns <ns>              Short form of --namespace');
  console.log();
  console.log('Examples:');
  console.log('  memory store previous_work "Research findings from yesterday"');
  console.log('  memory query research --namespace sparc');
  console.log('  memory export backup.json --namespace default');
  console.log('  memory import project-memory.json');
  console.log('  memory stats');
}