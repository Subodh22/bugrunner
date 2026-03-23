import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const screenshot = formData.get('screenshot') as File | null

  if (!screenshot || screenshot.size === 0) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  const ext = screenshot.name.split('.').pop() || 'png'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const bytes = await screenshot.arrayBuffer()
  await writeFile(path.join(process.cwd(), 'public', 'uploads', filename), Buffer.from(bytes))

  const bug = store.updateBug(id, { screenshotPath: `uploads/${filename}` })
  return NextResponse.json(bug)
}
