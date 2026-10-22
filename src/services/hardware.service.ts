import * as Brightness from 'expo-brightness';
import * as ScreenOrientation from 'expo-screen-orientation';

export const HardwareService = {
  async getBrightness(): Promise<number> {
    try {
      const val = await Brightness.getBrightnessAsync();
      return Math.max(0.05, Math.min(1, val));
    } catch {
      return 0.5;
    }
  },

  async setBrightness(value: number): Promise<number> {
    const clamped = Math.max(0.02, Math.min(1, value));
    try {
      await Brightness.setBrightnessAsync(clamped);
    } catch {
      // Fallback handled by screen software dimmer overlay in Player UI
    }
    return clamped;
  },

  async lockLandscape(): Promise<void> {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch {
      return;
    }
  },

  async lockPortrait(): Promise<void> {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      return;
    }
  },

  async unlockOrientation(): Promise<void> {
    try {
      await ScreenOrientation.unlockAsync();
    } catch {
      return;
    }
  },
};
