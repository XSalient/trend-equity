/**
 * Utilities for calculating time until daily generation.
 * The daily generation cron runs at a fixed UTC time (e.g., 06:30 UTC).
 */

export interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  hasTime: boolean;
}

/**
 * Parse the daily generation time from environment variable (HH:MM UTC format).
 * Defaults to 06:30 UTC if not configured.
 */
export function parseDailyGenerationTime(envTime?: string): { hours: number; minutes: number } {
  const timeStr = envTime || '06:30';
  const [h, m] = timeStr.split(':').map(Number);
  return {
    hours: isNaN(h) ? 6 : h,
    minutes: isNaN(m) ? 30 : m,
  };
}

/**
 * Calculate time remaining until the next daily generation.
 * Returns formatted time (hours, minutes) or indicates if generation is running.
 */
export function getTimeUntilNextGeneration(
  generationHours: number,
  generationMinutes: number
): TimeRemaining {
  const now = new Date();
  const today = new Date(now.getTime());
  today.setHours(generationHours, generationMinutes, 0, 0);

  let nextRun = new Date(today);

  // If the scheduled time has already passed today, target tomorrow
  if (now > today) {
    nextRun = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }

  const diffMs = nextRun.getTime() - now.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);

  // If totalSeconds is very small (< 60), generation is likely in progress or just finished
  const hasTime = totalSeconds > 60;

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    hasTime,
  };
}

/**
 * Format time remaining as a human-readable string (e.g., "in 3 hours 45 minutes").
 */
export function formatTimeRemaining(time: TimeRemaining): string {
  if (time.hours === 0 && time.minutes === 0) {
    return 'any moment';
  }

  const parts: string[] = [];
  if (time.hours > 0) {
    parts.push(`${time.hours} hour${time.hours > 1 ? 's' : ''}`);
  }
  if (time.minutes > 0) {
    parts.push(`${time.minutes} minute${time.minutes > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) return 'any moment';
  if (parts.length === 1) return `in ${parts[0]}`;
  return `in ${parts.join(' and ')}`;
}
