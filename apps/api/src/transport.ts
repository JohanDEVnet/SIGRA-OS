import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import type { PersistenceCodec, PersistentCacheStore } from './persistent-cache.js';
export interface ProviderTrace { startedAt: string; finishedAt: string; durationMs: number; attempts: number; cacheHit: boolean; status: 'ok' | 'degraded' | 'unavailable'; httpStatus?: number }
export interface ProviderMetadata { source: string; sourceUrl: string; obtainedAt: string; status: 'ok' | 'degraded'; fromCache: boolean; warnings: string[]; dateOfData?: string | null; durationMs?: number; trace?: ProviderTrace; dateRange?: { from: string; to: string }; datasetDistrictCount?: number; cacheLayer?: 'memory' | 'supabase' }
export interface ProviderEnvelope<T> { data: T; meta: ProviderMetadata }
export interface Parsed<T> { data: T; warnings: string[]; dateOfData?: string | null }
export interface TransportOptions { timeoutMs?: number; retries?: number; sleep?: (ms: number) => Promise<void>; staleMaxMs?: number; persistentStore?: PersistentCacheStore | null }
export interface ProviderState { id: string; name: string; sourceUrl: string; status: 'not-queried' | 'ok' | 'degraded' | 'unavailable' | 'not-integrated'; lastChecked: string | null; lastSuccess: string | null; detail: string; durationMs?: number; trace?: ProviderTrace }
interface CacheEntry { envelope: ProviderEnvelope<unknown>; storedAt: number; ttlMs: number; origin?: 'supabase' }
class UpstreamError extends Error { constructor(public kind: 'invalid' | 'upstream' | 'timeout', public httpStatus?: number) { super(kind); } }
export class ProviderTransport {
  private cache = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<ProviderEnvelope<unknown>>>();
  readonly states = new Map<string, ProviderState>();
  private persistenceChecks = { lastReadAt: null as string | null, lastWriteAt: null as string | null, lastErrorAt: null as string | null };
  private persistenceLastStatus: 'not-queried' | 'ok' | 'degraded' = 'not-queried';
  constructor(private fetcher: typeof fetch = fetch, private now: () => number = Date.now, private options: TransportOptions = {}) {}
  persistenceStatus() {
    const configured = Boolean(this.options.persistentStore);
    return { configured, status: configured ? this.persistenceLastStatus : 'disabled', ...this.persistenceChecks };
  }
  async json<T>(key: string, source: string, url: string, ttlMs: number, parse: (input: unknown) => Parsed<T>, codec?: PersistenceCodec<T>): Promise<ProviderEnvelope<T>> {
    return this.load(key, source, url, ttlMs, async (response) => parse(await response.json()), codec);
  }
  async load<T>(key: string, source: string, sourceUrl: string, ttlMs: number, read: (response: Response) => Promise<Parsed<T>>, codec?: PersistenceCodec<T>): Promise<ProviderEnvelope<T>> {
    const started = this.now(); const startedAt = new Date(started).toISOString();
    let cached = this.cache.get(key);
    const serveCached = (): ProviderEnvelope<T> => {
      const durationMs = Math.max(0, this.now() - started);
      const trace: ProviderTrace = { startedAt, finishedAt: new Date(this.now()).toISOString(), durationMs, attempts: 0, cacheHit: true, status: 'ok' };
      this.states.set(source, { id: source, name: source, sourceUrl, status: 'ok', lastChecked: trace.finishedAt, lastSuccess: cached!.envelope.meta.obtainedAt, detail: 'Respuesta real de caché vigente; no se consultó al proveedor en esta solicitud.', durationMs, trace });
      return { ...(cached!.envelope as ProviderEnvelope<T>), meta: { ...cached!.envelope.meta, fromCache: true, cacheLayer: cached!.origin ?? 'memory', durationMs, trace } };
    };
    if (cached && started - cached.storedAt < cached.ttlMs) return serveCached();
    const pending = this.pending.get(key); if (pending) return pending as Promise<ProviderEnvelope<T>>;
    const task = (async (): Promise<ProviderEnvelope<T>> => {
      const persistenceWarnings: string[] = [];
      const staleMaxMs = this.options.staleMaxMs ?? Math.max(86_400_000, ttlMs * 2);
      if (!cached && codec && this.options.persistentStore) {
        try {
          const record = await this.options.persistentStore.get(key);
          this.persistenceChecks.lastReadAt = new Date(this.now()).toISOString();
          this.persistenceLastStatus = 'ok';
          if (record) {
            const payload = record.payload as { version?: unknown; data?: unknown; warnings?: unknown; dateOfData?: unknown };
            const obtained = Date.parse(record.obtainedAt);
            if (record.key !== key || record.source !== source || record.sourceUrl !== sourceUrl || !Number.isFinite(obtained) || obtained > this.now() || !Number.isFinite(record.storedAt) || record.storedAt > this.now() || Math.abs(record.storedAt - obtained) > 1000 || record.expiresAt !== record.storedAt + ttlMs || record.staleUntil !== record.storedAt + staleMaxMs || !payload || payload.version !== 1 || !Array.isArray(payload.warnings) || !payload.warnings.every(w => typeof w === 'string') || (payload.dateOfData !== null && typeof payload.dateOfData !== 'string')) throw new Error('Entrada persistente no válida.');
            if (record.staleUntil >= this.now()) {
              const data = codec.decode(payload.data);
              cached = { envelope: { data, meta: { source, sourceUrl, obtainedAt: record.obtainedAt, status: 'ok', fromCache: true, warnings: payload.warnings, dateOfData: payload.dateOfData as string | null } }, storedAt: record.storedAt, ttlMs, origin: 'supabase' };
              this.cache.set(key, cached);
              if (this.now() - cached.storedAt < ttlMs) return serveCached();
            }
          }
        } catch { this.persistenceLastStatus = 'degraded'; this.persistenceChecks.lastErrorAt = new Date(this.now()).toISOString(); persistenceWarnings.push('No se pudo utilizar la caché persistente. Se consulta la fuente oficial.'); }
      }
      let error = new UpstreamError('upstream'); let attempts = 0;
      const maxAttempts = 1 + (this.options.retries ?? 2);
      for (; attempts < maxAttempts; attempts++) {
        if (attempts) await (this.options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(1000 * 2 ** (attempts - 1));
        try {
          let response: Response;
          try { response = await this.fetcher(sourceUrl, { signal: AbortSignal.timeout(this.options.timeoutMs ?? 25_000), headers: { Accept: 'application/json,text/csv;q=0.9,*/*;q=0.1' } }); }
          catch (caught) { if (caught instanceof Error && ['TimeoutError', 'AbortError'].includes(caught.name)) throw new UpstreamError('timeout'); throw new UpstreamError('upstream'); }
          if (!response.ok) throw new UpstreamError('upstream', response.status);
          let parsed: Parsed<T>;
          try { parsed = await read(response); }
          catch (caught) { if (caught instanceof Error && ['TimeoutError', 'AbortError'].includes(caught.name)) throw new UpstreamError('timeout'); throw new UpstreamError('invalid'); }
          const obtainedAt = new Date(this.now()).toISOString(); const durationMs = Math.max(0, this.now() - started);
          const trace: ProviderTrace = { startedAt, finishedAt: obtainedAt, durationMs, attempts: attempts + 1, cacheHit: false, status: 'ok', httpStatus: response.status };
          const envelope: ProviderEnvelope<T> = { data: parsed.data, meta: { source, sourceUrl, obtainedAt, status: 'ok', fromCache: false, warnings: [...parsed.warnings, ...persistenceWarnings], dateOfData: parsed.dateOfData ?? null, durationMs, trace } };
          if (this.cache.size >= 150) this.cache.delete(this.cache.keys().next().value!);
          const storedAt = Date.parse(obtainedAt);
          this.cache.set(key, { envelope, storedAt, ttlMs });
          if (codec && this.options.persistentStore) {
            try { await this.options.persistentStore.put({ key, source, sourceUrl, obtainedAt, storedAt, expiresAt: storedAt + ttlMs, staleUntil: storedAt + staleMaxMs, payload: { version: 1, data: codec.encode(parsed.data), warnings: parsed.warnings, dateOfData: parsed.dateOfData ?? null } }); this.persistenceLastStatus = 'ok'; this.persistenceChecks.lastWriteAt = new Date(this.now()).toISOString(); }
            catch { this.persistenceLastStatus = 'degraded'; this.persistenceChecks.lastErrorAt = new Date(this.now()).toISOString(); envelope.meta.warnings.push('Respuesta oficial obtenida; no se pudo guardar la caché persistente.'); }
            trace.durationMs = envelope.meta.durationMs = Math.max(0, this.now() - started); trace.finishedAt = new Date(this.now()).toISOString();
          }
          this.states.set(source, { id: source, name: source, sourceUrl, status: 'ok', lastChecked: obtainedAt, lastSuccess: obtainedAt, detail: 'Última consulta al proveedor completada correctamente.', durationMs, trace });
          return envelope;
        } catch (caught) {
          error = caught instanceof UpstreamError ? caught : new UpstreamError('upstream');
          if (error.kind === 'invalid' || (error.httpStatus && error.httpStatus < 500 && error.httpStatus !== 429)) { attempts++; break; }
        }
      }
      const finishedAt = new Date(this.now()).toISOString(); const durationMs = Math.max(0, this.now() - started);
      const usable = cached && this.now() - cached.storedAt <= staleMaxMs;
      const trace: ProviderTrace = { startedAt, finishedAt, durationMs, attempts, cacheHit: Boolean(usable), status: usable ? 'degraded' : 'unavailable', ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}) };
      this.states.set(source, { id: source, name: source, sourceUrl, status: usable ? 'degraded' : 'unavailable', lastChecked: finishedAt, lastSuccess: cached?.envelope.meta.obtainedAt ?? null, detail: usable ? 'Falló la actualización. Se conserva la última respuesta real obtenida.' : 'No se obtuvo una respuesta válida del proveedor.', durationMs, trace });
      if (usable && cached) return { ...(cached.envelope as ProviderEnvelope<T>), meta: { ...cached.envelope.meta, status: 'degraded', fromCache: true, cacheLayer: cached.origin ?? 'memory', durationMs, trace, warnings: [...cached.envelope.meta.warnings, ...persistenceWarnings, 'El proveedor no respondió con datos válidos. Se muestra la última respuesta real almacenada; revise la fecha de obtención.'] } };
      const body = { message: error.kind === 'invalid' ? `${source} devolvió una respuesta con formato inválido.` : error.kind === 'timeout' ? `${source} superó el tiempo límite de consulta.` : `${source} no está disponible en este momento.`, source, sourceUrl, status: 'unavailable', obtainedAt: cached?.envelope.meta.obtainedAt ?? null, dateOfData: cached?.envelope.meta.dateOfData ?? null, durationMs, trace, warnings: ['No se sustituyen los datos faltantes por registros inventados.'] };
      if (error.kind === 'invalid') throw new BadGatewayException({ ...body, statusCode: 502 });
      if (error.kind === 'timeout') throw new GatewayTimeoutException({ ...body, statusCode: 504 });
      throw new ServiceUnavailableException({ ...body, statusCode: 503 });
    })();
    this.pending.set(key, task as Promise<ProviderEnvelope<unknown>>);
    try { return await task; } finally { this.pending.delete(key); }
  }
}
