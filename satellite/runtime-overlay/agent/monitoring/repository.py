"""Bounded PostgreSQL history. Called only from worker threads, never the voice loop."""

import base64
import json
import hashlib
import math
import os
import time

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .policy import validate_policy

SCHEMA = "agent_monitoring"
MAX_RUNS = 100000
MAX_EVENTS = 1000000
MAX_BYTES = 2 * 1024**3

DDL = """
CREATE SCHEMA IF NOT EXISTS agent_monitoring;
CREATE TABLE IF NOT EXISTS agent_monitoring.migrations(version integer PRIMARY KEY);
INSERT INTO agent_monitoring.migrations VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS agent_monitoring.policy(id integer PRIMARY KEY CHECK(id=1), value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS agent_monitoring.runs(
 run_id varchar(128) PRIMARY KEY, session_id varchar(128), agent_id varchar(128),
 execution_kind varchar(32) NOT NULL DEFAULT 'voice', provider varchar(32), cdr_id varchar(128), destination_id varchar(128), epoch varchar(64),
 revision bigint, payload_hash varchar(64), started double precision NOT NULL,
 ended double precision, status varchar(32) NOT NULL DEFAULT 'active', reason varchar(128),
 complete boolean NOT NULL DEFAULT true, last_sequence bigint NOT NULL DEFAULT 0,
 capture_version bigint NOT NULL, transcript_state varchar(32) NOT NULL,
 text_bytes integer NOT NULL DEFAULT 0, usage jsonb, expires double precision NOT NULL);
CREATE INDEX IF NOT EXISTS monitoring_run_time ON agent_monitoring.runs(started DESC,run_id DESC);
CREATE INDEX IF NOT EXISTS monitoring_run_agent ON agent_monitoring.runs(agent_id,started DESC);
CREATE INDEX IF NOT EXISTS monitoring_run_expiry ON agent_monitoring.runs(expires);
CREATE TABLE IF NOT EXISTS agent_monitoring.events(
 event_id varchar(64) PRIMARY KEY, run_id varchar(128) REFERENCES agent_monitoring.runs ON DELETE CASCADE,
 sequence bigint NOT NULL, timestamp double precision NOT NULL, event_type varchar(64) NOT NULL,
 metadata jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS monitoring_event_run ON agent_monitoring.events(run_id,sequence,event_id);
CREATE TABLE IF NOT EXISTS agent_monitoring.segments(
 run_id varchar(128) REFERENCES agent_monitoring.runs ON DELETE CASCADE,
 item_id varchar(128), content_index integer, role varchar(16), position integer,
 response_id varchar(128), ciphertext bytea NOT NULL, interrupted boolean NOT NULL DEFAULT false,
 expires double precision NOT NULL, PRIMARY KEY(run_id,item_id,content_index));
CREATE TABLE IF NOT EXISTS agent_monitoring.health(
 epoch varchar(64) PRIMARY KEY, updated double precision NOT NULL, complete boolean NOT NULL,
 dropped bigint NOT NULL DEFAULT 0, last_gap double precision);
CREATE TABLE IF NOT EXISTS agent_monitoring.audit(
 id bigserial PRIMARY KEY, timestamp double precision NOT NULL, actor varchar(128) NOT NULL,
 action varchar(64) NOT NULL, run_id varchar(128));
"""


def encode_cursor(values):
    return base64.urlsafe_b64encode(json.dumps(values,separators=(",", ":")).encode()).decode().rstrip("=")


def decode_cursor(value, length):
    if not isinstance(value, str) or len(value) > 512:
        raise ValueError("invalid cursor")
    try:
        result = json.loads(base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True))
        if not isinstance(result, list) or len(result) != length:
            raise ValueError()
        return result
    except Exception as exc:
        raise ValueError("invalid cursor") from exc


class HistoryRepository:
    def connect(self):
        return psycopg.connect(host=os.getenv("PGVECTOR_HOST", "127.0.0.1"),
            port=os.getenv("PGVECTOR_PORT", "5432"), dbname=os.getenv("PGVECTOR_DATABASE", "satellite"),
            user=os.getenv("PGVECTOR_USER", "satellite"), password=os.getenv("PGVECTOR_PASSWORD", ""),
            connect_timeout=2, options="-c statement_timeout=3000 -c lock_timeout=1000", row_factory=dict_row)

    def initialize(self, epoch):
        with self.connect() as db:
            # One migration owner even when multiple startup requests race.
            db.execute("SELECT pg_advisory_xact_lock(783501)")
            for statement in DDL.split(";"):
                if statement.strip():
                    db.execute(statement)
            version=db.execute("SELECT max(version) AS version FROM agent_monitoring.migrations").fetchone()["version"]
            if version > 1:
                raise RuntimeError("monitoring_schema_newer")
            db.execute("INSERT INTO agent_monitoring.policy VALUES(1,%s) ON CONFLICT DO NOTHING", (Jsonb(validate_policy()),))
            now = time.time()
            recovered = db.execute("UPDATE agent_monitoring.runs SET status='interrupted', reason='runtime_restart', "
                       "complete=false, ended=NULL, transcript_state=CASE WHEN transcript_state IN ('pending','available') "
                       "THEN 'partial' ELSE transcript_state END WHERE status='active' AND epoch<>%s RETURNING epoch", (epoch,)).fetchall()
            for row in recovered:
                db.execute("UPDATE agent_monitoring.health SET complete=false,last_gap=%s WHERE epoch=%s", (now,row["epoch"]))

    def policy(self):
        with self.connect() as db:
            return db.execute("SELECT value FROM agent_monitoring.policy WHERE id=1").fetchone()["value"]

    def apply_policy(self, policy):
        with self.connect() as db:
            db.execute("INSERT INTO agent_monitoring.policy VALUES(1,%s) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value",(Jsonb(policy),))
            db.execute("UPDATE agent_monitoring.runs SET expires=COALESCE(ended,started)+%s WHERE expires>%s",(policy["metadata_retention_days"]*86400,time.time()))
            db.execute("UPDATE agent_monitoring.runs r SET transcript_state='expired' WHERE text_bytes>0 "
                "AND transcript_state IN ('available','partial','truncated','capture_stopped') "
                "AND NOT EXISTS(SELECT 1 FROM agent_monitoring.segments s WHERE s.run_id=r.run_id AND s.expires>%s)", (time.time(),))
            db.execute("UPDATE agent_monitoring.segments s SET expires=COALESCE(r.ended,r.started)+%s "
                       "FROM agent_monitoring.runs r WHERE r.run_id=s.run_id AND s.expires>%s AND r.expires>%s",(policy["transcript_retention_days"]*86400,time.time(),time.time()))
            for agent, enabled in policy["transcripts"].items():
                if not enabled:
                    db.execute("UPDATE agent_monitoring.runs SET transcript_state='capture_stopped' "
                        "WHERE agent_id=%s AND status='active' AND transcript_state IN ('pending','available','partial','truncated')",(agent,))

    def write(self, records, epoch, dropped):
        with self.connect() as db:
            policy = db.execute("SELECT value FROM agent_monitoring.policy WHERE id=1 FOR SHARE").fetchone()["value"]
            size = db.execute("SELECT COALESCE(sum(pg_total_relation_size(c.oid)),0) AS bytes FROM pg_class c "
                "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='agent_monitoring' AND c.relkind='r'").fetchone()["bytes"]
            run_count = db.execute("SELECT count(*) AS n FROM agent_monitoring.runs").fetchone()["n"]
            event_count = db.execute("SELECT count(*) AS n FROM agent_monitoring.events").fetchone()["n"]
            storage_full = size >= MAX_BYTES
            losses = 0
            deadline = time.monotonic()+4
            for record in records:
                if time.monotonic() > deadline:
                    raise RuntimeError("monitoring_batch_timeout")
                kind, value = record["kind"], record["value"]
                if kind == "run":
                    if db.execute("SELECT 1 FROM agent_monitoring.runs WHERE run_id=%s", (value["run_id"],)).fetchone():
                        continue
                    if storage_full or run_count >= MAX_RUNS:
                        losses += 1
                        continue
                    run_count += 1
                    db.execute("INSERT INTO agent_monitoring.runs(run_id,session_id,agent_id,provider,cdr_id,destination_id,epoch,"
                        "revision,payload_hash,started,capture_version,transcript_state,expires) VALUES "
                        "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", tuple(value[k] for k in
                        ("run_id","session_id","agent_id","provider","cdr_id","destination_id","epoch","revision","payload_hash","started","capture_version","transcript_state"))+
                        (value["started"]+policy["metadata_retention_days"]*86400,))
                elif kind == "event":
                    if db.execute("SELECT 1 FROM agent_monitoring.events WHERE event_id=%s", (value["event_id"],)).fetchone():
                        continue
                    run = value.get("run_id")
                    row = db.execute("SELECT * FROM agent_monitoring.runs WHERE run_id=%s FOR UPDATE",(run,)).fetchone() if run else None
                    inserted = None
                    capacity_blocked = storage_full or event_count >= MAX_EVENTS
                    if capacity_blocked:
                        losses += 1
                    else:
                        event_count += 1
                        inserted = db.execute("INSERT INTO agent_monitoring.events VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING event_id",
                        (value["event_id"],run if row else None,value["sequence"],value["timestamp"],value["event_type"],Jsonb(value))).fetchone()
                    if row and (inserted or (capacity_blocked and value["event_type"] == "call_ended")):
                        seq = value["sequence"]
                        db.execute("UPDATE agent_monitoring.runs SET last_sequence=GREATEST(last_sequence,%s), "
                            "complete=complete AND %s WHERE run_id=%s",(seq,bool(inserted) and seq==row["last_sequence"]+1,run))
                        if value["event_type"] == "call_ended":
                            status = value.get("outcome", "unknown")
                            if status not in ("completed","fallback","handed_off","unknown","interrupted","failed"):
                                status = "unknown"
                            db.execute("UPDATE agent_monitoring.runs SET ended=%s,status=%s,reason=%s,expires=%s WHERE run_id=%s",
                                (value["timestamp"],status,value.get("reason_code"),value["timestamp"]+policy["metadata_retention_days"]*86400,run))
                            db.execute("UPDATE agent_monitoring.runs SET transcript_state='partial' WHERE run_id=%s AND transcript_state='pending'", (run,))
                            db.execute("UPDATE agent_monitoring.segments SET expires=%s WHERE run_id=%s",
                                (value["timestamp"]+policy["transcript_retention_days"]*86400,run))
                        if value["event_type"] == "monitoring_gap":
                            db.execute("UPDATE agent_monitoring.runs SET complete=false,transcript_state=CASE WHEN transcript_state IN ('pending','available') THEN 'partial' ELSE transcript_state END WHERE run_id=%s",(run,))
                elif kind == "text":
                    if db.execute("SELECT 1 FROM agent_monitoring.segments WHERE run_id=%s AND item_id=%s AND content_index=%s",
                            (value["run_id"],value["item_id"],value["content_index"])).fetchone():
                        continue
                    if storage_full:
                        losses += 1
                        continue
                    row = db.execute("SELECT * FROM agent_monitoring.runs WHERE run_id=%s FOR UPDATE",(value["run_id"],)).fetchone()
                    if not row or row["expires"] <= time.time(): continue
                    agent = row["agent_id"]
                    if (not policy["transcripts"].get(agent) or row["capture_version"] != policy["capture_versions"].get(agent)
                        or row["transcript_state"] not in ("pending","available","truncated","partial") ):
                        continue
                    count = db.execute("SELECT count(*) AS n FROM agent_monitoring.segments WHERE run_id=%s", (value["run_id"],)).fetchone()["n"]
                    if row["text_bytes"]+value["bytes"] > 262144 or count >= 1000:
                        db.execute("UPDATE agent_monitoring.runs SET transcript_state='truncated' WHERE run_id=%s", (value["run_id"],))
                        continue
                    inserted = db.execute("INSERT INTO agent_monitoring.segments VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                        "ON CONFLICT DO NOTHING RETURNING item_id",(value["run_id"],value["item_id"],value["content_index"],
                        value["role"],value["position"],value.get("response_id"),value["ciphertext"],value.get("interrupted",False),
                        (row["ended"] or row["started"])+policy["transcript_retention_days"]*86400)).fetchone()
                    if inserted:
                        db.execute("UPDATE agent_monitoring.runs SET text_bytes=text_bytes+%s,transcript_state=%s WHERE run_id=%s",
                            (value["bytes"],"partial" if row["transcript_state"] == "partial" else "truncated" if value.get("truncated") or row["transcript_state"] == "truncated" else "available",value["run_id"]))
                elif kind == "interruption":
                    db.execute("UPDATE agent_monitoring.segments SET interrupted=true WHERE run_id=%s AND item_id=%s",(value["run_id"],value["item_id"]))
                elif kind == "text_error":
                    db.execute("UPDATE agent_monitoring.runs SET transcript_state='partial' WHERE run_id=%s AND transcript_state IN ('available','pending')",(value["run_id"],))
                elif kind == "usage":
                    db.execute("UPDATE agent_monitoring.runs SET usage=%s WHERE run_id=%s",(Jsonb(value["usage"]),value["run_id"]))
            dropped += losses
            previous = db.execute("SELECT dropped,updated,last_gap FROM agent_monitoring.health WHERE epoch=%s", (epoch,)).fetchone()
            dropped = max(dropped,previous["dropped"] if previous else 0)
            now = time.time()
            last_gap = previous["last_gap"] if previous else None
            if dropped > (previous["dropped"] if previous else 0):
                last_gap = now
                db.execute("UPDATE agent_monitoring.runs SET complete=false,transcript_state=CASE "
                    "WHEN transcript_state IN ('available','pending') THEN 'partial' ELSE transcript_state END "
                    "WHERE epoch=%s AND (status='active' OR ended>=%s)", (epoch,previous["updated"] if previous else 0))
                if not storage_full and event_count < MAX_EVENTS:
                    gap_id=hashlib.sha256(f"{epoch}:{dropped}".encode()).hexdigest()
                    db.execute("INSERT INTO agent_monitoring.events VALUES(%s,NULL,0,%s,'monitoring_gap',%s) ON CONFLICT DO NOTHING",
                        (gap_id,now,Jsonb({"schema_version":1,"event_id":gap_id,"event_type":"monitoring_gap",
                         "timestamp":now,"sequence":0,"runtime_epoch":epoch,"dropped_count":dropped-(previous["dropped"] if previous else 0)})))
            db.execute("INSERT INTO agent_monitoring.health(epoch,updated,complete,dropped,last_gap) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(epoch) "
                "DO UPDATE SET updated=EXCLUDED.updated,complete=EXCLUDED.complete,dropped=EXCLUDED.dropped,last_gap=EXCLUDED.last_gap",
                (epoch,now,not bool(dropped),dropped,last_gap))
            return {"lost":losses,"dropped":dropped,"limit":storage_full or run_count >= MAX_RUNS or event_count >= MAX_EVENTS}

    def purge(self):
        now = time.time()
        with self.connect() as db:
            policy = db.execute("SELECT value FROM agent_monitoring.policy WHERE id=1").fetchone()
            days = policy["value"]["metadata_retention_days"] if policy else 30
            db.execute("DELETE FROM agent_monitoring.segments WHERE expires<=%s",(now,))
            db.execute("UPDATE agent_monitoring.runs r SET transcript_state='expired' WHERE transcript_state IN ('available','partial','truncated','capture_stopped') "
                "AND COALESCE(ended,started)+%s<=%s AND NOT EXISTS(SELECT 1 FROM agent_monitoring.segments s WHERE s.run_id=r.run_id)",
                ((policy['value']['transcript_retention_days'] if policy else 7)*86400,now))
            db.execute("DELETE FROM agent_monitoring.runs WHERE run_id IN (SELECT run_id FROM agent_monitoring.runs WHERE expires<=%s LIMIT 1000)",(now,))
            db.execute("DELETE FROM agent_monitoring.events WHERE run_id IS NULL AND timestamp<%s",(now-days*86400,))
            db.execute("DELETE FROM agent_monitoring.audit WHERE timestamp<%s",(now-days*86400,))
            db.execute("DELETE FROM agent_monitoring.health WHERE updated<%s",(now-days*86400,))

    def list_runs(self, limit=50, cursor=None, agent=None, provider=None, outcome=None, correlation=None, after=None, before=None, tool_error=False, active_sessions=None):
        clauses, args = ["expires>%s"], [time.time()]
        active_sessions=active_sessions or []
        if after is not None and not math.isfinite(after) or before is not None and not math.isfinite(before):
            raise ValueError("invalid time range")
        if after is not None and before is not None and after > before:
            raise ValueError("invalid time range")
        if outcome == "active":
            clauses.append("status='active' AND session_id=ANY(%s)");args.append(active_sessions)
        elif outcome == "unknown":
            clauses.append("(status='unknown' OR (status='active' AND NOT (session_id=ANY(%s))))");args.append(active_sessions)
        elif outcome:
            clauses.append("status=%s");args.append(outcome)
        for column, value in (("agent_id",agent),("provider",provider)):
            if value: clauses.append(column+"=%s"); args.append(value)
        if correlation:
            clauses.append("(run_id=%s OR session_id=%s OR cdr_id=%s)"); args.extend([correlation]*3)
        if after is not None: clauses.append("started>=%s"); args.append(after)
        if before is not None: clauses.append("started<=%s"); args.append(before)
        if tool_error: clauses.append("EXISTS(SELECT 1 FROM agent_monitoring.events e WHERE e.run_id=r.run_id AND event_type IN ('tool.error','tool.rejected'))")
        if cursor:
            stamp, run_id = decode_cursor(cursor,2)
            if type(stamp) not in (float,int) or not math.isfinite(stamp) or not isinstance(run_id,str) or len(run_id)>128: raise ValueError("invalid cursor")
            clauses.append("(started,run_id)<(%s,%s)"); args.extend([stamp,run_id])
        with self.connect() as db:
            rows = db.execute("SELECT * FROM agent_monitoring.runs r WHERE "+" AND ".join(clauses)+
                " ORDER BY started DESC,run_id DESC LIMIT %s",args+[limit+1]).fetchall()
        more = len(rows)>limit; rows=rows[:limit]
        return {"items":rows,"next_cursor":encode_cursor([rows[-1]["started"],rows[-1]["run_id"]]) if more else None}

    def run(self, run_id):
        with self.connect() as db:
            return db.execute("SELECT * FROM agent_monitoring.runs WHERE run_id=%s AND expires>%s",(run_id,time.time())).fetchone()

    def events(self, run_id, limit=50, cursor=None):
        args=[run_id]; clause=""
        if cursor:
            seq,event_id=decode_cursor(cursor,2)
            if type(seq) is not int or not isinstance(event_id,str) or len(event_id)>64: raise ValueError("invalid cursor")
            clause=" AND (sequence,event_id)>(%s,%s)";args.extend([seq,event_id])
        with self.connect() as db:
            rows=db.execute("SELECT e.* FROM agent_monitoring.events e JOIN agent_monitoring.runs r USING(run_id) "
                "WHERE e.run_id=%s AND r.expires>extract(epoch FROM now())"+clause+" ORDER BY sequence,event_id LIMIT %s",args+[limit+1]).fetchall()
        more=len(rows)>limit;rows=rows[:limit]
        return {"items":rows,"next_cursor":encode_cursor([rows[-1]["sequence"],rows[-1]["event_id"]]) if more else None}

    def segments(self, run_id):
        with self.connect() as db:
            return db.execute("SELECT s.* FROM agent_monitoring.segments s JOIN agent_monitoring.runs r USING(run_id) "
                "WHERE run_id=%s AND s.expires>%s AND r.expires>%s ORDER BY position,item_id,content_index LIMIT 1000",(run_id,time.time(),time.time())).fetchall()

    def delete_text(self, run_id, actor):
        with self.connect() as db:
            row=db.execute("SELECT run_id,transcript_state FROM agent_monitoring.runs WHERE run_id=%s AND expires>%s FOR UPDATE",(run_id,time.time())).fetchone()
            if not row: return False
            if row["transcript_state"]=="deleted": return True
            db.execute("UPDATE agent_monitoring.runs SET transcript_state='deleted',text_bytes=0 WHERE run_id=%s",(run_id,))
            db.execute("DELETE FROM agent_monitoring.segments WHERE run_id=%s",(run_id,))
            db.execute("INSERT INTO agent_monitoring.audit(timestamp,actor,action,run_id) VALUES(%s,%s,'transcript_deleted',%s)",(time.time(),actor,run_id))
            return True

    def overview(self, after, active_sessions=None):
        with self.connect() as db:
            outcomes=db.execute("SELECT CASE WHEN status='active' AND NOT (session_id=ANY(%s)) THEN 'unknown' ELSE status END AS status, "
                "count(*) AS count FROM agent_monitoring.runs WHERE started>=%s AND expires>%s GROUP BY 1",
                (active_sessions or [],after,time.time())).fetchall()
            errors=db.execute("SELECT count(*) AS count FROM agent_monitoring.events e JOIN agent_monitoring.runs r USING(run_id) "
                "WHERE e.timestamp>=%s AND r.expires>%s AND event_type IN ('tool.error','tool.rejected')",(after,time.time())).fetchone()["count"]
            health=db.execute("SELECT * FROM agent_monitoring.health ORDER BY updated DESC LIMIT 20").fetchall()
            incomplete=db.execute("SELECT count(*) AS n FROM agent_monitoring.runs WHERE started>=%s AND expires>%s AND NOT complete", (after,time.time())).fetchone()["n"]
        return {"since":after,"outcomes":outcomes,"tool_errors":errors,"incomplete_runs":incomplete,"history_complete":not incomplete and all(h["last_gap"] is None or h["last_gap"] < after for h in health),"recorders":health}
