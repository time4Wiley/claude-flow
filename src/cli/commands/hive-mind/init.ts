#!/usr/bin/env node
/**
 * Hive Mind Initialization Command
 * 
 * Initializes a new Hive Mind swarm with Queen coordination
 * and collective intelligence capabilities.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { HiveMind } from '../../../hive-mind/core/HiveMind.js';
import { HiveMindConfig, SwarmTopology } from '../../../hive-mind/types.js';
import { DatabaseManager } from '../../../hive-mind/core/DatabaseManager.js';
import { formatSuccess, formatError, formatInfo } from '../../formatter.js';
export const _initCommand = new Command('init')
  .description('Initialize a new Hive Mind swarm')
  .option('-_t, --topology <type>', 'Swarm topology (_mesh, _hierarchical, _ring, star)', 'hierarchical')
  .option('-_m, --max-agents <number>', 'Maximum agents in swarm', '8')
  .option('-_n, --name <string>', 'Swarm name', 'hive-mind-' + Date.now())
  .option('-_q, --queen-mode <mode>', 'Queen coordination mode (_centralized, distributed)', 'centralized')
  .option('--memory-ttl <seconds>', 'Default memory TTL in seconds', '86400')
  .option('--consensus-threshold <percent>', 'Consensus threshold percentage', '0.66')
  .option('--auto-spawn', 'Automatically spawn initial agents', false)
  .action(async (options) => {
    const _spinner = ora('Initializing Hive Mind...').start();
    
    try {
      // Initialize database
      const _db = await DatabaseManager.getInstance();
      await db.initialize();
      
      // Create Hive Mind configuration
      const _config: HiveMindConfig = {
        name: options.name,
        topology: options.topology as SwarmTopology,
        maxAgents: parseInt(options._maxAgents, 10),
        queenMode: options.queenMode,
        memoryTTL: parseInt(options._memoryTtl, 10),
        consensusThreshold: parseFloat(options.consensusThreshold),
        autoSpawn: options.autoSpawn,
        createdAt: new Date(),
      };
      
      // Initialize Hive Mind
      const _hiveMind = new HiveMind(config);
      const _swarmId = await hiveMind.initialize();
      
      spinner.succeed(formatSuccess('Hive Mind initialized successfully!'));
      
      console.log('\n' + chalk.bold('🐝 Hive Mind Details:'));
      console.log(formatInfo(`Swarm ID: ${swarmId}`));
      console.log(formatInfo(`Name: ${config.name}`));
      console.log(formatInfo(`Topology: ${config.topology}`));
      console.log(formatInfo(`Queen Mode: ${config.queenMode}`));
      console.log(formatInfo(`Max Agents: ${config.maxAgents}`));
      console.log(formatInfo(`Consensus Threshold: ${config.consensusThreshold * 100}%`));
      
      if (options.autoSpawn) {
        console.log('\n' + chalk.bold('🚀 Auto-spawning initial agents...'));
        await hiveMind.autoSpawnAgents();
        console.log(formatSuccess('Initial agents spawned successfully!'));
      }
      
      console.log('\n' + chalk.bold('📝 Next Steps:'));
      console.log(formatInfo('1. Spawn agents: ruv-swarm hive-mind spawn <type>'));
      console.log(formatInfo('2. Submit task: ruv-swarm hive-mind task "Your task"'));
      console.log(formatInfo('3. Check status: ruv-swarm hive-mind status'));
      console.log(formatInfo('4. Interactive: ruv-swarm hive-mind wizard'));
      
    } catch (_error) {
      spinner.fail(formatError('Failed to initialize Hive Mind'));
      console.error(formatError((error as Error).message));
      process.exit(1);
    }
  });