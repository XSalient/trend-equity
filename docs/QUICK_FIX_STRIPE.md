# Quick Fix: "Network error" on Upgrade

**TL;DR:** Your Stripe environment variables aren't configured.

## 🚀 Fix in 3 Minutes

### 1. Get Stripe Credentials

- Go to: https://dashboard.stripe.com/test/apikeys
- Copy your **Secret key** (starts with `sk_test_`)
- Copy your **Publishable key** (starts with `pk_test_`)

### 2. Get Price IDs

- Go to: https://dashboard.stripe.com/test/products
- Find "Pro" and "Builder" products
- For each, copy the **Price ID** of the monthly recurring price
- They look like: `price_1xxx...xxx`

### 3. Update `.env` File

Edit your `.env` and fill in:

```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PRICE_PRO=price_xxx...xxx
STRIPE_PRICE_BUILDER=price_yyy...yyy
```

### 4. Restart Server

```bash
npm run dev
```

✅ Done! Try the upgrade button again.

---

## For Production (Vercel)

Add these environment variables to Vercel:

```bash
vercel env add STRIPE_PRICE_PRO
# Paste your Pro price ID

vercel env add STRIPE_PRICE_BUILDER
# Paste your Builder price ID

vercel env add STRIPE_SECRET_KEY
# Paste your sk_test_ key

vercel env add VITE_STRIPE_PUBLIC_KEY
# Paste your pk_test_ key
```

Then redeploy:

```bash
vercel deploy --prod
```

---

## Need Help?

Run the verification script:

```bash
node scripts/verify-stripe.mjs
```

For full setup guide, see: [docs/STRIPE_SETUP.md](./STRIPE_SETUP.md)
