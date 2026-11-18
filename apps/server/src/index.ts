import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createCloudinaryUploader } from "./lib/cloudinary";
import { createSocketServer } from "./socket";

const env = loadEnv();

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
console.log("Connected to MongoDB");

const app = createApp({ env, uploadImage: createCloudinaryUploader(env) });
const server = createServer(app);
const io = createSocketServer(env, server);

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
