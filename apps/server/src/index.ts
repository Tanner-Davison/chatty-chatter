import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createCloudinaryChatImages, createCloudinaryUploader } from "./lib/cloudinary";
import { createSocketServer, socketNotifier, socketPresence } from "./socket";

const env = loadEnv();

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
console.log("Connected to MongoDB");

// The app needs presence from the socket server, which needs the HTTP server,
// which needs the app. Presence only reads `io` per request, after it exists.
const chatImages = createCloudinaryChatImages(env);
const app = createApp({
  env,
  uploadImage: createCloudinaryUploader(env),
  chatImages,
  notifier: {
    send: (to, n) => socketNotifier(io).send(to, n),
    changed: (to) => socketNotifier(io).changed(to),
  },
  presence: { onlineCounts: (rooms) => socketPresence(io).onlineCounts(rooms) },
});
const server = createServer(app);
const io = createSocketServer(env, server, chatImages);

server.listen(env.PORT, () => {
  console.log(`API and Socket.IO listening on port ${env.PORT}`);
});

// Heroku sends SIGTERM before restarting a dyno.
const shutdown = () => {
  console.log("Shutting down");
  void io.close();
  server.close(() => {
    void mongoose.disconnect().then(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
