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
let env = {};
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
  .catch((error) => {
    console.error(`❌ Error: ${error.message}\n`);

    if (error.message.includes('Invalid API key')) {
      console.log('Fix: Check your STRIPE_SECRET_KEY is correct');
      console.log('   • Should start with: sk_test_');
      console.log('   • Get it from: https://dashboard.stripe.com/test/apikeys\n');
    }

    process.exit(1);
  });
