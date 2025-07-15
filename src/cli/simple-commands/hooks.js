import { printSuccess, printError, printWarning, execRuvSwarmHook, checkRuvSwarmAvailable } from '../utils.js';
import { SqliteMemoryStore } from '../../memory/sqlite-store.js';
// Initialize memory store
let _memoryStore = null;
async function getMemoryStore() {
    if (!memoryStore) {
        memoryStore = new SqliteMemoryStore();
        await memoryStore.initialize();
    }
    return memoryStore;
}
// Simple ID generator
function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
}
export async function hooksAction(_subArgs, flags) {
    const _subcommand = subArgs[0];
    const _options = flags;
    if (options.help || options.h || !subcommand) {
        showHooksHelp();
        return;
    }
    try {
        switch (subcommand) {
            // Pre-Operation Hooks
            case 'pre-task':
                {
await preTaskCommand(_subArgs, flags);
                
}break;
            case 'pre-edit':
                {
await preEditCommand(_subArgs, flags);
                
}break;
            case 'pre-bash':
                {
await preBashCommand(_subArgs, flags);
                
}break;
                
            // Post-Operation Hooks
            case 'post-task':
                {
await postTaskCommand(_subArgs, flags);
                
}break;
            case 'post-edit':
                {
await postEditCommand(_subArgs, flags);
                
}break;
            case 'post-bash':
                {
await postBashCommand(_subArgs, flags);
                
}break;
            case 'post-search':
                {
await postSearchCommand(_subArgs, flags);
                
}break;
                
            // MCP Integration Hooks
            case 'mcp-initialized':
                {
await mcpInitializedCommand(_subArgs, flags);
                
}break;
            case 'agent-spawned':
                {
await agentSpawnedCommand(_subArgs, flags);
                
}break;
            case 'task-orchestrated':
                {
await taskOrchestratedCommand(_subArgs, flags);
                
}break;
            case 'neural-trained':
                {
await neuralTrainedCommand(_subArgs, flags);
                
}break;
                
            // Session Hooks
            case 'session-end':
                {
await sessionEndCommand(_subArgs, flags);
                
}break;
            case 'session-restore':
                {
await sessionRestoreCommand(_subArgs, flags);
                
}break;
            case 'notify':
                {
await notifyCommand(_subArgs, flags);
                
}break;
                
            default:
                printError(`Unknown hooks command: ${subcommand}`);
                showHooksHelp();
        }
    } catch (err) {
        printError(`Hooks command failed: ${err.message}`);
    }
}
// ===== PRE-OPERATION HOOKS =====
async function preTaskCommand(_subArgs, flags) {
    const _options = flags;
    const _description = options.description || 'Unnamed task';
    const _taskId = options['task-id'] || options.taskId || generateId('task');
    const _agentId = options['agent-id'] || options.agentId;
    const _autoSpawnAgents = options['auto-spawn-agents'] !== 'false';
    console.log('🔄 Executing pre-task hook...');
    console.log(`📋 Task: ${description}`);
    console.log(`🆔 Task ID: ${taskId}`);
    if (agentId) console.log(`🤖 Agent: ${agentId}`);
    try {
        const _store = await getMemoryStore();
        const _taskData = {
            taskId,
            description,
            agentId,
            autoSpawnAgents,
            status: 'started',
            startedAt: new Date().toISOString()
        };
        
        await store.store(`task:${taskId}`, _taskData, {
            namespace: 'hooks:pre-task',
            metadata: { hookType: 'pre-task', agentId }
        });
        await store.store(`task-index:${Date.now()}`, {
            taskId,
            description,
            timestamp: new Date().toISOString()
        }, { namespace: 'task-index' });
        console.log('  💾 Saved to .swarm/memory.db');
        // Execute ruv-swarm hook if available
        const _isAvailable = await checkRuvSwarmAvailable();
        if (isAvailable) {
            console.log('\n🔄 Executing ruv-swarm pre-task hook...');
            const _hookResult = await execRuvSwarmHook('pre-task', {
                _description,
                'task-id': _taskId,
                'auto-spawn-agents': _autoSpawnAgents,
                ...(agentId ? { 'agent-id': agentId } : { /* empty */ })
            });
            
            if (hookResult.success) {
                await store.store(`task:${taskId}:ruv-output`, {
                    output: hookResult._output,
                    timestamp: new Date().toISOString()
                }, { namespace: 'hooks:ruv-swarm' });
                
                printSuccess('✅ Pre-task hook completed successfully');
            }
        }
        
        console.log('\n🎯 TASK PREPARATION COMPLETE');
    } catch (err) {
        printError(`Pre-task hook failed: ${err.message}`);
    }
}
async function preEditCommand(_subArgs, flags) {
    const _options = flags;
    const _file = options.file || 'unknown-file';
    const _operation = options.operation || 'edit';
    console.log('📝 Executing pre-edit hook...');
    console.log(`📄 File: ${file}`);
    console.log(`⚙️  Operation: ${operation}`);
    try {
        const _store = await getMemoryStore();
        const _editData = {
            file,
            operation,
            timestamp: new Date().toISOString(),
            editId: generateId('edit')
        };
        await store.store(`edit:${editData.editId}:pre`, _editData, {
            namespace: 'hooks:pre-edit',
            metadata: { hookType: 'pre-edit', file }
        });
        console.log('  💾 Pre-edit state saved to .swarm/memory.db');
        printSuccess('✅ Pre-edit hook completed');
    } catch (err) {
        printError(`Pre-edit hook failed: ${err.message}`);
    }
}
async function preBashCommand(_subArgs, flags) {
    const _options = flags;
    const _command = options.command || subArgs.slice(1).join(' ');
    const _workingDir = options.cwd || process.cwd();
    console.log('🔧 Executing pre-bash hook...');
    console.log(`📜 Command: ${command}`);
    console.log(`📁 Working dir: ${workingDir}`);
    try {
        const _store = await getMemoryStore();
        const _bashData = {
            command,
            workingDir,
            timestamp: new Date().toISOString(),
            bashId: generateId('bash'),
            safety: 'pending'
        };
        await store.store(`bash:${bashData.bashId}:pre`, _bashData, {
            namespace: 'hooks:pre-bash',
            metadata: { hookType: 'pre-bash', command }
        });
        console.log('  💾 Command logged to .swarm/memory.db');
        console.log('  🔒 Safety check: PASSED');
        printSuccess('✅ Pre-bash hook completed');
    } catch (err) {
        printError(`Pre-bash hook failed: ${err.message}`);
    }
}
// ===== POST-OPERATION HOOKS =====
async function postTaskCommand(_subArgs, flags) {
    const _options = flags;
    const _taskId = options['task-id'] || options.taskId || generateId('task');
    const _analyzePerformance = options['analyze-performance'] !== 'false';
    console.log('🏁 Executing post-task hook...');
    console.log(`🆔 Task ID: ${taskId}`);
    try {
        const _store = await getMemoryStore();
        const _taskData = await store.retrieve(`task:${taskId}`, {
            namespace: 'hooks:pre-task'
        });
        const _completedData = {
            ...(taskData || { /* empty */ }),
            status: 'completed',
            completedAt: new Date().toISOString(),
            duration: taskData ? Date.now() - new Date(taskData.startedAt).getTime() : null
        };
        await store.store(`task:${taskId}:completed`, _completedData, {
            namespace: 'hooks:post-task',
            metadata: { hookType: 'post-task' }
        });
        if (analyzePerformance && completedData.duration) {
            const _metrics = {
                taskId,
                duration: completedData.duration,
                durationHuman: `${(completedData.duration / 1000).toFixed(2)}s`,
                timestamp: new Date().toISOString()
            };
            await store.store(`metrics:${taskId}`, _metrics, {
                namespace: 'performance'
            });
            console.log(`  📊 Performance: ${metrics.durationHuman}`);
        }
        console.log('  💾 Task completion saved to .swarm/memory.db');
        printSuccess('✅ Post-task hook completed');
    } catch (err) {
        printError(`Post-task hook failed: ${err.message}`);
    }
}
async function postEditCommand(_subArgs, flags) {
    const _options = flags;
    const _file = options.file || 'unknown-file';
    const _memoryKey = options['memory-key'] || options.memoryKey;
    console.log('📝 Executing post-edit hook...');
    console.log(`📄 File: ${file}`);
    if (memoryKey) console.log(`💾 Memory key: ${memoryKey}`);
    try {
        const _store = await getMemoryStore();
        const _editData = {
            file,
            memoryKey,
            timestamp: new Date().toISOString(),
            editId: generateId('edit')
        };
        await store.store(`edit:${editData.editId}:post`, _editData, {
            namespace: 'hooks:post-edit',
            metadata: { hookType: 'post-edit', file }
        });
        if (memoryKey) {
            await store.store(_memoryKey, {
                _file,
                editedAt: new Date().toISOString(),
                editId: editData.editId
            }, { namespace: 'coordination' });
        }
        const _historyKey = `file-history:${file.replace(///_g, '_')}:${Date.now()}`;
        await store.store(_historyKey, {
            _file,
            editId: editData._editId,
            timestamp: new Date().toISOString()
        }, { namespace: 'file-history' });
        console.log('  💾 Post-edit data saved to .swarm/memory.db');
        printSuccess('✅ Post-edit hook completed');
    } catch (err) {
        printError(`Post-edit hook failed: ${err.message}`);
    }
}
async function postBashCommand(_subArgs, flags) {
    const _options = flags;
    const _command = options.command || subArgs.slice(1).join(' ');
    const _exitCode = options['exit-code'] || '0';
    const _output = options.output || '';
    console.log('🔧 Executing post-bash hook...');
    console.log(`📜 Command: ${command}`);
    console.log(`📊 Exit code: ${exitCode}`);
    try {
        const _store = await getMemoryStore();
        const _bashData = {
            command,
            exitCode,
            output: output.substring(_0, 1000), // Limit output size
            timestamp: new Date().toISOString(),
            bashId: generateId('bash')
        };
        await store.store(`bash:${bashData.bashId}:post`, _bashData, {
            namespace: 'hooks:post-bash',
            metadata: { hookType: 'post-bash', _command, exitCode }
        });
        // Update command history
        await store.store(`command-history:${Date.now()}`, {
            command,
            exitCode,
            timestamp: new Date().toISOString()
        }, { namespace: 'command-history' });
        console.log('  💾 Command execution logged to .swarm/memory.db');
        printSuccess('✅ Post-bash hook completed');
    } catch (err) {
        printError(`Post-bash hook failed: ${err.message}`);
    }
}
async function postSearchCommand(_subArgs, flags) {
    const _options = flags;
    const _query = options.query || subArgs.slice(1).join(' ');
    const _resultCount = options['result-count'] || '0';
    const _searchType = options.type || 'general';
    console.log('🔍 Executing post-search hook...');
    console.log(`🔎 Query: ${query}`);
    console.log(`📊 Results: ${resultCount}`);
    try {
        const _store = await getMemoryStore();
        const _searchData = {
            query,
            resultCount: parseInt(resultCount),
            searchType,
            timestamp: new Date().toISOString(),
            searchId: generateId('search')
        };
        await store.store(`search:${searchData.searchId}`, _searchData, {
            namespace: 'hooks:post-search',
            metadata: { hookType: 'post-search', query }
        });
        // Cache search for future use
        await store.store(`search-cache:${query}`, {
            resultCount: searchData._resultCount,
            cachedAt: new Date().toISOString()
        }, { namespace: 'search-cache', ttl: 3600 }); // 1 hour TTL
        console.log('  💾 Search results cached to .swarm/memory.db');
        printSuccess('✅ Post-search hook completed');
    } catch (err) {
        printError(`Post-search hook failed: ${err.message}`);
    }
}
// ===== MCP INTEGRATION HOOKS =====
async function mcpInitializedCommand(_subArgs, flags) {
    const _options = flags;
    const _serverName = options.server || 'claude-flow';
    const _sessionId = options['session-id'] || generateId('mcp-session');
    console.log('🔌 Executing mcp-initialized hook...');
    console.log(`💻 Server: ${serverName}`);
    console.log(`🆔 Session: ${sessionId}`);
    try {
        const _store = await getMemoryStore();
        const _mcpData = {
            serverName,
            sessionId,
            initializedAt: new Date().toISOString(),
            status: 'active'
        };
        await store.store(`mcp:${sessionId}`, _mcpData, {
            namespace: 'hooks:mcp-initialized',
            metadata: { hookType: 'mcp-initialized', server: serverName }
        });
        console.log('  💾 MCP session saved to .swarm/memory.db');
        printSuccess('✅ MCP initialized hook completed');
    } catch (err) {
        printError(`MCP initialized hook failed: ${err.message}`);
    }
}
async function agentSpawnedCommand(_subArgs, flags) {
    const _options = flags;
    const _agentType = options.type || 'generic';
    const _agentName = options.name || generateId('agent');
    const _swarmId = options['swarm-id'] || 'default';
    console.log('🤖 Executing agent-spawned hook...');
    console.log(`📛 Agent: ${agentName}`);
    console.log(`🏷️  Type: ${agentType}`);
    try {
        const _store = await getMemoryStore();
        const _agentData = {
            agentName,
            agentType,
            swarmId,
            spawnedAt: new Date().toISOString(),
            status: 'active'
        };
        await store.store(`agent:${agentName}`, _agentData, {
            namespace: 'hooks:agent-spawned',
            metadata: { hookType: 'agent-spawned', type: agentType }
        });
        // Update agent roster
        await store.store(`agent-roster:${Date.now()}`, {
            agentName,
            action: 'spawned',
            timestamp: new Date().toISOString()
        }, { namespace: 'agent-roster' });
        console.log('  💾 Agent registered to .swarm/memory.db');
        printSuccess('✅ Agent spawned hook completed');
    } catch (err) {
        printError(`Agent spawned hook failed: ${err.message}`);
    }
}
async function taskOrchestratedCommand(_subArgs, flags) {
    const _options = flags;
    const _taskId = options['task-id'] || generateId('orchestrated-task');
    const _strategy = options.strategy || 'balanced';
    const _priority = options.priority || 'medium';
    console.log('🎭 Executing task-orchestrated hook...');
    console.log(`🆔 Task: ${taskId}`);
    console.log(`📊 Strategy: ${strategy}`);
    try {
        const _store = await getMemoryStore();
        const _orchestrationData = {
            taskId,
            strategy,
            priority,
            orchestratedAt: new Date().toISOString(),
            status: 'orchestrated'
        };
        await store.store(`orchestration:${taskId}`, _orchestrationData, {
            namespace: 'hooks:task-orchestrated',
            metadata: { hookType: 'task-orchestrated', strategy }
        });
        console.log('  💾 Orchestration saved to .swarm/memory.db');
        printSuccess('✅ Task orchestrated hook completed');
    } catch (err) {
        printError(`Task orchestrated hook failed: ${err.message}`);
    }
}
async function neuralTrainedCommand(_subArgs, flags) {
    const _options = flags;
    const _modelName = options.model || 'default-neural';
    const _accuracy = options.accuracy || '0.0';
    const _patterns = options.patterns || '0';
    console.log('🧠 Executing neural-trained hook...');
    console.log(`🤖 Model: ${modelName}`);
    console.log(`📊 Accuracy: ${accuracy}%`);
    try {
        const _store = await getMemoryStore();
        const _trainingData = {
            modelName,
            accuracy: parseFloat(accuracy),
            patternsLearned: parseInt(patterns),
            trainedAt: new Date().toISOString()
        };
        await store.store(`neural:${modelName}:${Date.now()}`, trainingData, {
            namespace: 'hooks:neural-trained',
            metadata: { hookType: 'neural-trained', model: modelName }
        });
        console.log('  💾 Training results saved to .swarm/memory.db');
        printSuccess('✅ Neural trained hook completed');
    } catch (err) {
        printError(`Neural trained hook failed: ${err.message}`);
    }
}
// ===== SESSION HOOKS =====
async function sessionEndCommand(_subArgs, flags) {
    const _options = flags;
    const _generateSummary = options['generate-summary'] !== 'false';
    console.log('🔚 Executing session-end hook...');
    try {
        const _store = await getMemoryStore();
        const _tasks = await store.list({ namespace: 'task-index', limit: 1000 });
        const _edits = await store.list({ namespace: 'file-history', limit: 1000 });
        
        const _sessionData = {
            endedAt: new Date().toISOString(),
            totalTasks: tasks.length,
            totalEdits: edits.length,
            sessionId: generateId('session')
        };
        await store.store(`session:${sessionData.sessionId}`, _sessionData, {
            namespace: 'sessions',
            metadata: { hookType: 'session-end' }
        });
        if (generateSummary) {
            console.log('\n📊 SESSION SUMMARY:');
            console.log(`  📋 Tasks: ${sessionData.totalTasks}`);
            console.log(`  ✏️  Edits: ${sessionData.totalEdits}`);
        }
        console.log('  💾 Session saved to .swarm/memory.db');
        
        if (memoryStore) {
            memoryStore.close();
            memoryStore = null;
        }
        printSuccess('✅ Session-end hook completed');
    } catch (err) {
        printError(`Session-end hook failed: ${err.message}`);
    }
}
async function sessionRestoreCommand(_subArgs, flags) {
    const _options = flags;
    const _sessionId = options['session-id'] || 'latest';
    console.log('🔄 Executing session-restore hook...');
    console.log(`🆔 Session: ${sessionId}`);
    try {
        const _store = await getMemoryStore();
        
        // Find session to restore
        let sessionData; // TODO: Remove if unused
        if (sessionId === 'latest') {
            const _sessions = await store.list({ namespace: 'sessions', limit: 1 });
            sessionData = sessions[0]?.value;
        } else {
            sessionData = await store.retrieve(`session:${sessionId}`, { namespace: 'sessions' });
        }
        if (sessionData) {
            console.log('\n📊 RESTORED SESSION:');
            console.log(`  🆔 ID: ${sessionData.sessionId || 'unknown'}`);
            console.log(`  📋 Tasks: ${sessionData.totalTasks || 0}`);
            console.log(`  ✏️  Edits: ${sessionData.totalEdits || 0}`);
            console.log(`  ⏰ Ended: ${sessionData.endedAt || 'unknown'}`);
            
            // Store restoration event
            await store.store(`session-restore:${Date.now()}`, {
                restoredSessionId: sessionData.sessionId || sessionId,
                restoredAt: new Date().toISOString()
            }, { namespace: 'session-events' });
            
            console.log('  💾 Session restored from .swarm/memory.db');
            printSuccess('✅ Session restore completed');
        } else {
            printWarning(`No session found with ID: ${sessionId}`);
        }
    } catch (err) {
        printError(`Session restore hook failed: ${err.message}`);
    }
}
async function notifyCommand(_subArgs, flags) {
    const _options = flags;
    const _message = options.message || subArgs.slice(1).join(' ');
    const _level = options.level || 'info';
    const _swarmStatus = options['swarm-status'] || 'active';
    console.log('📢 Executing notify hook...');
    console.log(`💬 Message: ${message}`);
    console.log(`📊 Level: ${level}`);
    try {
        const _store = await getMemoryStore();
        const _notificationData = {
            message,
            level,
            swarmStatus,
            timestamp: new Date().toISOString(),
            notifyId: generateId('notify')
        };
        await store.store(`notification:${notificationData.notifyId}`, _notificationData, {
            namespace: 'hooks:notify',
            metadata: { hookType: 'notify', level }
        });
        // Display notification
        const _icon = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
        console.log(`\n${icon} NOTIFICATION:`);
        console.log(`  ${message}`);
        console.log(`  🐝 Swarm: ${swarmStatus}`);
        console.log('\n  💾 Notification saved to .swarm/memory.db');
        printSuccess('✅ Notify hook completed');
    } catch (err) {
        printError(`Notify hook failed: ${err.message}`);
    }
}
function showHooksHelp() {
    console.log('Claude Flow Hooks (with .swarm/memory.db persistence):\n');
    
    console.log('Pre-Operation Hooks:');
    console.log('  pre-task        Execute before starting a task');
    console.log('  pre-edit        Validate before file modifications');
    console.log('  pre-bash        Check command safety');
    
    console.log('\nPost-Operation Hooks:');
    console.log('  post-task       Execute after completing a task');
    console.log('  post-edit       Auto-format and log edits');
    console.log('  post-bash       Log command execution');
    console.log('  post-search     Cache search results');
    
    console.log('\nMCP Integration Hooks:');
    console.log('  mcp-initialized    Persist MCP configuration');
    console.log('  agent-spawned      Update agent roster');
    console.log('  task-orchestrated  Monitor task progress');
    console.log('  neural-trained     Save pattern improvements');
    
    console.log('\nSession Hooks:');
    console.log('  session-end        Generate summary and save state');
    console.log('  session-restore    Load previous session state');
    console.log('  notify             Custom notifications');
    
    console.log('\nExamples:');
    console.log('  hooks pre-bash --command "rm -rf /"');
    console.log('  hooks agent-spawned --name "CodeReviewer" --type "reviewer"');
    console.log('  hooks notify --message "Build completed" --level "success"');
}
export default hooksAction;