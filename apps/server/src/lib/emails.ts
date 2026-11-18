// The app's emails. Plain, single-column HTML that renders everywhere, with a
// text version for clients that don't show HTML.

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function layout(
  heading: string,
  body: string,
  button: { label: string; href: string },
  footer: string,
) {
  return `<!doctype html><html><body style="margin:0;background:#05070b;font-family:Inter,Arial,sans-serif;color:#e3e9f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#0f141c;border:1px solid #1c2531;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#e3e9f1">Chatty Chatter</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#e3e9f1">${heading}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#b7c2d1">${body}</p>
<a href="${escape(button.href)}" style="display:inline-block;background:#4ade80;color:#052e16;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${button.label}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8796aa">${footer}</p>
<p style="margin:16px 0 0;font-size:12px;color:#5b6b80;word-break:break-all">Or paste this link into your browser:<br>${escape(button.href)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function verifyEmail(username: string, link: string) {
  return {
    subject: "Verify your email for Chatty Chatter",
    html: layout(
      `Hi @${escape(username)}, confirm your email`,
      "Click below to verify this address. You'll use it to reset your password and get alerts.",
      { label: "Verify email", href: link },
      "This link works for 24 hours. If you didn't sign up for Chatty Chatter, you can ignore this email.",
    ),
    text: `Hi @${username},\n\nVerify your email for Chatty Chatter:\n${link}\n\nThis link works for 24 hours. If you didn't sign up, ignore this email.`,
  };
}

export function resetPassword(username: string, link: string) {
  return {
    subject: "Reset your Chatty Chatter password",
    html: layout(
      `Reset the password for @${escape(username)}`,
      "Someone (hopefully you) asked to reset your password. Click below to choose a new one.",
      { label: "Choose a new password", href: link },
      "This link works for 1 hour and only once. If you didn't ask for this, ignore this email; your password won't change.",
    ),
    text: `Reset the password for @${username}:\n${link}\n\nThis link works for 1 hour and only once. If you didn't ask for this, ignore this email.`,
  };
}
