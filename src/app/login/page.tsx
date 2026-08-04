/// Single password-field login page for the shared-password gate. Posts
/// directly to /api/login (a plain form, no client JS required) which sets
/// the session cookie and redirects back to "/" on success, or back here
/// with ?error=1 on failure.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h1 className="text-h1 font-semibold text-text">
          <span lang="en">Nihongo Quest</span>{" "}
          <span lang="ja" className="text-text-muted">日本語クエスト</span>
        </h1>
        <p className="mt-1 text-caption text-text-dim" lang="en">
          Sign in to continue.
        </p>
        <form method="POST" action="/api/login" className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            name="username"
            placeholder="Username"
            aria-label="Username"
            autoFocus
            required
            autoComplete="username"
            className="h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface-2 px-3 text-sub text-text outline-none transition-colors duration-[var(--duration-fast)] focus-visible:border-[var(--color-focus)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            aria-label="Password"
            required
            autoComplete="current-password"
            className="h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface-2 px-3 text-sub text-text outline-none transition-colors duration-[var(--duration-fast)] focus-visible:border-[var(--color-focus)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          />
          {error && (
            <span className="text-micro text-danger" lang="en">
              Incorrect username or password.
            </span>
          )}
          <button
            type="submit"
            className="h-10 w-full rounded-[var(--radius-input)] bg-[var(--color-brand-button)] text-sub font-medium text-[var(--color-on-brand)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-brand-button-hover)]"
          >
            <span lang="en">Continue</span>
          </button>
        </form>
      </div>
    </div>
  );
}
