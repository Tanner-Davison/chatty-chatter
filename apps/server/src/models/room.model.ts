import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const messageSchema = new Schema({
  message: String,
  sentBy: String,
  timestamp: String,
  imageUrl: String,
  cloudinary_id: String,
});

// Field names match the documents already in the `rooms` collection.
const roomSchema = new Schema(
  {
    room_number: { type: Number, required: true, index: true },
    room_name: String,
    private_room: { type: Boolean, default: false },
    private_room_password: { type: String, select: false },
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
        ret.private_room = Boolean(ret.private_room);
        return ret;
      },
    },
  },
);

export type RoomFields = InferSchemaType<typeof roomSchema>;
export type RoomDocument = HydratedDocument<RoomFields>;

// The model was named "Rooms" originally, which maps to the `rooms` collection.
export const RoomModel = model("Rooms", roomSchema);
