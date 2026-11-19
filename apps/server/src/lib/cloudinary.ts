import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import {
  IMAGE_TYPES as CHAT_IMAGE_TYPES,
  MAX_IMAGE_BYTES as MAX_CHAT_IMAGE_BYTES,
  type Attachment,
  type ProfilePic,
} from "@chatty/shared";
import type { Env } from "../config/env";
import { badRequest } from "./http-error";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);

/** Keeps an uploaded image in memory so it can be streamed to Cloudinary. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.has(file.mimetype)) cb(null, true);
    else cb(badRequest("Upload a PNG or JPEG image"));
  },
});

export type ImageUploader = (file: Express.Multer.File) => Promise<ProfilePic>;

export function createCloudinaryUploader(env: Env): ImageUploader {
  cloudinary.config({
    cloud_name: env.CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_SECRET,
    secure: true,
  });
  return (file) =>
    new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "profile_photos" }, (error, result) => {
          if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
          resolve({ url: result.secure_url, cloudinary_id: result.public_id });
        })
        .end(file.buffer);
    });
}

const CHAT_FOLDER = "chat_images";

/** Photos people send in chat: any common image type, up to 8 MB. */
export const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((CHAT_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(badRequest("Send a JPEG, PNG, GIF or WebP image"));
  },
});

export interface ChatImageStore {
  upload(file: Express.Multer.File): Promise<Attachment>;
  /** Best effort: a failure here shouldn't stop a message from being deleted. */
  remove(cloudinaryIds: string[]): Promise<void>;
}

/** Used when no image store is configured (tests): uploads fail, removal does nothing. */
export const unavailableImageStore: ChatImageStore = {
  upload: () => Promise.reject(badRequest("Photo uploads aren't available")),
  remove: async () => {},
};

export function createCloudinaryChatImages(env: Env): ChatImageStore {
  return createCloudinaryImageStore(env, CHAT_FOLDER);
}

/** Hub cover photos, kept apart from chat photos. */
export function createCloudinaryHubCovers(env: Env): ChatImageStore {
  return createCloudinaryImageStore(env, "hub_covers");
}

function createCloudinaryImageStore(env: Env, folder: string): ChatImageStore {
  cloudinary.config({
    cloud_name: env.CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_SECRET,
    secure: true,
  });
  return {
    upload: (file) =>
      new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder,
              resource_type: "image",
              // The account's default preset crops uploads into round 190px
              // avatars; these photos must keep their real size and shape.
              upload_preset: "ml_default",
            },
            (error, result) => {
              if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
              resolve({
                url: result.secure_url,
                cloudinary_id: result.public_id,
                width: result.width,
                height: result.height,
              });
            },
          )
          .end(file.buffer);
      }),
    remove: async (ids) => {
      if (ids.length === 0) return;
      await cloudinary.api.delete_resources(ids).catch((err: unknown) => {
        console.error(`Couldn't remove images from Cloudinary (${folder})`, err);
      });
    },
  };
}

/**
 * Whether an attachment really is one of this app's chat photos, so messages
 * can't embed arbitrary outside images (or tracking pixels).
 */
export function isOwnChatImage(env: Env, attachment: Attachment): boolean {
  const prefix = `https://res.cloudinary.com/${env.CLOUD_NAME}/image/upload/`;
  return (
    attachment.url.startsWith(prefix) &&
    attachment.cloudinary_id.startsWith(`${CHAT_FOLDER}/`) &&
    attachment.url.includes(`/${attachment.cloudinary_id}.`)
  );
}
