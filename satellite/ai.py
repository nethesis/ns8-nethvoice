import logging
import time
import unicodedata

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from langchain_text_splitters import RecursiveCharacterTextSplitter


logger = logging.getLogger("ai")

def _split_big(text: str):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=400000,
        chunk_overlap=0,
        separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""],
    )
    chunks = [c.strip() for c in splitter.split_text(text or "")]
    return [c for c in chunks if c]


def _llm():
    model = "gpt-5-mini"
    temperature = 0.2
    logger.debug("Creating ChatOpenAI client (model=%s, temperature=%s)", model, temperature)
    return ChatOpenAI(temperature=temperature, model=model)


def _clamp_sentiment(value: int) -> int:
    if value < 0:
        return 0
    if value > 10:
        return 10
    return value


def _sanitize_text_for_llm(text: str) -> str:
    if not text:
        return ""

    sanitized_chars = []
    changed = False
    for char in text:
        if char == "\x00" or unicodedata.category(char) == "Cs":
            changed = True
            continue
        sanitized_chars.append(char)

    sanitized = "".join(sanitized_chars)
    if sanitized != text:
        changed = True

    # Ensure the payload can always be encoded as valid UTF-8 JSON.
    utf8_sanitized = sanitized.encode("utf-8", errors="ignore").decode("utf-8")
    if utf8_sanitized != sanitized:
        changed = True

    if changed:
        logger.warning(
            "AI pipeline: sanitized text for LLM (before_len=%d after_len=%d)",
            len(text),
            len(utf8_sanitized),
        )

    return utf8_sanitized


def _is_invalid_json_body_error(error: Exception) -> bool:
    message = str(error or "").lower()
    return "parse the json body" in message or "not valid json" in message


def _invoke_chain(chain, text: str, stage: str) -> str:
    sanitized_text = _sanitize_text_for_llm(text)
    try:
        response = chain.invoke({"text": sanitized_text})
        return (response.content or "").strip()
    except Exception as error:
        if not _is_invalid_json_body_error(error):
            raise

        logger.warning("AI pipeline: retrying %s after invalid JSON body error", stage)
        retry_text = _sanitize_text_for_llm(sanitized_text)
        response = chain.invoke({"text": retry_text})
        return (response.content or "").strip()


def generate_clean_summary_sentiment(text: str):
    """Generate cleaned transcription, summary, and sentiment (0-10).

    Splits very long transcripts into large chunks to stay within model context.
    """

    started_at = time.monotonic()
    input_len = len(text or "")
    logger.debug("AI pipeline start (input_len=%d)", input_len)

    chunks = _split_big(text)
    if not chunks:
        logger.warning("AI pipeline: empty input")
        return "", "", None

    logger.debug(
        "AI pipeline: split input into %d chunk(s) (chunk_lens=%s)",
        len(chunks),
        [len(c) for c in chunks],
    )

    llm = _llm()

    clean_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
You are given a multi-speaker transcription where overlapping speech caused sentences to be split into single words.
Speaker labels are alternated line by line, even when the same speaker is continuing the same sentence.

Task:
- Reconstruct readable sentences by merging fragments that logically belong together, even if interrupted by the other speaker.
- Preserve the original wording as much as possible.
- Do NOT paraphrase, summarize, translate, or add content.
- Do NOT change speaker labels.
- Keep the original language.
- Merge fragments when they clearly form a single sentence.
- Preserve punctuation when possible; add minimal punctuation only if required for readability.
- Do NOT add explanations, comments, or preambles.
- Output ONLY the cleaned transcription.
- Fix transcription errors only for misunderstood words that are obvious from context.

### Example 1

Input:
Channel 0: Ciao
Channel 1: Ciao
Channel 0: some
Channel 1: tutto bene?
Channel 0: stai?
Channel 1: Io assonnato
Channel 0: Io
Channel 1: ma felice
Channel 0: sto bene, grazie

Output:
Channel 0: Ciao come stai?
Channel 1: Ciao tutto bene?
Channel 0: Io sto bene, grazie
Channel 1: Io assonnato, ma felice

### Example 2 (English)

Input:
Alice: I
Bob: Yes?
Alice: was
Bob: go on
Alice: saying
Bob: okay
Alice: that the system
Bob: sounds boob
Alice: is ready

Output:
Alice: I was saying that the system is ready
Bob: Yes? go on okay sounds good

### Example 3

Input:
Mario Rossi: Non
Maria Bianchi: Sì?
Mario Rossi: ho
Maria Bianchi: dimmi
Mario Rossi: carpito
Maria Bianchi: pure
Mario Rossi: niente

Output:
Mario Rossi: Non ho capito niente
Maria Bianchi: Sì? dimmi pure
                """.strip(),
            ),
            (
                "human",
                """
# Input Transcription:
{text}

# Output:
""".strip(),
            ),
        ]
    )
    clean_chain = clean_prompt | llm

    cleaned_chunks = []
    for idx, chunk in enumerate(chunks):
        try:
            logger.debug("AI pipeline: cleaning chunk %d/%d (len=%d)", idx + 1, len(chunks), len(chunk))
            cleaned_chunks.append(_invoke_chain(clean_chain, chunk, f"clean chunk {idx + 1}/{len(chunks)}"))
        except Exception:
            logger.exception("AI pipeline: failed cleaning chunk %d/%d", idx + 1, len(chunks))
            raise
    cleaned = _sanitize_text_for_llm("\n\n".join([c.strip() for c in cleaned_chunks if c and c.strip()]).strip())
    logger.debug("AI pipeline: cleaned_len=%d", len(cleaned))

    summarize_chunk_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
The provided text is a transcription of a conversation.
Summarize this chunk concisely.
- Do NOT change speaker labels.
- Capture main points and important details.
- No opinions.
- Keep speaker names or labels if present.
- Same language as input.
- Do NOT add explanations, comments, or preambles.
- Output ONLY the summary.
                """.strip(),
            ),
            (
                "human",
                """
# Input chunk:
{text}

# Output:
""".strip(),
            ),
        ]
    )
    summarize_chunk_chain = summarize_chunk_prompt | llm

    chunk_summaries = []
    summarize_chunks = _split_big(cleaned)
    logger.debug("AI pipeline: summarizing %d cleaned chunk(s)", len(summarize_chunks))
    for idx, chunk in enumerate(summarize_chunks):
        try:
            logger.debug("AI pipeline: summarizing chunk %d/%d (len=%d)", idx + 1, len(summarize_chunks), len(chunk))
            chunk_summaries.append(
                _invoke_chain(
                    summarize_chunk_chain,
                    chunk,
                    f"summarize chunk {idx + 1}/{len(summarize_chunks)}",
                )
            )
        except Exception:
            logger.exception("AI pipeline: failed summarizing chunk %d/%d", idx + 1, len(summarize_chunks))
            raise

    reduce_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
You are given bullet summaries of chunks of a conversation.
Merge them into a single concise summary.
- Keep bullet points.
- Keep speaker names if present.
- Maintain factual accuracy.
- Make sure every important point from the chunks is included.
- Same language as the summaries.
No preamble or conclusion.
                """.strip(),
            ),
            (
                "human",
                """
{text}
""".strip(),
            ),
        ]
    )
    reduce_chain = reduce_prompt | llm
    try:
        summary = _invoke_chain(
            reduce_chain,
            "\n\n".join([s.strip() for s in chunk_summaries if s and s.strip()]),
            "reduce summaries",
        )
    except Exception:
        logger.exception("AI pipeline: failed reducing chunk summaries")
        raise
    logger.debug("AI pipeline: summary_len=%d", len(summary))

    sentiment_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
Rate the overall sentiment expressed in the conversation on a 0-10 scale.
0 means pure hate.
10 means deepest love.

Return ONLY a single integer from 0 to 10.

example output:0
example output:10
example output:5
example output:7
example output:3
                """.strip(),
            ),
            (
                "human",
                """
{text}
""".strip(),
            ),
        ]
    )
    sentiment_chain = sentiment_prompt | llm

    try:
        sentiment_text = _invoke_chain(sentiment_chain, cleaned[:20000], "sentiment scoring")
    except Exception:
        logger.exception("AI pipeline: failed sentiment scoring")
        raise
    sentiment = None
    if sentiment_text is not None:
        try:
            sentiment = _clamp_sentiment(int(sentiment_text.strip()))
        except Exception:
            sentiment = None

    elapsed_ms = int((time.monotonic() - started_at) * 1000)
    logger.info(
        "AI pipeline done (cleaned_len=%d summary_len=%d sentiment=%s elapsed_ms=%d)",
        len(cleaned),
        len(summary),
        sentiment,
        elapsed_ms,
    )

    return cleaned, summary, sentiment
