import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { LibraryScreen } from './src/ui/library/LibraryScreen';
import { VideoPlayerScreen } from './src/ui/player/VideoPlayerScreen';

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <LibraryScreen />
      <VideoPlayerScreen />
    </View>
  );
}
