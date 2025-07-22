import React from 'react';
import { GlowText } from '../UI/GlowText';
import { RetroPanel } from '../UI/RetroPanel';

interface AgentMetrics {
  tasksCompleted: number;
  efficiency: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface Agent {
  id: string;
  name: string;
  type: 'architect' | 'developer' | 'tester' | 'analyst' | 'coordinator';
  status: 'idle' | 'busy' | 'error';
  taskProgress: number;
  currentTask?: string;
  metrics: AgentMetrics;
}

interface AgentCardProps {
  agent: Agent;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'idle': return '◯';
      case 'busy': return '◉';
      case 'error': return '⊗';
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'idle': return 'low';
      case 'busy': return 'high';
      case 'error': return 'medium';
    }
  };

  const renderProgressBar = (progress: number) => {
    const filled = Math.floor(progress / 5);
    const empty = 20 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  };

  return (
    <RetroPanel className="agent-card">
      <div className="agent-header">
        <GlowText intensity={getStatusColor(agent.status)}>
          {getStatusIcon(agent.status)} {agent.name.toUpperCase()}
        </GlowText>
      </div>

      <div className="agent-status">
        <div className="status-line">
          <span className="label">TYPE:</span>
          <GlowText intensity="low">{agent.type.toUpperCase()}</GlowText>
        </div>
        
        <div className="status-line">
          <span className="label">STATUS:</span>
          <GlowText intensity={getStatusColor(agent.status)}>
            {agent.status.toUpperCase()}
          </GlowText>
        </div>

        {agent.currentTask && (
          <div className="current-task">
            <span className="label">TASK:</span>
            <div className="task-text">
              <GlowText intensity="medium">{agent.currentTask}</GlowText>
            </div>
            <div className="progress">
              <GlowText intensity="low">
                {renderProgressBar(agent.taskProgress)} {agent.taskProgress}%
              </GlowText>
            </div>
          </div>
        )}
      </div>

      <div className="agent-metrics">
        <div className="metric">
          <span className="metric-label">TASKS:</span>
          <GlowText intensity="low">{agent.metrics.tasksCompleted}</GlowText>
        </div>
        <div className="metric">
          <span className="metric-label">EFF:</span>
          <GlowText intensity="low">{agent.metrics.efficiency}%</GlowText>
        </div>
        <div className="metric">
          <span className="metric-label">CPU:</span>
          <GlowText intensity="low">{agent.metrics.cpuUsage}%</GlowText>
        </div>
        <div className="metric">
          <span className="metric-label">MEM:</span>
          <GlowText intensity="low">{agent.metrics.memoryUsage}%</GlowText>
        </div>
      </div>
    </RetroPanel>
  );
};

export default AgentCard;