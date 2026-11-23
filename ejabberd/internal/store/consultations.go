package store

// Receipts contain bounded correlation metadata only, never chat bodies.
func (s *Store) PruneConsultationReceipts(before int64) {
	s.db.Exec(`DELETE FROM meta WHERE key LIKE 'consultation:%' AND unixepoch(json_extract(value,'$.expires_at')) < ?`, before)
}

func (s *Store) ConsultationReceipts() []string {
	rows, err := s.db.Query(`SELECT value FROM meta WHERE key LIKE 'consultation:%' ORDER BY key LIMIT 512`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	result := []string{}
	for rows.Next() {
		var value string
		if rows.Scan(&value) == nil {
			result = append(result, value)
		}
	}
	return result
}
