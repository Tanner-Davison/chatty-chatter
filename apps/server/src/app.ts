import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { isAllowedOrigin, type Env } from "./config/env";
import { unavailableImageStore, type ChatImageStore, type ImageUploader } from "./lib/cloudinary";
import { createLinkPreviewer, type LinkPreviewer } from "./lib/link-preview";
import { createMailer, type Mailer } from "./lib/mailer";
import { noNotifier, type Notifier } from "./lib/notifier";
import { noPresence, type Presence } from "./lib/presence";
import { noPusher, type Pusher } from "./lib/push";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createApiRouter } from "./routes";

export interface AppDeps {
  env: Env;
  uploadImage: ImageUploader;
  /** Live online counts; defaults to none (tests). */
  presence?: Presence;
  /** Fetches link previews; tests pass a fake. */
  linkPreviewer?: LinkPreviewer;
  /** Stores photos sent in chat; tests pass a fake. */
  chatImages?: ChatImageStore;
  /** Stores hub cover photos; tests pass a fake. */
  hubCovers?: ChatImageStore;
  /** Pushes notifications to people's open tabs. */
  notifier?: Notifier;
  /** Sends account emails; defaults to Resend (or the log without a key). */
  mailer?: Mailer;
  /** Sends pop-up alerts; defaults to none (tests). */
  pusher?: Pusher;
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({
  env,
  uploadImage,
  presence = noPresence,
  linkPreviewer = createLinkPreviewer(),
  chatImages = unavailableImageStore,
  hubCovers = unavailableImageStore,
  notifier = noNotifier,
  mailer = env.NODE_ENV === "test" ? { send: async () => {} } : createMailer(env),
  pusher = noPusher,
}: AppDeps): Express {
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
  app.use(
    "/api",
    createApiRouter(env, {
      uploadImage,
      presence,
      linkPreviewer,
      chatImages,
      hubCovers,
      notifier,
      mailer,
      pusher,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
