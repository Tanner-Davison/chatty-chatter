import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import type { ProfilePic } from "@chatty/shared";
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
