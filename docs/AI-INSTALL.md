# Install with your AI assistant

Give your assistant this repository URL and one of the following prompts. The
assistant must have access to this repository's files; it needs terminal access
to execute steps. A chat-only assistant must guide you without claiming execution.
You must complete personal authentication, provider terms and domain ownership.

## Prompt in English

> Help me install this Stremio subtitle addon for my own use. Read README.md,
> AGENTS.md, docs/START-HERE.md, docs/PROVIDERS.md and docs/VALIDATION.md first.
> Ask which language, AI provider and playback devices I want. Inspect my OS and
> existing tools; reuse working installations. Use the existing addon, not a new
> application. Prepare configuration and offline checks. Guide me through official
> personal login without asking for secrets. Do not enable API billing, buy credits,
> change my model or alter another deployment without my instruction. Explain the
> hosting requirements before domain or tunnel changes. Ask before live probes use
> my quota. Keep the private manifest and all account/cache files out of GitHub.
> Verify a complete translated track in my actual Stremio player, cache reuse and
> restart behavior. Clearly separate simulated tests from real provider/playback
> results. If you cannot access my computer, guide me one step at a time and do not
> pretend to execute commands.

## Testo in italiano

> Aiutami a installare questo add-on Stremio per uso personale. Leggi README.md,
> AGENTS.md, docs/START-HERE.it.md, docs/PROVIDERS.md e docs/VALIDATION.md.
> Chiedimi la lingua, il servizio AI e i dispositivi che voglio usare. Controlla
> il sistema operativo e i programmi già presenti, riutilizzandoli. Parti
> dall'add-on esistente. Prepara configurazione e prove senza chiamate AI, poi
> guidami nell'accesso ufficiale personale senza chiedermi chiavi o password.
> Non attivare API a pagamento, acquisti o modelli diversi senza mia istruzione.
> Non modificare altre installazioni. Spiegami cosa serve per tenere il servizio
> raggiungibile prima di cambiare dominio o tunnel. Chiedi prima delle prove che
> consumano la mia quota. Non pubblicare manifest privato, account, configurazione
> o cache. Verifica sul mio Stremio una traccia completa, il riuso della cache e il
> comportamento dopo riavvio. Distingui prove simulate da prove reali. Se non puoi
> operare sul computer, guidami dal Terminale un passaggio alla volta senza fingere
> di aver eseguito operazioni.

## Installer workflow for an assistant

1. Inspect Node version, OS, project path and existing service/port usage. Never
   overwrite a running deployment. Keep ports/data/state isolated if testing nearby.
2. Explain what runs locally and what needs HTTPS. Ask only unresolved choices:
   source/target language, translator/provider, host availability, playback devices.
3. Install pinned project dependencies with `npm ci --ignore-scripts`; no live AI
   request or new credential is needed for `npm test` and `npm run smoke`.
4. Let the user select their provider. Use only documented, unmodified clients.
   The wizard is `npm run setup`; for noninteractive setup write equivalent local
   configuration safely, excluding secrets from tool output. Never copy sample
   credentials or another project's authentication.
5. Personal login uses `npm run login`. If the user must choose a model first,
   use `npm run login -- --provider NAME --interactive`. Do not manipulate the
   browser's cookies or tokens to finish authentication.
6. Run doctor. Explain experimental adapter status. After permission for quota use,
   run the synthetic probe. Fix documented version/format incompatibilities rather
   than marking a mock test as success or using an unauthorized fallback.
7. Start in the foreground; verify health, private manifest, unauthorized 404,
   track listing and complete SRT on the chosen episode. HEAD/health checks do not
   prove a new translation. Existing target subtitles can bypass AI by design.
8. Public HTTPS: use the user's own domain and tunnel/proxy. Ask before changes to
   DNS/account security. A browser login wall on the subtitle endpoint breaks TV
   clients; the addon uses its random private path. Do not publish that path.
9. Install startup only after foreground checks. Test actual restart/login and
   sleep/lid behavior on that host. Never disable FileVault or password protection.
10. Hand over short start/stop/check/update instructions, actual validation status,
    and the private install link only to its owner. Never post raw diagnostic logs.

Stop for personal login, unresolved quota/billing choices or unavailable provider
access. Complete independent offline work while waiting. Preserve explicit user
authorizations already given. Do not invent a provider success or OS certification.
