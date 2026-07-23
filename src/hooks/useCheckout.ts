import { useState, useEffect } from 'react';

export function useCheckout() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStripeLoaded, setIsStripeLoaded] = useState(false);

  useEffect(() => {
    // Load Stripe.js
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      setIsStripeLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const openCheckout = () => {
    if (isStripeLoaded) {
      setIsModalOpen(true);
    }
  };

  const closeCheckout = () => {
    setIsModalOpen(false);
  };

  return {
    isModalOpen,
    openCheckout,
    closeCheckout,
    isStripeLoaded,
  };
}
