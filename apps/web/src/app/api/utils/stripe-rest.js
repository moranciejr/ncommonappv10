// Stripe utility stub
// Wire up real Stripe integration when billing is ready

export async function createCheckoutSession({ userId, priceId, successUrl, cancelUrl }) {
  throw new Error('Stripe not configured');
}

export async function getSubscriptionStatus({ userId }) {
  return { tier: 'free', status: 'inactive' };
}

export async function cancelSubscription({ subscriptionId }) {
  throw new Error('Stripe not configured');
}
