import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./db.js"; // ensures schema is created on boot

import { authRouter } from "./routes/auth.js";
import { checkoutRouter } from "./routes/checkout.js";
import { billingRouter } from "./routes/billing.js";
import { webhooksRouter } from "./routes/webhooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());

// Capture the raw body for webhook signature verification, while still
// parsing JSON normally for every other route.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString("utf8");
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/billing", billingRouter);
app.use("/api/webhooks", webhooksRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve the built frontend in production (after `npm run build`).
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`Atlas Studio API listening on http://localhost:${PORT}`);
});
