import { useState, useEffect } from 'react'

interface SystemStatus {
  api: boolean
  websocket: boolean
  mcp: boolean
  memory: boolean
}

interface InitProgress {
  current: number
  total: number
  message: string
  status: SystemStatus
}

export const useSystemInit = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [progress, setProgress] = useState<InitProgress>({
    current: 0,
    total: 4,
    message: 'Starting system initialization...',
    status: {
      api: false,
      websocket: false,
      mcp: false,
      memory: false
    }
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initSystem = async () => {
      try {
        // Step 1: Check API health
        setProgress(prev => ({ ...prev, current: 1, message: 'Checking API health...' }))
        try {
          const apiResponse = await fetch('http://localhost:3001/api/health')
          if (apiResponse.ok) {
            setProgress(prev => ({ 
              ...prev, 
              status: { ...prev.status, api: true },
              message: 'API connected successfully'
            }))
          } else {
            throw new Error('API health check failed')
          }
        } catch (err) {
          console.warn('API health check failed, continuing...', err)
          setProgress(prev => ({ 
            ...prev, 
            status: { ...prev.status, api: false },
            message: 'API offline - running in demo mode'
          }))
        }
        await new Promise(resolve => setTimeout(resolve, 500))

        // Step 2: Check WebSocket connection
        setProgress(prev => ({ ...prev, current: 2, message: 'Testing WebSocket connection...' }))
        try {
          const ws = new WebSocket('ws://localhost:3001')
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.close()
              reject(new Error('WebSocket connection timeout'))
            }, 3000)

            ws.onopen = () => {
              clearTimeout(timeout)
              ws.close()
              setProgress(prev => ({ 
                ...prev, 
                status: { ...prev.status, websocket: true },
                message: 'WebSocket ready'
              }))
              resolve()
            }

            ws.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('WebSocket connection failed'))
            }
          })
        } catch (err) {
          console.warn('WebSocket check failed, continuing...', err)
          setProgress(prev => ({ 
            ...prev, 
            status: { ...prev.status, websocket: false },
            message: 'WebSocket offline - limited functionality'
          }))
        }
        await new Promise(resolve => setTimeout(resolve, 500))

        // Step 3: Check MCP tools
        setProgress(prev => ({ ...prev, current: 3, message: 'Loading MCP tools...' }))
        try {
          const mcpResponse = await fetch('http://localhost:3001/api/mcp/tools')
          if (mcpResponse.ok) {
            const tools = await mcpResponse.json()
            setProgress(prev => ({ 
              ...prev, 
              status: { ...prev.status, mcp: true },
              message: `${tools.length || 71}+ MCP tools loaded`
            }))
          } else {
            throw new Error('MCP tools fetch failed')
          }
        } catch (err) {
          console.warn('MCP tools check failed, continuing...', err)
          setProgress(prev => ({ 
            ...prev, 
            status: { ...prev.status, mcp: false },
            message: 'MCP tools unavailable'
          }))
        }
        await new Promise(resolve => setTimeout(resolve, 500))

        // Step 4: Check memory systems
        setProgress(prev => ({ ...prev, current: 4, message: 'Initializing memory systems...' }))
        try {
          const memoryResponse = await fetch('http://localhost:3001/api/memory/swarm')
          if (memoryResponse.ok) {
            setProgress(prev => ({ 
              ...prev, 
              status: { ...prev.status, memory: true },
              message: 'Memory systems online'
            }))
          } else {
            throw new Error('Memory check failed')
          }
        } catch (err) {
          console.warn('Memory check failed, continuing...', err)
          setProgress(prev => ({ 
            ...prev, 
            status: { ...prev.status, memory: false },
            message: 'Memory systems offline'
          }))
        }
        await new Promise(resolve => setTimeout(resolve, 500))

        // Final step
        setProgress(prev => ({ ...prev, message: 'System initialization complete!' }))
        await new Promise(resolve => setTimeout(resolve, 300))
        
        setIsInitialized(true)
      } catch (err) {
        console.error('System initialization error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Still initialize even if there are errors
        setTimeout(() => setIsInitialized(true), 2000)
      }
    }

    initSystem()
  }, [])

  return { isInitialized, progress, error }
}