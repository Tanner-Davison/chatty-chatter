import { Schema, model } from "mongoose";

// Single-use links for verifying an email or resetting a password. Only a
// hash of the token is stored, so a database leak can't be used to log in.
const emailTokenSchema = new Schema({
  username: { type: String, required: true },
  type: { type: String, enum: ["verify_email", "reset_password"], required: true },
  tokenHash: { type: String, required: true, unique: true },
  /** For verification: the address being verified. */
  email: String,
  expiresAt: { type: Date, required: true },
});

// MongoDB deletes expired tokens on its own.
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailTokenModel = model("EmailToken", emailTokenSchema);
