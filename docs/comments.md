# Comments & Discussion

Signed-in users can discuss on manga detail pages and editorial articles. One
model serves both.

## Model

`Comment` (`frontend/prisma/schema.prisma`):

- Targets exactly one of `mangaId` (scraper manga id, cross-owner so no FK) or
  `articleId` (FK to `Article`). The API enforces "exactly one".
- Threading is one level deep: a reply carries `parentId`; a reply's parent must
  be top-level and share the same target.
- `status`: `VISIBLE` | `HIDDEN` | `REMOVED` for moderation. Public reads return
  only `VISIBLE`.
- Deleting a comment cascades to its replies.

## API

- `GET /api/comments?mangaId=… | ?articleId=…` — public. Returns the visible
  thread (top-level comments with nested replies) and a total count.
- `POST /api/comments` — auth required. Validates with `commentSchema`, rejects
  banned users, and throttles to 8 comments per user per 5 minutes via
  `recentCommentCount` (a real count of the user's recent rows — not the login
  rate limiter).
- `DELETE /api/comments/[id]` — the author can delete their own; `EDITOR`/`ADMIN`
  can delete any (moderation).
- `PATCH /api/comments/[id]` — `EDITOR`/`ADMIN` set `status` for moderation.

Data-access logic lives in `frontend/src/lib/comments.ts`.

## UI

`frontend/src/components/CommentSection.js` is a client component used by both
`/manga/[id]` and `/blog/[slug]`. It loads the thread, supports posting and
one-level replies, shows a "Staff" badge for editor/admin authors, prompts guests
to sign in, and exposes delete for the author or moderators. Styles are in
`globals.css` under the `.cmt-*` classes and match the site's dark theme.
