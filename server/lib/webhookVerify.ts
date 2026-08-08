import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Verifies a Dodo Payments webhook signed per the Standard Webhooks spec:
// https://www.standardwebhooks.com
//
// Dodo sends `webhook-id`, `webhook-timestamp`, and `webhook-signature`
// headers. The signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256
// signed with the base64-decoded webhook secret, base64-encoded, and
// prefixed with "v1,".
// ---------------------------------------------------------------------------

export interface WebhookHeaders {
  "webhook-id"?: string;
  "webhook-timestamp"?: string;
  "webhook-signature"?: string;
}

export function verifyWebhookSignature(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string
): boolean {
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // webhook-signature can contain multiple space-delimited "v1,<sig>" values
  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean)
    .some((sig) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false;
      }
    });
}
