from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SEARCH_INDEX_PATH = ROOT / "data" / "search" / "yunshan_search_index.jsonl"
PORTAL_DATA_PATH = ROOT / "data" / "yunshan" / "portal-data.json"

MANUAL_ALIAS_GROUPS = [
    ["郭畀", "곽비", "雲山", "운산"],
    ["張德輝", "장덕휘", "德輝"],
    ["李叔義", "이숙의"],
    ["湯君白", "탕군백"],
    ["杭州", "항주", "杭城", "錢塘", "전당"],
    ["吳山", "오산"],
    ["西湖", "서호"],
    ["省中", "성중"],
    ["早飯", "조반", "아침밥", "아침 식사"],
    ["遺教經", "경전", "불교 경전", "佛經", "사경"],
    ["佛", "佛像", "法堂", "불교"],
]

MEETING_PREDICATES = {"visited", "encountered", "welcomed", "dined_with", "traveled_with"}
SELF_PERSON_ID = "person-0001"
PREDICATE_LABELS = {
    "visited": "방문",
    "encountered": "마주침",
    "welcomed": "맞이함",
    "dined_with": "식사/술자리",
    "traveled_with": "동행",
}

KOREAN_PARTICLE_RE = re.compile(
    r"(이|가|은|는|을|를|과|와|도|에서|에게|으로|로|부터|까지|처럼|관련|기록|나오는|나온|했어|있어|뭐야)$"
)


def response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_index() -> list[dict[str, Any]]:
    if SEARCH_INDEX_PATH.exists():
        return read_jsonl(SEARCH_INDEX_PATH)
    # Last-resort compatibility fallback for direct local previews that have not
    # regenerated the search index yet.
    with PORTAL_DATA_PATH.open("r", encoding="utf-8") as stream:
        data = json.load(stream)
    rows = []
    for entry in data.get("entries", []):
        entry_id = entry.get("entry_id")
        if not entry_id:
            continue
        rows.append(
            {
                "record_id": f"entry:{entry_id}",
                "record_type": "entry",
                "source_entry_ids": [entry_id],
                "labels": [entry_id, entry.get("date_label", ""), entry.get("summary", "")],
                "aliases": [],
                "topics": list(dict.fromkeys([*(entry.get("topics") or []), *(entry.get("lifestyle_topics") or [])])),
                "entities": [],
                "original_snippet": entry.get("original", "")[:360],
                "translation_snippet": entry.get("translation", "")[:360],
                "summary": entry.get("summary", ""),
                "certainty": "confirmed",
                "review_status": entry.get("status", "reviewed"),
                "metadata": {"date_label": entry.get("date_label"), "entry_index": entry.get("index")},
                "search_text": " ".join(
                    str(part or "")
                    for part in [
                        entry_id,
                        entry.get("date_label"),
                        entry.get("summary"),
                        entry.get("translation"),
                        entry.get("original"),
                        " ".join(entry.get("topics") or []),
                        " ".join(entry.get("lifestyle_topics") or []),
                    ]
                ),
            }
        )
    return rows


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower()).strip()


def compact(value: Any, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def query_terms(query: str) -> list[str]:
    normalized = normalize_text(query)
    terms = {normalized} if normalized else set()
    for part in re.split(r"[\s,./;|!?？。、·]+", normalized):
        part = part.strip()
        if len(part) <= 1:
            continue
        terms.add(part)
        stripped = KOREAN_PARTICLE_RE.sub("", part)
        if len(stripped) > 1:
            terms.add(stripped)

    for group in MANUAL_ALIAS_GROUPS:
        lowered = [item.lower() for item in group]
        if any(alias and alias in normalized for alias in lowered):
            terms.update(lowered)

    if "항주" in normalized and ("도착" in normalized or "입성" in normalized or "직후" in normalized):
        terms.update(["entry-1308-09-22", "杭州", "항주 입성", "入城", "北關門"])
    if "못" in normalized and ("만나" in normalized or "방문" in normalized):
        terms.update(["not_met", "방문 실패", "不遇", "만나지 못함", "visited_not"])

    return [term for term in terms if term]


def classify_query(query: str) -> set[str]:
    text = normalize_text(query)
    intents: set[str] = set()
    if re.search(r"누구|인물|사람|만났|장덕휘|張德輝|德輝|곽비", text):
        intents.add("person")
    if re.search(r"어디|공간|장소|항주|杭州|吳山|오산|西湖|서호|省中|성중", text):
        intents.add("place")
    if re.search(r"관직|관청|업무|省中|성중|도목|同知|都目", text):
        intents.add("institution")
    if re.search(r"문서|작품|소비품|경전|早飯|조반|아침밥|차|술|佛|遺教經", text):
        intents.add("material")
    if re.search(r"못|불발|不遇|not_met|만나지 못|방문했지만", text):
        intents.add("not_met")
    return intents


def record_text(record: dict[str, Any]) -> str:
    pieces: list[str] = []
    for key in ("record_id", "record_type", "search_text", "summary", "original_snippet", "translation_snippet", "embedding_text"):
        pieces.append(str(record.get(key, "")))
    pieces.extend(record.get("source_entry_ids") or [])
    pieces.extend(record.get("labels") or [])
    pieces.extend(record.get("aliases") or [])
    pieces.extend(record.get("topics") or [])
    for entity in record.get("entities") or []:
        pieces.extend([entity.get("entity_id", ""), entity.get("entity_type", ""), entity.get("label", "")])
    metadata = record.get("metadata") or {}
    pieces.extend(str(value) for value in metadata.values() if value is not None)
    return normalize_text(" ".join(pieces))


def score_record(record: dict[str, Any], terms: list[str], query: str, intents: set[str]) -> tuple[float, list[str]]:
    text = record_text(record)
    exact_query = normalize_text(query)
    labels = normalize_text(" ".join(record.get("labels") or []))
    aliases = normalize_text(" ".join(record.get("aliases") or []))
    topics = normalize_text(" ".join(record.get("topics") or []))
    entries = normalize_text(" ".join(record.get("source_entry_ids") or []))
    metadata = record.get("metadata") or {}
    record_type = record.get("record_type")
    matched: list[str] = []
    score = 0.0

    if exact_query and exact_query in text:
        score += 24
        matched.append(exact_query)

    for term in terms:
        term = normalize_text(term)
        if not term:
            continue
        term_score = 0
        if term in labels:
            term_score += 36
        if term in aliases:
            term_score += 32
        if term in entries:
            term_score += 28
        if term in topics:
            term_score += 18
        if term in normalize_text(record.get("original_snippet", "")):
            term_score += 14
        if term in normalize_text(record.get("translation_snippet", "")):
            term_score += 12
        if term in text:
            term_score += max(4, min(12, len(term)))
        if term_score:
            score += term_score
            matched.append(term)

    entity_types = {item.get("entity_type") for item in record.get("entities") or []}
    if "person" in intents and ("person" in entity_types or metadata.get("predicate") in {"visited", "encountered", "welcomed", "dined_with"}):
        score += 14
    if "place" in intents and ("place" in entity_types or record_type in {"entry", "graph_edge"}):
        score += 10
    if "institution" in intents and ({"office", "institution"} & entity_types or metadata.get("category") in {"offices", "institutions"}):
        score += 12
    if "material" in intents and ({"document", "work", "consumable"} & entity_types or metadata.get("category") in {"documents", "works", "consumables"}):
        score += 12
    if "not_met" in intents:
        if metadata.get("negated") or "not_met" in aliases or "불발" in text or "不遇" in text:
            score += 42
        elif record_type in {"assertion", "graph_edge"}:
            score += 6

    if "항주" in normalize_text(query) and ("도착" in normalize_text(query) or "입성" in normalize_text(query) or "직후" in normalize_text(query)):
        if "entry-1308-09-22" in record.get("source_entry_ids", []) or record.get("record_id") == "entry:entry-1308-09-22":
            score += 90
        if "entry-1308-09-23" in record.get("source_entry_ids", []):
            score += 20

    if record_type == "entry":
        score += 4
    elif record_type in {"assertion", "graph_edge"} and ("person" in intents or "not_met" in intents):
        score += 8

    return score, list(dict.fromkeys(matched))


def confidence_from_score(score: float) -> str:
    if score >= 90:
        return "high"
    if score >= 45:
        return "medium"
    return "low"


def local_search(query: str, index: list[dict[str, Any]], limit: int = 8) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    terms = query_terms(query)
    intents = classify_query(query)
    scored = []
    for record in index:
        score, matched = score_record(record, terms, query, intents)
        if score <= 0:
            continue
        first_entry = (record.get("source_entry_ids") or [""])[0]
        entry_index = (record.get("metadata") or {}).get("entry_index")
        scored.append((score, entry_index if entry_index is not None else 9999, first_entry, record, matched))

    scored.sort(key=lambda item: (-item[0], item[1], item[2], item[3].get("record_id", "")))
    evidence = []
    for score, _index, _entry, record, matched in scored[: max(limit * 2, 12)]:
        evidence.append(format_evidence(record, score, matched))

    results = entry_results(evidence, limit)
    mode = "hybrid_jsonl"
    return evidence[:limit], results, mode


def format_evidence(record: dict[str, Any], score: float, matched: list[str]) -> dict[str, Any]:
    date_label = (record.get("metadata") or {}).get("date_label")
    return {
        "record_id": record.get("record_id"),
        "record_type": record.get("record_type"),
        "source_entry_ids": record.get("source_entry_ids") or [],
        "date_label": date_label,
        "labels": (record.get("labels") or [])[:8],
        "matched_terms": matched[:10],
        "matched_entities": record.get("entities") or [],
        "matched_topics": record.get("topics") or [],
        "original_snippet": record.get("original_snippet") or "",
        "translation_snippet": record.get("translation_snippet") or record.get("summary") or "",
        "summary": record.get("summary") or "",
        "certainty": record.get("certainty") or "confirmed",
        "review_status": record.get("review_status") or "reviewed",
        "score": round(score, 2),
        "confidence": confidence_from_score(score),
    }


def entry_results(evidence: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for item in evidence:
        for entry_id in item.get("source_entry_ids") or []:
            if not entry_id:
                continue
            if entry_id not in grouped:
                grouped[entry_id] = {
                    "entry_id": entry_id,
                    "date_label": item.get("date_label"),
                    "summary": item.get("summary") or compact(item.get("translation_snippet"), 160),
                    "score": 0.0,
                    "evidence_count": 0,
                }
            grouped[entry_id]["score"] += item.get("score", 0)
            grouped[entry_id]["evidence_count"] += 1
            if not grouped[entry_id].get("date_label") and item.get("date_label"):
                grouped[entry_id]["date_label"] = item.get("date_label")
    rows = sorted(grouped.values(), key=lambda row: (-row["score"], row["entry_id"]))
    return rows[:limit]


def wants_person_frequency(query: str) -> bool:
    text = normalize_text(query)
    return (
        any(token in text for token in ("가장", "제일", "자주", "많이", "빈번"))
        and any(token in text for token in ("만난", "만났", "본", "사람", "인물"))
    )


def short_entry_label(entry_id: str, entry_map: dict[str, dict[str, Any]]) -> str:
    date_label = ((entry_map.get(entry_id) or {}).get("metadata") or {}).get("date_label") or entry_id
    match = re.search(r"(\d+)월\s*(\d+)일", str(date_label))
    if match:
        return f"{int(match.group(1))}/{int(match.group(2))}"
    return str(date_label)


def person_frequency_payload(query: str, index: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not wants_person_frequency(query):
        return None

    entry_map = {
        (record.get("source_entry_ids") or [""])[0]: record
        for record in index
        if record.get("record_type") == "entry" and record.get("source_entry_ids")
    }
    buckets: dict[str, dict[str, Any]] = {}
    evidence_records: dict[str, list[dict[str, Any]]] = {}

    for record in index:
        if record.get("record_type") != "assertion":
            continue
        metadata = record.get("metadata") or {}
        predicate = metadata.get("predicate")
        if predicate not in MEETING_PREDICATES or metadata.get("negated"):
            continue
        entities = record.get("entities") or []
        if len(entities) < 2:
            continue
        subject, target = entities[0], entities[1]
        if subject.get("entity_id") != SELF_PERSON_ID:
            continue
        if target.get("entity_type") != "person" or target.get("entity_id") == SELF_PERSON_ID:
            continue

        target_id = target.get("entity_id") or target.get("label")
        if not target_id:
            continue
        if target_id not in buckets:
            buckets[target_id] = {
                "entity_id": target.get("entity_id"),
                "label": target.get("label") or target_id,
                "entry_ids": set(),
                "predicates": set(),
            }
            evidence_records[target_id] = []
        buckets[target_id]["entry_ids"].update(record.get("source_entry_ids") or [])
        buckets[target_id]["predicates"].add(PREDICATE_LABELS.get(predicate, predicate))
        evidence_records[target_id].append(record)

    if not buckets:
        return None

    ranked = sorted(
        buckets.values(),
        key=lambda row: (-len(row["entry_ids"]), str(row["label"])),
    )
    top = ranked[0]
    lines = [
        f"집계 기준으로 보면 곽비가 가장 자주 만난 사람은 {top['label']}입니다.",
        "",
        "상위 인물:",
    ]
    for index_no, row in enumerate(ranked[:8], start=1):
        entry_ids = sorted(row["entry_ids"])
        dates = ", ".join(short_entry_label(entry_id, entry_map) for entry_id in entry_ids[:10])
        if len(entry_ids) > 10:
            dates += f" 외 {len(entry_ids) - 10}일"
        predicates = " · ".join(sorted(row["predicates"]))
        lines.append(f"{index_no}. {row['label']}: {len(entry_ids)}개 날짜 ({dates}) - {predicates}")
    lines.extend(
        [
            "",
            "기준: semantic assertion에서 subject가 郭畀(person-0001)이고, 방문·마주침·맞이함·식사/술자리·동행으로 확인된 관계만 세었습니다.",
            "제외: 곽비 자신, 만나지 못한 방문(not_met), 단순 언급만 있는 기록.",
        ]
    )

    top_evidence = []
    for row in ranked[:3]:
        records = evidence_records.get(row["entity_id"], [])[:4]
        for record in records:
            item = format_evidence(record, 120, ["집계", row["label"]])
            first_entry = (item.get("source_entry_ids") or [""])[0]
            entry_record = entry_map.get(first_entry)
            if entry_record:
                item["date_label"] = (entry_record.get("metadata") or {}).get("date_label")
                item["summary"] = entry_record.get("summary") or item.get("summary")
                item["original_snippet"] = entry_record.get("original_snippet") or item.get("original_snippet")
                item["translation_snippet"] = entry_record.get("translation_snippet") or item.get("translation_snippet")
            top_evidence.append(item)

    result_rows = []
    seen_entries = set()
    for entry_id in sorted(top["entry_ids"]):
        entry_record = entry_map.get(entry_id) or {}
        if entry_id in seen_entries:
            continue
        seen_entries.add(entry_id)
        result_rows.append(
            {
                "entry_id": entry_id,
                "date_label": (entry_record.get("metadata") or {}).get("date_label"),
                "summary": entry_record.get("summary") or compact(entry_record.get("translation_snippet"), 160),
                "score": 120,
                "evidence_count": 1,
            }
        )

    return {
        "answer": "\n".join(lines),
        "evidence": top_evidence[:8],
        "results": result_rows[:8],
        "retrieval_mode": "aggregate_assertion_frequency",
        "confidence": "high",
        "aggregate": {
            "type": "person_meeting_frequency",
            "basis": "semantic_assertions",
            "rows": [
                {
                    "entity_id": row["entity_id"],
                    "label": row["label"],
                    "entry_count": len(row["entry_ids"]),
                    "entry_ids": sorted(row["entry_ids"]),
                    "predicates": sorted(row["predicates"]),
                }
                for row in ranked[:20]
            ],
        },
    }


def fallback_answer(query: str, evidence: list[dict[str, Any]], results: list[dict[str, Any]]) -> str:
    if not evidence:
        return f"'{query}'와 직접 연결되는 근거를 찾지 못했습니다. 인물명, 지명, 원문 한자, 날짜 표현을 조금 바꿔 다시 검색해 보세요."

    lines = [f"'{query}'와 관련된 근거 {len(evidence)}건을 찾았습니다."]
    for item in evidence[:5]:
        entries = ", ".join(item.get("source_entry_ids") or [])
        date = item.get("date_label") or entries or item.get("record_id")
        summary = item.get("translation_snippet") or item.get("summary") or item.get("original_snippet")
        lines.append(f"- {date} ({entries}): {compact(summary, 150)}")
    return "\n".join(lines)


def gateway_answer(query: str, evidence: list[dict[str, Any]]) -> str:
    api_key = os.environ.get("YUNSHAN_GATEWAY_API_KEY")
    if not api_key:
        raise RuntimeError("YUNSHAN_GATEWAY_API_KEY is not set")

    base_url = os.environ.get("YUNSHAN_GATEWAY_BASE_URL", "https://factchat-cloud.mindlogic.ai/v1/gateway").rstrip("/")
    model = os.environ.get("YUNSHAN_GATEWAY_MODEL", "claude-sonnet-4-6")
    endpoint = f"{base_url}/chat/completions/"

    context = []
    for index, item in enumerate(evidence[:8], start=1):
        entity_text = ", ".join(
            entity.get("label") or entity.get("entity_id", "")
            for entity in item.get("matched_entities", [])[:20]
            if entity.get("label") or entity.get("entity_id")
        )
        context.append(
            "\n".join(
                [
                    f"[{index}] Record: {item.get('record_id')}",
                    f"Type: {item.get('record_type')}",
                    f"Entries: {', '.join(item.get('source_entry_ids') or [])}",
                    f"Date: {item.get('date_label') or ''}",
                    f"Certainty: {item.get('certainty')}",
                    f"Review: {item.get('review_status')}",
                    f"Matched terms: {', '.join(item.get('matched_terms') or [])}",
                    f"Entities: {entity_text}",
                    f"Topics: {', '.join(item.get('matched_topics') or [])}",
                    f"Original excerpt: {item.get('original_snippet')}",
                    f"Korean excerpt: {item.get('translation_snippet')}",
                ]
            )
        )

    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "당신은 운산일기 항주 구간 검색 보조자입니다. "
                    "반드시 제공된 근거 안에서만 답하고, 추정하지 마세요. "
                    "답변은 한국어로 작성하고, 각 핵심 주장마다 날짜와 entry_id를 붙이세요. "
                    "근거의 certainty가 uncertain이면 불확실하다고 밝혀야 합니다."
                ),
            },
            {
                "role": "user",
                "content": f"질문: {query}\n\n검색 근거:\n\n" + "\n\n---\n\n".join(context),
            },
        ],
        "temperature": 0.1,
        "max_tokens": 900,
    }

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=25) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload["choices"][0]["message"]["content"]


def search_payload(query: str, use_ai: bool = True) -> dict[str, Any]:
    index = load_index()
    evidence, results, retrieval_mode = local_search(query, index)
    aggregate_payload = person_frequency_payload(query, index)
    if aggregate_payload:
        evidence = aggregate_payload["evidence"]
        results = aggregate_payload["results"]
        retrieval_mode = aggregate_payload["retrieval_mode"]
        answer = aggregate_payload["answer"]
    else:
        answer = fallback_answer(query, evidence, results)
    used_ai = False
    ai_error = None
    if use_ai and evidence and not aggregate_payload:
        try:
            answer = gateway_answer(query, evidence)
            used_ai = True
        except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, KeyError, TimeoutError, OSError) as exc:
            ai_error = str(exc)

    matched_entities: list[dict[str, Any]] = []
    seen_entities: set[str] = set()
    matched_topics: list[str] = []
    for item in evidence:
        for entity in item.get("matched_entities", []):
            key = entity.get("entity_id") or entity.get("label")
            if key and key not in seen_entities:
                seen_entities.add(key)
                matched_entities.append(entity)
        for topic in item.get("matched_topics", []):
            if topic not in matched_topics:
                matched_topics.append(topic)

    top_score = evidence[0]["score"] if evidence else 0
    payload = {
        "query": query,
        "answer": answer,
        "used_ai": used_ai,
        "retrieval_mode": retrieval_mode,
        "confidence": confidence_from_score(top_score) if evidence else "none",
        "results": results,
        "evidence": evidence,
        "matched_entities": matched_entities[:30],
        "matched_topics": matched_topics[:30],
    }
    if aggregate_payload:
        payload["aggregate"] = aggregate_payload["aggregate"]
    if ai_error:
        payload["ai_error"] = ai_error
    return payload


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        response(self, 204, {})

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(raw_body or "{}")
            query = str(body.get("query", "")).strip()
            if not query:
                response(self, 400, {"error": "query is required"})
                return
            use_ai = body.get("use_ai", True) is not False
            response(self, 200, search_payload(query, use_ai=use_ai))
        except Exception as exc:
            response(self, 500, {"error": str(exc)})
