# AreYouOK – deploy notes for this patch

## 1) Subscription plans
- Monthly: `€3.99 / month`
- Yearly: `€29 / year`
- The **Yearly** plan unlocks **Voice Help (keyword trigger)**.

## 2) SMTP variables required for production OTP email
Set these in `server/.env`:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="AreYouOK <no-reply@your-domain.com>"
SMTP_REPLY_TO=support@your-domain.com
```

Optional (development only):

```env
ALLOW_DEV_OTP_FALLBACK=1
```

Keep `ALLOW_DEV_OTP_FALLBACK=0` (or unset) in production.

## 3) Stripe variables required for subscriptions
```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PRICE_ID_MONTHLY=
PRICE_ID_YEARLY=
PUBLIC_BASE_URL=https://your-domain.com
```

## 4) Notes
- OTP fallback is now **disabled in production** unless you explicitly enable `ALLOW_DEV_OTP_FALLBACK` in development.
- If SMTP is not configured correctly, `POST /api/auth/request-otp` returns a 503 error instead of pretending the email was sent.
- Existing premium users with a missing stored plan are synced from Stripe the next time `/api/auth/me` is called (if `STRIPE_SECRET_KEY` and `stripe_subscription_id` are present).


## 5) FULL ZIP structure
This package includes:
- `client/`
- `client/dist/` (built SPA output)
- `server/`
- root `package.json` with workspaces

Typical flow:
```bash
npm install
npm run build
npm start
```

## 6) SOS recorded audio message
- In **SOS**, users can enable **"Send audio too"**
- Duration presets: `10s / 20s / 30s / 60s / Stop when finished`
- Recommended hard max: **60s** for fast upload / delivery
- The SOS alert is sent immediately; the recorded clip uploads afterwards and appears in **Trusted People** as tap-to-play audio
