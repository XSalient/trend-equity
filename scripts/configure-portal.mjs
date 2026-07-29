#!/usr/bin/env node

/**
 * Stripe Customer Portal configurator (TE-47)
 *
 * The portal's *behaviour* is configuration, not code: how a mid-cycle plan
 * change is billed and when it takes effect are properties of the portal
 * configuration object, not of anything we send at session-create time. Passing
 * `flow_data.subscription_update_confirm` opens the right screen; this decides
 * what that screen does.
 *
 * Run it once per Stripe environment (test and live) and re-run after changing
 * prices. It updates the account's default configuration in place, so existing
 * sessions and the "Manage billing" button pick the change up immediately.
 *
 *   node scripts/configure-portal.mjs            # apply
 *   node scripts/configure-portal.mjs --dry-run  # show the diff, change nothing
 *
 * Reads STRIPE_SECRET_KEY / STRIPE_PRICE_PRO / STRIPE_PRICE_BUILDER from .env
 * or the environment. Use the sk_live_… key to configure production.
 *
 * What it sets, and why (see docs/PAYMENTS.md for the transition matrix):
 *
 *   proration_behavior: 'always_invoice'
 *     Pro → Builder charges the net difference *today* rather than parking a
 *     credit on the next invoice. `create_prorations` (the Stripe default, and
 *     what this project shipped with) takes no payment at switch time, so the
 *     user upgrades for free until their renewal date.
 *
 *   schedule_at_period_end.conditions: [{ type: 'decreasing_item_amount' }]
 *     Builder → Pro is deferred to the period end. Without it Stripe applies
 *     the downgrade immediately and credits the difference — stripping features
 *     the user has already paid for.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

// Same loader shape as scripts/verify-stripe.mjs — .env first, real env wins
// when a var is absent there (Doppler / CI inject at the process level).
const env = {};
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
const readVar = (name) => process.env[name] || env[name];

const secretKey = readVar('STRIPE_SECRET_KEY');
const pricePro = readVar('STRIPE_PRICE_PRO');
const priceBuilder = readVar('STRIPE_PRICE_BUILDER');

console.log('\n⚙️  Stripe Customer Portal configurator (TE-47)\n');

const missing = [
  ['STRIPE_SECRET_KEY', secretKey],
  ['STRIPE_PRICE_PRO', pricePro],
  ['STRIPE_PRICE_BUILDER', priceBuilder],
].filter(([, value]) => !value);

if (missing.length) {
  console.error(`❌ Missing: ${missing.map(([name]) => name).join(', ')}\n`);
  process.exit(1);
}

const mode = secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST';
console.log(`   Mode: ${mode}`);
console.log(`   Pro price:     ${pricePro}`);
console.log(`   Builder price: ${priceBuilder}\n`);

const stripe = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' });

try {
  // Products are what the portal switches between; the price ids we hold have
  // to resolve to them, so read the product off each price rather than
  // guessing or hardcoding.
  const [proPrice, builderPrice] = await Promise.all([
    stripe.prices.retrieve(pricePro),
    stripe.prices.retrieve(priceBuilder),
  ]);

  const productFor = (price) =>
    typeof price.product === 'string' ? price.product : price.product?.id;

  const proProduct = productFor(proPrice);
  const builderProduct = productFor(builderPrice);

  if (!proProduct || !builderProduct) {
    console.error('❌ Could not resolve a product for one of the prices.\n');
    process.exit(1);
  }

  const features = {
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      // Never revoke time already paid for (docs/PAYMENTS.md).
      mode: 'at_period_end',
      proration_behavior: 'none',
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      products: [
        { product: proProduct, prices: [pricePro] },
        { product: builderProduct, prices: [priceBuilder] },
      ],
      // Upgrade: charge the net difference immediately.
      proration_behavior: 'always_invoice',
      // Downgrade: defer to the period end instead of stripping paid-for access.
      schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] },
    },
  };

  const existing = await stripe.billingPortal.configurations.list({ limit: 10 });
  const target = existing.data.find((config) => config.is_default) ?? existing.data[0] ?? null;

  if (target) {
    const current = target.features?.subscription_update;
    console.log('   Current subscription_update settings:');
    console.log(`     proration_behavior:    ${current?.proration_behavior ?? '(unset)'}`);
    console.log(
      `     schedule_at_period_end: ${
        JSON.stringify(current?.schedule_at_period_end?.conditions ?? []) || '[]'
      }\n`
    );
  } else {
    console.log('   No existing portal configuration — one will be created.\n');
  }

  if (dryRun) {
    console.log('   --dry-run: would apply');
    console.log('     proration_behavior:     always_invoice');
    console.log('     schedule_at_period_end: [decreasing_item_amount]');
    console.log('     subscription_cancel:    at_period_end\n');
    process.exit(0);
  }

  const result = target
    ? await stripe.billingPortal.configurations.update(target.id, { features })
    : await stripe.billingPortal.configurations.create({
        features,
        business_profile: { headline: 'Trend-Equity — manage your plan' },
      });

  console.log(`✅ Portal configuration ${target ? 'updated' : 'created'}: ${result.id}`);
  console.log('     proration_behavior:     always_invoice  (upgrade billed today)');
  console.log('     schedule_at_period_end: decreasing_item_amount  (downgrade at period end)');
  console.log('     subscription_cancel:    at_period_end\n');

  if (mode === 'TEST') {
    console.log('   ℹ️  This configured the TEST environment. Re-run with the sk_live_… key');
    console.log('      before relying on it in production.\n');
  }
} catch (error) {
  console.error(`\n❌ ${error.message}\n`);
  process.exit(1);
}
