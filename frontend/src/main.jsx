import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'

// Intercept relative fetch calls to prepend VITE_API_URL in production / if set
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    const baseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
    if (baseUrl) {
      input = `${baseUrl.replace(/\/$/, '')}${input}`;
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

