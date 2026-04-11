import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { resolvePathWithinRoot } from '../security'

const TOOL_OUTPUT_MAX_CHARS = 60_000
const TOOL_COMMAND_TIMEOUT_MS = 20_000
const TOOL_COMMAND_MAX_BUFFER = 1024 * 1024 * 2

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function truncateOutput(value: string): string {
  if (value.length <= TOOL_OUTPUT_MAX_CHARS) return value
  return value.slice(0, TOOL_OUTPUT_MAX_CHARS) + '\n... (truncated)'
}

function getWorkspaceRoot(workspaceDir?: string): string | null {
  const root = asString(workspaceDir)
  if (!root) return null
  return path.resolve(path.normalize(root))
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  workspaceDir?: string
): Promise<string> {
  try {
    const cwd = getWorkspaceRoot(workspaceDir)
    if (!cwd) {
      return 'Error: Tool execution requires a workspace directory.'
    }

    switch (name) {
      case 'read_file': {
        const requestedPath = asString(args.path)
        if (!requestedPath) return 'Error: Missing required string arg "path"'

        const filePath = resolvePathWithinRoot(cwd, path.resolve(cwd, requestedPath))
        if (!filePath) return 'Error: Path outside workspace'

        const content = await fs.promises.readFile(filePath, 'utf-8')
        return content
      }
      case 'list_dir': {
        const requestedPath = asString(args.path) ?? '.'
        const dirPath = resolvePathWithinRoot(cwd, path.resolve(cwd, requestedPath))
        if (!dirPath) return 'Error: Path outside workspace'

        const files = await fs.promises.readdir(dirPath)
        return files.join('\n')
      }
      case 'write_file': {
        const requestedPath = asString(args.path)
        if (!requestedPath) return 'Error: Missing required string arg "path"'

        const filePath = resolvePathWithinRoot(cwd, path.resolve(cwd, requestedPath), true)
        if (!filePath) return 'Error: Path outside workspace'

        const content = asString(args.content) ?? ''
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
        await fs.promises.writeFile(filePath, content, 'utf-8')
        return 'File written successfully'
      }
      case 'run_command': {
        if (process.env.ZEN_ALLOW_AI_RUN_COMMAND !== 'true') {
          return (
            'Error: run_command is disabled by default for safety. ' +
            'Set ZEN_ALLOW_AI_RUN_COMMAND=true to enable it explicitly.'
          )
        }

        const command = asString(args.command)
        if (!command || !command.trim()) {
          return 'Error: Missing required string arg "command"'
        }
        if (command.includes('\0') || /[\r\n]/.test(command)) {
          return 'Error: Invalid command payload'
        }

        return new Promise((resolve) => {
          exec(
            command,
            {
              cwd,
              timeout: TOOL_COMMAND_TIMEOUT_MS,
              maxBuffer: TOOL_COMMAND_MAX_BUFFER,
              windowsHide: true
            },
            (error, stdout, stderr) => {
              let result = ''
              if (stdout) result += `STDOUT:\n${truncateOutput(stdout)}\n`
              if (stderr) result += `STDERR:\n${truncateOutput(stderr)}\n`
              if (error) result += `ERROR:\n${error.message}\n`
              resolve(result || 'Command executed with no output.')
            }
          )
        })
      }
      default:
        return `Error: Unknown tool ${name}`
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return `Error executing ${name}: ${message}`
  }
}
