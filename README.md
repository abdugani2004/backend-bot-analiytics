# Telegram Bot Analytics Backend

Separate TypeScript backend for a Telegram Bot Analytics frontend. The API matches the existing frontend query-param contract and is designed for AWS Lambda + API Gateway + PostgreSQL.

## Stack

- TypeScript
- AWS Lambda + API Gateway
- PostgreSQL
- Serverless Framework

## API contract

All success responses:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

All error responses:

```json
{
  "success": false,
  "data": null,
  "message": "...",
  "error": {
    "code": "...",
    "details": {}
  }
}
```

Available endpoints:

- `POST /bots/connect`
- `POST /bots/verify`
- `POST /bots/enable-tracking`
- `GET /health`
- `GET /stats/dashboard?botType=token&botValue=...`
- `GET /stats/overview?botType=token&botValue=...`
- `GET /stats/users?botType=token&botValue=...`
- `GET /stats/growth?botType=token&botValue=...`
- `GET /stats/revenue?botType=token&botValue=...`
- `GET /stats/messages?botType=token&botValue=...`
- `POST /events/message`
- `POST /events/user-joined`
- `POST /events/payment`
- `POST /webhooks/telegram/{botId}`

## Bot identity handling

- `botType=username`: backend normalizes the username and maps it to an internal bot record.
- `botType=token`: backend hashes the token with `TOKEN_HASH_SECRET` before storage and never returns the raw token.
- Real Telegram ingestion requires a token-based onboarding flow so the backend can verify the bot and register a webhook.
- The frontend can keep sending `botType` and `botValue` as it does today. The backend resolves that pair to an internal `bots.id`.

## Real Telegram bot flow

To collect live analytics from a real Telegram bot:

1. Frontend calls `POST /bots/connect` with the bot token.
2. Frontend calls `POST /bots/verify` with the same token.
   This runs Telegram `getMe`, validates the token server-side, and stores the token encrypted.
3. Frontend calls `POST /bots/enable-tracking`.
   This registers a Telegram webhook that points to `POST /webhooks/telegram/{botId}`.
4. Telegram sends updates to your backend, and the backend converts them into analytics events.

Required env vars for live webhook ingestion:

- `TOKEN_ENCRYPTION_SECRET`
- `TELEGRAM_WEBHOOK_BASE_URL`
- `TELEGRAM_WEBHOOK_SECRET`

## Project structure

```text
src/
  functions/
  repositories/
  services/
  types/
  utils/
sql/
scripts/
```

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create `.env` from `.env.example` and fill in values.

4. Apply schema and seed sample data:

```bash
npm run seed
```

5. Build the TypeScript output:

```bash
npm run build
```

6. Run the API locally:

```bash
npm run dev
```

Default local frontend origin is `http://localhost:5173`.

## Example requests

Dashboard:

```bash
curl "http://localhost:3000/stats/dashboard?botType=username&botValue=sample_analytics_bot"
```

Message event:

```bash
curl -X POST "http://localhost:3000/events/message" \
  -H "Content-Type: application/json" \
  -d '{
    "botType": "username",
    "botValue": "sample_analytics_bot",
    "user": {
      "telegramId": "123456789",
      "username": "demo_user",
      "firstName": "Demo",
      "lastName": "User"
    },
    "text": "hello from telegram"
  }'
```

## Deployment

1. Set production environment variables:

- `DATABASE_URL`
- `TOKEN_HASH_SECRET`
- `CORS_ORIGIN`
- `AWS_REGION`
- `NODE_ENV=production`

2. Build and deploy:

```bash
npm run deploy
```

Recommended production setup:

- PostgreSQL on Amazon RDS or Aurora PostgreSQL
- API Gateway HTTP API in front of Lambda
- CloudWatch log retention and alarms
- Secrets stored in AWS Systems Manager Parameter Store or Secrets Manager
- VPC attachment only if your database requires private networking
- A public HTTPS URL for Telegram webhook delivery

## Notes

- The backend creates a bot record on first sight of a valid identity.
- Aggregations are computed in SQL for maintainability and to keep the API payload frontend-ready.
- `recentActivity` is sourced from `activity_logs`.
- `botStatus`, `apiHealth`, `uptimePct`, and `requestsToday` are based on `bot_health_logs`.

## Sample data

`sql/seed.sql` seeds one username-based bot:

- `botType=username`
- `botValue=sample_analytics_bot`

Use that identity to test the dashboard endpoints immediately after seeding.
