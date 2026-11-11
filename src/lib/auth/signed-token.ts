import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// `<payload>.<signature>` 형태의 HMAC 서명 토큰. payload는 base64url JSON.
// 위젯 대화 토큰과 관리자 세션 쿠키가 같은 형식을 쓴다.

type SignedPayload = { subject: string; expiresAt: number };

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedToken(subject: string, ttlMs: number, secret: string, now = Date.now()): string {
  const payload: SignedPayload = { subject, expiresAt: now + ttlMs };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifySignedToken(token: string | null | undefined, secret: string, now = Date.now()): string | null {
  if (!token) {
    return null;
  }
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }
  const expectedSignature = Buffer.from(sign(encodedPayload, secret));
  const receivedSignature = Buffer.from(signature);
  if (expectedSignature.length !== receivedSignature.length) {
    return null;
  }
  if (!timingSafeEqual(expectedSignature, receivedSignature)) {
    return null;
  }
  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SignedPayload;
    if (typeof payload.subject !== "string" || typeof payload.expiresAt !== "number") {
      return null;
    }
    if (payload.expiresAt <= now) {
      return null;
    }
    return payload.subject;
  } catch {
    return null;
  }
}

// 길이가 달라도 걸리는 시간이 같도록 해시(고정 32바이트)끼리 비교한다.
export function isSamePassword(received: string, expected: string): boolean {
  const receivedDigest = createHash("sha256").update(received).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}
