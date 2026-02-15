export interface Env {
  ASSETS: Fetcher;
  FUEL_CACHE: KVNamespace;
  DB: D1Database;
  NSW_FUEL_API_BASE: string;
  NSW_FUEL_API_KEY: string;
  NSW_FUEL_API_SECRET: string;
  NSW_FUEL_API_AUTH: string;
}

interface OAuthTokenResponse {
  access_token: string;
  expires_in: string;
  token_type: string;
}

interface FuelStation {
  brand: string;
  code: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
  state: string;
}

interface FuelPrice {
  stationcode: string;
  fueltype: string;
  price: number;
  lastupdated: string;
}

interface FuelPricesResponse {
  stations: FuelStation[];
  prices: FuelPrice[];
}

// Rate limiting: max requests per IP per minute that trigger real API calls
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW = 60; // seconds

// CORS: restrict to known origins (production + local dev)
const ALLOWED_ORIGINS = new Set([
  'https://nsw-fuel-finder.george-elnaddaf.workers.dev',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]);

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  };
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self)',
};

const VALID_FUEL_TYPES = new Set(['E10', 'U91', 'P95', 'P98', 'DL', 'PDL', 'LPG', 'E85', 'EV', 'B20']);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

async function getAccessToken(env: Env): Promise<string> {
  // Check KV cache first
  const cached = await env.FUEL_CACHE.get('oauth_token');
  if (cached) {
    console.log('[OAuth] Using cached token');
    return cached;
  }

  console.log('[OAuth] Requesting new token...');
  console.log('[OAuth] Auth header present:', !!env.NSW_FUEL_API_AUTH);

  // Request new token
  const response = await fetch(
    `${env.NSW_FUEL_API_BASE}/oauth/client_credential/accesstoken?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: {
        Authorization: env.NSW_FUEL_API_AUTH,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error('[OAuth] Failed:', response.status, body);
    throw new Error(`OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  const token = data.access_token;
  const ttl = Math.max(parseInt(data.expires_in) - 300, 60); // expire 5 min early

  console.log('[OAuth] Got token, caching for', ttl, 'seconds');

  // Cache the token
  await env.FUEL_CACHE.put('oauth_token', token, { expirationTtl: ttl });

  return token;
}

function fuelApiHeaders(token: string, apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=utf-8',
    apikey: apiKey,
    transactionid: crypto.randomUUID(),
    requesttimestamp: new Date().toLocaleString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
  };
}

async function handleGetAllPrices(env: Env): Promise<Response> {
  console.log('[AllPrices] Fetching all prices...');
  // Check cache (5 min TTL to stay within rate limits)
  const cached = await env.FUEL_CACHE.get('all_prices', 'json');
  if (cached) {
    console.log('[AllPrices] Returning cached data');
    return jsonResponse(cached);
  }

  const token = await getAccessToken(env);
  const headers = fuelApiHeaders(token, env.NSW_FUEL_API_KEY);

  const response = await fetch(
    `${env.NSW_FUEL_API_BASE}/FuelPriceCheck/v1/fuel/prices`,
    { headers }
  );

  if (!response.ok) {
    return errorResponse(`Fuel API error: ${response.status}`, response.status);
  }

  const data = (await response.json()) as FuelPricesResponse;

  // Cache for 5 minutes
  await env.FUEL_CACHE.put('all_prices', JSON.stringify(data), {
    expirationTtl: 300,
  });

  return jsonResponse(data);
}

async function handleGetReference(env: Env): Promise<Response> {
  const cached = await env.FUEL_CACHE.get('reference_data', 'json');
  if (cached) return jsonResponse(cached);

  const token = await getAccessToken(env);
  const headers = fuelApiHeaders(token, env.NSW_FUEL_API_KEY);

  const response = await fetch(
    `${env.NSW_FUEL_API_BASE}/FuelPriceCheck/v1/fuel/lovs`,
    { headers }
  );

  if (!response.ok) {
    return errorResponse(`Reference API error: ${response.status}`, response.status);
  }

  const data = await response.json();

  // Cache for 1 hour (reference data rarely changes)
  await env.FUEL_CACHE.put('reference_data', JSON.stringify(data), {
    expirationTtl: 3600,
  });

  return jsonResponse(data);
}

async function handleGetPricesByLocation(
  env: Env,
  url: URL
): Promise<Response> {
  const suburb = url.searchParams.get('suburb')?.trim().slice(0, 100);
  const fueltype = url.searchParams.get('fueltype') || 'E10';

  if (!suburb) {
    return errorResponse('Missing required parameter: suburb', 400);
  }
  if (!VALID_FUEL_TYPES.has(fueltype)) {
    return errorResponse('Invalid fuel type', 400);
  }

  // Cache key: normalised suburb + fuel type
  const cacheKey = `loc:${suburb.toLowerCase().trim()}:${fueltype}`;
  const cached = await env.FUEL_CACHE.get(cacheKey, 'json');
  if (cached) {
    console.log('[Location] Cache hit:', cacheKey);
    return jsonResponse(cached);
  }

  const token = await getAccessToken(env);
  const headers = fuelApiHeaders(token, env.NSW_FUEL_API_KEY);

  const response = await fetch(
    `${env.NSW_FUEL_API_BASE}/FuelPriceCheck/v1/fuel/prices/location`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fueltype,
        namedlocation: suburb,
      }),
    }
  );

  if (!response.ok) {
    return errorResponse(`Location API error: ${response.status}`, response.status);
  }

  const data = await response.json();

  // Cache for 5 minutes
  await env.FUEL_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
  console.log('[Location] Cached:', cacheKey);

  return jsonResponse(data);
}

async function handleGetSuburbs(env: Env): Promise<Response> {
  // Return cached suburb list (1-hour TTL)
  const cached = await env.FUEL_CACHE.get('suburb_list', 'json');
  if (cached) {
    console.log('[Suburbs] Cache hit');
    return jsonResponse(cached);
  }

  console.log('[Suburbs] Building suburb list from station data...');

  // Reuse the all-prices cache or fetch fresh
  let stationData = (await env.FUEL_CACHE.get('all_prices', 'json')) as FuelPricesResponse | null;
  if (!stationData) {
    const token = await getAccessToken(env);
    const headers = fuelApiHeaders(token, env.NSW_FUEL_API_KEY);
    const response = await fetch(
      `${env.NSW_FUEL_API_BASE}/FuelPriceCheck/v1/fuel/prices`,
      { headers }
    );
    if (!response.ok) {
      return errorResponse(`Fuel API error: ${response.status}`, response.status);
    }
    stationData = (await response.json()) as FuelPricesResponse;
    await env.FUEL_CACHE.put('all_prices', JSON.stringify(stationData), { expirationTtl: 300 });
  }

  // Extract unique suburbs from station addresses
  // Format: "123 Street Name, SUBURB NAME NSW 2000" — suburbs are ALL CAPS
  const suburbSet = new Set<string>();
  for (const station of stationData.stations) {
    const match = station.address.match(/([A-Z][A-Z ]+?)\s+NSW\s+\d{4}/);
    if (match) {
      // Title-case the suburb for nicer display
      const suburb = match[1]
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (suburb.length >= 3) suburbSet.add(suburb);
    }
  }

  const suburbs = [...suburbSet].sort();
  console.log(`[Suburbs] Found ${suburbs.length} unique suburbs`);

  // Cache for 1 hour
  await env.FUEL_CACHE.put('suburb_list', JSON.stringify(suburbs), { expirationTtl: 3600 });

  return jsonResponse(suburbs);
}

async function handleGetPricesNearby(
  env: Env,
  url: URL
): Promise<Response> {
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const radius = url.searchParams.get('radius') || '5';
  const fueltype = url.searchParams.get('fueltype') || 'E10';

  if (!lat || !lng) {
    return errorResponse('Missing required parameters: lat, lng', 400);
  }
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng)) || isNaN(parseFloat(radius))) {
    return errorResponse('Invalid coordinate or radius values', 400);
  }
  if (parseFloat(radius) < 0 || parseFloat(radius) > 100) {
    return errorResponse('Radius must be between 0 and 100', 400);
  }
  if (!VALID_FUEL_TYPES.has(fueltype)) {
    return errorResponse('Invalid fuel type', 400);
  }

  // Round coords to 3 decimal places (~111m precision) for effective caching
  const rlat = parseFloat(lat).toFixed(3);
  const rlng = parseFloat(lng).toFixed(3);
  const cacheKey = `nearby:${rlat}:${rlng}:${radius}:${fueltype}`;
  const cached = await env.FUEL_CACHE.get(cacheKey, 'json');
  if (cached) {
    console.log('[Nearby] Cache hit:', cacheKey);
    return jsonResponse(cached);
  }

  const token = await getAccessToken(env);
  const headers = fuelApiHeaders(token, env.NSW_FUEL_API_KEY);

  const response = await fetch(
    `${env.NSW_FUEL_API_BASE}/FuelPriceCheck/v1/fuel/prices/nearby`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fueltype,
        latitude: lat,
        longitude: lng,
        radius,
        sortby: 'price',
        sortascending: 'true',
      }),
    }
  );

  if (!response.ok) {
    return errorResponse(`Nearby API error: ${response.status}`, response.status);
  }

  const data = await response.json();

  // Cache for 5 minutes
  await env.FUEL_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
  console.log('[Nearby] Cached:', cacheKey);

  return jsonResponse(data);
}

// ── Price History: Cron snapshot + API endpoint ──

async function snapshotPrices(env: Env): Promise<void> {
  console.log('[Cron] Starting price snapshot...');

  // Fetch current prices (reuse cache if available)
  let data = (await env.FUEL_CACHE.get('all_prices', 'json')) as FuelPricesResponse | null;
  if (!data) {
    const token = await getAccessToken(env);
    const headers = fuelApiHeaders(token, env.NSW_FUEL_API_KEY);
    const response = await fetch(
      `${env.NSW_FUEL_API_BASE}/FuelPriceCheck/v1/fuel/prices`,
      { headers }
    );
    if (!response.ok) {
      console.error('[Cron] Failed to fetch prices:', response.status);
      return;
    }
    data = (await response.json()) as FuelPricesResponse;
    await env.FUEL_CACHE.put('all_prices', JSON.stringify(data), { expirationTtl: 300 });
  }

  // Upsert stations
  const stationStmt = env.DB.prepare(
    `INSERT OR REPLACE INTO stations (code, name, brand, address, latitude, longitude, state, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const stationBatch = data.stations.map((s) =>
    stationStmt.bind(String(s.code), s.name, s.brand, s.address, s.location.latitude, s.location.longitude, s.state || 'NSW')
  );

  // Insert price snapshots
  const priceStmt = env.DB.prepare(
    `INSERT OR IGNORE INTO price_snapshots (station_code, fuel_type, price, recorded_at)
     VALUES (?, ?, ?, datetime('now'))`
  );
  const priceBatch = data.prices.map((p) =>
    priceStmt.bind(String(p.stationcode), p.fueltype, p.price)
  );

  // Execute in batches (D1 max 500 per batch)
  const BATCH_SIZE = 100;
  for (let i = 0; i < stationBatch.length; i += BATCH_SIZE) {
    await env.DB.batch(stationBatch.slice(i, i + BATCH_SIZE));
  }
  for (let i = 0; i < priceBatch.length; i += BATCH_SIZE) {
    await env.DB.batch(priceBatch.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Cron] Snapshot complete: ${data.stations.length} stations, ${data.prices.length} prices`);
}

async function handleGetPriceHistory(env: Env, url: URL): Promise<Response> {
  const fueltype = url.searchParams.get('fueltype') || 'E10';
  const rawDays = parseInt(url.searchParams.get('days') || '30');
  const days = isNaN(rawDays) ? 30 : Math.min(Math.max(rawDays, 1), 90);
  if (!VALID_FUEL_TYPES.has(fueltype)) {
    return errorResponse('Invalid fuel type', 400);
  }

  // Cache history for 1 hour
  const cacheKey = `history:${fueltype}:${days}`;
  const cached = await env.FUEL_CACHE.get(cacheKey, 'json');
  if (cached) return jsonResponse(cached);

  const result = await env.DB.prepare(
    `SELECT date(recorded_at) as date,
            ROUND(AVG(price), 1) as avg_price,
            ROUND(MIN(price), 1) as min_price,
            ROUND(MAX(price), 1) as max_price,
            COUNT(DISTINCT station_code) as station_count
     FROM price_snapshots
     WHERE fuel_type = ?
       AND recorded_at >= datetime('now', ?)
     GROUP BY date(recorded_at)
     ORDER BY date(recorded_at) ASC`
  )
    .bind(fueltype, `-${days} days`)
    .all();

  const history = {
    fueltype,
    days,
    data: result.results,
  };

  await env.FUEL_CACHE.put(cacheKey, JSON.stringify(history), { expirationTtl: 3600 });
  return jsonResponse(history);
}

// IP-based rate limiting using KV
async function checkRateLimit(env: Env, ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${ip}`;
  const current = parseInt((await env.FUEL_CACHE.get(key)) || '0');

  if (current >= RATE_LIMIT_MAX) {
    console.log(`[RateLimit] Blocked ${ip} — ${current}/${RATE_LIMIT_MAX}`);
    return { allowed: false, remaining: 0 };
  }

  await env.FUEL_CACHE.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  return { allowed: true, remaining: RATE_LIMIT_MAX - current - 1 };
}

async function handleApiRequest(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { ...getCorsHeaders(request), ...SECURITY_HEADERS } });
  }

  const path = url.pathname;
  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  console.log(`[API] ${request.method} ${path} from ${clientIp}`);

  // Rate limit all API requests
  const { allowed, remaining } = await checkRateLimit(env, clientIp);
  if (!allowed) {
    return jsonResponse(
      { error: 'Rate limit exceeded. Please wait a minute and try again.' },
      429
    );
  }

  try {
    let response: Response;

    if (path === '/api/fuel/prices' && request.method === 'GET') {
      response = await handleGetAllPrices(env);
    } else if (path === '/api/fuel/reference' && request.method === 'GET') {
      response = await handleGetReference(env);
    } else if (path === '/api/fuel/prices/location' && request.method === 'GET') {
      response = await handleGetPricesByLocation(env, url);
    } else if (path === '/api/fuel/prices/nearby' && request.method === 'GET') {
      response = await handleGetPricesNearby(env, url);
    } else if (path === '/api/fuel/suburbs' && request.method === 'GET') {
      response = await handleGetSuburbs(env);
    } else if (path === '/api/fuel/history' && request.method === 'GET') {
      response = await handleGetPriceHistory(env, url);
    } else if (path === '/api/admin/snapshot' && request.method === 'POST') {
      // Protected admin endpoint to manually trigger price snapshot
      const authKey = request.headers.get('x-admin-key');
      if (authKey !== env.NSW_FUEL_API_KEY) {
        return errorResponse('Unauthorized', 401);
      }
      await snapshotPrices(env);
      response = jsonResponse({ ok: true, message: 'Snapshot triggered' });
    } else {
      console.log('[API] No matching route for:', path);
      return errorResponse('Not found', 404);
    }

    // Add CORS, security, and rate limit headers to all responses
    const headers = new Headers(response.headers);
    const cors = getCorsHeaders(request);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    headers.set('X-RateLimit-Remaining', String(remaining));
    return new Response(response.body, { status: response.status, headers });
  } catch (err) {
    console.error('[API] Unhandled error:', err);
    // Never expose internal error details to the client
    const errResp = errorResponse('An unexpected error occurred. Please try again later.');
    const headers = new Headers(errResp.headers);
    const cors = getCorsHeaders(request);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    return new Response(errResp.body, { status: errResp.status, headers });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url);
    }

    // Everything else → serve static assets (SPA)
    return env.ASSETS.fetch(request);
  },

  // Cron: snapshot prices into D1 for historical tracking
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await snapshotPrices(env);
  },
} satisfies ExportedHandler<Env>;
