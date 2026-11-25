import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createPublishableKey() {
  return "ia_pub_" + randomBytes(32).toString("base64url");
}
export function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function verifySecret(expected: string, received: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}
