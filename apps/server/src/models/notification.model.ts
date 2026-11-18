import { Schema, model, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: { type: String, required: true },
    type: { type: String, enum: ["mention"], required: true },
    room: { type: Number, required: true },
    roomName: String,
    messageId: { type: String, required: true },
    sentBy: { type: String, required: true },
    preview: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The dropdown lists a user's newest notifications.
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Old notifications clean themselves up after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type NotificationFields = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model("Notification", notificationSchema);
