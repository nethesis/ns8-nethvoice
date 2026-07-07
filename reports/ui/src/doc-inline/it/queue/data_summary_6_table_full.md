# Chiamate Coda Piena

Dati riguardanti le chiamate fallite per *Coda Piena* per le code selezionate
nel periodo impostato, i dati vengono raggruppati secondo la scelta fatta
nei filtri.

Le chiamate fallite per *Coda Piena* sono le chiamate che all'entrata in 
coda hanno trovato la coda con il massimo numero di chiamate in attesa 
già raggiunto e che di conseguenza non sono state fatte entrare fallendo 
automaticamente.

Le voci mostrate per le chiamate in *Coda Piena* sono:

- `Periodo di Raggruppamento`
- `Numero Coda`
- `Nome Coda`
- `Chiamanti Univoci`: totale numeri telefonici che sono entrati in coda 
contati singolarmente 
- `Totale Chiamate Coda Piena`
- `Totale Richiamate`: il totale delle numerazioni che dopo il fallimento per coda piena sono state richiamate con successo
- `Tempo medio di Richiamata`: il tempo medio trascorso dal fallimento per coda piena alla richiamata


Se nessuna coda è stata selezionata, verranno mostrati i dati di tutte
le code disponibili.
