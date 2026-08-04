# Working on Nihongo Quest

Single-developer project deploying continuously to Vercel. The process below
is deliberately light: enough to stop broken code reaching production, not
enough to slow down a one-person feedback loop.

## Branches

`main` is production. Vercel deploys every push to it. Nothing else is
long-lived.

Work happens on short branches taken from `main` and merged back when the
preview build is green:

```
main
 ├── feat/exam-mode
 ├── fix/practice-summary
 └── chore/bump-next
```

| Prefix   | For                                        |
| -------- | ------------------------------------------ |
| `feat/`  | new capability                             |
| `fix/`   | something broken                           |
| `chore/` | dependencies, config, tooling              |
| `docs/`  | documentation only                         |

There is no `develop` or `release/*`. Those coordinate multiple developers
and scheduled releases; neither applies here, and both would add ceremony
without catching anything.

`master` used to exist as a second long-lived branch that was fast-forwarded
into `main` immediately. It gated nothing and made the deploying branch
ambiguous, so it was deleted.

### The loop

```sh
git switch -c fix/whatever main
# ...work...
git push -u origin fix/whatever   # Vercel builds a preview
# check the preview deployment
git switch main && git merge fix/whatever && git push
git branch -d fix/whatever && git push origin --delete fix/whatever
```

The preview build is the point. Pushing a branch first means a build failure
lands on a preview URL rather than production.

## Before pushing

```sh
npm run verify      # typecheck + tests + production build
```

`npm run build` is not optional, and it is not covered by the other two.
`tsc --noEmit` and vitest both pass happily on code Next refuses to build —
a `"use server"` module exporting a non-async const is the case that actually
shipped broken: typecheck clean, tests clean, Vercel build dead with "the
module has no exports at all".

A `pre-push` hook in `.githooks/` runs the build automatically. It is enabled
by `npm install` (via `postinstall`), or manually:

```sh
git config core.hooksPath .githooks
```

Bypass it with `git push --no-verify` when you are knowingly pushing a broken
build to a preview branch.

## Verifying against real data

Some behaviour is only observable against the live database. Scripts that do
this must never write to `local-user`:

- `npm run sim` — full progression simulation on a throwaway user, asserts
  `local-user` is byte-identical afterwards
- `npm run verify:reset` — exercises the destructive reset on a throwaway
  user, same safety assertion

Follow that pattern for anything new that touches user rows.

## Deploys

Pushing to `main` deploys to production. There is no staging environment and
no database migration step in the build — `prisma migrate deploy` is manual,
run from your machine against production. See `docs/deployment.md`.

## Recommended: branch protection

Not configurable from the repo; set it on GitHub:

**Settings → Branches → Add rule** for `main`:

- Require a pull request before merging (uncheck approvals — you are the only
  reviewer)
- Require status checks to pass, selecting the Vercel check
- Do not allow force pushes

This is what makes the preview build a gate rather than a suggestion. Without
it, everything above is a convention you can bypass by accident.
