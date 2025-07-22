// AGENTIC-FLOW UI - ASCII Art Assets
// Retro terminal ASCII art for logos, borders, and decorations

export const ASCII_ART = {
  // Main AGENTIC-FLOW Logo
  logo: `
 █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗
██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝
███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║     
██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║     
██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝
                                                         
███████╗██╗      ██████╗ ██╗    ██╗                    
██╔════╝██║     ██╔═══██╗██║    ██║                    
█████╗  ██║     ██║   ██║██║ █╗ ██║                    
██╔══╝  ██║     ██║   ██║██║███╗██║                    
██║     ███████╗╚██████╔╝╚███╔███╔╝                    
╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝                     
`,

  // Compact Logo
  logoCompact: `
╔═╗╔═╗╔═╗╔╗╔╔╦╗╦╔═╗  ╔═╗╦  ╔═╗╦ ╦
╠═╣║ ╦║╣ ║║║ ║ ║║    ╠╣ ║  ║ ║║║║
╩ ╩╚═╝╚═╝╝╚╝ ╩ ╩╚═╝  ╚  ╩═╝╚═╝╚╩╝
`,

  // System Boot Header
  bootHeader: `
┌─────────────────────────────────────────────────────────────┐
│ AGENTIC-FLOW v2.0.0 - Neural Swarm Orchestration System    │
│ Copyright (c) 2025 - All Rights Reserved                    │
│ Initializing quantum neural networks...                     │
└─────────────────────────────────────────────────────────────┘
`,

  // Agent Type Icons
  agentIcons: {
    coordinator: `
    ╔═╗
    ║ ║
    ╚═╝
    `,
    researcher: `
    ╔╗ 
    ╠╩╗
    ╚═╝
    `,
    coder: `
    { }
    < >
    `,
    analyst: `
    ╔═╗
    ╠═╣
    ╩ ╩
    `,
    architect: `
    ╔╦╗
    ║║║
    ╩ ╩
    `,
    tester: `
    ╔╦╗
    ╠╬╣
    ╩ ╩
    `,
    reviewer: `
    ╔╗╔
    ╠╦╝
    ╩╚═
    `,
    optimizer: `
    ╔═╗
    ║ ║
    ╚═╝
    `,
  },

  // Section Dividers
  dividers: {
    single: '─'.repeat(60),
    double: '═'.repeat(60),
    thick: '━'.repeat(60),
    dotted: '┅'.repeat(60),
    dashed: '┉'.repeat(60),
    wave: '∿'.repeat(30),
  },

  // Box Drawing Borders
  borders: {
    // Simple Box
    simple: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    },
    // Double Box
    double: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
    },
    // Rounded Box
    rounded: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
    },
  },

  // Loading Animations (frames)
  loadingFrames: [
    '[■□□□□□□□□□]',
    '[■■□□□□□□□□]',
    '[■■■□□□□□□□]',
    '[■■■■□□□□□□]',
    '[■■■■■□□□□□]',
    '[■■■■■■□□□□]',
    '[■■■■■■■□□□]',
    '[■■■■■■■■□□]',
    '[■■■■■■■■■□]',
    '[■■■■■■■■■■]',
  ],

  // Progress Bar Characters
  progressChars: {
    empty: '░',
    quarter: '▒',
    half: '▓',
    full: '█',
  },

  // Status Indicators
  statusIcons: {
    success: '[✓]',
    error: '[✗]',
    warning: '[!]',
    info: '[i]',
    running: '[►]',
    stopped: '[■]',
    paused: '[║]',
  },

  // Decorative Elements
  decorative: {
    cornerTL: '◤',
    cornerTR: '◥',
    cornerBL: '◣',
    cornerBR: '◢',
    diamond: '◆',
    star: '✦',
    dot: '•',
    arrow: '▸',
  },

  // Neural Network Visualization
  neuralNetwork: `
     ◯───◯───◯
    ╱ ╲ ╱ ╲ ╱ ╲
   ◯───◯───◯───◯
    ╲ ╱ ╲ ╱ ╲ ╱
     ◯───◯───◯
  `,

  // Swarm Topology Diagrams
  topologies: {
    mesh: `
    ◆═══◆═══◆
    ║ ╲ ║ ╱ ║
    ◆═══◆═══◆
    ║ ╱ ║ ╲ ║
    ◆═══◆═══◆
    `,
    hierarchical: `
        ◆
       ╱║╲
      ◆ ◆ ◆
     ╱│ │ │╲
    ◆ ◆ ◆ ◆ ◆
    `,
    ring: `
      ◆═══◆
     ║     ║
     ◆     ◆
     ║     ║
      ◆═══◆
    `,
    star: `
      ◆ ◆ ◆
       ╲│╱
    ◆───◆───◆
       ╱│╲
      ◆ ◆ ◆
    `,
  },

  // Terminal Prompt
  prompts: {
    system: '┌[system@agentic-flow]─[~]',
    user: '└─▸ ',
    root: '└─# ',
  },

  // Window Frame
  windowFrame: (title: string, width: number = 60) => {
    const padding = width - title.length - 4;
    const leftPad = Math.floor(padding / 2);
    const rightPad = Math.ceil(padding / 2);
    
    return `╔${'═'.repeat(leftPad)}[${title}]${'═'.repeat(rightPad)}╗
║${' '.repeat(width - 2)}║
╚${'═'.repeat(width - 2)}╝`;
  },

  // Matrix Rain Characters
  matrixChars: '｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789',

  // Glitch Text Effect
  glitchChars: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
};

// Helper functions for ASCII art manipulation
export const asciiUtils = {
  // Create a bordered box
  createBox: (content: string[], borderStyle: 'simple' | 'double' | 'rounded' = 'simple') => {
    const border = ASCII_ART.borders[borderStyle];
    const maxLength = Math.max(...content.map(line => line.length));
    const paddedContent = content.map(line => line.padEnd(maxLength));
    
    const top = border.topLeft + border.horizontal.repeat(maxLength + 2) + border.topRight;
    const bottom = border.bottomLeft + border.horizontal.repeat(maxLength + 2) + border.bottomRight;
    const middle = paddedContent.map(line => `${border.vertical} ${line} ${border.vertical}`);
    
    return [top, ...middle, bottom].join('\\n');
  },

  // Create a progress bar
  createProgressBar: (percent: number, width: number = 20) => {
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    return `[${ASCII_ART.progressChars.full.repeat(filled)}${ASCII_ART.progressChars.empty.repeat(empty)}] ${percent}%`;
  },

  // Animate text with typing effect
  typeText: (text: string, delay: number = 50) => {
    return text.split('').map((char, index) => ({
      char,
      delay: index * delay,
    }));
  },

  // Generate random matrix rain column
  generateMatrixColumn: () => {
    const chars = ASCII_ART.matrixChars;
    const length = Math.floor(Math.random() * 20) + 10;
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
};

export default ASCII_ART;