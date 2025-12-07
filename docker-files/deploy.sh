#!/bin/bash

# Скрипт для швидкого деплою на VPS

set -e

echo "🚀 Деплой системи обліку кіосків"
echo ""

# Перевірка наявності .env
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не знайдено!"
    echo "📝 Створюю .env з прикладу..."
    cp .env.example .env
    echo "✅ Файл .env створено"
    echo "⚠️  ВАЖЛИВО: Відредагуйте .env та встановіть безпечні паролі!"
    echo ""
    read -p "Натисніть Enter після редагування .env файлу..."
fi

# Перевірка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не встановлено!"
    echo "Встановіть Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не встановлено!"
    echo "Встановіть Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker та Docker Compose встановлені"
echo ""

# Побудова та запуск
echo "🔨 Побудова та запуск контейнерів..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

echo ""
echo "⏳ Очікування запуску сервісів..."
sleep 10

# Перевірка статусу
echo ""
echo "📊 Статус контейнерів:"
docker-compose ps

echo ""
echo "🔍 Перевірка backend..."
sleep 5
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend працює!"
else
    echo "⚠️  Backend не відповідає. Перевірте логи: docker-compose logs backend"
fi

echo ""
echo "🌐 Frontend доступний на: http://localhost"
echo "🔧 Backend API доступний на: http://localhost:3001"
echo ""
echo "📝 Логи: docker-compose logs -f"
echo "🛑 Зупинити: docker-compose down"
echo ""
echo "✅ Деплой завершено!"

