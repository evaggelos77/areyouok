const Stripe = require('stripe');
const { config } = require('./config');

let stripe;

function getStripe() {
  if (!config.stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY not set');
  }
  if (!stripe) {
    stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2024-06-20'
    });
  }
  return stripe;
}

module.exports = { getStripe };
