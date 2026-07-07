# IVR  

Dati suddivisi per *IVR* (Interactive Voice Response) nel periodo 
impostato, i dati vengono raggruppati secondo la scelta
fatta nei filtri.

I dati degli *IVR* mostrano ogni scelta fatta dai chiamanti 
all'interno di ogni IVR.

Le voci mostrate per i dati *IVR* sono:

- `Periodo di Raggruppamento`
- `Identificativo IVR`: il codice univoco identificativo di ogni IVR
- `Nome IVR`
- `Scelte IVR`: scelte effettuate all'interno dell'IVR. Oltre a quelle 
numeriche previste sono possibili altri valori: `i` indica chi ha fatto
una scelta invalida, cioè non prevista dall'IVR; `t` indica chi non ha 
fatto alcuna scelta, la sua chiamata viene dirottata alla destinazione 
di timeout
- `Totale`: totale delle scelte

Se nessun IVR è stato selezionato, verranno mostrati tutti gli IVR, 
se nessuna scelta è stata selezionata, verranno mostrate tutte le 
scelte presenti.
