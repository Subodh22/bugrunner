import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  store.deleteProject(id)
  return NextResponse.json({ ok: true })
}
