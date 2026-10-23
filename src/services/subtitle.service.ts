import { File } from 'expo-file-system';
import { SubtitleCue, SubtitleTrack } from '../core/types';

function parseTimecodeToMs(value: string): number | null {
  const input = value.trim().replace(',', '.');
  const match = input.match(/^(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{1,3})$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4].padEnd(3, '0'));
  if (minutes > 59 || seconds > 59) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export const SubtitleService = {
  parseSubtitleContent(rawContent: string, filename = 'External.srt'): SubtitleTrack {
    const normalized = rawContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    const blocks = normalized.split(/\n[ \t]*\n+/);
    const cues: SubtitleCue[] = [];
    let nextId = 1;

    for (const block of blocks) {
      const lines = block.split('\n').map((line) => line.trimEnd());
      const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeLineIndex < 0) continue;

      const timeLine = lines[timeLineIndex];
      const [startRaw, endWithSettings] = timeLine.split('-->');
      if (!startRaw || !endWithSettings) continue;
      const endRaw = endWithSettings.trim().split(/\s+/)[0];
      const startTimeMs = parseTimecodeToMs(startRaw);
      const endTimeMs = parseTimecodeToMs(endRaw);
      const cueText = decodeEntities(
        lines.slice(timeLineIndex + 1).join('\n').replace(/<[^>]*>/g, '').trim()
      );

      if (startTimeMs === null || endTimeMs === null || endTimeMs <= startTimeMs || !cueText) continue;
      cues.push({ id: nextId++, startTimeMs, endTimeMs, text: cueText });
    }

    cues.sort((a, b) => a.startTimeMs - b.startTimeMs);
    if (!cues.length) {
      throw new Error('No valid subtitle cues found. Choose a valid .srt or .vtt file.');
    }

    return {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: filename,
      uri: 'local',
      format: filename.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
      cues,
    };
  },

  async loadSubtitleFromUri(uri: string, name: string): Promise<SubtitleTrack> {
    const extension = name.toLowerCase().split('.').pop();
    if (extension !== 'srt' && extension !== 'vtt') {
      throw new Error('Chrono Player supports external .srt and .vtt subtitles.');
    }
    const content = await new File(uri).text();
    return { ...this.parseSubtitleContent(content, name), uri };
  },

  findActiveCue(cues: SubtitleCue[], currentTimeMs: number, offsetMs: number): SubtitleCue | null {
    const adjustedTime = currentTimeMs - offsetMs;
    let low = 0;
    let high = cues.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cue = cues[mid];
      if (adjustedTime < cue.startTimeMs) high = mid - 1;
      else if (adjustedTime >= cue.endTimeMs) low = mid + 1;
      else return cue;
    }
    return null;
  },

  findAdjacentCueTimestamp(
    cues: SubtitleCue[],
    currentTimeMs: number,
    direction: 'prev' | 'next'
  ): number | null {
    if (!cues.length) return null;
    if (direction === 'next') {
      return cues.find((cue) => cue.startTimeMs > currentTimeMs + 300)?.startTimeMs ?? null;
    }
    for (let index = cues.length - 1; index >= 0; index -= 1) {
      if (cues[index].startTimeMs < currentTimeMs - 800) return cues[index].startTimeMs;
    }
    return cues[0].startTimeMs;
  },
};
