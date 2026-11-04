# API and data reference: Live Portfolio

Verbatim contract from the take-home spec, plus the types, mappings, and decisions needed to implement it. Copy this file to `docs/api_and_data_reference.md`. `GEMINI.md` points to it, and PRs 2, 3, 5, and T0 depend on it.

---

## 1. OHLC API (from the spec)

- **Endpoint:** `POST https://api.v2.liquide.life/api/markets/ohlc`
- **Auth:** none. **Header:** `content-type: application/json`
- **Body:** `{"symbols":["RELIANCE"]}` (an array of symbols)
- **Success status:** **HTTP 201** (not 200). The list is at `message.data`.
- **Unknown symbol:** silently left out of the response. No error.
- **Outside market hours:** prices are the last close. That is expected; the simulator keeps the app moving.
- **Shared test server:** fetch **once per load** (app start and pull-to-refresh). **Do not poll.**

```bash
curl -X POST https://api.v2.liquide.life/api/markets/ohlc \
  -H 'content-type: application/json' \
  -d '{"symbols":["RELIANCE"]}'
```

### Sample response (from the spec)
```json
{
  "status": "success",
  "code": 200,
  "count": 1,
  "message": {
    "data": [
      {
        "symbol": "RELIANCE",
        "isin": "INE002A01018",
        "ltp": 1164.9,
        "open": 1170.4,
        "prevClose": 1167.4,
        "high": 1174.6,
        "low": 1152.5,
        "volume": 14753650,
        "timeStamp": "2026-10-30T15:59:52",
        "scripId": "62584d19d8ddbbdfbe1ccfcf",
        "navDate": null,
        "tsn": 13012
      }
    ]
  }
}
```
Note: the body says `"code": 200` but the HTTP status is 201. Trust the HTTP status, not the body `code`.

## 2. Symbols

The 25 symbols for the app and the watchlist picker:

`RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, BHARTIARTL, ITC, LT, HINDUNILVR, KOTAKBANK, AXISBANK, BAJFINANCE, MARUTI, SUNPHARMA, TITAN, ASIANPAINT, ULTRACEMCO, WIPRO, NTPC, POWERGRID, ONGC, TATASTEEL, ADANIENT, HCLTECH`

Request all 25 plus `OLDCO` in **one** request. `OLDCO` is deliberately never returned. It is a holding only; it must never appear in the watchlist picker.

## 3. Starting holdings (bundle as `src/data/holdings.csv`)

```csv
symbol,qty,avgPrice
RELIANCE,25,1319.59
TCS,40,2589.71
HDFCBANK,10,755.86
INFY,10,1114.7
ICICIBANK,5,1566.04
SBIN,15,800.62
BHARTIARTL,40,1890.8
ITC,15,225.74
LT,40,3250.32
HINDUNILVR,100,1605.15
KOTAKBANK,15,474.57
AXISBANK,100,1378.55
BAJFINANCE,100,951.52
MARUTI,5,13017.25
SUNPHARMA,5,1784.28
TITAN,12,4061.93
ASIANPAINT,12,2316.35
ULTRACEMCO,100,10181.27
WIPRO,12,169.36
NTPC,100,326
OLDCO,30,412.5
```
**21 holdings: 20 priced + OLDCO unpriced.** The five symbols not held (POWERGRID, ONGC, TATASTEEL, ADANIENT, HCLTECH) are available for the watchlist only.

### Test oracle: invested per holding (qty × avg, rounded to paise)
| Symbol | Invested ₹ | Symbol | Invested ₹ |
|---|---|---|---|
| RELIANCE | 32,989.75 | KOTAKBANK | 7,118.55 |
| TCS | 1,03,588.40 | AXISBANK | 1,37,855.00 |
| HDFCBANK | 7,558.60 | BAJFINANCE | 95,152.00 |
| INFY | 11,147.00 | MARUTI | 65,086.25 |
| ICICIBANK | 7,830.20 | SUNPHARMA | 8,921.40 |
| SBIN | 12,009.30 | TITAN | 48,743.16 |
| BHARTIARTL | 75,632.00 | ASIANPAINT | 27,796.20 |
| ITC | 3,386.10 | ULTRACEMCO | 10,18,127.00 |
| LT | 1,30,012.80 | WIPRO | 2,032.32 |
| HINDUNILVR | 1,60,515.00 | NTPC | 32,600.00 |
| | | **OLDCO** | **12,375.00** |

- **Total invested, all 21:** ₹20,00,476.03
- **Total invested, 20 priced:** ₹19,88,101.03
- **Unpriced invested (OLDCO):** ₹12,375.00. This is the amount in the Summary note.

Use these as fixed expected values in the `CALC-` and `SUM-` tests.

## 4. Types and field mapping

```ts
// Raw API row (validate with a type guard; any field may be missing or null)
type OhlcRow = {
  symbol: string; isin?: string;
  ltp?: number | null; open?: number | null; prevClose?: number | null;
  high?: number | null; low?: number | null; volume?: number | null;
  timeStamp?: string; scripId?: string; navDate?: string | null; tsn?: number;
};

// Domain quote (money in integer paise; null = unavailable)
type Quote = {
  symbol: string;
  ltp: Paise | null; open: Paise | null; prevClose: Paise | null;
  high: Paise | null; low: Paise | null;
  volume: number | null;
  seq: number;            // per-symbol, starts at 0 after the REST seed
  asOf: string | null;    // API timeStamp, kept for display only
};

type Holding = { symbol: string; qty: number; avgPaise: Paise };
```

| API field | Domain | Notes |
|---|---|---|
| `ltp, open, prevClose, high, low` | `Paise` via `Math.round(x * 100)` once, at the API boundary | not a finite number or `<= 0` becomes `null` (unavailable); document in DECISIONS.md |
| `volume` | integer | negative or non-finite becomes `null` |
| `timeStamp` | `asOf` | IST, no offset in the string. Display only; never use for ordering |
| `isin, scripId, navDate, tsn` | ignored | do not model; do not show |
| symbol absent from response | `Quote` with all price fields `null` | this is how OLDCO becomes `--` |

## 5. Derived values (definitions to implement and test)

- **Row value** = `qty × ltp` (paise, integer). **Invested** = `qty × avgPaise`.
- **P&L ₹** = value − invested. **P&L %** = P&L ÷ invested × 100, 2 decimals; invested 0 gives `null`.
- **Day change ₹** = `ltp − prevClose`. **Day change %** = day change ÷ prevClose × 100.
- **Today's P&L (holding)** = `qty × (ltp − prevClose)`. Session buys use the same formula (documented simplification).
- **Summary** = sum of the already-rounded rows over **priced** holdings only. Unpriced rows are excluded and reported separately (count and invested amount). If no holding is priced, all totals are `--`.
- **Buy average** = `round((oldQty × oldAvg + qty × fill) ÷ newQty)` in paise. Sell leaves the average unchanged. Selling all removes the holding.

## 6. Tick simulator contract (from the spec)

- Separate module that behaves like a socket client: `connect()`, `disconnect()`, `onTick(handler)`. Screens must not be able to tell it is fake.
- About **20 ticks per second** across all symbols.
- Each tick moves **one symbol's `ltp` by up to ±0.2%** and may also change `high`, `low`, `volume`.
- A tick is a **partial update:** `{ symbol, seq, ltp?, high?, low?, volume? }`. Only changed fields are present.
- `seq` increases **per symbol**. About **2%** of ticks arrive late or out of order and **must be ignored**.
- About **once a minute** the feed goes **silent for 5 seconds**, then resumes. This drives the "prices paused" indicator.
- The simulator starts from the REST quotes. A symbol with no price (OLDCO or a dropped symbol) never receives ticks and stays `--`.

## 7. Client behaviour checklist (API layer)

- One request for all symbols at start; one more per pull-to-refresh. No polling, no retry loops. Retry only when the user taps Retry.
- Accept any 2xx. Expect 201. Read `message.data`. If `message` or `data` is missing, treat as a parse error.
- Timeout (suggested 8 s) via `AbortController`. Typed errors: `network | timeout | http | parse`.
- Ignore rows with an unknown symbol or duplicates (keep the first).
- On refresh, replace REST fields and keep the feed running. Rule to document: after a refresh, per-symbol `seq` continues from the last seen value, so a stale simulated tick can never overwrite fresher data.

## 8. Fixtures for tests and the QA controller

`fixtures/ohlc.json` should contain every one of the 25 symbols **except** `OLDCO`, in the exact response shape above. Use the spec's RELIANCE row as-is (ltp 1164.9, open 1170.4, prevClose 1167.4, high 1174.6, low 1152.5, volume 14753650) and plausible values for the rest. Also create variants: `ohlc.partial.json` (some symbols missing), `ohlc.empty.json` (`data: []`), and a malformed file (`message` missing).

## 9. Corrections to earlier files

- In the Stitch brief the sample Summary said "21 priced". The correct figure is **20 priced + 1 unpriced** (21 holdings).
- `gemini_cli_pr_playbook.md` PR 5 says to bundle the CSV "exactly as in the spec" but did not include the data. This file now holds it. Tell Gemini to read `@docs/api_and_data_reference.md` in PRs 2, 3, 5, and T0.
