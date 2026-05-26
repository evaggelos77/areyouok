const { config } = require('./config');
const { getStripe } = require('./stripe');
const { updateUser } = require('./repo');

function normalizeSubscriptionPlan(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'yearly' || v === 'year' || v === 'annual') return 'yearly';
  if (v === 'monthly' || v === 'month') return 'monthly';
  return 'free';
}

function isPremiumActiveStatus(status) {
  return ['active', 'trialing', 'past_due'].includes(String(status || '').trim().toLowerCase());
}

function derivePlanFromSubscription(sub) {
  const metaPlan = normalizeSubscriptionPlan(sub?.metadata?.plan);
  if (metaPlan !== 'free') return metaPlan;

  const firstPrice = sub?.items?.data?.[0]?.price;
  const priceId = String(firstPrice?.id || '').trim();
  if (priceId && priceId === config.priceIdYearly) return 'yearly';
  if (priceId && priceId === config.priceIdMonthly) return 'monthly';

  const interval = String(firstPrice?.recurring?.interval || '').trim().toLowerCase();
  if (interval === 'year') return 'yearly';
  if (interval === 'month') return 'monthly';

  return 'free';
}

function isYearlyVoiceUnlocked(user) {
  return Number(user?.premium) === 1 && normalizeSubscriptionPlan(user?.subscription_plan) === 'yearly';
}

function planIntervalFromPlan(plan) {
  return normalizeSubscriptionPlan(plan) === 'yearly' ? 'year' : normalizeSubscriptionPlan(plan) === 'monthly' ? 'month' : 'free';
}

async function syncUserSubscriptionPlanIfNeeded(user, logger) {
  if (!user) return user;
  if (Number(user.premium) !== 1) return user;

  const plan = normalizeSubscriptionPlan(user.subscription_plan);
  if (plan !== 'free') return user;
  if (!config.stripeSecretKey || !user.stripe_subscription_id) return user;

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(String(user.stripe_subscription_id), {
      expand: ['items.data.price']
    });

    const premium = isPremiumActiveStatus(sub.status) ? 1 : 0;
    const nextPlan = premium ? derivePlanFromSubscription(sub) : 'free';

    return updateUser(user.id, {
      premium,
      subscription_plan: nextPlan,
      plan_source: premium ? 'stripe' : 'free',
      plan_interval: premium ? planIntervalFromPlan(nextPlan) : 'free',
      premium_current_period_end: sub.current_period_end ? sub.current_period_end * 1000 : null
    });
  } catch (err) {
    logger?.warn?.({ err: String(err), userId: user.id }, 'Failed to sync subscription plan from Stripe');
    return user;
  }
}

module.exports = {
  normalizeSubscriptionPlan,
  derivePlanFromSubscription,
  isPremiumActiveStatus,
  isYearlyVoiceUnlocked,
  syncUserSubscriptionPlanIfNeeded
};
