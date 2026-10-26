# Развёртывание zapchast.king.tj без Docker

**Статус: подготовка. На VPS ничего не установлено и не изменено.**
Все команды изменения VPS и `git push` выполняются только после отдельного
подтверждения владельца. Этот документ — план для проверки, а не команда запуска.

Схема: Nginx отдаёт React `dist` и проксирует API в Uvicorn на `127.0.0.1:8000`.
systemd запускает API от отдельного пользователя `zapchast`. PostgreSQL доступен
приложению через локальный Unix socket с peer-авторизацией, без пароля в коде.
Один worker нужен из-за ограничения частоты входа, хранящегося в памяти процесса.

## 1. Доступ и инвентаризация

Нужны рабочий SSH-вход `idris@31.25.238.204`, право `sudo`, доступ на запись в
`idris0111/AUTO---IDRIS-and-AMIN` и подтверждение публикации. Email для Let's Encrypt
владелец указывает при выпуске сертификата. Секреты в чат не передавать.

Сначала выполнить только чтение: `bash deploy/scripts/preflight.sh`, проверить
существующие сайты, занятость портов 80/443/8000, свободное место и базы PostgreSQL.
Проверить A и AAAA домена: все опубликованные адреса должны обслуживать этот сайт.
Если имя пользователя, база, каталог или конфигурация ниже уже существуют —
остановиться и согласовать использование после изучения. Не заменять чужой сервис.

Перед изменениями сохранить конфигурации Nginx/systemd и существующие базы,
проверить архивы, сохранить внешнюю копию. Не выполнять DROP, reset, seed,
удаление каталогов, автоматическую очистку резервных копий или изменение SSH.
Не выключать существующие сайты и не менять firewall без проверки его правил.

## 2. Подготовка проверенного релиза

Разобрать незакоммиченные изменения совместно с владельцем. Подготовить коммиты
только с относящимися к ним файлами; не использовать `git add .`.
Повторить build/test на согласованной версии. Зафиксировать SHA релиза.
Не публиковать `.env`, `.runtime`, `.venv`, `node_modules`, ключи, дампы и логи.

На локальной Windows-машине сборка выполняется через `npm.cmd ci`,
`npm.cmd run build`, `npm.cmd test` в `frontend`. Нужен Node, удовлетворяющий
`engines` Vite из package-lock (проверенный локальный Node указывается в отчёте).
На сервер Node не нужен: React публикуется как готовая статика.

После подтверждения выполнить обычный push без `--force`. Из согласованного
коммита создать `git archive` в `.runtime`, передать архив и соответствующий
`frontend/dist` по SCP. GitHub-токен на сервер не копировать.

## 3. Пакеты и отдельная база (после подтверждения)

Для Ubuntu 24.04:

```bash
sudo apt-get update
sudo apt-get install --no-install-recommends python3 python3-venv postgresql postgresql-client nginx certbot python3-certbot-nginx curl
```

Только если аккаунт ещё не существует:

```bash
sudo adduser --system --group --home /srv/zapchast --no-create-home zapchast
sudo install -d -o root -g root -m 0755 /srv/zapchast/releases
sudo install -d -o root -g root -m 0700 /etc/zapchast
sudo install -d -o postgres -g postgres -m 0700 /var/backups/zapchast
```

Проверить `pg_hba.conf`: локальное соединение `zapchast` к `zapchast` должно
использовать peer. Если это не так, предложить точечное правило после отдельного
обзора действующей конфигурации. Не включать `trust` в production и не открывать
5432 наружу. Создать роль/базу только если их ещё нет:

```bash
sudo -u postgres createuser --no-superuser --no-createdb --no-createrole zapchast
sudo -u postgres createdb --owner=zapchast --template=template0 --encoding=UTF8 --locale-provider=icu --icu-locale=ru-TJ zapchast
sudo -u zapchast psql -d zapchast -c 'select current_user, current_database();'
```

Для кириллицы нужна Unicode-локаль: база с `LC_CTYPE=C` и libc-провайдером
не обеспечивает корректный lower() русских названий. Для новой базы используется
ICU ru-TJ. Проверить `SELECT lower('Истаравшан') = 'истаравшан';` — результат `t`.
У существующей базы сначала проверить локаль и поведение; не пересоздавать её.

Если есть действующие данные SQLite или другая база магазина, не подменять их
пустой PostgreSQL. Сначала согласовать перенос с резервной копией и сверкой
пользователей, товаров, заказов, сумм и остатков. Автоматический перенос здесь
не реализован; выбор источника данных требует инвентаризации VPS.

## 4. Каталог релиза и секреты

Новый релиз распаковать в новый `/srv/zapchast/releases/RELEASE_SHA`.
Заменить `RELEASE_SHA` согласованным SHA во всех командах. Не распаковывать поверх
действующей версии. Код принадлежит root и доступен на чтение `zapchast`/`www-data`.
Создать окружение именно в окончательном каталоге, не переносить готовую venv:

```bash
sudo python3 -m venv /srv/zapchast/releases/RELEASE_SHA/backend/.venv
sudo /srv/zapchast/releases/RELEASE_SHA/backend/.venv/bin/python -m pip install -r /srv/zapchast/releases/RELEASE_SHA/backend/requirements.txt
```

Скопировать `deploy/production.env.example` в `/etc/zapchast/backend.env` только
при отсутствии этого файла, с правами root:root 0600. Сгенерировать JWT_SECRET
прямо на сервере в файл, не выводя его в терминал:

```bash
sudo python3 - <<'PY'
from pathlib import Path
import secrets
path = Path('/etc/zapchast/backend.env')
old = path.read_text()
placeholder = 'replace-with-at-least-32-random-characters'
if old.count(placeholder) != 1:
    raise SystemExit('Refusing to overwrite an existing secret')
path.write_text(old.replace(placeholder, secrets.token_urlsafe(64)))
path.chmod(0o600)
PY
```

Не менять JWT_SECRET при каждом релизе: это разлогинит пользователей.
Не исполнять `.env` через `source`; systemd читает его как EnvironmentFile.

## 5. Резервная копия и миграции

Установить root-owned `deploy/scripts/backup-db.sh` как
`/usr/local/lib/zapchast/backup-db.sh` с правами 0755. Запустить:

```bash
sudo -u postgres /usr/local/lib/zapchast/backup-db.sh
```

Убедиться в успешном завершении, наличии дампа и его копии вне VPS.
Проверить восстановление в отдельной новой базе. Только затем применять миграции:

```bash
sudo systemd-run --wait --pipe --collect -p User=zapchast -p Group=zapchast -p WorkingDirectory=/srv/zapchast/releases/RELEASE_SHA/backend -p EnvironmentFile=/etc/zapchast/backend.env /srv/zapchast/releases/RELEASE_SHA/backend/.venv/bin/alembic upgrade head
```

Не запускать тесты против production-базы. Не запускать `app.seed` на рабочем
сервере. Администратора создавать отдельно интерактивно через `app.cli create-admin`,
с тем же пользователем, WorkingDirectory и EnvironmentFile; для ввода пароля
использовать `systemd-run --pty --wait --collect` вместо `--pipe`.

## 6. Переключение и Nginx

Сохранить путь предыдущего релиза. `/srv/zapchast/current` должен отсутствовать
или быть символической ссылкой; если это обычный каталог — остановиться.
Создать/переключить ссылку на подготовленный релиз. Установить unit
`deploy/systemd/zapchast-api.service` в `/etc/systemd/system/`, затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zapchast-api
sudo systemctl restart zapchast-api
curl --fail http://127.0.0.1:8000/ready
```

Установить `deploy/nginx/proxy.conf` как
`/etc/nginx/snippets/zapchast-proxy.conf`, а `deploy/nginx/zapchast.conf` как
`/etc/nginx/sites-available/zapchast.king.tj` (не перезаписывать существующие файлы
без сравнения и резервной копии). Создать ссылку в `sites-enabled`.

```bash
sudo nginx -t
sudo systemctl reload nginx
curl --fail --resolve zapchast.king.tj:80:127.0.0.1 http://zapchast.king.tj/health
```

Nginx сохраняет `/api/v1` в пути proxy_pass; подставляет фактический IP клиента
в X-Forwarded-For. Убедиться, что Uvicorn недоступен извне, порт 8000 не занят
чужим приложением. Если занят — согласовать другой порт и изменить оба конфига.

## 7. HTTPS и продление

После проверки DNS, внешней доступности порта 80 и сохранения Nginx-конфигураций:

```bash
sudo certbot --nginx --redirect -d zapchast.king.tj
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
systemctl list-timers --all
```

Email и условия Let's Encrypt подтвердить интерактивно. Проверить, что таймер
Certbot активен. Если не активен — изучить установленный способ продления и
включить соответствующий таймер. HTTP должен перенаправляться на HTTPS.
Для HSTS статических ответов дополнить созданный TLS-server после проверки
сертификата; не включать HSTS до успешной работы HTTPS.

Установить backup unit и timer, выполнить `systemctl daemon-reload`, затем
`systemctl enable --now zapchast-backup.timer`. Проверить ручной запуск service,
журнал и фактический дамп. Автоматического удаления копий нет: контролировать
место и согласовать retention отдельно. Внешнее хранилище нужно выбрать отдельно.

## 8. Приёмка и откат

Проверить снаружи и в браузере на десктопе/мобильном:

- HTTP → HTTPS, сертификат/имя/цепочка, `/health`, `/ready`.
- Главная, прямое открытие `/catalog`, JS/CSS/изображения без 404, адаптивность.
- Каталог, поиск, фильтры, карточка товара, подбор совместимости.
- Регистрация, вход, обновление сессии, выход; профиль и адреса.
- Гостевая корзина, корзина пользователя, количество, наличие.
- Тестовый заказ только с согласия владельца: доставка, купон, списание остатков,
  история заказа и роли администратора. Не создавать реальные заказы молча.
- Избранное, сравнение, гараж, статьи, поддержка, аналитика, AI/3D.
- `/robots.txt`, `/sitemap.xml`, canonical и OpenGraph используют zapchast.king.tj.
- Неавторизованному пользователю недоступны административные API.
- Логи `journalctl -u zapchast-api`, Nginx, `systemctl --failed`, backup timer.

Автоматическая проверка публичных GET-запросов (без создания данных):
`python3 deploy/scripts/smoke.py --base-url https://zapchast.king.tj`.

Онлайн-эквайринг не подключён в исходном проекте. Не представлять создание заказа
как подтверждение оплаты. Для реальных онлайн-платежей нужен отдельный провайдер.

При сбое приложения вернуть `current` на сохранённый совместимый релиз и
перезапустить API; Nginx reload делать только после `nginx -t`. Миграции могут
быть несовместимы со старым кодом: не выполнять автоматический downgrade и не
восстанавливать дамп поверх заказов, поступивших после копии. Восстановление БД —
отдельно согласованная операция с учётом новых данных.

Справка: [Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[PostgreSQL peer](https://www.postgresql.org/docs/current/auth-peer.html),
[Certbot](https://certbot.eff.org/).
