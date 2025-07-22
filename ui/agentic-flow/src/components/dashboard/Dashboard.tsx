import React from 'react'
import { motion } from 'framer-motion'

const Dashboard: React.FC = () => {
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold mb-6 glitch" data-text="HIVEMIND DASHBOARD">
          HIVEMIND DASHBOARD
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Swarm Status Card */}
          <div className="retro-panel">
            <h2 className="text-lg font-semibold mb-4 text-green-400">SWARM STATUS</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-600">Topology:</span>
                <span className="text-green-400">HIERARCHICAL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Active Agents:</span>
                <span className="text-green-400">5/5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Tasks Completed:</span>
                <span className="text-green-400">127</span>
              </div>
            </div>
          </div>

          {/* MCP Tools Card */}
          <div className="retro-panel">
            <h2 className="text-lg font-semibold mb-4 text-green-400">MCP TOOLS</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-600">Available:</span>
                <span className="text-green-400">71</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Active:</span>
                <span className="text-green-400">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Executions:</span>
                <span className="text-green-400">3,482</span>
              </div>
            </div>
          </div>

          {/* Performance Card */}
          <div className="retro-panel">
            <h2 className="text-lg font-semibold mb-4 text-green-400">PERFORMANCE</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-600">CPU Usage:</span>
                <span className="text-green-400">23.4%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Memory:</span>
                <span className="text-green-400">87.3MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Token Rate:</span>
                <span className="text-green-400">1.2K/s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="mt-8 retro-panel">
          <h2 className="text-lg font-semibold mb-4 text-green-400">ACTIVITY LOG</h2>
          <div className="font-mono text-xs space-y-1 text-green-600">
            <div>[19:40:12] Agent RESEARCHER completed task: API pattern analysis</div>
            <div>[19:40:08] Agent CODER spawned for: Authentication implementation</div>
            <div>[19:40:05] Swarm topology optimized: HIERARCHICAL mode</div>
            <div>[19:40:01] MCP tool executed: memory_usage (store)</div>
            <div>[19:39:58] Neural training completed: 98.7% accuracy</div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard