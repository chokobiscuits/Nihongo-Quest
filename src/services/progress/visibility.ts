const FURIGANA_HIDDEN_FROM_LEVEL = 65; // Master tier and above

export interface FuriganaVisibilitySettings {
  /// true forces furigana on, false forces it off, null/undefined defers to
  /// the level-based default.
  furiganaOverride?: boolean | null;
}

/// Furigana shows by default below Master (accountLevel < 65), and hides at
/// Master and above, on the idea that a user who has reached Master no
/// longer needs reading crutches. `settings.furiganaOverride` always wins
/// when explicitly set to true or false; only `null`/`undefined` falls back
/// to the level rule.
export function shouldShowFurigana(accountLevel: number, settings: FuriganaVisibilitySettings): boolean {
  const override = settings.furiganaOverride;
  if (override === true || override === false) {
    return override;
  }
  return accountLevel < FURIGANA_HIDDEN_FROM_LEVEL;
}
