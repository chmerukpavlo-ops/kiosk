import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Log environment for debugging
if (import.meta.env.DEV) {
  console.log('Development mode');
  console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
