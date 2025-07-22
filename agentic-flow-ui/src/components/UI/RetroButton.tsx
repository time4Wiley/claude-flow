import React from 'react';
import { GlowText } from './GlowText';

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
}

export const RetroButton: React.FC<RetroButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = ''
}) => {
  const getIntensity = () => {
    if (disabled) return 'low' as const;
    return variant === 'primary' ? 'high' as const : 'medium' as const;
  };

  return (
    <button
      className={`retro-button retro-button--${variant} retro-button--${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="button-border-top">╔{'═'.repeat(20)}╗</span>
      <span className="button-content">
        <span className="button-border-left">║</span>
        <GlowText intensity={getIntensity()}>
          {children}
        </GlowText>
        <span className="button-border-right">║</span>
      </span>
      <span className="button-border-bottom">╚{'═'.repeat(20)}╝</span>
    </button>
  );
};

export default RetroButton;