import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// Field names match the documents already in the `users` collection.
const userSchema = new Schema(
  {
    username: { type: String, required: true, index: true },
    password: { type: String, required: true, select: false },
    // Private: login, verification and password resets. Accounts made before
    // email existed have none until they add one.
    email: { type: String, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    // Alert emails: on unless turned off; sent only to a verified email.
    emailAlerts: { type: Boolean, default: true },
    /** When the last alert email went out. */
    alertEmailedAt: Date,
    /** When the user last had the app open (set as they leave). */
    lastActiveAt: Date,
    profilePic: {
      url: String,
      cloudinary_id: String,
    },
    sentMessages: [{ message: String, room: Number, timestamp: String }],
    roomsJoined: [{ room: Number, roomName: String, timestamp: String }],
    roomsCreated: [
      {
        roomName: String,
        room: Number,
        roomPassword: Number,
        private: Boolean,
        timestamp: String,
      },
    ],
    friends: [String],
    // Chat colours per hub, keyed by room number.
    // When the user last had each hub open, keyed by room number.
    lastSeen: { type: Map, of: Date, default: undefined },
    roomPreferences: {
      type: Map,
      of: new Schema({ sentColor: String, receivedColor: String }, { _id: false }),
      default: undefined,
    },
    profileBio: String,
    education: String,
    profession: String,
  },
  {
    // Old documents carry fields that were never in the schema; keep them
    // readable but don't write new ones.
    strict: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.sentMessages;
        return ret;
      },
    },
  },
);

// One account per email; accounts without an email don't conflict.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserFields>;

// Mongoose pluralizes "User" to the existing `users` collection.
export const UserModel = model("User", userSchema);
