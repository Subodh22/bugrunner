import fs from 'fs'
import path from 'path'

export function getScreenshotAbsolutePath(screenshotRelPath: string): string | null {
  const absolutePath = path.join(process.cwd(), 'public', screenshotRelPath)
  return fs.existsSync(absolutePath) ? absolutePath : null
}
