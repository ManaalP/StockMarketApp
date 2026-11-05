import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';

export default function OrdersRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return <OrderHistoryScreen onBack={handleBack} />;
}
