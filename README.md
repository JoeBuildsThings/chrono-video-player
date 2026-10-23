# Chrono Player

A blue-glass Android video player built around reliable playback controls, private on-device media browsing, and subtitles you can tune while watching.

[Download the latest APK](https://github.com/JoeBuildsThings/chrono-video-player/releases/latest) · [Report a bug](https://github.com/JoeBuildsThings/chrono-video-player/issues)

## Playback

- Play and pause, accurate seeking, ten-second jumps, playback speed from 0.5x to 3x with pitch preservation, and volume/mute.
- Swipe horizontally to seek. Swipe vertically on the left to adjust screen brightness and on the right to adjust player volume.
- Double-tap the left/right side to jump back/forward ten seconds. Double-tap the centre to play or pause.
- Pinch to zoom, choose fit/fill/stretch or common aspect ratios, lock touch controls, and use the in-app mini-player or Android picture-in-picture when supported.
- Create an A-B loop to repeat a section and use a sleep timer to pause playback.
- Resume supported videos from saved progress, use the queue's previous/next controls, and keep audio active in the background when enabled.

## Your library

Browse device videos by folder or in one list. Search titles and folders, choose a sort order, refresh after adding files, or open a single video through Android's file picker. Play compatible HTTP/HTTPS media links, including HLS links where supported by the source and device. Unsupported links show a playback error rather than pretending they are supported.

## Subtitles

Import external SRT and VTT files from your device. Chrono parses cue timing and renders a synchronized overlay. Adjust subtitle timing in 250 ms steps, change text size, jump between cues, or select embedded subtitle tracks exposed by the video source.

## Privacy

No account, ads or analytics are required. The media library is scanned on device. Watch history and recent stream links are stored locally. Opening a network link connects your device to the host in that link.

## Build from source

You need Node.js 22.13 or newer, JDK 17 and the Android SDK.

    git clone https://github.com/JoeBuildsThings/chrono-video-player.git
    cd chrono-video-player
    npm install --legacy-peer-deps
    npx tsc --noEmit
    npx expo prebuild --platform android --clean
    cd android && ./gradlew assembleRelease

The GitHub Actions workflow type-checks, generates the native Android project, builds a release APK, and uploads it as an artifact. Pushes to the main branch also publish a GitHub Release APK.

## Known limits

- Android is the primary supported platform.
- Decoder-mode switching and audio equalizer processing are not exposed as controls because the current Expo playback engine does not implement those processing paths.
- Supported stream formats depend on Android's playback backend, server response and network access.

## License

MIT. See LICENSE.
