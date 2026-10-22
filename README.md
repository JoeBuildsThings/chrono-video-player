# Chrono Player

An Android video player that puts brightness, volume and seeking under your thumb.

![Build](https://github.com/JoeBuildsThings/chrono-video-player/actions/workflows/build-apk.yml/badge.svg)

Open videos from your phone or from a stream link, pick up exactly where you stopped, and load your own subtitles with timing you can adjust on the spot. No account, no ads, no tracking.

**[Download the latest APK and start watching](https://github.com/JoeBuildsThings/chrono-video-player/releases/latest)**

## Control playback with your thumb

* Swipe vertically to change brightness and volume, swipe horizontally to seek
* Double tap the left or right side to jump 10 seconds, double tap the middle to play or pause
* Pinch to zoom, and lock the screen so stray touches do nothing

## Find a video and resume it fast

* Your device videos are grouped into folders, with search and sorting
* Chrono Player remembers where you stopped in each video
* Paste any stream link to play it, and recent links are saved for next time

## Subtitles and speed that fit the video

* Load your own SRT or VTT file and shift the timing until the lines match the speech
* Play from 0.5x to 3x with pitch correction
* Set an A to B repeat to loop the part you are studying

## Privacy

Chrono Player has no accounts, no ads and no analytics.

Your watch history and settings stay on your device. When you open a stream link, your device connects to the host you chose to play it.

## Install

1. Open the [Releases page](https://github.com/JoeBuildsThings/chrono-video-player/releases/latest) and download the newest APK.
2. When Android asks, allow installs from your browser or file manager.
3. Open Chrono Player and grant access to your videos.

## Build from source

You need Node 22.13 or newer, JDK 17 and the Android SDK.

```bash
git clone https://github.com/JoeBuildsThings/chrono-video-player.git
cd chrono-video-player
npm install --legacy-peer-deps
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

Every push to `main` also runs the same build on GitHub Actions and publishes the APK to Releases.

## Built with

Expo, React Native, Zustand, React Native Reanimated and React Native Gesture Handler.

## Work in progress

* The equalizer and decoder mode controls exist in the interface, and the audio and decoder processing behind them is not connected yet
* Android is the supported platform for now

## License

Released under the [MIT License](LICENSE).

## Author

Built by Joe. More projects at [github.com/JoeBuildsThings](https://github.com/JoeBuildsThings).
