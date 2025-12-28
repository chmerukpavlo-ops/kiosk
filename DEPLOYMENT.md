# 🚀 Інструкції по деплою

## Автоматичний деплой

Після push на GitHub, сервери автоматично підтягнуть зміни, **АЛЕ** потрібно налаштувати environment variables вручну.

## Backend (Render.com)

### Налаштування

1. **Підключіть GitHub репозиторій** до Render
2. **Створіть Web Service** з наступними налаштуваннями:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** `Node`

3. **Додайте Environment Variables:**
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   JWT_SECRET=your-secret-key-min-32-chars
   NODE_ENV=production
   PORT=10000
   TELEGRAM_BOT_TOKEN=your-bot-token (опціонально)
   ```

4. **Створіть PostgreSQL Database** на Render та скопіюйте `DATABASE_URL`

### Автоматичний деплой

✅ Після push на `main` гілку, Render автоматично:
- Запустить build
- Перезапустить сервіс
- Застосує нові зміни

⚠️ **Важливо:** Перший запуск може займати до 2-3 хвилин (холодний старт)

## Frontend (Vercel)

### Налаштування

1. **Підключіть GitHub репозиторій** до Vercel
2. **Налаштуйте проект:**
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`

3. **Додайте Environment Variable:**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```
   (Замініть `your-backend-url` на реальний URL вашого backend на Render)

### Автоматичний деплой

✅ Після push на `main` гілку, Vercel автоматично:
- Запустить build
- Задеплоїть нову версію
- Застосує нові зміни

## Ручний деплой (якщо потрібно)

### Backend
```bash
cd backend
npm install
npm run build
# На Render це відбувається автоматично
```

### Frontend
```bash
cd frontend
npm install
npm run build
# На Vercel це відбувається автоматично
```

## Перевірка після деплою

1. **Backend Health Check:**
   ```
   https://your-backend-url.onrender.com/api/health
   ```
   Має повернути: `{"status":"ok"}`

2. **Frontend:**
   ```
   https://your-frontend-url.vercel.app
   ```
   Має відкритися сторінка логіну

3. **Перевірка підключення:**
   - Відкрийте консоль браузера (F12)
   - Перевірте, чи немає помилок підключення до API
   - Спробуйте увійти (admin/admin123)

## Troubleshooting

### Backend не запускається
- Перевірте `DATABASE_URL` - має бути правильний connection string
- Перевірте логи на Render - там будуть детальні помилки
- Переконайтеся, що PostgreSQL database створена та доступна

### Frontend показує білий екран
- Перевірте `VITE_API_URL` - має вказувати на правильний backend URL
- Перевірте консоль браузера на помилки
- Перевірте Network tab - чи йдуть запити до API

### CORS помилки
- Backend налаштований на `origin: '*'` - має працювати
- Якщо все одно є помилки, перевірте CORS налаштування в `backend/src/index.ts`

## Оновлення

Просто зробіть:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

І сервери автоматично оновляться! 🎉

