import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJSON<T>(file: string, def: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'))
  } catch { return def }
}

function writeJSON(file: string, data: unknown) {
  ensureDir()
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
}

export interface Project {
  id: string; name: string; path: string; createdAt: string
}

export interface Bug {
  id: string; projectId: string; description: string
  screenshotPath?: string; status: 'pending' | 'running' | 'done' | 'failed'
  output?: string; createdAt: string; updatedAt: string
}

export interface Settings {
  workspacePath: string
  runMode: 'sequential' | 'parallel'
}

export const store = {
  getProjects: (): Project[] => readJSON('projects.json', []),
  addProject(name: string, projectPath: string): Project {
    const projects = this.getProjects()
    const p: Project = { id: uuidv4(), name, path: projectPath, createdAt: new Date().toISOString() }
    writeJSON('projects.json', [...projects, p])
    return p
  },
  deleteProject(id: string) {
    writeJSON('projects.json', this.getProjects().filter(p => p.id !== id))
    writeJSON('bugs.json', this.getBugs().filter(b => b.projectId !== id))
  },
  getBugs(projectId?: string): Bug[] {
    const bugs = readJSON<Bug[]>('bugs.json', [])
    return projectId ? bugs.filter(b => b.projectId === projectId) : bugs
  },
  addBug(projectId: string, description: string, screenshotPath?: string): Bug {
    const bugs = readJSON<Bug[]>('bugs.json', [])
    const bug: Bug = {
      id: uuidv4(), projectId, description, screenshotPath,
      status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
    writeJSON('bugs.json', [...bugs, bug])
    return bug
  },
  updateBug(id: string, updates: Partial<Bug>): Bug {
    const bugs = readJSON<Bug[]>('bugs.json', [])
    const idx = bugs.findIndex(b => b.id === id)
    if (idx !== -1) {
      bugs[idx] = { ...bugs[idx], ...updates, updatedAt: new Date().toISOString() }
      writeJSON('bugs.json', bugs)
      return bugs[idx]
    }
    throw new Error('Bug not found')
  },
  deleteBug(id: string) {
    writeJSON('bugs.json', this.getBugs().filter(b => b.id !== id))
  },
  getSettings: (): Settings => readJSON('settings.json', { workspacePath: '', runMode: 'sequential' }),
  saveSettings: (s: Settings) => writeJSON('settings.json', s),
}
