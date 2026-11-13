SELECT
    Group_concat(DISTINCT prefisso, ",", comune, ",", provincia, ",", regione)
FROM
    zone
GROUP BY prefisso
ORDER BY comune;
