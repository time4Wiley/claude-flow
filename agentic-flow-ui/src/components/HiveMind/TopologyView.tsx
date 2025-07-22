import React, { useEffect, useRef } from 'react';
import { GlowText } from '../UI/GlowText';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'error';
}

interface TopologyViewProps {
  agents: Agent[];
}

export const TopologyView: React.FC<TopologyViewProps> = ({ agents }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate positions for mesh topology
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    const positions = agents.map((_, index) => {
      const angle = (index * 2 * Math.PI) / agents.length - Math.PI / 2;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    // Draw connections (mesh topology - all connected)
    ctx.strokeStyle = '#008800';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    positions.forEach((pos1, i) => {
      positions.forEach((pos2, j) => {
        if (i < j) {
          ctx.beginPath();
          ctx.moveTo(pos1.x, pos1.y);
          ctx.lineTo(pos2.x, pos2.y);
          ctx.stroke();
        }
      });
    });

    ctx.setLineDash([]);

    // Draw agent nodes
    agents.forEach((agent, index) => {
      const pos = positions[index];
      const radius = 20;

      // Node glow effect
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 2);
      
      if (agent.status === 'busy') {
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(0.5, '#00ff0066');
        gradient.addColorStop(1, '#00ff0000');
      } else if (agent.status === 'error') {
        gradient.addColorStop(0, '#00cc00');
        gradient.addColorStop(0.5, '#00cc0066');
        gradient.addColorStop(1, '#00cc0000');
      } else {
        gradient.addColorStop(0, '#008800');
        gradient.addColorStop(0.5, '#00880066');
        gradient.addColorStop(1, '#00880000');
      }

      // Draw glow
      ctx.fillStyle = gradient;
      ctx.fillRect(pos.x - radius * 2, pos.y - radius * 2, radius * 4, radius * 4);

      // Draw node
      ctx.fillStyle = agent.status === 'busy' ? '#00ff00' : 
                      agent.status === 'error' ? '#00cc00' : '#008800';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw agent number
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), pos.x, pos.y);
    });

    // Animation frame for pulsing effect
    let animationId: number;
    let pulse = 0;

    const animate = () => {
      pulse += 0.05;
      
      // Redraw connections with pulsing
      ctx.strokeStyle = `rgba(0, ${Math.floor(136 + Math.sin(pulse) * 50)}, 0, 0.5)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Clear and redraw for animation
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Redraw everything with updated pulse
      positions.forEach((pos1, i) => {
        positions.forEach((pos2, j) => {
          if (i < j && agents[i].status === 'busy' && agents[j].status === 'busy') {
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.strokeStyle = `rgba(0, ${Math.floor(200 + Math.sin(pulse) * 55)}, 0, 0.8)`;
            ctx.stroke();
          } else if (i < j) {
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.strokeStyle = '#008800';
            ctx.stroke();
          }
        });
      });

      // Redraw nodes
      agents.forEach((agent, index) => {
        const pos = positions[index];
        const nodeRadius = 20 + (agent.status === 'busy' ? Math.sin(pulse) * 2 : 0);

        ctx.fillStyle = agent.status === 'busy' ? '#00ff00' : 
                        agent.status === 'error' ? '#00cc00' : '#008800';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), pos.x, pos.y);
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [agents]);

  return (
    <div className="topology-view">
      <canvas 
        ref={canvasRef}
        className="topology-canvas"
        style={{ width: '100%', height: '300px' }}
      />
      <div className="topology-legend">
        <div className="legend-item">
          <span className="legend-icon busy">●</span>
          <GlowText intensity="low">ACTIVE</GlowText>
        </div>
        <div className="legend-item">
          <span className="legend-icon idle">●</span>
          <GlowText intensity="low">IDLE</GlowText>
        </div>
        <div className="legend-item">
          <span className="legend-icon error">●</span>
          <GlowText intensity="low">ERROR</GlowText>
        </div>
      </div>
    </div>
  );
};

export default TopologyView;