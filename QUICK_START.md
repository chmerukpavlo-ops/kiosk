# 🚀 Швидкий старт

## Передумови
- Node.js 18+ встановлений
- PostgreSQL 12+ запущений
- npm або yarn

## Крок 1: Клонування та встановлення

```bash
# Клонуйте репозиторій
git clone <repository-url>
cd kiosk

# Встановіть залежності backend
cd backend
npm install

# Встановіть залежності frontend
cd ../frontend
npm install
```

## Крок 2: Налаштування бази даних

```bash
# Створіть базу даних
createdb kiosk_db

# Або через psql
psql -U postgres
CREATE DATABASE kiosk_db;
\q
```

## Крок 3: Налаштування environment variables

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kiosk_db
JWT_SECRET=your-secret-key-change-this
PORT=3001
NODE_ENV=development
TELEGRAM_BOT_TOKEN= (опціонально)
```

**Frontend** (`frontend/.env`):
```env
# Для development залиште порожнім (використовується proxy)
# Для production вкажіть URL backend:
# VITE_API_URL=https://your-backend-url.com/api
```

## Крок 4: Запуск

### Термінал 1 - Backend:
```bash
cd backend
npm run dev
```

Backend буде доступний на `http://localhost:3001`

### Термінал 2 - Frontend:
```bash
cd frontend
npm run dev
```

Frontend буде доступний на `http://localhost:5173`

## Крок 5: Перший вхід

Відкрийте `http://localhost:5173` в браузері.

**Дані для входу (створюються автоматично):**
- Username: `admin`
- Password: `admin123`

⚠️ **Важливо:** Змініть пароль після першого входу!

## Перевірка роботи

1. ✅ Backend запущений (перевірте `http://localhost:3001/api/health`)
2. ✅ Frontend відкривається в браузері
3. ✅ Можна увійти з `admin` / `admin123`
4. ✅ База даних створена та ініціалізована

## Troubleshooting

### Помилка підключення до бази даних
- Перевірте, чи PostgreSQL запущений
- Перевірте правильність `DATABASE_URL` в `.env`
- Перевірте права доступу користувача PostgreSQL

### Помилка порту вже використовується
- Змініть `PORT` в `backend/.env`
- Або зупиніть процес, який використовує порт

### Frontend не підключається до backend
- Перевірте, чи backend запущений
- Перевірте `VITE_API_URL` в `frontend/.env`
- Перевірте CORS налаштування в backend

## Далі

- Створіть ларьки в розділі "Ларьки"
- Додайте товари в розділі "Товари"
- Створіть користувачів-продавців в розділі "Продавці"
- Налаштуйте Telegram (опціонально) в розділі "Telegram"

