export type FileNode = {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNode[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'model'
  text: string
}

export type YoutubeSearchResult = {
  videoId: string
  title: string
  url: string
}
