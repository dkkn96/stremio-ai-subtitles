# Contributing

Read AGENTS.md and docs/ARCHITECTURE.md. Keep changes focused on the Stremio addon.

1. Install Node >=22.12 and run `npm ci --ignore-scripts`.
2. Run `npm test` and `npm run smoke`; neither needs an AI account.
3. Add a meaningful regression test for a behavior change, using invented dialogue.
4. Run `npm run check:release` and inspect the staged diff before submitting.

Never commit `.env`, data, account sessions, private source URLs, tokens, cache,
logs or real subtitle files. Tests must not make paid network calls or use your
personal AI login. Native provider/OS tests are opt-in and documented separately.

Provider adapters must preserve selected model, cue IDs and original timestamps;
reject partial output/tool attempts; use bounded requests and safe errors; never
silently switch accounts, providers or billing paths. Link official documentation
and record the client version for any live compatibility claim.

Update English/Italian guides when changing the installation experience. Do not
bundle modified official AI clients or reintroduce the removed noncommercial SDK.
