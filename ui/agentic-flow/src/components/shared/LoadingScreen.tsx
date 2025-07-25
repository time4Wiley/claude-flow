import React, { useState, useEffect } from 'react'

const LoadingScreen: React.FC = () => {
  const [frame, setFrame] = useState(0)
  const [dots, setDots] = useState(0)
  
  // ASCII loading animation frames
  const loadingFrames = [
    '[          ]',
    '[■         ]',
    '[■■        ]',
    '[■■■       ]',
    '[■■■■      ]',
    '[■■■■■     ]',
    '[■■■■■■    ]',
    '[■■■■■■■   ]',
    '[■■■■■■■■  ]',
    '[■■■■■■■■■ ]',
    '[■■■■■■■■■■]',
  ]

  // Rotating ASCII spinner
  const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % loadingFrames.length)
      setDots((prev) => (prev + 1) % 4)
    }, 200)

    return () => clearInterval(interval)
  }, [loadingFrames.length])

  const getDots = () => '.'.repeat(dots).padEnd(3, ' ')

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      {/* Fixed size loading box */}
      <div className="w-80 bg-black border-2 border-green-400 p-6 shadow-[0_0_30px_rgba(0,255,0,0.5)]">
        <div className="text-green-400 font-mono">
          {/* ASCII Art Header */}
          <pre className="text-center text-xs mb-4 leading-tight">
{`┌─────────────────────────┐
│   CLAUDE FLOW v2.0.0    │
│    HIVEMIND CONSOLE     │
└─────────────────────────┘`}
          </pre>

          {/* Loading bar */}
          <div className="text-center mb-4">
            <div className="mb-2">{loadingFrames[frame]}</div>
            <div className="text-xs text-green-600">{Math.floor((frame / (loadingFrames.length - 1)) * 100)}%</div>
          </div>

          {/* Status messages */}
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span>{spinners[frame % spinners.length]}</span>
              <span className="text-green-600">INITIALIZING{getDots()}</span>
            </div>
            
            {frame >= 3 && (
              <div className="text-green-500 pl-4">✓ Neural pathways connected</div>
            )}
            
            {frame >= 6 && (
              <div className="text-green-500 pl-4">✓ Memory systems online</div>
            )}
            
            {frame >= 9 && (
              <div className="text-green-500 pl-4">✓ Swarm protocols ready</div>
            )}
          </div>

          {/* System info */}
          <div className="text-center mt-4 pt-4 border-t border-green-900">
            <div className="text-xs text-green-600">
              SYSTEM BOOT • SEQUENCE {frame + 1}/{loadingFrames.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen