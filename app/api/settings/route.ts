import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function GET() {
  return NextResponse.json(store.getSettings())
}

export async function POST(req: NextRequest) {
  const settings = await req.json()
  store.saveSettings(settings)
  return NextResponse.json(store.getSettings())
}
