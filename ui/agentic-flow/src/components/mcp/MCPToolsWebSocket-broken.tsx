import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, Terminal, Brain, Database, Activity, Workflow, Github, Settings, ChevronRight, Play, Copy, Check, AlertCircle, Loader, Wifi, WifiOff, Zap } from 'lucide-react'
import { getMCPBridge, MCPBridge, MCPTool, ToolExecutionResult } from '../../api/mcp-bridge'

// Tool categories - empty initially, will be populated from WebSocket
const toolCategories = {
  neural: {
    name: 'Neural Network Tools',
    icon: Brain,
    color: 'text-purple-400',
    tools: [] // Will be populated from WebSocket
  },
  memory: {
    name: 'Memory & Persistence',
    icon: Database,
    color: 'text-blue-400',
    tools: []
  },
  monitoring: {
    name: 'Monitoring & Analysis',
    icon: Activity,
    color: 'text-green-400',
    tools: []
  },
  workflow: {
    name: 'Workflow & Automation',
    icon: Workflow,
    color: 'text-yellow-400',
    tools: []
  },
  github: {
    name: 'GitHub Integration',
    icon: Github,
    color: 'text-orange-400',
    tools: []
  },
  system: {
    name: 'System & Utilities',
    icon: Settings,
    color: 'text-cyan-400',
    tools: []
  },
  coordination: {
    name: 'Swarm Coordination',
    icon: Terminal,
    color: 'text-red-400',
    tools: []
  }
}

interface Tool {
  name: string
  description: string
  params: Array<{
    name: string
    type: string
    required?: boolean
    options?: string[]
  }>
}

const MCPToolsWebSocket: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, any>>({})
  const [executionResult, setExecutionResult] = useState<ToolExecutionResult | null>(null)
  const [copiedResult, setCopiedResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [realTools, setRealTools] = useState<MCPTool[]>([])
  const [toolsLoaded, setToolsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [streamingProgress, setStreamingProgress] = useState<string[]>([])
  
  // MCP Bridge (WebSocket + HTTP fallback)
  const [mcpBridge] = useState(() => getMCPBridge())
  
  // Set up WebSocket connection and load tools
  useEffect(() => {
    const connectAndLoadTools = async () => {
      setLoading(true)
      setError(null)
      setConnectionStatus('connecting')
      
      try {
        // Try to connect to WebSocket (with HTTP fallback)
        if (!mcpBridge.isWebSocketConnected()) {
          // Wait for connection
          await new Promise((resolve) => {
            const checkConnection = setInterval(() => {
              if (mcpBridge.isWebSocketConnected()) {
                clearInterval(checkConnection)
                resolve(undefined)
              }
            }, 100)
            
            // Timeout after 10 seconds
            setTimeout(() => {
              clearInterval(checkConnection)
              resolve(undefined)
            }, 10000)
          })
        }
        
        // Always try to load tools (works with both WebSocket and HTTP)
        setConnectionStatus(mcpBridge.isWebSocketConnected() ? 'connected' : 'disconnected')
          
          try {
            await mcpBridge.reconnectWebSocket()
            console.log('WebSocket connection established')
          } catch (wsError) {
            console.log('WebSocket failed, using HTTP fallback:', wsError)
          }
        }
        
        // Load tools (works with both WebSocket and HTTP)
        const tools = await mcpBridge.getAvailableTools()
        setRealTools(tools)
        setToolsLoaded(true)
        setConnectionStatus(mcpBridge.isWebSocketConnected() ? 'connected' : 'disconnected')
        console.log(`Loaded ${tools.length} MCP tools`, { websocket: mcpBridge.isWebSocketConnected() })
      } catch (err) {
        setConnectionStatus('disconnected')
        setError(err instanceof Error ? err.message : 'Failed to connect to MCP server')
        console.error('Failed to connect to MCP server:', err)
      } finally {
        setLoading(false)
      }
    }
    
    connectAndLoadTools()
  }, [mcpBridge])
  
  // Helper function to get category info
  const getCategoryInfo = (category: string) => {
    const categoryMap: Record<string, any> = {
      coordination: { name: 'Swarm Coordination', icon: Terminal, color: 'text-red-400' },
      monitoring: { name: 'Monitoring & Analysis', icon: Activity, color: 'text-green-400' },
      memory: { name: 'Memory & Persistence', icon: Database, color: 'text-blue-400' },
      neural: { name: 'Neural Network Tools', icon: Brain, color: 'text-purple-400' },
      github: { name: 'GitHub Integration', icon: Github, color: 'text-orange-400' },
      workflow: { name: 'Workflow & Automation', icon: Workflow, color: 'text-yellow-400' },
      system: { name: 'System & Utilities', icon: Settings, color: 'text-cyan-400' },
      daa: { name: 'Dynamic Agent Architecture', icon: Terminal, color: 'text-pink-400' },
      sparc: { name: 'SPARC Development', icon: Terminal, color: 'text-indigo-400' }
    }
    return categoryMap[category] || { name: category, icon: Terminal, color: 'text-gray-400' }
  }
  
  // Helper function to convert MCP parameters to component params
  const convertParametersToParams = (parameters: any) => {
    if (!parameters || !parameters.properties) return []
    
    return Object.entries(parameters.properties).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type === 'array' ? 'json' : prop.type,
      required: parameters.required?.includes(name),
      options: prop.enum
    }))
  }
  
  // Convert real tools to categories for display
  const realToolCategories = useMemo(() => {
    if (!toolsLoaded || realTools.length === 0) return toolCategories
    
    console.log('Building realToolCategories from', realTools.length, 'tools')
    const categories: typeof toolCategories = {}
    
    // Group real tools by category
    const toolsByCategory: Record<string, MCPTool[]> = {}
    for (const tool of realTools) {
      if (!toolsByCategory[tool.category]) {
        toolsByCategory[tool.category] = []
      }
      toolsByCategory[tool.category].push(tool)
    }
    
    // Map to category structure
    for (const [category, tools] of Object.entries(toolsByCategory)) {
      const categoryInfo = getCategoryInfo(category)
      categories[category as keyof typeof toolCategories] = {
        name: categoryInfo.name,
        icon: categoryInfo.icon,
        color: categoryInfo.color,
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          params: convertParametersToParams(tool.parameters)
        }))
      }
    }
    
    return categories
  }, [realTools, toolsLoaded])

  // Filter tools based on search (use real tools if available)
  const filteredCategories = useMemo(() => {
    const categoriesToFilter = toolsLoaded ? realToolCategories : toolCategories
    if (!searchQuery) return categoriesToFilter

    const filtered: typeof toolCategories = {}
    
    Object.entries(categoriesToFilter).forEach(([key, category]) => {
      const matchingTools = category.tools.filter(tool => 
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      
      if (matchingTools.length > 0 || category.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        filtered[key as keyof typeof toolCategories] = {
          ...category,
          tools: matchingTools.length > 0 ? matchingTools : category.tools
        }
      }
    })
    
    return filtered
  }, [searchQuery, toolsLoaded, realToolCategories])

  // Count total tools
  const categoriesToCount = toolsLoaded ? realToolCategories : toolCategories
  const totalTools = Object.values(categoriesToCount).reduce((sum, cat) => sum + cat.tools.length, 0)
  const filteredToolsCount = Object.values(filteredCategories).reduce((sum, cat) => sum + cat.tools.length, 0)

  const handleToolSelect = (tool: any, categoryKey: string) => {
    // Find the real MCP tool
    const realTool = realTools.find(t => t.name === tool.name)
    if (realTool) {
      // Add params property for the UI
      setSelectedTool({
        ...realTool,
        params: convertParametersToParams(realTool.parameters)
      } as any)
    } else {
      // Fallback to mock tool structure
      setSelectedTool({
        name: tool.name,
        description: tool.description,
        parameters: { properties: {}, required: [] },
        params: tool.params || [],
        category: categoryKey as any
      } as any)
    }
    setSelectedCategory(categoryKey)
    setParamValues({})
    setExecutionResult(null)
    setError(null)
    setStreamingProgress([])
  }

  const handleParamChange = (paramName: string, value: any) => {
    setParamValues(prev => ({ ...prev, [paramName]: value }))
  }

  const handleExecute = async () => {
    if (!selectedTool) return
    
    setExecuting(true)
    setError(null)
    setExecutionResult(null)
    setCopiedResult(false)
    setStreamingProgress([])
    
    try {
      // Check connection
      if (!mcpBridge.isConnected()) {
        throw new Error('Not connected to MCP server. Please refresh the page.')
      }
      
      // Validate parameters
      const validation = await mcpBridge.validateParameters(selectedTool.name, paramValues)
      if (!validation.valid) {
        setError(`Parameter validation failed: ${validation.errors?.join(', ')}`)
        return
      }
      
      // Execute the real MCP tool via WebSocket with progress tracking
      const result = await mcpBridge.executeTool(selectedTool.name, paramValues, {
        trackMetrics: true,
        cacheResult: true,
        onProgress: (progress) => {
          // Handle streaming progress updates
          if (typeof progress === 'string') {
            setStreamingProgress(prev => [...prev, progress])
          } else if (progress.message) {
            setStreamingProgress(prev => [...prev, progress.message])
          }
        }
      })
      
      setExecutionResult(result)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tool execution failed')
      console.error('Tool execution error:', err)
    } finally {
      setExecuting(false)
    }
  }

  const handleCopyResult = () => {
    if (executionResult) {
      const resultText = formatExecutionResult(executionResult)
      navigator.clipboard.writeText(resultText)
      setCopiedResult(true)
      setTimeout(() => setCopiedResult(false), 2000)
    }
  }
  
  const formatExecutionResult = (result: ToolExecutionResult): string => {
    const status = result.success ? 'SUCCESS' : 'FAILED'
    const statusIcon = result.success ? '✅' : '❌'
    
    return `
╔════════════════════════════════════════════════════════════════╗
║ MCP TOOL EXECUTION RESULT (WebSocket)                         ║
╠════════════════════════════════════════════════════════════════╣
║ Tool: mcp__claude-flow__${selectedTool?.name}                  ║
║ Category: ${selectedCategory}                                   ║
║ Status: ${status} ${statusIcon}                                ║
║ Execution Time: ${result.executionTime}ms                      ║
║ Connection: WebSocket                                          ║
║                                                                ║
║ Parameters:                                                    ║
${Object.entries(paramValues).map(([key, value]) => 
  `║   ${key}: ${JSON.stringify(value)}`.slice(0, 64).padEnd(65) + '║'
).join('\n')}
║                                                                ║
║ ${result.success ? 'Output:' : 'Error:'}                                                       ║
║   ${(result.success ? JSON.stringify(result.data, null, 2) : result.error || 'Unknown error')
  .split('\n').map(line => line.slice(0, 60).padEnd(60)).join(' ║\n║   ')} ║
║                                                                ║
║ Metadata:                                                      ║
${result.metadata ? Object.entries(result.metadata).map(([key, value]) => 
  `║   ${key}: ${String(value)}`.slice(0, 64).padEnd(65) + '║'
).join('\n') : '║   None                                                         ║'}
║                                                                ║
║ Timestamp: ${result.metadata?.timestamp || new Date().toISOString()}         ║
╚════════════════════════════════════════════════════════════════╝
    `.trim()
  }

  // Connection retry function
  const handleRetryConnection = useCallback(async () => {
    setConnectionStatus('connecting')
    setError(null)
    try {
      // Force reconnection
      mcpBridge.disconnect()
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Wait for connection
      await new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (mcpBridge.isConnected()) {
            clearInterval(checkConnection)
            resolve(undefined)
          }
        }, 100)
        
        setTimeout(() => {
          clearInterval(checkConnection)
          resolve(undefined)
        }, 10000)
      })
      
      if (mcpBridge.isConnected()) {
        setConnectionStatus('connected')
        const tools = await mcpBridge.getAvailableTools()
        setRealTools(tools)
        setToolsLoaded(true)
      } else {
        throw new Error('Reconnection failed')
      }
    } catch (err) {
      setConnectionStatus('disconnected')
      setError('Failed to reconnect to WebSocket server')
    }
  }, [mcpBridge])

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 glitch" data-text="MCP TOOLS INTERFACE (WebSocket)">
          MCP TOOLS INTERFACE (WebSocket)
        </h1>
        <div className="flex items-center justify-between">
          <p className="text-green-600 text-sm">
            {totalTools}+ {toolsLoaded ? 'Real-time ' : ''}Claude Flow MCP Tools • {Object.keys(filteredCategories).length} Categories
          </p>
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 text-sm ${
              connectionStatus === 'connected' ? 'text-green-400' : 
              connectionStatus === 'connecting' ? 'text-yellow-400' : 
              'text-red-400'
            }`}>
              {connectionStatus === 'connected' ? (
                <><Wifi className="w-3 h-3" /> WebSocket Connected</>
              ) : connectionStatus === 'connecting' ? (
                <><Loader className="w-3 h-3 animate-spin" /> Connecting...</>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" /> 
                  Disconnected
                  <button 
                    onClick={handleRetryConnection}
                    className="ml-2 px-2 py-1 text-xs bg-red-900/30 border border-red-400 text-red-400 hover:bg-red-900/50"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
            
            {loading && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <Loader className="w-3 h-3 animate-spin" />
                Loading MCP tools...
              </div>
            )}
            {toolsLoaded && (
              <div className="text-green-400 text-sm">
                ✅ {realTools.length} tools ready
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-900/30 border border-red-400 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-green-900 text-green-400 focus:border-green-400"
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 text-xs">
              {filteredToolsCount} tools found
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Categories and Tools List */}
        <div className="w-1/2 overflow-y-auto retro-panel">
          <div className="space-y-4">
            {Object.entries(searchQuery ? filteredCategories : (toolsLoaded ? realToolCategories : toolCategories)).map(([key, category]) => {
              const Icon = category.icon
              return (
                <div key={key} className="border border-green-900">
                  <div className={`p-3 bg-green-950/30 flex items-center gap-2 ${category.color}`}>
                    <Icon className="w-4 h-4" />
                    <span className="font-bold text-sm">{category.name}</span>
                    <span className="text-xs text-green-600 ml-auto">{category.tools.length} tools</span>
                    {toolsLoaded && <Zap className="w-3 h-3 text-yellow-400" title="Real-time WebSocket" />}
                  </div>
                  <div className="p-2 space-y-1">
                    {category.tools.map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => handleToolSelect(tool, key)}
                        className={`w-full text-left px-3 py-2 text-sm transition-all ${
                          selectedTool?.name === tool.name
                            ? 'bg-green-900/30 text-green-400 border-l-2 border-green-400'
                            : 'text-green-600 hover:bg-green-950/30 hover:text-green-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{tool.name}</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                        <div className="text-xs text-green-700 mt-1">{tool.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tool Details and Execution */}
        <div className="w-1/2 overflow-y-auto retro-panel">
          {selectedTool ? (
            <div className="space-y-4">
              {/* Tool Header */}
              <div className="border-b border-green-900 pb-4">
                <h2 className="text-lg font-bold text-green-400 mb-2 flex items-center gap-2">
                  mcp__claude-flow__{selectedTool.name}
                  <Zap className="w-4 h-4 text-yellow-400" title="WebSocket Enabled" />
                </h2>
                <p className="text-sm text-green-600">{selectedTool.description}</p>
              </div>

              {/* Parameters */}
              {selectedTool.params && selectedTool.params.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-green-400">Parameters:</h3>
                  {selectedTool.params.map((param) => (
                    <div key={param.name} className="space-y-1">
                      <label className="text-xs text-green-600">
                        {param.name} {param.required && <span className="text-red-400">*</span>}
                      </label>
                      {param.type === 'select' && param.options ? (
                        <select
                          value={paramValues[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          className="w-full px-2 py-1 bg-black border border-green-900 text-green-400"
                        >
                          <option value="">Select {param.name}</option>
                          {param.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : param.type === 'boolean' ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paramValues[param.name] || false}
                            onChange={(e) => handleParamChange(param.name, e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-green-400">Enable</span>
                        </label>
                      ) : param.type === 'number' ? (
                        <input
                          type="number"
                          value={paramValues[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, parseInt(e.target.value))}
                          className="w-full px-2 py-1 bg-black border border-green-900 text-green-400"
                          placeholder={`Enter ${param.name}`}
                        />
                      ) : param.type === 'json' ? (
                        <textarea
                          value={paramValues[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          className="w-full px-2 py-1 bg-black border border-green-900 text-green-400 font-mono text-xs"
                          rows={3}
                          placeholder={`Enter JSON for ${param.name}`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={paramValues[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          className="w-full px-2 py-1 bg-black border border-green-900 text-green-400"
                          placeholder={`Enter ${param.name}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-600">This tool has no parameters</p>
              )}

              {/* Execute Button */}
              <button
                onClick={handleExecute}
                disabled={executing || !selectedTool || connectionStatus !== 'connected'}
                className={`w-full px-4 py-2 border border-green-400 flex items-center justify-center gap-2 transition-all ${
                  executing 
                    ? 'bg-yellow-900/30 text-yellow-400 border-yellow-400' 
                    : connectionStatus !== 'connected'
                    ? 'bg-red-900/30 text-red-400 border-red-400'
                    : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                } ${(!selectedTool || executing || connectionStatus !== 'connected') ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={connectionStatus !== 'connected' ? 'Connect to WebSocket first' : ''}
              >
                {executing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Executing via WebSocket...
                  </>
                ) : connectionStatus !== 'connected' ? (
                  <>
                    <WifiOff className="w-4 h-4" />
                    Not Connected
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <Zap className="w-3 h-3" />
                    Execute Tool (WebSocket)
                  </>
                )}
              </button>
              
              {/* Streaming Progress */}
              {executing && streamingProgress.length > 0 && (
                <div className="mt-2 p-2 bg-black border border-green-900 rounded">
                  <div className="text-xs text-green-600 font-bold mb-1 flex items-center gap-2">
                    <Zap className="w-3 h-3" />
                    Real-time Streaming Output:
                  </div>
                  <div className="text-xs text-green-400 font-mono space-y-1 max-h-32 overflow-y-auto">
                    {streamingProgress.map((line, idx) => (
                      <div key={idx} className="animate-pulse">{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Result */}
              {executionResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${executionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      <Zap className="w-3 h-3" />
                      WebSocket Result: {executionResult.success ? '✅ SUCCESS' : '❌ FAILED'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600">{executionResult.executionTime}ms</span>
                      <button
                        onClick={handleCopyResult}
                        className="px-2 py-1 text-xs border border-green-900 text-green-600 hover:text-green-400 hover:border-green-400 flex items-center gap-1"
                      >
                        {copiedResult ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedResult ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Success Result */}
                  {executionResult.success && (
                    <div className="p-3 bg-green-950/30 border border-green-400 rounded">
                      <div className="text-green-400 text-xs font-mono">
                        <div className="mb-2 font-bold">Output:</div>
                        <pre className="whitespace-pre-wrap overflow-x-auto">
                          {typeof executionResult.data === 'string' 
                            ? executionResult.data 
                            : JSON.stringify(executionResult.data, null, 2)}
                        </pre>
                      </div>
                      {executionResult.metadata && (
                        <div className="mt-3 pt-2 border-t border-green-800 text-green-600 text-xs">
                          <div className="font-bold mb-1">Metadata:</div>
                          {Object.entries(executionResult.metadata).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span>{key}:</span>
                              <span>{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Error Result */}
                  {!executionResult.success && (
                    <div className="p-3 bg-red-950/30 border border-red-400 rounded">
                      <div className="text-red-400 text-xs">
                        <div className="font-bold mb-2">Error:</div>
                        <div className="bg-red-900/30 p-2 rounded font-mono">
                          {executionResult.error || 'Unknown error occurred'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Terminal className="w-12 h-12 text-green-600 animate-pulse" />
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <p className="text-green-600">Select a tool to view details and execute via WebSocket</p>
                <p className="text-xs text-green-700">
                  {filteredToolsCount} real-time tools available across {Object.keys(filteredCategories).length} categories
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MCPToolsWebSocket