export interface ChangelogVisibilityInput {
  /// Ids of every release, newest first.
  releaseIds: string[];
  /// `UserProfile.settings.lastSeenChangelogId`, if any.
  lastSeenId: string | null | undefined;
  /// Whether the account has finished (or skipped) first-run onboarding,
  /// i.e. has at least one TutorialCompletion.
  onboarded: boolean;
}

/// Whether to announce the newest release.
///
///  - Never during onboarding: a brand-new or freshly reset account is being
///    walked through the app and should not also get an update notice.
///    (A brand-new account is stamped as having seen the newest release when
///    its onboarding completes, so it does not get one right after either.)
///  - An onboarded account that has never seen a changelog (it predates this
///    feature) is shown the newest release.
///  - Otherwise only when the last seen release is an older known one. An id
///    this build does not know is newer than it (e.g. after a rollback), so
///    it is not announced over.
export function shouldShowChangelog({ releaseIds, lastSeenId, onboarded }: ChangelogVisibilityInput): boolean {
  if (releaseIds.length === 0) return false;
  if (!onboarded) return false;
  if (lastSeenId === null || lastSeenId === undefined) return true;
  const seenIndex = releaseIds.indexOf(lastSeenId);
  return seenIndex > 0;
}

/// Routes where a modal would interrupt a task in progress: a lesson or
/// review session (which end in their own celebration modals), the tutorial
/// pages (first-run onboarding lives there), and the login screen. The
/// popup waits until the user navigates somewhere calmer.
const SUPPRESSED_PREFIXES = ["/lessons", "/reviews", "/tutorials", "/login", "/changelog"];

export function isChangelogSuppressedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SUPPRESSED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
