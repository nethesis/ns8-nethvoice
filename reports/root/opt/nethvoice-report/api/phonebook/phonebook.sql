SELECT DISTINCT
   COALESCE(name, '') AS name,
   COALESCE(company, '') AS company,
   COALESCE(homephone, '') AS homephone,
   COALESCE(workphone, '') AS workphone,
   COALESCE(cellphone, '') AS cellphone
FROM
   phonebook
WHERE
   (
      (name IS NOT NULL
      AND name != "")
      OR (company IS NOT NULL
      AND company != "")
   )
   AND
   (
      (homephone IS NOT NULL
      AND homephone != ""
      AND homephone REGEXP ('^[0-9]+$'))
      OR (workphone IS NOT NULL
      AND workphone != ""
      AND workphone REGEXP ('^[0-9]+$'))
      OR (cellphone IS NOT NULL
      AND cellphone != ""
      AND cellphone REGEXP ('^[0-9]+$'))
   )
ORDER BY
   name;
