import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BugRunner',
  description: 'AI-powered bug fix queue',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: '100vh', overflow: 'hidden' }}>{children}</body>
    </html>
  )
}
