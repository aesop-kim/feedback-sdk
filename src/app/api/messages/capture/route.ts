import { createHash } from "node:crypto";
import { z } from "zod";
import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { respondError, respondJson, respondUnauthorized } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { RECORDINGS_BUCKET, getServerSupabase } from "@/lib/supabase/server-client";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/api-schemas";
import { CAPTURE_MIME_TYPE, MAX_CAPTURE_BYTES, MAX_CAPTURE_EDGE } from "@/sdk/capture-image";

const MAX_REQUEST_BYTES = MAX_CAPTURE_BYTES + 16 * 1024;
const captureFields = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().max(MAX_MESSAGE_LENGTH),
});

async function readCaptureForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!request.body || !contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return respondError(400, "캡처 첨부 형식이 올바르지 않아요.");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => undefined);
        return respondError(413, "캡처 이미지가 너무 커요.");
      }
      chunks.push(value);
    }
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
  } catch {
    return respondError(400, "캡처 첨부를 읽지 못했어요.");
  }
}

function isCaptureJpeg(bytes: Buffer) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    return false;
  }
  // JPEG 프레임 헤더에서 크기를 확인해 작은 파일에 큰 픽셀 크기를 선언하는 경우를 거부한다.
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (marker === 0xda || length < 2 || offset + 2 + length > bytes.length) {
      break;
    }
    if ((marker === 0xc0 || marker === 0xc2) && length >= 8) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return width > 0 && height > 0 && Math.max(width, height) <= MAX_CAPTURE_EDGE;
    }
    offset += 2 + length;
  }
  return false;
}

export async function POST(request: Request) {
  const conversation = await findAuthorizedConversation(request);
  if (!conversation) {
    return respondUnauthorized();
  }

  const form = await readCaptureForm(request);
  if (form instanceof Response) {
    return form;
  }
  const fields = captureFields.safeParse({ messageId: form.get("messageId"), body: form.get("body") });
  const image = form.get("image");
  if (!fields.success || !(image instanceof Blob) || image.type !== CAPTURE_MIME_TYPE) {
    return respondError(400, "JPEG 캡처 이미지와 메시지를 확인해 주세요.");
  }
  if (image.size > MAX_CAPTURE_BYTES) {
    return respondError(413, "캡처 이미지가 너무 커요.");
  }
  const bytes = Buffer.from(await image.arrayBuffer());
  if (!isCaptureJpeg(bytes)) {
    return respondError(400, "JPEG 캡처 이미지와 메시지를 확인해 주세요.");
  }

  const { messageId, body } = fields.data;
  const supabase = getServerSupabase();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const path = `captures/${conversation.conversationId}/${messageId.toLowerCase()}-${checksum}.jpg`;
  const { error: uploadError } = await supabase.storage.from(RECORDINGS_BUCKET).upload(path, bytes, {
    contentType: CAPTURE_MIME_TYPE,
    upsert: false,
  });
  // 같은 요청의 업로드가 이미 끝났다면 기존 파일을 써서 메시지 저장을 재시도한다.
  const storageCode = uploadError && "code" in uploadError ? uploadError.code : undefined;
  const alreadyUploaded = storageCode === "ResourceAlreadyExists" || storageCode === "KeyAlreadyExists" || uploadError?.statusCode === "409";
  if (uploadError && !alreadyUploaded) {
    return respondError(500, "캡처 이미지를 저장하지 못했어요.");
  }

  const { data: inserted, error } = await supabase.rpc("insert_capture_message", {
    p_id: messageId,
    p_conversation_id: conversation.conversationId,
    p_body: body || null,
    p_path: path,
  });
  if (error) {
    return respondError(500, "캡처 메시지를 저장하지 못했어요. 다시 보내 주세요.");
  }
  if (inserted === null) {
    return respondError(409, "이미 사용된 캡처 첨부예요.");
  }
  await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "message.created", id: messageId });
  return respondJson({ messageId }, inserted ? 201 : 200);
}
