# Stripe Sandbox Setup Guide (TE-08)

## Problem

When upgrading plans, getting: **"Network error. Please try again."**

**Root cause:** Stripe price IDs not configured in environment variables.

---

## Setup Steps (5 minutes)

### Step 1: Access Stripe Dashboard

- Go to: https://dashboard.stripe.com/test/products
- Make sure you're in **Test Mode** (toggle at top-left)

### Step 2: Create Products (if not already created)

If you don't see "Pro" and "Builder" products, create them:

**Product 1 - Pro**

- Name: `Pro`
- Price: `$9.00 USD`
- Billing period: `Monthly`
- Click "Create product"

**Product 2 - Builder**

- Name: `Builder`
- Price: `$19.00 USD`
- Billing period: `Monthly`
- Click "Create product"

### Step 3: Get Price IDs

For each product, find the **Monthly price** section:

- Click into the product
- Look for the recurring monthly price row
- Copy the **Price ID** (format: `price_1xxx...`)

Example:

```
Pro:     price_1TwAlRIdBbgqt2Le0cZpHTeQ
Builder: price_1TwAlfIdBbgqt2LeUABAlTHP
```

### Step 4: Update Local .env

Add to your `.env` file:

```bash
# Stripe Test Mode Configuration
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_TEST_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY
STRIPE_PRICE_PRO=price_xxx...xxx
STRIPE_PRICE_BUILDER=price_yyy...yyy
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Where to find your keys:**

- Go to: https://dashboard.stripe.com/test/apikeys
- Copy **Publishable key** → `VITE_STRIPE_PUBLIC_KEY`
- Copy **Secret key** → `STRIPE_SECRET_KEY`

**Webhook secret:**

- Go to: https://dashboard.stripe.com/test/webhooks
- Create endpoint (if needed):
  - URL: `http://localhost:3001/api/webhook/stripe` (local) or your Vercel URL
  - Events: `checkout.session.completed`, `charge.succeeded`
  - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### Step 5: Restart Dev Server

```bash
npm run dev
```

Test the upgrade button → should redirect to Stripe checkout.

---

## Production Deployment (Vercel)

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Add environment variables
vercel env add STRIPE_PRICE_PRO
# Paste: price_xxx...
vercel env add STRIPE_PRICE_BUILDER
# Paste: price_yyy...
vercel env add STRIPE_SECRET_KEY
# Paste: sk_test_...
vercel env add VITE_STRIPE_PUBLIC_KEY
# Paste: pk_test_...

# Deploy
vercel deploy --prod
```

### Option B: Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add each variable for **Production** environment:
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_BUILDER`
   - `STRIPE_SECRET_KEY`
   - `VITE_STRIPE_PUBLIC_KEY`
5. Redeploy from Git or manually

### Option C: Check Current Vars

```bash
vercel env ls
```

---

## Testing

### Local Testing

1. Use Stripe **test card**: `4242 4242 4242 4242`
2. Any future expiry date, any CVC
3. Complete checkout flow

### Webhook Testing (Optional)

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

stripe listen --forward-to localhost:3001/api/webhook/stripe
```

---

## Troubleshooting

| Error                              | Solution                                       |
| ---------------------------------- | ---------------------------------------------- |
| "Network error. Please try again." | Run diagnostic, check STRIPE*PRICE*\* env vars |
| "No such price"                    | Price ID is invalid or doesn't exist in Stripe |
| "Invalid API key"                  | STRIPE_SECRET_KEY is wrong or missing          |
| Webhook not firing                 | Endpoint URL incorrect or signing secret wrong |

### Run Diagnostic

```bash
# Check which variables are set
grep STRIPE_ .env

# Verify Stripe keys work
# (requires curl/jq)
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_KEY:
```

---

## Live Mode Transition

When ready to accept real payments:

1. **Stripe Dashboard:** Switch to Live mode
2. **Create live products** with same setup
3. **Get live price IDs** (format: `price_1xxx...`)
4. **Update Vercel:** Replace with live keys:
   - `sk_live_...`
   - `pk_live_...`
5. **Test with live card** (small $1 charge)

---

## References

- [Stripe API Keys](https://dashboard.stripe.com/test/apikeys)
- [Stripe Products](https://dashboard.stripe.com/test/products)
- [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
- [Checkout Implementation](./api/checkout.ts)
