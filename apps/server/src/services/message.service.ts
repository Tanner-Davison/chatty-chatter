import {
  extractMentions,
  type ChatMessage,
  type Notification,
  type sendMessageSchema,
} from "@chatty/shared";
import type { z } from "zod";
import * as notificationService from "./notification.service";
import * as roomService from "./room.service";

export interface SentMessage {
  message: ChatMessage;
  notifications: (Notification & { recipient: string })[];
}

/** Stores a message with its checked mentions and creates their notifications. */
export async function sendMessage(
  username: string,
  input: z.output<typeof sendMessageSchema>,
): Promise<SentMessage> {
  const mentions = await notificationService.resolveMentions(
    username,
    input.room,
    extractMentions(input.message),
  );
  const message = await roomService.addMessage(username, input, mentions);
  const notifications = await notificationService.notifyMentions(input.room, message);
  return { message, notifications };
}
