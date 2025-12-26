# Виправлення помилки "Instance failed" на Render

## Проблема
Backend не запускається на Render з помилкою "Exited with status 1".

## Виправлення

### 1. Виправлено імпорти ES modules
- Додано `.js` розширення до імпортів у `gamification.ts`
- Зміни запушені на GitHub

### 2. Перевірте налаштування на Render

#### Обов'язкові змінні середовища:
1. **JWT_SECRET** - **ОБОВ'ЯЗКОВО встановіть вручну!**
   - Відкрийте Render Dashboard → ваш Web Service → Environment
   - Додайте змінну `JWT_SECRET` зі значенням (мінімум 32 символи)
   - Наприклад: `openssl rand -base64 32` (виконайте в терміналі)

2. **DATABASE_URL** - автоматично встановлюється з `render.yaml`

3. **PORT** - автоматично встановлюється з `render.yaml` (10000)

#### Root Directory на Render:
- **ВАЖЛИВО:** У `render.yaml` вже встановлено `rootDir: backend`
- Якщо використовуєте Render Dashboard (без yaml):
  - Відкрийте Render Dashboard → ваш Web Service → Settings
  - Встановіть **Root Directory** на `backend`
- Команди тепер виконуються безпосередньо в папці `backend`

### 3. Перезапустіть сервіс
- Після встановлення `JWT_SECRET` натисніть "Manual Deploy" → "Deploy latest commit"

## Перевірка
Після деплою перевірте:
1. Логи на Render (кнопка "Logs")
2. Health endpoint: `https://your-backend.onrender.com/api/health`
3. Має повернути `{"status":"ok"}`

## Якщо все одно не працює
1. Перевірте логи на Render (кнопка "Logs" або "Debug")
2. Переконайтеся, що `JWT_SECRET` встановлено
3. Переконайтеся, що база даних створена і підключена

