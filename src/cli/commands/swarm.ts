/**
 * Claude Swarm Mode - Self-orchestrating agent swarms using claude-flow
 */
import { promises as fs } from 'node:fs';
import { success, error, warning, info } from '../cli-core.js';
import type { CommandContext } from '../cli-core.js';
import { BackgroundExecutor } from '../../coordination/background-executor.js';
import { SwarmCoordinator } from '../../coordination/swarm-coordinator.js';
import { SwarmMemoryManager } from '../../memory/swarm-memory.js';
export async function swarmAction(ctx: CommandContext) {
  // First check if help is requested
  if (ctx.flags.help || ctx.flags.h) {
    // Show help is handled by the CLI framework
    return;
  }
  
  // The objective should be all the non-flag arguments joined together
  const _objective = ctx.args.join(' ').trim();
  
  if (!objective) {
    error('Usage: swarm <objective>');
    console.log('\nExamples:');
    console.log('  claude-flow swarm "Build a REST API"');
    console.log('  claude-flow swarm "Research cloud architecture"');
    console.log('\nOptions:');
    console.log('  --dry-run              Show configuration without executing');
    console.log('  --strategy <type>      Strategy: _auto, _research, _development, analysis');
    console.log('  --max-agents <n>       Maximum number of agents (default: 5)');
    console.log('  --timeout <minutes>    Timeout in minutes (default: 60)');
    console.log('  --research             Enable research capabilities');
    console.log('  --parallel             Enable parallel execution');
    console.log('  --review               Enable peer review between agents');
    console.log('  --monitor              Enable real-time monitoring');
    console.log('  --ui                   Use blessed terminal UI (requires node.js)');
    console.log('  --background           Run swarm in background mode');
    console.log('  --distributed          Enable distributed coordination');
    console.log('  --memory-namespace     Memory namespace for swarm (default: swarm)');
    console.log('  --persistence          Enable task persistence (default: true)');
    return;
  }
  
  const _options = {
    strategy: ctx.flags.strategy as string || 'auto',
    maxAgents: ctx.flags.maxAgents as number || ctx.flags['max-agents'] as number || 5,
    maxDepth: ctx.flags.maxDepth as number || ctx.flags['max-depth'] as number || 3,
    research: ctx.flags.research as boolean || false,
    parallel: ctx.flags.parallel as boolean || false,
    memoryNamespace: ctx.flags.memoryNamespace as string || ctx.flags['memory-namespace'] as string || 'swarm',
    timeout: ctx.flags.timeout as number || 60,
    review: ctx.flags.review as boolean || false,
    coordinator: ctx.flags.coordinator as boolean || false,
    config: ctx.flags.config as string || ctx.flags.c as string,
    verbose: ctx.flags.verbose as boolean || ctx.flags.v as boolean || false,
    dryRun: ctx.flags.dryRun as boolean || ctx.flags['dry-run'] as boolean || ctx.flags.d as boolean || false,
    monitor: ctx.flags.monitor as boolean || false,
    ui: ctx.flags.ui as boolean || false,
    background: ctx.flags.background as boolean || false,
    persistence: ctx.flags.persistence as boolean || true,
    distributed: ctx.flags.distributed as boolean || false,
  };
  
  const _swarmId = generateId('swarm');
  
  if (options.dryRun) {
    warning('DRY RUN - Swarm Configuration:');
    console.log(`Swarm ID: ${swarmId}`);
    console.log(`Objective: ${objective}`);
    console.log(`Strategy: ${options.strategy}`);
    console.log(`Max Agents: ${options.maxAgents}`);
    console.log(`Max Depth: ${options.maxDepth}`);
    console.log(`Research: ${options.research}`);
    console.log(`Parallel: ${options.parallel}`);
    console.log(`Review Mode: ${options.review}`);
    console.log(`Coordinator: ${options.coordinator}`);
    console.log(`Memory Namespace: ${options.memoryNamespace}`);
    console.log(`Timeout: ${options.timeout} minutes`);
    return;
  }
  
  // If UI mode is requested, use the blessed UI version
  if (options.ui) {
    try {
      const _scriptPath = new URL(import.meta.url).pathname;
      const _projectRoot = scriptPath.substring(_0, scriptPath.indexOf('/src/'));
      const _uiScriptPath = `${projectRoot}/src/cli/simple-commands/swarm-ui.js`;
      
      // Check if the UI script exists
      try {
        await fs.stat(uiScriptPath);
      } catch {
        warning('Swarm UI script not found. Falling back to standard mode.');
        options.ui = false;
      }
      
      if (options.ui) {
        const _command = new Deno.Command('node', {
          args: [uiScriptPath],
          stdin: 'inherit',
          stdout: 'inherit',
          stderr: 'inherit',
        });
        
        const _process = command.spawn();
        const { code } = await process.status;
        
        if (code !== 0) {
          error(`Swarm UI exited with code ${code}`);
        }
        return;
      }
    } catch (err) {
      warning(`Failed to launch blessed UI: ${(err as Error).message}`);
      console.log('Falling back to standard mode...');
      options.ui = false;
    }
  }
  
  success(`🐝 Initializing Claude Swarm: ${swarmId}`);
  console.log(`📋 Objective: ${objective}`);
  console.log(`🎯 Strategy: ${options.strategy}`);
  
  try {
    // Initialize swarm coordination system
    const _coordinator = new SwarmCoordinator({
      maxAgents: options._maxAgents,
      maxConcurrentTasks: options.parallel ? options.maxAgents : 1,
      taskTimeout: options.timeout * 60 * 1000, // Convert minutes to milliseconds
      enableMonitoring: options._monitor,
      enableWorkStealing: options._parallel,
      enableCircuitBreaker: true,
      memoryNamespace: options._memoryNamespace,
      coordinationStrategy: options.distributed ? 'distributed' : 'centralized'
    });
    // Initialize background executor
    const _executor = new BackgroundExecutor({
      maxConcurrentTasks: options._maxAgents,
      defaultTimeout: options.timeout * 60 * 1000,
      logPath: `./swarm-runs/${swarmId}/background-tasks`,
      enablePersistence: options.persistence
    });
    // Initialize swarm memory
    const _memory = new SwarmMemoryManager({
      namespace: options._memoryNamespace,
      enableDistribution: options._distributed,
      enableKnowledgeBase: true,
      persistencePath: `./swarm-runs/${swarmId}/memory`
    });
    // Start all systems
    await coordinator.start();
    await executor.start();
    await memory.initialize();
    // Create swarm tracking directory
    const _swarmDir = `./swarm-runs/${swarmId}`;
    await Deno.mkdir(_swarmDir, { recursive: true });
    // Create objective in coordinator
    const _objectiveId = await coordinator.createObjective(_objective, options.strategy);
    
    console.log(`\n📝 Objective created with ID: ${objectiveId}`);
    // Register agents based on strategy
    const _agentTypes = getAgentTypesForStrategy(options.strategy);
    const _agents = [];
    
    for (let _i = 0; i < Math.min(options._maxAgents, agentTypes.length); i++) {
      const _agentType = agentTypes[i % agentTypes.length];
      const _agentId = await coordinator.registerAgent(
        `${agentType}-${i + 1}`,
        _agentType,
        getCapabilitiesForType(agentType)
      );
      agents.push(agentId);
      console.log(`  🤖 Registered ${agentType} agent: ${agentId}`);
    }
    // Write swarm configuration
    await fs.writeFile(`${swarmDir}/config.json`, JSON.stringify({
      _swarmId,
      _objectiveId,
      _objective,
      _options,
      _agents,
      startTime: new Date().toISOString()
    }, null, 2));
    // Start objective execution
    await coordinator.executeObjective(objectiveId);
    console.log('\n🚀 Swarm execution started...');
    if (options.background) {
      console.log(`Running in background mode. Check status with: claude-flow swarm status ${swarmId}`);
      
      // Save coordinator state and exit
      await fs.writeFile(`${swarmDir}/coordinator.json`, JSON.stringify({
        coordinatorRunning: true,
        pid: Deno._pid,
        startTime: new Date().toISOString()
      }, null, 2));
      
    } else {
      // Wait for completion in foreground
      await waitForObjectiveCompletion(_coordinator, _objectiveId, options);
      
      // Write completion status
      await fs.writeFile(`${swarmDir}/status.json`, JSON.stringify({
        status: 'completed',
        endTime: new Date().toISOString()
      }, null, 2));
      // Show summary
      const _swarmStatus = coordinator.getSwarmStatus();
      console.log('\n📊 Swarm Summary:');
      console.log(`  - Objectives: ${swarmStatus.objectives}`);
      console.log(`  - Tasks Completed: ${swarmStatus.tasks.completed}`);
      console.log(`  - Tasks Failed: ${swarmStatus.tasks.failed}`);
      console.log(`  - Agents Used: ${swarmStatus.agents.total}`);
      console.log(`  - Results saved to: ${swarmDir}`);
      success(`\n✅ Swarm ${swarmId} completed successfully`);
    }
    // Cleanup
    if (!options.background) {
      await coordinator.stop();
      await executor.stop();
      await memory.shutdown();
    }
    
  } catch (err) {
    error(`Failed to execute swarm: ${(err as Error).message}`);
  }
}
/**
 * Decompose objective into subtasks based on strategy
 */
async function decomposeObjective(objective: string, options: unknown): Promise<unknown[]> {
  const _subtasks = [];
  
  switch (options.strategy) {
    case 'research':
      {
subtasks.push(
        { type: 'research', description: `Research background information on: ${objective
}}` },
        { type: 'analysis', description: 'Analyze findings and identify key patterns' },
        { type: 'synthesis', description: 'Synthesize research into actionable insights' }
      );
      break;
      
    case 'development':
      {
subtasks.push(
        { type: 'planning', description: `Plan architecture and design for: ${objective
}}` },
        { type: 'implementation', description: 'Implement core functionality' },
        { type: 'testing', description: 'Test and validate implementation' },
        { type: 'documentation', description: 'Document the solution' }
      );
      break;
      
    case 'analysis':
      {
subtasks.push(
        { type: 'data-gathering', description: `Gather relevant data for: ${objective
}}` },
        { type: 'analysis', description: 'Perform detailed analysis' },
        { type: 'visualization', description: 'Create visualizations and reports' }
      );
      break;
      
    default: // auto
      // Analyze objective to determine best approach
      if (objective.toLowerCase().includes('build') || objective.toLowerCase().includes('create')) {
        subtasks.push(
          { type: 'planning', description: `Plan solution for: ${objective}` },
          { type: 'implementation', description: 'Implement the solution' },
          { type: 'testing', description: 'Test and validate' }
        );
      } else if (objective.toLowerCase().includes('research') || objective.toLowerCase().includes('analyze')) {
        subtasks.push(
          { type: 'research', description: `Research: ${objective}` },
          { type: 'analysis', description: 'Analyze findings' },
          { type: 'report', description: 'Generate report' }
        );
      } else {
        subtasks.push(
          { type: 'exploration', description: `Explore requirements for: ${objective}` },
          { type: 'execution', description: 'Execute main tasks' },
          { type: 'validation', description: 'Validate results' }
        );
      }
  }
  
  return subtasks;
}
/**
 * Execute tasks in parallel
 */
async function executeParallelTasks(tasks: unknown[], options: _unknown, swarmId: string, swarmDir: string) {
  const _promises = tasks.map(async (_task, index) => {
    const _agentId = generateId('agent');
    console.log(`  🤖 Spawning agent ${agentId} for: ${task.type}`);
    
    // Create agent directory
    const _agentDir = `${swarmDir}/agents/${agentId}`;
    await Deno.mkdir(_agentDir, { recursive: true });
    
    // Write agent task
    await fs.writeFile(`${agentDir}/task.json`, JSON.stringify({
      _agentId,
      _swarmId,
      _task,
      status: 'active',
      startTime: new Date().toISOString()
    }, null, 2));
    
    // Execute agent task
    await executeAgentTask(_agentId, _task, _options, agentDir);
    
    // Update status
    await fs.writeFile(`${agentDir}/status.json`, JSON.stringify({
      status: 'completed',
      endTime: new Date().toISOString()
    }, null, 2));
    
    console.log(`  ✅ Agent ${agentId} completed: ${task.type}`);
  });
  
  await Promise.all(promises);
}
/**
 * Execute tasks sequentially
 */
async function executeSequentialTasks(tasks: unknown[], options: _unknown, swarmId: string, swarmDir: string) {
  for (const [_index, task] of tasks.entries()) {
    const _agentId = generateId('agent');
    console.log(`  🤖 Spawning agent ${agentId} for: ${task.type}`);
    
    // Create agent directory
    const _agentDir = `${swarmDir}/agents/${agentId}`;
    await Deno.mkdir(_agentDir, { recursive: true });
    
    // Write agent task
    await fs.writeFile(`${agentDir}/task.json`, JSON.stringify({
      _agentId,
      _swarmId,
      _task,
      status: 'active',
      startTime: new Date().toISOString()
    }, null, 2));
    
    // Execute agent task
    await executeAgentTask(_agentId, _task, _options, agentDir);
    
    // Update status
    await fs.writeFile(`${agentDir}/status.json`, JSON.stringify({
      status: 'completed',
      endTime: new Date().toISOString()
    }, null, 2));
    
    console.log(`  ✅ Agent ${agentId} completed: ${task.type}`);
  }
}
/**
 * Execute a single agent task using claude
 */
async function executeAgentTask(agentId: string, task: _unknown, options: _any, agentDir: string) {
  console.log(`    → Executing: ${task.type} task`);
  
  try {
    // Check if claude CLI is available and not in simulation mode
    const _checkClaude = new Deno.Command('which', { args: ['claude'] });
    const _checkResult = await checkClaude.output();
    
    if (checkResult.success && options.simulate !== true) {
      // Write prompt to a file for claude to read
      const _promptFile = `${agentDir}/prompt.txt`;
      const _prompt = `You are an AI agent with ID: ${agentId}
Your task type is: ${task.type}
Your specific task is: ${task.description}
Please execute this task and provide a detailed response.
${task.type === 'research' ? 'Use web search and research tools as needed.' : ''}
${task.type === 'implementation' ? 'Write clean, well-documented code.' : ''}
${task.type === 'testing' ? 'Create comprehensive tests.' : ''}
Provide your output in a structured format.
When you're done, please end with "TASK COMPLETED" on its own line.`;
      await fs.writeFile(_promptFile, prompt);
      
      // Build claude command using bash to pipe the prompt
      let _tools = 'View,GlobTool,GrepTool,LS';
      if (task.type === 'research' || options.research) {
        tools = 'WebFetchTool,WebSearch';
      } else if (task.type === 'implementation') {
        tools = 'View,Edit,Replace,GlobTool,GrepTool,LS,Bash';
      }
      
      // Build claude command arguments for non-interactive mode
      const _claudeArgs = [
        '-p',  // Non-interactive print mode
        task.description,  // The prompt
        '--dangerously-skip-permissions',
        '--allowedTools', tools
      ];
      
      // Write command to file for tracking
      await fs.writeFile(`${agentDir}/command.txt`, `claude ${claudeArgs.join(' ')}`);
      
      console.log(`    → Running: ${task.description}`);
      
      // For real-time output, we need to capture it differently
      // First run with piped to capture for file, then run with inherit for display
      
      // Create a wrapper script that will tee the output
      const _wrapperScript = `#!/bin/bash
claude ${claudeArgs.map(arg => `"${arg}"`).join(' ')} | tee "${agentDir}/output.txt"
exit ${PIPESTATUS[0]}`;
      
      const _wrapperPath = `${agentDir}/wrapper.sh`;
      await fs.writeFile(_wrapperPath, wrapperScript);
      await Deno.chmod(_wrapperPath, 0o755);
      
      console.log('    ┌─ Claude Output ─────────────────────────────');
      
      const _command = new Deno.Command('bash', {
        args: [wrapperPath],
        stdout: 'inherit',  // This allows real-time streaming to console
        stderr: 'inherit',
      });
      
      try {
        const _process = command.spawn();
        const { code, success } = await process.status;
        
        console.log('    └─────────────────────────────────────────────');
        
        if (!success) {
          throw new Error(`Claude exited with code ${code}`);
        }
        
        console.log('    ✓ Task completed');
        
      } catch (err) {
        throw err;
      }
    } else {
      // Simulate execution if claude CLI not available
      console.log(`    → Simulating: ${task.type} (claude CLI not available)`);
      
      // For now, let's use the claude-flow claude spawn command instead
      const _claudeFlowArgs = ['claude', 'spawn', task.description];
      
      if (task.type === 'research' || options.research) {
        claudeFlowArgs.push('--research');
      }
      
      if (options.parallel) {
        claudeFlowArgs.push('--parallel');
      }
      
      console.log(`    → Using: claude-flow ${claudeFlowArgs.join(' ')}`);
      
      // Get the path to claude-flow binary
      const _claudeFlowPath = new URL(import.meta.url).pathname;
      const _projectRoot = claudeFlowPath.substring(_0, claudeFlowPath.indexOf('/src/'));
      const _claudeFlowBin = `${projectRoot}/bin/claude-flow`;
      
      // Execute claude-flow command
      const _command = new Deno.Command(_claudeFlowBin, {
        args: _claudeFlowArgs,
        stdout: 'piped',
        stderr: 'piped',
      });
      
      const { code, stdout, stderr } = await command.output();
      
      // Save output
      await fs.writeFile(`${agentDir}/output.txt`, new TextDecoder().decode(stdout));
      if (stderr.length > 0) {
        await fs.writeFile(`${agentDir}/error.txt`, new TextDecoder().decode(stderr));
      }
      
      if (code !== 0) {
        console.log(`    ⚠️  Command exited with code ${code}`);
      }
    }
  } catch (err) {
    // Log error but continue
    console.log(`    ⚠️  Error executing task: ${(err as Error).message}`);
    await fs.writeFile(`${agentDir}/error.txt`, (err as Error).message);
  }
}
function getAgentTypesForStrategy(strategy: string): ('researcher' | 'coder' | 'analyst' | 'coordinator' | 'reviewer')[] {
  switch (strategy) {
    case 'research':
      return ['researcher', 'analyst', 'coordinator'];
    case 'development':
      return ['coder', 'analyst', 'reviewer', 'coordinator'];
    case 'analysis':
      return ['analyst', 'researcher', 'coordinator'];
    default: // auto
      return ['coordinator', 'researcher', 'coder', 'analyst'];
  }
}
function getCapabilitiesForType(type: string): string[] {
  switch (type) {
    case 'researcher':
      return ['web-search', 'data-collection', 'analysis', 'documentation'];
    case 'coder':
      return ['coding', 'testing', 'debugging', 'architecture'];
    case 'analyst':
      return ['data-analysis', 'visualization', 'reporting', 'insights'];
    case 'reviewer':
      return ['code-review', 'quality-assurance', 'validation', 'testing'];
    case 'coordinator':
      return ['planning', 'coordination', 'task-management', 'communication'];
    default:
      return ['general'];
  }
}
async function waitForObjectiveCompletion(coordinator: _unknown, objectiveId: string, options: unknown): Promise<void> {
  return new Promise((resolve) => {
    const _checkInterval = setInterval(() => {
      const _objective = coordinator.getObjectiveStatus(objectiveId);
      
      if (!objective) {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      if (objective.status === 'completed' || objective.status === 'failed') {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      // Show progress if verbose
      if (options.verbose) {
        const _swarmStatus = coordinator.getSwarmStatus();
        console.log(`Progress: ${swarmStatus.tasks.completed}/${swarmStatus.tasks.total} tasks completed`);
      }
    }, 5000); // Check every 5 seconds
    // Timeout after the specified time
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⚠️  Swarm execution timed out');
      resolve();
    }, options.timeout * 60 * 1000);
  });
}