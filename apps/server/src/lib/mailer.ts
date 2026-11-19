import type { Env } from "../config/env";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend drops repeats with the same key, so retries never double-send. */
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Sends through Resend's API. */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(email.idempotencyKey && { "Idempotency-Key": email.idempotencyKey }),
        },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.headers && { headers: email.headers }),
        }),
      });
      if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${await res.text()}`);
    },
  };
}

/** Writes emails to the log; for local development without a Resend key. */
export const consoleMailer: Mailer = {
  async send(email) {
    console.log(`\n📧 Email to ${email.to}: ${email.subject}\n${email.text}\n`);
  },
};

export function createMailer(env: Env): Mailer {
  return env.RESEND_API_KEY ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM) : consoleMailer;
}
