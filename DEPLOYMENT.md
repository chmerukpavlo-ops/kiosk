# 🚀 Інструкції по деплою

## ⚠️ ВАЖЛИВО: Автоматичний деплой

**Так, після push на GitHub все автоматично підтягнеться на сервери**, АЛЕ потрібно **один раз налаштувати** environment variables вручну.

## Backend (Render.com)

### Перше налаштування (один раз)

1. **Підключіть GitHub репозиторій** до Render
2. **Створіть Web Service** з наступними налаштуваннями:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** `Node`

3. **Створіть PostgreSQL Database** на Render (назвіть `kiosk-db`)

4. **Додайте Environment Variables вручну:**
   ```
   DATABASE_URL= (автоматично з database)
   JWT_SECRET=your-secret-key-min-32-chars (встановіть вручну!)
   NODE_ENV=production
   PORT=10000
   TELEGRAM_BOT_TOKEN=your-bot-token (опціонально)
   ```

### Автоматичний деплой

✅ **Після push на `main` гілку, Render автоматично:**
- Запустить build
- Перезапустить сервіс
- Застосує нові зміни

⚠️ **Важливо:** Перший запуск може займати до 2-3 хвилин (холодний старт)

## Frontend (Vercel)

### Перше налаштування (один раз)

1. **Підключіть GitHub репозиторій** до Vercel
2. **Налаштуйте проект:**
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`

3. **Додайте Environment Variable вручну:**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```
   (Замініть `your-backend-url` на реальний URL вашого backend на Render)

### Автоматичний деплой

✅ **Після push на `main` гілку, Vercel автоматично:**
- Запустить build
- Задеплоїть нову версію
- Застосує нові зміни

## 📝 Що робити після push

### Просто запушити:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Сервери автоматично:
1. ✅ Відловлять зміни з GitHub
2. ✅ Запустять build
3. ✅ Задеплоять нову версію
4. ✅ Перезапустять сервіси

**Нічого більше робити не потрібно!** 🎉

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
- Перевірте `JWT_SECRET` - має бути встановлений (мінімум 32 символи)
- Перевірте логи на Render - там будуть детальні помилки
- Переконайтеся, що PostgreSQL database створена та доступна

### Frontend показує білий екран
- Перевірте `VITE_API_URL` - має вказувати на правильний backend URL
- Перевірте консоль браузера на помилки
- Перевірте Network tab - чи йдуть запити до API

### CORS помилки
- Backend налаштований на `origin: '*'` - має працювати
- Якщо все одно є помилки, перевірте CORS налаштування в `backend/src/index.ts`

## 📋 Чеклист перед першим деплоєм

- [ ] Backend налаштований на Render
- [ ] PostgreSQL database створена
- [ ] Environment variables встановлені (JWT_SECRET, DATABASE_URL)
- [ ] Frontend налаштований на Vercel
- [ ] VITE_API_URL встановлений на Vercel
- [ ] Проект запушено на GitHub
- [ ] Перевірено health check backend
- [ ] Перевірено frontend в браузері

## Оновлення проекту

Просто зробіть:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

І сервери автоматично оновляться! 🎉
