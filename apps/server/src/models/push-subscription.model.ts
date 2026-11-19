import { Schema, model } from "mongoose";

// One per device (browser) that turned on pop-up alerts.
const pushSubscriptionSchema = new Schema(
  {
    username: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    // The browser's encryption keys for this subscription.
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { timestamps: true },
);

export const PushSubscriptionModel = model("PushSubscription", pushSubscriptionSchema);
