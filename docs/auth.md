# Authentication & Authorization

Opaque server-side sessions with role-based access control. No third-party auth
dependency — Node's built-in `crypto` does the hashing, Prisma stores the state.

## Model

- **Password hashing** — `scrypt` with a per-user 16-byte random salt, stored as
  `salt:hash` (hex). Verification is constant-time (`timingSafeEqual`). No bcrypt
  or argon dependency. See `frontend/src/lib/auth.ts`.
- **Sessions** — on login/register a 32-byte random token is set in an
  `httpOnly`, `sameSite=lax`, `secure`-in-production cookie (`mr_session`). The
  DB stores only `sha256(token + AUTH_SECRET)`, so a database leak cannot be
  replayed as a login. Sessions expire after 30 days; expired rows are cleaned
  up opportunistically on lookup.
- **Roles** — `USER < EDITOR < ADMIN` (ranked). `hasRole(user, required)` and
  `requireRole(required)` enforce the hierarchy.

## API routes

| Route                     | Method | Purpose                                    |
| ------------------------- | ------ | ------------------------------------------ |
| `/api/auth/register`      | POST   | Create account, start session             |
| `/api/auth/login`         | POST   | Authenticate, start session                |
| `/api/auth/logout`        | POST   | Destroy session + clear cookie             |
| `/api/auth/me`            | GET    | Resolve current user from cookie           |

All inputs are validated with zod (`frontend/src/lib/validation.ts`). Errors are
generic ("Invalid email or password.") to avoid account enumeration.

## Rate limiting

`frontend/src/lib/ratelimit.ts` is a DB-backed fixed-window limiter using the
`login_attempts` table (shared-instance safe, unlike an in-memory Map):

- **Login** — 10 failed attempts per IP per 15 min.
- **Register** — 5 accounts per IP per hour.

Every login attempt is recorded with its `success` flag for the security
dashboard.

## Frontend integration

`AppContext` exposes `doLogin`, `doSignup`, `doSignout`, and hydrates the current
user from `/api/auth/me` on mount. The `user` object carries `role`, which gates
the admin surface. Login/signup pages show inline validation and error states.

## Adding OAuth later

The `User.passwordHash` column is nullable specifically so OAuth-only accounts
can exist. Wire a provider by creating the user (or linking by email) and calling
`createSession(user.id)` — the rest of the stack is provider-agnostic.
