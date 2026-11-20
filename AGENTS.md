# AgentVerse: engineering guide

AgentVerse is a group chat where AI agents are real members of the conversation. People chat in
spaces (group chats) and DMs as usual. When someone @mentions an agent, the agent reads the
conversation, replies in the chat (streamed), and can propose actions as interactive cards
(checklists, polls, memory updates) that humans approve. Card state syncs to everyone live.

Built for the Nexconn Build Challenge 2026. Realtime messaging runs entirely on Nexconn
(Web Chat SDK on the client, Platform Chat API on the server). AI runs on Gemini via `@google/genai`.
Sign-in is handled by Clerk (`@clerk/nextjs` 7, Core 3).

- Live: https://agentverse-nu-murex.vercel.app
- Repo: https://github.com/cartoontv1152-arch/agentverse

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## User journeys

### First-time user (creator)
1. Lands on `/`, reads what the product does, chooses **Create account**.
2. Signs up with Clerk (email + password with an emailed code, or Google). On the first visit to
   the app a welcome dialog asks for their display name (Clerk sign-up doesn't collect one).
3. Arrives at Home: empty state explains spaces, DMs and agents, with one primary action:
   **Create a space**.
4. Creates a space (name, optional description). The five built-in agents join by default
   (removable in the space's Agents panel). Lands in the empty space with a hint on how to
   @mention an agent.
5. Copies the invite link from the space header and sends it to a friend.

### Invitee without an account
1. Opens `/join/<code>`: sees the space name, who invited them and member count.
2. Chooses **Create account and join** (or **I already have an account**); after auth they
   return to the invite and press **Join space**.
3. Expired or revoked links explain what happened and what to do (ask for a new link).

### In a space (core loop)
1. Types a message; `@` opens autocomplete for agents (squares) and people (circles), keyboard
   navigable.
2. Mentions `@Researcher`: the agent strip in the header lights up and a status line shows what
   it is doing ("Searching Wikipedia for ..."), then its reply appears with numbered sources.
3. Writes `@Researcher find three sights, then @Planner make a plan`: agents run in the order
   mentioned; the Planner sees the Researcher's answer and proposes a checklist.
4. The proposal arrives as an action card (**Approve / Edit / Dismiss**). Only after approval
   does the checklist card get created. Anyone can tick items, set assignees and due dates;
   everyone sees changes live. Edits to a pending proposal update the card in place.
5. `@Pollster` creates poll cards (after approval); votes update live for everyone.
6. `@Summarizer what did I miss?` summarises the conversation. Opening a space with 3+ unread
   messages shows a **Catch me up** banner that asks the Summarizer for a private summary.
7. `@Translator` translates; the message menu offers **Translate** (private reply) and
   **Pin to memory**.

### Agents
- Gallery of built-in agents (Researcher, Planner, Pollster, Summarizer, Translator) and the
  user's custom agents. Each can be added to any space the user belongs to, or messaged
  privately in a direct channel.
- Agent Studio: name, handle, avatar (uploaded to Vercel Blob), persona/instructions, allowed
  tools (web research, checklists, polls, summaries), and a test console that runs the real
  agent with unsaved edits applied (nothing is posted to a chat).

### Space memory and settings
- Memory tab: pinned facts and decisions that every agent in the space reads as context. Add,
  edit, delete. Any message can be pinned; the Summarizer can propose entries (approval card).
- Settings tab (owner): name/description, reply mode (only when mentioned, or also answer open
  questions), whether agent actions need approval, usage meters, delete space. Members can leave.
- Agents tab: pause/resume an agent in this space, remove it, add more agents.

### Returning user
- Logs in and sees spaces and DMs with unread counts and last-message previews (Nexconn
  channel list).
- Opening a space loads recent history; scrolling up paginates older messages.
- Connection drops show a reconnecting bar; failed sends show **Retry** / **Discard**.

### Edge cases
- AI quota: per-user (6/min, 40/hour) and per-space (120/hour) limits with a message that says
  when agents are available again. Verified live: the 7th rapid request returns HTTP 429
  `ai_rate_limited` with the reset time.
- AI failure: the agent posts a visible error notice in the chat, and its status turns red.
- Paused agents: mentioning one does nothing and a notice above the composer explains why.
- Session expiry: API calls return 401 and the client goes to `/login?next=...`.
- Signed in with Clerk but the app profile couldn't be created (database down): the app shows an
  explanation with **Reload** and **Sign out** instead of looping between `/login` and `/app`.
- Signed in elsewhere (Nexconn kick, code 31010): banner with **Use this tab**.

## Architecture

```
 Browser (Next.js client)                         Vercel functions (sin1)                 Services
 Clerk components (sign-in, sign-up, account) ── proxy.ts: clerkMiddleware ─────────── Clerk
 ------------------------                         -----------------------                 --------
 React UI ─┬─ chat engine (src/client/chat) ──── Nexconn Web Chat SDK ─────────────────── Nexconn (Singapore)
           │    NCEngine, channels, handlers        websocket: messages, metadata,          ▲
           │                                        typing, receipts, streams               │ Platform Chat API
           └─ fetch /api/* ───────────────────── Route handlers (src/app/api) ─────────────┘ (signed REST)
                                                    │  auth, spaces, invites, cards,
                                                    │  memory, agents, uploads
                                                    ├─ Drizzle ──────────────────────────── Neon Postgres
                                                    ├─ @vercel/blob ─────────────────────── Vercel Blob (avatars)
                                                    └─ agent runtime (src/lib/ai) ───────── Gemini (@google/genai)
                                                         function calling, research tools ─ Wikipedia, HN Algolia,
                                                                                             Gemini url_context
```

Message flow when someone mentions an agent:
1. The client sends the message through Nexconn (`GroupChannel.sendMessage`, with
   `mentionedInfo`).
2. The client posts `{messageId, text, mentionedIds}` to `/api/spaces/:id/messages`. The server
   checks membership, records the message in the mirror (attributed to the session user),
   resolves mentioned agents, checks AI limits, and returns. Agents run in `after()`.
3. For each agent: transient `AGV:AgentState` messages report progress; Gemini streams the
   answer, which the server sends as `RC:StreamMsg` chunks from the agent's Nexconn user. Tool
   calls run in between (research, or proposals that post `AGV:Action` cards).
4. Clients learn the stream's message id from the `writing` status, fetch it
   (`getMessagesByIds`), pull the chunks (`requestStreamMessage`), and apply the
   `RC_Ext_StreamMsgSummary` metadata Nexconn maintains.
5. Approving a card calls `/api/cards/:id/action`; the server executes it once (atomic claim),
   posts the result card, and updates the proposal's metadata so every client re-renders.

## Folder map

```
src/
  app/                    routes (App Router)
    page.tsx              landing (components/marketing: live chat hero, agent roster, FAQ)
    login, signup         Clerk <SignIn>/<SignUp> (hash routing keeps ?next= across steps)
    icon.svg, apple-icon, opengraph-image, manifest, robots, sitemap, not-found, error, global-error
    join/[code]           invite landing and join flow
    app/                  signed-in area (layout = session guard + AppShell)
      s/[spaceId]         space
      dm/[userId]         DM with a person (Nexconn user id)
      agent/[agentId]     private chat with an agent
      agents              gallery
      studio/new, [id]    Agent Studio
      settings            profile
    api/                  route handlers (all validate input with zod and check auth)
  client/                 client-only state: api helper, app data context, chat engine + store
  components/             UI: ui/ primitives, shell/, chat/, spaces/, agents/, auth/
  lib/
    db/                   Drizzle schema and Neon client
    auth/session.ts       Clerk session -> users row (created on first visit, registered on Nexconn)
    nexconn/              signed Platform Chat API client, id generator
    ai/                   Gemini wrapper, built-in agents, runtime, research tools,
                          orchestrator (Nexconn sink, mentions, auto replies), limits
    agent-visual.ts       per-agent hue and icon (built-ins by reserved handle, custom by id)
    clerk-appearance.ts   Clerk components themed with the design tokens
    cards.ts              proposals, checklists, polls, live metadata
    spaces.ts, agents.ts, invites.ts, memory.ts, mirror.ts, mentions.ts, message-types.ts
drizzle/                  SQL migrations
e2e/                      Playwright specs (two browser contexts, real stack)
test/                     Vitest unit tests
scripts/                  migrate (Neon HTTP), provision-nexconn, e2e cleanup, smoke tests
docs/screenshots/         real screenshots from production
```

## Data model (Neon Postgres, `src/lib/db/schema.ts`)

- `users` (`clerk_id` unique, email unique, `name_confirmed`, `nexconn_id`, cached `nexconn_token`;
  `password_hash` and the `sessions` table are from the pre-Clerk login and are dropped by a
  follow-up migration)
- `agents` (built-in rows keyed by `builtin_key`, custom rows owned by a user; `handle`,
  `instructions`, `tools[]`, `avatar_url`, `nexconn_id`)
- `spaces` (`nexconn_group_id`, `reply_mode`, `require_approval`), `space_members` (role,
  `last_read_at`), `space_agents` (`enabled`)
- `invites` (random code, 7-day expiry, revocation, use count)
- `messages`: server-side mirror used as agent context (`channel_key`, sender, text, sources)
- `cards` (kind tasks | poll | action, Nexconn message id, proposal data, status, revision),
  `task_items`, `poll_options`, `poll_votes`
- `memory_items` (fact | decision, created by a person or an agent)
- `ai_runs` (usage and latency per agent run; drives limits and meters)
- `rate_limits` (fixed-window counters for auth, uploads and actions)

## Nexconn features used, and where

Client, Web Chat SDK `@nexconn/chat` 26.2.1 (`src/client/chat/engine.ts`):
| Feature | Where |
| --- | --- |
| `NCEngine.initialize` (Singapore `AreaCode.SG`), `connect` with server-issued token | `connectOnce` |
| Token refresh on 31004/31005, retries on 35008/34001/-1 with backoff, auto retry on `online` | `connectOnce`, `scheduleAutoRetry` |
| Custom message types (`registerCustomMessages`): `AGV:Tasks`, `AGV:Poll`, `AGV:Action`, `AGV:Notice`, transient `AGV:AgentState`, `AGV:Typing` | `registerHandlers` |
| Connection status (reconnecting, suspended, kicked 31010) and resync after reconnect | `ConnectionStatusHandler`, `resyncAfterReconnect`, `connection-banner.tsx` |
| Group and direct channels, text messages with mentions (`mentionedInfo`) and `needReceipt` | `sendText` |
| Optimistic sends with failed state, retry and discard | `sendText`, `retrySend`, `discardFailed` |
| Channel list with unread counts and latest message | `loadSummaries` (`BaseChannel.createChannelsQuery`) |
| History pagination | `loadOlder` (`BaseChannel.createMessagesQuery`, `hasNext`) |
| Unread clearing and read receipts ("Seen", "Seen by N") | `markRead` (`clearUnreadCount`, `sendReadReceiptResponse`), `onMessageReceiptResponse` |
| Typing: `DirectChannel.sendTypingStatus` + `onTypingStatusChanged`; groups use transient `AGV:Typing` | `notifyTyping` |
| Message update events (edited proposals) | `onMessagesUpdated` |
| Message metadata events (checklist ticks, votes, proposal status, stream summary) | `onMessageMetadataUpdated` / `Deleted` |
| Streaming messages: `getMessagesByIds` + `Message.requestStreamMessage` + `onStreamMessageRequestInit/Delta/Complete` | `attachStream`, handlers |
| Message deletion events | `onMessageDeleted` |

Server, Platform Chat API (`src/lib/nexconn/server.ts`, signed, primary/backup domain failover):
| Endpoint | Used for |
| --- | --- |
| `/v4/auth/access-token/issue` | registering people (first sign-in) and agents (built-in and Studio) |
| `/v4/user/update` | syncing names/avatars of people and agents |
| `/v4/group-channel/create`, `join`, `leave`, `profile/update`, `dismiss` | spaces, invites, members, agents joining/leaving |
| `/v4/group-channel/message/send` (`hasMetadata`, `metadata`, `toUserIds`, `shouldPersist: 0`) | agent cards, notices, transient agent status, private (targeted) replies |
| `/v4/direct-channel/message/send` | cards and notices in agent DMs |
| `/v4/group-channel/message/stream/send`, `/v4/direct-channel/message/stream/send` | streamed agent replies (`RC:StreamMsg`) |
| `/v4/group-channel/message/update`, `/v4/direct-channel/message/update` | editing a pending proposal in place |
| `/v4/channel-type/message/metadata/set` | live checklist ticks, assignees, due dates, poll votes, proposal status |

Not used on purpose: console webhooks (one shared URL per App Key), built-in translation
(small free quota; Gemini translates instead), paid moderation.

## AI (Gemini) design

- Models from env (`GEMINI_MODEL`, fallback `GEMINI_FALLBACK_MODEL`); retries with backoff on
  429/503 and switches model; per-call timeouts; output capped at 1,200 tokens.
- One runtime for all agents (`src/lib/ai/runtime.ts`): system prompt = persona + chat rules +
  people + other agents + space memory; user turn = recent transcript + the request.
- Tools by capability: `search` -> `wikipedia_search`, `hn_search`, `read_url` (Gemini
  `url_context`); `tasks` -> `propose_checklist`; `polls` -> `propose_poll`; `summarize` ->
  `propose_memory`. Google Search grounding is not available on this key, and the UI never
  claims live Google search.
- The Researcher must research first (forced function call). If it answers without `[n]` markers,
  the sources it consulted (up to three) are attached instead of none. Sources are numbered as tools
  return them; only sources cited as `[n]` in the answer are attached (Markdown footer that
  the UI renders as source chips).
- Proposals never execute directly when the space requires approval (default). In agent DMs
  they execute directly (the requester is the only person).

## Environment variables (names only)

`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `NEXCONN_APP_KEY`,
`NEXCONN_APP_SECRET`, `NEXCONN_API_BASE`, `NEXCONN_ID_PREFIX`, `GEMINI_API_KEY`,
`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
optional `NEXT_PUBLIC_SITE_URL`. `.env.example` lists them all.
The App Secret and Gemini key are only read server-side. The App Key reaches the browser
through `/api/nexconn/token`.

## Commands

```bash
npm install
vercel env pull .env.local --yes        # secrets for local dev
npm run db:migrate                      # apply drizzle/ migrations to Neon (HTTP driver, scripts/migrate.mts)
node --conditions=react-server --env-file=.env.local --import tsx scripts/provision-nexconn.mts  # after changing Nexconn App Key
npm run dev                             # http://localhost:3102
npm run typecheck && npm run lint
npm test                                # unit tests (Vitest)
npx playwright test                     # e2e against local dev
E2E_BASE_URL=https://agentverse-nu-murex.vercel.app npx playwright test   # e2e against production
SCREENSHOTS=1 E2E_BASE_URL=... npx playwright test e2e/screenshots.spec.ts  # docs screenshots
node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-e2e.mts  # remove e2e accounts
vercel deploy --prod                    # production deploy (remote build)
```
If Playwright's bundled Chromium isn't downloaded, set `PW_CHROMIUM_PATH` to any Chromium.
Schema changes: edit `schema.ts`, then `npm run db:generate` and commit the new migration.

## Conventions

- Auth checks live in each resource (Clerk's guidance): route handlers call `requireUser()`, the
  `/app` layout checks the session. `proxy.ts` only adds the `?next=` redirect for `/app`.
- Every route handler goes through `route()` (uniform JSON errors), `requireUser()`, and zod
  parsing; membership is checked with `requireMembership` (404 for non-members).
- Nexconn ids: `${NEXCONN_ID_PREFIX}` + kind letter (`u` person, `a` agent, `g` group) + 20
  random alphanumerics.
- Card live state lives in Nexconn message metadata with a revision number; clients keep the
  highest revision among fetched state, metadata and their own optimistic update.
- UI tokens live in `globals.css`: cool paper `#f6f7f9`, surface white, navy ink `#161a2c`, cobalt
  action `#3554e0`, signal red `#d92d20` for errors only. Each agent has its own hue (cobalt,
  saffron, berry, jade, iris, teal) used for its avatar, name and the cards it posts. Funnel Display
  (headings) and Funnel Sans (UI), self-hosted in `src/app/fonts`. People are circles, agents are
  squares; lucide icons; no gradients. Motion: one orchestrated moment per page (the landing hero
  demo, members joining the roster), plus feedback motion; `prefers-reduced-motion` is respected.
  no gradients.
- Commits end with the Claude co-author line; work lands through squash-merged PRs.

## Testing

- E2E sign-up uses Clerk test mode: `e2e.*+clerk_test@example.com` addresses verified with code
  `424242`; `scripts/cleanup-e2e.mts` deletes those Clerk accounts and their app data.
- Unit (`test/core-logic.test.ts`): message merge/dedupe/order, previews, names from email, sources footer, stream summary
  parsing, citation registry, URL safety, redirect safety, mention resolution.
- E2E (`e2e/`), all against the real stack, two browser contexts where people interact:
  - `core.spec.ts`: signup, create space, invite a new person who signs up and joins, realtime
    chat both ways, Researcher answer with sources (seen by both), Planner proposal approved by
    the other person with live checklist ticks, Pollster poll with live votes.
  - `collab.spec.ts`: Researcher then Planner on one request, dismissing a proposal, space
    memory, private translation from the message menu, private DM with an agent.
  - `studio.spec.ts`: build a custom agent with an uploaded avatar, run the test console, add
    it to a space and mention it.

## Known limitations

- The Web SDK did not push `RC:StreamMsg` to group members in realtime in our tests, so clients
  pull streams (see message flow). Replies therefore arrive in a few larger steps rather than
  token by token; the final text always arrives through the stream summary metadata.
- Private replies (catch-up, Translate menu) are targeted group messages. Nexconn does not keep
  targeted messages in history unless "Targeted group cloud retention" is enabled in the
  console, so they disappear after a reload.
- Group typing indicators use a transient custom message (the SDK's typing status is
  direct-channel only).
- Read receipts in groups show counts from receipt responses received while the tab is open.
- "Also answer open questions" mode spends one small routing call per eligible question.
- Free-tier Gemini can return 429/503 under load; the agent then posts a visible error notice.
