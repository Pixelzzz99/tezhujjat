# DocGen MVP — генератор документов для ИП/фрилансеров (Узбекистан)

MVP: NestJS + Prisma + Puppeteer. Реализован один тип документа — **договор оказания услуг**.
Остальные шаблоны (акт, счёт, оферта) добавляются по тому же паттерну (см. `src/documents/templates/`).

## Что уже сделано

- Prisma-схема: `User`, `Profile`, `Client`, `Template`, `Document`, `Subscription`
- Auth: регистрация/логин по email+паролю, JWT (access-токен, без refresh)
- CRUD для `Profile` (реквизиты ИП/самозанятого — ФИО, ИНН, банк, счёт, МФО, адрес)
- CRUD для `Client` (create + list — заказчики пользователя)
- Генерация PDF договора из HTML-шаблона (Handlebars + Puppeteer)
- Проверка лимита free-плана (2 документа/мес)
- Все эндпоинты, кроме `/auth/*`, защищены `JwtAuthGuard` — `userId` берётся из токена, а не из заголовка

## Что сознательно НЕ сделано (осознанно, для скорости MVP)

- Refresh-токены / logout / сброс пароля — только access-токен с фиксированным сроком жизни (7 дней)
- CRUD для `Client`: только create + list (без update/delete)
- Интеграция оплаты Click/Payme — на старте продаём вручную первым клиентам, автосписания добавляются второй итерацией
- Хранение PDF в облаке (S3/аналог) — сейчас PDF отдаётся напрямую в ответе, не сохраняется как файл
- Сброс `documentsUsedThisMonth` по календарю — нужна cron-джоба (например, через `@nestjs/schedule`)

## Запуск локально

```bash
# 1. Установить зависимости
npm install

# 2. Поднять PostgreSQL (например, через Docker)
docker run --name docgen-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=docgen -p 5432:5432 -d postgres:16

# 3. Настроить .env
cp .env.example .env
# отредактировать DATABASE_URL под свою БД; JWT_SECRET сгенерировать отдельно, например:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Прогнать миграции
npx prisma migrate dev

# 5. Засеять шаблон договора в БД
npx ts-node prisma/seed.ts

# 6. Запустить в dev-режиме
npm run start:dev
```

Puppeteer при первой установке (`npm install`) сам скачивает Chromium — если стоите за прокси/файрволом, может понадобиться `PUPPETEER_SKIP_DOWNLOAD` + отдельная установка браузера, смотрите документацию Puppeteer.

## API: полный цикл

Все запросы ниже — по порядку, как реально проходит пользователь: регистрация → логин →
заполнение реквизитов исполнителя → добавление заказчика → генерация договора → просмотр списка
документов. Все эндпоинты кроме `POST /auth/register` и `POST /auth/login` требуют заголовок
`Authorization: Bearer <accessToken>`.

Порт по умолчанию — `3000` (см. `PORT` в `.env`); в примерах используется `localhost:3000`, подставьте свой.

### 1. Регистрация — `POST /auth/register`

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "phone": "+998901234567"
  }'
```

`phone` опционален. `password` — минимум 8 символов. Ответ:

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

Повторная регистрация с тем же email → `409 Conflict`.

### 2. Логин — `POST /auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "password123" }'
```

Тот же формат ответа, что и у регистрации. Неверный email/пароль → `401 Unauthorized`
(сообщение одинаковое в обоих случаях — не палит, существует ли email).

Сохраните токен в переменную для следующих шагов:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "password123" }' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))")
```

### 3. Реквизиты исполнителя — `POST/GET/PATCH /profile`

Без заполненного профиля генерация договора вернёт `404` (нечего подставлять в поля "Исполнитель").

```bash
# Создать (один раз; повторный POST → 409)
curl -X POST http://localhost:3000/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "ИП Иванов Иван Иванович",
    "inn": "123456789",
    "bankName": "Kapitalbank",
    "bankAccount": "20208000123456789012",
    "mfo": "00445",
    "address": "г. Ташкент, ул. Амира Темура, 1"
  }'

# Получить
curl http://localhost:3000/profile -H "Authorization: Bearer $TOKEN"

# Обновить (частично, любые поля)
curl -X PATCH http://localhost:3000/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "bankAccount": "20208000999999999999" }'
```

### 4. Заказчики — `POST/GET /clients`

```bash
# Создать
curl -X POST http://localhost:3000/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ООО Тестовая компания",
    "type": "COMPANY",
    "inn": "987654321",
    "address": "г. Самарканд"
  }'

# Список
curl http://localhost:3000/clients -H "Authorization: Bearer $TOKEN"
```

`type` — `INDIVIDUAL` (физлицо) или `COMPANY` (юрлицо), по умолчанию `INDIVIDUAL`.

### 5. Генерация договора — `POST /documents/contract`

`clientName`/`clientInn`/`clientAddress` передаются в теле напрямую (без привязки к записи из
`/clients` — на MVP это отдельные независимые поля).

```bash
curl -X POST http://localhost:3000/documents/contract \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "ООО Тестовая компания",
    "clientInn": "123456789",
    "serviceDescription": "Разработка backend-части веб-приложения",
    "startDate": "01.09.2026",
    "endDate": "30.09.2026",
    "amount": "5000000",
    "currency": "UZS"
  }' \
  --output contract.pdf
```

Ответ — бинарный PDF-файл. Обязательные поля: `clientName`, `serviceDescription`, `startDate`,
`endDate`, `amount` (числовая строка). Превышение лимита free-плана (2 документа/мес) → `403`.

### 6. Список документов — `GET /documents`

```bash
curl http://localhost:3000/documents -H "Authorization: Bearer $TOKEN"
```

Возвращает документы только текущего пользователя (из JWT), отсортированные по дате создания.

### Сводная таблица эндпоинтов

| Метод | Путь | Auth | Описание |
|---|---|---|---|
| POST | `/auth/register` | — | Регистрация, выдаёт JWT |
| POST | `/auth/login` | — | Логин, выдаёт JWT |
| POST | `/profile` | JWT | Создать реквизиты (409 если уже есть) |
| GET | `/profile` | JWT | Получить свои реквизиты (404 если не заполнены) |
| PATCH | `/profile` | JWT | Частично обновить реквизиты |
| POST | `/clients` | JWT | Добавить заказчика |
| GET | `/clients` | JWT | Список своих заказчиков |
| POST | `/documents/contract` | JWT | Сгенерировать PDF договора |
| GET | `/documents` | JWT | Список своих документов |

## План на ближайшие шаги (по приоритету)

1. Шаблоны акта выполненных работ и счёта на оплату (по аналогии с `contract.html`)
2. Сохранение PDF в облако + `pdfUrl` в БД вместо прямой отдачи в ответе
3. Простая веб-форма (или Telegram Mini App) поверх этих эндпоинтов
4. Ручная продажа первым 10 платящим (см. обсуждение в чате) — до автоматизации оплаты

## Юридическая оговорка

Текст шаблона договора — общий каркас, не проверен юристом/бухгалтером под актуальные требования РУз.
Перед реальным использованием стоит показать шаблоны практикующему бухгалтеру или юристу и на старте
явно писать пользователям, что сервис не заменяет юридическую консультацию.
