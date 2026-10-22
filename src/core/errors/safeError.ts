export interface SafeErrorResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function normalizeError(err: unknown, fallbackMessage = 'Operation failed'): string {
  if (err instanceof Error) {
    return err.message || fallbackMessage;
  }
  if (typeof err === 'string' && err.trim().length > 0) {
    return err;
  }
  return fallbackMessage;
}

export function validateStreamUrl(rawUrl: string): SafeErrorResult<string> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'Stream URL cannot be empty.' };
  }
  const allowedProtocols = /^(https?:\/\/|rtsp:\/\/|mms:\/\/)/i;
  if (!allowedProtocols.test(trimmed)) {
    return {
      ok: false,
      error: 'Invalid protocol. Only HTTP, HTTPS, and RTSP network streams are permitted.',
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) {
      return { ok: false, error: 'Malformed stream hostname.' };
    }
    return { ok: true, data: trimmed };
  } catch {
    return { ok: false, error: 'Malformed URL format.' };
  }
}
