# Деплой на VPS з Docker Compose

## Вимоги

- VPS з Ubuntu 20.04+ (або інший Linux дистрибутив)
- Docker та Docker Compose встановлені
- Мінімум 2GB RAM
- Мінімум 10GB дискового простору

## Крок 1: Підготовка VPS

### Підключіться до VPS:

```bash
ssh root@your-vps-ip
```

### Встановіть Docker та Docker Compose:

```bash
# Оновіть систему
apt update && apt upgrade -y

# Встановіть Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Встановіть Docker Compose
apt install docker-compose -y

# Перевірте встановлення
docker --version
docker-compose --version
```

## Крок 2: Завантажте проєкт на VPS

### Варіант 1: Через Git (рекомендовано)

```bash
# Встановіть Git (якщо не встановлено)
apt install git -y

# Клонуйте репозиторій
cd /opt
git clone your-repository-url kiosk
cd kiosk
```

### Варіант 2: Через SCP (якщо немає Git)

На вашому локальному комп'ютері:

```bash
# Створіть архів
tar -czf kiosk.tar.gz kiosk/

# Завантажте на VPS
scp kiosk.tar.gz root@your-vps-ip:/opt/

# На VPS розпакуйте
ssh root@your-vps-ip
cd /opt
tar -xzf kiosk.tar.gz
cd kiosk
```

## Крок 3: Налаштування

### Створіть файл `.env`:

```bash
cd /opt/kiosk
cp .env.example .env
nano .env
```

Встановіть значення:

```env
# Database
DB_PASSWORD=your_very_secure_password_12345

# JWT Secret (генеруйте випадковий рядок)
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
```

**Важливо:** Змініть паролі на складні! Використайте генератор паролів.

### Генерація JWT_SECRET:

```bash
# Генеруйте випадковий ключ
openssl rand -base64 32
```

## Крок 4: Запуск

### Побудуйте та запустіть контейнери:

```bash
cd /opt/kiosk
docker-compose up -d --build
```

Це займе 5-10 хвилин при першому запуску.

### Перевірте статус:

```bash
docker-compose ps
```

Всі сервіси мають бути "Up".

### Перевірте логи:

```bash
# Всі логи
docker-compose logs -f

# Тільки backend
docker-compose logs -f backend

# Тільки frontend
docker-compose logs -f frontend

# Тільки postgres
docker-compose logs -f postgres
```

## Крок 5: Перевірка роботи

### Перевірте backend:

```bash
curl http://localhost:3001/api/health
```

Має повернути: `{"status":"ok"}`

### Перевірте frontend:

Відкрийте в браузері: `http://your-vps-ip`

Має відкритися сторінка входу.

### Увійдіть в систему:

- Логін: `admin`
- Пароль: `admin123`

## Крок 6: Налаштування домену (опціонально)

### Встановіть Nginx як reverse proxy:

```bash
apt install nginx certbot python3-certbot-nginx -y
```

### Створіть конфігурацію Nginx:

```bash
nano /etc/nginx/sites-available/kiosk
```

Додайте:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Активуйте конфігурацію:

```bash
ln -s /etc/nginx/sites-available/kiosk /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Встановіть SSL (Let's Encrypt):

```bash
certbot --nginx -d your-domain.com
```

## Корисні команди

### Зупинити сервіси:

```bash
docker-compose down
```

### Перезапустити сервіси:

```bash
docker-compose restart
```

### Оновити проєкт:

```bash
# Зупиніть
docker-compose down

# Оновіть код (якщо через Git)
git pull

# Перебудуйте та запустіть
docker-compose up -d --build
```

### Переглянути логи:

```bash
# Всі логи
docker-compose logs

# Останні 100 рядків
docker-compose logs --tail=100

# Логи конкретного сервісу
docker-compose logs backend
```

### Backup бази даних:

```bash
# Створіть backup
docker-compose exec postgres pg_dump -U kiosk_user kiosk_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Відновіть з backup
docker-compose exec -T postgres psql -U kiosk_user kiosk_db < backup.sql
```

### Автоматичний backup (cron):

```bash
# Відкрийте crontab
crontab -e

# Додайте (backup щодня о 2:00)
0 2 * * * cd /opt/kiosk && docker-compose exec -T postgres pg_dump -U kiosk_user kiosk_db > /opt/kiosk/backups/backup_$(date +\%Y\%m\%d).sql
```

## Безпека

### 1. Змініть паролі:

- `DB_PASSWORD` в `.env`
- `JWT_SECRET` в `.env`
- Пароль адміністратора в системі (після першого входу)

### 2. Налаштуйте firewall:

```bash
# Встановіть UFW
apt install ufw -y

# Дозвольте SSH
ufw allow 22/tcp

# Дозвольте HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Увімкніть firewall
ufw enable
```

### 3. Закрийте порт PostgreSQL (якщо не потрібен ззовні):

В `docker-compose.yml` видаліть або закоментуйте:

```yaml
ports:
  - "5432:5432"
```

## Моніторинг

### Перевірка використання ресурсів:

```bash
docker stats
```

### Перевірка дисків:

```bash
df -h
docker system df
```

## Вирішення проблем

### Проблема: Контейнери не запускаються

```bash
# Перевірте логи
docker-compose logs

# Перевірте конфігурацію
docker-compose config
```

### Проблема: База даних не підключається

```bash
# Перевірте статус PostgreSQL
docker-compose exec postgres pg_isready -U kiosk_user

# Перевірте логи
docker-compose logs postgres
```

### Проблема: Frontend не відображається

```bash
# Перевірте логи nginx
docker-compose logs frontend

# Перевірте, чи працює backend
curl http://localhost:3001/api/health
```

### Проблема: Порт зайнятий

```bash
# Знайдіть процес
lsof -i :80
lsof -i :3001

# Зупиніть процес або змініть порт в docker-compose.yml
```

## Оновлення

### Оновити проєкт:

```bash
cd /opt/kiosk
git pull
docker-compose down
docker-compose up -d --build
```

### Оновити Docker образ PostgreSQL:

```bash
docker-compose pull postgres
docker-compose up -d postgres
```

## Готово! 🎉

Після виконання всіх кроків ваш сайт буде доступний на:
- `http://your-vps-ip` (або ваш домен)
- Backend API: `http://your-vps-ip/api`

**Не забудьте:**
1. Змінити паролі в `.env`
2. Змінити пароль адміністратора після першого входу
3. Налаштувати SSL для HTTPS
4. Налаштувати автоматичний backup

