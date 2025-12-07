#!/bin/bash

echo "🔍 Перевірка системи..."
echo ""

# Перевірка Node.js
echo "1. Перевірка Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js встановлено: $NODE_VERSION"
else
    echo "   ❌ Node.js не встановлено"
    exit 1
fi

# Перевірка PostgreSQL
echo ""
echo "2. Перевірка PostgreSQL..."
if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
        echo "   ✅ PostgreSQL запущений"
    else
        echo "   ❌ PostgreSQL не запущений"
        echo "   💡 Запустіть: brew services start postgresql (macOS)"
    fi
else
    echo "   ⚠️  PostgreSQL не знайдено в PATH"
fi

# Перевірка бази даних
echo ""
echo "3. Перевірка бази даних..."
if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw kiosk_db; then
    echo "   ✅ База даних kiosk_db існує"
else
    echo "   ❌ База даних kiosk_db не існує"
    echo "   💡 Створіть: createdb kiosk_db"
fi

# Перевірка .env файлу
echo ""
echo "4. Перевірка файлу .env..."
if [ -f "backend/.env" ]; then
    echo "   ✅ Файл backend/.env існує"
    if grep -q "DATABASE_URL" backend/.env; then
        echo "   ✅ DATABASE_URL налаштовано"
    else
        echo "   ❌ DATABASE_URL не знайдено в .env"
    fi
    if grep -q "JWT_SECRET" backend/.env; then
        echo "   ✅ JWT_SECRET налаштовано"
    else
        echo "   ❌ JWT_SECRET не знайдено в .env"
    fi
else
    echo "   ❌ Файл backend/.env не існує"
    echo "   💡 Створіть файл backend/.env з налаштуваннями"
fi

# Перевірка залежностей
echo ""
echo "5. Перевірка залежностей..."
if [ -d "node_modules" ] && [ -d "backend/node_modules" ] && [ -d "frontend/node_modules" ]; then
    echo "   ✅ Залежності встановлені"
else
    echo "   ❌ Залежності не встановлені"
    echo "   💡 Виконайте: npm run install:all"
fi

# Перевірка backend
echo ""
echo "6. Перевірка backend API..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend працює на http://localhost:3001"
else
    echo "   ❌ Backend не відповідає"
    echo "   💡 Запустіть: cd backend && npm run dev"
fi

# Перевірка frontend
echo ""
echo "7. Перевірка frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend працює на http://localhost:5173"
else
    echo "   ⚠️  Frontend не відповідає (може бути не запущений)"
    echo "   💡 Запустіть: cd frontend && npm run dev"
fi

# Перевірка користувача admin
echo ""
echo "8. Перевірка користувача admin..."
if psql kiosk_db -tAc "SELECT 1 FROM users WHERE username='admin'" 2>/dev/null | grep -q 1; then
    echo "   ✅ Користувач admin існує"
else
    echo "   ❌ Користувач admin не знайдено"
    echo "   💡 Перезапустіть backend - він автоматично створить користувача"
fi

echo ""
echo "✅ Перевірка завершена!"
echo ""
echo "Якщо є проблеми, дивіться TROUBLESHOOTING.md"

