import React from 'react';
import { AgentCard } from './AgentCard';
import { TopologyView } from './TopologyView';
import { ConsensusIndicator } from './ConsensusIndicator';
import { ASCIIBorder } from '../UI/ASCIIBorder';

interface Agent {
  id: string;
  name: string;
  type: 'architect' | 'developer' | 'tester' | 'analyst' | 'coordinator';
  status: 'idle' | 'busy' | 'error';
  taskProgress: number;
  currentTask?: string;
  metrics: {
    tasksCompleted: number;
    efficiency: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

interface SwarmDashboardProps {
  agents?: Agent[];
  consensusLevel?: number;
}

const defaultAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Architect',
    type: 'architect',
    status: 'busy',
    taskProgress: 75,
    currentTask: 'Designing system architecture',
    metrics: { tasksCompleted: 12, efficiency: 94, cpuUsage: 45, memoryUsage: 38 }
  },
  {
    id: 'agent-2',
    name: 'Developer',
    type: 'developer',
    status: 'busy',
    taskProgress: 60,
    currentTask: 'Implementing core modules',
    metrics: { tasksCompleted: 8, efficiency: 88, cpuUsage: 62, memoryUsage: 54 }
  },
  {
    id: 'agent-3',
    name: 'Tester',
    type: 'tester',
    status: 'idle',
    taskProgress: 0,
    metrics: { tasksCompleted: 15, efficiency: 92, cpuUsage: 12, memoryUsage: 22 }
  },
  {
    id: 'agent-4',
    name: 'Analyst',
    type: 'analyst',
    status: 'busy',
    taskProgress: 90,
    currentTask: 'Analyzing performance metrics',
    metrics: { tasksCompleted: 10, efficiency: 96, cpuUsage: 38, memoryUsage: 41 }
  },
  {
    id: 'agent-5',
    name: 'Coordinator',
    type: 'coordinator',
    status: 'busy',
    taskProgress: 45,
    currentTask: 'Orchestrating agent tasks',
    metrics: { tasksCompleted: 20, efficiency: 98, cpuUsage: 28, memoryUsage: 30 }
  }
];

export const SwarmDashboard: React.FC<SwarmDashboardProps> = ({ 
  agents = defaultAgents,
  consensusLevel = 95
}) => {
  return (
    <div className="swarm-dashboard">
      <ASCIIBorder title="HIVE-MIND SWARM CONTROL">
        <div className="dashboard-grid">
          {/* Left Panel - Topology View */}
          <div className="topology-panel">
            <ASCIIBorder title="MESH TOPOLOGY" variant="simple">
              <TopologyView agents={agents} />
            </ASCIIBorder>
          </div>

          {/* Center Panel - Agent Cards */}
          <div className="agents-panel">
            <ASCIIBorder title="AGENT STATUS" variant="simple">
              <div className="agent-cards-grid">
                {agents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </ASCIIBorder>
          </div>

          {/* Right Panel - Consensus */}
          <div className="consensus-panel">
            <ASCIIBorder title="SWARM CONSENSUS" variant="simple">
              <ConsensusIndicator level={consensusLevel} />
              
              <div className="swarm-stats">
                <div className="stat">
                  <span className="stat-label">Active Tasks:</span>
                  <span className="stat-value">
                    {agents.filter(a => a.status === 'busy').length}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Completed:</span>
                  <span className="stat-value">
                    {agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Avg Efficiency:</span>
                  <span className="stat-value">
                    {(agents.reduce((sum, a) => sum + a.metrics.efficiency, 0) / agents.length).toFixed(1)}%
                  </span>
                </div>
              </div>
            </ASCIIBorder>
          </div>
        </div>
      </ASCIIBorder>
    </div>
  );
};

export default SwarmDashboard;