<?php
/** Prepared, read-only PBX queries. No caller/model supplied SQL. */
class AgentWorkflowData
{
    private $db;
    // Connect through the read-only phonebook and CDR account.
    public function __construct($db) { $this->db = $db; }
    // Normalize and check a caller phone number.
    public static function digits($phone) { return preg_replace('/[^0-9]/', '', (string) $phone); }

    // Read public company contacts for the verified caller number.
    public function contacts($phone)
    {
        if (!is_string($phone) || strlen($phone) > 40 || !preg_match('/^[+0-9 ()-]+$/D', $phone)) { throw new \InvalidArgumentException('invalid_phone'); }
        $number = self::digits($phone); $variants = array($number);
        if (substr($number, 0, 2) === '00') { $variants[] = substr($number, 2); }
        if (substr($number, 0, 2) === '39') { $variants[] = substr($number, 2); }
        $variants = array_values(array_unique($variants));
        $placeholders = implode(',', array_fill(0, count($variants), '?'));
        $conditions = array(); $parameters = array();
        foreach (array('homephone', 'workphone', 'cellphone', 'workphone2', 'cellphone2', 'otherphone') as $column) {
            $conditions[] = "REGEXP_REPLACE(`$column`, '[^0-9]', '') IN ($placeholders)";
            $parameters = array_merge($parameters, $variants);
        }
        $query = $this->db->prepare('SELECT id,name,company FROM phonebook.phonebook WHERE access=\'public\' AND (' . implode(' OR ', $conditions) . ') LIMIT 101');
        $query->execute($parameters); $matches = $query->fetchAll(\PDO::FETCH_ASSOC);
        $companies = array_unique(array_filter(array_column($matches, 'company')));
        if (count($matches) === 0) { return array('status' => 'not_found', 'numbers' => array()); }
        if (count($companies) !== 1 || count($matches) > 100) { return array('status' => 'ambiguous', 'numbers' => array()); }
        $company = reset($companies);
        $query = $this->db->prepare('SELECT homephone,workphone,cellphone,workphone2,cellphone2,otherphone FROM phonebook.phonebook WHERE company=? AND access=\'public\' LIMIT 101');
        $query->execute(array($company)); $contacts = $query->fetchAll(\PDO::FETCH_ASSOC);
        if (count($contacts) > 100) { throw new \RuntimeException('contact_capacity'); }
        $numbers = array();
        foreach ($contacts as $contact) {
            foreach ($contact as $value) { if ($value && strlen($value) <= 40) { $numbers[] = $value; } }
        }
        $numbers = array_values(array_unique($numbers));
        if (count($numbers) > 100) { throw new \RuntimeException('contact_capacity'); }
        return array('status' => 'success', 'company' => $company, 'numbers' => $numbers);
    }

    // Read bounded answered-call history for the allowed numbers.
    public function history(array $numbers, array $support, $days)
    {
        if (count($numbers) > 100 || count($support) > 100 || !is_int($days) || $days < 1 || $days > 365) { throw new \InvalidArgumentException('invalid_history_scope'); }
        foreach ($support as $extension) { if (!is_string($extension) || !ctype_digit($extension)) { throw new \InvalidArgumentException('invalid_extension'); } }
        $digits = array();
        foreach ($numbers as $number) {
            if (!is_string($number) || strlen($number) > 40) { throw new \InvalidArgumentException('invalid_phone'); }
            $digit = self::digits($number); if ($digit) { $digits[] = $digit; if (substr($digit, 0, 2) === '39') { $digits[] = substr($digit, 2); } }
        }
        $digits = array_values(array_unique($digits));
        if (!$digits || !$support) { return array('status' => 'success', 'operators' => array()); }
        $placeholders = implode(',', array_fill(0, count($digits), '?'));
        // Linked call legs include transfers and queue delivery. Answered actual
        // PJSIP/SIP channel names identify operators; dst alone is insufficient.
        $query = $this->db->prepare("SELECT c.linkedid,c.uniqueid,c.calldate,c.channel,c.dstchannel FROM asteriskcdrdb.cdr c
            INNER JOIN (SELECT DISTINCT COALESCE(NULLIF(linkedid,''),uniqueid) AS call_key FROM asteriskcdrdb.cdr
                WHERE calldate>=FROM_UNIXTIME(?) AND (REGEXP_REPLACE(src,'[^0-9]','') IN ($placeholders)
                OR REGEXP_REPLACE(cnum,'[^0-9]','') IN ($placeholders)) ORDER BY call_key DESC LIMIT 200) matched
                ON COALESCE(NULLIF(c.linkedid,''),c.uniqueid)=matched.call_key
            WHERE c.calldate>=FROM_UNIXTIME(?) AND c.disposition='ANSWERED' AND c.billsec>0 ORDER BY c.calldate DESC LIMIT 1000");
        $query->execute(array_merge(array(time() - $days * 86400), $digits, $digits, array(time() - $days * 86400)));
        $operators = array(); $seen = array();
        foreach ($query->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            foreach (array($row['channel'], $row['dstchannel']) as $channel) {
                if (!preg_match('#^(?:PJSIP|SIP)/([0-9]+)-#D', $channel, $match) || !in_array($match[1], $support, true)) { continue; }
                $key = ($row['linkedid'] ?: $row['uniqueid']) . ':' . $match[1];
                if (isset($seen[$key])) { continue; }
                $seen[$key] = true;
                if (!isset($operators[$match[1]])) { $operators[$match[1]] = array('destination_id' => 'extension:' . $match[1], 'last_call' => $row['calldate'], 'call_count' => 0); }
                $operators[$match[1]]['call_count']++;
            }
        }
        return array('status' => 'success', 'operators' => array_values($operators), 'advisory' => true);
    }
}
