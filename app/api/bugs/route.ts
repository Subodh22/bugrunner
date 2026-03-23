import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId') || undefined
  return NextResponse.json(store.getBugs(projectId))
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const projectId = formData.get('projectId') as string
  const description = formData.get('description') as string
  const screenshot = formData.get('screenshot') as File | null

  if (!projectId || !description) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  let screenshotPath: string | undefined
  if (screenshot && screenshot.size > 0) {
    const ext = screenshot.name.split('.').pop() || 'png'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const bytes = await screenshot.arrayBuffer()
    await writeFile(path.join(process.cwd(), 'public', 'uploads', filename), Buffer.from(bytes))
    screenshotPath = `uploads/${filename}`
  }

  const bug = store.addBug(projectId, description, screenshotPath)
  return NextResponse.json(bug)
}
