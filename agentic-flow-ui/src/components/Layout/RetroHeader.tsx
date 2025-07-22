import React from 'react';
import { GlowText } from '../UI/GlowText';

export const RetroHeader: React.FC = () => {
  const asciiArt = `
╔═══════════════════════════════════════════════════════════════════════════╗
║     ╔═╗ ╔═╗ ╔═╗ ╔╗╔ ╔╦╗ ╦ ╔═╗   ╔═╗ ╦   ╔═╗ ╦ ╦     ╦  ╦ ╔═╗ ╔═╗       ║
║     ╠═╣ ║ ╦ ║╣  ║║║  ║  ║ ║     ╠╣  ║   ║ ║ ║║║     ╚╗╔╝ ╔═╝ ║ ║       ║
║     ╩ ╩ ╚═╝ ╚═╝ ╝╚╝  ╩  ╩ ╚═╝   ╚   ╩═╝ ╚═╝ ╚╩╝  ═  ╚╝  ╚═╝o╚═╝       ║
╚═══════════════════════════════════════════════════════════════════════════╝`;

  const subtitle = "[ HIVE-MIND COORDINATION SYSTEM :: 5-AGENT SWARM ACTIVE ]";

  return (
    <header className="retro-header">
      <pre className="ascii-art">
        <GlowText intensity="high">
          {asciiArt}
        </GlowText>
      </pre>
      <div className="subtitle">
        <GlowText intensity="medium">
          {subtitle}
        </GlowText>
      </div>
      <div className="header-stats">
        <span className="stat-item">
          <GlowText>[AGENTS: 5/5]</GlowText>
        </span>
        <span className="stat-item">
          <GlowText>[TOPOLOGY: MESH]</GlowText>
        </span>
        <span className="stat-item">
          <GlowText>[STATUS: ONLINE]</GlowText>
        </span>
        <span className="stat-item">
          <GlowText>[CONSENSUS: 100%]</GlowText>
        </span>
      </div>
    </header>
  );
};

export default RetroHeader;