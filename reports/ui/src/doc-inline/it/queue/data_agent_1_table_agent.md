# Per Agente

Dati suddivisi *per Agente* e code selezionati nel periodo impostato, 
i dati vengono raggruppati secondo la scelta fatta nei filtri.

I dati *per Agente* mostrano l'attività lavorativa e il carico delle 
telefonate di ogni agente selezionato.

Le voci mostrate per i dati *per Agente* sono:

- `Periodo di Raggruppamento`
- `Agente`
- `Numero Coda`
- `Nome Coda`
- `Giorni Lavorativi`: giorni con attività nel periodo selezionato
- `Login`: tempo totale di login in coda. Se si tratta di un agente statico, viene mostrato `-`
- `Pausa`: tempo totale di pausa in coda
- `Dopo Chiusura`: il totale del tempo che ogni coda può concedere 
alla chiusura di ogni chiamata risposta prima di sottoporne un'altra
- `Effettiva`: il tempo effettivo di lavoro che è la differenza tra il 
tempo di Login e la somma di tempo di Pausa e tempo di Dopo Chiusura 
- `Totale Chiamate`: tempo totale di conversazione nelle chiamate 
risposte
- `Risposte`: numero totale delle chiamate risposte
- `Non risposte`: numero totale delle chiamate non risposte
- `Trasferite`: numero totale di risposte a chiamate da trasferimento
- `Chiamate all'ora`: il rapporto tra il numero di chiamate risposte e il 
tempo effettivo in ore
- `Occupazione`: la percentuale di tempo effettivo passato al telefono
- `Totale Richiamate`: il totale delle richiamate effettuate con successo
- `Tempo medio di Richiamata`: il tempo medio trascorso dal fallimento alla richiamata
- `Durata Minima, Massima e Media`: durata delle chiamate risposte

Se nessun agente è stato selezionato, verranno mostrati i dati di tutti 
gli agenti. Se nessuna coda è stata selezionata, verranno mostrati gli 
agenti di tutte le code disponibili.
