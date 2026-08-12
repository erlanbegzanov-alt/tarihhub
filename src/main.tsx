import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Side-effect import: applies the stored (or system) theme to <html> before
// the first render, so there is no flash of the wrong theme.
import './lib/theme'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
