@echo off
REM Windows batch script for quick start

echo 🚀 Запуск системи обліку кіосків...
echo.

REM Check if .env exists
if not exist "backend\.env" (
    echo ⚠️  Файл backend\.env не знайдено. Створюю з env.example...
    if exist "env.example" (
        copy env.example backend\.env
        echo ✅ Файл backend\.env створено
        echo ⚠️  Перевірте налаштування DATABASE_URL в backend\.env
        echo.
    ) else (
        echo ❌ Файл env.example не знайдено
        pause
        exit /b 1
    )
)

REM Check node_modules
if not exist "backend\node_modules" (
    echo 📦 Встановлення залежностей...
    call npm run install:all
    echo ✅ Залежності встановлено
    echo.
)

REM Start servers
echo 🎯 Запуск backend та frontend...
echo.
echo 📍 Backend: http://localhost:3001
echo 📍 Frontend: http://localhost:5173
echo.
echo 💡 Для зупинки натисніть Ctrl+C
echo.

call npm run dev

