import React from 'react';

interface ConsoleFrameProps {
  children: React.ReactNode;
  title?: string;
}

export const ConsoleFrame: React.FC<ConsoleFrameProps> = ({ children, title = 'AGENTIC-FLOW v2.0' }) => {
  return (
    <div className="console-frame">
      {/* CRT Monitor Frame */}
      <div className="crt-container">
        {/* Screen bezel */}
        <div className="screen-bezel">
          {/* Screen glass effect */}
          <div className="screen-glass">
            {/* Scanline effect */}
            <div className="scanlines"></div>
            
            {/* Monitor screen */}
            <div className="monitor-screen">
              {/* Terminal header */}
              <div className="terminal-header">
                <div className="terminal-title">{title}</div>
                <div className="terminal-controls">
                  <span className="control minimize">_</span>
                  <span className="control maximize">□</span>
                  <span className="control close">×</span>
                </div>
              </div>
              
              {/* Terminal content */}
              <div className="terminal-content">
                {children}
              </div>
            </div>
          </div>
        </div>
        
        {/* Monitor stand */}
        <div className="monitor-stand">
          <div className="stand-neck"></div>
          <div className="stand-base"></div>
        </div>
      </div>
    </div>
  );
};

export default ConsoleFrame;