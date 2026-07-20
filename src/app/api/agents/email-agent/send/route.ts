// ===========================================================================
// app/api/agents/email-agent/send/route.ts
// ---------------------------------------------------------------------------
// POST /api/agents/email-agent/send
//   body: { to: string, subject: string, text: string }
//   res:  { ok: true, messageId } | { ok: false, error }
//
// Sends an email via SMTP using the credentials in .env.local. Returns a
// friendly error when email isn't configured.
//
// SECURITY NOTE: this route has no authentication. Anyone who can hit your
// deployed URL can send mail as you. Before deploying to production, add
// auth (NextAuth session check, an API key header, or restrict to your
// Vercel preview deployments only). For local dev on your own machine it's
// fine as-is.
// ===========================================================================

import { NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const to: string = (body?.to ?? "").toString().trim();
  const subject: string = (body?.subject ?? "").toString().trim();
  const text: string = (body?.text ?? "").toString().trim();

  if (!to || !subject || !text) {
    return NextResponse.json(
      { ok: false, error: "Missing `to`, `subject`, or `text` in body." },
      { status: 400 }
    );
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_FROM in .env.local.",
      },
      { status: 200 }
    );
  }

  const result = await sendEmail({ to, subject, text });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
