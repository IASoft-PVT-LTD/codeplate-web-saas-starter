'use client';
// Opens Paddle's checkout overlay for a plan. Paddle charges, handles tax,
// then sends a webhook; /api/paddle/webhook records the subscription.
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

/** `autoOpen`: open the checkout once Paddle has loaded (the plan picked on the pricing page). */
export function CheckoutButton({ priceId, email, userId, label, environment, token, autoOpen }: {
  priceId: string; email: string; userId: string; label: string; environment: 'sandbox' | 'production'; token: string; autoOpen?: boolean;
}) {
  const [paddle, setPaddle] = useState<Paddle>();
  const opened = useRef(false);
  useEffect(() => {
    initializePaddle({ environment, token }).then(setPaddle);
  }, [environment, token]);

  const open = (p: Paddle) => p.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: { email },
    // The webhook reads userId back from custom_data to know whose subscription it is.
    customData: { userId },
    settings: { successUrl: `${window.location.origin}/billing?success=1` },
  });

  useEffect(() => {
    if (autoOpen && paddle && !opened.current) {
      opened.current = true;
      open(paddle);
    }
  });

  return <Button className="w-full" disabled={!paddle} onClick={() => paddle && open(paddle)}>{label}</Button>;
}
