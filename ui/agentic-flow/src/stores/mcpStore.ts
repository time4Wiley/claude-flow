import { create } from 'zustand'

interface MCPTool {
  id: string
  name: string
  category: string
  description: string
  executions: number
  lastUsed: Date | null
  active: boolean
}

interface MCPState {
  tools: MCPTool[]
  activeTools: number
  totalExecutions: number
  
  // Actions
  setTools: (tools: MCPTool[]) => void
  toggleTool: (toolId: string) => void
  incrementExecution: (toolId: string) => void
}

export const useMCPStore = create<MCPState>((set) => ({
  tools: [],
  activeTools: 0,
  totalExecutions: 0,

  setTools: (tools) => set({ 
    tools,
    activeTools: tools.filter(t => t.active).length,
    totalExecutions: tools.reduce((sum, t) => sum + t.executions, 0)
  }),
  
  toggleTool: (toolId) => set((state) => {
    const tools = state.tools.map(t => 
      t.id === toolId ? { ...t, active: !t.active } : t
    )
    return {
      tools,
      activeTools: tools.filter(t => t.active).length
    }
  }),
  
  incrementExecution: (toolId) => set((state) => {
    const tools = state.tools.map(t => 
      t.id === toolId 
        ? { ...t, executions: t.executions + 1, lastUsed: new Date() }
        : t
    )
    return {
      tools,
      totalExecutions: state.totalExecutions + 1
    }
  }),
}))