#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
test_name="nv-phase5-maria-$$"
cleanup() { docker rm -fv "$test_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$test_name" -p 127.0.0.1::3306 \
  -e MARIADB_ROOT_PASSWORD=phase5-isolated -e MARIADB_ROOT_HOST=% mariadb:10.11.19 >/dev/null
for ((attempt=0; attempt<120; attempt++)); do
  if docker exec "$test_name" mariadb-admin ping -h127.0.0.1 -uroot -pphase5-isolated >/dev/null 2>&1; then break; fi
  sleep 0.25
done
docker exec -i "$test_name" mariadb -uroot -pphase5-isolated <<'SQL'
CREATE DATABASE asterisk; CREATE DATABASE phonebook; CREATE DATABASE asteriskcdrdb;
SQL
docker exec -i "$test_name" mariadb -uroot -pphase5-isolated < "$root/mariadb/docker-entrypoint-initdb.d/40_phonebook.phonebook-schema.sql"
docker exec -i "$test_name" mariadb -uroot -pphase5-isolated < "$root/mariadb/docker-entrypoint-initdb.d/20_asteriskcdrdb.cdr-schema.sql"
docker exec -i "$test_name" mariadb -uroot -pphase5-isolated <<'SQL'
GRANT SELECT ON phonebook.phonebook TO 'satellite_workflow'@'%' IDENTIFIED BY 'phase5-reader';
GRANT SELECT ON asteriskcdrdb.cdr TO 'satellite_workflow'@'%';
INSERT INTO phonebook.phonebook(name,company,cellphone,access) VALUES
 ('Caller','Fixture Company','+39 333 1234567','public'),('Colleague','Fixture Company','+393331234568','public'),
 ('Private','Fixture Company','+393331234569','private'),('Other','Other Company','+393331234570','public');
INSERT INTO asteriskcdrdb.cdr(calldate,src,cnum,linkedid,uniqueid,channel,dstchannel,disposition,billsec) VALUES
 (NOW(),'3331234567','3331234567','call-1','leg-1','PJSIP/trunk-1','PJSIP/201-0001','ANSWERED',10),
 (NOW(),'3331234567','3331234567','call-1','leg-2','PJSIP/201-0001','PJSIP/trunk-1','ANSWERED',10),
 (NOW(),'3331234568','3331234568','','empty-matched','PJSIP/trunk-2','PJSIP/202-0002','ANSWERED',10),
 (NOW(),'9999999999','9999999999','','empty-other','PJSIP/trunk-3','PJSIP/205-0003','ANSWERED',10),
 (NOW(),'3331234567','3331234567','call-2','leg-3','PJSIP/trunk-4','PJSIP/203-0004','NO ANSWER',0);
SQL
test_port=$(docker port "$test_name" 3306/tcp | sed -n 's/^127\.0\.0\.1://p')
PHASE5_DB_PORT="$test_port" php "$root/satellite/tests/test_workflows_pbx.php"
PHASE5_DB_PORT="$test_port" php "$root/satellite/tests/test_agent_clone.php"
