# Installa il tuo add-on Stremio AI Subtitles

Questa guida parte da un Mac senza il progetto. Ogni persona usa il proprio
computer e account AI. Il computer dovrà restare acceso e collegato a Internet
mentre guardi Stremio. La prima versione è preparata per macOS; Linux e Windows
non sono ancora collaudati su installazioni reali.

Puoi anche dare il repository al tuo assistente AI insieme al testo di
[AI-INSTALL.md](AI-INSTALL.md): potrà eseguire la preparazione se ha accesso al
Terminale, oppure accompagnarti un passaggio alla volta. I login li completi tu.

## 1. Installa Node.js

Scarica la versione LTS da [nodejs.org](https://nodejs.org/en/download) e completa
l'installazione. Serve Node 22.12 o successivo.
Apri **Terminale**, in Applicazioni → Utility. Esegui separatamente:

```sh
node --version
npm --version
```

Entrambi devono mostrare un numero. Se un comando non viene trovato, chiudi e
riapri Terminale dopo l'installazione. Prima di continuare risolvi questo passaggio.

## 2. Scarica il progetto

Nella pagina GitHub del progetto scegli **Code → Download ZIP**. Estrai lo ZIP e
metti la cartella in una posizione stabile, per esempio Documenti.
Nel Terminale scrivi `cd `, con lo spazio finale, trascina la cartella dal Finder
nella finestra del Terminale e premi Invio. Ora esegui:

```sh
npm ci --ignore-scripts
```

Il comando prepara i componenti del programma. Non attiva account AI o pagamenti.
Se compare un errore, non aggiungere `sudo` alla cieca: fallo leggere all'assistente.

## 3. Scegli e installa il client AI

Il percorso iniziale più vicino alla versione originale è **Codex**, con il tuo
account ChatGPT idoneo. Per installare il client ufficiale:

```sh
npm install -g @openai/codex
codex --version
```

Per Gemini, Claude, Grok e OpenCode trovi i collegamenti ufficiali e i passaggi in
[guida ai servizi AI](PROVIDERS.it.md). I quattro adattatori aggiuntivi sono sperimentali:
le prove automatiche simulano le loro risposte; la prova sul tuo account è necessaria.

L'AI che ti aiuta a installare il progetto può essere diversa da quella che scegli
per tradurre. Non condividere chiavi o file di accesso con l'assistente.

## 4. Configura l'add-on

```sh
npm run setup -- --it
```

Rispondi alle domande. Per iniziare con Codex puoi tenere `codex` e `gpt-6-luna`.
La configurazione richiede reasoning `max` e Fast esplicitamente: se non sono
accessibili al tuo account, il programma segnala l'errore e non li sostituisce.

Scegli la lingua di partenza e quella desiderata: per esempio `eng` → `ita`, oppure
`eng` → `hun`. Tieni porta `7017` e indirizzo locale per la prima prova.
La fonte predefinita è l'add-on OpenSubtitles. Se usi Subtitle Sync, incolla il suo
manifest completo, con la configurazione privata. La fonte di riserva è facoltativa.

Il limite iniziale di 20 nuovi lavori al giorno è una protezione del programma:
non modifica i limiti del tuo account AI o della fonte. Un lavoro ammesso ma poi
fallito può essere contato; il contatore riparte a mezzanotte UTC.

Al termine viene creato `.env`, un file privato. Non caricarlo su GitHub.
Una nuova esecuzione della configurazione chiede prima di modificarlo e salva
una copia di sicurezza, anch'essa da tenere privata.

## 5. Accedi personalmente

```sh
npm run login
npm run doctor
```

Completa l'accesso nel client ufficiale. Per Codex scegli il tuo account ChatGPT.
L'accesso è dedicato a questo add-on, nella cartella `data/accounts`.
Il controllo non deve segnalare client mancante o login Codex assente. È normale
che il server locale non sia ancora in esecuzione.

Per verificare davvero modello e traduzione, accettando un piccolo consumo della
tua quota, esegui:

```sh
npm run probe -- --confirm
```

Devono apparire due battute inventate tradotte. Se hai scelto esplicitamente le
API, questa prova può essere fatturata dal fornitore. Non è necessaria alcuna API
per il profilo Codex con abbonamento. I modelli non disponibili non vengono sostituiti.

## 6. Avvia e controlla il collegamento

```sh
npm start
```

Lascia aperto questo Terminale. Nel browser del Mac apri
`http://127.0.0.1:7017/health`: deve apparire `status: ok`. Questo verifica il server,
non la qualità della traduzione.

Apri un secondo Terminale, entra nella stessa cartella e scrivi:

```sh
npm run link
```

Apri il collegamento che finisce con `/install`. La pagina consente di aprire
Stremio o copiare il manifest nel campo per installare un add-on da URL.
Il collegamento è **privato**: chi lo possiede può consumare la tua quota.
Il nome dell'add-on contiene la lingua scelta.

## 7. Usa iPhone e TV

L'indirizzo `127.0.0.1` funziona solo sul computer stesso: su iPhone indica l'iPhone.
Per raggiungere il Mac dagli altri dispositivi segui [HOSTING.it.md](HOSTING.it.md).
Prima puoi provare un collegamento HTTPS temporaneo; per mantenere lo stesso
link serve un nome permanente e un dominio sotto il tuo controllo.
Il dominio può avere un costo di registrazione. Il progetto non compra nulla.

Imposta l'indirizzo HTTPS in `.env`, riavvia il server con Control-C e `npm start`,
poi esegui di nuovo `npm run link`. Installa in Stremio questo manifest HTTPS.

## 8. Fai la prova completa

Accedi allo stesso account Stremio sui dispositivi. Dopo l'installazione chiudi
completamente e riapri Stremio se l'add-on o la lingua non compaiono subito.

1. Apri un episodio e scegli la release che vuoi guardare.
2. Cerca la lingua desiderata nei sottotitoli; il nome può essere tradotto dal lettore.
3. Scegli la traccia **AI Subtitles**. La prima traduzione può richiedere attesa:
   se il lettore non riprova automaticamente, riselezionala dopo un po'.
4. Controlla inizio, metà e fine dell'episodio. Il sincronismo dipende dalla fonte
   e dalla release: la traduzione conserva i tempi, non corregge una fonte sbagliata.
5. Riprova la stessa release: una traduzione completa in cache non deve essere rifatta.
6. Prova ogni dispositivo che userai, inclusa la TV.

Per impostazione iniziale viene preferita una traccia già esistente nella lingua
richiesta. Per misurare una nuova traduzione scegli un episodio non in cache e
imposta `PREFER_EXISTING=false`, mantenendo attive le altre protezioni.

## 9. Avvio automatico

Dopo la prova in primo piano, ferma il server con Control-C e segui la sezione
Mac di [HOSTING.it.md](HOSTING.it.md). Il servizio riparte dopo l'accesso dell'utente:
con FileVault devi sbloccare il Mac dopo un riavvio. Tienilo alimentato e verifica
personalmente cosa succede chiudendo il coperchio. Non disabilitare le protezioni
del Mac. Non servono modifiche a ogni riavvio se il servizio è installato correttamente.

Per problemi consulta [TROUBLESHOOTING.it.md](TROUBLESHOOTING.it.md).
