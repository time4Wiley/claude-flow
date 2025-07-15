// config.js - Configuration management commands
import { printSuccess, printError, printWarning, readJsonFile, writeJsonFile, fileExists } from '../utils.js';

export async function configCommand(_subArgs, flags) {
  const _configCmd = subArgs[0];
  
  switch (configCmd) {
    case 'init':
      {
await initConfig(_subArgs, flags);
      
}break;
      
    case 'show':
      {
await showConfig(_subArgs, flags);
      
}break;
      
    case 'get':
      {
await getConfigValue(_subArgs, flags);
      
}break;
      
    case 'set':
      {
await setConfigValue(_subArgs, flags);
      
}break;
      
    case 'validate':
      {
await validateConfig(_subArgs, flags);
      
}break;
      
    case 'reset':
      {
await resetConfig(_subArgs, flags);
      
}break;
      
    default:
      showConfigHelp();
  }
}

async function initConfig(_subArgs, flags) {
  const _force = subArgs.includes('--force') || subArgs.includes('-f');
  const _configFile = 'claude-flow.config.json';
  
  try {
    // Check if config already exists
    const _exists = await fileExists(configFile);
    if (exists && !force) {
      printWarning('Configuration file already exists');
      console.log('Use --force to overwrite existing configuration');
      return;
    }
    
    printSuccess('Initializing Claude-Flow configuration...');
    
    // Create default configuration
    const _defaultConfig = {
      version: '1.0.71',
      terminal: {
        poolSize: 10,
        recycleAfter: 20,
        healthCheckInterval: 30000,
        type: 'auto'
      },
      orchestrator: {
        maxConcurrentTasks: 10,
        taskTimeout: 300000,
        defaultPriority: 5
      },
      memory: {
        backend: 'json',
        path: './memory/claude-flow-data.json',
        cacheSize: 1000,
        indexing: true
      },
      agents: {
        maxAgents: 20,
        defaultCapabilities: ['research', 'code', 'terminal'],
        resourceLimits: {
          memory: '1GB',
          cpu: '50%'
        }
      },
      mcp: {
        port: 3000,
        host: 'localhost',
        timeout: 30000
      },
      logging: {
        level: 'info',
        file: './claude-flow.log',
        maxSize: '10MB',
        maxFiles: 5
      }
    };
    
    await writeJsonFile(_configFile, defaultConfig);
    console.log(`✓ Created ${configFile}`);
    console.log('✓ Default settings configured');
    console.log('\nNext steps:');
    console.log('1. Review settings: claude-flow config show');
    console.log('2. Customize values: claude-flow config set <key> <value>');
    console.log('3. Validate config: claude-flow config validate');
    
  } catch (err) {
    printError(`Failed to initialize configuration: ${err.message}`);
  }
}

async function showConfig(_subArgs, flags) {
  const _configFile = 'claude-flow.config.json';
  const _format = getFlag(_subArgs, '--format') || 'pretty';
  
  try {
    const _config = await readJsonFile(configFile);
    
    printSuccess('Current configuration:');
    
    if (format === 'json') {
      console.log(JSON.stringify(_config, null, 2));
    } else {
      // Pretty format
      console.log('\n📋 System Configuration:');
      console.log(`   Version: ${config.version || 'unknown'}`);
      console.log('\n🖥️  Terminal Pool:');
      console.log(`   Pool Size: ${config.terminal?.poolSize || 10}`);
      console.log(`   Recycle After: ${config.terminal?.recycleAfter || 20} commands`);
      console.log(`   Health Check: ${config.terminal?.healthCheckInterval || 30000}ms`);
      console.log('\n🎭 Orchestrator:');
      console.log(`   Max Concurrent Tasks: ${config.orchestrator?.maxConcurrentTasks || 10}`);
      console.log(`   Task Timeout: ${config.orchestrator?.taskTimeout || 300000}ms`);
      console.log('\n💾 Memory:');
      console.log(`   Backend: ${config.memory?.backend || 'json'}`);
      console.log(`   Path: ${config.memory?.path || './memory/claude-flow-data.json'}`);
      console.log('\n🤖 Agents:');
      console.log(`   Max Agents: ${config.agents?.maxAgents || 20}`);
      console.log(`   Resource Limits: ${JSON.stringify(config.agents?.resourceLimits || { /* empty */ })}`);
    }
    
  } catch (err) {
    printError('Configuration file not found');
    console.log('Run "claude-flow config init" to create default configuration');
  }
}

async function getConfigValue(_subArgs, flags) {
  const _key = subArgs[1];
  const _configFile = 'claude-flow.config.json';
  
  if (!key) {
    printError('Usage: config get <key>');
    console.log('Examples:');
    console.log('  claude-flow config get terminal.poolSize');
    console.log('  claude-flow config get orchestrator.maxConcurrentTasks');
    return;
  }
  
  try {
    const _config = await readJsonFile(configFile);
    const _value = getNestedValue(_config, key);
    
    if (value !== undefined) {
      console.log(`${key}: ${JSON.stringify(value)}`);
    } else {
      printWarning(`Configuration key '${key}' not found`);
    }
    
  } catch (err) {
    printError('Configuration file not found');
    console.log('Run "claude-flow config init" to create configuration');
  }
}

async function setConfigValue(_subArgs, flags) {
  const _key = subArgs[1];
  const _value = subArgs[2];
  const _configFile = 'claude-flow.config.json';
  
  if (!key || value === undefined) {
    printError('Usage: config set <key> <value>');
    console.log('Examples:');
    console.log('  claude-flow config set terminal.poolSize 15');
    console.log('  claude-flow config set orchestrator.taskTimeout 600000');
    return;
  }
  
  try {
    let _config = await readJsonFile(_configFile, { /* empty */ });
    
    // Parse value appropriately
    let _parsedValue = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);
    
    // Set nested value
    setNestedValue(_config, _key, parsedValue);
    
    await writeJsonFile(_configFile, config);
    printSuccess(`Set ${key} = ${JSON.stringify(parsedValue)}`);
    
  } catch (err) {
    printError(`Failed to set configuration: ${err.message}`);
  }
}

async function validateConfig(_subArgs, flags) {
  const _configFile = 'claude-flow.config.json';
  
  try {
    const _config = await readJsonFile(configFile);
    
    printSuccess('Validating configuration...');
    
    const _errors = [];
    const _warnings = [];
    
    // Validate required sections
    const _requiredSections = ['terminal', 'orchestrator', 'memory'];
    for (const section of requiredSections) {
      if (!config[section]) {
        errors.push(`Missing required section: ${section}`);
      }
    }
    
    // Validate specific values
    if (config.terminal?.poolSize && (config.terminal.poolSize < 1 || config.terminal.poolSize > 100)) {
      warnings.push('Terminal pool size should be between 1 and 100');
    }
    
    if (config.orchestrator?.maxConcurrentTasks && config.orchestrator.maxConcurrentTasks < 1) {
      errors.push('Max concurrent tasks must be at least 1');
    }
    
    if (config.agents?.maxAgents && config.agents.maxAgents < 1) {
      errors.push('Max agents must be at least 1');
    }
    
    // Report results
    if (errors.length === 0 && warnings.length === 0) {
      printSuccess('✅ Configuration is valid');
    } else {
      if (errors.length > 0) {
        printError(`Found ${errors.length} error(s):`);
        errors.forEach(error => console.log(`  ❌ ${error}`));
      }
      
      if (warnings.length > 0) {
        printWarning(`Found ${warnings.length} warning(s):`);
        warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
      }
    }
    
  } catch (err) {
    printError('Configuration file not found or invalid');
    console.log('Run "claude-flow config init" to create valid configuration');
  }
}

async function resetConfig(_subArgs, flags) {
  const _force = subArgs.includes('--force') || subArgs.includes('-f');
  
  if (!force) {
    printWarning('This will reset configuration to defaults');
    console.log('Use --force to confirm reset');
    return;
  }
  
  await initConfig(['--force'], flags);
  printSuccess('Configuration reset to defaults');
}

// Helper functions
function getNestedValue(_obj, path) {
  return path.split('.').reduce((_current, key) => current?.[key], obj);
}

function setNestedValue(_obj, _path, value) {
  const _keys = path.split('.');
  const _last = keys.pop();
  const _target = keys.reduce((_current, key) => {
    if (!current[key]) current[key] = { /* empty */ };
    return current[key];
  }, obj);
  target[last] = value;
}

function getFlag(_args, flagName) {
  const _index = args.indexOf(flagName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

// fileExists is now imported from utils.js

function showConfigHelp() {
  console.log('Configuration commands:');
  console.log('  init [--force]                   Create default configuration');
  console.log('  show [--format json]             Display current configuration');
  console.log('  get <key>                        Get configuration value');
  console.log('  set <key> <value>                Set configuration value');
  console.log('  validate                         Validate configuration');
  console.log('  reset --force                    Reset to defaults');
  console.log();
  console.log('Configuration Keys:');
  console.log('  terminal.poolSize                Terminal pool size');
  console.log('  terminal.recycleAfter            Commands before recycle');
  console.log('  orchestrator.maxConcurrentTasks  Max parallel tasks');
  console.log('  orchestrator.taskTimeout         Task timeout in ms');
  console.log('  memory.backend                   Memory storage backend');
  console.log('  memory.path                      Memory database path');
  console.log('  agents.maxAgents                 Maximum number of agents');
  console.log();
  console.log('Examples:');
  console.log('  claude-flow config init');
  console.log('  claude-flow config set terminal.poolSize 15');
  console.log('  claude-flow config get orchestrator.maxConcurrentTasks');
  console.log('  claude-flow config validate');
}