# Scegli l'AI per tradurre

Documentazione verificata il 31 ottobre 2026. Il modello deve essere disponibile
nel tuo account: il programma non può prometterlo in base al solo abbonamento.
I client sono quelli ufficiali, installati separatamente e non modificati.
L'AI che ti aiuta nell'installazione può essere diversa dal traduttore scelto.

La base Codex deriva dall'installazione privata funzionante. Gemini, Claude,
Grok e OpenCode sono **adattatori sperimentali**, verificati con risposte simulate:
per usarli devi completare la prova sul tuo account. I test non dimostrano qualità,
velocità o funzionamento sul tuo lettore Stremio.

## Codex

Installa il [client ufficiale](https://learn.chatgpt.com/docs/cli):

```sh
npm install -g @openai/codex
codex --version
```

In `npm run setup -- --it` scegli `codex`. Il preset richiede `gpt-6-luna`, reasoning
`max` e Fast. Poi esegui `npm run login` e scegli personalmente il tuo account
ChatGPT. L'accesso è salvato nell'area dedicata all'add-on.
Se modello o Fast non sono disponibili, ricevi un errore: non viene usata un'API
a pagamento né un altro modello. [Autenticazione ufficiale](https://learn.chatgpt.com/docs/auth).

## Gemini

Installa Gemini CLI seguendo la [guida ufficiale](https://geminicli.com/docs/get-started/installation/)
e verifica `gemini --version`. Per accedere prima di scegliere il modello:

```sh
npm run login -- --provider gemini
```

Scegli **Sign in with Google**. Usa `/model` nel client per vedere i modelli del tuo
account; annota l'identificativo desiderato ed esci. Poi avvia setup, scegli
`gemini` e inserisci quel modello. [Opzioni di accesso](https://geminicli.com/docs/get-started/authentication/).
Questo profilo non usa automaticamente chiavi API o credenziali Vertex AI.

## Claude

Installa Claude Code dalla [guida ufficiale](https://code.claude.com/docs/en/setup)
e verifica `claude --version`. Accedi:

```sh
npm run login -- --provider claude
```

Per vedere il menu modelli puoi aprire il client dedicato:

```sh
npm run login -- --provider claude --interactive
```

Usa `/model`, scegli un identificativo disponibile ed esci. In setup seleziona
`claude` e quel modello. Il programma richiama Claude Code ufficiale: non incorpora
il login del sito Claude.ai e non legge i token dell'abbonamento.
Le [condizioni d'integrazione Anthropic](https://code.claude.com/docs/en/legal-and-compliance)
restano applicabili, soprattutto se vuoi distribuire una variante ospitata per altri.

## Grok

Installa Grok Build dalla [guida ufficiale](https://docs.x.ai/build/overview)
e verifica `grok --version`. Il programma attuale si chiama `grok`; materiale
più vecchio può indicare un altro nome. Accedi:

```sh
npm run login -- --provider grok
```

Per consultare i modelli usa `npm run login -- --provider grok --interactive`,
poi esci. In setup scegli `grok` e l'identificativo del modello. Il collegamento
richiede che il client confermi quel modello: non lo sostituisce.
L'accesso al sito Grok non garantisce accesso al client e alla sua quota.
[Interfaccia ufficiale per automazioni](https://docs.x.ai/build/cli/headless-scripting).

## OpenCode

Installa [OpenCode](https://opencode.ai/docs/) e verifica `opencode --version`.
Configura personalmente il fornitore nel suo accesso dedicato:

```sh
npm run login -- --provider opencode
```

Il fornitore scelto può richiedere una chiave e prevedere costi: verifica prima le
sue condizioni. Puoi consultare il client con
`npm run login -- --provider opencode --interactive`. Il modello va indicato come
`fornitore/modello`. In setup scegli `opencode` e quel valore.
OpenCode non rende automaticamente utilizzabili gli abbonamenti di altri servizi;
usa soltanto i [collegamenti supportati](https://opencode.ai/docs/providers/).

## Prova finale

Dopo setup e login, per ogni provider:

```sh
npm run doctor
npm run probe -- --confirm
```

Il secondo comando invia due battute inventate alla tua AI e consuma quota; usalo
se accetti questa prova. Controlla il testo, poi avvia l'add-on e prova un episodio
nel tuo Stremio. Una prova riuscita vale per quella configurazione, non per tutte
le combinazioni di account, modelli e dispositivi.

## API facoltative

I profili `openai-api` e `compatible-api` sono separati. Setup richiede una scelta
esplicita per abilitarli; possono essere fatturati dal fornitore. La chiave si
inserisce privatamente in `.env`, mai nella chat o in GitHub. Il programma non
crea chiavi, acquista crediti o passa alle API quando finisce la quota del client.

Il profilo compatibile supporta il formato Chat Completions di alcuni servizi e
server locali; ogni combinazione va verificata. I protocolli API nativi Gemini
e Claude non sono implementati in questa versione. I limiti locali di lavori e
richieste non garantiscono un tetto di spesa in euro.
Il riferimento tecnico completo è in [PROVIDERS.md](PROVIDERS.md).
