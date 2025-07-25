import React, { useState, useMemo } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

interface ResponseViewerProps {
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    data: any
  }
  executionTime: number | null
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, executionTime }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'raw'>('body')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const statusColor = response.status >= 200 && response.status < 300 
    ? 'text-green-400' 
    : response.status >= 400 
    ? 'text-red-400' 
    : 'text-yellow-400'

  const copyResponse = () => {
    const content = activeTab === 'headers' 
      ? JSON.stringify(response.headers, null, 2)
      : JSON.stringify(response.data, null, 2)
    
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedNodes(newExpanded)
  }

  const renderJsonTree = (data: any, path: string = '', depth: number = 0): React.ReactNode => {
    if (data === null) return <span className="text-gray-500">null</span>
    if (data === undefined) return <span className="text-gray-500">undefined</span>
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data)
      const isExpanded = expandedNodes.has(path) || depth === 0
      
      return (
        <div className="ml-4">
          <span 
            className="cursor-pointer hover:text-green-300"
            onClick={() => toggleNode(path)}
          >
            {isExpanded ? <ChevronDown className="inline w-3 h-3" /> : <ChevronRight className="inline w-3 h-3" />}
            <span className="text-gray-500"> {`{`}</span>
            {!isExpanded && <span className="text-gray-500">{` ... ${keys.length} keys }`}</span>}
          </span>
          {isExpanded && (
            <>
              {keys.map((key, index) => (
                <div key={key} className="ml-4">
                  <span className="text-blue-400">"{key}"</span>
                  <span className="text-gray-500">: </span>
                  {renderJsonTree(data[key], `${path}.${key}`, depth + 1)}
                  {index < keys.length - 1 && <span className="text-gray-500">,</span>}
                </div>
              ))}
              <div className="text-gray-500">{`}`}</div>
            </>
          )}
        </div>
      )
    }
    
    if (Array.isArray(data)) {
      const isExpanded = expandedNodes.has(path) || depth === 0
      
      return (
        <div className="ml-4">
          <span 
            className="cursor-pointer hover:text-green-300"
            onClick={() => toggleNode(path)}
          >
            {isExpanded ? <ChevronDown className="inline w-3 h-3" /> : <ChevronRight className="inline w-3 h-3" />}
            <span className="text-gray-500"> [</span>
            {!isExpanded && <span className="text-gray-500">{` ... ${data.length} items ]`}</span>}
          </span>
          {isExpanded && (
            <>
              {data.map((item, index) => (
                <div key={index} className="ml-4">
                  {renderJsonTree(item, `${path}[${index}]`, depth + 1)}
                  {index < data.length - 1 && <span className="text-gray-500">,</span>}
                </div>
              ))}
              <div className="text-gray-500">]</div>
            </>
          )}
        </div>
      )
    }
    
    if (typeof data === 'string') {
      return <span className="text-green-400">"{data}"</span>
    }
    
    if (typeof data === 'number') {
      return <span className="text-yellow-400">{data}</span>
    }
    
    if (typeof data === 'boolean') {
      return <span className="text-purple-400">{data.toString()}</span>
    }
    
    return <span className="text-gray-400">{String(data)}</span>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-900 border border-green-900 rounded mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            <span className={`font-bold ${statusColor}`}>
              {response.status} {response.statusText}
            </span>
          </div>
          {executionTime && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Time:</span>
              <span className="text-xs text-green-400">{executionTime}ms</span>
            </div>
          )}
        </div>
        <button
          onClick={copyResponse}
          className="px-2 py-1 text-xs text-green-600 hover:text-green-400 transition-colors flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          Copy
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-green-900 mb-4">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'body'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-green-600 hover:text-green-400'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'headers'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-green-600 hover:text-green-400'
          }`}
        >
          Headers
        </button>
        <button
          onClick={() => setActiveTab('raw')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'raw'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-green-600 hover:text-green-400'
          }`}
        >
          Raw
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'body' && (
          <div className="font-mono text-xs">
            {typeof response.data === 'object' ? (
              renderJsonTree(response.data)
            ) : (
              <pre className="text-green-400 whitespace-pre-wrap">{response.data}</pre>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="space-y-2">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="text-blue-400 font-mono">{key}:</span>
                <span className="text-green-400 font-mono">{value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'raw' && (
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap bg-gray-900 p-4 rounded border border-green-900">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

export default ResponseViewer