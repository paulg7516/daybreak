// src/app/away-window.ts

export type AwayWindowCheck = { ok: true } | { ok: false; reason: string };

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Validates the user-supplied "I was out since" date against the current time.
// Guards the two realistic mistakes: a future date, or a date so old it is almost
// certainly a typo (more than a year back).
export function validateAwayWindow(sinceISO: string, nowISO: string): AwayWindowCheck {
  const since = Date.parse(sinceISO);
  const now = Date.parse(nowISO);
  if (Number.isNaN(since)) {
    return { ok: false, reason: 'That is not a date Daybreak can read.' };
  }
  if (since > now) {
    return { ok: false, reason: 'The date you were out since cannot be in the future.' };
  }
  if (now - since > ONE_YEAR_MS) {
    return { ok: false, reason: 'That date is more than a year ago. Please pick a more recent date.' };
  }
  return { ok: true };
}
