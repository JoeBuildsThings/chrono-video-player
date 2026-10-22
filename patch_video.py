import re

filepath = 'src/ui/player/VideoPlayerScreen.tsx'
with open(filepath, 'r') as f:
    content = f.read()

content = content.replace(
    "import { Audio, ResizeMode, Video, AVPlaybackStatus } from 'expo-av';",
    "import { useVideoPlayer, VideoView } from 'expo-video';"
)

content = content.replace("const videoRef = useRef<Video | null>(null);", "")

player_hook = """
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    const sub = player.addListener('playingChange', (payload) => {
      setIsPlaying(payload.isPlaying);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    const sub = player.addListener('timeUpdate', (payload) => {
      setPositionMs(payload.currentTime * 1000);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (isPlaying) player.play(); else player.pause();
  }, [isPlaying, player]);
"""

content = content.replace("const [isPlaying, setIsPlaying] = useState(false);", "const [isPlaying, setIsPlaying] = useState(false);\n" + player_hook)

content = content.replace("videoRef.current.pauseAsync()", "player.pause()")
content = content.replace("videoRef.current.playAsync()", "player.play()")
content = re.sub(r'videoRef\.current\.setPositionAsync\(([^)]+)\)', r'(player.currentTime = \1 / 1000)', content)

content = re.sub(r'<Video[\s\S]*?\/>', '''<VideoView
        player={player}
        style={style}
        contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
        nativeControls={false}
      />''', content)

with open(filepath, 'w') as f:
    f.write(content)

print('EXPO-VIDEO PATCHED')
