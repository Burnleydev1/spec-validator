# spec-validator

OpenAPI response validator with Claude-powered bug vs spec-drift classification.

## Setup

```bash
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

## Config

Edit `config/specs.json` to add your OpenAPI specs:

```json
{
  "specs": [
    {
      "name": "Orders API",
      "url": "https://raw.githubusercontent.com/your-org/specs/main/orders.yaml",
      "owner": "team-backend",
      "lastVerified": "2026-03-10"
    }
  ]
}
```

## Run

```bash
npm start        # production
npm run dev      # with nodemon
```

## Endpoints

### `POST /validate`

```json
{
  "specName": "Orders API",
  "url": "/api/v1/orders/12345",
  "method": "GET",
  "statusCode": 200,
  "responseBody": { ... }
}
```

### `GET /reports`

Returns list of generated `.md` report filenames.

### `GET /reports/:filename`

Returns the content of a specific report.

## Postman Integration

Paste `postman-test-script.js` into your collection's **Tests** tab.

Set these Postman collection variables:
- `specName` — matches a name in `config/specs.json`
- `validatorUrl` — your deployed Render URL (e.g. `https://spec-validator.onrender.com`)

## Deploy to Render

1. Push repo to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add env var: `ANTHROPIC_API_KEY`
