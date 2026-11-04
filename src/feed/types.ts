import type { Paise } from '../domain/money';

/**
 * A market tick representing a partial or full quote update for a symbol.
 */
export interface Tick {
  readonly symbol: string;
  readonly seq: number;
  readonly ltp?: Paise;
  readonly high?: Paise;
  readonly low?: Paise;
  readonly volume?: number;
}

export type TickHandler = (tick: Tick) => void;

/**
 * Abstract interface for live price feed implementations.
 * Enables zero-coupling between UI/stores and network protocols (WebSocket, SSE, Simulator).
 */
export interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onTick(handler: TickHandler): () => void;
}
