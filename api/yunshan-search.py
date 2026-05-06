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
DEFAULT_GATEWAY_MODEL = "claude-sonnet-4-6"

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
PLACE_PREDICATES = {"visited", "was_at", "traveled_from", "traveled_to", "traveled_via"}
JOURNEY_PREDICATES = {"traveled_from", "traveled_to", "traveled_via"}
OFFICE_PREDICATES = {"held_office", "visited", "was_at"}
MATERIAL_PREDICATES = {"returned_to", "gave_to", "transmitted_document", "exchanged_with", "participated_in"}
SELF_PERSON_ID = "person-0001"
PREDICATE_LABELS = {
    "visited": "방문",
    "encountered": "마주침",
    "welcomed": "맞이함",
    "dined_with": "식사/술자리",
    "traveled_with": "동행",
    "visited_not": "방문했으나 만나지 못함",
    "welcomed_not": "맞이하려 했으나 만나지 못함",
    "was_at": "소재/방문",
    "traveled_from": "출발",
    "traveled_to": "도착",
    "traveled_via": "경유",
    "held_office": "관직",
    "returned_to": "돌려줌",
    "gave_to": "전달/증여",
    "transmitted_document": "문서 전달",
    "exchanged_with": "교환",
}
NOISY_ENTITY_ALIASES = {
    "郭畀",
    "곽비",
    "雲山",
    "운산",
    "杭州",
    "항주",
    "杭城",
    "錢塘",
    "전당",
    "佛",
    "佛像",
    "法堂",
    "불교",
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


def active_model() -> str:
    return os.environ.get("YUNSHAN_GATEWAY_MODEL", DEFAULT_GATEWAY_MODEL)


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
        date_limit = len(entry_ids) if index_no == 1 else 10
        dates = ", ".join(short_entry_label(entry_id, entry_map) for entry_id in entry_ids[:date_limit])
        if len(entry_ids) > date_limit:
            dates += f" 외 {len(entry_ids) - date_limit}일"
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


def predicate_of(record: dict[str, Any]) -> str:
    metadata = record.get("metadata") or {}
    return str(metadata.get("predicate") or metadata.get("edge_type") or "")


def entity_ids_of(record: dict[str, Any]) -> set[str]:
    return {
        str(entity.get("entity_id"))
        for entity in record.get("entities") or []
        if entity.get("entity_id")
    }


def entity_type_of(record: dict[str, Any]) -> str:
    entity_type = record.get("entity_type")
    if entity_type:
        return str(entity_type)
    entities = record.get("entities") or []
    if entities:
        return str(entities[0].get("entity_type") or "")
    record_id = str(record.get("record_id") or "")
    if ":" in record_id:
        prefix = record_id.split(":", 1)[1].split("-", 1)[0]
        return prefix
    return ""


def primary_entity(record: dict[str, Any]) -> dict[str, Any] | None:
    entities = record.get("entities") or []
    return entities[0] if entities else None


def entry_map(index: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        (record.get("source_entry_ids") or [""])[0]: record
        for record in index
        if record.get("record_type") == "entry" and record.get("source_entry_ids")
    }


def entry_order_map(entries: dict[str, dict[str, Any]]) -> dict[str, int]:
    return {
        entry_id: int((record.get("metadata") or {}).get("entry_index", 9999))
        for entry_id, record in entries.items()
    }


def sorted_entry_ids(entry_ids: set[str] | list[str], entries: dict[str, dict[str, Any]]) -> list[str]:
    order = entry_order_map(entries)
    return sorted(set(entry_ids), key=lambda entry_id: (order.get(entry_id, 9999), entry_id))


def date_label_for(entry_id: str, entries: dict[str, dict[str, Any]]) -> str:
    return ((entries.get(entry_id) or {}).get("metadata") or {}).get("date_label") or entry_id


def entry_excerpt(entry_id: str, entries: dict[str, dict[str, Any]], limit: int = 110) -> str:
    record = entries.get(entry_id) or {}
    return compact(record.get("translation_snippet") or record.get("summary") or record.get("original_snippet"), limit)


def result_rows_from_entries(entry_ids: list[str], entries: dict[str, dict[str, Any]], score: float = 120) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for entry_id in entry_ids:
        record = entries.get(entry_id) or {}
        rows.append(
            {
                "entry_id": entry_id,
                "date_label": date_label_for(entry_id, entries),
                "summary": record.get("summary") or compact(record.get("translation_snippet"), 160),
                "score": score,
                "evidence_count": 1,
            }
        )
    return rows


def entry_evidence(
    entry_id: str,
    entries: dict[str, dict[str, Any]],
    score: float,
    matched: list[str],
    matched_entities: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    record = entries.get(entry_id)
    if not record:
        return None
    item = format_evidence(record, score, matched)
    if matched_entities is not None:
        item["matched_entities"] = matched_entities
    return item


def planner_payload(
    query: str,
    intent: str,
    operation: str,
    evidence_source: str,
    entity_matches: list[dict[str, Any]] | None = None,
    query_terms_used: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "intent": intent,
        "operation": operation,
        "evidence_source": evidence_source,
        "query_terms": query_terms_used or query_terms(query)[:12],
        "entity_matches": entity_matches or [],
    }


def safe_entity_terms(record: dict[str, Any]) -> list[str]:
    label_text = set(str(value) for value in record.get("labels") or [] if value)
    entity = primary_entity(record) or {}
    entity_label = str(entity.get("label") or "")
    terms: list[str] = []
    for value in [*(record.get("labels") or []), *(record.get("aliases") or [])]:
        text = str(value or "").strip()
        if not text:
            continue
        if text in NOISY_ENTITY_ALIASES and text not in label_text and text != entity_label:
            continue
        terms.append(text)
    return list(dict.fromkeys(terms))


def find_entity_matches(
    query: str,
    index: list[dict[str, Any]],
    allowed_types: set[str],
    limit: int = 6,
) -> list[dict[str, Any]]:
    normalized_query = normalize_text(query)
    terms = [term for term in query_terms(query) if len(term) > 1]
    scored: list[tuple[float, bool, dict[str, Any]]] = []
    for record in index:
        if record.get("record_type") != "entity":
            continue
        entity_type = entity_type_of(record)
        if entity_type not in allowed_types:
            continue
        entity = primary_entity(record)
        if not entity:
            continue
        candidate_terms = safe_entity_terms(record)
        normalized_terms = [normalize_text(term) for term in candidate_terms if term]
        score = 0.0
        matched_terms: list[str] = []
        entity_label = normalize_text(entity.get("label"))
        exact_label_match = False
        if entity_label and entity_label in normalized_query:
            score += 90
            exact_label_match = True
            matched_terms.append(str(entity.get("label")))
        if any(entity_label and entity_label == normalize_text(term) for term in terms):
            score += 90
            exact_label_match = True
            matched_terms.append(str(entity.get("label")))
        for term in terms:
            normalized_term = normalize_text(term)
            if not normalized_term:
                continue
            for candidate in normalized_terms:
                if normalized_term == candidate:
                    score += 50
                    matched_terms.append(term)
                    break
                if len(normalized_term) >= 2 and normalized_term in candidate:
                    score += 22
                    matched_terms.append(term)
                    break
        if score <= 0:
            continue
        scored.append(
            (
                score,
                exact_label_match,
                {
                    "entity_id": entity.get("entity_id"),
                    "entity_type": entity_type,
                    "label": entity.get("label"),
                    "matched_terms": list(dict.fromkeys(matched_terms))[:8],
                    "entry_count": (record.get("metadata") or {}).get("entry_count"),
                    "record": record,
                },
            )
        )
    if any(exact for _score, exact, _match in scored):
        scored = [item for item in scored if item[1]]
    scored.sort(key=lambda item: (-item[0], str(item[2].get("label") or "")))
    matches: list[dict[str, Any]] = []
    seen: set[str] = set()
    for _score, _exact, match in scored:
        entity_id = str(match.get("entity_id") or "")
        if entity_id in seen:
            continue
        seen.add(entity_id)
        match = dict(match)
        match.pop("record", None)
        matches.append(match)
        if len(matches) >= limit:
            break
    return matches


def entity_records_for_matches(index: list[dict[str, Any]], entity_matches: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    wanted = {str(match.get("entity_id")) for match in entity_matches if match.get("entity_id")}
    records: dict[str, dict[str, Any]] = {}
    for record in index:
        if record.get("record_type") != "entity":
            continue
        entity = primary_entity(record)
        entity_id = str((entity or {}).get("entity_id") or "")
        if entity_id in wanted:
            records[entity_id] = record
    return records


def record_matches_entities(record: dict[str, Any], entity_ids: set[str]) -> bool:
    return bool(entity_ids & entity_ids_of(record))


def evidence_source_from_record_types(record_types: set[str]) -> str:
    if record_types <= {"assertion"}:
        return "semantic_assertions"
    if record_types <= {"graph_edge"}:
        return "knowledge_graph_edges"
    if record_types <= {"entry", "entity"}:
        return "entries"
    return "mixed"


def entity_records_payload(
    query: str,
    index: list[dict[str, Any]],
    intent: str,
    operation: str,
    allowed_entity_types: set[str],
    predicates: set[str] | None,
    intro_label: str,
    basis_label: str,
) -> dict[str, Any] | None:
    matches = find_entity_matches(query, index, allowed_entity_types)
    if not matches:
        return None
    entries = entry_map(index)
    entity_records = entity_records_for_matches(index, matches)
    wanted_ids = {str(match.get("entity_id")) for match in matches if match.get("entity_id")}
    matched_entities = [
        {
            "entity_id": match.get("entity_id"),
            "entity_type": match.get("entity_type"),
            "label": match.get("label"),
        }
        for match in matches
    ]

    source_entry_ids: set[str] = set()
    structured_records: list[dict[str, Any]] = []
    for record in index:
        if not record_matches_entities(record, wanted_ids):
            continue
        predicate = predicate_of(record)
        if predicates is not None and record.get("record_type") in {"assertion", "graph_edge"} and predicate not in predicates:
            continue
        if record.get("record_type") in {"assertion", "graph_edge"}:
            structured_records.append(record)
        if record.get("record_type") in {"entry", "assertion", "graph_edge"}:
            source_entry_ids.update(record.get("source_entry_ids") or [])

    for record in entity_records.values():
        source_entry_ids.update(record.get("source_entry_ids") or [])

    ordered_entries = sorted_entry_ids(source_entry_ids, entries)
    if not ordered_entries:
        return None

    labels = " · ".join(match.get("label") or match.get("entity_id") or "" for match in matches[:4])
    lines = [f"{intro_label} '{labels}' 관련 기록은 {len(ordered_entries)}개 날짜에서 확인됩니다."]
    for entry_id in ordered_entries[:12]:
        lines.append(f"- {date_label_for(entry_id, entries)} ({entry_id}): {entry_excerpt(entry_id, entries)}")
    if len(ordered_entries) > 12:
        lines.append(f"- 그 밖에 {len(ordered_entries) - 12}개 날짜가 더 있습니다.")
    lines.append(f"기준: {basis_label}")

    evidence: list[dict[str, Any]] = []
    for record in structured_records[:6]:
        item = format_evidence(record, 120, ["온톨로지", *[str(match.get("label")) for match in matches[:3]]])
        evidence.append(item)
    for entry_id in ordered_entries:
        if len(evidence) >= 8:
            break
        item = entry_evidence(entry_id, entries, 110, [str(match.get("label")) for match in matches[:3]], matched_entities)
        if item:
            evidence.append(item)

    record_types = {item.get("record_type") for item in evidence if item.get("record_type")}
    evidence_source = evidence_source_from_record_types(record_types)
    return {
        "answer": "\n".join(lines),
        "evidence": evidence,
        "results": result_rows_from_entries(ordered_entries[:12], entries),
        "retrieval_mode": f"ontology_{operation}",
        "confidence": "high",
        "planner": planner_payload(query, intent, operation, evidence_source, matches),
        "evidence_source": evidence_source,
    }


def wants_arrival_people(query: str) -> bool:
    text = normalize_text(query)
    return (
        ("항주" in text or "杭州" in text)
        and any(token in text for token in ("도착", "입성", "직후", "들어"))
        and any(token in text for token in ("누구", "사람", "인물", "만났"))
    )


def arrival_people_payload(query: str, index: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not wants_arrival_people(query):
        return None
    entries = entry_map(index)
    target_entries = ["entry-1308-09-22", "entry-1308-09-23"]
    people_by_entry: dict[str, dict[str, set[str]]] = {entry_id: {} for entry_id in target_entries}
    evidence_records: list[dict[str, Any]] = []
    for record in index:
        if record.get("record_type") not in {"assertion", "graph_edge"}:
            continue
        if predicate_of(record) not in MEETING_PREDICATES:
            continue
        source_ids = set(record.get("source_entry_ids") or [])
        if not source_ids & set(target_entries):
            continue
        entities = record.get("entities") or []
        if len(entities) < 2:
            continue
        if entities[0].get("entity_id") != SELF_PERSON_ID:
            continue
        target = entities[1]
        if target.get("entity_type") != "person" or target.get("entity_id") == SELF_PERSON_ID:
            continue
        for entry_id in source_ids & set(target_entries):
            bucket = people_by_entry.setdefault(entry_id, {})
            label = str(target.get("label") or target.get("entity_id"))
            bucket.setdefault(label, set()).add(PREDICATE_LABELS.get(predicate_of(record), predicate_of(record)))
        evidence_records.append(record)

    if not any(people_by_entry.values()):
        return None
    lines = ["항주 도착 직후 만난 인물은 다음과 같이 확인됩니다."]
    for entry_id in target_entries:
        people = people_by_entry.get(entry_id) or {}
        if not people:
            continue
        details = ", ".join(
            f"{name}({ '·'.join(sorted(predicates)) })"
            for name, predicates in sorted(people.items())
        )
        lines.append(f"- {date_label_for(entry_id, entries)} ({entry_id}): {details}")
    lines.append("기준: 항주 입성일(entry-1308-09-22)과 바로 다음날(entry-1308-09-23)의 인물 관계 assertion/graph edge.")

    evidence = [format_evidence(record, 130, ["항주 도착", "인물"]) for record in evidence_records[:8]]
    ordered_entries = [entry_id for entry_id in target_entries if people_by_entry.get(entry_id)]
    return {
        "answer": "\n".join(lines),
        "evidence": evidence,
        "results": result_rows_from_entries(ordered_entries, entries),
        "retrieval_mode": "ontology_arrival_people",
        "confidence": "high",
        "planner": planner_payload(query, "arrival_people", "arrival_people", "mixed"),
        "evidence_source": "mixed",
    }


def not_met_payload(query: str, index: list[dict[str, Any]]) -> dict[str, Any] | None:
    if "not_met" not in classify_query(query):
        return None
    entries = entry_map(index)
    evidence_records: list[dict[str, Any]] = []
    rows: dict[tuple[str, str], set[str]] = {}
    for record in index:
        if record.get("record_type") not in {"assertion", "graph_edge"}:
            continue
        metadata = record.get("metadata") or {}
        predicate = predicate_of(record)
        is_not_met = bool(metadata.get("negated")) or predicate in {"visited_not", "welcomed_not"} or "not_met" in record.get("aliases", [])
        if not is_not_met:
            continue
        entities = record.get("entities") or []
        target = next(
            (
                entity
                for entity in entities[1:]
                if entity.get("entity_type") == "person" and entity.get("entity_id") != SELF_PERSON_ID
            ),
            None,
        )
        if not target:
            continue
        evidence_records.append(record)
        label = str(target.get("label") or target.get("entity_id"))
        for entry_id in record.get("source_entry_ids") or []:
            rows.setdefault((entry_id, label), set()).add(PREDICATE_LABELS.get(predicate, predicate or "not_met"))

    if not rows:
        return None
    ordered = sorted(rows.items(), key=lambda item: (entry_order_map(entries).get(item[0][0], 9999), item[0][1]))
    lines = [f"방문했지만 만나지 못한 기록은 {len({entry for (entry, _label), _pred in ordered})}개 날짜에서 확인됩니다."]
    for (entry_id, label), predicates in ordered[:14]:
        lines.append(f"- {date_label_for(entry_id, entries)} ({entry_id}): {label} - {'·'.join(sorted(predicates))}")
    if len(ordered) > 14:
        lines.append(f"- 그 밖에 {len(ordered) - 14}건이 더 있습니다.")
    lines.append("기준: negated assertion, visited_not/welcomed_not graph edge, not_met alias.")

    evidence = [format_evidence(record, 125, ["방문 실패", "not_met"]) for record in evidence_records[:8]]
    ordered_entries = sorted_entry_ids({entry_id for (entry_id, _label), _predicates in rows.items()}, entries)
    return {
        "answer": "\n".join(lines),
        "evidence": evidence,
        "results": result_rows_from_entries(ordered_entries[:12], entries),
        "retrieval_mode": "ontology_not_met_records",
        "confidence": "high",
        "planner": planner_payload(query, "not_met_records", "not_met_records", "mixed"),
        "evidence_source": "mixed",
    }


def wants_journey(query: str) -> bool:
    text = normalize_text(query)
    return any(token in text for token in ("이동 경로", "여정", "경로", "수로", "항주 도착 전후", "항주 이동"))


def journey_payload(query: str, index: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not wants_journey(query):
        return None
    entries = entry_map(index)
    entry_ids: set[str] = set()
    evidence_records: list[dict[str, Any]] = []
    for record in index:
        predicate = predicate_of(record)
        if record.get("record_type") in {"assertion", "graph_edge"} and predicate in JOURNEY_PREDICATES:
            entry_ids.update(record.get("source_entry_ids") or [])
            evidence_records.append(record)
        if record.get("record_type") == "entry":
            metadata = record.get("metadata") or {}
            if metadata.get("route") or metadata.get("transport"):
                entry_ids.update(record.get("source_entry_ids") or [])

    ordered_entries = sorted_entry_ids(entry_ids, entries)
    if "항주" in normalize_text(query) and any(token in normalize_text(query) for token in ("도착", "전후", "입성")):
        ordered_entries = [
            entry_id
            for entry_id in ordered_entries
            if entry_order_map(entries).get(entry_id, 9999) <= entry_order_map(entries).get("entry-1308-09-22", 9999)
        ]
    if not ordered_entries:
        return None
    lines = ["항주 이동 경로는 날짜 흐름상 다음 기록에서 확인됩니다."]
    for entry_id in ordered_entries[:12]:
        metadata = (entries.get(entry_id) or {}).get("metadata") or {}
        route = metadata.get("route") or "이동 기록"
        transport = metadata.get("transport")
        suffix = f" · 이동수단: {transport}" if transport else ""
        lines.append(f"- {date_label_for(entry_id, entries)} ({entry_id}): {route}{suffix}")
    lines.append("기준: entry.route/transport와 traveled_from/traveled_to/traveled_via 온톨로지 관계.")

    evidence: list[dict[str, Any]] = []
    for record in evidence_records[:5]:
        evidence.append(format_evidence(record, 118, ["이동", "여정"]))
    for entry_id in ordered_entries:
        if len(evidence) >= 8:
            break
        item = entry_evidence(entry_id, entries, 112, ["이동", "여정"])
        if item:
            evidence.append(item)
    return {
        "answer": "\n".join(lines),
        "evidence": evidence,
        "results": result_rows_from_entries(ordered_entries[:12], entries),
        "retrieval_mode": "ontology_journey_records",
        "confidence": "high",
        "planner": planner_payload(query, "journey_records", "journey_records", "mixed"),
        "evidence_source": "mixed",
    }


def ontology_query_payload(query: str, index: list[dict[str, Any]]) -> dict[str, Any] | None:
    aggregate = person_frequency_payload(query, index)
    if aggregate:
        aggregate["planner"] = planner_payload(query, "person_frequency", "person_frequency", "semantic_assertions")
        aggregate["evidence_source"] = "semantic_assertions"
        return aggregate

    for builder in (arrival_people_payload, not_met_payload, journey_payload):
        payload = builder(query, index)
        if payload:
            return payload

    text = normalize_text(query)
    if re.search(r"문서|작품|소비품|경전|早飯|조반|아침밥|차|술|佛|遺教經", text):
        payload = entity_records_payload(
            query,
            index,
            "material_records",
            "material_records",
            {"document", "work", "consumable"},
            MATERIAL_PREDICATES,
            "물질/문헌",
            "document/work/consumable entity와 물질 관련 predicate를 우선 조회했습니다.",
        )
        if payload:
            return payload

    if re.search(r"관직|관청|업무|省中|성중|도목|同知|都目|제국기구", text):
        payload = entity_records_payload(
            query,
            index,
            "office_institution_records",
            "office_institution_records",
            {"office", "institution", "place"},
            OFFICE_PREDICATES | PLACE_PREDICATES,
            "관직/관청",
            "office/institution/place entity와 held_office/visited/was_at 관계를 우선 조회했습니다.",
        )
        if payload:
            return payload

    if re.search(r"누구|인물|사람|만났|장덕휘|張德輝|德輝|이숙의|탕군백", text):
        payload = entity_records_payload(
            query,
            index,
            "person_records",
            "person_records",
            {"person"},
            MEETING_PREDICATES | {"held_office", "gave_to", "dispatched", "transmitted_document", "parted_from"},
            "인물",
            "person entity와 인물 관계 predicate를 우선 조회했습니다.",
        )
        if payload:
            return payload

    if re.search(r"어디|공간|장소|항주|杭州|吳山|오산|西湖|서호|省中|성중|사찰|관청", text):
        payload = entity_records_payload(
            query,
            index,
            "place_or_institution_records",
            "place_or_institution_records",
            {"place", "institution"},
            PLACE_PREDICATES | OFFICE_PREDICATES,
            "공간/기관",
            "place/institution entity와 was_at/visited/traveled 관계를 우선 조회했습니다.",
        )
        if payload:
            return payload

    return None


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
    model = active_model()
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
    ontology_payload = ontology_query_payload(query, index)
    if ontology_payload:
        evidence = ontology_payload["evidence"]
        results = ontology_payload["results"]
        retrieval_mode = ontology_payload["retrieval_mode"]
        answer = ontology_payload["answer"]
        confidence = ontology_payload.get("confidence", "high")
        planner = ontology_payload.get("planner")
        evidence_source = ontology_payload.get("evidence_source", "mixed")
    else:
        evidence, results, retrieval_mode = local_search(query, index)
        answer = fallback_answer(query, evidence, results)
        confidence = confidence_from_score(evidence[0]["score"]) if evidence else "none"
        planner = planner_payload(query, "hybrid_search", "score_records", "mixed")
        evidence_source = "mixed"
    used_ai = False
    ai_error = None
    answer_source = "ontology_query" if ontology_payload else "hybrid_search_fallback"
    if use_ai and evidence:
        try:
            answer = gateway_answer(query, evidence)
            used_ai = True
            answer_source = "ai_gateway_summary"
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

    payload = {
        "query": query,
        "answer": answer,
        "used_ai": used_ai,
        "ai_model": active_model(),
        "answer_source": answer_source,
        "rag_used": True,
        "rag_index": "yunshan_search_index.jsonl",
        "retrieval_mode": retrieval_mode,
        "evidence_source": evidence_source,
        "confidence": confidence,
        "planner": planner,
        "results": results,
        "evidence": evidence,
        "matched_entities": matched_entities[:30],
        "matched_topics": matched_topics[:30],
    }
    if ontology_payload and ontology_payload.get("aggregate"):
        payload["aggregate"] = ontology_payload["aggregate"]
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
