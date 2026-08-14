import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Owns every /api/auth/* path: sign-up, sign-in, anonymous guest sign-in,
// session, sign-out — and the routes the Dodo adapter mounts underneath it,
// including POST /api/auth/dodopayments/webhooks (the URL to register in the
// Dodo dashboard) and the customer portal / usage endpoints.
export const { GET, POST } = toNextJsHandler(auth.handler);
