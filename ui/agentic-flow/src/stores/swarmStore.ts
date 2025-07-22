import { create } from 'zustand'

interface Agent {
  id: string
  name: string
  type: string
  status: 'idle' | 'busy' | 'error'
  taskCount: number
  performance: number
}

interface SwarmState {
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star'
  agents: Agent[]
  maxAgents: number
  activeTaskCount: number
  completedTaskCount: number
  
  // Actions
  setTopology: (topology: SwarmState['topology']) => void
  addAgent: (agent: Agent) => void
  removeAgent: (agentId: string) => void
  updateAgentStatus: (agentId: string, status: Agent['status']) => void
  incrementTaskCount: () => void
}

export const useSwarmStore = create<SwarmState>((set) => ({
  topology: 'hierarchical',
  agents: [],
  maxAgents: 8,
  activeTaskCount: 0,
  completedTaskCount: 0,

  setTopology: (topology) => set({ topology }),
  
  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, agent]
  })),
  
  removeAgent: (agentId) => set((state) => ({
    agents: state.agents.filter(a => a.id !== agentId)
  })),
  
  updateAgentStatus: (agentId, status) => set((state) => ({
    agents: state.agents.map(a => 
      a.id === agentId ? { ...a, status } : a
    )
  })),
  
  incrementTaskCount: () => set((state) => ({
    completedTaskCount: state.completedTaskCount + 1
  })),
}))