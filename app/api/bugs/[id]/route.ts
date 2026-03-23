import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const updates = await req.json()
  return NextResponse.json(store.updateBug(id, updates))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  store.deleteBug(id)
  return NextResponse.json({ ok: true })
}
