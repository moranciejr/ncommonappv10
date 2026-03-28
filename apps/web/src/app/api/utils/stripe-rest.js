// Stripe utility stubs — wire up real Stripe when billing is ready

export async function createCheckoutSession({ userId, priceId, successUrl, cancelUrl }) {
  throw new Error('Stripe not configured');
}

export async function getOrCreateCustomerByEmail({ email, userId }) {
  throw new Error('Stripe not configured');
}

export async function getOrCreatePriceForTier({ tier }) {
  throw new Error('Stripe not configured');
}

export async function getSubscriptionStatus({ userId }) {
  return { tier: 'free', status: 'inactive' };
}

export async function cancelSubscription({ subscriptionId }) {
  throw new Error('Stripe not configured');
}

export async function handleWebhook({ payload, signature }) {
  throw new Error('Stripe not configured');
}

export async function claimPromoCode({ userId, code }) {
  throw new Error('Stripe not configured');
}
