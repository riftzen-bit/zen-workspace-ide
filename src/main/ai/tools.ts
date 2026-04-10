import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

export async function executeTool(name: string, args: any, workspaceDir?: string): Promise<string> {
  try {
    const cwd = workspaceDir || process.cwd()

    switch (name) {
      case 'read_file': {
        const filePath = path.resolve(cwd, args.path)
        if (!filePath.startsWith(cwd)) return 'Error: Path outside workspace'
        const content = await fs.promises.readFile(filePath, 'utf-8')
        return content
      }
      case 'list_dir': {
        const dirPath = path.resolve(cwd, args.path || '.')
        if (!dirPath.startsWith(cwd)) return 'Error: Path outside workspace'
        const files = await fs.promises.readdir(dirPath)
        return files.join('\n')
      }
      case 'write_file': {
        const filePath = path.resolve(cwd, args.path)
        if (!filePath.startsWith(cwd)) return 'Error: Path outside workspace'
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
        await fs.promises.writeFile(filePath, args.content || '', 'utf-8')
        return 'File written successfully'
      }
      case 'run_command': {
        return new Promise((resolve) => {
          exec(args.command, { cwd }, (error, stdout, stderr) => {
            let result = ''
            if (stdout) result += `STDOUT:\n${stdout}\n`
            if (stderr) result += `STDERR:\n${stderr}\n`
            if (error) result += `ERROR:\n${error.message}\n`
            resolve(result || 'Command executed with no output.')
          })
        })
      }
      default:
        return `Error: Unknown tool ${name}`
    }
  } catch (error: any) {
    return `Error executing ${name}: ${error.message}`
  }
}
