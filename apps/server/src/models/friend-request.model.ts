import { Schema, model, type InferSchemaType } from "mongoose";

const friendRequestSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// One open request per direction between two people.
friendRequestSchema.index(
  { from: 1, to: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
friendRequestSchema.index({ to: 1, status: 1 });

export type FriendRequestFields = InferSchemaType<typeof friendRequestSchema>;

export const FriendRequestModel = model("FriendRequest", friendRequestSchema);
