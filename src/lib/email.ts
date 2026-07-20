// ===========================================================================
// lib/email.ts
// ---------------------------------------------------------------------------
// Email integration layer used by the Email Agent. Connects to your mailbox
// via IMAP (for reading) and SMTP (for sending) using the `imapflow` library.
//
// Credentials come from environment variables — NEVER hardcode them. See
// `.env.local` for setup instructions (Gmail app passwords, Outlook, etc.).
//
// When credentials are not set, the module goes into "demo mode" and returns
// mock inbox data so the UI still works without a real mailbox connected.
//
// For production you should consider switching to OAuth (Gmail API or
// Microsoft Graph) instead of basic auth with app passwords — see the
// README for a migration path.
// ===========================================================================

import { ImapFlow, type ImapFlowOptions } from "imapflow";

// ---- Types ----------------------------------------------------------------
export interface EmailMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string; // ISO string
  snippet: string; // first ~200 chars of body
  unread: boolean;
}

export interface InboxResult {
  connected: boolean; // true = real mailbox, false = demo mode
  total: number;
  unread: number;
  messages: EmailMessage[];
}

// ---- Config check ---------------------------------------------------------
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 993;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

export function isEmailConfigured(): boolean {
  return Boolean(EMAIL_HOST && EMAIL_USER && EMAIL_PASS);
}

// ---- IMAP client factory --------------------------------------------------
function makeImapClient(): ImapFlow {
  const opts: ImapFlowOptions = {
    host: EMAIL_HOST!,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 993, // implicit TLS on 993, STARTTLS otherwise
    auth: {
      user: EMAIL_USER!,
      pass: EMAIL_PASS!,
    },
    logger: false, // set to true to debug IMAP traffic
  };
  return new ImapFlow(opts);
}

// ---- Fetch recent inbox ---------------------------------------------------
export async function fetchInbox(limit = 10): Promise<InboxResult> {
  if (!isEmailConfigured()) {
    return mockInbox(limit);
  }

  const client = makeImapClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Get mailbox status (total + unread counts)
      const status = client.mailbox;
      const total = status?.exists ?? 0;

      // Fetch the most recent `limit` messages, newest first.
      // range format: "TOTAL:N" gives us the last N by sequence number.
      const startSeq = Math.max(1, total - limit + 1);
      const range = `${startSeq}:${total}`;

      const messages: EmailMessage[] = [];
      for await (const msg of client.fetch(range, {
        envelope: true,
        source: true,
        flags: true,
        uid: true,
      })) {
        const env = msg.envelope;
        const from = env?.from?.[0]
          ? `${env.from[0].name ?? ""} <${env.from[0].address}>`.trim()
          : "(unknown sender)";
        const to = env?.to?.[0]?.address ?? "(unknown recipient)";
        const subject = env?.subject ?? "(no subject)";
        const date = env?.date
          ? new Date(env.date).toISOString()
          : new Date().toISOString();

        // Extract a plain-text snippet from the raw email source.
        const rawSource = msg.source instanceof Uint8Array
          ? new TextDecoder().decode(msg.source)
          : String(msg.source ?? "");
        const snippet = extractTextSnippet(rawSource, 200);

        messages.push({
          uid: msg.uid,
          from,
          to,
          subject,
          date,
          snippet,
          unread: msg.flags?.has("\\Seen") === false,
        });
      }

      // Reverse so newest is first.
      messages.reverse();

      const unread = messages.filter((m) => m.unread).length;

      return { connected: true, total, unread, messages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ---- Send email via SMTP --------------------------------------------------
// imapflow's client also supports SMTP via `client.smtp.send()`. For
// simplicity we use the same client. If your provider requires a separate
// SMTP connection with different creds, replace this with `nodemailer`.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error:
        "Email not configured. Set EMAIL_HOST / EMAIL_USER / EMAIL_PASS in .env.local.",
    };
  }

  const client = makeImapClient();
  await client.connect();

  try {
    // imapflow's SMTP support is via the same client.
    // @ts-expect-error - smtp is an optional property on ImapFlow instances
    const smtp = client.smtp;
    if (!smtp) {
      return {
        ok: false,
        error:
          "SMTP not available on this client. Install nodemailer and wire it separately.",
      };
    }

    const from = process.env.SMTP_FROM || EMAIL_USER!;
    const messageId = await smtp.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });

    return { ok: true, messageId: String(messageId ?? "") };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    await client.logout();
  }
}

// ---- Helpers --------------------------------------------------------------
function extractTextSnippet(rawSource: string, maxLen: number): string {
  // Very simple snippet extractor: find the first text/plain section and
  // grab its first N chars. For a real app use a proper MIME parser like
  // `mailparser` — kept simple here to avoid another dependency.
  const plainMatch = rawSource.match(
    /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\.\r?\n|$)/i
  );
  const text = plainMatch?.[1] ?? "";
  const cleaned = text
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) // QP encoding
    .replace(/<[^>]+>/g, "") // strip HTML tags
    .trim();
  return cleaned.length > maxLen
    ? cleaned.slice(0, maxLen) + "…"
    : cleaned || "(no preview)";
}

// ---- Demo mode mock inbox -------------------------------------------------
// Returned when email isn't configured. Lets the UI render plausibly without
// a real mailbox. Clearly marked as `connected: false` so the API route can
// tell the user to connect their account.
function mockInbox(limit: number): InboxResult {
  const mocks: Omit<EmailMessage, "unread">[] = [
    {
      uid: 101,
      from: "Acme Recruiting <talent@acme.example>",
      to: "you",
      subject: "Following up on your application",
      date: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      snippet:
        "Hi — wanted to follow up on your application for the Senior Engineer role. Are you free for a chat this week?",
    },
    {
      uid: 100,
      from: "GitHub <noreply@github.com>",
      to: "you",
      subject: "[your-org/ai-agent-office] PR #42 needs review",
      date: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
      snippet:
        "alex opened pull request #42: 'Add window + couch to office'. 3 files changed, +180 −12.",
    },
    {
      uid: 99,
      from: "Stripe <receipts@stripe.com>",
      to: "you",
      subject: "Your monthly invoice is ready",
      date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      snippet:
        "Invoice #INV-2026-07 for $49.00 was generated. It will be charged to your card on Aug 1.",
    },
    {
      uid: 98,
      from: "Mom",
      to: "you",
      subject: "Sunday dinner?",
      date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      snippet: "Are you coming over Sunday? Let me know. Love you.",
    },
    {
      uid: 97,
      from: "Vercel <no-reply@vercel.com>",
      to: "you",
      subject: "Deployment ready: ai-agent-office",
      date: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      snippet:
        "Your deployment is ready. Production: https://ai-agent-office.vercel.app",
    },
  ];
  const sliced = mocks.slice(0, limit);
  return {
    connected: false,
    total: mocks.length,
    unread: 2,
    messages: sliced.map((m, i) => ({ ...m, unread: i < 2 })),
  };
}
