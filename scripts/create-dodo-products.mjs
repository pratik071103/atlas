import fs from "node:fs";
import DodoPayments from "dodopayments";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

if (!process.env.DODO_API_KEY) {
  throw new Error("DODO_API_KEY is missing from .env");
}

const client = new DodoPayments({
  bearerToken: process.env.DODO_API_KEY,
  environment: process.env.DODO_MODE || "test_mode",
});

const products = [
  {
    tierId: "prompt-pack-5",
    name: "Atlas Studio - 5-Credit Image Pack",
    description: "One-time bundle of 5 image-generation credits.",
    price: oneTime(900),
  },
  {
    tierId: "starter",
    name: "Atlas Studio - Starter",
    description: "Monthly starter subscription with 25 plan credits.",
    price: recurring(1000),
  },
  {
    tierId: "standard",
    name: "Atlas Studio - Standard",
    description: "Monthly standard subscription with 80 plan credits.",
    price: recurring(2400),
  },
  {
    tierId: "pro",
    name: "Atlas Studio - Pro",
    description: "Monthly pro subscription with 200 plan credits.",
    price: recurring(4900),
  },
  {
    tierId: "usage-metered",
    name: "Atlas Studio - AI Image Generation",
    description: "Usage-based image generation authorization.",
    price: recurring(40),
  },
  {
    tierId: "seat-monthly",
    name: "Atlas Studio - Extra Seat",
    description: "Monthly teammate seat add-on.",
    price: recurring(800),
  },
  {
    tierId: "topup-100",
    name: "Atlas Studio - 100 Credit Top-Up",
    description: "One-time 100 credit top-up.",
    price: oneTime(1000),
  },
  {
    tierId: "topup-500",
    name: "Atlas Studio - 500 Credit Top-Up",
    description: "One-time 500 credit top-up.",
    price: oneTime(4000),
  },
];

const existing = [];
for await (const product of client.products.list({ per_page: 100 })) {
  existing.push(product);
}

const ids = {};
for (const spec of products) {
  const found = existing.find((product) => product.metadata?.atlasTierId === spec.tierId);
  const product =
    found ??
    (await client.products.create({
      name: spec.name,
      description: spec.description,
      tax_category: "saas",
      price: spec.price,
      metadata: { atlasTierId: spec.tierId, atlasDemo: "true" },
    }));

  ids[spec.tierId] = product.product_id;
  console.log(`${found ? "reused" : "created"} ${spec.tierId}: ${product.product_id}`);
}

let licenseEntitlement = existing
  .flatMap((product) => product.entitlements ?? [])
  .find((entitlement) => entitlement.integration_type === "license_key")?.id;

if (!licenseEntitlement) {
  const entitlement = await client.entitlements.create({
    name: "Atlas Studio Pass License",
    description: "Unlocks the premium Atlas Studio gallery.",
    integration_type: "license_key",
    integration_config: {
      activation_message: "Atlas Studio Pass activated.",
      activations_limit: 1,
      fulfillment_mode: "auto",
    },
    metadata: { atlasTierId: "studio-pass-lifetime", atlasDemo: "true" },
  });
  licenseEntitlement = entitlement.id;
  console.log(`created license entitlement: ${licenseEntitlement}`);
} else {
  console.log(`reused license entitlement: ${licenseEntitlement}`);
}

const existingLicenseProduct = existing.find(
  (product) => product.metadata?.atlasTierId === "studio-pass-lifetime"
);
const licenseProduct =
  existingLicenseProduct ??
  (await client.products.create({
    name: "Atlas Studio - Lifetime Studio Pass",
    description: "One-time license key that unlocks the premium gallery.",
    tax_category: "saas",
    price: oneTime(2900),
    entitlements: [{ entitlement_id: licenseEntitlement }],
    metadata: { atlasTierId: "studio-pass-lifetime", atlasDemo: "true" },
  }));

ids["studio-pass-lifetime"] = licenseProduct.product_id;
console.log(
  `${existingLicenseProduct ? "reused" : "created"} studio-pass-lifetime: ${licenseProduct.product_id}`
);

fs.writeFileSync("scripts/dodo-product-ids.json", `${JSON.stringify(ids, null, 2)}\n`);

function oneTime(price) {
  return {
    type: "one_time_price",
    currency: "USD",
    price,
    discount: 0,
    purchasing_power_parity: false,
    tax_inclusive: false,
  };
}

function recurring(price) {
  return {
    type: "recurring_price",
    currency: "USD",
    price,
    discount: 0,
    purchasing_power_parity: false,
    payment_frequency_count: 1,
    payment_frequency_interval: "Month",
    subscription_period_count: 1,
    subscription_period_interval: "Month",
    trial_period_days: 0,
    tax_inclusive: false,
  };
}
