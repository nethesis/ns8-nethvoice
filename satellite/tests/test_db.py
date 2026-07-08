from unittest.mock import MagicMock

import pytest

import db

try:
    from fastapi.concurrency import run_in_threadpool
except Exception:  # pragma: no cover
    from starlette.concurrency import run_in_threadpool


@pytest.fixture(autouse=True)
def _reset_db_schema_state(monkeypatch: pytest.MonkeyPatch):
    """Ensure schema init globals don't leak between tests."""
    monkeypatch.setattr(db, "_schema_initialized", False)
    yield
    monkeypatch.setattr(db, "_schema_initialized", False)


def _make_conn(*, hnsw_raises: bool = False, fetchone_result=(123,)):
    """Create a psycopg-like connection mock used as a context manager."""
    conn = MagicMock(name="conn")
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False

    def execute_side_effect(sql, params=None):
        sql_text = str(sql)
        if hnsw_raises and "USING hnsw" in sql_text:
            raise Exception("pgvector too old")
        cursor = MagicMock(name="cursor")
        cursor.fetchone.return_value = fetchone_result
        return cursor

    conn.execute.side_effect = execute_side_effect
    return conn


@pytest.mark.asyncio
async def test_is_configured_false_when_missing_env(monkeypatch: pytest.MonkeyPatch):
    for key in [
        "PGVECTOR_HOST",
        "PGVECTOR_PORT",
        "PGVECTOR_USER",
        "PGVECTOR_PASSWORD",
        "PGVECTOR_DATABASE",
    ]:
        monkeypatch.delenv(key, raising=False)

    assert db.is_configured() is False


@pytest.mark.asyncio
async def test_is_configured_true_when_all_env_set(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PGVECTOR_HOST", "localhost")
    monkeypatch.setenv("PGVECTOR_PORT", "5432")
    monkeypatch.setenv("PGVECTOR_USER", "user")
    monkeypatch.setenv("PGVECTOR_PASSWORD", "pass")
    monkeypatch.setenv("PGVECTOR_DATABASE", "db")

    assert db.is_configured() is True


@pytest.mark.asyncio
async def test_conninfo_raises_with_missing_envs(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("PGVECTOR_HOST", raising=False)
    monkeypatch.delenv("PGVECTOR_PORT", raising=False)
    monkeypatch.delenv("PGVECTOR_USER", raising=False)
    monkeypatch.delenv("PGVECTOR_PASSWORD", raising=False)
    monkeypatch.delenv("PGVECTOR_DATABASE", raising=False)

    with pytest.raises(RuntimeError) as e:
        await run_in_threadpool(db._conninfo)

    msg = str(e.value)
    assert "Postgres vectorstore is not configured" in msg
    assert "PGVECTOR_HOST" in msg
    assert "PGVECTOR_DATABASE" in msg


@pytest.mark.asyncio
async def test_conninfo_returns_psycopg_conninfo(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PGVECTOR_HOST", "h")
    monkeypatch.setenv("PGVECTOR_PORT", "5432")
    monkeypatch.setenv("PGVECTOR_USER", "u")
    monkeypatch.setenv("PGVECTOR_PASSWORD", "p")
    monkeypatch.setenv("PGVECTOR_DATABASE", "d")

    conninfo = await run_in_threadpool(db._conninfo)
    assert "host=h" in conninfo
    assert "port=5432" in conninfo
    assert "user=u" in conninfo
    assert "password=p" in conninfo
    assert "dbname=d" in conninfo


@pytest.mark.asyncio
async def test_validate_uniqueid_accepts_expected_format():
    await run_in_threadpool(db.validate_uniqueid, "1234567890.1234")


@pytest.mark.asyncio
async def test_validate_uniqueid_rejects_missing():
    with pytest.raises(ValueError):
        await run_in_threadpool(db.validate_uniqueid, "")


@pytest.mark.asyncio
async def test_validate_uniqueid_rejects_invalid_format():
    with pytest.raises(ValueError):
        await run_in_threadpool(db.validate_uniqueid, "abc")


@pytest.mark.asyncio
async def test_ensure_schema_sets_initialized_and_is_idempotent(monkeypatch: pytest.MonkeyPatch):
    conn = _make_conn(hnsw_raises=True)
    connect_mock = MagicMock(return_value=conn)
    monkeypatch.setattr(db, "_connect_without_pgvector", connect_mock)

    await run_in_threadpool(db._ensure_schema)
    assert db._schema_initialized is True

    # second call should short-circuit (no more connections)
    await run_in_threadpool(db._ensure_schema)
    assert connect_mock.call_count == 1


@pytest.mark.asyncio
async def test_ensure_schema_hnsw_success_path(monkeypatch: pytest.MonkeyPatch):
    conn = _make_conn(hnsw_raises=False)
    connect_mock = MagicMock(return_value=conn)
    monkeypatch.setattr(db, "_connect_without_pgvector", connect_mock)

    await run_in_threadpool(db._ensure_schema)
    assert db._schema_initialized is True

    # Verify HNSW index attempt was made
    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "uniqueid TEXT NOT NULL UNIQUE" not in executed_sql
    assert "DROP CONSTRAINT IF EXISTS transcripts_uniqueid_key" in executed_sql
    assert "CREATE INDEX IF NOT EXISTS transcripts_uniqueid_idx" in executed_sql
    assert "linkedid TEXT" in executed_sql
    assert "src_number TEXT" in executed_sql
    assert "dst_number TEXT" in executed_sql
    assert "USING hnsw" in executed_sql


@pytest.mark.asyncio
async def test_ensure_schema_adds_missing_participant_columns(monkeypatch: pytest.MonkeyPatch):
    conn = MagicMock(name="conn")
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False

    def execute_side_effect(sql, params=None):
        sql_text = str(sql)
        cursor = MagicMock(name="cursor")
        if "FROM information_schema.columns" in sql_text and params in (("linkedid",), ("src_number",), ("dst_number",)):
            cursor.fetchone.return_value = None
        else:
            cursor.fetchone.return_value = (1,)
        return cursor

    conn.execute.side_effect = execute_side_effect
    monkeypatch.setattr(db, "_connect_without_pgvector", MagicMock(return_value=conn))

    await run_in_threadpool(db._ensure_schema)

    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "ALTER TABLE transcripts ADD COLUMN linkedid TEXT NULL" in executed_sql
    assert "ALTER TABLE transcripts ADD COLUMN src_number TEXT NULL" in executed_sql
    assert "ALTER TABLE transcripts ADD COLUMN dst_number TEXT NULL" in executed_sql


@pytest.mark.asyncio
async def test_create_transcript_progress_inserts_new_row(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)

    conn = _make_conn(fetchone_result=(51,))
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    transcript_id = await run_in_threadpool(
        db.create_transcript_progress,
        uniqueid="1234567890.1234",
        linkedid="1234567890.1000",
        src_number="100",
        dst_number="200",
    )

    assert transcript_id == 51

    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "INSERT INTO transcripts (uniqueid, linkedid, src_number, dst_number, duration_seconds, raw_transcription, state)" in executed_sql
    assert "ON CONFLICT" not in executed_sql


@pytest.mark.asyncio
async def test_upsert_transcript_raw_returns_id(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)

    conn = _make_conn(fetchone_result=(42,))
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    transcript_id = await run_in_threadpool(
        db.upsert_transcript_raw,
        uniqueid="1234567890.1234",
        linkedid="1234567890.1000",
        src_number="100",
        dst_number="200",
        raw_transcription="hello",
    )

    assert transcript_id == 42

    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "INSERT INTO transcripts (uniqueid, linkedid, src_number, dst_number, duration_seconds, raw_transcription)" in executed_sql
    assert "ON CONFLICT" not in executed_sql


@pytest.mark.asyncio
async def test_upsert_transcript_raw_updates_existing_row_by_id(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)

    conn = _make_conn(fetchone_result=(42,))
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    transcript_id = await run_in_threadpool(
        db.upsert_transcript_raw,
        transcript_id=42,
        uniqueid="1234567890.1234",
        linkedid="1234567890.1000",
        src_number="100",
        raw_transcription="hello",
    )

    assert transcript_id == 42

    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "UPDATE transcripts" in executed_sql
    assert "linkedid = COALESCE(%s, linkedid)" in executed_sql
    assert "src_number = COALESCE(%s, src_number)" in executed_sql
    assert "dst_number = COALESCE(%s, dst_number)" in executed_sql
    assert "WHERE id = %s" in executed_sql
    assert "AND uniqueid = %s" in executed_sql


@pytest.mark.asyncio
async def test_upsert_transcript_raw_raises_when_no_row(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)

    conn = _make_conn(fetchone_result=None)
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    with pytest.raises(RuntimeError):
        await run_in_threadpool(
            db.upsert_transcript_raw,
            uniqueid="1234567890.1234",
            raw_transcription="hello",
        )


@pytest.mark.asyncio
async def test_update_transcript_ai_fields_executes_update(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)

    conn = _make_conn()
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    await run_in_threadpool(
        db.update_transcript_ai_fields,
        transcript_id=10,
        cleaned_transcription="clean",
        summary="sum",
        sentiment=None,
    )

    # Ensure UPDATE statement was issued
    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "UPDATE transcripts" in executed_sql


@pytest.mark.asyncio
async def test_set_transcript_state_by_uniqueid_updates_latest_row(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)

    conn = _make_conn()
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    await run_in_threadpool(
        db.set_transcript_state_by_uniqueid,
        uniqueid="1234567890.1234",
        state="done",
    )

    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "WITH latest_transcript AS" in executed_sql
    assert "ORDER BY id DESC" in executed_sql


@pytest.mark.asyncio
async def test_split_text_for_embedding_filters_empty(monkeypatch: pytest.MonkeyPatch):
    class StubSplitter:
        def __init__(self, *args, **kwargs):
            pass

        def split_text(self, text):
            return ["  chunk1  ", "", "\n", "chunk2"]

    monkeypatch.setattr(db, "RecursiveCharacterTextSplitter", StubSplitter)

    chunks = await run_in_threadpool(db._split_text_for_embedding, "ignored")
    assert chunks == ["chunk1", "chunk2"]


@pytest.mark.asyncio
async def test_replace_transcript_embeddings_returns_zero_when_no_chunks(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)
    monkeypatch.setattr(db, "_split_text_for_embedding", lambda text: [])

    embeddings_class = MagicMock(name="OpenAIEmbeddings")
    monkeypatch.setattr(db, "OpenAIEmbeddings", embeddings_class)

    result = await run_in_threadpool(
        db.replace_transcript_embeddings,
        transcript_id=1,
        raw_transcription="",
        uniqueid=None,
    )

    assert result == 0
    embeddings_class.assert_not_called()


@pytest.mark.asyncio
async def test_replace_transcript_embeddings_validates_uniqueid(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)
    monkeypatch.setattr(db, "_split_text_for_embedding", lambda text: ["x"])

    with pytest.raises(ValueError):
        await run_in_threadpool(
            db.replace_transcript_embeddings,
            transcript_id=1,
            raw_transcription="hello",
            uniqueid="bad",
        )


@pytest.mark.asyncio
async def test_replace_transcript_embeddings_deletes_and_inserts(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db, "_ensure_schema", lambda: None)
    monkeypatch.setattr(db, "_split_text_for_embedding", lambda text: ["a", "b"])

    embedder = MagicMock(name="embedder")
    embedder.embed_documents.return_value = [[1, 2, 3], [4, 5, 6]]
    monkeypatch.setattr(db, "OpenAIEmbeddings", MagicMock(return_value=embedder))

    conn = _make_conn()
    monkeypatch.setattr(db, "_connect", MagicMock(return_value=conn))

    count = await run_in_threadpool(
        db.replace_transcript_embeddings,
        transcript_id=99,
        raw_transcription="hello",
        uniqueid="1234567890.1234",
    )

    assert count == 2

    executed_sql = "\n".join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert "DELETE FROM transcript_chunks" in executed_sql
    assert "INSERT INTO transcript_chunks" in executed_sql
