# Validation status — 2026-10-31

This is a **public preview**, not a claim that every provider, platform or Stremio
player has been certified. The [repository](https://github.com/dkkn96/stremio-ai-subtitles)
was published on 2026-10-31. The existing private deployment was not changed.

## Observed local preparation results

- macOS 27.0.1, Apple Silicon; Node 26.8.1, npm 11.19.0.
- 68 automated tests passed, 0 failed, 0 skipped.
- Synthetic local Stremio smoke passed with all 6 cue timestamps preserved.
- A real demo server process was stopped and restarted: private token, track URL,
  subtitle bytes and daily count remained unchanged. A second concurrent process
  using the same data directory was rejected.
- Generated macOS launch-agent XML passed `plutil -lint`; it was not installed.
- Release allowlist/local-document-link and secret-pattern checks passed.
- The source ZIP was extracted to a fresh directory; offline dependency install,
  all 68 tests, the synthetic smoke and release checks passed there too.
- No live AI translations, new AI account login, paid API request, DNS mutation
  or private deployment change was performed during preparation/publication.

## Observed GitHub checks

The [first GitHub Actions run](https://github.com/dkkn96/stremio-ai-subtitles/actions/runs/41202068415)
passed all four jobs at commit `9a32a7be8d03c2d62aa1d515a979050b3d2e28dc`:
Ubuntu and macOS runners, each using Node 22 and 24. Every job installed the locked
dependencies and passed the automated tests, synthetic smoke and release checks.
The [workflow page](https://github.com/dkkn96/stremio-ai-subtitles/actions/workflows/ci.yml)
shows results for subsequent commits.

These checks validate code/transport behavior, not native playback, a complete
end-user installation or live provider quality. No AI credentials are used in CI.

## Evidence boundaries

| Area | Evidence / status |
| --- | --- |
| Existing core | Adapted from the working private Mac Stremio addon, including parser, source selection, cache, bounded batching and Codex runner. Historical success does not certify this new distribution. |
| New public core | Local automated regression tests with synthetic dialogue and mock AI responses. See the test suite and preparation report. |
| Local Stremio HTTP protocol | Synthetic end-to-end smoke: private manifest, unauthorized 404, subtitle listing, complete SRT and exact cue timings. No real video playback. |
| Codex | Existing integration retained and tested with simulated CLI responses; new public install/login and live model access still require an opt-in probe. |
| Gemini / Claude / Grok / OpenCode | Experimental adapters based on current official docs. Contract/error/permissions tests are simulated; no live account validation in this preparation. |
| Optional API modes | Mock HTTP tests only. No API key configured and no paid request sent. |
| macOS startup | Launch-agent generation/escaping checks; public services not installed on the development Mac, to preserve the existing deployment. Fresh-user reboot test remains required. |
| Linux | GitHub Ubuntu runner checks passed on Node 22/24. A complete end-user install, provider login and playback remain unverified. |
| Windows | No production/native auto-start qualification. |
| Translation quality | No new multilingual human quality evaluation. Language codes are configuration support, not quality certification. |
| TV / iPhone | Historical private-addon tests do not qualify this public version. Test each intended player after installation. |
| GitHub Actions | First published commit passed all four Linux/macOS, Node 22/24 jobs; see the run linked above. |

The offline suite checks cache separation, cue/timing invariants, source SSRF
protection, API opt-in, minimal client environment, quota persistence, no automatic
fallback, private links, safe setup serialization and failure handling. It cannot
establish model access, provider terms eligibility or absence of every secret.

## Record a real installation

Copy this checklist into your private notes; publish only a sanitized summary.

- [ ] OS/architecture, Node, project version and exact CLI versions recorded.
- [ ] Clean install completed from the documented guide.
- [ ] Personal official login completed in the dedicated directory.
- [ ] Chosen provider/model probe succeeded with valid synthetic cues.
- [ ] Human checked the target-language text.
- [ ] Public HTTPS works from outside the home network.
- [ ] First real episode/release translated, elapsed time measured.
- [ ] Same release reused cache; no extra provider work observed.
- [ ] Each intended Stremio player displayed correctly synchronized subtitles.
- [ ] Startup tested after reboot and user login, with no manual launch.
- [ ] Screen-off/lid behavior tested on the actual host configuration.
- [ ] Provider quota pause and restoration instructions understood.

Never mark an item complete because a mock test, health response or HEAD request
passed. Do not publish authentication, private manifest links or full subtitles.
