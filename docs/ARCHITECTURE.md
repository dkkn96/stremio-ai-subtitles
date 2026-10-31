# Architecture and contracts

This public edition evolves the original Stremio addon; it does not introduce a
standalone translation product. Node >=22.12, ES modules, one runtime dependency.

```text
Stremio subtitle request
  -> private token + video/extra validation
  -> source addon lookup (optional fallback)
  -> existing target-language track OR bounded JobStore admission
  -> source download / UTF-8 + SRT/VTT validation
  -> complete batch cache OR selected provider adapter
  -> cue-ID / text validation, original timestamps
  -> atomic complete SRT + private delivery/status
```

## Boundaries

- `config.js`: explicit provider/model, language/URL/range validation, private
  random token, safe defaults. API mode requires explicit opt-in.
- `languages.js`: known Stremio ISO 639-2 codes and source aliases. Language
  names cannot inject arbitrary prompt text. Adding a code is not a quality claim.
- `source.js`, `http-client.js`: Stremio source protocol, release hints, ranking,
  optional fallback, notice filtering; DNS resolution/pinning and redirect checks
  reject private/internal addresses. Downloads have byte/time bounds.
- `subtitles.js`: SRT/VTT parsing, plain text, cue identity, exact time preservation.
- `translator.js`: provider-neutral instructions/schema and bounded parallel
  batching; one retry for invalid cue sets, no quota/auth/timeout retries.
- `provider.js`: dispatch and persistent quota pause. No fallback model/provider.
- `codex.js`: existing bounded official-CLI runner, dedicated login lease,
  explicit reasoning/Fast, no tools, event/schema validation.
- `cli-provider.js`, `grok-acp.js`, `process.js`: client-specific protocols,
  minimal inherited environment, dedicated state, time/output bounds and safe
  error classification. No shell interpolation of subtitle content.
- `compatible-api.js`: optional explicit Chat Completions adapter. OpenAI
  Responses transport remains in `translator.js`. No native Claude/Gemini API SDK.
- `jobs.js`: serialized local admission, persistent UTC daily count, queue,
  shared in-flight work and atomic cache publication.
- `server.js`, `install-page.js`: Stremio subtitle endpoints and private install
  page. No public admin/configuration route. Health/HEAD never starts translation.
- `main.js`: exclusive data-directory process lease, server lifecycle, lazy AI
  initialization so already-ready subtitles survive an expired provider login.

## Provider contract

`async (cues, context) -> { cues, usage }`, where cue identity/timestamps are owned
by the app. Send only ID/text/duration plus nearby context to the model. Return
validated cues; never accept timestamps supplied by an AI. Every output must
match all original cue IDs without omissions, duplicates or additions.

Cache keys include prompt version, provider/model, source/target language,
endpoint/tier settings, reasoning, batch size, and source identity/content.
Source timings are part of the original content hash. Never mix data across
languages/providers. Changing provider does not delete older cache files.

Only one app process owns a data directory. Each server defaults to one active
job and two simultaneous batches. Failed admissions can count toward the UTC
20/day default. There is no automatic credit purchase or dollar-budget guarantee.
Some upstream clients perform their own retries; our timeout bounds the process.
The local admission counter cannot override external subtitle-source limits.

## Extension and verification

Add an adapter behind `prepareTranslator`; implement tests for malformed/partial
output, zero-exit errors, tool attempts, timeouts and quota. Use synthetic fixtures
and mock transports in CI. Provider logins, real model availability, latency,
language quality and native playback require separate opt-in live evidence.

A Windows child tree and client installation may behave differently; no Windows
production certification is claimed. Startup installation currently supports
macOS only. API protocols/endpoints not listed in PROVIDERS.md are not implied.
