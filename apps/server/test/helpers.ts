import bcrypt from "bcryptjs";
import request from "supertest";
import type { ProfilePic } from "@chatty/shared";
import { createApp } from "../src/app";
import { loadEnv } from "../src/config/env";
import { RoomModel } from "../src/models/room.model";
import { UserModel } from "../src/models/user.model";

export const env = loadEnv({
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://unused",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
});

/** Made-up password for private rooms in tests (lives only in the in-memory database). */
export const TEST_ROOM_PASSWORD = "test-room-pw";

export const uploadedPic: ProfilePic = {
  url: "https://res.cloudinary.com/x/pic.png",
  cloudinary_id: "pic",
};

export const app = createApp({ env, uploadImage: async () => uploadedPic });

/** Inserts a user the way the old server stored them (bcrypt hash, lowercase name). */
export async function seedUser(username: string, password = "password123") {
  return UserModel.create({ username, password: await bcrypt.hash(password, 4) });
}

export async function seedRoom(fields: {
  room_number: number;
  created_by: string;
  room_name?: string;
  private_room?: boolean;
  password?: string;
}) {
  const { password, ...rest } = fields;
  return RoomModel.create({
    room_name: `Room ${fields.room_number}`,
    ...rest,
    ...(password && { private_room_password: await bcrypt.hash(password, 4) }),
    messageHistory: [{ message: "hello", sentBy: fields.created_by, timestamp: "11/26 12:44 am" }],
    users_in_room: [fields.created_by],
  });
}

/** A supertest agent that keeps cookies, logged in as the given user. */
export async function loginAs(username: string, password = "password123") {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ username, password }).expect(200);
  return agent;
}
