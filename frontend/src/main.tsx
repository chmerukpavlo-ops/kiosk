import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Log environment for debugging (always, not just in dev)
console.log('🚀 App starting...');
console.log('Environment:', import.meta.env.MODE);
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL || 'NOT SET');
console.log('DEV mode:', import.meta.env.DEV);

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found!');
  throw new Error('Root element not found');
}

console.log('✅ Root element found, rendering App...');

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Error rendering App:', error);
  
  // Перевіряємо, чи це помилка від розширення браузера
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isExtensionError = errorMessage.includes('solana') || 
                          errorMessage.includes('chrome-extension') ||
                          errorMessage.includes('moz-extension');
  
  if (isExtensionError) {
    console.warn('⚠️ Browser extension error detected, attempting to recover...');
    // Спробуємо перезавантажити через невелику затримку
    setTimeout(() => {
      try {
        createRoot(rootElement).render(
          <StrictMode>
            <App />
          </StrictMode>,
        );
        console.log('✅ App recovered from extension error');
      } catch (retryError) {
        console.error('❌ Failed to recover:', retryError);
        rootElement.innerHTML = `
          <div style="padding: 20px; font-family: sans-serif; max-width: 600px; margin: 50px auto;">
            <h1 style="color: #dc2626;">Помилка завантаження</h1>
            <p>Не вдалося завантажити додаток через конфлікт з розширенням браузера.</p>
            <p><strong>Рішення:</strong> Вимкніть розширення Solana або інші криптовалютні розширення і перезавантажте сторінку.</p>
            <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
              Перезавантажити сторінку
            </button>
          </div>
        `;
      }
    }, 100);
  } else {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; max-width: 600px; margin: 50px auto;">
        <h1 style="color: #dc2626;">Помилка завантаження</h1>
        <p>Не вдалося завантажити додаток. Перевірте консоль браузера для деталей.</p>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px;">${errorMessage}</pre>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
          Перезавантажити сторінку
        </button>
      </div>
    `;
  }
}
