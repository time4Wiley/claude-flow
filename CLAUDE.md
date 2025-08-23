# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Development server
npm run dev                    # Run TypeScript development server
npm run dev:build             # Watch mode for TypeScript compilation

# Build
npm run build                 # Full build (clean + compile ESM/CJS + binary)
npm run build:esm            # Build ES modules only
npm run build:cjs            # Build CommonJS modules only
npm run typecheck            # Type checking without emitting files

# Testing
npm test                     # Run all tests (Jest with experimental VM modules)
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests only
npm run test:coverage      # Run tests with coverage report
npm run test:watch         # Watch mode for tests
npm run test:debug         # Debug tests with inspector

# Quality
npm run lint               # ESLint with max-warnings 0
npm run format            # Prettier formatting

# Publishing
npm run publish:alpha     # Publish alpha version
```

### Single Test Execution
```bash
# Run a specific test file
NODE_OPTIONS='--experimental-vm-modules' jest src/__tests__/unit/specific.test.ts

# Run tests matching pattern
NODE_OPTIONS='--experimental-vm-modules' jest --testNamePattern='Health'
```

## Architecture Overview

### Core System Design
Claude-Flow is an AI agent orchestration platform built on:
- **Hive-Mind Architecture**: Queen-led coordination with specialized worker agents
- **MCP Integration**: 87+ Model Context Protocol tools for Claude Code
- **SPARC Methodology**: Systematic development phases (Specification → Pseudocode → Architecture → Refinement → Code)
- **Swarm Intelligence**: Multiple coordination topologies (hierarchical, mesh, hybrid)
- **SQLite Memory**: Persistent `.swarm/memory.db` with cross-session state

### Module Structure

#### `/src/cli/` - Command Line Interface
- `main.ts`: Primary entry point for TypeScript CLI
- `simple-cli.js`: Simplified JavaScript fallback
- `cli-core.ts`: Core CLI infrastructure with command registry

#### `/src/swarm/` - Swarm Orchestration
- `coordinator.ts`: Main swarm coordination logic
- `executor.ts`: Task execution engine
- `prompt-copier.ts`: Intelligent prompt management
- `claude-code-interface.ts`: Claude Code integration layer

#### `/src/mcp/` - Model Context Protocol
- `server.ts`: MCP server implementation
- `tools.ts`: Tool definitions and routing
- `ruv-swarm-tools.ts`: Ruv-swarm integration
- `sparc-modes.ts`: SPARC mode implementations

#### `/src/memory/` - Memory Management
- `sqlite-store.js`: SQLite persistence layer with automatic fallback
- `swarm-memory.ts`: Distributed memory coordination
- `enhanced-memory.js`: Advanced memory operations
- Windows: Automatic fallback to in-memory storage if SQLite fails

#### `/src/coordination/` - Task Coordination
- `hive-orchestrator.ts`: Hive-mind coordination
- `scheduler.ts`: Task scheduling and prioritization
- `load-balancer.ts`: Resource distribution
- `conflict-resolution.ts`: Consensus mechanisms

#### `/src/verification/` - Verification Pipeline
- `verification-pipeline.ts`: Main verification orchestrator
- `truth-scorer.ts`: Agent output validation
- `rollback-engine.ts`: Automatic rollback on failures

## Key Architectural Patterns

### Concurrent Execution
**CRITICAL**: Always batch operations in a single message for performance:
```javascript
// ✅ CORRECT - All operations in one message
TodoWrite({ todos: [multiple todos] })
Task("agent1"), Task("agent2"), Task("agent3")
Read("file1"), Read("file2"), Write("file3")

// ❌ WRONG - Sequential messages (6x slower)
```

### Agent Spawning Pattern
```bash
# Basic swarm spawn
npx claude-flow@alpha swarm "task description" --claude

# Hive-mind with specific agents
npx claude-flow@alpha hive-mind spawn "task" --agents 8 --strategy parallel
```

### Memory Namespace Pattern
```bash
# Store with namespace
npx claude-flow@alpha memory store "key" "value" --namespace project

# Query with namespace
npx claude-flow@alpha memory query "pattern" --namespace project
```

## SPARC Mode Integration

Each SPARC mode provides specialized execution environments:
- **orchestrator**: Multi-agent coordination for complex tasks
- **coder**: Direct implementation with best practices
- **architect**: System design and architecture planning
- **tdd**: Test-driven development with London School methodology
- **researcher**: Deep research with web integration
- **analyst**: Code and performance analysis

Usage:
```bash
npx claude-flow sparc run <mode> "task description"
npx claude-flow sparc batch <modes> "task"  # Parallel execution
npx claude-flow sparc pipeline "task"       # Full SPARC pipeline
```

## Error Handling & Recovery

### SQLite Fallback (Windows)
The system automatically handles SQLite module failures:
1. Attempts native SQLite first
2. Falls back to in-memory storage if unavailable
3. All features remain functional (without persistence)

### Session Recovery
```bash
# Resume previous session
npx claude-flow@alpha hive-mind resume <session-id>

# Check session status
npx claude-flow@alpha hive-mind status
```

## MCP Server Configuration

The project includes comprehensive MCP integration:
- Auto-configures during `init --force`
- Provides 87+ tools to Claude Code
- Handles swarm orchestration, memory, and workflow automation

Key MCP tools:
- `mcp__claude-flow__swarm_init`: Initialize swarm topology
- `mcp__claude-flow__agent_spawn`: Create specialized agents
- `mcp__claude-flow__task_orchestrate`: Coordinate tasks
- `mcp__claude-flow__memory_usage`: Memory operations

## Performance Considerations

### Token Optimization
- Batch file operations to reduce context usage
- Use Task tool for complex searches
- Enable memory compression for large contexts

### Resource Management
- Default agent limit: 10 concurrent agents
- Memory namespace isolation for project separation
- Automatic garbage collection for completed sessions

## Testing Strategy

### Test Organization
- Unit tests: `/src/__tests__/unit/`
- Integration tests: `/src/__tests__/integration/`
- E2E tests: `/src/__tests__/e2e/`
- Performance tests: `/src/__tests__/performance/`

### Test Utilities
- Mocks in `/tests/mocks/`
- Fixtures in `/tests/fixtures/`
- Test utilities in `/tests/utils/`

## Common Development Tasks

### Adding a New SPARC Mode
1. Create mode definition in `/src/mcp/sparc-modes.ts`
2. Add executor in `/src/swarm/sparc-executor.ts`
3. Register in CLI commands
4. Add tests in `/src/__tests__/unit/`

### Creating a New Agent Type
1. Define agent in `/src/constants/agent-types.ts`
2. Implement loader in `/src/agents/agent-loader.ts`
3. Add to registry in `/src/agents/agent-registry.ts`
4. Create tests

### Implementing MCP Tools
1. Define tool in `/src/mcp/tools.ts`
2. Add implementation in relevant module
3. Update router in `/src/mcp/router.ts`
4. Document in `/docs/MCP_TOOLS.md`

## Debugging Tips

### Enable Verbose Logging
```bash
export DEBUG=claude-flow:*
export VERBOSE=true
```

### Check Memory State
```bash
npx claude-flow@alpha memory stats
npx claude-flow@alpha memory list
```

### Monitor Swarm Activity
```bash
npx claude-flow@alpha swarm monitor --real-time
```

## Cross-Platform Considerations

### Windows
- SQLite may require Visual Studio Build Tools
- Automatic fallback to in-memory storage
- Use `pnpm` instead of `npm` for better native module handling

### Node.js Requirements
- Minimum: Node.js 20.0.0
- ES modules with experimental VM support
- TypeScript 5.3.3+

## CI/CD Integration

GitHub Actions workflows handle:
- Automated testing on PR
- Alpha releases on merge to main
- Performance regression detection
- Cross-platform validation

## Important Files

- `/bin/claude-flow.js`: Main dispatcher with runtime detection
- `/src/cli/simple-cli.js`: Fallback CLI implementation
- `/.swarm/memory.db`: SQLite memory storage
- `/.hive-mind/config.json`: Hive-mind configuration
- `/memory/sessions/`: Session persistence data