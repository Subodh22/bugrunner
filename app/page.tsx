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

const STATUS_STYLES = {
  pending:  { dot: '#8E8E93', bg: 'rgba(120,120,128,0.12)', text: '#3C3C43', label: 'Pending' },
  running:  { dot: '#FF9500', bg: 'rgba(255,149,0,0.12)',   text: '#C07500', label: 'Running' },
  done:     { dot: '#34C759', bg: 'rgba(52,199,89,0.12)',   text: '#248A3D', label: 'Fixed' },
  failed:   { dot: '#FF3B30', bg: 'rgba(255,59,48,0.12)',   text: '#C0392B', label: 'Failed' },
}

function StatusBadge({ status }: { status: Bug['status'] }) {
  const s = STATUS_STYLES[status]
  return (
    <span style={{ background: s.bg, color: s.text }}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium">
      <span style={{ background: s.dot, width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        boxShadow: '0 32px 64px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)',
        width: 480,
        maxWidth: 'calc(100vw - 32px)',
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function AppleButton({
  onClick, disabled, variant = 'primary', size = 'md', children,
}: {
  onClick?: () => void; disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md'
  children: React.ReactNode
}) {
  const base = 'inline-flex items-center justify-center font-medium transition-all select-none rounded-xl'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary:     'text-white',
    secondary:   'text-[#007AFF]',
    ghost:       'text-[rgba(60,60,67,0.6)] hover:text-black',
    destructive: 'text-[#FF3B30]',
  }
  const bgMap = {
    primary:     disabled ? 'rgba(0,122,255,0.4)' : '#007AFF',
    secondary:   'rgba(0,122,255,0.1)',
    ghost:       'transparent',
    destructive: 'rgba(255,59,48,0.1)',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]}`}
      style={{ background: bgMap[variant], cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
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

  useEffect(() => { loadProjects(); loadSettings() }, [])
  useEffect(() => { if (selectedProjectId) loadBugs(selectedProjectId) }, [selectedProjectId])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [runLog])

  async function loadProjects() {
    const res = await fetch('/api/projects')
    setProjects(await res.json())
  }

  async function loadBugs(projectId: string) {
    const res = await fetch(`/api/bugs?projectId=${projectId}`)
    setBugs(await res.json())
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

  function openBug(bug: Bug) { setSelectedBugId(bug.id); setEditingDesc(bug.description) }

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
    const updated = await fetch(`/api/bugs/${selectedBugId}/screenshot`, { method: 'POST', body: fd }).then(r => r.json())
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
        try { handleRunEvent(JSON.parse(line.slice(6))) } catch {}
      }
    }
    setIsRunning(false)
    if (selectedProjectId) loadBugs(selectedProjectId)
  }

  function handleRunEvent(event: RunEvent) {
    switch (event.type) {
      case 'start':       setRunLog(l => [...l, `Starting ${event.total} bug(s) in "${event.projectName}"`]); break
      case 'bug_start':   setRunLog(l => [...l, `\n[${event.index}/${event.total}] "${event.preview}..."`]);
                          setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'running' } : b)); break
      case 'progress':    setRunLog(l => [...l, `  ${event.message}`]); break
      case 'bug_done':    setRunLog(l => [...l, `  Fixed`]);
                          setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'done', output: event.output } : b)); break
      case 'bug_failed':  setRunLog(l => [...l, `  Failed: ${event.error}`]);
                          setBugs(prev => prev.map(b => b.id === event.bugId ? { ...b, status: 'failed', output: event.error } : b)); break
      case 'complete':    setRunLog(l => [...l, '\nAll done']); break
      case 'error':       setRunLog(l => [...l, `Error: ${event.message}`]); break
    }
  }

  const pendingCount = bugs.filter(b => b.status === 'pending').length

  const inputStyle = {
    width: '100%',
    background: 'rgba(120,120,128,0.08)',
    border: '1px solid rgba(60,60,67,0.13)',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 14,
    outline: 'none',
    color: '#000',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  } as const

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--apple-bg)' }}>

      {/* Sidebar */}
      <aside style={{
        width: 240,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(60,60,67,0.13)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* App header */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(60,60,67,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(145deg, #007AFF, #0055D4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,122,255,0.35)',
              fontSize: 16, flexShrink: 0,
            }}>🐛</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.3, color: '#000' }}>BugRunner</p>
              <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.5)', marginTop: 0 }}>AI bug fix queue</p>
            </div>
          </div>
        </div>

        {/* Projects list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Projects
            </span>
            <button onClick={() => setShowAddProject(true)}
              style={{ fontSize: 11, color: '#007AFF', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
              + Add
            </button>
          </div>

          {projects.length === 0 && (
            <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.4)', textAlign: 'center', padding: '20px 16px', lineHeight: 1.5 }}>
              No projects yet.<br />Add one to get started.
            </p>
          )}

          {projects.map(p => (
            <div key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className="group"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderRadius: 8, padding: '7px 10px', marginBottom: 2,
                cursor: 'pointer',
                background: selectedProjectId === p.id ? '#007AFF' : 'transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (selectedProjectId !== p.id) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)' }}
              onMouseLeave={e => { if (selectedProjectId !== p.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: selectedProjectId === p.id ? '#fff' : '#000',
                }}>{p.name}</p>
                <p style={{
                  fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: selectedProjectId === p.id ? 'rgba(255,255,255,0.65)' : 'rgba(60,60,67,0.45)',
                  marginTop: 1,
                }}>{p.path}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                style={{
                  opacity: 0, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, lineHeight: 1, flexShrink: 0, marginLeft: 6,
                  color: selectedProjectId === p.id ? 'rgba(255,255,255,0.8)' : 'rgba(60,60,67,0.5)',
                  padding: '2px 4px', borderRadius: 4,
                }}
                className="group-hover:opacity-100 transition-opacity">
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Settings footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(60,60,67,0.08)' }}>
          <button onClick={() => setShowSettings(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'rgba(60,60,67,0.55)', padding: '4px 2px', borderRadius: 6,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#000'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(60,60,67,0.55)'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedProjectId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'rgba(120,120,128,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 28,
              }}>🐛</div>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#000', marginBottom: 4 }}>No project selected</p>
              <p style={{ fontSize: 14, color: 'rgba(60,60,67,0.5)' }}>Select a project from the sidebar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={{
              padding: '0 24px',
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(60,60,67,0.1)',
              flexShrink: 0,
            }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3, color: '#000' }}>{selectedProject?.name}</p>
                <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 1 }}>{selectedProject?.path}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AppleButton variant="secondary" onClick={() => setShowAddBug(true)}>
                  + Add Bug
                </AppleButton>
                <AppleButton
                  onClick={() => runBugs()}
                  disabled={isRunning || pendingCount === 0}>
                  {isRunning ? 'Running…' : `Run All  ${pendingCount > 0 ? `(${pendingCount})` : ''}`}
                </AppleButton>
              </div>
            </div>

            {/* Run log */}
            {runLog.length > 0 && (
              <div ref={logRef}
                style={{
                  margin: '16px 24px 0',
                  background: '#1C1C1E',
                  borderRadius: 12,
                  padding: '12px 16px',
                  maxHeight: 128,
                  overflowY: 'auto',
                  flexShrink: 0,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>Run Log</p>
                {runLog.map((line, i) => (
                  <div key={i} style={{ fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace', fontSize: 11.5, color: '#30D158', lineHeight: 1.6 }}>
                    {line || ' '}
                  </div>
                ))}
              </div>
            )}

            {/* Bug list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
              {bugs.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 64 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: 'rgba(52,199,89,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 14px', fontSize: 24,
                  }}>✓</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#000', marginBottom: 4 }}>No bugs queued</p>
                  <p style={{ fontSize: 13, color: 'rgba(60,60,67,0.5)' }}>Click &quot;+ Add Bug&quot; to queue one</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bugs.map(bug => (
                    <div key={bug.id}
                      onClick={() => openBug(bug)}
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: selectedBugId === bug.id
                          ? '1.5px solid #007AFF'
                          : '1px solid rgba(60,60,67,0.1)',
                        boxShadow: selectedBugId === bug.id
                          ? '0 0 0 3px rgba(0,122,255,0.12)'
                          : '0 1px 4px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        overflow: 'hidden',
                      }}>
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        {bug.screenshotPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/${bug.screenshotPath}`} alt="Screenshot"
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(60,60,67,0.1)', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                            border: '1.5px dashed rgba(60,60,67,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'rgba(60,60,67,0.25)', fontSize: 18,
                          }}>+</div>
                        )}
                        <p style={{ flex: 1, fontSize: 14, color: '#1C1C1E', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {bug.description}
                        </p>
                        <StatusBadge status={bug.status} />
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
        <div style={{
          width: 360,
          flexShrink: 0,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(60,60,67,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Panel toolbar */}
          <div style={{
            padding: '0 16px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(60,60,67,0.1)',
            flexShrink: 0,
          }}>
            <StatusBadge status={selectedBug.status} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedBug.status === 'pending' && !isRunning && (
                <AppleButton size="sm" onClick={() => runBugs(selectedBug.id)}>Run</AppleButton>
              )}
              {(selectedBug.status === 'done' || selectedBug.status === 'failed') && (
                <AppleButton size="sm" variant="secondary" onClick={() => resetBug(selectedBug.id)}>Reset</AppleButton>
              )}
              <AppleButton size="sm" variant="destructive" onClick={() => deleteBug(selectedBug.id)}>Delete</AppleButton>
              <button onClick={() => setSelectedBugId(null)}
                style={{
                  background: 'rgba(120,120,128,0.12)', border: 'none', cursor: 'pointer',
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(60,60,67,0.6)', fontSize: 14, lineHeight: 1, marginLeft: 2,
                }}>×</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Screenshot */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Screenshot</p>
              {selectedBug.screenshotPath ? (
                <div style={{ position: 'relative' }} className="group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/${selectedBug.screenshotPath}`} alt="Screenshot"
                    style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(60,60,67,0.1)', display: 'block' }} />
                  <label style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.45)', borderRadius: 12, cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s',
                  }} className="group-hover:opacity-100">
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>Change screenshot</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }} />
                  </label>
                </div>
              ) : (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 110, border: '1.5px dashed rgba(60,60,67,0.2)', borderRadius: 12,
                  cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                  background: 'rgba(120,120,128,0.04)',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#007AFF'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,122,255,0.04)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(60,60,67,0.2)'; (e.currentTarget as HTMLElement).style.background = 'rgba(120,120,128,0.04)' }}>
                  <span style={{ fontSize: 22, marginBottom: 6 }}>📷</span>
                  <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)' }}>Add screenshot</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }} />
                </label>
              )}
            </div>

            {/* Description */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Description</p>
              <textarea
                value={editingDesc}
                onChange={e => setEditingDesc(e.target.value)}
                onBlur={saveDesc}
                rows={6}
                placeholder="Describe the bug..."
                style={{
                  ...inputStyle,
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
                onFocus={e => {
                  (e.target as HTMLTextAreaElement).style.borderColor = '#007AFF'
                  ;(e.target as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)'
                }}
                onBlurCapture={e => {
                  ;(e.target as HTMLTextAreaElement).style.borderColor = 'rgba(60,60,67,0.13)'
                  ;(e.target as HTMLTextAreaElement).style.boxShadow = 'none'
                  saveDesc()
                }}
              />
              <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', marginTop: 4 }}>Auto-saves on blur</p>
            </div>

            {/* Output */}
            {selectedBug.output && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  {selectedBug.status === 'done' ? 'Fix Summary' : 'Error'}
                </p>
                <pre style={{
                  fontSize: 12, color: '#1C1C1E', whiteSpace: 'pre-wrap',
                  fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
                  background: 'rgba(120,120,128,0.06)', borderRadius: 10,
                  padding: '12px 14px', border: '1px solid rgba(60,60,67,0.08)',
                  lineHeight: 1.6, margin: 0,
                }}>
                  {selectedBug.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProject && (
        <Modal onClose={() => setShowAddProject(false)}>
          <div style={{ padding: '24px 24px 20px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4, marginBottom: 20 }}>New Project</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(60,60,67,0.7)', marginBottom: 6 }}>Name</label>
                <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                  placeholder="My React App" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(60,60,67,0.13)'; e.target.style.boxShadow = 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(60,60,67,0.7)', marginBottom: 6 }}>Folder Path</label>
                <input value={newProjectPath} onChange={e => setNewProjectPath(e.target.value)}
                  placeholder={settings.workspacePath ? `${settings.workspacePath}/my-app` : 'C:/Users/you/projects/my-app'}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(60,60,67,0.13)'; e.target.style.boxShadow = 'none' }} />
                {settings.workspacePath && (
                  <button onClick={() => setNewProjectPath(settings.workspacePath)}
                    style={{ fontSize: 11, color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>
                    Use workspace: {settings.workspacePath}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid rgba(60,60,67,0.08)' }}>
            <AppleButton variant="ghost" onClick={() => setShowAddProject(false)}>Cancel</AppleButton>
            <AppleButton onClick={addProject} disabled={!newProjectName.trim() || !newProjectPath.trim()}>Add Project</AppleButton>
          </div>
        </Modal>
      )}

      {/* Add Bug Modal */}
      {showAddBug && (
        <Modal onClose={() => setShowAddBug(false)}>
          <div style={{ padding: '24px 24px 20px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4, marginBottom: 20 }}>New Bug</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(60,60,67,0.7)', marginBottom: 6 }}>Description</label>
                <textarea value={newBugDesc} onChange={e => setNewBugDesc(e.target.value)}
                  rows={5} autoFocus
                  placeholder="Describe the bug. Include file names, steps to reproduce, expected vs actual behaviour…"
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                  onFocus={e => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(60,60,67,0.13)'; e.target.style.boxShadow = 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(60,60,67,0.7)', marginBottom: 6 }}>Screenshot <span style={{ color: 'rgba(60,60,67,0.4)', fontWeight: 400 }}>(optional)</span></label>
                <input type="file" accept="image/*" onChange={e => setNewBugScreenshot(e.target.files?.[0] || null)}
                  style={{ fontSize: 13, color: 'rgba(60,60,67,0.6)', width: '100%' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid rgba(60,60,67,0.08)' }}>
            <AppleButton variant="ghost" onClick={() => setShowAddBug(false)}>Cancel</AppleButton>
            <AppleButton onClick={addBug} disabled={!newBugDesc.trim()}>Add Bug</AppleButton>
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)}>
          <div style={{ padding: '24px 24px 20px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4, marginBottom: 20 }}>Settings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(60,60,67,0.7)', marginBottom: 6 }}>Default Workspace Folder</label>
                <input value={settingsPath} onChange={e => setSettingsPath(e.target.value)}
                  placeholder="C:/Users/you/projects" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(60,60,67,0.13)'; e.target.style.boxShadow = 'none' }} />
                <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.4)', marginTop: 5 }}>Projects will default to subfolders of this path.</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(60,60,67,0.7)', marginBottom: 8 }}>Run Mode</label>
                {/* Segmented control */}
                <div style={{
                  display: 'flex', background: 'rgba(120,120,128,0.12)',
                  borderRadius: 10, padding: 2, gap: 2,
                }}>
                  {(['sequential', 'parallel'] as const).map(mode => (
                    <button key={mode} onClick={() => setSettingsRunMode(mode)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                        background: settingsRunMode === mode
                          ? '#fff'
                          : 'transparent',
                        color: settingsRunMode === mode ? '#000' : 'rgba(60,60,67,0.6)',
                        boxShadow: settingsRunMode === mode
                          ? '0 1px 4px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)'
                          : 'none',
                      }}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.4)', marginTop: 6 }}>
                  {settingsRunMode === 'sequential'
                    ? 'Bugs are fixed one at a time, in order.'
                    : 'All bugs are fixed simultaneously (faster, uses more resources).'}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid rgba(60,60,67,0.08)' }}>
            <AppleButton variant="ghost" onClick={() => setShowSettings(false)}>Cancel</AppleButton>
            <AppleButton onClick={saveSettings}>Save</AppleButton>
          </div>
        </Modal>
      )}
    </div>
  )
}
