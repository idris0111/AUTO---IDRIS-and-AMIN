# AUTO UNIVERSE — магазин автозапчастей

FastAPI, React/Vite, SQLAlchemy, PostgreSQL и Alembic. Существующие функции включают
JWT-авторизацию, каталог, корзину, заказы, личный кабинет и административную панель.

Репозиторий: https://github.com/idris0111/AUTO---IDRIS-and-AMIN
Целевой домен: https://zapchast.king.tj (успешное развёртывание пока не подтверждено).

## Локальный запуск

Требуются Python 3.12, Node.js 24 и PostgreSQL с UTF-8 и ICU ru-TJ.
Подробные команды создания базы, миграций и администратора: [backend/README.md](backend/README.md).

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Если `backend/.env` отсутствует, скопируйте `backend/.env.example` в `backend/.env`.
Задайте подключение к отдельной локальной базе и случайный `JWT_SECRET` длиной
не менее 32 символов. Не перезаписывайте существующий `.env`.

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

В другом терминале из корня проекта:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

## Проверки

Из `frontend`: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.
Из `backend`: `.\.venv\Scripts\python.exe -m pytest -q`.
Без `TEST_DATABASE_URL` тесты используют временную SQLite-базу. Для проверки PostgreSQL
задайте `TEST_DATABASE_URL` с именем отдельной **пустой** базы, заканчивающимся на `_test`.
Тесты создают и удаляют таблицы; рабочую базу использовать нельзя.

[GitHub Actions](.github/workflows/ci.yml) проверяет frontend, API на PostgreSQL,
миграции на отдельной базе и синтаксис deployment-скриптов. PostgreSQL запускается
как обычный сервис Ubuntu. Workflow не публикует код на VPS и не использует Docker.
Первый запуск Actions требует публикации ветки и пока не подтверждён.

## Развёртывание и обновления

Ubuntu 24.04, Python venv, PostgreSQL, systemd, Nginx и Let's Encrypt — без Docker.
Полный порядок установки, резервного копирования, миграций, HTTPS, обновления и
отката: [deploy/README.md](deploy/README.md).

Изменения готовятся в рабочей ветке, проходят проверки и публикуются после
подтверждения владельца. Затем создаётся Pull Request; слияние в `main` требует
отдельного разрешения. Для обновления VPS сначала сохраняются резервные копии,
затем переносится проверенный релиз и собранный `frontend/dist`, применяются
согласованные миграции и переключается `/srv/zapchast/current`.

`.env`, ключи, дампы, локальные базы, `.runtime`, виртуальные окружения и сборки
исключены из Git. Рабочие секреты задаются только в закрытом окружении сервера.
История ранее выполненной подготовки и её ограничения:
[аудит развёртывания](docs/DEPLOYMENT_AUDIT_2026-10-26.md).
