import crypto from "node:crypto";
import type { Request, Response } from "express";
import { db } from "../db.js";

// ---------------------------------------------------------------------------
// Minimal email/password + guest-session auth, backed by SQLite.
//
// This is written to be swapped 1:1 for a real provider (e.g. Better Auth)
// later: same responsibilities (hash + verify password, issue a session,
// read the current identity off a cookie), just implemented by hand so the
// whole flow is inspectable in one file for this reference project.
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "atlas_session";
const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export interface Identity {
  sessionId: string;
  ownerId: string;
  ownerKind: "user" | "guest";
  name: string;
  email: string;
  billingAddress?: string | null;
}

export function createUserSession(userId: string) {
  const id = newId("sess");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  db.prepare(
    `INSERT INTO sessions (id, user_id, is_guest, expires_at) VALUES (?, ?, 0, ?)`
  ).run(id, userId, expires.toISOString());
  return id;
}

export function createGuestSession(name?: string, email?: string, billingAddress?: string) {
  const id = newId("sess");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  db.prepare(
    `INSERT INTO sessions (id, is_guest, guest_name, guest_email, guest_billing_address, expires_at)
     VALUES (?, 1, ?, ?, ?, ?)`
  ).run(id, name ?? "", email ?? "", billingAddress ?? "", expires.toISOString());
  return id;
}

export function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 86400_000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getIdentity(req: Request): Identity | null {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) return null;

  const session = db
    .prepare(`SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`)
    .get(sessionId) as any;
  if (!session) return null;

  if (session.is_guest) {
    return {
      sessionId,
      ownerId: session.id,
      ownerKind: "guest",
      name: session.guest_name,
      email: session.guest_email,
      billingAddress: session.guest_billing_address,
    };
  }

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(session.user_id) as any;
  if (!user) return null;

  return {
    sessionId,
    ownerId: user.id,
    ownerKind: "user",
    name: user.name,
    email: user.email,
  };
}

export function requireIdentity(req: Request, res: Response): Identity | null {
  const identity = getIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Not signed in. Continue as guest or sign in first." });
    return null;
  }
  return identity;
}

export { newId };
