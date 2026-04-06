export function generateReferralCode(userId) {
    const suffix = Math.random().toString(36).slice(2, 8);
    return `ref_${userId}_${suffix}`;
}
