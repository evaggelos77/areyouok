const { syncUserSubscriptionPlanIfNeeded, normalizeSubscriptionPlan } = require('./billing');
const { updateUser, getUsageSummaryLast24h } = require('./repo');

const FREE_LIMITS = Object.freeze({
  checks_per_hour: 3,
  trusted_contacts_limit: 2,
  safewalk_limit: 2,
  checkin_schedules_limit: 0
});

const PREMIUM_LIMITS = Object.freeze({
  checks_per_hour: 12,
  trusted_contacts_limit: 5,
  safewalk_limit: 12,
  checkin_schedules_limit: 10
});

function normalizePlanSource(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'trial') return 'trial';
  if (v === 'stripe') return 'stripe';
  return 'free';
}

function normalizePlanInterval(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'year' || v === 'yearly' || v === 'annual') return 'year';
  if (v === 'month' || v === 'monthly') return 'month';
  return 'free';
}

function getBillingStateFromUser(user, now = Date.now()) {
  const trialUsed = Number(user?.trial_used) === 1 || user?.trial_used === true;
  const trialExpiresAtRaw = Number(user?.trial_expires_at);
  const trialExpiresAt = Number.isFinite(trialExpiresAtRaw) && trialExpiresAtRaw > 0 ? trialExpiresAtRaw : null;

  const stripePlan = Number(user?.premium) === 1 ? normalizeSubscriptionPlan(user?.subscription_plan) : 'free';
  const legacyStripeActive = stripePlan !== 'free';

  if (legacyStripeActive) {
    return {
      is_premium: true,
      plan_source: 'stripe',
      plan_interval: stripePlan === 'yearly' ? 'year' : 'month',
      trial_used: trialUsed,
      trial_expires_at: trialExpiresAt,
      trial_remaining_ms: 0,
      trial_expired: false,
      premium_until: Number(user?.premium_current_period_end) || null,
      voice_keywords_enabled: stripePlan === 'yearly'
    };
  }

  const planSource = normalizePlanSource(user?.plan_source);
  const planInterval = normalizePlanInterval(user?.plan_interval);

  if (planSource === 'trial' && trialExpiresAt && trialExpiresAt > now) {
    return {
      is_premium: true,
      plan_source: 'trial',
      plan_interval: 'month',
      trial_used: true,
      trial_expires_at: trialExpiresAt,
      trial_remaining_ms: Math.max(0, trialExpiresAt - now),
      trial_expired: false,
      premium_until: trialExpiresAt,
      voice_keywords_enabled: false
    };
  }

  const trialExpired = Boolean(trialUsed && trialExpiresAt && trialExpiresAt <= now);

  return {
    is_premium: false,
    plan_source: 'free',
    plan_interval: 'free',
    trial_used: trialUsed,
    trial_expires_at: trialExpiresAt,
    trial_remaining_ms: 0,
    trial_expired: trialExpired,
    premium_until: null,
    voice_keywords_enabled: false,
    stored_plan_source: planSource,
    stored_plan_interval: planInterval
  };
}

function getLimitsForState(state) {
  return state.is_premium ? PREMIUM_LIMITS : FREE_LIMITS;
}

function getEntitlementsFromUser(user, usage = null, now = Date.now()) {
  const state = getBillingStateFromUser(user, now);
  const limits = getLimitsForState(state);
  const safeUsage = usage || {
    checks_sent_last_24h: 0,
    safewalk_sessions_last_24h: 0,
    alerts_sent_last_24h: 0,
    trusted_people_notified_last_24h: 0
  };

  return {
    is_premium: state.is_premium,
    plan_source: state.plan_source,
    plan_interval: state.plan_interval,
    trial_used: state.trial_used,
    trial_expires_at: state.trial_expires_at,
    trial_remaining_ms: state.trial_remaining_ms,
    trial_expired: state.trial_expired,
    premium_until: state.premium_until,
    voice_keywords_enabled: state.voice_keywords_enabled,
    limits: {
      checks_per_hour: limits.checks_per_hour,
      trusted_contacts_limit: limits.trusted_contacts_limit,
      safewalk_limit: limits.safewalk_limit,
      checkin_schedules_limit: limits.checkin_schedules_limit
    },
    usage: safeUsage
  };
}

function getEffectiveCheckinsPerHour(user) {
  const entitlements = getEntitlementsFromUser(user);
  const requested = Number(user?.max_checkins_per_hour);
  const fallback = entitlements.is_premium ? PREMIUM_LIMITS.checks_per_hour : FREE_LIMITS.checks_per_hour;
  const sanitized = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : fallback;
  return Math.max(1, Math.min(sanitized, entitlements.limits.checks_per_hour));
}

function isVoiceKeywordsEnabled(user) {
  return getEntitlementsFromUser(user).voice_keywords_enabled;
}

async function getFreshUserWithEntitlements(user, logger) {
  if (!user) return { user: null, entitlements: null };

  let freshUser = await syncUserSubscriptionPlanIfNeeded(user, logger);
  const state = getBillingStateFromUser(freshUser);
  const patch = {};

  if (normalizePlanSource(freshUser.plan_source) !== state.plan_source) {
    patch.plan_source = state.plan_source;
  }
  if (normalizePlanInterval(freshUser.plan_interval) !== state.plan_interval) {
    patch.plan_interval = state.plan_interval;
  }

  if (!state.is_premium && Number(freshUser.premium) !== 1 && normalizeSubscriptionPlan(freshUser.subscription_plan) !== 'free') {
    patch.subscription_plan = 'free';
  }

  if (!state.is_premium && state.trial_expired) {
    patch.premium_current_period_end = null;
  }

  if (Object.keys(patch).length > 0) {
    freshUser = updateUser(freshUser.id, patch);
  }

  const usage = getUsageSummaryLast24h(freshUser.id);
  return {
    user: freshUser,
    entitlements: getEntitlementsFromUser(freshUser, usage)
  };
}

module.exports = {
  FREE_LIMITS,
  PREMIUM_LIMITS,
  normalizePlanSource,
  normalizePlanInterval,
  getBillingStateFromUser,
  getEntitlementsFromUser,
  getEffectiveCheckinsPerHour,
  isVoiceKeywordsEnabled,
  getFreshUserWithEntitlements
};
