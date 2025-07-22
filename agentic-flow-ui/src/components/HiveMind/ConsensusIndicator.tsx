import React from 'react';
import { GlowText } from '../UI/GlowText';

interface ConsensusIndicatorProps {
  level: number; // 0-100
}

export const ConsensusIndicator: React.FC<ConsensusIndicatorProps> = ({ level }) => {
  const getConsensusStatus = (level: number) => {
    if (level >= 90) return { status: 'OPTIMAL', intensity: 'high' as const };
    if (level >= 70) return { status: 'STABLE', intensity: 'medium' as const };
    if (level >= 50) return { status: 'DEGRADED', intensity: 'low' as const };
    return { status: 'CRITICAL', intensity: 'low' as const };
  };

  const { status, intensity } = getConsensusStatus(level);

  const renderConsensusBar = () => {
    const segments = 20;
    const filled = Math.floor((level / 100) * segments);
    const chars = [];

    for (let i = 0; i < segments; i++) {
      if (i < filled) {
        if (level >= 90) chars.push('█');
        else if (level >= 70) chars.push('▓');
        else if (level >= 50) chars.push('▒');
        else chars.push('░');
      } else {
        chars.push('·');
      }
    }

    return chars.join('');
  };

  const renderConsensusMatrix = () => {
    const matrix = [];
    const size = 5;
    
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const threshold = (i * size + j) * (100 / (size * size));
        if (level >= threshold) {
          row.push('◉');
        } else {
          row.push('◯');
        }
      }
      matrix.push(row);
    }

    return matrix;
  };

  return (
    <div className="consensus-indicator">
      <div className="consensus-header">
        <GlowText intensity={intensity}>
          CONSENSUS LEVEL: {level}%
        </GlowText>
      </div>

      <div className="consensus-visual">
        <div className="consensus-bar">
          <GlowText intensity={intensity}>
            [{renderConsensusBar()}]
          </GlowText>
        </div>

        <div className="consensus-status">
          <GlowText intensity={intensity}>
            STATUS: {status}
          </GlowText>
        </div>
      </div>

      <div className="consensus-matrix">
        <div className="matrix-title">
          <GlowText intensity="low">AGENT AGREEMENT MATRIX</GlowText>
        </div>
        <div className="matrix-grid">
          {renderConsensusMatrix().map((row, i) => (
            <div key={i} className="matrix-row">
              <GlowText intensity={intensity}>
                {row.join(' ')}
              </GlowText>
            </div>
          ))}
        </div>
      </div>

      <div className="consensus-details">
        <div className="detail-item">
          <span className="detail-label">SYNC RATE:</span>
          <GlowText intensity="low">{(level * 0.95).toFixed(1)}%</GlowText>
        </div>
        <div className="detail-item">
          <span className="detail-label">CONFLICTS:</span>
          <GlowText intensity="low">{Math.max(0, 5 - Math.floor(level / 20))}</GlowText>
        </div>
        <div className="detail-item">
          <span className="detail-label">LATENCY:</span>
          <GlowText intensity="low">{Math.max(10, 100 - level)}ms</GlowText>
        </div>
      </div>
    </div>
  );
};

export default ConsensusIndicator;