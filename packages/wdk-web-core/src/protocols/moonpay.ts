/**
 * MoonPay fiat on-ramp protocol — runs INSIDE the worklet.
 *
 * Wraps @tetherto/wdk-protocol-fiat-moonpay to quote and generate buy-widget
 * URLs. This is a *template* integration: the consuming app supplies its own
 * **publishable** MoonPay API key (and, for production, a backend `signUrl`
 * endpoint) via configuration — nothing is hard-coded. No secret key ever
 * touches the client; URL signing, when required, is delegated to the app's
 * backend. MoonPay needs no private key (account is undefined), but it lives in
 * the worklet so all protocol access stays behind the one trust boundary.
 */
import MoonPayProtocol from '@tetherto/wdk-protocol-fiat-moonpay';

export interface MoonPayConfig {
  /** Publishable MoonPay API key (safe for the client). */
  readonly apiKey: string;
  /** Defaults to 'sandbox' (test funds). Set 'production' for live transactions. */
  readonly environment?: 'sandbox' | 'production';
  /**
   * Optional backend endpoint that signs widget URLs with the MoonPay *secret*
   * key. Required by MoonPay for production. POST { urlForSignature } -> { signedUrl }.
   */
  readonly signUrl?: string;
}

export interface MoonPayBuyQuote {
  readonly fiatAmount: number;
  readonly cryptoAmount: number;
  readonly feeAmount: number;
  readonly totalAmount: number;
}

interface MoonPayLike {
  buy(o: Record<string, unknown>): Promise<{ buyUrl: string }>;
  quoteBuy(o: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Builds a URL-signing callback that delegates to the app's backend endpoint. */
function makeSignUrl(endpoint: string): (urlForSignature: string) => Promise<string> {
  return async (urlForSignature: string): Promise<string> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlForSignature }),
    });
    if (!res.ok) throw new Error(`Failed to sign MoonPay URL: ${res.status} ${res.statusText}`);
    const { signedUrl } = (await res.json()) as { signedUrl: string };
    return signedUrl;
  };
}

/** Constructs the MoonPay protocol from app-supplied config (no account needed). */
export function createMoonPayProtocol(config: MoonPayConfig): MoonPayLike {
  const signUrl = config.signUrl ? makeSignUrl(config.signUrl) : undefined;
  return new MoonPayProtocol(undefined as never, {
    apiKey: config.apiKey,
    environment: config.environment ?? 'sandbox',
    ...(signUrl ? { signUrl } : {}),
  } as never) as unknown as MoonPayLike;
}

export function normalizeBuyQuote(raw: Record<string, unknown>): MoonPayBuyQuote {
  const num = (k: string): number => Number(raw[k] ?? 0);
  return {
    fiatAmount: num('baseCurrencyAmount'),
    cryptoAmount: num('quoteCurrencyAmount'),
    feeAmount: num('feeAmount'),
    totalAmount: num('totalAmount'),
  };
}
