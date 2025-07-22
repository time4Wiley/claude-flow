import React, { useState } from 'react';
import { GlowText } from './GlowText';

interface RetroInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  type?: 'text' | 'password' | 'number';
  disabled?: boolean;
  className?: string;
}

export const RetroInput: React.FC<RetroInputProps> = ({
  value,
  onChange,
  placeholder = '',
  label,
  type = 'text',
  disabled = false,
  className = ''
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`retro-input-wrapper ${className}`}>
      {label && (
        <div className="retro-input-label">
          <GlowText intensity="medium">{label}</GlowText>
        </div>
      )}
      
      <div className={`retro-input ${focused ? 'retro-input--focused' : ''} ${disabled ? 'retro-input--disabled' : ''}`}>
        <span className="input-prompt">
          <GlowText intensity={focused ? 'high' : 'low'}>{'>'}</GlowText>
        </span>
        
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="retro-input-field"
        />
        
        {focused && (
          <span className="input-cursor">
            <GlowText intensity="high">_</GlowText>
          </span>
        )}
      </div>
    </div>
  );
};

export default RetroInput;