import { ipcMain } from 'electron'
import ytSearch from 'yt-search'

export function setupYoutubeHandlers(): void {
  ipcMain.handle('youtube:search', async (_, query: string) => {
    try {
      const r = await ytSearch(query)
      if (r && r.videos && r.videos.length > 0) {
        // Return top 1 result ID
        return {
          videoId: r.videos[0].videoId,
          title: r.videos[0].title,
          url: r.videos[0].url
        }
      }
      return null
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error('Failed to search youtube:', e.message)
      }
      return null
    }
  })
}
