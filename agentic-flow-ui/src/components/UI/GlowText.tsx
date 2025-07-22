import React from 'react';

interface GlowTextProps {
  children: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export const GlowText: React.FC<GlowTextProps> = ({ 
  children, 
  intensity = 'medium',
  className = ''
}) => {
  return (
    <span className={`glow-text glow-text--${intensity} ${className}`}>
      {children}
    </span>
  );
};

export default GlowText;