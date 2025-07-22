import React from 'react'

const Terminal: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 glitch" data-text="TERMINAL">
        TERMINAL
      </h1>
      <div className="retro-panel h-[600px] bg-black p-4 font-mono text-sm">
        <div className="text-green-400">
          <div className="mb-2">claude-flow@2.0.0 /workspaces/claude-code-flow</div>
          <div className="flex">
            <span className="text-green-600 mr-2">❯</span>
            <span className="terminal-cursor"></span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Terminal