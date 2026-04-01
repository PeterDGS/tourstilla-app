import React from 'react';
import { Stack } from 'expo-router';

export default function GuideLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFF8E1' },
      }}
    />
  );
}
