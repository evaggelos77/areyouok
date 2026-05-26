const express = require('express');

const { requireAuth } = require('../auth');
const { config } = require('../config');
const { getStripe } = require('../stripe');
const { updateUser, getUserById, getUserByStripeCustomerId } = require('../repo');
const { derivePlanFromSubscription, isPremiumActiveStatus, normalizeSubscriptionPlan } = require('../billing');

const stripeRouter = express.Router();

function stripeConfigured() {
  return Boolean(config.stripeSecretKey && config.stripeWebhookSecret);
}

async function ensureCustomer(stripe, user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: String(user.id) }
  });
  updateUser(user.id, { stripe_customer_id: customer.id });
  return customer.id;
}

function normalizePlan(plan) {
  return normalizeSubscriptionPlan(plan) === 'yearly' ? 'yearly' : 'monthly';
}

stripeRouter.get('/config', requireAuth, (req, res) => {
  res.json({
    stripeConfigured: Boolean(config.stripeSecretKey),
    priceIdMonthly: config.priceIdMonthly || null,
    priceIdYearly: config.priceIdYearly || null
  });
});

stripeRouter.post('/create-checkout-session', requireAuth, async (req, res) => {
  if (!config.stripeSecretKey) return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
  if (!config.priceIdMonthly || !config.priceIdYearly) {
    return res.status(500).json({ error: 'MISSING_PRICE_IDS' });
  }

  const plan = normalizePlan(req.body?.plan || 'monthly');
  const priceId = plan === 'yearly' ? config.priceIdYearly : config.priceIdMonthly;

  const stripe = getStripe();
  const customerId = await ensureCustomer(stripe, req.user);

  const base = config.publicBaseUrl.replace(/\/$/, '');
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: String(req.user.id),
    metadata: {
      userId: String(req.user.id),
      plan
    },
    subscription_data: {
      metadata: { userId: String(req.user.id), plan }
    },
    success_url: `${base}/settings?checkout=success`,
    cancel_url: `${base}/settings?checkout=cancel`
  });

  res.json({ url: session.url });
});

stripeRouter.post('/create-portal-session', requireAuth, async (req, res) => {
  if (!config.stripeSecretKey) return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const stripe = getStripe();

  const customerId = await ensureCustomer(stripe, req.user);
  const base = config.publicBaseUrl.replace(/\/$/, '');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/settings`
  });

  res.json({ url: session.url });
});

async function stripeWebhookHandler(req, res) {
  if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
    return res.status(500).send('Stripe not configured');
  }

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err) {
    req.log?.warn({ err: String(err) }, 'Stripe webhook signature verification failed');
    return res.status(400).send(`Webhook Error`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const userId = session.client_reference_id ? Number(session.client_reference_id) : null;

        let user = userId ? getUserById(userId) : null;
        if (!user && customerId) user = getUserByStripeCustomerId(String(customerId));
        if (!user) break;

        const patch = {
          premium: 1,
          subscription_plan: normalizePlan(session.metadata?.plan),
          plan_source: 'stripe',
          plan_interval: normalizePlan(session.metadata?.plan) === 'yearly' ? 'year' : 'month',
          stripe_customer_id: customerId ? String(customerId) : user.stripe_customer_id,
          stripe_subscription_id: subscriptionId ? String(subscriptionId) : user.stripe_subscription_id
        };

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(String(subscriptionId), {
            expand: ['items.data.price']
          });
          patch.subscription_plan = derivePlanFromSubscription(sub);
          patch.premium_current_period_end = sub.current_period_end ? sub.current_period_end * 1000 : null;
        }

        updateUser(user.id, patch);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;
        let user = customerId ? getUserByStripeCustomerId(String(customerId)) : null;
        if (!user && sub.metadata?.userId) user = getUserById(Number(sub.metadata.userId));
        if (!user) break;

        const premium = isPremiumActiveStatus(sub.status) ? 1 : 0;
        const subscriptionPlan = premium ? derivePlanFromSubscription(sub) : 'free';

        updateUser(user.id, {
          premium,
          subscription_plan: subscriptionPlan,
          plan_source: premium ? 'stripe' : 'free',
          plan_interval: premium ? (subscriptionPlan === 'yearly' ? 'year' : 'month') : 'free',
          stripe_customer_id: customerId ? String(customerId) : user.stripe_customer_id,
          stripe_subscription_id: sub.id ? String(sub.id) : user.stripe_subscription_id,
          premium_current_period_end: sub.current_period_end ? sub.current_period_end * 1000 : null
        });
        break;
      }

      case 'invoice.paid': {
        break;
      }

      default:
        break;
    }
  } catch (e) {
    req.log?.error({ err: String(e), type: event.type }, 'Stripe webhook handler error');
    return res.status(500).send('Webhook handler error');
  }

  res.json({ received: true });
}

module.exports = { stripeRouter, stripeWebhookHandler };
