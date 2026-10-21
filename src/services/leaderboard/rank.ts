// Pure leaderboard ranking. Given each user's raw metric value plus the
// tie-break fields, this assigns shared ranks (1,1,3 style: two users tied
// for 1st both show rank 1, the next distinct value is rank 3, not 2) and
// orders rows for stable display.

export interface LeaderboardCandidate {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /// The metric this list is ranked by (weekly XP, total XP, or streak).
  value: number;
  /// Tie-break only — never shown as the ranked metric itself unless
  /// `value` already is totalXp.
  totalXp: number;
}

export interface LeaderboardRow extends LeaderboardCandidate {
  rank: number;
}

/// Ranks candidates by `value` descending. Ties share a rank; the next
/// distinct value resumes at its 1-based position (1,1,3), not at the next
/// integer. Display order within a tie is totalXp desc, then displayName
/// asc — this ordering is cosmetic only and never changes the rank number.
export function rankLeaderboard(candidates: LeaderboardCandidate[]): LeaderboardRow[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
    return a.displayName.localeCompare(b.displayName);
  });

  return sorted.map((candidate, index) => {
    const rank = index === 0 || candidate.value !== sorted[index - 1].value ? index + 1 : sorted.findIndex((c) => c.value === candidate.value) + 1;
    return { ...candidate, rank };
  });
}
