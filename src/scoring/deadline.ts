// src/scoring/deadline.ts

const DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(17, 0, 0, 0); // 17:00 local as "end of working day"
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function nextWeekday(now: Date, dow: number): Date {
  const x = new Date(now);
  const diff = ((dow - x.getDay() + 7) % 7) || 7; // strictly the next occurrence, never today
  x.setDate(x.getDate() + diff);
  return endOfDay(x);
}

export function extractDeadline(text: string, now: Date): Date | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const candidates: Date[] = [];

  // ISO dates YYYY-MM-DD
  const isoMatches = lower.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoMatches) {
    for (const m of isoMatches) {
      const d = new Date(`${m}T17:00:00`);
      if (!Number.isNaN(d.getTime())) candidates.push(d);
    }
  }

  // today / EOD / COB -> end of today
  if (/\b(eod|cob|end of day|close of business|by today|today)\b/.test(lower)) {
    candidates.push(endOfDay(now));
  }

  // tomorrow
  if (/\btomorrow\b/.test(lower)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    candidates.push(endOfDay(t));
  }

  // weekday names
  for (const [name, dow] of Object.entries(DOW)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      candidates.push(nextWeekday(now, dow));
    }
  }

  if (candidates.length === 0) return null;

  const floor = startOfDay(now).getTime();
  const future = candidates.filter((d) => d.getTime() >= floor);
  if (future.length === 0) return null;
  future.sort((a, b) => a.getTime() - b.getTime());
  return future[0];
}
