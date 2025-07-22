import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Network, 
  Wrench, 
  Terminal as TerminalIcon 
} from 'lucide-react'

const Navigation: React.FC = () => {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
    { to: '/swarm', icon: Network, label: 'SWARM' },
    { to: '/mcp-tools', icon: Wrench, label: 'MCP TOOLS' },
    { to: '/terminal', icon: TerminalIcon, label: 'TERMINAL' },
  ]

  return (
    <nav className="w-64 border-r border-green-900 bg-black/50 p-4">
      <div className="mb-8">
        <h2 className="text-lg font-bold text-green-400 mb-2">AGENTIC FLOW</h2>
        <p className="text-xs text-green-600">HIVEMIND CONSOLE v2.0.0</p>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-sm transition-all ${
                  isActive
                    ? 'bg-green-900/20 text-green-400 border-l-2 border-green-400'
                    : 'text-green-600 hover:text-green-400 hover:bg-green-900/10'
                }`
              }
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-8 pt-8 border-t border-green-900">
        <div className="text-xs text-green-600 space-y-1">
          <div>MEMORY: 87.3MB</div>
          <div>UPTIME: 04:23:17</div>
          <div>VERSION: 2.0.0-alpha</div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation