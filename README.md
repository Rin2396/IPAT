# Цифровая платформа управления производственной практикой (IPAT)

MVP-проект для управления производственной практикой в колледже.

## Запуск

1. Убедитесь, что установлены Docker и Docker Compose.
2. (Опционально) скопируйте `.env.example` в `.env` и при необходимости измените переменные.
3. Выполните:

```bash
docker compose up --build
```

4. Откройте в браузере: **http://localhost**

5. Вход по умолчанию (после seed):
   - **Email:** `admin@college.local`
   - **Пароль:** `admin123`

## Стек

- **Backend:** Python 3.12, FastAPI, Poetry, SQLAlchemy 2.x, Alembic, JWT (access/refresh, blacklist в Redis), Celery + RabbitMQ, MinIO
- **Frontend:** React 18, TypeScript, Vite, Ant Design, Axios, Zustand
- **Инфра:** PostgreSQL 16, Redis, RabbitMQ, MinIO, nginx (в контейнере frontend)

## Структура

- `backend/` — FastAPI-приложение (API, модели, Celery tasks)
- `frontend/` — React SPA (Vite), раздача через nginx
- `docker-compose.yml` — все сервисы (postgres, redis, rabbitmq, minio, backend, celery_worker, celery_beat, frontend)

## Роли

- **admin** — полный доступ: пользователи, компании (verify/block), периоды, назначения
- **student** — свои назначения, задачи, отчёты, дневник
- **college_supervisor** / **company_supervisor** — свои назначения, согласование задач и отчётов

После `docker compose up --build` система должна запускаться без ошибок; при необходимости проверьте логи контейнеров.
