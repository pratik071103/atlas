import "server-only";

import crypto from "node:crypto";
import { LICENSE_PRODUCT } from "@shared/catalog";
import { getCollections, newId, type LicenseDoc, type LicenseStatus } from "@/lib/db";
import { getDodoClient, SIMULATE_PAYMENTS } from "@/lib/dodo";

// ---------------------------------------------------------------------------
// License keys.
//
// Activation and validation go to Dodo's public license endpoints — the same
// ones a desktop app or CLI would call — so the flow in /studio is the real
// one, not a local approximation:
//
//   licenses.activate   { license_key, name }        → an instance id
//   licenses.validate   { license_key, instance_id } → { valid }
//   licenses.deactivate { license_key, instance_id } → frees the seat
//
// Keys themselves are issued by Dodo when the pass is paid for, and arrive on
// the license_key.created webhook. Offline there is nothing to issue them, so
// simulate mode mints one locally at checkout; the activate/validate calls
// then resolve against the stored row instead of the network. The rest of the
// app cannot tell the difference — `simulated` on the row is the only tell.
// ---------------------------------------------------------------------------

/** Name the activated instance is registered under in the Dodo dashboard. */
const INSTANCE_NAME = "Atlas Studio (web)";

export interface LicenseView {
  id: string;
  key: string;
  productName: string;
  status: LicenseStatus;
  instanceId: string | null;
  instanceName: string | null;
  simulated: boolean;
  activatedAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

function toView(doc: LicenseDoc): LicenseView {
  return {
    id: doc._id,
    // Only the tail is shown in the UI; the full key is what the customer
    // pastes, and they already have it.
    key: doc.key,
    productName: doc.productName,
    status: doc.status,
    instanceId: doc.instanceId,
    instanceName: doc.instanceName,
    simulated: doc.simulated,
    activatedAt: doc.activatedAt?.toISOString() ?? null,
    lastValidatedAt: doc.lastValidatedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export class LicenseError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "LicenseError";
  }
}

/** Formats bytes as a readable, Dodo-shaped key: XXXX-XXXX-XXXX-XXXX. */
function mintKey(): string {
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g)!.join("-");
}

export async function listLicenses(userId: string): Promise<LicenseView[]> {
  const c = await getCollections();
  const rows = await c.licenses.find({ userId }).sort({ createdAt: -1 }).toArray();
  return rows.map(toView);
}

/** True when this customer holds a license that is activated and valid. */
export async function hasActiveLicense(userId: string): Promise<boolean> {
  const c = await getCollections();
  return (await c.licenses.countDocuments({ userId, status: "active" }, { limit: 1 })) > 0;
}

async function upsertLicense(
  userId: string,
  key: string,
  productName: string,
  simulated: boolean
): Promise<LicenseView> {
  const c = await getCollections();
  const existing = await c.licenses.findOne({ key });
  if (existing) return toView(existing);

  const doc: LicenseDoc = {
    _id: newId("lic"),
    userId,
    key,
    productId: LICENSE_PRODUCT.id,
    productName,
    status: "issued",
    instanceId: null,
    instanceName: null,
    simulated,
    activatedAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
  };
  await c.licenses.insertOne(doc);
  return toView(doc);
}

/**
 * Mints a local key for a simulated purchase of the pass.
 *
 * Live, this is Dodo's job — see recordIssuedLicense below, called from the
 * license_key.created webhook.
 */
export async function issueSimulatedLicense(userId: string): Promise<LicenseView> {
  return upsertLicense(userId, mintKey(), LICENSE_PRODUCT.name, true);
}

/** Stores a key Dodo issued, keyed off the purchase the webhook resolved. */
export async function recordIssuedLicense(
  userId: string,
  key: string,
  productName = LICENSE_PRODUCT.name
): Promise<LicenseView> {
  return upsertLicense(userId, key, productName, false);
}

/**
 * Activates a key against this installation.
 *
 * A key the customer pastes may not be one we already know about — they could
 * have bought the pass in the Dodo storefront — so a successful activation
 * that has no local row creates one.
 */
export async function activateLicense(userId: string, rawKey: string): Promise<LicenseView> {
  const key = rawKey.trim().toUpperCase();
  if (!key) throw new LicenseError("Paste a license key first.", 400);

  const c = await getCollections();
  const existing = await c.licenses.findOne({ key });

  if (existing && existing.userId !== userId) {
    throw new LicenseError("That key is registered to another account.", 403);
  }
  if (existing?.status === "active") return toView(existing);

  let instanceId: string;
  let instanceName = INSTANCE_NAME;

  if (SIMULATE_PAYMENTS || existing?.simulated) {
    // Offline there is no Dodo record to activate against, so the stored row
    // *is* the authority — which also means an unknown key must be rejected
    // rather than silently accepted.
    if (!existing) {
      throw new LicenseError(
        "Unknown license key. In simulate mode, buy the Studio Pass to have one issued.",
        404
      );
    }
    instanceId = newId("inst");
  } else {
    try {
      const result = await getDodoClient().licenses.activate({
        license_key: key,
        name: INSTANCE_NAME,
      });
      instanceId = result.id;
      instanceName = result.name ?? INSTANCE_NAME;
    } catch (err) {
      console.error("[licenses] activation failed:", err);
      throw new LicenseError(
        "Dodo rejected that license key. Check it hasn't expired or used all its activations.",
        400
      );
    }
  }

  const now = new Date();
  if (!existing) {
    await upsertLicense(userId, key, LICENSE_PRODUCT.name, false);
  }

  const updated = await c.licenses.findOneAndUpdate(
    { key },
    {
      $set: {
        userId,
        status: "active" as LicenseStatus,
        instanceId,
        instanceName,
        activatedAt: now,
        lastValidatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) throw new LicenseError("Could not store the activated license.", 500);
  return toView(updated);
}

export interface ValidationResult {
  valid: boolean;
  license: LicenseView | null;
  message: string;
}

/**
 * Re-checks a key with Dodo. This is the call a real product would make on
 * every launch, and the reason the studio can re-blur without the customer
 * doing anything: a revoked or expired key stops validating.
 */
export async function validateLicense(userId: string, rawKey: string): Promise<ValidationResult> {
  const key = rawKey.trim().toUpperCase();
  const c = await getCollections();
  const existing = await c.licenses.findOne({ key, userId });

  if (!existing) {
    return { valid: false, license: null, message: "That key isn't on this account." };
  }

  let valid: boolean;
  if (SIMULATE_PAYMENTS || existing.simulated) {
    valid = existing.status === "active";
  } else {
    try {
      const result = await getDodoClient().licenses.validate({
        license_key: key,
        license_key_instance_id: existing.instanceId ?? undefined,
      });
      valid = result.valid;
    } catch (err) {
      console.error("[licenses] validation failed:", err);
      return {
        valid: false,
        license: toView(existing),
        message: "Dodo could not validate that key right now.",
      };
    }
  }

  const updated = await c.licenses.findOneAndUpdate(
    { key },
    {
      $set: {
        lastValidatedAt: new Date(),
        // A key that stops validating loses its unlock — the studio re-blurs
        // on the next load without the customer doing anything.
        status: (valid ? "active" : "expired") satisfies LicenseStatus,
      },
    },
    { returnDocument: "after" }
  );

  return {
    valid,
    license: updated ? toView(updated) : toView(existing),
    message: valid ? "Key is valid." : "Key is no longer valid.",
  };
}

/** Releases the activation, freeing the seat and re-blurring the gallery. */
export async function deactivateLicense(userId: string, rawKey: string): Promise<LicenseView> {
  const key = rawKey.trim().toUpperCase();
  const c = await getCollections();
  const existing = await c.licenses.findOne({ key, userId });
  if (!existing) throw new LicenseError("That key isn't on this account.", 404);

  if (!SIMULATE_PAYMENTS && !existing.simulated && existing.instanceId) {
    try {
      await getDodoClient().licenses.deactivate({
        license_key: key,
        license_key_instance_id: existing.instanceId,
      });
    } catch (err) {
      console.error("[licenses] deactivation failed:", err);
      throw new LicenseError("Dodo could not release that activation.", 502);
    }
  }

  const updated = await c.licenses.findOneAndUpdate(
    { key },
    {
      $set: {
        status: "deactivated" as LicenseStatus,
        instanceId: null,
        instanceName: null,
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) throw new LicenseError("Could not update the license.", 500);
  return toView(updated);
}
