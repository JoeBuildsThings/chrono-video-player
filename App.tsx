import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLibraryStore } from './src/store/useLibraryStore';
import { usePlayerStore } from './src/store/usePlayerStore';
import { LibraryScreen } from './src/ui/library/LibraryScreen';
import { VideoPlayerScreen } from './src/ui/player/VideoPlayerScreen';
import { THEME } from './src/core/constants/theme';

export default function App() {
  const initializeLibrary = useLibraryStore((s) => s.initializeLibrary);
  const activeVideo = usePlayerStore((s) => s.activeVideo);
  const isMinimized = usePlayerStore((s) => s.isMinimized);

  useEffect(() => {
    initializeLibrary();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" hidden={Boolean(activeVideo && !isMinimized)} />
        <View style={styles.root}>
          <LibraryScreen />
          {activeVideo && <VideoPlayerScreen />}
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.bgAbyss,
  },
});
