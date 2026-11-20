# AgentVerse

**A group chat where AI agents are members, not sidebars.**

People chat in spaces and direct messages as usual. When someone mentions an agent, it reads the
conversation, answers in the chat for everyone, and proposes checklists, polls and memory updates
as cards. Nothing changes until a person approves, and approved cards (checklist ticks, votes,
decisions) update live for everyone.

Built for the Nexconn Build Challenge 2026. Every message, card update, vote and streamed agent
reply travels over **Nexconn** (Web Chat SDK in the browser, Platform Chat API on the server).
Agents run on **Google Gemini**; sign-in is handled by **Clerk**.

**Live app:** https://agentverse-nu-murex.vercel.app

![A space: the Researcher answers with sources, the Planner's checklist is approved and ticked live](docs/screenshots/space.png)

## What you can do

- **Spaces and DMs.** Create a group chat for a trip, a team or a club and share an invite link.
  People without an account sign up and land straight back in the space. Message anyone you share
  a space with, or talk privately to any agent.
- **Agents that are real members.** Every agent is its own chat user with its own colour and icon.
  Type `@` to mention one; its square lights up in the header while it works, a status line says
  what it is doing ("Searching Wikipedia for ..."), and its reply streams into the chat.
- **Five built-in agents** join every new space:
  - **@Researcher** searches Wikipedia and Hacker News, reads pages you link, and lists the sources
    it used.
  - **@Planner** turns a discussion into a checklist with owners and due dates.
  - **@Pollster** creates polls with live vote counts.
  - **@Summarizer** catches you up privately and proposes decisions for the space memory.
  - **@Translator** translates messages; the message menu translates privately for you.
- **Agents hand work to each other.** "@Researcher find three sights, then @Planner make a plan":
  agents run in the order you mention them and the Planner reads what the Researcher found.
- **Nothing runs without a person.** Proposals arrive as cards with **Approve**, **Edit** and
  **Dismiss**. Edits change the card in place for everyone.
- **Space memory.** Pin facts and decisions, or any message. Every agent reads them before it
  answers.
- **Catch me up.** Open a space with unread messages and ask for a private summary.
- **Agent Studio.** Build your own agent: name, handle, avatar, persona and the tools it may use.
  Try it in a test console that runs the real model and tools, then add it to any space.
- **Guardrails.** Owners choose which agents respond, whether agents only answer when mentioned,
  and whether actions need approval. Per-person and per-space AI limits show when agents are
  available again; AI failures appear as visible notices in the chat.

| Agents gallery | Agent Studio | On a phone |
| --- | --- | --- |
| ![Agents gallery](docs/screenshots/agents.png) | ![Agent Studio](docs/screenshots/studio.png) | ![A space on a phone](docs/screenshots/mobile-space.png) |

## How Nexconn is integrated

AgentVerse has no second realtime system: chat, cards, votes, agent status and streamed replies
all go through Nexconn. Agents are real Nexconn users that the server registers and speaks for.

### What happens when someone mentions an agent

```
 Browser (Web Chat SDK)                Nexconn (Singapore)                 AgentVerse server (Vercel, sin1)
 ----------------------                -------------------                 --------------------------------
 1. GroupChannel.sendMessage  ───────►  delivers the text to every member
    (mentionedInfo: @Planner)
 2. POST /api/spaces/:id/messages ─────────────────────────────────────►  checks membership and AI limits,
                                                                          resolves the mentioned agents
                                        ◄── 3. AGV:AgentState (transient)  "Planner is drafting a checklist"
                                        ◄── 4. RC:StreamMsg chunks          Gemini's answer, sent as the agent
                                        ◄── 5. AGV:Action card + metadata   "Create this checklist?"
 6. Approve ─────────────── POST /api/cards/:id/action ────────────────►  executes once (atomic claim)
                                        ◄── 7. AGV:Tasks card + metadata    the checklist itself
 8. Tick an item ─────────── PATCH /api/cards/:id/items/:item ─────────►  message metadata set
    every member's onMessageMetadataUpdated fires: ticks, votes and approvals update live
```

### Web Chat SDK (`@nexconn/chat` 26.2.1, `src/client/chat/engine.ts`)

| Feature | What it powers |
| --- | --- |
| `NCEngine.initialize` (Singapore) and `connect` with a server-issued token | One connection per tab; token refresh on 31004/31005, backoff retries on transient errors, auto-retry when the network returns |
| Connection status handler | The reconnecting/offline banner, "signed in elsewhere" (31010) with **Use this tab**, and a resync of channels and history after reconnect |
| Group and direct channels | Spaces, DMs between people, private chats with agents |
| Text messages with `mentionedInfo` and `needReceipt` | @mentions of people and agents, read receipts |
| Custom message types (`registerCustomMessages`) | `AGV:Tasks`, `AGV:Poll`, `AGV:Action` cards, `AGV:Notice`, and transient `AGV:AgentState` and `AGV:Typing` |
| Message metadata events | Live checklist ticks, assignees, due dates, votes and proposal status |
| Message update events | Edited proposals change in place |
| Streaming messages (`getMessagesByIds`, `requestStreamMessage`, stream handlers) | Agent replies; the stream summary metadata carries the final text |
| Channel list (`createChannelsQuery`) | Sidebar and home: unread counts and last-message previews |
| History (`createMessagesQuery`) | Opening a space and scrolling back |
| `clearUnreadCount`, `sendReadReceiptResponse`, receipt events | Unread clearing and "Seen" / "Seen by N" |
| `DirectChannel.sendTypingStatus` + typing events | Typing indicator in DMs (groups use the transient `AGV:Typing` message) |
| Optimistic sends | Failed messages show **Retry** and **Discard** |

### Platform Chat API (`src/lib/nexconn/server.ts`, signed requests with primary/backup failover)

| Endpoint | Used for |
| --- | --- |
| `/v4/auth/access-token/issue` | Registering people (first sign-in) and agents (built-in and Studio), issuing tokens |
| `/v4/user/update` | Keeping names and avatars of people and agents in sync |
| `/v4/group-channel/create`, `join`, `leave`, `profile/update`, `dismiss` | Spaces, invites, members, agents joining and leaving |
| `/v4/group-channel/message/send` (`metadata`, `toUserIds`, `shouldPersist: 0`) | Agent cards, notices, transient agent status, private targeted replies |
| `/v4/direct-channel/message/send` | Cards and notices in private agent chats |
| `/v4/group-channel/message/stream/send`, `/v4/direct-channel/message/stream/send` | Streamed agent replies (`RC:StreamMsg`) |
| `/v4/group-channel/message/update`, `/v4/direct-channel/message/update` | Editing a pending proposal in place |
| `/v4/channel-type/message/metadata/set` | Checklist ticks, assignees, due dates, votes, proposal status |

Not used on purpose: console webhooks (the client calls the app's API after sending, and the server
checks membership before any agent runs), built-in translation (Gemini translates instead) and paid
moderation.

## Sign-in (Clerk)

Clerk handles sign-up, sign-in, email verification, password resets and Google sign-in. Each Clerk
user maps to one row in `users`, created on their first visit (`src/lib/auth/session.ts`). That row
holds the app profile and the person's Nexconn identity, so a Nexconn token is issued and the person
is registered on Nexconn the first time they sign in. `src/proxy.ts` runs `clerkMiddleware`; every
API route and the `/app` layout check the session themselves.

## AI (Gemini)

One runtime for all agents (`src/lib/ai/runtime.ts`): the system prompt combines the agent's
persona, chat rules, the people and other agents in the space, and the space memory. Tools follow
the agent's capabilities: research (`wikipedia_search`, `hn_search`, `read_url` via Gemini URL
context), `propose_checklist`, `propose_poll` and `propose_memory`. The Researcher must research
before answering and its sources are attached to the reply. Models come from `GEMINI_MODEL` with
`GEMINI_FALLBACK_MODEL`, with retries on 429/503.

## Tech stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Nexconn Web Chat SDK and Platform Chat API,
Clerk, Gemini via `@google/genai`, Neon Postgres with Drizzle ORM, Vercel Blob for avatars, Vercel
(functions in Singapore, next to the Nexconn data center), Playwright and Vitest.

## Run it locally

```bash
npm install
cp .env.example .env.local           # or: vercel env pull .env.local --yes
npm run db:migrate                   # applies drizzle/ migrations to Neon
npm run dev                          # http://localhost:3102
```

Environment variables (see `.env.example`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`,
`NEXCONN_API_BASE`, `NEXCONN_ID_PREFIX`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
`GEMINI_FALLBACK_MODEL`, `BLOB_READ_WRITE_TOKEN`, optional `NEXT_PUBLIC_SITE_URL`. The Nexconn App
Secret, Clerk secret and Gemini key are only read on the server.

### Moving to a new Nexconn app

People, agents and group channels live on one Nexconn App Key. After changing `NEXCONN_APP_KEY` and
`NEXCONN_APP_SECRET`, register everything on the new app (safe to run more than once):

```bash
node --conditions=react-server --env-file=.env.local --import tsx scripts/provision-nexconn.mts
```

## Tests

```bash
npm run typecheck && npm run lint
npm test                                                                    # unit tests (Vitest)
npx playwright test                                                         # end to end, against local dev
E2E_BASE_URL=https://agentverse-nu-murex.vercel.app npx playwright test     # end to end, against production
node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-e2e.mts   # remove test accounts
```

The end-to-end suite runs against the real stack with two browser contexts: two people sign up
through Clerk (test-mode emails), one invites the other, they chat in real time, ask the Researcher
(answer with sources), approve a Planner checklist and tick it live, vote in a poll, build a custom
agent in the Studio, and use memory, private translation and agent DMs.

## Project layout

```
src/app/            routes: landing, login/signup (Clerk), join/[code], app/ (signed-in area), api/
src/components/     marketing/ (landing), shell/, chat/, spaces/, agents/, auth/, ui/
src/client/         API helper, app data context, Nexconn chat engine and store
src/lib/            nexconn/ (Platform API client), ai/ (Gemini runtime, agents, research), auth/,
                    db/ (Drizzle schema), cards, spaces, invites, memory
drizzle/            SQL migrations
scripts/            migrate, provision-nexconn, cleanup-e2e, smoke tests
e2e/, test/         Playwright and Vitest
```

See [AGENTS.md](AGENTS.md) for the engineering guide: architecture, data model, conventions and
known limitations.

## Known limitations

- The Web SDK did not push server-sent `RC:StreamMsg` to group members in realtime in our tests, so
  clients pull streams; replies arrive in a few larger steps, and the final text always arrives
  through Nexconn's stream summary metadata.
- Private replies (catch-up, Translate) are targeted group messages. Nexconn keeps them in history
  only if "Targeted group cloud retention" is enabled in the console.
- The SDK's typing status is direct-channel only; groups use a transient custom message.
- Free-tier Gemini can return 429/503 under load; the agent then posts a visible error notice.
