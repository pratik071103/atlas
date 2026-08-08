import { Router } from "express";
import { db } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  createUserSession,
  createGuestSession,
  setSessionCookie,
  clearSessionCookie,
  getIdentity,
  newId,
} from "../lib/auth.js";

export const authRouter = Router();

authRouter.post("/sign-up", (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const id = newId("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`
  ).run(id, name, email, hashPassword(password));

  const sessionId = createUserSession(id);
  setSessionCookie(res, sessionId);
  res.status(201).json({ id, name, email, kind: "user" });
});

authRouter.post("/sign-in", (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any;
  if (!user || !verifyPassword(password ?? "", user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const sessionId = createUserSession(user.id);
  setSessionCookie(res, sessionId);
  res.json({ id: user.id, name: user.name, email: user.email, kind: "user" });
});

authRouter.post("/guest", (req, res) => {
  const { name, email, billingAddress } = req.body ?? {};
  if (!name || !email || !billingAddress) {
    return res.status(400).json({ error: "Name, email, and billing address are required." });
  }
  const sessionId = createGuestSession(name, email, billingAddress);
  setSessionCookie(res, sessionId);
  res.status(201).json({ name, email, billingAddress, kind: "guest" });
});

authRouter.post("/sign-out", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/session", (req, res) => {
  const identity = getIdentity(req);
  if (!identity) return res.json({ identity: null });
  res.json({
    identity: {
      kind: identity.ownerKind,
      name: identity.name,
      email: identity.email,
      billingAddress: identity.billingAddress ?? null,
    },
  });
});
