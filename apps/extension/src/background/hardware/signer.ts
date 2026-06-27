/**
 * Hardware-wallet signing seam (Phase 5).
 *
 * The signing path has a single chokepoint: the worker's `account_sign*` /
 * `account_sendTransaction`. A {@link HardwareSigner} lets a specific
 * (chain, accountIndex) be backed by an external device (Ledger/Trezor) instead
 * of the seed — the seed-derived key is never touched for that account.
 *
 * This module is the **routing + registry**, not the transport: the device
 * adapter (a `@ledgerhq/hw-app-eth` / WebHID wiring) implements the narrow
 * {@link HardwareSigner} interface and is registered per account. `routeSign*`
 * picks the device when the account is hardware-backed, else falls back to the
 * seed signer. Pure and unit-tested; the physical-device adapter is the only
 * piece that needs hardware to exercise end-to-end.
 */

export interface TypedDataPayload {
  readonly domain: unknown;
  readonly types: unknown;
  readonly message: unknown;
}

/**
 * A signer backed by an external device. The transport (WebHID/WebUSB + the
 * vendor app) is the adapter's concern; this is the surface the signing path
 * needs. All methods address a specific derivation (chain + account index).
 */
export interface HardwareSigner {
  /** Device/model identifier, e.g. "ledger-nano-x" (shown in the UI). */
  readonly id: string;
  getAddress(chain: string, index: number): Promise<string>;
  signMessage(chain: string, index: number, message: string): Promise<string>;
  signTypedData(chain: string, index: number, payload: TypedDataPayload): Promise<string>;
  signTransaction(chain: string, index: number, tx: Record<string, unknown>): Promise<string>;
}

/** A hardware-backed account entry (for listing / the UI). */
export interface HardwareAccount {
  readonly chain: string;
  readonly index: number;
  readonly signerId: string;
}

/**
 * Tracks which (chain, accountIndex) pairs are hardware-backed and by which
 * {@link HardwareSigner}. The signing path consults this before deriving from
 * the seed.
 */
export class HardwareSignerRegistry {
  #map = new Map<string, HardwareSigner>();

  #key(chain: string, index: number): string {
    return `${chain}:${index}`;
  }

  /** Mark an account as hardware-backed by `signer`. */
  register(chain: string, index: number, signer: HardwareSigner): void {
    this.#map.set(this.#key(chain, index), signer);
  }

  /** Remove a hardware binding (e.g. the user removed the device). */
  unregister(chain: string, index: number): boolean {
    return this.#map.delete(this.#key(chain, index));
  }

  /** The signer for an account, or null when it's a normal (seed) account. */
  get(chain: string, index: number): HardwareSigner | null {
    return this.#map.get(this.#key(chain, index)) ?? null;
  }

  isHardware(chain: string, index: number): boolean {
    return this.#map.has(this.#key(chain, index));
  }

  /** List every hardware-backed account (for Settings → Security). */
  list(): readonly HardwareAccount[] {
    const out: HardwareAccount[] = [];
    for (const [key, signer] of this.#map) {
      const sep = key.lastIndexOf(':');
      out.push({ chain: key.slice(0, sep), index: Number(key.slice(sep + 1)), signerId: signer.id });
    }
    return out;
  }
}

/** Route a message-sign to the device when hardware-backed, else the seed fn. */
export function routeSignMessage(
  registry: HardwareSignerRegistry,
  chain: string,
  index: number,
  message: string,
  seedSign: () => Promise<string>,
): Promise<string> {
  const hw = registry.get(chain, index);
  return hw ? hw.signMessage(chain, index, message) : seedSign();
}

/** Route a typed-data sign to the device when hardware-backed, else the seed fn. */
export function routeSignTypedData(
  registry: HardwareSignerRegistry,
  chain: string,
  index: number,
  payload: TypedDataPayload,
  seedSign: () => Promise<string>,
): Promise<string> {
  const hw = registry.get(chain, index);
  return hw ? hw.signTypedData(chain, index, payload) : seedSign();
}

/** Route a transaction-sign to the device when hardware-backed, else the seed fn. */
export function routeSignTransaction(
  registry: HardwareSignerRegistry,
  chain: string,
  index: number,
  tx: Record<string, unknown>,
  seedSign: () => Promise<string>,
): Promise<string> {
  const hw = registry.get(chain, index);
  return hw ? hw.signTransaction(chain, index, tx) : seedSign();
}
