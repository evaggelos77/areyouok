const path = require('path');
const dotenv = require('dotenv');
const Stripe = require('stripe');

dotenv.config({ path: path.join(__dirname, '../.env') });

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

async function main() {
  // Try to find existing product
  const products = await stripe.products.search({
    query: "name:'AYOK - Premium'",
    limit: 10
  });

  let product = products.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: 'AYOK - Premium',
      description: 'AreYouOK Premium subscription'
    });
  }

  // Create prices if missing
  // Monthly €3.99
  const existingPrices = await stripe.prices.list({ product: product.id, limit: 100 });

  const hasMonthly = existingPrices.data.find(
    (p) =>
      p.recurring?.interval === 'month' &&
      p.unit_amount === 399 &&
      p.currency === 'eur'
  );
  const hasYearly = existingPrices.data.find(
    (p) =>
      p.recurring?.interval === 'year' &&
      p.unit_amount === 2900 &&
      p.currency === 'eur'
  );

  const monthly =
    hasMonthly ||
    (await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      unit_amount: 399,
      recurring: { interval: 'month' },
      nickname: 'AYOK - Premium Monthly'
    }));

  const yearly =
    hasYearly ||
    (await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      unit_amount: 2900,
      recurring: { interval: 'year' },
      nickname: 'AYOK - Premium Yearly'
    }));

  console.log('\n✅ Stripe setup complete');
  console.log('Product:', product.id);
  console.log('PRICE_ID_MONTHLY=' + monthly.id);
  console.log('PRICE_ID_YEARLY=' + yearly.id);
  console.log('\n👉 Βάλ’ τα στο .env (PRICE_ID_MONTHLY / PRICE_ID_YEARLY)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
