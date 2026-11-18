import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { isAllowedOrigin, type Env } from "./config/env";
import type { ImageUploader } from "./lib/cloudinary";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createApiRouter } from "./routes";

export interface AppDeps {
  env: Env;
  uploadImage: ImageUploader;
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({ env, uploadImage }: AppDeps): Express {
  const app = express();

  // Heroku terminates TLS in front of the dyno; needed for secure cookies and rate limiting by IP.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, isAllowedOrigin(env, origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.json({ message: "Chatty Chatter API is running" });
  });
  app.use("/api", createApiRouter(env, uploadImage));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
