import { NextRequest } from 'next/server'
import { store, Bug } from '@/lib/store'
import { getScreenshotAbsolutePath } from '@/lib/describe-screenshot'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function runBug(
  bug: Bug,
  projectPath: string,
  send: (data: object) => void
) {
  store.updateBug(bug.id, { status: 'running' })
  send({ type: 'bug_start', bugId: bug.id, preview: bug.description.slice(0, 60) })

  try {
    let screenshotContext = ''
    if (bug.screenshotPath) {
      const absPath = getScreenshotAbsolutePath(bug.screenshotPath)
      if (absPath) {
        screenshotContext = `\n\n**Screenshot:** There is a screenshot of the bug at this path: ${absPath}\nPlease read this image file to understand what the bug looks like visually.`
      }
    }

    const prompt = `Fix the following bug in this codebase:

${bug.description}${screenshotContext}

Please find and fix this bug. Make minimal, targeted changes. After fixing, briefly summarize what you changed and why.`

    send({ type: 'progress', bugId: bug.id, message: 'Claude is analyzing the codebase...' })

    let result = ''
    for await (const message of query({
      prompt,
      options: {
        cwd: projectPath,
        allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        maxTurns: 40,
      }
    })) {
      if ('result' in message) {
        result = (message as { result?: string }).result || ''
      }
    }

    store.updateBug(bug.id, { status: 'done', output: result })
    send({ type: 'bug_done', bugId: bug.id, output: result })

    // Auto-commit and push the fix to the project's git repo
    try {
      send({ type: 'progress', bugId: bug.id, message: 'Pushing fix to GitHub...' })
      const commitMsg = `fix: ${bug.description.slice(0, 72).replace(/"/g, "'")}`
      await execAsync(
        `git add -A && git commit -m "${commitMsg}" && git push`,
        { cwd: projectPath }
      )
      send({ type: 'progress', bugId: bug.id, message: 'Pushed to GitHub ✓' })
    } catch (pushErr) {
      const pushMsg = pushErr instanceof Error ? pushErr.message : String(pushErr)
      // Non-fatal — bug is still marked done even if push fails
      send({ type: 'progress', bugId: bug.id, message: `Git push skipped: ${pushMsg.split('\n')[0]}` })
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    store.updateBug(bug.id, { status: 'failed', output: errMsg })
    send({ type: 'bug_failed', bugId: bug.id, error: errMsg })
  }
}

export async function POST(req: NextRequest) {
  const { projectId, bugId } = await req.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        const projects = store.getProjects()
        const settings = store.getSettings()

        let bugsToRun: ReturnType<typeof store.getBugs> = []
        let project = null

        if (bugId) {
          const bug = store.getBugs().find(b => b.id === bugId)
          if (!bug) { send({ type: 'error', message: 'Bug not found' }); controller.close(); return }
          project = projects.find(p => p.id === bug.projectId)
          bugsToRun = [bug]
        } else if (projectId) {
          project = projects.find(p => p.id === projectId)
          bugsToRun = store.getBugs(projectId).filter(b => b.status === 'pending')
        }

        if (!project) { send({ type: 'error', message: 'Project not found' }); controller.close(); return }

        send({ type: 'start', total: bugsToRun.length, projectName: project.name, mode: settings.runMode })

        if (settings.runMode === 'parallel' && bugsToRun.length > 1) {
          // Run all bugs at the same time
          await Promise.all(bugsToRun.map(bug => runBug(bug, project!.path, send)))
        } else {
          // Run one at a time
          for (let i = 0; i < bugsToRun.length; i++) {
            send({ type: 'progress', bugId: bugsToRun[i].id, message: `Bug ${i + 1} of ${bugsToRun.length}` })
            await runBug(bugsToRun[i], project.path, send)
          }
        }

        send({ type: 'complete' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message: msg })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
