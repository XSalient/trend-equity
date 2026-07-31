#!/usr/bin/env node

/**
 * Stripe Configuration Verifier
 *
 * This script checks your Stripe configuration and fetches real price IDs
 * Usage: node scripts/verify-stripe.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

console.log('\n📋 Stripe Configuration Verifier\n');

// Load .env
const env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const secretKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const priceProId = env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_PRO;
const priceBuilderPriceId = env.STRIPE_PRICE_BUILDER || process.env.STRIPE_PRICE_BUILDER;

console.log('1️⃣  Configuration Status:');
console.log(`   STRIPE_SECRET_KEY: ${secretKey ? '✓' : '✗'}`);
console.log(`   STRIPE_PRICE_PRO: ${priceProId ? '✓' : '✗'}`);
console.log(`   STRIPE_PRICE_BUILDER: ${priceBuilderPriceId ? '✓' : '✗'}`);

if (!secretKey) {
  console.log('\n❌ Missing STRIPE_SECRET_KEY. Cannot proceed.\n');
  console.log('📖 Setup Instructions:');
  console.log('   1. Go to https://dashboard.stripe.com/test/apikeys');
  console.log('   2. Copy your Secret key (sk_test_...)');
  console.log('   3. Add to .env: STRIPE_SECRET_KEY=sk_test_...\n');
  process.exit(1);
}

console.log(`\n2️⃣  Verifying Stripe Connection...`);

// Build basic auth header
const auth = Buffer.from(`${secretKey}:`).toString('base64');

// Fetch products from Stripe
fetch('https://api.stripe.com/v1/products', {
  headers: {
    Authorization: `Basic ${auth}`,
  },
})
  .then((res) => {
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid API key (401)');
      }
      throw new Error(`Stripe API error: ${res.status}`);
    }
    return res.json();
  })
  .then((data) => {
    const products = data.data || [];

    console.log(`   ✓ Connected to Stripe (found ${products.length} products)\n`);

    if (products.length === 0) {
      console.log('⚠️  No products found. Create them in Stripe Dashboard:\n');
      console.log('   1. Go to https://dashboard.stripe.com/test/products');
      console.log('   2. Create "Pro" product ($9/month recurring)\n');
      console.log('   3. Create "Builder" product ($19/month recurring)\n');
      process.exit(0);
    }

    console.log('3️⃣  Found Products & Prices:');
    console.log('');

    products.forEach((product) => {
      if (
        ['pro', 'Pro', 'builder', 'Builder'].some((t) =>
          product.name.toLowerCase().includes(t.toLowerCase())
        )
      ) {
        console.log(`   📦 ${product.name}`);
        console.log(`      Product ID: ${product.id}`);

        if (product.default_price) {
          console.log(`      Price ID: ${product.default_price}`);
          console.log('      ✓ Copy this Price ID to your .env\n');
        }
      }
    });

    console.log('4️⃣  Update your .env:');
    console.log('');
    const proProd = products.find((p) => p.name.toLowerCase().includes('pro'));
    const builderProd = products.find((p) => p.name.toLowerCase().includes('builder'));

    if (proProd && builderProd) {
      console.log(`   STRIPE_PRICE_PRO=${proProd.default_price}`);
      console.log(`   STRIPE_PRICE_BUILDER=${builderProd.default_price}`);
      console.log('');
      console.log('5️⃣  Restart dev server:');
      console.log('   npm run dev');
    }

    console.log('');
  })
  .then(verifyConfiguredPrices)
  .then(verifyPortalConfiguration)
  .catch((error) => {
    console.error(`❌ Error: ${error.message}\n`);

    if (error.message.includes('Invalid API key')) {
      console.log('Fix: Check your STRIPE_SECRET_KEY is correct');
      console.log('   • Should start with: sk_test_');
      console.log('   • Get it from: https://dashboard.stripe.com/test/apikeys\n');
    }

    process.exit(1);
  });

/**
 * TE-60: the script printed the price ids it *suggests* and never looked at the
 * ones actually configured. A deployment where `STRIPE_PRICE_BUILDER` held the
 * Pro price id passed this cleanly while Checkout sold Builder for $9 and every
 * pro→builder portal flow was refused by Stripe with "there are no changes to
 * confirm" — the failure that reached production as a dead UPGRADE NOW button.
 *
 * So: resolve both configured ids against Stripe, and require them to be live,
 * recurring, and genuinely different prices on different products.
 */
function verifyConfiguredPrices() {
  console.log('6️⃣  Configured price ids:');

  if (!priceProId || !priceBuilderPriceId) {
    return fail(
      [
        !priceProId && 'STRIPE_PRICE_PRO is not set',
        !priceBuilderPriceId && 'STRIPE_PRICE_BUILDER is not set',
      ].filter(Boolean),
      'Price configuration is incomplete',
      'Copy each tier’s own monthly price id from the Stripe dashboard into .env / Doppler.'
    );
  }

  const fetchPrice = (id) =>
    fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Basic ${auth}` },
    }).then((res) => (res.ok ? res.json() : null));

  return Promise.all([fetchPrice(priceProId), fetchPrice(priceBuilderPriceId)]).then(
    ([pro, builder]) => {
      const problems = [];
      const describe = (label, id, price) => {
        if (!price) {
          console.log(`   ✗ ${label}: ${id} — not found in this Stripe environment`);
          problems.push(`${label} (${id}) does not exist here — test and live ids are not shared`);
          return;
        }
        const amount = price.unit_amount != null ? (price.unit_amount / 100).toFixed(2) : '?';
        const interval = price.recurring?.interval ?? 'one-off';
        console.log(
          `   ${price.active && price.recurring ? '✓' : '✗'} ${label}: ${id} — ` +
            `${amount} ${(price.currency ?? '').toUpperCase()} / ${interval} (product ${price.product})`
        );
        if (!price.active) problems.push(`${label} (${id}) is archived`);
        if (!price.recurring)
          problems.push(`${label} (${id}) is a one-off price, not a subscription`);
      };

      describe('STRIPE_PRICE_PRO', priceProId, pro);
      describe('STRIPE_PRICE_BUILDER', priceBuilderPriceId, builder);

      if (priceProId === priceBuilderPriceId) {
        problems.push(
          'both tiers point at the SAME price — Builder would be sold at Pro’s amount and ' +
            'pro→builder plan switches are refused by Stripe ("no changes to confirm")'
        );
      } else if (pro && builder && pro.product === builder.product) {
        problems.push(
          `Pro and Builder are two prices on the same product (${pro.product}) — the portal ` +
            'plan switcher lists one entry per product, so the other tier is unreachable'
        );
      }

      console.log('');
      return problems.length
        ? fail(
            problems,
            'Price configuration is wrong',
            'Fix STRIPE_PRICE_PRO / STRIPE_PRICE_BUILDER, then re-run `npm run stripe:configure-portal`.'
          )
        : undefined;
    }
  );
}

/**
 * TE-48: keys and prices were the only things this script checked, so an
 * account where `npm run stripe:configure-portal` had never been run passed it
 * cleanly — and every pro→builder upgrade then 500'd, because Stripe refuses a
 * `subscription_update_confirm` session while that feature is disabled. Cancel
 * and "Manage billing" keep working, which is what disguises it as a bug in
 * the upgrade button.
 *
 * `subscription_update.products` is deliberately not asserted: the current API
 * version accepts the allowlist on write but does not return it, so checking
 * it would fail against a correctly configured account.
 */
function verifyPortalConfiguration() {
  console.log('7️⃣  Customer Portal configuration:');

  return fetch('https://api.stripe.com/v1/billing_portal/configurations?limit=10', {
    headers: { Authorization: `Basic ${auth}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Stripe API error: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const configs = data.data || [];
      const config = configs.find((c) => c.is_default) || configs[0];

      if (!config) {
        console.log('   ✗ No portal configuration exists\n');
        return fail(['the account has no Customer Portal configuration at all']);
      }

      const update = config.features?.subscription_update || {};
      const deferred = (update.schedule_at_period_end?.conditions || []).some(
        (c) => c.type === 'decreasing_item_amount'
      );
      const cancelEnabled = config.features?.subscription_cancel?.enabled;

      const mark = (ok) => (ok ? '✓' : '✗');
      console.log(`   ${config.id}${config.is_default ? ' (default)' : ''}`);
      console.log(`   ${mark(update.enabled)} plan switching enabled: ${!!update.enabled}`);
      console.log(
        `   ${mark(update.proration_behavior === 'always_invoice')} proration_behavior: ${
          update.proration_behavior || '(unset)'
        }`
      );
      console.log(`   ${mark(deferred)} period-end downgrade: ${deferred}`);
      console.log(`   ${mark(cancelEnabled)} cancellation enabled: ${!!cancelEnabled}\n`);

      const problems = [];
      if (!update.enabled) {
        problems.push('plan switching is OFF — every pro↔builder change fails with a 503');
      }
      if (update.proration_behavior !== 'always_invoice') {
        problems.push(
          `proration_behavior is "${update.proration_behavior || 'unset'}" — pro→builder takes no payment until the next invoice`
        );
      }
      if (!deferred) {
        problems.push(
          'schedule_at_period_end is unset — builder→pro strips paid-for access immediately'
        );
      }
      if (!cancelEnabled) {
        problems.push('cancellation is OFF — "Downgrade to Free" cannot complete');
      }

      return problems.length
        ? fail(problems)
        : console.log('   ✓ Portal is correctly configured\n');
    });
}

function fail(
  problems,
  title = 'Customer Portal is misconfigured',
  fix = 'Fix: npm run stripe:configure-portal'
) {
  console.log(`❌ ${title}:\n`);
  problems.forEach((p) => console.log(`   • ${p}`));
  console.log(`\n   ${fix}`);
  console.log('   Test and live are separate Stripe environments — check each.\n');
  process.exit(1);
}
