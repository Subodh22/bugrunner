import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function GET() {
  return NextResponse.json(store.getProjects())
}

export async function POST(req: NextRequest) {
  const { name, path } = await req.json()
  if (!name || !path) return NextResponse.json({ error: 'name and path required' }, { status: 400 })
  return NextResponse.json(store.addProject(name, path))
}
