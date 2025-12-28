# 🏪 Kiosk Management System

Система управління кіосками з повним функціоналом для продавців та адміністраторів.

## ✨ Основні функції

### Для продавців
- 📱 Панель продавця з швидким доступом до товарів
- 📷 Сканування штрих-кодів та QR-кодів
- 🛒 Кошик з можливістю додавання товарів
- 💰 Продаж товарів з вибором методу оплати
- 📊 Статистика продажів та зарплата
- 📅 Графік роботи
- 🏆 Гейміфікація (досягнення, бейджі, лідерборд)
- 📱 Офлайн-режим з автоматичною синхронізацією
- 🔔 Push-нотифікації

### Для адміністраторів
- 📊 Дашборд з аналітикою та прогнозами
- 📦 Управління товарами (CRUD, імпорт/експорт)
- 💰 Управління продажами
- 🏷️ Система акцій та знижок
- 👥 Управління персоналом та клієнтами
- 📅 Управління графіком роботи
- 💳 Управління витратами та фінансами
- 📈 Аналітика та прогнози продажів
- 📱 Telegram-бот для сповіщень
- 📥 Експорт даних (Excel, графіки)

## 🚀 Швидкий старт

### Вимоги
- Node.js 18+
- PostgreSQL 12+
- npm або yarn

### Встановлення

1. **Клонуйте репозиторій**
```bash
git clone <repository-url>
cd kiosk
```

2. **Встановіть залежності**

Backend:
```bash
cd backend
npm install
```

Frontend:
```bash
cd frontend
npm install
```

3. **Налаштуйте базу даних**

Створіть файл `backend/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/kiosk_db
JWT_SECRET=your-secret-key-here
PORT=3001
TELEGRAM_BOT_TOKEN=your-telegram-bot-token (опціонально)
```

4. **Запустіть базу даних**
```bash
# PostgreSQL має бути запущений
createdb kiosk_db
```

5. **Запустіть backend**
```bash
cd backend
npm run dev
```

Backend буде доступний на `http://localhost:3001`

6. **Запустіть frontend**
```bash
cd frontend
npm run dev
```

Frontend буде доступний на `http://localhost:5173`

## 📁 Структура проекту

```
kiosk/
├── backend/              # Backend (Express + TypeScript + PostgreSQL)
│   ├── src/
│   │   ├── db/          # Database initialization
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic services
│   │   ├── middleware/  # Auth, logging middleware
│   │   └── index.ts     # Entry point
│   └── package.json
│
├── frontend/            # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/      # Page components
│   │   ├── lib/        # Utilities
│   │   ├── hooks/      # Custom hooks
│   │   ├── context/    # React context
│   │   └── main.tsx    # Entry point
│   └── package.json
│
└── README.md
```

## 🔐 Авторизація

Після першого запуску створюється адміністратор:
- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Важливо:** Змініть пароль після першого входу!

## 🌐 API Endpoints

### Авторизація
- `POST /api/auth/login` - Вхід
- `POST /api/auth/register` - Реєстрація (admin only)
- `GET /api/auth/me` - Поточний користувач

### Товари
- `GET /api/products` - Список товарів
- `POST /api/products` - Створити товар (admin)
- `PUT /api/products/:id` - Оновити товар (admin)
- `DELETE /api/products/:id` - Видалити товар (admin)

### Продажі
- `GET /api/sales` - Список продажів
- `POST /api/sales` - Створити продаж

### Статистика
- `GET /api/stats/dashboard` - Дашборд статистика (admin)
- `GET /api/analytics/trends` - Тренди продажів (admin)
- `GET /api/analytics/forecast` - Прогнози (admin)

### Telegram
- `GET /api/telegram/chat-id` - Отримати Chat ID
- `POST /api/telegram/link` - Підключити Telegram
- `POST /api/telegram/unlink` - Відключити Telegram

Повний список API endpoints дивіться в коді або використовуйте `GET /` для інформації.

## 🔧 Налаштування

### Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/kiosk_db
JWT_SECRET=your-secret-key-change-this
PORT=3001
TELEGRAM_BOT_TOKEN=your-bot-token (опціонально)
NODE_ENV=development
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001/api (для production)
```

### Telegram Bot Setup

1. Створіть бота через [@BotFather](https://t.me/BotFather) в Telegram
2. Отримайте токен бота
3. Додайте `TELEGRAM_BOT_TOKEN` в `backend/.env`
4. Отримайте ваш Chat ID через [@userinfobot](https://t.me/userinfobot)
5. Підключіть Telegram в налаштуваннях системи

## 📱 PWA Features

Система підтримує PWA (Progressive Web App):
- 📥 Встановлення на телефон
- 🔄 Офлайн-режим
- 🔔 Push-нотифікації
- 💾 Локальне збереження даних

## 🚢 Deployment

### Backend (Render.com)

1. Створіть новий Web Service на Render
2. Підключіть GitHub репозиторій
3. Налаштуйте:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Додайте Environment Variables:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `JWT_SECRET`
   - `TELEGRAM_BOT_TOKEN` (опціонально)
   - `NODE_ENV=production`

### Frontend (Vercel)

1. Підключіть GitHub репозиторій до Vercel
2. Налаштуйте:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`
3. Додайте Environment Variable:
   - `VITE_API_URL` (URL вашого backend API)

## 🛠️ Розробка

### Backend
```bash
cd backend
npm run dev    # Development mode з hot reload
npm run build  # Build для production
npm start      # Production mode
```

### Frontend
```bash
cd frontend
npm run dev    # Development server
npm run build  # Build для production
npm run preview # Preview production build
```

## 📝 Технології

### Backend
- Express.js
- TypeScript
- PostgreSQL
- Socket.IO (WebSocket)
- node-telegram-bot-api
- JWT для авторизації

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Recharts (графіки)
- React Router
- Axios
- Socket.IO Client

## 📄 Ліцензія

MIT

## 👥 Автор

Розроблено для управління кіосками
