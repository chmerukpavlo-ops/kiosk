#!/bin/bash

# Кольори для виводу
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Запуск системи обліку кіосків...${NC}\n"

# Перевірка наявності .env файлів
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  Файл backend/.env не знайдено. Створюю з env.example...${NC}"
    if [ -f "env.example" ]; then
        cp env.example backend/.env
        echo -e "${GREEN}✅ Файл backend/.env створено${NC}"
        echo -e "${YELLOW}⚠️  Перевірте налаштування DATABASE_URL в backend/.env${NC}\n"
    else
        echo -e "${RED}❌ Файл env.example не знайдено${NC}"
        exit 1
    fi
fi

# Перевірка наявності node_modules
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 Встановлення залежностей...${NC}"
    npm run install:all
    echo -e "${GREEN}✅ Залежності встановлено${NC}\n"
fi

# Перевірка @babel/code-frame в frontend (виправлення помилки Vite)
if [ ! -d "frontend/node_modules/@babel/code-frame" ]; then
    echo -e "${YELLOW}🔧 Виправлення @babel/code-frame...${NC}"
    cd frontend && npm install --no-workspaces '@babel/code-frame@^7.27.1' --save-dev --silent && cd ..
    echo -e "${GREEN}✅ @babel/code-frame встановлено${NC}\n"
fi

# Перевірка axios в backend (для Telegram функціоналу)
if [ ! -d "backend/node_modules/axios" ]; then
    echo -e "${YELLOW}📦 Встановлення axios в backend...${NC}"
    cd backend && npm install axios --silent && cd ..
    echo -e "${GREEN}✅ axios встановлено${NC}\n"
fi

# Перевірка наявності бази даних (спроба підключення)
echo -e "${BLUE}🔍 Перевірка підключення до бази даних...${NC}"
cd backend
if node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kiosk_db' });
pool.query('SELECT 1')
  .then(() => { console.log('✅ База даних доступна'); process.exit(0); })
  .catch((err) => { console.log('⚠️  База даних недоступна:', err.message); process.exit(0); });
" 2>/dev/null; then
    echo ""
else
    echo -e "${YELLOW}⚠️  Не вдалося перевірити базу даних. Переконайтеся, що PostgreSQL запущено.${NC}\n"
fi
cd ..

# Запуск серверів
echo -e "${GREEN}🎯 Запуск backend та frontend...${NC}\n"
echo -e "${BLUE}📍 Backend: http://localhost:3001${NC}"
echo -e "${BLUE}📍 Frontend: http://localhost:5173${NC}\n"
echo -e "${YELLOW}💡 Для зупинки натисніть Ctrl+C${NC}\n"

npm run dev

