# Collegamento HTTPS e avvio automatico sul Mac

Il server è il tuo computer. Deve restare sveglio e online durante l'uso.
GitHub ospita il codice, non questo servizio. Ogni utente usa i propri account.

## Prima prova con un indirizzo temporaneo

Installa `cloudflared` dai [download ufficiali](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).
Con l'add-on già avviato tramite `npm start`, apri un altro Terminale ed esegui:

```sh
cloudflared tunnel --url http://127.0.0.1:7017
```

Verrà mostrato un indirizzo HTTPS che termina con `trycloudflare.com`.
Cloudflare farà da intermediario al traffico, inclusi i sottotitoli: usa questa
opzione se accetti questo transito. In `.env` cambia `PUBLIC_BASE_URL` con
l'indirizzo completo, senza aggiungere percorsi. Ferma l'add-on con Control-C e
riavvialo con `npm start`. Esegui `npm run link` e installa il nuovo manifest HTTPS.

Tieni aperti entrambi i Terminali. Alla ripartenza il tunnel temporaneo può cambiare
indirizzo: in quel caso devi aggiornare l'add-on in Stremio. È una prova, non una
sistemazione permanente.

## Indirizzo permanente

Servono un account Cloudflare e un dominio che controlli, già attivo su Cloudflare.
Il dominio può avere un costo; il programma non acquista nulla. Se stai spostando
un dominio esistente, fatti aiutare a preservare tutti i DNS e DNSSEC prima di
cambiare nameserver. Non disattivare protezioni seguendo comandi generici.

Scegli un sottodominio libero e dedicato, per esempio `subtitles.tuodominio.it`.
Poi, dal Terminale:

```sh
cloudflared tunnel login
cloudflared tunnel create stremio-ai-subtitles
```

Autorizza personalmente il browser. Annota privatamente l'UUID del tunnel e il
percorso del file credenziali indicato dal comando. Crea la cartella `runtime`
nel progetto e al suo interno il file `tunnel.yml`:

```yaml
tunnel: UUID-DEL-TUO-TUNNEL
credentials-file: /percorso/assoluto/del/file-credenziali.json
ingress:
  - hostname: subtitles.tuodominio.it
    service: http://127.0.0.1:7017
  - service: http_status:404
```

Sostituisci i tre valori di esempio con i tuoi, senza pubblicare il file. Se hai
scelto un'altra porta, cambia anche `7017`. Ora collega soltanto quel sottodominio:

```sh
cloudflared tunnel route dns stremio-ai-subtitles subtitles.tuodominio.it
cloudflared tunnel --config runtime/tunnel.yml ingress validate
cloudflared tunnel --config runtime/tunnel.yml run
```

In `.env` imposta `PUBLIC_BASE_URL=https://subtitles.tuodominio.it`, riavvia
l'add-on ed esegui `npm run doctor -- --online`. Apri anche `/health` sul dominio.
Con `npm run link` ottieni il manifest definitivo da installare in Stremio.
Provalo da iPhone usando la rete mobile oltre al Wi-Fi.

Non applicare una pagina di login Cloudflare Access o una verifica interattiva ai
percorsi dell'add-on: i lettori Stremio non possono completarla. La protezione è
il percorso privato casuale dell'add-on. Non serve aprire porte sul router.
Conserva il token se vuoi mantenere lo stesso link.

## Avvio automatico

Prima verifica add-on e tunnel in primo piano, poi fermali con Control-C.
Nella cartella del progetto esegui:

```sh
npm run service -- generate
```

Questo prepara soltanto il file di avvio. Per installare il servizio dell'add-on:

```sh
npm run service -- install
```

Il servizio partirà all'accesso dell'utente e ripartirà dopo un errore. Impedisce
la sospensione inattiva durante l'esecuzione, con il Mac alimentato; lo schermo
può spegnersi. Non disabilita FileVault, password o protezioni del coperchio.
Se macOS chiede di consentire l'elemento in background, decidi personalmente.

Per il tunnel permanente, trova il percorso del programma:

```sh
command -v cloudflared
```

Usa esattamente il percorso mostrato al posto dell'esempio:

```sh
npm run service -- install --tunnel-config runtime/tunnel.yml --cloudflared /percorso/assoluto/cloudflared
```

Controlli e rimozione dei due servizi:

```sh
npm run service -- status
npm run service -- status --tunnel-config runtime/tunnel.yml
npm run service -- remove
npm run service -- remove --tunnel-config runtime/tunnel.yml
```

La rimozione conserva account, impostazioni, cache e tunnel Cloudflare.
Il servizio salva percorsi assoluti: se sposti la cartella o cambi la posizione
di Node, reinstallalo. I log sono privati in `runtime`; possono essere eliminati
o ruotati quando il servizio è fermo.

## Prova dopo il riavvio

Riavvia, sblocca FileVault e accedi al Mac. Senza aprire Terminale, verifica il
dominio e una traccia Stremio da un altro dispositivo. Poi prova lo schermo spento
e la tua configurazione con coperchio chiuso. Il comando per mantenere il Mac
sveglio non garantisce da solo il funzionamento con ogni configurazione del coperchio.
Tieni il Mac collegato all'alimentatore.

Per aggiornare, ferma i servizi, salva privatamente `.env`, `data` e le credenziali
del tunnel, aggiorna e ripeti i controlli. Non copiare login tra utenti o sistemi
operativi diversi. Riferimento: [guida ufficiale Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/).
