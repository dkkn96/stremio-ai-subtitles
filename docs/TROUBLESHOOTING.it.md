# Se qualcosa non funziona

Esegui `npm run doctor`. Per il dominio aggiungi `-- --online`.
Questi controlli non avviano traduzioni. Non pubblicare log o link privati.

| Problema | Cosa fare |
| --- | --- |
| Node o client AI non trovato | Installa il programma ufficiale e riapri Terminale. Verifica il comando `--version`. |
| Accesso Codex assente/scaduto | Esegui `npm run login`, completa personalmente l'accesso ChatGPT e ripeti doctor. |
| Altro account AI da verificare | Completa il login ufficiale. Se accetti il consumo di quota, prova `npm run probe -- --confirm`. |
| Modello/Fast non disponibile | Scegli esplicitamente una configurazione accessibile al tuo account. Nessuna sostituzione è automatica. |
| Quota raggiunta / provider in pausa | Controlla la quota sul sito del fornitore. Dopo il ripristino: `npm run resume -- --confirm`, poi riavvia l'add-on. Non rimuovere i limiti per aggirare quelli del servizio. |
| `DAILY_LIMIT` | È il limite locale dei nuovi lavori. Riparte a mezzanotte UTC. Aumentarlo non cambia le quote della fonte o dell'AI. |
| `QUEUE_FULL` | Attendi la fine delle traduzioni già in corso. |
| Traduzione in corso / HTTP 503 | Attendi e riseleziona la traccia. Alcuni lettori non riprovano da soli. Non vengono consegnati file parziali. |
| Traduzione troppo lenta | Controlla account e connessione. Ridurre `BATCH_SIZE` può aiutare; aumentare troppo il parallelo può invece causare blocchi del fornitore. Non c'è una durata garantita. |
| Risposta AI non valida | Verifica client e modello con la prova di due battute. Il programma rifiuta sottotitoli incompleti o con ID errati. |
| Fonte non valida / errore download | Controlla configurazione e quota della fonte: potrebbe aver restituito un avviso o una pagina di errore. Scegli una fonte/release valida. |
| La lingua non compare | Verifica che l'add-on sia nello stesso account Stremio, chiudi e riapri l'app e controlla che esista una traccia completa nella lingua di partenza. |
| Sottotitoli fuori sincrono | La fonte deve corrispondere alla release video. Il programma conserva i tempi, non li riallinea. |
| iPhone/TV non raggiungono il Mac | Serve il dominio HTTPS, non `127.0.0.1`. Controlla tunnel e Mac sveglio; prova dalla rete mobile. |
| Cloudflare 502 | Verifica che l'add-on sia avviato e che la porta del tunnel corrisponda. Apri `/health` in locale. |
| Non riparte dopo riavvio | Sblocca FileVault e accedi all'utente. Controlla sia servizio add-on sia tunnel. |
| Si interrompe chiudendo il Mac | Tienilo alimentato e verifica la tua configurazione con display esterno. Schermo spento e sospensione sono cose diverse. |
| Porta già occupata | Ferma soltanto la precedente istanza di questo add-on; non terminare servizi estranei. |

Per cambiare lingua o provider, ferma il servizio, esegui setup e poi riavvialo.
Una nuova lingua richiede l'installazione del nuovo manifest; puoi rimuovere la
vecchia voce da Stremio. Le cache delle configurazioni diverse restano separate.

Quando chiedi aiuto indica sistema operativo, versioni, provider/modello, codice
di errore e nome/versione del lettore. Non inviare `.env`, `data`, credenziali,
manifest privati o sottotitoli reali. La pagina inglese [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
contiene il riferimento completo dei codici.
