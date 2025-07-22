import React from 'react';

interface RetroPanelProps {
  children: React.ReactNode;
  title?: string;
  variant?: 'default' | 'inset' | 'raised';
  className?: string;
}

export const RetroPanel: React.FC<RetroPanelProps> = ({
  children,
  title,
  variant = 'default',
  className = ''
}) => {
  return (
    <div className={`retro-panel retro-panel--${variant} ${className}`}>
      {title && (
        <div className="retro-panel-header">
          <span className="panel-title">{title}</span>
        </div>
      )}
      <div className="retro-panel-content">
        {children}
      </div>
    </div>
  );
};

export default RetroPanel;