import type { Quote } from '../domain/types';
import { toPaise, type Paise } from '../domain/money';
import cannedOhlcJson from '../../fixtures/ohlc.json';

export type ApiMode = 'live' | 'mock' | 'slow' | 'fail' | 'partial' | 'empty' | 'malformed';

export type OhlcErrorKind = 'network' | 'timeout' | 'http' | 'parse';

export interface OhlcError {
  readonly kind: OhlcErrorKind;
  readonly message: string;
  readonly status?: number;
}

export type OhlcResult =
  | { readonly ok: true; readonly quotes: Record<string, Quote> }
  | { readonly ok: false; readonly error: OhlcError };

export interface OhlcClientOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly mode?: ApiMode;
  readonly fallbackToMockOnNetworkError?: boolean;
}

export interface OhlcClient {
  fetchOhlc(symbols: string[]): Promise<OhlcResult>;
  retry<T>(fn: () => Promise<T>, maxRetries?: number, backoffMs?: number): Promise<T>;
  getMode?(): ApiMode;
}

export interface RawOhlcRow {
  readonly symbol?: unknown;
  readonly ltp?: unknown;
  readonly open?: unknown;
  readonly prevClose?: unknown;
  readonly high?: unknown;
  readonly low?: unknown;
  readonly volume?: unknown;
  readonly timeStamp?: unknown;
}

function isOhlcResponse(data: unknown): data is { message: { data: RawOhlcRow[] } } {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!obj.message || typeof obj.message !== 'object') return false;
  const msg = obj.message as Record<string, unknown>;
  return Array.isArray(msg.data);
}

function parsePrice(val: unknown): Paise | null {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return toPaise(val);
  }
  return null;
}

function parseVolume(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Math.floor(val);
  }
  return 0;
}

/**
 * Pure parsing of raw API rows into domain Quotes.
 */
export function parseRawOhlcRows(
  rawRows: readonly RawOhlcRow[],
  symbols: readonly string[]
): Record<string, Quote> {
  const quotes: Record<string, Quote> = {};

  for (const row of rawRows) {
    if (typeof row.symbol !== 'string' || row.symbol.trim().length === 0) {
      continue;
    }

    const sym = row.symbol.trim().toUpperCase();
    const ltp = parsePrice(row.ltp);
    const open = parsePrice(row.open) ?? (ltp ?? (0 as Paise));
    const prevClose = parsePrice(row.prevClose) ?? (ltp ?? (0 as Paise));
    const high = parsePrice(row.high) ?? (ltp ?? (0 as Paise));
    const low = parsePrice(row.low) ?? (ltp ?? (0 as Paise));
    const volume = parseVolume(row.volume);

    quotes[sym] = {
      ltp,
      open,
      prevClose,
      high,
      low,
      volume,
    };
  }

  for (const sym of symbols) {
    const upper = sym.trim().toUpperCase();
    if (!quotes[upper]) {
      quotes[upper] = {
        ltp: null,
        open: 0 as Paise,
        prevClose: 0 as Paise,
        high: 0 as Paise,
        low: 0 as Paise,
        volume: 0,
      };
    }
  }

  return quotes;
}

/**
 * Returns canned quotes for symbols directly from fixtures/ohlc.json.
 */
export function getCannedQuotes(symbols: readonly string[]): Record<string, Quote> {
  const fixtureRows = isOhlcResponse(cannedOhlcJson) ? cannedOhlcJson.message.data : [];
  return parseRawOhlcRows(fixtureRows, symbols);
}

/**
 * Functional factory creating an OHLC REST client.
 *
 * Implements:
 * - Single batch request for all 25 symbols + OLDCO.
 * - Configurable API modes via EXPO_PUBLIC_API_MODE (live | mock | slow | fail | partial | empty | malformed).
 * - HTTP 201 success handling with message.data extraction.
 * - AbortController timeout handling (default 8s).
 * - Defensively converts API floats to integer Paise at this exact input boundary.
 * - Maps missing symbols (like OLDCO) to unpriced null quotes.
 * - Typed functional error handling (no throwing, returns union result).
 */
export function createOhlcClient(options: OhlcClientOptions = {}): OhlcClient {
  const baseUrl = options.baseUrl ?? 'https://api.v2.liquide.life/api/markets/ohlc';
  const timeoutMs = options.timeoutMs ?? 8000;
  const initialMode =
    options.mode ??
    ((process.env.EXPO_PUBLIC_API_MODE as ApiMode | undefined) ?? 'live');
  const fallbackToMock = options.fallbackToMockOnNetworkError ?? false;

  const fetchOhlc = async (symbols: string[]): Promise<OhlcResult> => {
    const mode = initialMode;

    if (mode === 'mock') {
      return {
        ok: true,
        quotes: getCannedQuotes(symbols),
      };
    }

    if (mode === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        ok: true,
        quotes: getCannedQuotes(symbols),
      };
    }

    if (mode === 'fail') {
      return {
        ok: false,
        error: {
          kind: 'http',
          message: 'Simulated API failure (EXPO_PUBLIC_API_MODE=fail)',
          status: 500,
        },
      };
    }

    if (mode === 'partial') {
      const allCanned = getCannedQuotes(symbols);
      const partialKeys = Object.keys(allCanned).slice(0, 5);
      const partialQuotes: Record<string, Quote> = {};
      for (const k of partialKeys) {
        if (allCanned[k]) {
          partialQuotes[k] = allCanned[k];
        }
      }
      return {
        ok: true,
        quotes: partialQuotes,
      };
    }

    if (mode === 'empty') {
      return {
        ok: true,
        quotes: {},
      };
    }

    if (mode === 'malformed') {
      return {
        ok: false,
        error: {
          kind: 'parse',
          message: 'Malformed response structure: missing message.data array',
        },
      };
    }

    // Live HTTP request
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ symbols }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: {
            kind: 'http',
            message: `OHLC server returned HTTP status ${response.status}`,
            status: response.status,
          },
        };
      }

      const json: unknown = await response.json();
      if (!isOhlcResponse(json)) {
        return {
          ok: false,
          error: {
            kind: 'parse',
            message: 'Malformed response structure: missing message.data array',
          },
        };
      }

      const quotes = parseRawOhlcRows(json.message.data, symbols);
      return {
        ok: true,
        quotes,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (fallbackToMock) {
          return { ok: true, quotes: getCannedQuotes(symbols) };
        }
        return {
          ok: false,
          error: {
            kind: 'timeout',
            message: `OHLC request timed out after ${timeoutMs}ms`,
          },
        };
      }

      if (fallbackToMock) {
        return { ok: true, quotes: getCannedQuotes(symbols) };
      }

      return {
        ok: false,
        error: {
          kind: 'network',
          message: err instanceof Error ? err.message : 'Unknown network error',
        },
      };
    } finally {
      clearTimeout(timeoutTimer);
    }
  };

  const retry = async <T>(
    fn: () => Promise<T>,
    maxRetries = 2,
    backoffMs = 300
  ): Promise<T> => {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err: unknown) {
        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
      }
    }
    throw new Error('Retry exhausted');
  };

  const getMode = (): ApiMode => initialMode;

  return {
    fetchOhlc,
    retry,
    getMode,
  };
}

// Default singleton client
export const ohlcClient = createOhlcClient();
