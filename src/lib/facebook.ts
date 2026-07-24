// ===========================================================================
// lib/facebook.ts
// ---------------------------------------------------------------------------
// Facebook Page integration layer used by the FB Page Agent. Communicates
// with the Meta Graph API to:
//   1. Send Messenger replies (via the Send API)
//   2. Publish / schedule posts on the Page feed
//   3. Upload photos (published or unpublished for later attachment)
//
// Credentials come from environment variables — NEVER hardcode them.
// Required env vars:
//   FB_PAGE_ACCESS_TOKEN  – long-lived Page token with pages_messaging,
//                           pages_manage_posts, pages_read_engagement scopes
//   FB_PAGE_ID            – numeric Page ID (find via /me/accounts)
//   FB_APP_SECRET         – used for webhook signature verification
//   FB_VERIFY_TOKEN       – arbitrary string you set in the Meta dashboard
//
// When FB_PAGE_ACCESS_TOKEN is not set the helper functions return
// descriptive errors instead of crashing, so the rest of the app stays
// functional in demo mode.
// ===========================================================================

// ---- Types ----------------------------------------------------------------

/** Result of any Graph API call — either success or a captured error. */
export type GraphResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Shape returned by the Send API on success. */
export interface SendApiResponse {
  recipient_id: string;
  message_id: string;
}

/** Shape returned by /{page-id}/feed on success. */
export interface FeedPostResponse {
  id: string; // e.g. "PAGE_ID_POST_ID"
}

/** Shape returned by /{page-id}/photos on success. */
export interface PhotoUploadResponse {
  id: string;
  post_id?: string;
}

// ---- Config ---------------------------------------------------------------

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isFacebookConfigured(): boolean {
  return Boolean(process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ID);
}

// ---- Internal helpers -----------------------------------------------------

/**
 * Thin wrapper around `fetch` for Graph API calls. Automatically appends the
 * access token, sets JSON content-type on POST, and normalises errors into a
 * `GraphResult`.
 */
async function graphFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {}
): Promise<GraphResult<T>> {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("[facebook] FB_PAGE_ACCESS_TOKEN is missing from process.env!");
    return {
      ok: false,
      error:
        "Facebook not configured. Set FB_PAGE_ACCESS_TOKEN in your environment.",
    };
  }

  // Build URL with access_token query param (standard for Graph API)
  const separator = path.includes("?") ? "&" : "?";
  const url = `${GRAPH_BASE}${path}${separator}access_token=${accessToken}`;

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const body = await res.json();

    if (!res.ok) {
      const errMsg =
        body?.error?.message ?? body?.error ?? JSON.stringify(body);
      console.error("[facebook] Graph API error:", res.status, errMsg);
      return { ok: false, error: `Graph API ${res.status}: ${errMsg}` };
    }

    return { ok: true, data: body as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[facebook] fetch failed:", msg);
    return { ok: false, error: msg };
  }
}

// ---- Public API -----------------------------------------------------------

/**
 * Send a text message to a user via the Messenger Send API.
 *
 * @param recipientId  The PSID (Page-Scoped ID) of the user to message.
 * @param text         The message text to send.
 */
export async function sendFacebookMessage(
  recipientId: string,
  text: string
): Promise<GraphResult<SendApiResponse>> {
  return graphFetch<SendApiResponse>(`/me/messages`, {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });
}

/**
 * Publish (or schedule) a text post on the Page's feed.
 *
 * @param message        The post body text.
 * @param scheduledTime  Optional Unix timestamp (seconds) to schedule the post.
 *                       Must be between 10 minutes and 6 months in the future.
 *                       If omitted the post publishes immediately.
 */
export async function createFacebookPost(
  message: string,
  scheduledTime?: number
): Promise<GraphResult<FeedPostResponse>> {
  const payload: Record<string, unknown> = { message };

  if (scheduledTime) {
    payload.published = false;
    payload.scheduled_publish_time = scheduledTime;
  }

  // With a Page Access Token, /me/feed automatically targets the Page feed
  return graphFetch<FeedPostResponse>(`/me/feed`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Upload a photo to the Page. Can be published directly or kept unpublished
 * (for later attachment to a multi-photo feed post).
 *
 * @param imageUrl   A publicly accessible URL of the image to upload.
 * @param published  If `false`, the photo is uploaded but not posted — you get
 *                   back an `id` you can attach to a later /{page-id}/feed call
 *                   via the `attached_media` field.
 * @param caption    Optional post caption text to accompany the photo.
 */
export async function uploadFacebookPhoto(
  imageUrl: string,
  published = true,
  caption?: string
): Promise<GraphResult<PhotoUploadResponse>> {
  const payload: Record<string, unknown> = {
    url: imageUrl,
    published,
  };
  if (caption) {
    payload.caption = caption;
  }

  // With a Page Access Token, /me/photos automatically targets the Page photo feed
  return graphFetch<PhotoUploadResponse>(`/me/photos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
