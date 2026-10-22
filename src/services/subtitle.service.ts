import * as FileSystem from 'expo-file-system';
import { SubtitleCue, SubtitleTrack } from '../core/types';

function parseTimecodeToMs(timeStr: string): number {
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length < 2) return 0;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    seconds = parseFloat(parts[2]) || 0;
  } else {
    minutes = parseInt(parts[0], 10) || 0;
    seconds = parseFloat(parts[1]) || 0;
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export const SubtitleService = {
  parseSubtitleContent(rawContent: string, filename = 'External.srt'): SubtitleTrack {
    const normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n\s*\n/);
    const cues: SubtitleCue[] = [];
    let indexCounter = 1;

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      let timeLineIndex = 0;
      if (!lines[0].includes('-->') && lines[1]?.includes('-->')) {
        timeLineIndex = 1;
      } else if (!lines[0].includes('-->')) {
        continue;
      }

      const timeLine = lines[timeLineIndex];
      const arrowParts = timeLine.split('-->');
      if (arrowParts.length !== 2) continue;

      const startTimeMs = parseTimecodeToMs(arrowParts[0]);
      const endTimeRaw = arrowParts[1].trim().split(' ')[0];
      const endTimeMs = parseTimecodeToMs(endTimeRaw);

      const textLines = lines
        .slice(timeLineIndex + 1)
        .join('\n')
        .replace(/<[^>]*>/g, '')
        .trim();

      if (textLines && endTimeMs > startTimeMs) {
        cues.push({
          id: indexCounter++,
          startTimeMs,
          endTimeMs,
          text: textLines,
        });
      }
    }

    cues.sort((a, b) => a.startTimeMs - b.startTimeMs);

    return {
      id: `sub_${Date.now()}`,
      name: filename,
      uri: 'local',
      format: filename.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
      cues,
    };
  },

  async loadSubtitleFromUri(uri: string, name: string): Promise<SubtitleTrack> {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const track = this.parseSubtitleContent(content, name);
    return {
      ...track,
      uri,
    };
  },

  findActiveCue(cues: SubtitleCue[], currentTimeMs: number, offsetMs: number): SubtitleCue | null {
    if (!cues.length) return null;
    const adjustedTime = currentTimeMs - offsetMs;

    let low = 0;
    let high = cues.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const cue = cues[mid];

      if (adjustedTime >= cue.startTimeMs && adjustedTime <= cue.endTimeMs) {
        return cue;
      } else if (adjustedTime < cue.startTimeMs) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
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
      const nextCue = cues.find((c) => c.startTimeMs > currentTimeMs + 300);
      return nextCue ? nextCue.startTimeMs : null;
    } else {
      for (let i = cues.length - 1; i >= 0; i--) {
        if (cues[i].startTimeMs < currentTimeMs - 800) {
          return cues[i].startTimeMs;
        }
      }
      return cues[0].startTimeMs;
    }
  },
};
