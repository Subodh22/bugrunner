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

const STATUS_CONFIG = {
  pending: { label: 'Pending', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', pulse: false },
  running: { label: 'Running', dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700', pulse: true },
  done:    { label: 'Fixed',   dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', pulse: false },
  failed:  { label: 'Failed',  dot: 'bg-red-500', badge: 'bg-red-50 text-red-600', pulse: false },
}

function IconBug() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 4a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm0 12.5c-2.33 0-4.39-1.01-5.83-2.6.04-1.37.84-2.6 2.08-3.02 1.6-.58 3.9-.58 5.5 0 1.24.42 2.04 1.65 2.08 3.02A7.46 7.46 0 0112 19.5z" fill="currentColor"/>
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
      <path d="M1.5 1.5l8 4-8 4V1.5z"/>
    </svg>
  )
}

function IconX({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="2"/>
      <path d="M7 1.5V3M7 11v1.5M1.5 7H3M11 7h1.5M3.11 3.11l1.06 1.06M9.83 9.83l1.06 1.06M3.11 10.89l1.06-1.06M9.83 4.17l1.06-1.06"/>
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-300">
      <rect x="1.5" y="3.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="7" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1.5 14l5-4 3 2.5 4-5 5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [bugs, setBugs] = useState<Bug[]>([])
  const [settings, setSettings] = useState<Settings>({ workspacePath: '', runMode: 'sequential' })
  const [isRunning, setIsRunning] = useState(false)
  const [runLog, setRunLog] = useState<string[]>([])
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState('')

  const [showAddProject, setShowAddProject] = useState(false)
  const [showAddBug, setShowAddBug] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [newBugDesc, setNewBugDesc] = useState('')
  const [newBugScreenshot, setNewBugScreenshot] = useState<File | null>(null)
  const [settingsPath, setSettingsPath] = useState('')
  const [settingsRunMode, setSettingsRunMode] = useState<'sequential' | 'parallel'>('sequential')

  const logRef = useRef<HTMLDivElement>(null)
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const selectedBug = bugs.find(b => b.id === selectedBugId)

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
        setRunLog(l => [...l, `Starting ${event.total} bug(s) in "${event.projectName}"`])
        break
      case 'bug_start':
        setRunLog(l => [...l, `\n[${event.index}/${event.total}] "${event.preview}..."`])
        setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'running' } : b))
        break
      case 'progress':
        setRunLog(l => [...l, `  → ${event.message}`])
        break
      case 'bug_done':
        setRunLog(l => [...l, `  ✓ Fixed`])
        setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'done', output: event.output } : b))
        break
      case 'bug_failed':
        setRunLog(l => [...l, `  ✗ Failed: ${event.error}`])
        setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'failed', output: event.error } : b))
        break
      case 'complete':
        setRunLog(l => [...l, '\n✓ All done'])
        break
      case 'error':
        setRunLog(l => [...l, `Error: ${event.message}`])
        break
    }
  }

  const pendingCount = bugs.filter(b => b.status === 'pending').length

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 text-white">
              <IconBug />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-none">BugRunner</h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-none">AI bug fix queue</p>
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Projects</span>
            <button
              onClick={() => setShowAddProject(true)}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none font-light"
            >
              +
            </button>
          </div>

          {projects.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-8 px-3 leading-relaxed">
              No projects yet.<br />Add one to get started.
            </p>
          )}

          {projects.map(p => (
            <div
              key={p.id}
              className={`group flex items-center justify-between rounded-lg px-2.5 py-2 mb-0.5 cursor-pointer transition-colors ${
                selectedProjectId === p.id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
              onClick={() => setSelectedProjectId(p.id)}
            >
              <p className="text-sm font-medium truncate min-w-0">{p.name}</p>
              <button
                onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 ml-1 flex-shrink-0 transition-colors w-5 h-5 flex items-center justify-center"
              >
                <IconX size={10} />
              </button>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div className="px-2 py-3 border-t border-slate-800">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
          >
            <IconSettings />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedProjectId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-300">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M5 8h18M5 14h18M5 20h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No project selected</p>
              <p className="text-xs text-slate-400 mt-1.5">Pick a project from the sidebar, or create a new one</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{selectedProject?.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedProject?.path}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddBug(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm leading-none">+</span>
                  Add Bug
                </button>
                <button
                  onClick={() => runBugs()}
                  disabled={isRunning || pendingCount === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <IconPlay />
                      Run All ({pendingCount})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Run log */}
            {runLog.length > 0 && (
              <div
                ref={logRef}
                className="mx-6 mt-4 bg-slate-950 text-emerald-400 rounded-xl p-4 text-xs font-mono max-h-36 overflow-y-auto flex-shrink-0 border border-slate-800"
              >
                {runLog.map((line, i) => (
                  <div key={i} className="leading-relaxed">{line || ' '}</div>
                ))}
              </div>
            )}

            {/* Bug list */}
            <div className="flex-1 overflow-y-auto p-6">
              {bugs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full pb-20 text-slate-400">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-4">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">No bugs queued</p>
                  <p className="text-xs mt-1.5">Click &quot;Add Bug&quot; to add one to the queue</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bugs.map(bug => {
                    const s = STATUS_CONFIG[bug.status]
                    return (
                      <div
                        key={bug.id}
                        onClick={() => openBug(bug)}
                        className={`bg-white rounded-xl border cursor-pointer transition-all ${
                          selectedBugId === bug.id
                            ? 'border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="px-4 py-3.5 flex items-center gap-3.5">
                          {bug.screenshotPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/${bug.screenshotPath}`}
                              alt=""
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg border border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
                              <IconImage />
                            </div>
                          )}
                          <p className="flex-1 text-sm text-slate-700 line-clamp-2 leading-relaxed min-w-0">
                            {bug.description}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                              {s.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Bug Detail Panel */}
      {selectedBug && (
        <div className="w-[400px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedBug.status].dot} ${STATUS_CONFIG[selectedBug.status].pulse ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-medium text-slate-700">
                {STATUS_CONFIG[selectedBug.status].label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedBug.status === 'pending' && !isRunning && (
                <button
                  onClick={() => runBugs(selectedBug.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  <IconPlay /> Run
                </button>
              )}
              {(selectedBug.status === 'done' || selectedBug.status === 'failed') && (
                <button
                  onClick={() => resetBug(selectedBug.id)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Reset
                </button>
              )}
              <button
                onClick={() => { deleteBug(selectedBug.id); setSelectedBugId(null) }}
                className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedBugId(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-0.5"
              >
                <IconX />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Screenshot */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                Screenshot
              </label>
              {selectedBug.screenshotPath ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/${selectedBug.screenshotPath}`}
                    alt=""
                    className="w-full rounded-xl border border-slate-200 object-cover"
                  />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer">
                    <span className="text-white text-xs font-medium">Replace screenshot</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }}
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-28 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors group">
                  <div className="mb-1.5 group-hover:text-indigo-400 text-slate-300 transition-colors">
                    <IconImage />
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
                    Click to add screenshot
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }}
                  />
                </label>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                Description
              </label>
              <textarea
                value={editingDesc}
                onChange={e => setEditingDesc(e.target.value)}
                onBlur={saveDesc}
                rows={6}
                placeholder="Describe the bug..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
              />
              <p className="text-xs text-slate-400 mt-1.5">Saves automatically on blur</p>
            </div>

            {/* Output */}
            {selectedBug.output && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                  {selectedBug.status === 'done' ? 'Fix Summary' : 'Error Details'}
                </label>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-slate-50 rounded-xl p-3.5 border border-slate-100 leading-relaxed">
                  {selectedBug.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProject && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowAddProject(false)}
        >
          <div
            className="bg-white rounded-2xl w-[480px] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Project</h2>
              <p className="text-xs text-slate-400 mt-0.5">Connect a local repository to the fix queue</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Project Name</label>
                <input
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="My App"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Folder Path</label>
                <input
                  value={newProjectPath}
                  onChange={e => setNewProjectPath(e.target.value)}
                  placeholder="C:/Users/you/projects/my-app"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300"
                />
                {settings.workspacePath && (
                  <button
                    onClick={() => setNewProjectPath(settings.workspacePath)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 mt-1.5 transition-colors"
                  >
                    Use workspace: {settings.workspacePath}
                  </button>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAddProject(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addProject}
                disabled={!newProjectName.trim() || !newProjectPath.trim()}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition-colors"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bug Modal */}
      {showAddBug && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowAddBug(false)}
        >
          <div
            className="bg-white rounded-2xl w-[520px] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Report Bug</h2>
              <p className="text-xs text-slate-400 mt-0.5">Add a bug to the fix queue for {selectedProject?.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                <textarea
                  value={newBugDesc}
                  onChange={e => setNewBugDesc(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Describe the bug — include file names, reproduction steps, expected vs actual behavior..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Screenshot <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setNewBugScreenshot(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:transition-colors"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAddBug(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addBug}
                disabled={!newBugDesc.trim()}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition-colors"
              >
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-white rounded-2xl w-[480px] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Settings</h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure your workspace preferences</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Workspace Path</label>
                <input
                  value={settingsPath}
                  onChange={e => setSettingsPath(e.target.value)}
                  placeholder="C:/Users/you/projects"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300"
                />
                <p className="text-xs text-slate-400 mt-1.5">Projects will suggest subfolders of this path.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Run Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['sequential', 'parallel'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSettingsRunMode(mode)}
                      className={`py-3 px-4 rounded-xl border-2 text-left transition-all ${
                        settingsRunMode === mode
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`text-sm font-medium capitalize ${settingsRunMode === mode ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {mode}
                      </div>
                      <div className={`text-xs mt-0.5 ${settingsRunMode === mode ? 'text-indigo-500' : 'text-slate-400'}`}>
                        {mode === 'sequential' ? 'One at a time' : 'All at once'}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {settingsRunMode === 'sequential'
                    ? 'Bugs are fixed one at a time, in order.'
                    : 'All bugs run simultaneously. Faster, uses more resources.'}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
