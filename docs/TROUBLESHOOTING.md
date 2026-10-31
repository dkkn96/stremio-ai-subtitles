# Troubleshooting

Start with `npm run doctor`. It does not send a translation request. Add `-- --online`
to check the configured HTTPS health endpoint. Do not post raw logs or private links.

| Symptom | Check / next action |
| --- | --- |
| `command not found: node` | Install Node LTS, reopen Terminal; Node must be >=22.12. |
| AI client missing | Follow the chosen official provider installation, then confirm its `--version`. |
| Codex login missing | `npm run login`; use your own ChatGPT account, then doctor. |
| Other CLI login/model unknown | Official login followed by `npm run probe -- --confirm` if you accept quota use. |
| Model/tier unsupported | Select an available model/settings explicitly. No automatic replacement or API fallback. |
| `PROVIDER_PAUSED`, `PROVIDER_QUOTA`, `CODEX_USAGE_LIMIT` | Check the provider's own allowance/reset. After it recovers, run `npm run resume -- --confirm`, then restart the addon. Do not remove guards to evade limits. |
| `DAILY_LIMIT` | Local admission limit reached (UTC day). Ready translations remain accessible. Increasing this does not increase source or AI allowances. |
| `QUEUE_FULL` | Wait for current work; repeated requests for the same job do not create duplicate AI work. |
| `TRANSLATION_PENDING` / HTTP 503 | Wait, then reselect the track. Some players do not retry automatically. No placeholder SRT is served. |
| `PROVIDER_TIMEOUT` / `CODEX_TIMEOUT` | Check account/network, use smaller `BATCH_SIZE` or a longer bounded timeout. More parallelism can increase rate limits. |
| `PROVIDER_INVALID_JSON`, incomplete cues | The model/client did not meet the contract. Check version and model using the probe. Invalid tracks are not published. |
| `PROVIDER_TOOL_ATTEMPT` | The client attempted a non-translation tool operation. Keep restrictions enabled; report a sanitized reproduction. |
| `SOURCE_HTTP_ERROR` or `INVALID_SUBTITLE` | Source may have hit a download limit or returned an error instead of subtitle text. Check its configuration/account or choose another legitimate source/release. Do not send error pages to AI. |
| Language/track missing | Confirm addon is installed in the correct Stremio account, fully close/reopen the client, then confirm the selected source has a full track in the configured source language. |
| Track appears but is out of sync | Choose a source matching the actual release. Timing is preserved, not realigned by AI. |
| Phone/TV cannot connect | Do not use `127.0.0.1`; check public HTTPS, tunnel and awake host. Test from mobile data. |
| Cloudflare 502 | Local addon is stopped, wrong port, or tunnel origin misconfigured. Check local `/health`. |
| Cloudflare tunnel unavailable | Check tunnel process/account/credentials and DNS. Keep credentials private. |
| Failure after reboot | Unlock FileVault and log in; check both services. macOS startup is per user, not pre-login. |
| Failure with closed lid | Connect power; test the actual external-display arrangement. Screen-off and sleep are different. |
| `EADDRINUSE` / instance lock | Another process owns the port/data directory. Stop your own earlier instance; do not kill unrelated services. After a crash a stale data lock may take ~30 seconds to expire. |
| CLI update breaks adapter | Verify official flags/formats for that exact version. Restore a known working client version; keep the provider marked experimental until a live probe passes. |

## Checking a job

The private listing returns a track URL ending in `/subtitle/JOB_ID.srt`. The
corresponding `/status/JOB_ID.json` path on the **same private base** returns the
state and completed cue count. GET on the listing can start a new job. HEAD and
health checks never start AI work. Do not paste these private URLs into an issue.

## Changing language or provider

Stop the service, rerun setup, login/probe if needed and restart. A changed target
language changes the addon identity: install the new manifest and remove the old
language entry if you no longer need it. Provider/model/language changes have
separate cache identities; old cached files are retained but not mixed into new jobs.

## Sharing a useful bug report

Include OS, Node and client versions, provider/model, safe error code, whether the
offline smoke test passes, and which playback app/version you used. Use invented
text to reproduce parsing problems. Never include `.env`, `data`, credentials,
private source URLs, the addon token, full source subtitles or unreviewed logs.
