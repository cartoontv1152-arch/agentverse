# Changelog

## November 2026: production release

### Design
- New identity built on the product's rule that people are circles and agents are squares: a new
  logo mark, cool paper and navy ink with one cobalt action colour, and Funnel Display and Funnel
  Sans (self-hosted).
- Each agent has its own hue and icon (Researcher cobalt, Planner saffron, Pollster berry,
  Summarizer jade, Translator iris; custom agents get a stable hue), used for avatars, names and
  the cards they post.
- New landing page: a live, self-playing chat in the hero (pauses off-screen, still for reduced
  motion), the agent roster joining as you scroll, a features section, a Nexconn architecture
  section and an FAQ.
- Every app screen redesigned: sidebar, home, space, messages, composer (with an @ button),
  checklist, poll and proposal cards, space panel, agents gallery, Agent Studio, settings, direct
  messages, invite page, dialogs and toasts.

### Sign-in
- Clerk replaces password sign-in: email with a verification code, or Google. Each Clerk user maps
  to an app profile created on first visit, which keeps the person's Nexconn identity.
- New members confirm their display name once; until then it is derived from their email.
- Clerk's forms are themed to match, keep `?next=` across every step, and show each step's
  instructions.

### Nexconn
- Moved every environment to the new Nexconn app and registered the built-in agents on it.
- `scripts/provision-nexconn.mts` (`npm run nexconn:provision`) registers agents, people and group
  channels on whichever app is configured.

### Production
- Favicon (`.ico` and SVG with a dark-mode variant), Apple touch icon, Open Graph image, web app
  manifest, `robots.txt` and `sitemap.xml`.
- 404, error and global error pages; security headers on every response.
- `npm run db:migrate` uses Neon's HTTP driver, so it works on networks that block websockets.
- `.env.example` lists every variable.

### Fixes
- Long agent replies were cut off after a reload: Nexconn's stream summary is a preview of about
  500 characters, so history now always pulls each stream's full content.
- Chats stay pinned to the newest message when content grows after loading.
- Home and sidebar previews were blank when the latest message was a streamed reply; previews now
  also strip Markdown, citations and source lists.
- The Researcher's answers always show the sources it read, even without inline markers.
- Starter prompts in private agent chats are clickable.
- The agent toggle in the space panel drew its knob outside the track.

### Tests and tooling
- End-to-end sign-up through Clerk's test mode, with testing tokens for bot protection on real
  domains; `npm run e2e:cleanup` removes the test accounts from Clerk and the database.
- Unit tests for previews, names from email and agent visuals.
- `npm run check` runs typecheck, lint and unit tests together.
