'use client'

import { useState, useEffect, useRef } from 'react'

// Types
interface Project { id: string; name: string; path: string; createdAt: string }
interface Bug {
  id: string; projectId: string; description: string
  screenshotPath?: string; status: 'pending' | 'running' | 'done' | 'failed'
  output?: string; createdAt: string; updatedAt: string
}
interface Settings { workspacePath: string; runMode: 'sequential' | 'parallel' }
interface RunEvent {
  type: 'start' | 'bug_start' | 'progress' | 'bug_done' | 'bug_failed' | 'complete' | 'error'
  bugId?: string; preview?: string; index?: number; total?: number
  output?: string; error?: string; message?: string; projectName?: string
}

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS = { pending: 'Pending', running: 'Running...', done: 'Fixed', failed: 'Failed' }

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [bugs, setBugs] = useState<Bug[]>([])
  const [settings, setSettings] = useState<Settings>({ workspacePath: '', runMode: 'sequential' })
  const [isRunning, setIsRunning] = useState(false)
  const [runLog, setRunLog] = useState<string[]>([])
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState('')

  // Modals
  const [showAddProject, setShowAddProject] = useState(false)
  const [showAddBug, setShowAddBug] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Form state
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [newBugDesc, setNewBugDesc] = useState('')
  const [newBugScreenshot, setNewBugScreenshot] = useState<File | null>(null)
  const [settingsPath, setSettingsPath] = useState('')
  const [settingsRunMode, setSettingsRunMode] = useState<'sequential' | 'parallel'>('sequential')

  const logRef = useRef<HTMLDivElement>(null)
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const selectedBug = bugs.find(b => b.id === selectedBugId)

  // Load initial data
  useEffect(() => {
    loadProjects()
    loadSettings()
  }, [])

  useEffect(() => {
    if (selectedProjectId) loadBugs(selectedProjectId)
  }, [selectedProjectId])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [runLog])

  async function loadProjects() {
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data)
  }

  async function loadBugs(projectId: string) {
    const res = await fetch(`/api/bugs?projectId=${projectId}`)
    const data = await res.json()
    setBugs(data)
  }

  async function loadSettings() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data)
    setSettingsPath(data.workspacePath || '')
    setSettingsRunMode(data.runMode || 'sequential')
  }

  async function addProject() {
    if (!newProjectName.trim() || !newProjectPath.trim()) return
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName.trim(), path: newProjectPath.trim() })
    })
    setNewProjectName(''); setNewProjectPath('')
    setShowAddProject(false)
    loadProjects()
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project and all its bugs?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (selectedProjectId === id) setSelectedProjectId(null)
    loadProjects()
  }

  async function addBug() {
    if (!selectedProjectId || !newBugDesc.trim()) return
    const fd = new FormData()
    fd.append('projectId', selectedProjectId)
    fd.append('description', newBugDesc.trim())
    if (newBugScreenshot) fd.append('screenshot', newBugScreenshot)
    await fetch('/api/bugs', { method: 'POST', body: fd })
    setNewBugDesc(''); setNewBugScreenshot(null)
    setShowAddBug(false)
    loadBugs(selectedProjectId)
  }

  function openBug(bug: Bug) {
    setSelectedBugId(bug.id)
    setEditingDesc(bug.description)
  }

  async function saveDesc() {
    if (!selectedBugId || !editingDesc.trim()) return
    const updated = await fetch(`/api/bugs/${selectedBugId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: editingDesc.trim() })
    }).then(r => r.json())
    setBugs(prev => prev.map(b => b.id === updated.id ? updated : b))
  }

  async function uploadScreenshot(file: File) {
    if (!selectedBugId) return
    const fd = new FormData()
    fd.append('screenshot', file)
    const updated = await fetch(`/api/bugs/${selectedBugId}/screenshot`, {
      method: 'POST', body: fd
    }).then(r => r.json())
    setBugs(prev => prev.map(b => b.id === updated.id ? updated : b))
  }

  async function deleteBug(id: string) {
    await fetch(`/api/bugs/${id}`, { method: 'DELETE' })
    setBugs(prev => prev.filter(b => b.id !== id))
    if (selectedBugId === id) setSelectedBugId(null)
  }

  async function resetBug(id: string) {
    const updated = await fetch(`/api/bugs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', output: '' })
    }).then(r => r.json())
    setBugs(prev => prev.map(b => b.id === updated.id ? updated : b))
  }

  async function saveSettings() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath: settingsPath, runMode: settingsRunMode })
    })
    setShowSettings(false)
    loadSettings()
  }

  async function runBugs(bugId?: string) {
    if (isRunning) return
    const projectId = selectedProjectId
    if (!bugId && !projectId) return

    setIsRunning(true)
    setRunLog([])

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: bugId ? undefined : projectId, bugId })
    })

    if (!res.body) { setIsRunning(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event: RunEvent = JSON.parse(line.slice(6))
          handleRunEvent(event)
        } catch {}
      }
    }

    setIsRunning(false)
    if (selectedProjectId) loadBugs(selectedProjectId)
  }

  function handleRunEvent(event: RunEvent) {
    switch (event.type) {
      case 'start':
        setRunLog(l => [...l, `Starting: ${event.total} bug(s) to fix in "${event.projectName}"`])
        break
      case 'bug_start':
        setRunLog(l => [...l, `\n[${event.index}/${event.total}] Working on: "${event.preview}..."`])
        setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'running' } : b))
        break
      case 'progress':
        setRunLog(l => [...l, `  → ${event.message}`])
        break
      case 'bug_done':
        setRunLog(l => [...l, `  ✓ Fixed!`])
        setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'done', output: event.output } : b))
        break
      case 'bug_failed':
        setRunLog(l => [...l, `  ✗ Failed: ${event.error}`])
        setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'failed', output: event.error } : b))
        break
      case 'complete':
        setRunLog(l => [...l, '\n✓ All done!'])
        break
      case 'error':
        setRunLog(l => [...l, `Error: ${event.message}`])
        break
    }
  }

  const pendingCount = bugs.filter(b => b.status === 'pending').length

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">BugRunner</h1>
          <p className="text-xs text-gray-500 mt-0.5">AI-powered bug fix queue</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
            <button onClick={() => setShowAddProject(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add</button>
          </div>

          {projects.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No projects yet.<br />Add one to get started.</p>
          )}

          {projects.map(p => (
            <div key={p.id}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 mb-1 cursor-pointer transition-colors ${
                selectedProjectId === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedProjectId(p.id)}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-gray-400 truncate">{p.path}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 ml-2 flex-shrink-0 text-lg leading-none">×</button>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200">
          <button onClick={() => setShowSettings(true)}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-700 flex items-center gap-2">
            <span>⚙️</span> Settings
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedProjectId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-4xl mb-3">🐛</p>
              <p className="text-lg font-medium">Select a project</p>
              <p className="text-sm">or add one from the sidebar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedProject?.name}</h2>
                <p className="text-xs text-gray-400">{selectedProject?.path}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowAddBug(true)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                  + Add Bug
                </button>
                <button
                  onClick={() => runBugs()}
                  disabled={isRunning || pendingCount === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                  {isRunning ? '⏳ Running...' : `▶ Run All (${pendingCount})`}
                </button>
              </div>
            </div>

            {/* Run log */}
            {runLog.length > 0 && (
              <div ref={logRef} className="mx-6 mt-4 bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono max-h-36 overflow-y-auto flex-shrink-0">
                {runLog.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}

            {/* Bug list */}
            <div className="flex-1 overflow-y-auto p-6">
              {bugs.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-3xl mb-3">✓</p>
                  <p className="font-medium">No bugs queued</p>
                  <p className="text-sm">Click &quot;+ Add Bug&quot; to queue one</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bugs.map(bug => (
                    <div key={bug.id}
                      onClick={() => openBug(bug)}
                      className={`bg-white rounded-xl border cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all overflow-hidden ${
                        selectedBugId === bug.id ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-200'
                      }`}>
                      <div className="p-4 flex items-center gap-3">
                        {bug.screenshotPath && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/${bug.screenshotPath}`} alt="Screenshot"
                            className="w-12 h-12 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                        )}
                        {!bug.screenshotPath && (
                          <div className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-300 text-lg">
                            +
                          </div>
                        )}
                        <p className="flex-1 text-sm text-gray-700 line-clamp-2">{bug.description}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[bug.status]}`}>
                          {STATUS_LABELS[bug.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Bug Detail Panel */}
      {selectedBug && (
        <div className="w-96 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedBug.status]}`}>
              {STATUS_LABELS[selectedBug.status]}
            </span>
            <div className="flex items-center gap-2">
              {selectedBug.status === 'pending' && !isRunning && (
                <button onClick={() => runBugs(selectedBug.id)}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  ▶ Run
                </button>
              )}
              {(selectedBug.status === 'done' || selectedBug.status === 'failed') && (
                <button onClick={() => resetBug(selectedBug.id)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                  Reset
                </button>
              )}
              <button onClick={() => { deleteBug(selectedBug.id); setSelectedBugId(null) }}
                className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                Delete
              </button>
              <button onClick={() => setSelectedBugId(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-1">×</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Screenshot */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Screenshot</label>
              {selectedBug.screenshotPath ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/${selectedBug.screenshotPath}`} alt="Screenshot"
                    className="w-full rounded-xl border border-gray-200 object-cover" />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer">
                    <span className="text-white text-sm font-medium">Change screenshot</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-sm text-gray-400">Click to add screenshot</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }} />
                </label>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</label>
              <textarea
                value={editingDesc}
                onChange={e => setEditingDesc(e.target.value)}
                onBlur={saveDesc}
                rows={6}
                placeholder="Describe the bug..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">Auto-saves when you click away</p>
            </div>

            {/* Output */}
            {selectedBug.output && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {selectedBug.status === 'done' ? 'Fix Summary' : 'Error'}
                </label>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {selectedBug.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddProject(false)}>
          <div className="bg-white rounded-2xl p-6 w-[480px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Project</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                  placeholder="e.g. My React App"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Folder Path</label>
                <input value={newProjectPath} onChange={e => setNewProjectPath(e.target.value)}
                  placeholder={settings.workspacePath ? `e.g. ${settings.workspacePath}/my-app` : 'e.g. C:/Users/you/projects/my-app'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {settings.workspacePath && (
                  <button onClick={() => setNewProjectPath(settings.workspacePath)}
                    className="text-xs text-blue-600 mt-1">Use workspace: {settings.workspacePath}</button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddProject(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={addProject}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Add Project</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bug Modal */}
      {showAddBug && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddBug(false)}>
          <div className="bg-white rounded-2xl p-6 w-[520px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Bug</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newBugDesc} onChange={e => setNewBugDesc(e.target.value)}
                  rows={5} autoFocus
                  placeholder="Describe the bug. Include file names, steps to reproduce, what you expect vs what you see..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot (optional)</label>
                <input type="file" accept="image/*" onChange={e => setNewBugScreenshot(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddBug(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={addBug} disabled={!newBugDesc.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">Add Bug</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl p-6 w-[480px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Workspace Folder</label>
                <input value={settingsPath} onChange={e => setSettingsPath(e.target.value)}
                  placeholder="e.g. C:/Users/you/projects"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Projects will default to subfolders of this path.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Run Mode</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSettingsRunMode('sequential')}
                    className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      settingsRunMode === 'sequential'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    Sequential
                  </button>
                  <button
                    onClick={() => setSettingsRunMode('parallel')}
                    className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      settingsRunMode === 'parallel'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    Parallel
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {settingsRunMode === 'sequential'
                    ? 'Bugs are fixed one at a time, in order.'
                    : 'All bugs are fixed simultaneously (faster, uses more resources).'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={saveSettings}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
