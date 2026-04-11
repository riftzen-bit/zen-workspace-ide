import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Suppress Monaco Editor's harmless internal cancelation promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.type === 'cancelation') {
    event.preventDefault()
  }
})

// Suppress THREE.js Context Lost info messages when unmounting 3D backgrounds
const origInfo = console.info
console.info = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.WebGLRenderer: Context Lost')) return
  origInfo(...args)
}

createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  )
)
