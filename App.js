import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import each weight from its own path so only these five fonts are bundled.
import { Baloo2_600SemiBold } from '@expo-google-fonts/baloo-2/600SemiBold';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { bootstrap } from './src/app/bootstrap';
import { messageOf } from './src/utils/errors';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import { Button, T } from './src/components/Primitives';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDbError('');
    bootstrap()
      .then(() => !cancelled && setDbReady(true))
      .catch((error) => !cancelled && setDbError(messageOf(error)));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const ready = (fontsLoaded || fontError) && (dbReady || dbError);
  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={styles.root} onLayout={onLayout}>
        <StatusBar style="dark" />
        {dbError ? (
          <View style={styles.fatal}>
            <T variant="h2">EaseAT could not open its data</T>
            <T variant="small" style={{ textAlign: 'center', marginVertical: 10 }}>
              {dbError}
            </T>
            <Button title="Try again" variant="primary" onPress={() => setAttempt((n) => n + 1)} />
          </View>
        ) : (
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  fatal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
