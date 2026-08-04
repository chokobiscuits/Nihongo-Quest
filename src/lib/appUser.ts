/// The single user this instance belongs to.
///
/// Trimmed deliberately. A hosting dashboard picks up stray whitespace very
/// easily when a value is pasted, and an untrimmed id is a *different* user
/// as far as every query is concerned: the deployed app silently created a
/// second, empty profile under "\tlocal-user" and showed a blank account
/// while the real progress sat untouched under "local-user".
///
/// Import this rather than reading process.env.APP_USER_ID directly, so the
/// normalisation happens in exactly one place.
export const APP_USER_ID = (process.env.APP_USER_ID ?? "local-user").trim() || "local-user";
