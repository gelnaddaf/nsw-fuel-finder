# NSW Fuel Price Finder

A Cloudflare Edge web application that provides real-time fuel price comparison across NSW using the NSW Government Fuel API.

## Project Status

| Milestone | Status |
|-----------|--------|
| Project Setup & README | ✅ Complete |
| Cloudflare Account Connectivity | ✅ Complete |
| NSW Fuel API Keys | ✅ Complete |
| Project Scaffolding | ✅ Complete |
| Workers API Layer | ✅ Complete |
| Frontend (React SPA) | ✅ Complete |
| Map Integration | ✅ Complete |
| D1 Database + KV Cache | ✅ Complete |
| Local Dev Server | ✅ Complete |
| Rate Limiting + Caching | ✅ Complete |
| Deployment to Cloudflare | ✅ Live |
| PWA Support | ✅ Complete |
| Security Hardening | ✅ Complete |
| Cloudflare Access (Zero Trust) | ✅ Active |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React (SPA) on Cloudflare Workers |
| **Edge Runtime** | Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **Caching** | Cloudflare KV |
| **Maps** | Leaflet (OpenStreetMap) |
| **Hosting** | Cloudflare Workers Static Assets |
| **Styling** | TailwindCSS v3 |
| **Icons** | Lucide React |
| **Build** | Vite v6 |

## Data Source

- **NSW Fuel API** — [api.nsw.gov.au](https://api.nsw.gov.au/Product/Index/22)
- Provides real-time fuel prices for 2,500+ service stations across NSW
- Endpoints: search by suburb/postcode, radius, fuel type, bulk prices
- Rate limit (free tier): 2,500 calls/month

## Features

- [x] Search by suburb or postcode
- [x] GPS "Near me" location search
- [x] Filter by fuel type (E10, U91, U95, U98, Diesel, Premium Diesel, LPG)
- [x] Map view with station pins colour-coded by price
- [x] Sorted list of cheapest stations
- [x] Stats dashboard (cheapest, average, most expensive, station count)
- [x] "Browse all NSW stations" bulk view
- [x] Server-side OAuth token management with KV caching
- [x] 5-minute price data caching (KV) to respect rate limits
- [x] Location + nearby search caching (5-min TTL per query)
- [x] IP-based rate limiting (60 requests/min per visitor)
- [x] Suburb autocomplete search bar (736 suburbs, cached in KV)
- [x] Price history chart (SVG, 7/14/30-day trend with avg/min/max stats)
- [x] D1 cron snapshots every 6 hours for historical tracking
- [x] Trip cost calculator (enter litres, see cost per station + savings)
- [x] Google Maps directions link on each station card
- [x] Admin snapshot endpoint (protected, for manual D1 seeding)
- [x] PWA support (manifest, service worker, offline caching, app icons)
- [x] Install prompt banner (Android native install + iOS instructions)
- [x] Security hardening (CORS lockdown, input validation, security headers, error sanitization)
- [x] Cloudflare Access (Zero Trust) — site locked to owner email only
- [ ] Favourite stations

## Session Resume Guide

> **IMPORTANT:** When reopening this project in a new Windsurf session, tell Cascade:
> *"Read the README.md and resume where we left off."*
> This section contains everything needed to reconnect and continue working.

### Cloudflare Connection

- **Email:** (see `.dev.vars` or Cloudflare dashboard)
- **Account ID:** (see Cloudflare dashboard → Overview)
- **Auth method:** Global API Key (stored as env var, never in code)
- **Wrangler CLI:** Installed globally (`wrangler v4.64.0`)
- **Connect command (PowerShell):**
  ```powershell
  $env:CLOUDFLARE_API_TOKEN="<your-global-api-key>"
  $env:CLOUDFLARE_EMAIL="<your-email>"
  wrangler whoami
  ```

### NSW Fuel API Connection

- **Portal:** [api.nsw.gov.au](https://api.nsw.gov.au) (registered as george.elnaddaf@gmail.com)
- **Subscription:** Fuel Check Portal Api (approved)
- **Auth flow:** Two-step — get Bearer token first, then use it for data requests
- **Credentials stored in:** `.dev.vars` (gitignored, never committed)
- **Auth test command (PowerShell):**
  ```powershell
  # Step 1: Get access token (uses NSW_FUEL_API_AUTH from .dev.vars)
  $auth = @{ "Authorization" = "Basic <base64-encoded-key:secret — see .dev.vars>" }
  $token = (Invoke-RestMethod -Uri "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken?grant_type=client_credentials" -Headers $auth).access_token

  # Step 2: Fetch fuel prices (uses NSW_FUEL_API_KEY from .dev.vars)
  $headers = @{ "Authorization"="Bearer $token"; "apikey"="<your-api-key>"; "transactionid"=[guid]::NewGuid().ToString(); "requesttimestamp"=(Get-Date -Format "dd/MM/yyyy hh:mm:ss tt") }
  $data = Invoke-RestMethod -Uri "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices" -Headers $headers
  Write-Host "Stations: $($data.stations.Count), Prices: $($data.prices.Count)"
  ```
- **Token lifetime:** ~12 hours (43,199 seconds) — auto-refreshed by Workers API
- **Confirmed data:** 3,284 stations, 10,659 price entries across NSW

### Key Files for Secrets

| File | Purpose | Git Status |
|------|---------|------------|
| `.dev.vars` | Local dev secrets (NSW Fuel API Key, Secret, Auth header) | **Gitignored** |
| `.gitignore` | Ensures secrets are never committed | Tracked |
| `wrangler.toml` | Cloudflare Workers config (references secrets by name) | Tracked |

## Credentials & Configuration

| Service | Status | Notes |
|---------|--------|-------|
| Cloudflare Account | ✅ Verified | Email: george.elnaddaf@gmail.com, Account ID: 5f5ffeb8dcd48af221e419cb5d9eb026 |
| Cloudflare API Token | ✅ Verified | Global API Key — stored as env var (not in code) |
| NSW Fuel API Key | ✅ Verified | Stored in .dev.vars (gitignored) |
| NSW Fuel API Secret | ✅ Verified | Stored in .dev.vars (gitignored) |

> **Security:** All API keys and secrets are stored as Wrangler secrets or environment variables. They are NEVER committed to source code.

### Cloudflare Resources

| Resource | ID | Binding |
|----------|----|---------|
| KV Namespace | `4dc4b713a7824574b9c955e83c3d2f5f` | `FUEL_CACHE` |
| D1 Database | `c1bf122d-441a-4fa9-a7af-3e6838699e63` | `DB` |

## Project Structure

```
GOVProject/
├── README.md                       # This file — source of truth
├── wrangler.toml                   # Cloudflare Workers config (D1, KV, assets)
├── package.json                    # Dependencies
├── vite.config.ts                  # Vite build config
├── tsconfig.json                   # TypeScript config
├── tailwind.config.js              # TailwindCSS theme (NSW colours)
├── postcss.config.js               # PostCSS config
├── index.html                      # HTML entry point
├── schema.sql                      # D1 database schema
├── .dev.vars                       # Local dev secrets (gitignored)
├── .gitignore                      # Git ignore rules
├── public/
│   ├── fuel-icon.svg               # Favicon
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker (offline caching)
│   ├── icon-192.png                # PWA icon 192x192
│   └── icon-512.png                # PWA icon 512x512
├── dist/                           # Vite build output (gitignored)
└── src/
    ├── main.tsx                    # React entry point
    ├── App.tsx                     # Main app component (state, routing)
    ├── index.css                   # TailwindCSS imports + custom classes
    ├── api/
    │   └── fuel.ts                 # Frontend API client + types + helpers
    ├── components/
    │   ├── Header.tsx              # App header with NSW branding
    │   ├── SearchBar.tsx           # Search input + location button
    │   ├── FuelTypeFilter.tsx      # Fuel type selector (E10, U91, etc.)
    │   ├── StatsBar.tsx            # Price statistics dashboard
    │   ├── FuelList.tsx            # Station list with pagination
    │   ├── FuelCard.tsx            # Individual station card (+ directions + trip cost)
    │   ├── MapView.tsx             # Leaflet map with price markers
    │   ├── PriceChart.tsx          # SVG price history chart (7/14/30-day)
    │   └── InstallPrompt.tsx       # PWA install banner (Android + iOS)
    └── worker/
        └── index.ts                # Cloudflare Worker (API proxy + auth)
```

## Setup & Development

```bash
# Install dependencies
npm install

# Build frontend (required before wrangler dev)
npx vite build

# Run locally (Workers + static assets on port 8787)
# Must set Cloudflare env vars first (see Session Resume Guide)
npx wrangler dev

# Deploy to Cloudflare
npm run deploy

# Apply D1 schema (local)
npm run db:migrate
```

## Changelog

- **2026-02-12** — Project initialized. README created. Cloudflare connectivity verified. NSW Fuel API keys verified (3,284 stations, 10,659 prices confirmed). Full project scaffolded: Vite + React + TailwindCSS frontend, Cloudflare Worker API with OAuth token management, KV caching, D1 schema. Components: Header, SearchBar, FuelTypeFilter, StatsBar, FuelList, FuelCard, MapView. Local dev server running on localhost:8787.
- **2026-02-12** — Deployed to Cloudflare: https://nsw-fuel-finder.george-elnaddaf.workers.dev. Added location/nearby search caching (5-min KV TTL per suburb+fueltype), IP-based rate limiting (20 req/min), fixed Invalid Date parsing (DD/MM/YYYY). Production secrets set via `wrangler secret put`.
- **2026-02-12** — Bug fixes: (1) Location search changed from GET to POST (NSW API requirement). (2) Fuel type codes fixed: P95/P98 instead of U95/U98, added E85. (3) Added detailed API logging to Worker. (4) Fixed "Browse all NSW stations" returning empty — type mismatch between station.code (string) and price.stationcode (number), fixed with String() coercion. (5) Switched all endpoints from v2 to v1 for NSW-only data (v2 included Tasmania).
- **2026-02-12** — Rate limit fix: increased from 20 to 60 req/min (was blocking normal use). Added suburb autocomplete (736 suburbs extracted from station addresses, KV-cached 1hr).
- **2026-02-12** — New features: (1) Price History Chart — SVG-based, 7/14/30-day views, shows avg/min/max/trend stats, powered by D1 cron snapshots every 6hrs. (2) Google Maps Directions — each station card has a "Directions" link opening turn-by-turn navigation. (3) Trip Cost Calculator — enter litres, see dollar cost per station + savings vs most expensive. Admin snapshot endpoint added for manual D1 seeding.
- **2026-02-12** — PWA support: manifest.json, service worker with network-first HTML / cache-first hashed assets strategy, 192px + 512px app icons, InstallPrompt component with native install on Android/Chrome and manual instructions on iOS. Fixed blank-page bug caused by service worker caching stale HTML.
- **2026-02-12** — Security hardening: (1) Removed all hardcoded secrets from README (replaced with placeholders). (2) CORS locked to production domain + localhost only (was wildcard *). (3) Security headers added: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. (4) Error messages sanitized — no internal details leaked to clients. (5) Input validation on all query params: fuel type whitelist, suburb length cap, numeric coord validation, radius/days bounds.
- **2026-02-12** — Cloudflare Access (Zero Trust) enabled: site protected by email OTP authentication, locked to owner email only. Free tier, no code changes required.
