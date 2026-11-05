import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { DevMenuScreen } from '../screens/DevMenuScreen';

export default function DevMenuRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return <DevMenuScreen onBack={handleBack} />;
}
