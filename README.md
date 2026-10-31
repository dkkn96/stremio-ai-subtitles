# Stremio AI Subtitles

**Your Stremio addon. Your AI account. Your subtitle language.**

A self-hosted addon that finds source subtitles, translates them on demand and
returns a complete SRT track to Stremio. It preserves cue timings, caches finished
translations and limits new work. No shared translation server is provided.

[Guida italiana](docs/START-HERE.it.md) · [English setup guide](docs/START-HERE.md) ·
[Install with an AI assistant](docs/AI-INSTALL.md) · [Provider setup](docs/PROVIDERS.md)

## Start here

**With an assistant:** give it this repository URL and paste the prompt in
[AI-INSTALL.md](docs/AI-INSTALL.md). An assistant with terminal access can carry
out the local setup. A chat-only assistant can guide you one step at a time.
You complete personal logins yourself.

**On your own:** follow the [step-by-step guide](docs/START-HERE.md). It starts
with installing Node.js and downloading this repository. No programming required.

For users who already have Node.js 22.12 or newer and the chosen AI client:

```sh
npm ci --ignore-scripts
npm run setup
npm run login
npm run doctor
npm run probe -- --confirm
npm start
```

The probe sends two invented lines to your chosen AI and uses its quota. It is
optional but recommended before real playback. API billing applies if you
explicitly selected an API profile. Setup and offline tests do not call any AI.
In a second terminal, `npm run link` shows your **private** Stremio installation
page. For phones/TVs, first configure [public HTTPS hosting](docs/HOSTING.md).

## AI choices and readiness

| Profile | Connection | Readiness in this public edition |
| --- | --- | --- |
| `codex` | Official Codex CLI, dedicated ChatGPT login | Adapted from the working private Mac deployment; offline regression tests pass. A fresh-install live probe is still required. |
| `gemini` | Official Gemini CLI, dedicated Google login | Experimental adapter; simulated stream/format/failure tests. |
| `claude` | Unmodified Claude Code, personal login | Experimental adapter; simulated structured-output/failure tests. Provider terms apply. |
| `grok` | Official Grok Build via ACP, personal cached login | Experimental adapter; simulated protocol/permission/model tests. |
| `opencode` | OpenCode, provider/model selected by you | Experimental adapter; simulated event/format/failure tests. |
| `openai-api` | OpenAI Responses API | Optional explicit API mode; mock HTTP tests only. |
| `compatible-api` | OpenAI-compatible Chat Completions endpoint | Optional API/local-server mode; mock HTTP tests only. Compatibility depends on endpoint/model. |

See [provider instructions and current official sources](docs/PROVIDERS.md).
An AI chat subscription does not imply API access. There is **no automatic
fallback** between clients, accounts, models or payment methods. The Codex preset
requests `gpt-6-luna`, reasoning `max`, Fast explicitly; unavailable settings fail.
The project does not bundle or modify the AI clients, automate their web chats,
extract browser cookies or share login credentials.

## What you get

- A private Stremio subtitle addon for movies and series.
- A choice of source and target languages (29 configured language codes).
- Subtitle Sync or another compatible Stremio subtitle source, including the
  default OpenSubtitles addon; optional fallback source.
- Whole-file delivery after cue validation, with original timestamps preserved.
- Cache separation by provider, model, languages, settings and source content.
- Bounded parallel translation, persistent daily limits and quota pauses.
- Guided setup in English/Italian, diagnostics and a synthetic local smoke test.
- Optional macOS login startup, crash recovery and AC sleep prevention.

This is **only a Stremio addon**, not a standalone file-translation product or a
streaming/video source. Translation quality, synchronization and waiting time
vary with the source track, release, model and provider load. No fixed 1–2 minute
completion promise is made. Existing target-language tracks are preferred by
default to save quota; set `PREFER_EXISTING=false` to request AI translation instead.

## Hosting and privacy

Each user supplies their own computer/server, account, subtitle source and
network connection. GitHub distributes the source code; GitHub Pages cannot host
this Node service. Your host must remain awake and online while you watch.
For a Mac, automatic startup begins **after user login**, including FileVault
unlock after a reboot. A closed lid must be tested on your own hardware.

Keep `.env`, `data/`, `runtime/`, account files and installation links private.
The source provider receives the video lookup; the selected AI receives subtitle
text/context; a tunnel provider can process traffic passing through its service.
Only use and share subtitle material you are entitled to process.

## Development and publishing

```sh
npm test
npm run smoke
npm run check:release
```

These checks use invented dialogue and mock AI responses. They do not prove
provider access, translation quality or native player compatibility.
[Validation record](docs/VALIDATION.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Publishing guide](docs/PUBLISHING.md) · [Contributing](CONTRIBUTING.md)

MIT for this project's code. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
