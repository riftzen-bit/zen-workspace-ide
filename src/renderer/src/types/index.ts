export type FileNode = {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNode[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}
