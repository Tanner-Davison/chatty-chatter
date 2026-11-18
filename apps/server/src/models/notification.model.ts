import { Schema, model, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: { type: String, required: true },
    type: { type: String, enum: ["mention", "friend_request", "friend_accepted"], required: true },
    /** Who caused it. */
    sentBy: { type: String, required: true },
    read: { type: Boolean, default: false },
    // Mentions
    room: Number,
    roomName: String,
    messageId: String,
    preview: String,
    // Friend requests
    requestId: String,
    requestStatus: { type: String, enum: ["pending", "accepted", "declined", "cancelled"] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The dropdown lists a user's newest notifications.
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Old notifications clean themselves up after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type NotificationFields = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model("Notification", notificationSchema);
