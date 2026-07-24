import { NextRequest, NextResponse } from "next/server";
import { uploadFacebookPhoto, createFacebookPost } from "@/lib/facebook";

export const dynamic = "force-dynamic";

/**
 * POST /api/facebook/post
 * Body: { imageUrl?: string, message?: string }
 *
 * Publishes a text post or photo post directly to your Facebook Page feed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl: string | undefined = body?.imageUrl?.trim();
    const message: string | undefined = body?.message?.trim();

    if (!imageUrl && !message) {
      return NextResponse.json(
        { error: "Provide either `imageUrl` or `message` to publish a post." },
        { status: 400 }
      );
    }

    // 1. If imageUrl is provided -> upload & publish photo
    if (imageUrl) {
      const result = await uploadFacebookPhoto(imageUrl, true, message);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        type: "photo",
        id: result.data.id,
        post_id: result.data.post_id,
        message: "Photo published to Facebook Page successfully!",
      });
    }

    // 2. Otherwise -> publish text post
    if (message) {
      const result = await createFacebookPost(message);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        type: "text",
        id: result.data.id,
        message: "Text post published to Facebook Page successfully!",
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[api/facebook/post] Error:", errorMsg);
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
