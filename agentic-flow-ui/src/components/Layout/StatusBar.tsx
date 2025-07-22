import React, { useState, useEffect } from 'react';
import { GlowText } from '../UI/GlowText';

interface StatusBarProps {
  cpuUsage?: number;
  memoryUsage?: number;
  taskCount?: number;
  activeAgents?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cpuUsage = 0,
  memoryUsage = 0,
  taskCount = 0,
  activeAgents = 5
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  return (
    <div className="status-bar">
      <div className="status-section">
        <GlowText intensity="low">
          [CPU: {cpuUsage.toFixed(1)}%]
        </GlowText>
      </div>
      
      <div className="status-section">
        <GlowText intensity="low">
          [MEM: {memoryUsage.toFixed(1)}%]
        </GlowText>
      </div>
      
      <div className="status-section">
        <GlowText intensity="low">
          [TASKS: {taskCount}]
        </GlowText>
      </div>
      
      <div className="status-section">
        <GlowText intensity="low">
          [AGENTS: {activeAgents}/5]
        </GlowText>
      </div>
      
      <div className="status-spacer"></div>
      
      <div className="status-section">
        <GlowText intensity="low">
          [{formatDate(time)}]
        </GlowText>
      </div>
      
      <div className="status-section">
        <GlowText intensity="low">
          [{formatTime(time)}]
        </GlowText>
      </div>
    </div>
  );
};

export default StatusBar;