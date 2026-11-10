/**
 * Private receipt access primitives. Neither the opaque secret nor its raw
 * representation may be logged, stored in a database, or placed in a URL.
 * The high-entropy secret must be delivered only through an approved channel
 * or first-party response after a committed intake transaction.
 */
export interface NewReceiptSecret {
  secret: string;
  digestHex: string;
}
export const SECRET_BYTES = 32;
export const SECRET_HEX = /^[0-9a-f]{64}$/u;
export const REFERENCE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function secretDigestHex(secret: string): Promise<string> {
  // Reject noncanonical input so a DB lookup can't leak valid reference shape.
  if (!SECRET_HEX.test(secret)) throw new ReceiptAccessError();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return toHex(new Uint8Array(digest));
}

export async function newReceiptSecret(): Promise<NewReceiptSecret> {
  // 256 bits of cryptographically strong randomness, *not* Date.now/Math.random.
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  const secret = toHex(bytes);
  return { secret, digestHex: await secretDigestHex(secret) };
}

export class ReceiptAccessError extends Error {
  constructor() { super('invalid_receipt'); this.name = 'ReceiptAccessError'; }
}

export interface TrackRequest {
  reference: string;
  secret: string;
}

export function parseTrackRequest(raw: string): TrackRequest {
  if (new TextEncoder().encode(raw).byteLength > 256) throw new ReceiptAccessError();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new ReceiptAccessError(); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new ReceiptAccessError();
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || Object.keys(value).some(key => key !== 'reference' && key !== 'secret') ||
      typeof value.reference !== 'string' || !REFERENCE_UUID.test(value.reference) ||
      typeof value.secret !== 'string' || !SECRET_HEX.test(value.secret))
    throw new ReceiptAccessError();
  return { reference: value.reference.toLowerCase(), secret: value.secret };
}
