import { supabase } from '../supabaseClient';

interface ActivateSubscriptionParams {
  razorpayPaymentId: string;
  priceId: number | string;
  planType: 'monthly' | 'yearly';
}

export async function activateSubscriptionAfterPayment({
  razorpayPaymentId,
  priceId,
  planType,
}: ActivateSubscriptionParams) {
  const { data, error } = await supabase.functions.invoke('activate-subscription', {
    body: {
      razorpay_payment_id: razorpayPaymentId,
      price_id: typeof priceId === 'string' ? parseInt(priceId, 10) : priceId,
      plan_type: planType,
    },
  });

  if (error) {
    throw new Error(error.message || 'Subscription activation failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
