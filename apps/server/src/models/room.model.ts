import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const messageSchema = new Schema({
  message: String,
  sentBy: String,
  timestamp: String,
  imageUrl: String,
  cloudinary_id: String,
  attachments: {
    type: [
      new Schema(
        { url: String, cloudinary_id: String, width: Number, height: Number },
        { _id: false },
      ),
    ],
    default: undefined,
  },
  mentions: { type: [String], default: undefined },
  linkPreviewHidden: Boolean,
});

// Field names match the documents already in the `rooms` collection.
const roomSchema = new Schema(
  {
    room_number: { type: Number, required: true, index: true },
    room_name: String,
    private_room: { type: Boolean, default: false },
    private_room_password: { type: String, select: false },
    // Private hubs without a password; they never appear in discovery.
    invite_only: Boolean,
    // The secret in the hub's invite link, made on first request.
    invite_code: { type: String, select: false },
    created_by: { type: String, required: true },
    room_category: String,
    first_message: String,
    messageHistory: [messageSchema],
    users_in_room: [String],
  },
  {
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.private_room_password;
        delete ret.invite_code;
        ret.private_room = Boolean(ret.private_room);
        return ret;
      },
    },
  },
);

roomSchema.index(
  { invite_code: 1 },
  { unique: true, partialFilterExpression: { invite_code: { $type: "string" } } },
);

export type RoomFields = InferSchemaType<typeof roomSchema>;
export type RoomDocument = HydratedDocument<RoomFields>;

// The model was named "Rooms" originally, which maps to the `rooms` collection.
export const RoomModel = model("Rooms", roomSchema);
