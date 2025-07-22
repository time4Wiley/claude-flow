import React from 'react';
import { GlowText } from './GlowText';

interface ASCIIBorderProps {
  children: React.ReactNode;
  title?: string;
  variant?: 'default' | 'simple' | 'double' | 'heavy';
  className?: string;
}

const borderChars = {
  default: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    titleLeft: '╡',
    titleRight: '╞'
  },
  simple: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    titleLeft: '┤',
    titleRight: '├'
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    titleLeft: '╡',
    titleRight: '╞'
  },
  heavy: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    titleLeft: '┫',
    titleRight: '┣'
  }
};

export const ASCIIBorder: React.FC<ASCIIBorderProps> = ({
  children,
  title,
  variant = 'default',
  className = ''
}) => {
  const chars = borderChars[variant];

  return (
    <div className={`ascii-border ascii-border--${variant} ${className}`}>
      <div className="ascii-border-top">
        <GlowText intensity="low">
          {chars.topLeft}
          {title ? (
            <>
              {chars.horizontal.repeat(2)}
              {chars.titleLeft}
              <span className="ascii-border-title"> {title} </span>
              {chars.titleRight}
              {chars.horizontal.repeat(Math.max(0, 50 - title.length - 6))}
            </>
          ) : (
            chars.horizontal.repeat(50)
          )}
          {chars.topRight}
        </GlowText>
      </div>
      
      <div className="ascii-border-content">
        <span className="ascii-border-left">
          <GlowText intensity="low">{chars.vertical}</GlowText>
        </span>
        <div className="ascii-border-inner">
          {children}
        </div>
        <span className="ascii-border-right">
          <GlowText intensity="low">{chars.vertical}</GlowText>
        </span>
      </div>
      
      <div className="ascii-border-bottom">
        <GlowText intensity="low">
          {chars.bottomLeft}
          {chars.horizontal.repeat(50)}
          {chars.bottomRight}
        </GlowText>
      </div>
    </div>
  );
};

export default ASCIIBorder;