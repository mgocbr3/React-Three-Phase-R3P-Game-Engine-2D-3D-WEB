import { PIXLLAND_CONFIG, pixllandClient } from '@/legacy/cloud/integrations/pixlland/client';

type OpenApiSpec = any;

const OPENAPI_CACHE_KEY = 'pixlland-openapi-cache-v1';
const OPENAPI_CACHE_TTL_MS = 1000 * 60 * 60; // 1h

let memorySpec: OpenApiSpec | null = null;
let inFlight: Promise<OpenApiSpec> | null = null;

function getSupabaseKeyFromClient(): string {
  // Supabase client keeps the anon key internally; this avoids duplicating it in multiple files.
  return (pixllandClient as any)?.supabaseKey as string;
}

function loadCachedSpec(): OpenApiSpec | null {
  try {
    const raw = localStorage.getItem(OPENAPI_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; spec: OpenApiSpec };
    if (!parsed?.spec || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > OPENAPI_CACHE_TTL_MS) return null;
    return parsed.spec;
  } catch {
    return null;
  }
}

function saveCachedSpec(spec: OpenApiSpec) {
  try {
    localStorage.setItem(OPENAPI_CACHE_KEY, JSON.stringify({ ts: Date.now(), spec }));
  } catch {
    // ignore quota errors
  }
}

export async function getPixllandOpenApiSpec(): Promise<OpenApiSpec> {
  if (memorySpec) return memorySpec;

  const cached = loadCachedSpec();
  if (cached) {
    memorySpec = cached;
    return cached;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const apikey = getSupabaseKeyFromClient();
    const { data } = await pixllandClient.auth.getSession();
    const accessToken = data.session?.access_token;

    const headers: HeadersInit = {
      apikey,
      Accept: 'application/openapi+json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${PIXLLAND_CONFIG.url}/rest/v1/`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch Pixlland OpenAPI spec: ${res.status}`);
    }

    const spec = (await res.json()) as OpenApiSpec;
    memorySpec = spec;
    saveCachedSpec(spec);
    return spec;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function getPixllandTableColumns(tableName: string): Promise<Set<string>> {
  try {
    const spec = await getPixllandOpenApiSpec();
    const schema =
      spec?.components?.schemas?.[tableName] ??
      spec?.definitions?.[tableName] ??
      spec?.components?.schemas?.[tableName.toLowerCase()] ??
      spec?.definitions?.[tableName.toLowerCase()];

    const props = schema?.properties;
    if (!props || typeof props !== 'object') return new Set();
    return new Set(Object.keys(props));
  } catch (e) {
    console.warn('[PixllandSchema] Failed to detect columns:', e);
    return new Set();
  }
}

export function firstExistingColumn(cols: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}
