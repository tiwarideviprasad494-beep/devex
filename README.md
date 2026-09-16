# Devex Logistics

A deployable global logistics marketing site with shipment-tracking and quote-request APIs.

## Run locally

Install Node.js 18 or newer, then run:

```sh
npm start
```

Open `http://localhost:3000`. Use these sample shipment references to test tracking:

- `NSF-2026-001`
- `NSF-2026-002`
- `NSF-2026-003`

Submitted quote requests are stored locally in `data/quotes.json`. That file is intentionally excluded from source control.

## Deploy globally

Deploy the included `Dockerfile` to a container host such as Render, Fly.io, Google Cloud Run, AWS App Runner, or Azure Container Apps. The included `/health` endpoint is ready for platform health checks.

### Render quick deployment

1. Push this folder to a private GitHub repository.
2. In Render, choose **New → Web Service**, connect the repository, and select the **Docker** runtime.
3. Leave the Docker command empty; the included Dockerfile starts the app. Set health-check path to `/health`.
4. Choose a region close to most customers. Render gives the service an HTTPS `onrender.com` address when the deploy finishes.
5. For the current file-based quote storage, attach a persistent disk at `/app/data`. For a scalable production site, use a managed database instead.
6. Add your own domain under the service's Custom Domains settings and update DNS as instructed by your domain registrar.

For live freight information, integrate `/api/track/:reference` with a carrier or multi-carrier tracking provider, and send approved quote requests from `/api/quotes` to your CRM/email service. Keep provider keys in platform environment variables; never in browser JavaScript.

## Production checklist

- Buy and connect a domain; enforce HTTPS.
- Add a managed database and encrypted backups for customer data.
- Connect a transactional email/CRM service for quote follow-up.
- Add real carrier tracking credentials and webhooks.
- Publish privacy, cookie, and service terms approved for each target market.
