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

- `POST /auth/register`
- `GET /billing/pricing`
- `POST /billing/checkout`
- `GET /billing/subscription`
- `GET /account/me`
- `GET /account/bots`
- `POST /account/plan`
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
- `POST /webhooks/billing`
- `POST /webhooks/telegram/{botId}`

All endpoints except `GET /health`, `GET /billing/pricing`, `POST /webhooks/billing`, and `POST /webhooks/telegram/{botId}` require `x-api-key: <owner-api-key>` or `Authorization: Bearer <owner-api-key>`.

Default plans:

- `starter`: up to 2 bots, 5,000 monthly events
- `growth`: up to 25 bots, 250,000 monthly events

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
- `API_KEY_HASH_SECRET`
- `BILLING_WEBHOOK_SECRET`

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

Seeded local owner credentials:

- email: `demo@example.com`
- api key: `demo-owner-api-key`

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
curl "http://localhost:3000/stats/dashboard?botType=username&botValue=sample_analytics_bot" \
  -H "x-api-key: demo-owner-api-key"
```

Account summary:

```bash
curl "http://localhost:3000/account/me" \
  -H "x-api-key: demo-owner-api-key"
```

Switch demo account to growth plan:

```bash
curl -X POST "http://localhost:3000/account/plan" \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-owner-api-key" \
  -d '{
    "plan": "growth"
  }'
```

Pricing:

```bash
curl "http://localhost:3000/billing/pricing"
```

Create checkout preview:

```bash
curl -X POST "http://localhost:3000/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-owner-api-key" \
  -d '{
    "plan": "growth",
    "provider": "manual",
    "successUrl": "http://localhost:5173/billing/success",
    "cancelUrl": "http://localhost:5173/billing/cancel"
  }'
```

Simulate successful billing webhook:

```bash
curl -X POST "http://localhost:3000/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "x-billing-webhook-secret: replace-with-a-random-billing-webhook-secret" \
  -d '{
    "provider": "manual",
    "type": "subscription.updated",
    "providerEventId": "evt_demo_growth_001",
    "accountId": "10000000-0000-0000-0000-000000000001",
    "plan": "growth",
    "status": "active",
    "providerCustomerId": "cust_demo_owner",
    "providerSubscriptionId": "sub_demo_growth",
    "amount": 99,
    "currency": "USD",
    "currentPeriodStart": "2026-03-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z"
  }'
```

Message event:

```bash
curl -X POST "http://localhost:3000/events/message" \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-owner-api-key" \
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
- `API_KEY_HASH_SECRET`
- `BILLING_WEBHOOK_SECRET`
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
- owner email: `demo@example.com`
- owner api key: `demo-owner-api-key`

Use that identity to test the dashboard endpoints immediately after seeding.
