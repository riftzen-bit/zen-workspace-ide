import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          include: ['tests/main/**/*.test.ts'],
          environment: 'node',
          globals: true
        }
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          include: ['tests/renderer/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['tests/renderer/setup.ts'],
          alias: {
            '@renderer': path.resolve(__dirname, 'src/renderer/src')
          }
        }
      }
    ]
  }
})
