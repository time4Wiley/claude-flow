import React, { useState, useEffect } from 'react';
import { ConsoleFrame } from './components/Layout/ConsoleFrame';
import { RetroHeader } from './components/Layout/RetroHeader';
import { StatusBar } from './components/Layout/StatusBar';
import { SwarmDashboard } from './components/HiveMind/SwarmDashboard';
import './styles/index.css';

function App() {
  const [systemMetrics, setSystemMetrics] = useState({
    cpuUsage: 45.2,
    memoryUsage: 62.8,
    taskCount: 12,
    activeAgents: 5
  });

  // Simulate real-time metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics(prev => ({
        cpuUsage: Math.max(0, Math.min(100, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(0, Math.min(100, prev.memoryUsage + (Math.random() - 0.5) * 5)),
        taskCount: Math.max(0, prev.taskCount + Math.floor(Math.random() * 3 - 1)),
        activeAgents: 5
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <ConsoleFrame title="AGENTIC-FLOW v2.0 :: HIVE-MIND CONTROL">
        <div className="app-content">
          <RetroHeader />
          
          <main className="main-content">
            <SwarmDashboard />
          </main>
          
          <StatusBar 
            cpuUsage={systemMetrics.cpuUsage}
            memoryUsage={systemMetrics.memoryUsage}
            taskCount={systemMetrics.taskCount}
            activeAgents={systemMetrics.activeAgents}
          />
        </div>
      </ConsoleFrame>
    </div>
  );
}

export default App;