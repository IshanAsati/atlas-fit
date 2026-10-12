import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getStoredThemePreference } from './design/theme.ts'

// Set the theme before the first paint so the wrong colour scheme never flashes.
applyTheme(getStoredThemePreference())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
