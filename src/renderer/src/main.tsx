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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
