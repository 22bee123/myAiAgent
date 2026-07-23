// ===========================================================================
// lib/facebookTypes.ts
// ---------------------------------------------------------------------------
// TypeScript type definitions for the Facebook Messenger Webhook payload.
//
// Facebook sends a POST request to your webhook URL whenever a user sends
// a message to your Page. The top-level shape is always:
//   { object: "page", entry: Entry[] }
//
// Each Entry contains one or more Messaging events. The types below model
// this structure so the webhook handler can be fully type-safe.
//
// Reference:
//   https://developers.facebook.com/docs/messenger-platform/webhooks
//   https://developers.facebook.com/docs/messenger-platform/reference/webhook-events
// ===========================================================================

// ---- Core webhook envelope ------------------------------------------------

/** Top-level body of every Messenger webhook POST request. */
export interface WebhookBody {
  /** Always "page" for Messenger webhooks. */
  object: "page" | string;
  /** One entry per Page that triggered events in this delivery. */
  entry: WebhookEntry[];
}

/** One entry per subscribed Page. Contains a batch of messaging events. */
export interface WebhookEntry {
  /** The Page ID. */
  id: string;
  /** Unix timestamp (ms) of the event batch. */
  time: number;
  /** Array of individual messaging events (1 per user interaction). */
  messaging?: MessagingEvent[];
}

// ---- Messaging event ------------------------------------------------------

/**
 * A single messaging event. Facebook sends many event types through the same
 * `messaging` array — message, postback, delivery, read, etc. We type the
 * most commonly used fields and keep the rest as optional `unknown`.
 */
export interface MessagingEvent {
  /** The user who sent the message (Page-Scoped ID). */
  sender: WebhookSender;
  /** The Page that received the message. */
  recipient: WebhookRecipient;
  /** Epoch timestamp (ms) of the event. */
  timestamp: number;

  // -- Event-specific fields (only one of these is present per event) --------

  /** Present when the user sends a text or attachment message. */
  message?: WebhookMessage;
  /** Present when the user taps a Postback button. */
  postback?: WebhookPostback;
  /** Present on delivery confirmations (not usually needed). */
  delivery?: WebhookDelivery;
  /** Present on read receipts (not usually needed). */
  read?: WebhookRead;
}

// ---- Sub-types ------------------------------------------------------------

export interface WebhookSender {
  /** Page-Scoped ID of the sender. */
  id: string;
}

export interface WebhookRecipient {
  /** The Page ID that received the message. */
  id: string;
}

export interface WebhookMessage {
  /** Unique message ID. */
  mid: string;
  /** The text body (present for text messages). */
  text?: string;
  /** Attachments (images, stickers, files, etc.). */
  attachments?: WebhookAttachment[];
  /** Quick-reply payload, if the user tapped a quick reply button. */
  quick_reply?: { payload: string };
  /** True if this message is an echo of a message sent BY the Page. */
  is_echo?: boolean;
}

export interface WebhookAttachment {
  type: "image" | "video" | "audio" | "file" | "location" | "fallback";
  payload: {
    url?: string;
    coordinates?: { lat: number; long: number };
    sticker_id?: number;
    [key: string]: unknown;
  };
}

export interface WebhookPostback {
  /** The postback title (button label the user saw). */
  title: string;
  /** The developer-defined payload string. */
  payload: string;
}

export interface WebhookDelivery {
  mids?: string[];
  watermark: number;
}

export interface WebhookRead {
  watermark: number;
}
