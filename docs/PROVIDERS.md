# Choose an AI provider

Documentation checked 2026-10-31. Client interfaces, model catalogs, terms and
subscription eligibility can change. Use the official links below, then run the
opt-in probe with your own account. Offline adapter tests are not live validation.

All CLI profiles use dedicated local state. No account files are bundled or
copied from another installation. Each user installs the official client and
completes its native login. Never paste cookies, tokens, passwords or auth files
into an assistant chat. The installation assistant and runtime translator may
be different products.

The templates in `profiles/` describe the selectable profiles. Blank model fields
mean you must choose a model yourself. The setup wizard writes your private `.env`.
It does not install clients, create accounts or enroll you in paid services.

## Codex — subscription profile

- Official [installation](https://learn.chatgpt.com/docs/cli),
  [authentication](https://learn.chatgpt.com/docs/auth) and
  [non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode).
- Install the official CLI. In setup choose `codex`.
- Preset: `AI_MODEL=gpt-6-luna`, `AI_REASONING=max`, `CODEX_SERVICE_TIER=fast`.
- Run `npm run login`; complete ChatGPT sign-in. Run doctor, then the opt-in probe.
- The runner uses `--ignore-user-config`; reasoning and Fast are set explicitly
  on every run. It disables tools and uses structured output. Your normal global
  Codex configuration does not control subtitle requests.
- An unavailable model/tier is an error, not permission to use another one.
- Subscription quota is shared according to your provider plan. This project
  does not promise unlimited use or enable extra credits.

## Gemini CLI — experimental subscription/Google-login profile

- Official [installation](https://geminicli.com/docs/get-started/installation/),
  [authentication](https://geminicli.com/docs/get-started/authentication/),
  [headless output](https://geminicli.com/docs/cli/headless/) and
  [settings](https://geminicli.com/docs/reference/configuration/).
- Install the official Gemini CLI, then confirm `gemini --version` works.
- To sign in before choosing a model, run `npm run login -- --provider gemini`.
  Select **Sign in with Google**. In the client use its model menu (`/model`) to
  find a model available to you, then exit the client.
- Run setup, choose `gemini`, and enter the selected model identifier.
- `npm run login` reopens the same dedicated account. Complete the opt-in probe.
- The adapter uses streaming JSON, waits for success and rejects tool events.
  Its dedicated settings set an empty core-tool allowlist. CLI state lives under
  `data/accounts/gemini`; do not add extensions, hooks or MCP servers there.
- Google login eligibility/limits depend on account and plan. API keys and Vertex
  credentials are not inherited by this profile.

## Claude Code — experimental personal-client profile

- Official [setup](https://code.claude.com/docs/en/setup),
  [CLI reference](https://code.claude.com/docs/en/cli-reference),
  [headless execution](https://code.claude.com/docs/en/headless) and
  [integration terms](https://code.claude.com/docs/en/legal-and-compliance).
- Install the unmodified official client. Confirm `claude --version` works.
- `npm run login -- --provider claude` starts its official authentication.
  To inspect its model menu before setup, use
  `npm run login -- --provider claude --interactive`, then `/model` and exit.
- Run setup, choose `claude`, enter the model identifier, and run the opt-in probe.
- The adapter disables built-in/MCP tools and hooks for the translation session,
  requests schema-constrained output and checks errors even when the process exits 0.
  It does not use `--bare`, which skips subscription authentication.
- Anthropic's terms distinguish an unmodified client used by its own authenticated
  user from embedding Claude.ai OAuth in another product. This project does not
  implement a Claude.ai login or handle subscription tokens. Read the current
  integration terms before distributing a hosted or bundled variant. Client
  authentication methods are not modified; choose the intended one personally.

## Grok Build — experimental ACP profile

- Official [getting started](https://docs.x.ai/build/overview),
  [CLI reference](https://docs.x.ai/build/cli/reference),
  [ACP/headless guide](https://docs.x.ai/build/cli/headless-scripting) and
  [settings reference](https://docs.x.ai/build/settings/reference).
- Install the current official Grok Build client (`grok`). Old launch material
  used a different executable name; this adapter targets the current documented CLI.
- Confirm `grok --version`, then `npm run login -- --provider grok`.
- To inspect available models: `npm run login -- --provider grok --interactive`,
  use its model picker, and exit. Choose that exact model in setup.
- The adapter uses ACP with cached personal authentication, denies client tool
  requests, sets the documented CLI deny filters for file/shell/MCP/web tools,
  and confirms the selected model against the session model catalog.
  It never falls back to `XAI_API_KEY`. Complete the opt-in probe.
- The client is configured with its own `GROK_HOME`; inherited agent settings,
  compatibility scanners and updater are disabled for translation workers.
  Availability and allowance depend on your xAI account. Access is not promised
  merely because you can use the Grok website.

## OpenCode — experimental provider/model bridge

- Official [installation](https://opencode.ai/docs/),
  [CLI](https://opencode.ai/docs/cli/), [providers](https://opencode.ai/docs/providers/)
  and [permissions](https://opencode.ai/docs/permissions/).
- Install OpenCode, then `npm run login -- --provider opencode` to configure your
  chosen provider in the dedicated local state. The provider may require a key;
  its own terms and billing apply. Read them before connecting it.
- The model must use `provider/model` form. Inspect the client using
  `npm run login -- --provider opencode --interactive`, then exit.
- Run setup, choose `opencode`, enter that model, and run the opt-in probe.
- Translation sessions deny tool permissions and consume completed text events.
  The dedicated account uses separate XDG directories. Custom plugins/MCP tools
  are not part of the qualified translation path.
- OpenCode does not itself guarantee that a subscription from another provider
  can be used. Use a supported authentication route; do not transplant OAuth files.

## Optional APIs and local compatible servers

These modes are optional and are never used as fallback from any CLI profile.
Selecting them requires `ALLOW_PAID_API=true`. The flag also applies to local
servers: it is an explicit transport opt-in, not an assertion that a local model
costs money. No key, credit purchase or API account is created by setup.

**OpenAI:** select `openai-api`, specify a model and store your own `AI_API_KEY`
privately in `.env`. Uses the Responses endpoint with a structured JSON schema.
See [official authentication](https://learn.chatgpt.com/docs/auth) for the
separation between CLI subscription and API authentication.

**Compatible endpoint:** select `compatible-api`, provide `AI_MODEL` and the base
URL ending in `/v1` when required. Remote endpoints require HTTPS and your own key.
Loopback HTTP is accepted for local servers. The adapter appends `/chat/completions`
and requires `response_format: json_object`, a completed `stop` response and valid
cue JSON. See [xAI's documented endpoint](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions)
for one compatible service. Test each endpoint/model combination; some providers
have different APIs or do not support these parameters. Native Gemini and Claude
API protocols are not implemented in this release.

Keys are entered privately on the user's own computer, never committed or pasted
into chat. Set spending controls at the provider if applicable. The addon limits
jobs, cues, concurrency, time and output, but it does **not** guarantee a monetary
ceiling. Request/token prices and subscription allowances are not hardcoded.

## Final gate for every provider

1. `npm run doctor` finds the client/configuration.
2. `npm run probe -- --confirm` produces valid translated synthetic cues.
3. Start the addon and verify one real episode/release on each intended player.
4. Check repeat playback reuses cache; check a service restart.
5. Record OS, client version, model, exact result and limitations without secrets.

Only then describe that combination as tested. See [VALIDATION.md](VALIDATION.md).
