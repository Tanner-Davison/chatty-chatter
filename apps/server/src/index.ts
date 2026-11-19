import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import {
  createCloudinaryChatImages,
  createCloudinaryHubCovers,
  createCloudinaryUploader,
} from "./lib/cloudinary";
import { createMailer } from "./lib/mailer";
import type { Presence } from "./lib/presence";
import { createPusher } from "./lib/push";
import { startAlertEmails, withPush } from "./services/alert.service";
import { createSocketServer, socketNotifier, socketPresence } from "./socket";

const env = loadEnv();

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
console.log("Connected to MongoDB");

// The app needs presence from the socket server, which needs the HTTP server,
// which needs the app. Presence only reads `io` per request, after it exists.
const chatImages = createCloudinaryChatImages(env);
const mailer = createMailer(env);
const pusher = createPusher(env);
const presence: Presence = {
  onlineCounts: (rooms) => socketPresence(io).onlineCounts(rooms),
  isOnline: (username) => socketPresence(io).isOnline(username),
};
// Open tabs get notifications live; everyone else gets a pop-up if they turned them on.
const notifier = withPush(
  {
    send: (to, n) => socketNotifier(io).send(to, n),
    changed: (to) => socketNotifier(io).changed(to),
  },
  pusher,
  presence,
);
const app = createApp({
  env,
  uploadImage: createCloudinaryUploader(env),
  chatImages,
  hubCovers: createCloudinaryHubCovers(env),
  notifier,
  presence,
  mailer,
  pusher,
});
const server = createServer(app);
const io = createSocketServer(env, server, chatImages, notifier);
const stopAlertEmails = startAlertEmails(env, mailer, presence);

server.listen(env.PORT, () => {
  console.log(`API and Socket.IO listening on port ${env.PORT}`);
});

// Heroku sends SIGTERM before restarting a dyno.
const shutdown = () => {
  console.log("Shutting down");
  stopAlertEmails();
  void io.close();
  server.close(() => {
    void mongoose.disconnect().then(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
