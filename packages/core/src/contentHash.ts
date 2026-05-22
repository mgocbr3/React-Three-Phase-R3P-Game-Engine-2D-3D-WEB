// Pixlland-specific. Wes/three-game-engine has no pack hashing — single-file
// .pixl bundles are our addition. SHA-256 via the platform's SubtleCrypto.

const HEX_CHARS = '0123456789abcdef';

const toHex = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    out += HEX_CHARS[(byte >> 4) & 0xf] + HEX_CHARS[byte & 0xf];
  }
  return out;
};

const getSubtle = (): SubtleCrypto => {
  const crypto = globalThis.crypto;
  if (!crypto || !crypto.subtle) {
    throw new Error(
      'PixlPlayground: SubtleCrypto unavailable. Run in a secure context (HTTPS or localhost) and use Node 18+.',
    );
  }
  return crypto.subtle;
};

export const sha256 = async (data: Uint8Array): Promise<string> => {
  // Copy into a fresh ArrayBuffer so SubtleCrypto's BufferSource type accepts
  // it under TS strict (Uint8Array's underlying buffer can be SharedArrayBuffer).
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const digest = await getSubtle().digest('SHA-256', buffer);
  return toHex(new Uint8Array(digest));
};

export const sha256OfString = (text: string): Promise<string> => {
  const encoder = new TextEncoder();
  return sha256(encoder.encode(text));
};
