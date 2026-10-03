import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ensureDemoData } from './lib/demo/seed'
import App from './App.tsx'

// Seed the sample business before anything reads from storage.
ensureDemoData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
