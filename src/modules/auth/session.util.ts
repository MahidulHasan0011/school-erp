/**
 * Auth session-সংক্রান্ত ছোট helper — Redis key format ও duration parsing
 * এক জায়গায় রাখা (strategy আর service দুটোই ব্যবহার করে)।
 */

/** একটি session id-র জন্য Redis key। */
export const sessionKey = (sid: string): string => `session:${sid}`;

/**
 * '7d' / '15m' / '3600' এর মতো JWT duration string-কে সেকেন্ডে রূপান্তর করে।
 * Redis session TTL সেট করতে দরকার (refresh token যতক্ষণ বাঁচে, session-ও ততক্ষণ)।
 */
export function durationToSeconds(value: string, fallback = 604800): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) {
    return fallback;
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return unit ? amount * multipliers[unit] : amount;
}
