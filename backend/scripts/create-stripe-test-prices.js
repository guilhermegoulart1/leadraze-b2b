// backend/scripts/create-stripe-test-prices.js
// Script para criar produtos e preços no Stripe TEST MODE
// Isso resolve o erro de "price exists in live mode, but test mode key was used"

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Check if we're in test mode
const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');

async function createTestPrices() {
  console.log('\n========================================');
  console.log('Creating Stripe Prices for Test Mode');
  console.log('========================================\n');

  if (!isTestMode) {
    console.log('⚠️  WARNING: You are using a LIVE mode key!');
    console.log('   This script should only be run with TEST mode keys.\n');
    process.exit(1);
  }

  console.log('✅ Using TEST mode key\n');

  const newPriceIds = {};

  try {
    // 1. Create Base Plan Product and Price
    console.log('Creating Base Plan...');
    const baseProduct = await stripe.products.create({
      name: 'GetRaze Base Plan',
      description: '1 channel, 2 users, 200 Google Maps credits/month',
      metadata: { plan_type: 'base' }
    });
    const basePrice = await stripe.prices.create({
      product: baseProduct.id,
      unit_amount: 5500, // $55.00
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { plan_type: 'base' }
    });
    newPriceIds.STRIPE_PRICE_BASE_MONTHLY = basePrice.id;
    console.log(`  ✅ Base Plan: ${basePrice.id}`);

    // 2. Create Extra Channel Add-on
    console.log('Creating Extra Channel Add-on...');
    const channelProduct = await stripe.products.create({
      name: 'Extra Channel',
      description: 'Additional communication channel (+$27/month)',
      metadata: { addon_type: 'channel' }
    });
    const channelPrice = await stripe.prices.create({
      product: channelProduct.id,
      unit_amount: 2700, // $27.00
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { addon_type: 'channel' }
    });
    newPriceIds.STRIPE_PRICE_CHANNEL_EXTRA = channelPrice.id;
    console.log(`  ✅ Extra Channel: ${channelPrice.id}`);

    // 3. Create Extra User Add-on
    console.log('Creating Extra User Add-on...');
    const userProduct = await stripe.products.create({
      name: 'Extra User',
      description: 'Additional team member (+$3/month)',
      metadata: { addon_type: 'user' }
    });
    const userPrice = await stripe.prices.create({
      product: userProduct.id,
      unit_amount: 300, // $3.00
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { addon_type: 'user' }
    });
    newPriceIds.STRIPE_PRICE_USER_EXTRA = userPrice.id;
    console.log(`  ✅ Extra User: ${userPrice.id}`);

    // 4. Create Credit Packages (one-time)
    const creditPackages = [
      { name: '500 Google Maps Credits', credits: 500, amount: 900, slug: 'credits-500' },
      { name: '1,000 Google Maps Credits', credits: 1000, amount: 1700, slug: 'credits-1000' },
      { name: '2,500 Google Maps Credits', credits: 2500, amount: 3900, slug: 'credits-2500' },
      { name: '5,000 Google Maps Credits', credits: 5000, amount: 5500, slug: 'credits-5000' },
    ];

    for (const pkg of creditPackages) {
      console.log(`Creating ${pkg.name}...`);
      const product = await stripe.products.create({
        name: pkg.name,
        description: `${pkg.credits} Google Maps credits (1 lead = 1 credit) - never expire`,
        metadata: { credit_type: 'gmaps', credits: pkg.credits.toString() }
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: pkg.amount,
        currency: 'usd',
        metadata: { credit_type: 'gmaps', credits: pkg.credits.toString() }
      });
      const envKey = `STRIPE_PRICE_CREDITS_${pkg.credits}`;
      newPriceIds[envKey] = price.id;
      console.log(`  ✅ ${pkg.name}: ${price.id}`);
    }

    // Output new .env values
    console.log('\n========================================');
    console.log('SUCCESS! Update your .env file with:');
    console.log('========================================\n');
    console.log('# Stripe Price IDs (Test Mode) - USD');
    for (const [key, value] of Object.entries(newPriceIds)) {
      console.log(`${key}=${value}`);
    }
    console.log('\n========================================\n');

  } catch (error) {
    console.error('\n❌ Error creating prices:', error.message);
    process.exit(1);
  }
}

createTestPrices();
