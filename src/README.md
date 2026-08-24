# Surge.AI — AI Creative Agent (pippit.ai clone)

A functional, responsive clone of the pippit.ai light dashboard, built as a Perchance generator.

## ## What it does
- **Prompt bar** in the hero → generates 4 images from a rough idea.
- **Sidebar navigation** (all live):
  - **Story Studio** — write a complete, genre-selectable story (`ai-text-plugin`) that streams in, with an AI-illustrated cover. Saves to the library.
  - **Assets** — a searchable, filterable library manager (All / image / avatar / ad / video / storyboard / story / audio) with the detail viewer.
  - **Smart creation** — a guided launcher: pick a goal (image / avatar / ad / video / story / voice), describe it, and it routes to the right tool with the idea prefilled.
  - **Publisher** — published-content list (unpublish), library stats, and a persistent content planner.
- **Studio tools** (tabs / popular-tools cards):
  - **Image** — batch image generation (styles: photo-realistic, 3D, anime, oil, cinematic, retro).
  - **Avatars & voices** — custom digital-avatar generation **plus text-to-speech** (Web Speech Synthesis: pick from your browser's voices, generate a spoken line, saved as a playable "audio" asset).
  - **Ad creative** — writes a full ad (headline / copy / CTA / hashtags) via `ai-text-plugin` + a matching hero image.
  - **Storyboard** — a 3-frame "video" storyboard (text-to-video is *simulated* with generated stills) + a 3-shot scene breakdown.
- **Featured works** gallery (static curated images) and a persisted **My creations** library (`kv-plugin`, survives reloads). Click any card to view fullscreen; delete from the modal.

## Integrations (optional, configurable in Settings)
- **Supabase cloud library** — sync "My creations" to a free Supabase Postgres table so the library follows the user. Uses the public anon key + Row Level Security (safe by design), anonymous sign-in by default, optional email/password **or Google** sign-in for cross-device sync. One-time SQL setup (provided in-app with a copy button).
- **Community gallery** — publish creations to a public community board (Home → Community gallery) with the 🌍 button on library cards; auto-publish toggle. Public read, only the owner can unpublish.
- **Stripe credits** — sell credits via a Stripe Payment Link (client-side; the user pastes their link + credits-per-purchase). "Buy credits" in the top bar opens checkout; the *I've paid* button credits the balance. An optional credit gate can block generation when the balance hits zero. A separate **pro subscription link** powers the Subscribe buttons.
- **Webhooks** — POST a JSON payload `{event, tool, prompt, urls, time, generator}` to any webhook URL (Discord, Slack, n8n, Zapier, Make) whenever a creation is saved. Test button included; URL is stored only in the user's own browser.
- **Umami analytics** — opt-in privacy-friendly, cookie-free analytics; paste a website-id (and optional self-hosted instance URL).
- **Share & QR** — every creation can be shared as a public link (Perchance file hosting) with a QR code and copy button; download button too.
- **GitHub** — paste a GitHub Personal Access Token (repo scope; stored only in the user's browser, never shipped), which connects/verifies the account, lists repos to **pick an existing repo**, or **creates a new one** (private/public), and **pushes the full app** (`index.html`, `main.pjs`, `src/*`, plus a `README.md`) to that repository via the GitHub REST API (update-aware, keeps the sha). Logs, credits and created assets are kept local and are not uploaded.

## Pushing the project to GitHub
The **⬆ Push full app to GitHub** button (Settings → GitHub) uploads a complete copy of the app: `index.html`, `main.pjs`, `src/musicEngine.js`, `src/lyrics.js`, `src/README.md`, and a generated root `README.md`.
- `index.html` and `main.pjs` are not fetchable by the running page, so their source is baked into **`src/app-source.js`** (`window.APP_SOURCES`). **Whenever you edit `index.html` or `main.pjs`, regenerate it** — the rebuild recipe is in `scratch/repo` / the surge-ai-repo build (reads main.pjs + index.html, writes `src/app-source.js` as `window.APP_SOURCES={...}`). `src/*` files are fetched live at push time.
- Credit costs: 40/image batch · 40/avatar · 20/ad · 40/storyboard · 10/frame video.

## Limitations
- Real text-to-video is **not possible** with Perchance's tools (text + still images only), so video is represented by generated frames/storyboards. Noted in the footer.

## Files
- `main.pjs` — `$meta` plus `generateImage` / `generateText` / `kv` plugin imports.
- `index.html` — all UI, styles, and app logic (light dashboard: subscription banner, sidebar, prompt bar, studio tools, featured + library grids, detail modal).
- Static featured artworks are hosted on `user.uploads.dev`.
