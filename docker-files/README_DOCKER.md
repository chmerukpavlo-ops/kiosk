# Швидкий старт з Docker Compose

## Локальне тестування

### 1. Створіть `.env` файл:

```bash
cp .env.example .env
```

Відредагуйте `.env`:
```env
DB_PASSWORD=test_password_123
JWT_SECRET=test_jwt_secret_change_in_production
```

### 2. Запустіть:

```bash
docker-compose up -d --build
```

### 3. Перевірте:

- Frontend: http://localhost
- Backend API: http://localhost/api/health
- Вхід: admin / admin123

### 4. Зупиніть:

```bash
docker-compose down
```

## Деплой на VPS

Детальні інструкції в [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)

## Структура

```
kiosk/
├── docker-compose.yml      # Основний файл для запуску
├── .env.example            # Приклад змінних середовища
├── backend/
│   ├── Dockerfile          # Backend контейнер
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile          # Frontend контейнер
│   ├── nginx.conf          # Nginx конфігурація
│   └── .dockerignore
└── DOCKER_DEPLOY.md        # Детальні інструкції
```

## Команди

```bash
# Запуск
docker-compose up -d

# Зупинка
docker-compose down

# Перезапуск
docker-compose restart

# Логи
docker-compose logs -f

# Перебудова
docker-compose up -d --build
```

