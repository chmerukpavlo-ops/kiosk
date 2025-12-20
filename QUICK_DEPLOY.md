# ⚡ Швидкий чеклист деплою Backend

## 📋 Перед початком

- [ ] Код запушено на GitHub
- [ ] Маєте аккаунт на [Render.com](https://render.com)

## 🗄️ Крок 1: База даних (5 хвилин)

1. Render.com → **"New +"** → **"PostgreSQL"**
2. Налаштування:
   - Name: `kiosk-db`
   - Database: `kiosk_db`
   - User: `kiosk_user`
   - Plan: `Free`
3. **Create Database**
4. Дочекайтеся створення (2-3 хв)
5. **Скопіюйте Internal Database URL** (потрібен для наступного кроку)

## 🚀 Крок 2: Backend (10 хвилин)

1. Render.com → **"New +"** → **"Web Service"**
2. Підключіть GitHub репозиторій
3. Налаштування:
   - Name: `kiosk-backend`
   - Root Directory: `backend` ⚠️
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: `Free`
4. **Environment Variables:**
   ```
   NODE_ENV = production
   PORT = 10000
   DATABASE_URL = (Internal Database URL з кроку 1)
   JWT_SECRET = (згенеруйте: openssl rand -base64 32)
   ```
5. **Link Database** → оберіть `kiosk-db`
6. **Create Web Service**
7. Дочекайтеся деплою (5-10 хв)

## ✅ Крок 3: Перевірка

1. Відкрийте URL backend (наприклад: `https://kiosk-backend.onrender.com`)
2. Має з'явитися JSON з інформацією про API
3. Відкрийте `/api/health` - має бути `{"status":"ok"}`

## 🔗 Крок 4: Підключення Frontend

1. Vercel → ваш проект → **Settings** → **Environment Variables**
2. Додайте/оновіть:
   ```
   VITE_API_URL = https://ваш-backend-url.onrender.com
   ```
   ⚠️ Без `/api` в кінці!
3. **Redeploy** frontend

## 🎉 Готово!

Тепер ваш backend працює на Render, а frontend підключений до нього!

---

**Детальна інструкція:** Дивіться [BACKEND_DEPLOY.md](./BACKEND_DEPLOY.md)

