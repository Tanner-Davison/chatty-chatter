import { IMAGE_TYPES, MAX_ATTACHMENTS, MAX_IMAGE_BYTES, type Attachment } from "@chatty/shared";
import { api } from "./api";

/** A Cloudinary URL resized to fit `width` (never upscaled), in the best format for the browser. */
export function imageAt(url: string, width: number): string {
  return url.replace("/image/upload/", `/image/upload/c_limit,w_${width},q_auto,f_auto/`);
}

export function uploadChatImage(file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("image", file);
  return api.post<Attachment>("/uploads/images", form);
}

/** Splits picked/pasted/dropped files into ones we can send and a reason for any we can't. */
export function acceptImages(
  files: File[],
  alreadyAttached: number,
): { accepted: File[]; problem?: string } {
  const images = files.filter((f) => (IMAGE_TYPES as readonly string[]).includes(f.type));
  const fitting = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
  const room = Math.max(0, MAX_ATTACHMENTS - alreadyAttached);
  const accepted = fitting.slice(0, room);
  const problem =
    images.length < files.length
      ? "Only JPEG, PNG, GIF and WebP images can be sent."
      : fitting.length < images.length
        ? "Images can be up to 8 MB."
        : fitting.length > room
          ? `Up to ${MAX_ATTACHMENTS} photos per message.`
          : undefined;
  return { accepted, ...(problem && { problem }) };
}
