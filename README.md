# Accessibility Fixer

Agent-Native hackathon app: paste a public URL, get an axe-core accessibility audit, then accept or reject proposed HTML fixes.

Built with [Builder.io Agent-Native](https://www.agent-native.com/docs) for the [Agent-Native Hackathon](https://www.builder.io/hackathon) (due Nov 9, 2026 11:59 PM PT).

## What this slice does

- **Audit (no LLM):** fetches HTML, runs axe-core inside jsdom, stores issues in Postgres/PGlite.
- **Honest limits:** color contrast is **not** checked (jsdom cannot compute real styles). The UI says so.
- **Fix proposals (frugal):** common rules get free deterministic heuristics. Unknown rules ask you to connect Builder.io free credits (`Use Builder.io`). With `A11Y_MOCK_LLM=true`, unknown rules get a mock proposal for offline demos/tests.
- **Accept / reject:** before/after view; accepted fixes mark the issue fixed.

## Quick start

Requirements: Node.js 22+, pnpm 10+.

```bash
pnpm install
cp .env.example .env   # AUTH_DISABLED + PGlite + A11Y_MOCK_LLM already set for local demos
pnpm dev
```

Open the app (sign-in is skipped when `AUTH_DISABLED=true`). Land on **Audits**, paste a public URL, run an audit.

### Local fixture page

A page with known failures is served at `/fixtures/bad-a11y.html`. To audit it from the app:

1. Set `A11Y_ALLOW_LOCAL_FETCH=true` in `.env` (private hosts are blocked by default).
2. Restart `pnpm dev`.
3. Audit `http://127.0.0.1:<dev-port>/fixtures/bad-a11y.html`.

### CLI smoke (same actions the UI and agent use)

Set `AGENT_USER_EMAIL` in `.env` (already in `.env.example`) so CLI actions have an owner.

```bash
pnpm action start-audit --url https://example.com
pnpm action list-issues --auditId <id>
pnpm action propose-fix --issueId <id>
pnpm action accept-fix --proposalId <id>
```

### Checks

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Connect Builder.io (your step)

AI model calls use **only** Builder.io managed free credits. Connecting requires your Builder account:

1. Run `pnpm dev` and open the app.
2. Go to **Settings → Agent / AI** (or the model picker in chat).
3. Choose **Use Builder.io** and sign in to your Builder account when prompted.
4. Leave `A11Y_MOCK_LLM` unset (or `false`) so unknown rules can call the agent instead of the mock.
5. Free plan is roughly **15 credits/day, 60/month** — audits stay free; only uncovered fix proposals spend credits.

You do **not** need OpenAI, Anthropic, or Ollama keys for this project.

## Stack notes

- Agent-Native Chat template: shared `defineAction()` for UI + agent.
- Local DB: PGlite (`DATABASE_URL=pglite:./data/pglite`). Production will need hosted Postgres (Neon or similar) — not chosen yet.
- Deploy target (later): Cloudflare Workers (`NITRO_PRESET=cloudflare_module`) on the **ramanduke** account. Not deployed in this slice.

## Actions

| Action | Purpose |
| --- | --- |
| `start-audit` | Fetch URL → axe → store audit + issues |
| `get-audit` / `list-audits` | Read audits |
| `list-issues` / `get-issue` | Read issues (+ latest proposal) |
| `propose-fix` | Heuristic → mock → or `needs_builder` |
| `accept-fix` / `reject-fix` | Decide on a proposal |
| `list-accepted-fixes` | Accepted checklist for an audit |

## License

Private hackathon entry for now. Framework scaffold retains its upstream notices.
