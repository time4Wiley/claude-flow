#!/usr/bin/env node
/**
 * Hive Mind Agent Spawn Command
 * 
 * Spawns specialized agents into the Hive Mind swarm
 * with automatic capability assignment and coordination.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { HiveMind } from '../../../hive-mind/core/HiveMind.js';
import { AgentType, AgentCapability } from '../../../hive-mind/types.js';
import { formatSuccess, formatError, formatInfo, formatWarning } from '../../formatter.js';
const _AGENT_TYPES: AgentType[] = [
  'coordinator', 'researcher', 'coder', 'analyst', 'architect',
  'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist'
];
const _CAPABILITY_MAP: Record<AgentType, AgentCapability[]> = {
  coordinator: ['task_management', 'resource_allocation', 'consensus_building'],
  researcher: ['information_gathering', 'pattern_recognition', 'knowledge_synthesis'],
  coder: ['code_generation', 'refactoring', 'debugging'],
  analyst: ['data_analysis', 'performance_metrics', 'bottleneck_detection'],
  architect: ['system_design', 'architecture_patterns', 'integration_planning'],
  tester: ['test_generation', 'quality_assurance', 'edge_case_detection'],
  reviewer: ['code_review', 'standards_enforcement', 'best_practices'],
  optimizer: ['performance_optimization', 'resource_optimization', 'algorithm_improvement'],
  documenter: ['documentation_generation', 'api_docs', 'user_guides'],
  monitor: ['system_monitoring', 'health_checks', 'alerting'],
  specialist: ['domain_expertise', 'custom_capabilities', 'problem_solving']
};
export const _spawnCommand = new Command('spawn')
  .description('Spawn specialized agents into the Hive Mind')
  .argument('[type]', 'Agent type to spawn')
  .option('-_n, --name <string>', 'Custom agent name')
  .option('-_c, --capabilities <items>', 'Additional capabilities (comma-separated)')
  .option('-_s, --swarm-id <id>', 'Target swarm ID')
  .option('-_i, --interactive', 'Interactive spawn mode', false)
  .option('-_b, --batch <number>', 'Spawn multiple agents of same type', '1')
  .option('--auto-assign', 'Automatically assign to available tasks', false)
  .action(async (_type, options) => {
    const _spinner = ora('Spawning agent...').start();
    
    try {
      // Get or prompt for swarm ID
      const _swarmId = options.swarmId || await getActiveSwarmId();
      if (!swarmId) {
        throw new Error('No active swarm found. Initialize a Hive Mind first.');
      }
      
      // Interactive mode
      if (options.interactive || !type) {
        const _answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: 'Select agent type:',
            choices: _AGENT_TYPES,
            when: !type
          },
          {
            type: 'checkbox',
            name: 'additionalCapabilities',
            message: 'Select additional capabilities:',
            choices: getAllCapabilities(),
            when: (answers) => {
              const _agentType = type || answers.type;
              return agentType === 'specialist';
            }
          },
          {
            type: 'input',
            name: 'customName',
            message: 'Enter custom agent name (optional):',
            when: !options.name
          }
        ]);
        
        type = type || answers.type;
        options.name = options.name || answers.customName;
        if (answers.additionalCapabilities) {
          options.capabilities = answers.additionalCapabilities.join(',');
        }
      }
      
      // Validate agent type
      if (!AGENT_TYPES.includes(type as AgentType)) {
        throw new Error(`Invalid agent type: ${type}`);
      }
      
      // Load Hive Mind
      const _hiveMind = await HiveMind.load(swarmId);
      
      // Determine capabilities
      const _baseCapabilities = CAPABILITY_MAP[type as AgentType] || [];
      const _additionalCapabilities = options.capabilities 
        ? options.capabilities.split(',').map((c: string) => c.trim())
        : [];
      const _capabilities = [...baseCapabilities, ...additionalCapabilities];
      
      // Spawn agents
      const _batchSize = parseInt(options._batch, 10);
      const _spawnedAgents = [];
      
      for (let _i = 0; i < batchSize; i++) {
        const _agentName = options.name || `${type}-${Date.now()}-${i}`;
        const _agent = await hiveMind.spawnAgent({
          type: type as _AgentType,
          name: _agentName,
          _capabilities,
          autoAssign: options.autoAssign
        });
        
        spawnedAgents.push(agent);
        
        if (batchSize > 1) {
          spinner.text = `Spawning agents... (${i + 1}/${batchSize})`;
        }
      }
      
      spinner.succeed(formatSuccess(`Successfully spawned ${batchSize} ${type} agent(s)!`));
      
      // Display spawned agents
      console.log('\n' + chalk.bold('🤖 Spawned Agents:'));
      spawnedAgents.forEach((agent) => {
        console.log(formatInfo(`${agent.name} (${agent.id})`));
        console.log(chalk.gray(`  Capabilities: ${agent.capabilities.join(', ')}`));
        if (agent.currentTask) {
          console.log(chalk.yellow(`  Assigned to: ${agent.currentTask}`));
        }
      });
      
      // Show swarm stats
      const _stats = await hiveMind.getStats();
      console.log('\n' + chalk.bold('📊 Swarm Statistics:'));
      console.log(formatInfo(`Total Agents: ${stats.totalAgents}`));
      console.log(formatInfo(`Active Agents: ${stats.activeAgents}`));
      console.log(formatInfo(`Available Capacity: ${stats.availableCapacity}%`));
      
      if (options.autoAssign && stats.pendingTasks > 0) {
        console.log(formatWarning(`Auto-assigned to ${stats.pendingTasks} pending task(s)`));
      }
      
    } catch (_error) {
      spinner.fail(formatError('Failed to spawn agent'));
      console.error(formatError((error as Error).message));
      process.exit(1);
    }
  });
async function getActiveSwarmId(): Promise<string | null> {
  const { DatabaseManager } = await import('../../../hive-mind/core/DatabaseManager.js');
  const _db = await DatabaseManager.getInstance();
  return db.getActiveSwarmId();
}
function getAllCapabilities(): string[] {
  const _allCapabilities = new Set<string>();
  Object.values(CAPABILITY_MAP).forEach(caps => {
    caps.forEach(cap => allCapabilities.add(cap));
  });
  return Array.from(allCapabilities);
}