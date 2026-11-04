import { createOhlcClient, type OhlcClient } from '../../src/api/ohlcClient';

describe('OHLC API Client (src/api/ohlcClient.ts)', () => {
  let client: OhlcClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = createOhlcClient({ timeoutMs: 1000 });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  const validResponsePayload = {
    status: 'success',
    code: 200,
    count: 2,
    message: {
      data: [
        {
          symbol: 'RELIANCE',
          isin: 'INE002A01018',
          ltp: 1164.9,
          open: 1170.4,
          prevClose: 1167.4,
          high: 1174.6,
          low: 1152.5,
          volume: 14753650,
          timeStamp: '2026-10-30T15:59:52',
        },
        {
          symbol: 'TCS',
          ltp: 3500.0,
          open: 3480.0,
          prevClose: 3490.0,
          high: 3520.0,
          low: 3470.0,
          volume: 80000,
        },
      ],
    },
  };

  test('successfully parses HTTP 201 response with converted integer Paise', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => validResponsePayload,
    } as Response);

    const result = await client.fetchOhlc(['RELIANCE', 'TCS']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.v2.liquide.life/api/markets/ohlc',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbols: ['RELIANCE', 'TCS'] }),
      })
    );

    const reliance = result.quotes.RELIANCE;
    expect(reliance).toBeDefined();
    // 1164.9 * 100 = 116490 paise
    expect(reliance?.ltp).toBe(116490);
    expect(reliance?.open).toBe(117040);
    expect(reliance?.prevClose).toBe(116740);
    expect(reliance?.high).toBe(117460);
    expect(reliance?.low).toBe(115250);
    expect(reliance?.volume).toBe(14753650);

    const tcs = result.quotes.TCS;
    expect(tcs?.ltp).toBe(350000);
  });

  test('treats symbols missing from the API response (like OLDCO) as unpriced nulls', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => validResponsePayload, // Only contains RELIANCE and TCS
    } as Response);

    const result = await client.fetchOhlc(['RELIANCE', 'TCS', 'OLDCO']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // OLDCO was requested but absent from response data -> must be unpriced
    const oldco = result.quotes.OLDCO;
    expect(oldco).toBeDefined();
    expect(oldco?.ltp).toBeNull();
    expect(oldco?.volume).toBe(0);
  });

  test('handles empty data array by returning all requested symbols as unpriced nulls', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        status: 'success',
        code: 200,
        count: 0,
        message: { data: [] },
      }),
    } as Response);

    const result = await client.fetchOhlc(['RELIANCE', 'TCS']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.quotes.RELIANCE?.ltp).toBeNull();
    expect(result.quotes.TCS?.ltp).toBeNull();
  });

  test('returns typed HTTP error on non-2xx status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const result = await client.fetchOhlc(['RELIANCE']);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.kind).toBe('http');
    expect(result.error.status).toBe(500);
  });

  test('returns typed timeout error when request is aborted', async () => {
    globalThis.fetch = jest.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        if (options?.signal) {
          options.signal.addEventListener('abort', () => reject(error));
        }
      });
    });

    const fastClient = createOhlcClient({ timeoutMs: 50 });
    const result = await fastClient.fetchOhlc(['RELIANCE']);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.kind).toBe('timeout');
  });

  test('returns typed parse error when response JSON is malformed or missing message.data', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ unexpected: 'format' }),
    } as Response);

    const result = await client.fetchOhlc(['RELIANCE']);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.kind).toBe('parse');
  });

  test('retry helper retries with backoff and succeeds on subsequent try', async () => {
    let attempts = 0;
    const flakeyFn = jest.fn(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Transient network glitch');
      }
      return 'success';
    });

    const res = await client.retry(flakeyFn, 2, 10);
    expect(res).toBe('success');
    expect(attempts).toBe(2);
  });
});
