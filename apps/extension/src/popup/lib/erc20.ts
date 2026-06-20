/**
 * Minimal ABI encoder for ERC-20 transfers. Building the calldata here (rather
 * than pulling a full ABI codec into the popup) keeps the bundle small: an
 * ERC-20 transfer is a fixed selector plus two 32-byte words.
 */

/** `transfer(address,uint256)` selector. */
const TRANSFER_SELECTOR = 'a9059cbb';

/**
 * ABI-encodes `transfer(address,uint256)` calldata.
 * @param to recipient (0x-prefixed 40-hex address)
 * @param amount token amount in base units
 * @returns 0x-prefixed calldata (selector + padded address + padded amount)
 */
export function encodeErc20Transfer(to: string, amount: bigint): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
    throw new Error('Invalid recipient address for ERC-20 transfer.');
  }
  if (amount < 0n) {
    throw new Error('Transfer amount must be non-negative.');
  }
  const addr = to.toLowerCase().slice(2).padStart(64, '0');
  const amt = amount.toString(16).padStart(64, '0');
  return `0x${TRANSFER_SELECTOR}${addr}${amt}`;
}
