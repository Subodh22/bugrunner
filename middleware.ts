import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.APP_PASSWORD || 'changeme'

export function middleware(req: NextRequest) {
  // Skip auth check for the login page and auth API
  const { pathname } = req.nextUrl
  if (pathname === '/login' || pathname === '/api/auth') {
    return NextResponse.next()
  }

  // Check session cookie
  const session = req.cookies.get('session')?.value
  if (session === PASSWORD) {
    return NextResponse.next()
  }

  // Redirect to login
  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
