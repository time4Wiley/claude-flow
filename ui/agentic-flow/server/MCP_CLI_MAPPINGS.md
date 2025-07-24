# MCP Tool CLI Command Mappings

This document provides the complete CLI command mappings for all 87 MCP tools in Claude Flow.

## Overview

The MCP handler translates tool names to CLI commands following these patterns:
- Tool names with underscores (`_`) typically map to space-separated commands
- Parameters are passed as command-line flags
- Array parameters are joined with commas
- Object parameters are JSON-stringified

## Complete Tool Mappings

### Coordination Tools (9 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `swarm_init` | `swarm initialize-swarm` | `npx claude-flow@alpha swarm initialize-swarm --topology mesh --max-agents 8` |
| `agent_spawn` | `agent spawn` | `npx claude-flow@alpha agent spawn --type coder --name "API Dev"` |
| `task_orchestrate` | `swarm [task]` | `npx claude-flow@alpha swarm "Build REST API" --strategy parallel` |
| `task_status` | `task status` | `npx claude-flow@alpha task status task-123 --history` |
| `task_results` | `task results` | `npx claude-flow@alpha task results task-123 --format json` |
| `swarm_status` | `swarm status` | `npx claude-flow@alpha swarm status --verbose` |
| `swarm_monitor` | `swarm monitor` | `npx claude-flow@alpha swarm monitor --duration 60` |
| `coordination_optimize` | `swarm optimize-coordination` | `npx claude-flow@alpha swarm optimize-coordination --metric speed` |
| `swarm_broadcast` | `swarm broadcast` | `npx claude-flow@alpha swarm broadcast "Update status" --agents agent-1,agent-2` |

### Neural Tools (15 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `neural_status` | `training status` | `npx claude-flow@alpha training status` |
| `neural_train` | `training neural train` | `npx claude-flow@alpha training neural train --pattern coordination` |
| `neural_patterns` | `neural patterns` | `npx claude-flow@alpha neural patterns --category task-execution` |
| `neural_predict` | `neural predict` | `npx claude-flow@alpha neural predict --input "{...}" --model default` |
| `neural_optimize` | `neural optimize` | `npx claude-flow@alpha neural optimize --model coordination --metric accuracy` |
| `neural_export` | `neural export` | `npx claude-flow@alpha neural export --format onnx --models model1,model2` |
| `neural_import` | `neural import` | `npx claude-flow@alpha neural import /path/to/model --format tensorflow` |
| `neural_benchmark` | `neural benchmark` | `npx claude-flow@alpha neural benchmark --models model1,model2 --dataset test` |
| `neural_ensemble` | `neural ensemble` | `npx claude-flow@alpha neural ensemble --models m1,m2,m3 --method voting` |
| `neural_analyze` | `neural analyze` | `npx claude-flow@alpha neural analyze --model default --input "{...}"` |
| `neural_compress` | `neural compress` | `npx claude-flow@alpha neural compress --model large --method quantization` |
| `neural_finetune` | `neural finetune` | `npx claude-flow@alpha neural finetune --model base --data "{...}" --lr 0.001` |
| `neural_explain` | `neural explain` | `npx claude-flow@alpha neural explain --model default --prediction "{...}"` |
| `neural_validate` | `neural validate` | `npx claude-flow@alpha neural validate --model production --test-suite full` |
| `neural_visualize` | `neural visualize` | `npx claude-flow@alpha neural visualize --model default --layer conv1 --format graph` |

### Memory Tools (11 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `memory_usage` | `memory [action]` | `npx claude-flow@alpha memory store --key config --value "{...}"` |
| `memory_search` | `memory query` | `npx claude-flow@alpha memory query "search pattern" --namespace default` |
| `memory_persist` | `memory persist` | `npx claude-flow@alpha memory persist --namespace project --format json` |
| `memory_restore` | `memory restore` | `npx claude-flow@alpha memory restore /backup/memory.json --namespace project` |
| `memory_analyze` | `memory analyze` | `npx claude-flow@alpha memory analyze --start 2024-01-01 --end 2024-01-31` |
| `memory_consolidate` | `memory consolidate` | `npx claude-flow@alpha memory consolidate --strategy merge --threshold 0.8` |
| `memory_export` | `memory export` | `npx claude-flow@alpha memory export --format csv --filter "{...}"` |
| `memory_import` | `memory import` | `npx claude-flow@alpha memory import data.csv --format csv --merge` |
| `memory_graph` | `memory graph` | `npx claude-flow@alpha memory graph --depth 3 --start task-123` |
| `memory_prune` | `memory prune` | `npx claude-flow@alpha memory prune --age 30 --strategy lru` |
| `memory_sync` | `memory sync` | `npx claude-flow@alpha memory sync --agents agent-1,agent-2 --bidirectional` |

### Monitoring Tools (5 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `agent_list` | `agent list` | `npx claude-flow@alpha agent list --status active --verbose` |
| `agent_metrics` | `agent metrics` | `npx claude-flow@alpha agent metrics --agentId agent-123 --timeRange 24h` |
| `monitoring_dashboard` | `monitor dashboard` | `npx claude-flow@alpha monitor dashboard --port 8080 --auto-refresh` |
| `alert_configure` | `monitor alert` | `npx claude-flow@alpha monitor alert --metric cpu --threshold 0.8 --action notify` |
| `metrics_export` | `monitor export` | `npx claude-flow@alpha monitor export --format prometheus --start 2024-01-01` |

### Performance Tools (10 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `performance_report` | `analysis performance` | `npx claude-flow@alpha analysis performance --format detailed` |
| `bottleneck_analyze` | `performance bottleneck` | `npx claude-flow@alpha performance bottleneck --depth deep --focus cpu,memory` |
| `performance_optimize` | `performance optimize` | `npx claude-flow@alpha performance optimize --target speed --aggressive` |
| `benchmark_run` | `benchmark run` | `npx claude-flow@alpha benchmark run --suite comprehensive --iterations 10` |
| `profile_execution` | `performance profile` | `npx claude-flow@alpha performance profile --task task-123 --level detailed` |
| `cache_analyze` | `performance cache-analyze` | `npx claude-flow@alpha performance cache-analyze --type memory` |
| `resource_monitor` | `performance resource-monitor` | `npx claude-flow@alpha performance resource-monitor --resources cpu,memory --interval 5` |
| `load_test` | `performance load-test` | `npx claude-flow@alpha performance load-test scenario-1 --users 100 --duration 300` |
| `performance_baseline` | `performance baseline` | `npx claude-flow@alpha performance baseline --name v2.0 --metrics speed,accuracy` |
| `latency_trace` | `performance trace-latency` | `npx claude-flow@alpha performance trace-latency --operation api-call --detailed` |

### Workflow Tools (9 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `workflow_create` | `workflow create` | `npx claude-flow@alpha workflow create --name "Deploy Pipeline" --steps "[...]"` |
| `workflow_execute` | `workflow execute` | `npx claude-flow@alpha workflow execute workflow-123 --async` |
| `workflow_list` | `workflow list` | `npx claude-flow@alpha workflow list --category deployment --include-system` |
| `workflow_status` | `workflow status` | `npx claude-flow@alpha workflow status exec-456` |
| `workflow_pause` | `workflow pause` | `npx claude-flow@alpha workflow pause exec-456` |
| `workflow_resume` | `workflow resume` | `npx claude-flow@alpha workflow resume exec-456` |
| `workflow_cancel` | `workflow cancel` | `npx claude-flow@alpha workflow cancel exec-456` |
| `workflow_schedule` | `workflow schedule` | `npx claude-flow@alpha workflow schedule workflow-123 --cron "0 0 * * *"` |
| `workflow_export` | `workflow export` | `npx claude-flow@alpha workflow export workflow-123 --format yaml` |

### GitHub Tools (7 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `github_repo_analyze` | `github analyze` | `npx claude-flow@alpha github analyze --repo owner/repo --deep` |
| `github_pr_manage` | `github pr` | `npx claude-flow@alpha github pr --repo owner/repo --action review --pr 123` |
| `github_issue_process` | `github issue` | `npx claude-flow@alpha github issue --repo owner/repo --action triage --issue 456` |
| `github_code_review` | `github review` | `npx claude-flow@alpha github review --repo owner/repo --target main --depth comprehensive` |
| `github_workflow_generate` | `github workflow-generate` | `npx claude-flow@alpha github workflow-generate --type ci --language javascript` |
| `github_release_manage` | `github release` | `npx claude-flow@alpha github release --repo owner/repo --action create --version v2.0.0` |
| `github_swarm` | `github swarm` | `npx claude-flow@alpha github swarm --repo owner/repo --agents 5 --focus maintenance` |

### DAA Tools (7 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `daa_agent_create` | `daa agent-create` | `npx claude-flow@alpha daa agent-create --name "Smart Agent" --capabilities search,analyze --autonomy high` |
| `daa_capability_add` | `daa capability-add` | `npx claude-flow@alpha daa capability-add --agent agent-123 --capability "code-review"` |
| `daa_capability_match` | `daa capability-match` | `npx claude-flow@alpha daa capability-match --requirements code,test,deploy --strategy best` |
| `daa_evolution_trigger` | `daa evolve` | `npx claude-flow@alpha daa evolve --agent agent-123 --metrics "{...}"` |
| `daa_swarm_adapt` | `daa swarm-adapt` | `npx claude-flow@alpha daa swarm-adapt --trigger performance --constraints "{...}"` |
| `daa_knowledge_transfer` | `daa knowledge-transfer` | `npx claude-flow@alpha daa knowledge-transfer --from agent-1 --to agent-2 --knowledge patterns,strategies` |
| `daa_performance_evolve` | `daa performance-evolve` | `npx claude-flow@alpha daa performance-evolve --agent agent-123 --generations 5` |

### System Tools (12 tools)

| Tool Name | CLI Command | Example |
|-----------|-------------|---------|
| `terminal_execute` | `terminal exec` | `npx claude-flow@alpha terminal exec "ls -la" --cwd /project --timeout 30` |
| `config_manage` | `config [action]` | `npx claude-flow@alpha config set api.key "secret-key"` |
| `system_health` | `system health` | `npx claude-flow@alpha system health --components neural,memory --verbose` |
| `log_analyze` | `log analyze` | `npx claude-flow@alpha log analyze --range 24h --severity error --pattern "timeout"` |
| `backup_create` | `backup create` | `npx claude-flow@alpha backup create --components memory,config --dest /backups` |
| `backup_restore` | `backup restore` | `npx claude-flow@alpha backup restore backup-123 --components memory` |
| `features_detect` | `system features` | `npx claude-flow@alpha system features --category neural` |
| `plugin_manage` | `plugin [action]` | `npx claude-flow@alpha plugin install claude-flow-github` |
| `telemetry_control` | `telemetry control` | `npx claude-flow@alpha telemetry control --enabled true --level standard` |
| `update_check` | `update check` | `npx claude-flow@alpha update check --channel stable --auto-update` |
| `diagnostic_run` | `diagnostic run` | `npx claude-flow@alpha diagnostic run --level comprehensive --areas system,network` |
| `environment_info` | `env info` | `npx claude-flow@alpha env info --include-secrets` |

## Implementation Notes

### MCP Protocol vs CLI Execution

Some tools are implemented directly in the MCP handler without CLI calls:
- `swarm_init`, `agent_spawn`, `task_orchestrate` 
- `memory_usage`, `memory_search`
- `swarm_status`, `neural_status`
- And several others for better performance

### Parameter Handling

1. **Boolean flags**: Convert to `--flag` when true
2. **Arrays**: Join with commas (e.g., `--agents agent-1,agent-2`)
3. **Objects**: JSON stringify (e.g., `--params '{"key":"value"}'`)
4. **Optional parameters**: Only include if provided
5. **Positional arguments**: Some commands use positional args (e.g., task names)

### Error Handling

- Invalid tool names fall back to generic execution: `mcp execute [toolName]`
- Missing required parameters are validated before execution
- CLI errors are captured and returned in the result object