/** Server-only persistence for validated public aggregates; never receives raw CSV rows. */
export interface PersistentCacheRecord {
  key: string; source: string; sourceUrl: string; obtainedAt: string;
  storedAt: number; expiresAt: number; staleUntil: number; payload: unknown;
}
export interface PersistentCacheStore {
  get(key: string): Promise<PersistentCacheRecord | null>;
  put(record: PersistentCacheRecord): Promise<void>;
}
export interface PersistenceCodec<T> { encode(data: T): unknown; decode(input: unknown): T }

export class SupabasePublicCache implements PersistentCacheStore {
  private readonly endpoint: string;
  constructor(url: string, private secret: string, private fetcher: typeof fetch = fetch) {
    const origin = new URL(url);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || !['', '/'].includes(origin.pathname)) throw new Error('SUPABASE_URL debe ser el origen HTTPS del proyecto.');
    if (!secret || /\s/.test(secret) || secret.startsWith('sb_publishable_')) throw new Error('La caché requiere una clave secreta de servidor Supabase.');
    // Legacy JWTs must identify service_role; an anon JWT must never be accepted.
    if (!secret.startsWith('sb_secret_')) {
      try { if (JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString()).role !== 'service_role') throw new Error(); }
      catch { throw new Error('SUPABASE_SECRET_KEY debe ser secret o service_role de servidor.'); }
    }
    this.endpoint = `${origin.origin}/rest/v1/sigra_public_cache`;
  }
  private headers(): Record<string, string> {
    return { apikey: this.secret, ...(this.secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.secret}` }), 'Content-Type': 'application/json' };
  }
  async get(key: string): Promise<PersistentCacheRecord | null> {
    const params = new URLSearchParams({ cache_key: `eq.${key}`, select: 'cache_key,source,source_url,obtained_at,stored_at,expires_at,stale_until,payload', limit: '1' });
    const response = await this.fetcher(`${this.endpoint}?${params}`, { headers: this.headers(), signal: AbortSignal.timeout(2000), redirect: 'error' });
    if (!response.ok) throw new Error('No se pudo leer la caché persistente.');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('Caché persistente con formato inválido.');
    if (!rows.length) return null;
    const row = rows[0];
    return { key: row.cache_key, source: row.source, sourceUrl: row.source_url, obtainedAt: row.obtained_at, storedAt: Date.parse(row.stored_at), expiresAt: Date.parse(row.expires_at), staleUntil: Date.parse(row.stale_until), payload: row.payload };
  }
  async put(record: PersistentCacheRecord): Promise<void> {
    const body = { cache_key: record.key, source: record.source, source_url: record.sourceUrl, obtained_at: record.obtainedAt, stored_at: new Date(record.storedAt).toISOString(), expires_at: new Date(record.expiresAt).toISOString(), stale_until: new Date(record.staleUntil).toISOString(), payload: record.payload };
    const response = await this.fetcher(`${this.endpoint}?on_conflict=cache_key`, { method: 'POST', headers: { ...this.headers(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2000), redirect: 'error' });
    if (!response.ok) throw new Error('No se pudo guardar la caché persistente.');
  }
}
export function createSupabaseCacheFromEnv(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): PersistentCacheStore | undefined {
  const url = env.SUPABASE_URL?.trim();
  const secret = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url && !secret) return undefined;
  if (!url || !secret) throw new Error('Configure SUPABASE_URL y SUPABASE_SECRET_KEY juntas para la caché opcional.');
  return new SupabasePublicCache(url, secret, fetcher);
}
