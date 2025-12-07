# Мобільна версія для продавця

Є кілька варіантів створення мобільної версії:

## Варіант 1: PWA (Progressive Web App) - Рекомендовано

Перетворення існуючого сайту в PWA, який можна встановити на телефон.

### Крок 1: Додайте PWA підтримку

1. **Встановіть пакет:**
   ```bash
   cd frontend
   npm install vite-plugin-pwa -D
   ```

2. **Оновіть `frontend/vite.config.ts`:**
   ```typescript
   import { VitePWA } from 'vite-plugin-pwa'
   
   export default defineConfig({
     plugins: [
       react(),
       VitePWA({
         registerType: 'autoUpdate',
         manifest: {
           name: 'Кіоск - Панель продавця',
           short_name: 'Кіоск',
           description: 'Панель продавця для системи обліку кіосків',
           theme_color: '#0ea5e9',
           icons: [
             {
               src: 'pwa-192x192.png',
               sizes: '192x192',
               type: 'image/png'
             },
             {
               src: 'pwa-512x512.png',
               sizes: '512x512',
               type: 'image/png'
             }
           ]
         }
       })
     ],
     // ... інші налаштування
   })
   ```

3. **Створіть `frontend/public/manifest.json`:**
   ```json
   {
     "name": "Кіоск - Панель продавця",
     "short_name": "Кіоск",
     "description": "Панель продавця для системи обліку кіосків",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#0ea5e9",
     "orientation": "portrait",
     "icons": [
       {
         "src": "/pwa-192x192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "/pwa-512x512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

4. **Додайте іконки:**
   - Створіть `frontend/public/pwa-192x192.png` (192x192px)
   - Створіть `frontend/public/pwa-512x512.png` (512x512px)
   - Можна використати онлайн генератор: [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)

5. **Оновіть `frontend/index.html`:**
   ```html
   <head>
     <!-- ... інші теги ... -->
     <link rel="manifest" href="/manifest.json">
     <meta name="theme-color" content="#0ea5e9">
     <meta name="apple-mobile-web-app-capable" content="yes">
     <meta name="apple-mobile-web-app-status-bar-style" content="default">
     <meta name="apple-mobile-web-app-title" content="Кіоск">
   </head>
   ```

### Крок 2: Створіть окрему версію тільки для продавця

Створіть новий роут, який показує тільки панель продавця:

1. **Створіть `frontend/src/AppSeller.tsx`:**
   ```typescript
   import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
   import { AuthProvider, useAuth } from './context/AuthContext';
   import { ProtectedRoute } from './components/ProtectedRoute';
   import { Login } from './pages/Login';
   import { SellerDashboard } from './pages/seller/Dashboard';

   function SellerAppRoutes() {
     const { user } = useAuth();

     return (
       <Routes>
         <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
         <Route
           path="/"
           element={
             <ProtectedRoute>
               <SellerDashboard />
             </ProtectedRoute>
           }
         />
       </Routes>
     );
   }

   export default function SellerApp() {
     return (
       <AuthProvider>
         <BrowserRouter>
           <SellerAppRoutes />
         </BrowserRouter>
       </AuthProvider>
     );
   }
   ```

2. **Створіть окремий entry point `frontend/src/main-seller.tsx`:**
   ```typescript
   import { StrictMode } from 'react'
   import { createRoot } from 'react-dom/client'
   import './index.css'
   import SellerApp from './AppSeller.tsx'

   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       <SellerApp />
     </StrictMode>,
   )
   ```

3. **Оновіть `frontend/vite.config.ts` для підтримки двох entry points:**
   ```typescript
   export default defineConfig({
     plugins: [react()],
     build: {
       rollupOptions: {
         input: {
           main: './index.html',
           seller: './seller.html'
         }
       }
     },
     // ... інші налаштування
   })
   ```

4. **Створіть `frontend/seller.html`:**
   ```html
   <!doctype html>
   <html lang="uk">
     <head>
       <meta charset="UTF-8" />
       <link rel="icon" type="image/svg+xml" href="/vite.svg" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>Кіоск - Продавець</title>
       <link rel="manifest" href="/manifest.json">
       <meta name="theme-color" content="#0ea5e9">
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main-seller.tsx"></script>
     </body>
   </html>
   ```

## Варіант 2: Окремий мобільний додаток (React Native)

Якщо потрібен нативний мобільний додаток:

1. **Створіть React Native проєкт:**
   ```bash
   npx react-native init KioskSeller
   ```

2. **Використайте той самий API backend**

3. **Створіть UI компоненти для продавця**

**Переваги:** Нативна швидкість, доступ до камери/геолокації  
**Недоліки:** Потрібно розробляти окремо, складніше підтримувати

## Варіант 3: Адаптивна версія (вже реалізовано)

Поточна версія вже адаптивна! Просто відкрийте на телефоні:

1. Задеплойте на сервер
2. Відкрийте на телефоні в браузері
3. Додайте на головний екран (iOS: Share → Add to Home Screen, Android: Menu → Add to Home Screen)

## Рекомендації:

**Для швидкого запуску:** Використайте PWA (Варіант 1)  
**Для продакшн:** PWA + окрема версія для продавця  
**Для максимальної функціональності:** React Native додаток

## Питання для уточнення:

1. **Чи потрібна окрема версія тільки для продавця?** (без адмін панелі)
2. **Чи потрібен нативний додаток** (React Native) чи PWA достатньо?
3. **Які функції критичні для мобільної версії?**
   - Продаж товарів ✅ (вже є)
   - Перегляд статистики ✅ (вже є)
   - Сканування QR-кодів? (потрібно додати)
   - Офлайн режим? (потрібно додати)

