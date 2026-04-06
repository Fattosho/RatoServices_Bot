export function generateReferralCode(userId: number): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `ref_${userId}_${suffix}`;
}
