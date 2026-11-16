import { createHash } from "node:crypto";
import { z } from "zod";

const deviceKeySchema = z.uuidv4();

export function readCaptureDeviceHash(request: Request): string | null {
  const key = deviceKeySchema.safeParse(request.headers.get("x-capture-device"));
  return key.success ? createHash("sha256").update(key.data).digest("hex") : null;
}
