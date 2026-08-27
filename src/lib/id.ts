import { randomBytes } from "crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Id corto, url-safe y ordenable en el tiempo:
 * 8 chars de timestamp base36 + 12 chars aleatorios.
 */
export function createId(): string {
  const time = Date.now().toString(36).padStart(8, "0");
  const bytes = randomBytes(12);
  let rand = "";
  for (const b of bytes) rand += ALPHABET[b % ALPHABET.length];
  return time + rand;
}
