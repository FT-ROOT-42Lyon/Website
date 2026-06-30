import { createHash, timingSafeEqual } from "crypto";

// Plain SHA-256(hex) of the flag, preserving leading/trailing whitespace —
// admins may deliberately set flags whose spaces are part of the answer.
// CTF flags are public once solved; they're not passwords, so no salt/bcrypt
// is needed — but constant-time comparison still avoids leaking timing info
// on near-miss attempts.
export function hashFlag(flag: string): string {
  return createHash("sha256").update(flag).digest("hex");
}

export function flagMatches(submitted: string, storedHex: string): boolean {
  const submittedHash = hashFlag(submitted);
  if (submittedHash.length !== storedHex.length) return false;
  return timingSafeEqual(
    Buffer.from(submittedHash, "hex"),
    Buffer.from(storedHex, "hex"),
  );
}
