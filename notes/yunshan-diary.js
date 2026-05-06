(function () {
  const state = {
    data: null,
    entries: [],
    activeEntryId: "",
    calendarIndex: 0,
    peopleQuery: "",
    peopleTab: "network",
    selectedPersonId: "",
    placesQuery: "",
    placesTab: "journey",
    institutionsTab: "offices",
    materialsTab: "documents",
    institutionsQuery: "",
    materialsQuery: "",
    topicsQuery: "",
    topicsTab: "matrix",
    selectedTopicId: "",
    entityRowCache: new Map(),
    visibleCount: {
      people: 48,
      places: 48,
      institutions: 48,
      materials: 48,
      topics: 48,
    },
  };

  const PAGE_SIZE = 48;
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const ENTITY_CATEGORY_KEYS = [
    "persons",
    "places",
    "offices",
    "institutions",
    "documents",
    "works",
    "consumables",
    "topics",
    "responses",
  ];
  const DISPLAY_ENTITY_GROUPS = [
    { key: "people", label: "인물", categories: ["persons"] },
    { key: "spaces", label: "공간", categories: ["places", "institutions"] },
    { key: "offices", label: "관직", categories: ["offices"] },
    { key: "objects", label: "물질", categories: ["documents", "works", "consumables"] },
    { key: "contexts", label: "토픽", categories: ["topics", "responses"] },
  ];
  const MATERIAL_TABS = [
    { key: "documents", label: "문서", categories: ["documents"], placeholder: "문서명, 관련 날짜로 검색" },
    { key: "works", label: "작품", categories: ["works"], placeholder: "작품명, 관련 날짜로 검색" },
    { key: "consumables", label: "소비품", categories: ["consumables"], placeholder: "소비품명, 관련 날짜로 검색" },
  ];
  const IMPERIAL_TABS = [
    { key: "offices", label: "관직" },
    { key: "bureaus", label: "관청" },
    { key: "workflows", label: "업무" },
  ];
  const ALIAS_GROUPS = [
    ["장덕휘", "張德輝", "德輝"],
    ["불교", "경전", "遺教經", "사경", "필사"],
    ["오산", "五山"],
    ["서호", "西湖"],
    ["항주", "杭州", "전당", "錢塘"],
  ];
  const CATEGORY_LABEL_OVERRIDES = {
    responses: "감상",
  };
  const PUBLIC_LABEL_OVERRIDES = [
    { pattern: /談星說命/, label: "점성술" },
    { pattern: /山林閒自有一種淸氣/, label: "산수 감상" },
  ];
  const TOPIC_LABEL_ALIASES = new Map([
    ["관청업무", "관청 업무"],
    ["관청", "관청 업무"],
    ["유람", "유람"],
    ["관광", "유람"],
    ["역사감상", "역사 감상"],
    ["감정", "감상"],
    ["음다", "음식"],
    ["음주", "음식"],
    ["서화", "문예"],
    ["차전", "차용"],
  ]);
  const CORE_TOPIC_LABELS = [
    "교유",
    "관청 업무",
    "이동",
    "음식",
    "방문",
    "서예",
    "문예",
    "유람",
    "불교",
    "감상",
    "이별",
    "숙박",
  ];
  const TOPIC_LABELS_EXCLUDED_FROM_MATRIX = new Set(["날씨"]);
  const TOPIC_COLOR_PALETTE = [
    "#dc2626",
    "#ea580c",
    "#d97706",
    "#ca8a04",
    "#65a30d",
    "#16a34a",
    "#059669",
    "#0d9488",
    "#0891b2",
    "#0284c7",
    "#2563eb",
    "#4f46e5",
    "#7c3aed",
    "#9333ea",
    "#c026d3",
    "#db2777",
    "#e11d48",
    "#be123c",
    "#b45309",
    "#4d7c0f",
    "#047857",
    "#0f766e",
    "#0369a1",
    "#1d4ed8",
    "#4338ca",
    "#6d28d9",
    "#a21caf",
    "#be185d",
    "#9f1239",
    "#92400e",
    "#3f6212",
    "#065f46",
    "#155e75",
    "#1e40af",
    "#3730a3",
    "#581c87",
    "#86198f",
    "#9d174d",
    "#7f1d1d",
    "#475569",
  ];
  const TOPIC_COLOR_OVERRIDES = new Map([
    ["교유", "#d72638"],
    ["관청 업무", "#2563eb"],
    ["이동", "#f97316"],
    ["음식", "#d99a00"],
    ["방문", "#16a34a"],
    ["서예", "#0d9488"],
    ["문예", "#0284c7"],
    ["유람", "#4f46e5"],
    ["불교", "#7c3aed"],
    ["감상", "#db2777"],
    ["산수 감상", "#a21caf"],
    ["이별", "#be123c"],
    ["숙박", "#64748b"],
    ["점성술", "#581c87"],
  ]);
  const DOCUMENT_FLOW_ORDER = ["받음", "전달/제출", "작성/수정", "청탁", "관청 처리", "언급/확인"];
  const WORK_KIND_ORDER = ["불상·불교 이미지", "그림", "비석·글씨", "저작·문집", "기타 작품"];
  const CONSUMABLE_TYPE_ORDER = ["식사", "음식", "차", "술", "종이·문구", "생활 물품", "소비품"];
  const WEATHER_COLORS = {
    rain: "#5f7792",
    clear: "#c9a15a",
    cloudy: "#7a8186",
    cold: "#637f99",
    warm: "#b47856",
    mixed: "#777891",
    unknown: "#8a9177",
  };
  const HANGZHOU_ROUTE_STOPS = [
    {
      entryId: "entry-1308-09-16",
      placeId: "place-0001",
      label: "呂城",
      sublabel: "9월 16일 밤배 출발",
      x: 88,
      y: 270,
    },
    {
      entryId: "entry-1308-09-17",
      placeId: "place-0003",
      label: "奔牛",
      sublabel: "9월 17일 경유",
      x: 218,
      y: 210,
    },
    {
      entryId: "entry-1308-09-17",
      placeId: "place-0004",
      label: "常州",
      sublabel: "9월 17일",
      x: 350,
      y: 170,
    },
    {
      entryId: "entry-1308-09-18",
      placeId: "place-0012",
      label: "姑蘇",
      sublabel: "9월 18일",
      x: 500,
      y: 214,
    },
    {
      entryId: "entry-1308-09-19",
      placeId: "place-0013",
      label: "平江",
      sublabel: "9월 19일",
      x: 620,
      y: 250,
    },
    {
      entryId: "entry-1308-09-21",
      placeId: "place-0100",
      label: "長安",
      sublabel: "9월 21일",
      x: 742,
      y: 302,
    },
    {
      entryId: "entry-1308-09-22",
      placeId: "place-0031",
      label: "杭州",
      sublabel: "9월 22일 입성",
      x: 870,
      y: 350,
    },
  ];

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function compactText(text, max = 120) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
  }

  function pageKind() {
    return document.body.dataset.yunshanPage || "home";
  }

  function entryById(entryId) {
    return state.entries.find((entry) => entry.entry_id === entryId);
  }

  function placeById(placeId) {
    if (!placeId) {
      return null;
    }
    return (state.data.places || []).find((place) => place.id === placeId)
      || (state.data.institutions || []).find((place) => place.id === placeId)
      || null;
  }

  function placeCoordinates(row) {
    return row?.coordinates || row?.place_info?.coordinates || null;
  }

  function placeParentId(row) {
    return row?.parent_place_id || row?.place_info?.parent_place_id || "";
  }

  function placeType(row) {
    return row?.place_type || row?.place_info?.place_type || "";
  }

  function isConfirmedChgis(row) {
    return Boolean(row?.chgis?.id && row?.chgis?.grade === "confirmed");
  }

  function entryDateParts(entry) {
    const match = entry.entry_id.match(/entry-(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return { year: 0, month: 0, day: 0, label: entry.date_label || entry.entry_id };
    }
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      label: `${match[1]}.${match[2]}.${match[3]}`,
    };
  }

  function entityCategories() {
    return state.data?.meta?.entity_categories || ENTITY_CATEGORY_KEYS.map((key) => ({ key, label: key }));
  }

  function categoryLabel(categoryKey) {
    return CATEGORY_LABEL_OVERRIDES[categoryKey]
      || entityCategories().find((category) => category.key === categoryKey)?.label
      || categoryKey;
  }

  function publicLabel(value) {
    const text = String(value || "").trim();
    const override = PUBLIC_LABEL_OVERRIDES.find((item) => item.pattern.test(text));
    return override ? override.label : text;
  }

  function publicTopicLabel(value) {
    const label = publicLabel(value);
    return TOPIC_LABEL_ALIASES.get(label) || label;
  }

  function publicEntityLabel(item) {
    if (!item) {
      return "";
    }
    if (typeof item === "string") {
      return publicLabel(item);
    }
    return publicLabel(item.label || item.normalized || item.surface || item.id);
  }

  function entityCacheKey(category, id) {
    return `${category || ""}:${id || ""}`;
  }

  function normalizeEntityMergeKey(row) {
    return publicEntityLabel(row)
      .replace(/\s+/g, "")
      .replace(/郞/g, "郎")
      .replace(/煇/g, "輝")
      .replace(/[臺台]/g, "臺")
      .trim();
  }

  function uniqueValues(values) {
    const seen = new Set();
    return values
      .filter(Boolean)
      .filter((value) => {
        const key = typeof value === "string" ? value : JSON.stringify(value);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  function mergeEntityRows(rows, category) {
    const grouped = new Map();
    (rows || []).forEach((row) => {
      const key = normalizeEntityMergeKey(row) || row.id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(row);
    });
    return Array.from(grouped.values()).map((group) => {
      if (group.length === 1) {
        return group[0];
      }
      const primary = group
        .slice()
        .sort((left, right) => (right.count - left.count) || (right.mention_count || 0) - (left.mention_count || 0))[0];
      const entries = uniqueValues(group.flatMap((row) => row.entries || []));
      const aliases = uniqueValues([
        ...group.flatMap((row) => row.aliases || []),
        ...group.map((row) => publicEntityLabel(row)).filter((label) => label !== publicEntityLabel(primary)),
      ]);
      return {
        ...primary,
        id: primary.id,
        category: primary.category || category,
        label: publicEntityLabel(primary),
        aliases,
        entries,
        count: entries.length || group.reduce((sum, row) => sum + (row.count || 0), 0),
        mention_count: group.reduce((sum, row) => sum + (row.mention_count || row.count || 0), 0),
        roles: uniqueValues(group.flatMap((row) => row.roles || [])),
        register_contexts: uniqueValues(group.flatMap((row) => row.register_contexts || [])),
        merged_ids: group.map((row) => row.id),
      };
    });
  }

  function publicAliasList(row, limit = 8) {
    const seen = new Set([publicEntityLabel(row)]);
    return (row.aliases || [])
      .map(publicLabel)
      .filter((alias) => {
        if (!alias || seen.has(alias)) {
          return false;
        }
        seen.add(alias);
        return true;
      })
      .slice(0, limit);
  }

  function publicTopicKind(row) {
    if (row.category === "weather") {
      return "날씨";
    }
    return row.category === "responses" ? "감상" : "주제";
  }

  function topicColor(label, index = 0) {
    return TOPIC_COLOR_OVERRIDES.get(label) || TOPIC_COLOR_PALETTE[index % TOPIC_COLOR_PALETTE.length];
  }

  function uniqueTopicColor(label, index, usedColors) {
    const candidates = [
      TOPIC_COLOR_OVERRIDES.get(label),
      TOPIC_COLOR_PALETTE[index % TOPIC_COLOR_PALETTE.length],
      ...TOPIC_COLOR_PALETTE,
    ].filter(Boolean);
    const color = candidates.find((candidate) => !usedColors.has(candidate.toLowerCase()));
    if (color) {
      usedColors.add(color.toLowerCase());
      return color;
    }
    let hue = (index * 47 + 19) % 360;
    let generated = `hsl(${hue} 70% 42%)`;
    while (usedColors.has(generated.toLowerCase())) {
      hue = (hue + 37) % 360;
      generated = `hsl(${hue} 70% 42%)`;
    }
    usedColors.add(generated.toLowerCase());
    return generated;
  }

  function assignUniqueTopicColors(rows) {
    const usedColors = new Set();
    return rows.map((row, index) => ({
      ...row,
      id: `topic-flow-${index}`,
      color: uniqueTopicColor(row.label, index, usedColors),
      colorIndex: index,
    }));
  }

  function weatherProfile(weather) {
    const text = String(weather || "");
    if (!text.trim()) {
      return { key: "unknown", label: "", color: "transparent" };
    }
    if (/雨|비|霖|霽/.test(text)) {
      return { key: "rain", label: "雨", color: WEATHER_COLORS.rain };
    }
    if (/雪|霜|寒|冷/.test(text)) {
      return { key: "cold", label: "寒", color: WEATHER_COLORS.cold };
    }
    if (/暑|暄|熱|汗/.test(text)) {
      return { key: "warm", label: "暑", color: WEATHER_COLORS.warm };
    }
    if (/陰|阴|曇/.test(text)) {
      return { key: "cloudy", label: "陰", color: WEATHER_COLORS.cloudy };
    }
    if (/晴|霽/.test(text)) {
      return { key: "clear", label: "晴", color: WEATHER_COLORS.clear };
    }
    return { key: "mixed", label: "候", color: WEATHER_COLORS.mixed };
  }

  function entityItems(entry) {
    const groups = entry.entities || {};
    return ENTITY_CATEGORY_KEYS.flatMap((key) => groups[key] || []);
  }

  function groupedEntityItems(entry, displayGroup) {
    const groups = entry.entities || {};
    return displayGroup.categories.flatMap((categoryKey) =>
      (groups[categoryKey] || []).map((item) => ({
        ...item,
        display_category: categoryLabel(categoryKey),
      }))
    );
  }

  function chipList(items, limit = 80) {
    const rows = (items || []).slice(0, limit);
    if (!rows.length) {
      return '<span class="entity-chip">없음</span>';
    }
    const chips = rows.map((item) => {
      const label = publicEntityLabel(item);
      return `<span class="entity-chip">${escapeHtml(label)}</span>`;
    });
    if ((items || []).length > rows.length) {
      chips.push(`<span class="entity-chip">+${items.length - rows.length}</span>`);
    }
    return chips.join("");
  }

  async function loadData() {
    if (window.YUNSHAN_PORTAL_DATA) {
      return window.YUNSHAN_PORTAL_DATA;
    }
    const response = await fetch("../data/yunshan/portal-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("portal-data.json을 불러오지 못했습니다.");
    }
    return response.json();
  }

  function renderStats() {
    const entriesTotal = $("#entries-total");
    if (!entriesTotal) {
      return;
    }
    entriesTotal.textContent = state.entries.length;
    $("#people-total").textContent = state.data.persons?.length || 0;
    $("#places-total").textContent = (state.data.places?.length || 0) + (state.data.institutions?.length || 0);
    $("#entities-total").textContent = state.data.meta?.entity_total_unique || 0;
  }

  function renderEntryCard(entry, attr = "data-entry-id") {
    const active = entry.entry_id === state.activeEntryId ? " is-active" : "";
    const excerpt = entry.original || entry.translation || "";
    return `
      <button type="button" class="entry-card${active}" ${attr}="${escapeHtml(entry.entry_id)}">
        <strong>${escapeHtml(entry.date_label || entryDateParts(entry).label)}</strong>
        <span>${escapeHtml(compactText(excerpt, 126))}</span>
        <div class="chip-row browser-meta">
          <span class="entity-chip">인물 ${entry.persons?.length || 0}</span>
          <span class="entity-chip">공간 ${(entry.places?.length || 0) + (entry.institutions?.length || 0)}</span>
          <span class="entity-chip">엔티티 ${entityItems(entry).length}</span>
        </div>
      </button>
    `;
  }

  function bindEntryButtons(root = document) {
    $all("[data-entry-id]", root).forEach((button) => {
      button.addEventListener("click", () => selectEntry(button.dataset.entryId));
    });
  }

  function selectEntry(entryId) {
    const entry = entryById(entryId);
    const reader = $("#entry-reader") || $("#entity-focus") || $("#yunshan-search-results");
    if (!entry || !reader) {
      return;
    }
    state.activeEntryId = entryId;
    $all("[data-entry-id]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.entryId === entryId);
    });
    reader.innerHTML = renderEntryReader(entry);
  }

  function renderEntryReader(entry) {
    const categories = DISPLAY_ENTITY_GROUPS
      .map((group) => {
        const items = groupedEntityItems(entry, group);
        if (!items.length) {
          return "";
        }
        return `
          <details class="entry-disclosure" open>
            <summary class="entry-disclosure-summary">
              <strong>${escapeHtml(group.label)}</strong>
              <span class="entry-disclosure-count">${items.length}</span>
            </summary>
            <div class="entry-disclosure-body chip-row">${chipList(items)}</div>
          </details>
        `;
      })
      .join("");

    return `
      <div class="detail-head">
        <h2>${escapeHtml(entry.date_label || entryDateParts(entry).label)}</h2>
      </div>
      <section class="entry-translation-shell">
        <h3>Original</h3>
        <p class="original-text">${escapeHtml(entry.original || "원문 없음")}</p>
      </section>
      <section class="entry-translation-shell">
        <h3>Translation</h3>
        <p>${escapeHtml(entry.translation || "번역 없음")}</p>
      </section>
      <section class="entry-topic-strip">
        <h3>Entry Entities</h3>
        ${categories || '<p class="muted">엔티티 없음</p>'}
      </section>
    `;
  }

  function normalizeSearchText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function queryTerms(query) {
    const normalized = normalizeSearchText(query);
    const terms = new Set(normalized.split(/[\s,./;|!?]+/).filter((term) => term.length > 1));
    if (normalized) {
      terms.add(normalized);
    }
    Array.from(terms).forEach((term) => {
      const stripped = term.replace(/(이|가|은|는|을|를|과|와|이나|나|에서|에게|으로|로|의|도|만)$/u, "");
      if (stripped.length > 1) {
        terms.add(stripped);
      }
    });
    ALIAS_GROUPS.forEach((group) => {
      if (group.some((alias) => normalized.includes(alias.toLowerCase()))) {
        group.forEach((alias) => terms.add(alias.toLowerCase()));
      }
    });
    return Array.from(terms);
  }

  function entryHaystack(entry) {
    const entityText = entityItems(entry)
      .map((item) => [
        item.label,
        item.surface,
        item.normalized,
        item.role,
        item.mention_type,
        item.register_context,
        item.certainty_reason,
        item.note,
      ].join(" "))
      .join(" ");
    return normalizeSearchText([
      entry.entry_id,
      entry.date_label,
      entry.summary,
      entry.translation,
      entry.original,
      entry.topics?.join(" "),
      entityText,
      entry.weather,
      entry.route,
      entry.transport,
    ].join(" "));
  }

  function localSearch(query, limit = 8) {
    const terms = queryTerms(query);
    const normalizedQuery = normalizeSearchText(query);
    return state.entries
      .map((entry) => {
        const haystack = entryHaystack(entry);
        let score = 0;
        terms.forEach((term) => {
          if (haystack.includes(term)) {
            score += term.length > 2 ? 6 : 3;
          }
        });
        if (normalizedQuery && haystack.includes(normalizedQuery)) {
          score += 12;
        }
        if (normalizedQuery.includes("항주") && normalizedQuery.includes("도착")) {
          if (
            entry.entry_id === "entry-1308-09-22" ||
            haystack.includes("성 밖에 도착") ||
            haystack.includes("북관문") ||
            haystack.includes("접대사")
          ) {
            score += 24;
          }
        }
        return { entry, score };
      })
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score || left.entry.index - right.entry.index)
      .slice(0, limit)
      .map((row) => row.entry);
  }

  function renderSearchResults(entries) {
    const target = $("#yunshan-search-results");
    if (!target) {
      return;
    }
    if (!entries.length) {
      target.innerHTML = '<p class="error-box">관련 기록을 찾지 못했습니다. 다른 표현으로 다시 검색해보세요.</p>';
      return;
    }
    target.innerHTML = `
      <div class="event-feed">
        ${entries.map((entry) => renderEntryCard(entry)).join("")}
      </div>
    `;
    bindEntryButtons(target);
  }

  async function runSearch(query) {
    const localResults = localSearch(query);
    renderSearchResults(localResults);
    const aiBox = $("#yunshan-ai-box");
    if (!aiBox) {
      return;
    }

    if (window.location.protocol === "file:") {
      aiBox.innerHTML = `
        <strong>정적 검색 결과 ${localResults.length}건</strong><br>
        지금은 file:// 미리보기라 AI API를 직접 호출하지 않습니다.
        배포 후에는 같은 질문이 <code>/api/yunshan-search</code>로 전달됩니다.
      `;
      return;
    }

    aiBox.innerHTML = "AI 답변을 생성하는 중입니다...";
    try {
      const response = await fetch("/api/yunshan-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "AI 검색 실패");
      }
      const answerTitle = payload.used_ai
        ? "AI Answer"
        : payload.answer_source === "ontology_query"
          ? "온톨로지 검색 답변"
          : "검색 답변";
      const aiStatus = payload.used_ai ? "AI 사용" : "AI 미사용";
      const sourceLabel = {
        ai_gateway_summary: "AI Gateway 요약",
        ontology_query: "온톨로지 구조화 검색",
        hybrid_search_fallback: "하이브리드 검색 fallback",
        ai_gateway: "AI Gateway 생성",
        deterministic_aggregate: "구조화 집계 답변",
        deterministic_search_fallback: "검색 인덱스 답변",
      }[payload.answer_source] || payload.answer_source || "검색 답변";
      const modelLabel = payload.used_ai
        ? `모델 ${payload.ai_model || "unknown"}`
        : `설정 모델 ${payload.ai_model || "unknown"} · 호출 안 함`;
      const planner = payload.planner || {};
      const evidenceSourceLabel = {
        semantic_assertions: "semantic assertions",
        knowledge_graph_edges: "knowledge graph edges",
        entries: "entry/entity records",
        mixed: "mixed evidence",
      }[payload.evidence_source || planner.evidence_source] || payload.evidence_source || planner.evidence_source || "unknown evidence";
      aiBox.innerHTML = `
        <strong>${answerTitle}</strong>
        <div class="answer-meta">
          <span class="answer-pill">${escapeHtml(aiStatus)}</span>
          <span class="answer-pill">${escapeHtml(modelLabel)}</span>
          <span class="answer-pill">RAG ${payload.rag_used ? "사용" : "미사용"}</span>
          <span class="answer-pill">${escapeHtml(sourceLabel)}</span>
          <span class="answer-pill">의도 ${escapeHtml(planner.intent || "hybrid_search")}</span>
          <span class="answer-pill">근거 ${escapeHtml(evidenceSourceLabel)}</span>
          <span class="answer-pill">${escapeHtml(payload.retrieval_mode || "unknown")}</span>
          <span class="answer-pill">신뢰도 ${escapeHtml(payload.confidence || "unknown")}</span>
        </div>
        <div class="answer-body">${escapeHtml(payload.answer || "답변 없음").replace(/\n/g, "<br>")}</div>
      `;
      if (payload.results?.length) {
        renderSearchResults(payload.results.map((row) => entryById(row.entry_id)).filter(Boolean));
      }
    } catch (error) {
      aiBox.innerHTML = `
        <strong>정적 검색으로 표시 중</strong><br>
        AI API 호출은 아직 사용할 수 없습니다. ${escapeHtml(error.message)}
      `;
    }
  }

  function bindHomeSearch() {
    const form = $("#yunshan-search-form");
    if (!form) {
      return;
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = $("#yunshan-query").value.trim();
      if (query) {
        runSearch(query);
      }
    });
    $all("[data-example]").forEach((button) => {
      button.addEventListener("click", () => {
        $("#yunshan-query").value = button.dataset.example;
        runSearch(button.dataset.example);
      });
    });
  }

  function calendarMonths() {
    const map = new Map();
    state.entries.forEach((entry) => {
      const parts = entryDateParts(entry);
      if (!parts.year || !parts.month || !parts.day) {
        return;
      }
      const key = `${parts.year}-${String(parts.month).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          year: parts.year,
          month: parts.month,
          label: `${parts.year}년 ${parts.month}월`,
          entriesByDay: new Map(),
        });
      }
      map.get(key).entriesByDay.set(parts.day, entry);
    });
    return Array.from(map.values()).sort((left, right) => left.key.localeCompare(right.key));
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function firstWeekday(year, month) {
    return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  }

  function renderCalendarPage() {
    const target = $("#calendar-years");
    if (!target) {
      return;
    }
    const entries = state.entries
      .slice()
      .sort((left, right) => (left.index || 0) - (right.index || 0));
    if (!entries.length) {
      target.innerHTML = '<p class="muted">달력으로 그릴 기록이 없습니다.</p>';
      return;
    }
    target.innerHTML = `
      <div class="calendar-timeline-view" aria-label="운산일기 날짜 타임라인">
        <div class="calendar-timeline-rail">
          ${entries.map((entry, index) => {
            const parts = entryDateParts(entry);
            const previous = entries[index - 1] ? entryDateParts(entries[index - 1]) : null;
            const monthLabel = !previous || previous.month !== parts.month ? `${parts.month}월` : "";
            const active = entry.entry_id === state.activeEntryId ? " is-active" : "";
            return `
              <button type="button" class="calendar-timeline-day${active}" data-entry-id="${escapeHtml(entry.entry_id)}" title="${escapeHtml(entry.date_label || entry.entry_id)}">
                <span class="calendar-timeline-month">${escapeHtml(monthLabel)}</span>
                <span class="calendar-timeline-dot"></span>
                <strong>${parts.day}</strong>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
    bindEntryButtons(target);
    if (!state.activeEntryId && state.entries[0]) {
      selectEntry(state.entries[0].entry_id);
    }
  }

  function entitySearchText(row) {
    return normalizeSearchText([
      row.id,
      row.label,
      row.aliases?.join(" "),
      row.roles?.join(" "),
      row.register_contexts?.join(" "),
      row.entries?.join(" "),
    ].join(" "));
  }

  function entityCard(row, category, kindLabel) {
    return `
      <button type="button" class="entity-card" data-entity-category="${category}" data-entity-id="${escapeHtml(row.id)}">
        <strong>${escapeHtml(publicEntityLabel(row))}</strong>
        <p>${row.count}개 기록 · ${row.mention_count || row.count}회 언급</p>
        <div class="chip-row">
          ${(row.roles || []).slice(0, 3).map((role) => `<span class="entity-chip">${escapeHtml(role)}</span>`).join("")}
          ${(row.register_contexts || []).slice(0, 2).map((role) => `<span class="entity-chip">${escapeHtml(role)}</span>`).join("")}
          <span class="entity-chip">${escapeHtml(kindLabel)}</span>
        </div>
      </button>
    `;
  }

  function rowEntryObjects(row) {
    return (row.entries || []).map(entryById).filter(Boolean);
  }

  function materialDocumentKinds(row) {
    const entries = rowEntryObjects(row);
    const text = [
      row.label,
      ...(row.aliases || []),
      ...(row.roles || []),
      ...entries.flatMap((entry) => [entry.original, entry.translation, entry.summary]),
    ].filter(Boolean).join(" ");
    const flows = [];
    const add = (label, pattern) => {
      if (pattern.test(text) && !flows.includes(label)) {
        flows.push(label);
      }
    };
    add("받음", /received_document|家書|得書|書來|來書|收|受|收到|見寄|寄至/u);
    add("전달/제출", /送|還|付|寄|投|呈|下|致|傳|封|上書|申/u);
    add("작성/수정", /created_document|revised_document|作|寫|改|改正|改抹|修|草|擬|書寫/u);
    add("청탁", /commissioned_document|求|索|凂|託|著語|囑/u);
    add("관청 처리", /official_document|申狀|擬劄|劄子|解由|照元除|書卷|文書|吏牘|呈子|官|吏|省中|儒司|選房|禮房|吏房/u);
    return flows.length ? flows : ["언급/확인"];
  }

  function materialDocumentFlow(row) {
    return `흐름: ${materialDocumentKinds(row).slice(0, 4).join(" · ")}`;
  }

  function materialWorkPlaceList(row) {
    const genericPlaces = new Set(["杭州", "錢塘", "杭城", "客杭", "寓杭"]);
    const places = [];
    rowEntryObjects(row).forEach((entry) => {
      [...(entry.institutions || []), ...(entry.places || [])].forEach((place) => {
        const label = publicEntityLabel(place);
        if (!label || genericPlaces.has(label) || /航行|夜航|登航|航船/.test(label)) {
          return;
        }
        if (!places.includes(label)) {
          places.push(label);
        }
      });
    });
    return places;
  }

  function materialWorkKind(row) {
    const text = [
      row.label,
      ...(row.aliases || []),
      ...(row.roles || []),
    ].filter(Boolean).join(" ");
    if (/佛|像|觀音|毗盧遮那|三尊/u.test(text)) {
      return "불상·불교 이미지";
    }
    if (/畫|图|圖|研山圖|松|壁畫|水中作/u.test(text)) {
      return "그림";
    }
    if (/碑|石|刻|神筆|小楷|篆|字|書/u.test(text)) {
      return "비석·글씨";
    }
    if (/集|詩|文集|無稽集|literary_work|written_work/u.test(text)) {
      return "저작·문집";
    }
    return "기타 작품";
  }

  function materialWorkPlaces(row) {
    const places = materialWorkPlaceList(row);
    if (!places.length) {
      return "본 장소: 기록 안 장소 확인";
    }
    return places.length > 1
      ? `본 장소: ${places[0]} 외 ${places.length - 1}곳`
      : `본 장소: ${places[0]}`;
  }

  function consumableTypes(row) {
    const directText = [
      row.label,
      ...(row.aliases || []),
      ...(row.roles || []),
    ].filter(Boolean).join(" ");
    const contextText = rowEntryObjects(row)
      .flatMap((entry) => [entry.food_hospitality])
      .filter(Boolean)
      .join(" ");
    const types = [];
    const add = (label, pattern, text = directText) => {
      if (pattern.test(text) && !types.includes(label)) {
        types.push(label);
      }
    };
    add("술", /酒|酌|飮|飲|drink_item/u);
    add("차", /茶/u);
    add("식사", /早飯|飯|麪|食|餐|饌|羹|meal|food_item/u);
    add("음식", /蟹|芋|魚|麵|麪|肉|猪|豬|果|橘|菜|煮|蒸/u);
    add("종이·문구", /紙|筆|墨|硯|印色|stationery_item/u);
    add("생활 물품", /傘|衣|舟|船|人事/u);
    if (!types.length) {
      add("술", /酒|酌|飮|飲/u, contextText);
      add("차", /茶/u, contextText);
      add("식사", /早飯|飯|麪|食|餐|饌|羹/u, contextText);
      add("음식", /蟹|芋|魚|麵|麪|肉|猪|豬|果|橘|菜|煮|蒸/u, contextText);
    }
    return types.length ? types : ["소비품"];
  }

  function consumableType(row) {
    return `종류: ${consumableTypes(row).slice(0, 3).join(" · ")}`;
  }

  function materialRowNote(row, category) {
    if (category === "documents") {
      return materialDocumentFlow(row);
    }
    if (category === "works") {
      return materialWorkPlaces(row);
    }
    if (category === "consumables") {
      return consumableType(row);
    }
    return "";
  }

  function entityListRow(row, category, kindLabel) {
    const aliasText = publicAliasList(row, 4).join(" · ");
    const roleText = [...(row.roles || []), ...(row.register_contexts || [])]
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ");
    const materialNote = materialRowNote(row, category);
    return `
      <button type="button" class="entity-list-row" data-entity-category="${category}" data-entity-id="${escapeHtml(row.id)}">
        <strong>${escapeHtml(publicEntityLabel(row))}</strong>
        <span>${escapeHtml(materialNote || aliasText || roleText || "관련 기록 보기")}</span>
        <em>${row.count}일 · ${row.mention_count || row.count}회 · ${escapeHtml(kindLabel)}</em>
      </button>
    `;
  }

  function materialGroupLabel(row, category) {
    if (category === "documents") {
      return `흐름 · ${materialDocumentKinds(row)[0] || "언급/확인"}`;
    }
    if (category === "works") {
      return `성격 · ${materialWorkKind(row)}`;
    }
    if (category === "consumables") {
      return `종류 · ${consumableTypes(row)[0] || "소비품"}`;
    }
    return "목록";
  }

  function materialGroupIndex(label, category) {
    const value = String(label || "").replace(/^.+? · /, "");
    if (category === "documents") {
      const index = DOCUMENT_FLOW_ORDER.indexOf(value);
      return index > -1 ? index : DOCUMENT_FLOW_ORDER.length;
    }
    if (category === "consumables") {
      const index = CONSUMABLE_TYPE_ORDER.indexOf(value);
      return index > -1 ? index : CONSUMABLE_TYPE_ORDER.length;
    }
    if (category === "works") {
      const index = WORK_KIND_ORDER.indexOf(value);
      return index > -1 ? index : WORK_KIND_ORDER.length;
    }
    return value === "기록 안 장소 확인" ? 999 : 0;
  }

  function sortMaterialRows(rows, category) {
    return mergeEntityRows(rows, category).sort((left, right) => {
      const leftGroup = materialGroupLabel(left, category);
      const rightGroup = materialGroupLabel(right, category);
      return (materialGroupIndex(leftGroup, category) - materialGroupIndex(rightGroup, category))
        || leftGroup.localeCompare(rightGroup, "ko")
        || ((right.count || 0) - (left.count || 0))
        || ((right.mention_count || 0) - (left.mention_count || 0))
        || publicEntityLabel(left).localeCompare(publicEntityLabel(right), "ko");
    });
  }

  function renderMaterialEntityList(rows, category, kindLabel) {
    if (!rows.length) {
      return '<p class="muted">표시할 항목이 없습니다.</p>';
    }
    let previousGroup = "";
    return `
      <div class="entity-list entity-list-grouped" role="list">
        ${rows.map((row) => {
          const rowCategory = row.category || category;
          const groupLabel = materialGroupLabel(row, rowCategory);
          const groupHeader = groupLabel !== previousGroup
            ? `<div class="entity-list-group-label">${escapeHtml(groupLabel)}</div>`
            : "";
          previousGroup = groupLabel;
          state.entityRowCache.set(entityCacheKey(rowCategory, row.id), row);
          return `${groupHeader}${entityListRow(row, rowCategory, kindLabel)}`;
        }).join("")}
      </div>
    `;
  }

  function renderEntityList(rows, category, kindLabel) {
    const displayRows = mergeEntityRows(rows, category);
    if (!displayRows.length) {
      return '<p class="muted">표시할 항목이 없습니다.</p>';
    }
    return `
      <div class="entity-list" role="list">
        ${displayRows.map((row) => {
          const rowCategory = row.category || category;
          state.entityRowCache.set(entityCacheKey(rowCategory, row.id), row);
          return entityListRow(row, rowCategory, kindLabel);
        }).join("")}
      </div>
    `;
  }

  function renderEntityFocus(row, category) {
    const entries = (row.entries || []).map(entryById).filter(Boolean);
    const focus = $("#entity-focus") || document.createElement("div");
    focus.id = "entity-focus";
    focus.className = "analysis-stack entity-focus";
    focus.innerHTML = `
      ${category === "persons" ? renderSelectedPersonNetwork(row) : ""}
      <article class="mini-card">
        <strong>${escapeHtml(publicEntityLabel(row))}</strong>
        <div class="chip-row">
          <span class="entity-chip">${entries.length}개 날짜</span>
          <span class="entity-chip">${row.mention_count || row.count}회 언급</span>
          ${materialRowNote(row, category) ? `<span class="entity-chip">${escapeHtml(materialRowNote(row, category))}</span>` : ""}
          ${publicAliasList(row).map((alias) => `<span class="entity-chip">${escapeHtml(alias)}</span>`).join("")}
        </div>
      </article>
      <div class="event-feed">
        ${entries.map((entry) => category === "persons" ? renderPersonEvidenceCard(entry, row) : renderEntryCard(entry)).join("")}
      </div>
      <article class="panel detail-panel inline-reader">
        <div id="entry-reader">
          <p class="reader-empty">원문 / 번역</p>
        </div>
      </article>
    `;
    const currentPage = pageKind();
    const panel = currentPage === "places"
      ? $("#places-panel-body")
      : currentPage === "institutions"
        ? $("#institutions-panel-body")
        : currentPage === "materials"
          ? $("#materials-panel-body")
          : ["topics", "responses"].includes(category)
            ? $("#topics-panel-body")
            : ["documents", "works", "consumables"].includes(category)
              ? $("#materials-panel-body")
              : ["places", "institutions"].includes(category)
                ? $("#places-panel-body") || $("#institutions-panel-body")
                : $("#people-panel-body");
    if (panel && !$("#entity-focus", panel)) {
      panel.appendChild(focus);
    }
    if (category === "persons") {
      bindPersonNetworkMotion(focus);
      bindEntityCards(focus);
    }
    bindEntryButtons(focus);
    if (entries[0]) {
      selectEntry(entries[0].entry_id);
    }
  }

  function bindEntityCards(root = document) {
    $all("[data-entity-id]", root).forEach((button) => {
      const openEntity = () => {
        const category = button.dataset.entityCategory;
        const id = button.dataset.entityId;
        const row = state.entityRowCache.get(entityCacheKey(category, id))
          || (state.data[category] || []).find((item) => item.id === id);
        if (row) {
          if (pageKind() === "people" && state.peopleTab === "network" && category === "persons") {
            state.selectedPersonId = row.id;
            renderPeoplePage();
            return;
          }
          renderEntityFocus(row, category);
        }
      };
      button.addEventListener("click", openEntity);
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEntity();
        }
      });
    });
  }

  function uniqueEntryPeople(entry) {
    const seen = new Set();
    return (entry.persons || [])
      .filter((person) => {
        if (!person.id || seen.has(person.id)) {
          return false;
        }
        seen.add(person.id);
        return true;
      });
  }

  function isProtagonistPerson(row) {
    const text = normalizeSearchText([
      row.id,
      row.label,
      row.aliases?.join(" "),
      row.roles?.join(" "),
      row.register_contexts?.join(" "),
    ].join(" "));
    return [
      "곽비",
      "郭畀",
      "운산",
      "雲山",
      "self",
      "author",
      "diarist",
      "narrator",
      "저자",
      "필자",
      "본인",
    ].some((token) => text.includes(token.toLowerCase()));
  }

  function protagonistPersonRow(rows) {
    return rows.find(isProtagonistPerson) || {
      id: "__guo_bi__",
      label: "郭畀(곽비)",
      count: state.entries.length,
      mention_count: state.entries.length,
      aliases: ["郭畀", "곽비", "雲山"],
      roles: ["일기 주인공", "관찰자"],
      entries: state.entries.map((entry) => entry.entry_id),
      isSynthetic: true,
    };
  }

  function personRowById(personId) {
    return (state.data.persons || []).find((person) => person.id === personId);
  }

  function networkParticipantId(participantId, protagonistId) {
    if (!participantId) {
      return "";
    }
    return participantId === "self" ? protagonistId : participantId;
  }

  function encounterParticipants(encounter, protagonistId, selectedIds) {
    const seen = new Set();
    return (encounter.participants || [])
      .map((participant) => networkParticipantId(participant, protagonistId))
      .filter((participant) => {
        if (!participant || seen.has(participant)) {
          return false;
        }
        const keep = participant === protagonistId || selectedIds.has(participant);
        if (keep) {
          seen.add(participant);
        }
        return keep;
      });
  }

  function addNetworkEdge(edgeMap, source, target, type, entryId, encounter) {
    if (!source || !target || source === target) {
      return;
    }
    const [left, right] = type === "protagonist" ? [source, target] : [source, target].sort();
    const key = `${left}::${right}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        source: left,
        target: right,
        type,
        entries: new Set(),
        encounters: new Set(),
        confidences: new Set(),
      });
    }
    const edge = edgeMap.get(key);
    if (type !== "protagonist") {
      edge.type = "encounter";
    }
    edge.entries.add(entryId);
    if (encounter?.encounter_id) {
      edge.encounters.add(encounter.encounter_id);
    }
    if (encounter?.confidence) {
      edge.confidences.add(encounter.confidence);
    }
  }

  function layoutPersonNetwork(nodes, edges, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width * 0.47, height * 0.43);
    const movingNodes = nodes
      .filter((node) => !node.fixed)
      .sort((a, b) => (b.degree - a.degree) || (b.mentionCount - a.mentionCount));

    nodes.forEach((node) => {
      if (node.fixed) {
        node.x = centerX;
        node.y = centerY;
        node.homeX = node.x;
        node.homeY = node.y;
        node.phase = 0;
      }
      node.vx = 0;
      node.vy = 0;
    });

    const ringPlan = [
      { capacity: 14, radius: maxRadius * 0.26, offset: -Math.PI / 2 },
      { capacity: 30, radius: maxRadius * 0.43, offset: -Math.PI / 2 + Math.PI / 22 },
      { capacity: 46, radius: maxRadius * 0.61, offset: -Math.PI / 2 + Math.PI / 15 },
      { capacity: 62, radius: maxRadius * 0.78, offset: -Math.PI / 2 + Math.PI / 10 },
      { capacity: Number.POSITIVE_INFINITY, radius: maxRadius * 0.94, offset: -Math.PI / 2 + Math.PI / 7 },
    ];

    let cursor = 0;
    ringPlan.forEach((ring, ringIndex) => {
      const remaining = movingNodes.length - cursor;
      if (remaining <= 0) {
        return;
      }
      const ringNodes = movingNodes.slice(cursor, cursor + Math.min(ring.capacity, remaining));
      const ringCount = Math.max(ringNodes.length, 1);
      ringNodes.forEach((node, ringRank) => {
        const angle = ring.offset + (Math.PI * 2 * ringRank) / ringCount;
        const jitter = ((ringRank % 5) - 2) * (ringIndex >= 3 ? 7 : 4);
        const radius = Math.min(maxRadius, ring.radius + jitter);
        node.x = centerX + Math.cos(angle) * radius;
        node.y = centerY + Math.sin(angle) * radius;
        node.phase = (cursor + ringRank + 1) * 0.53;
        node.ring = radius;
        node.homeX = node.x;
        node.homeY = node.y;
      });
      cursor += ringNodes.length;
    });
  }

  function layoutSelectedPersonNetwork(nodes, width, height) {
    const centerX = width * 0.54;
    const centerY = height * 0.5;
    const referenceNodes = nodes.filter((node) => !node.selected && node.protagonist);
    const neighborNodes = nodes
      .filter((node) => !node.selected && !node.protagonist)
      .sort((a, b) => (b.degree - a.degree) || (b.mentionCount - a.mentionCount));

    nodes.forEach((node, index) => {
      node.vx = 0;
      node.vy = 0;
      node.phase = index * 0.61;
      if (node.selected) {
        node.x = centerX;
        node.y = centerY;
        node.homeX = node.x;
        node.homeY = node.y;
        node.fixed = true;
      }
    });

    referenceNodes.forEach((node, index) => {
      node.x = width * 0.22;
      node.y = centerY + (index - (referenceNodes.length - 1) / 2) * 92;
      node.homeX = node.x;
      node.homeY = node.y;
      node.fixed = true;
      node.phase = 1.2 + index;
    });

    const ringPlan = [
      { capacity: 12, radius: Math.min(width, height) * 0.27, offset: -Math.PI / 2 },
      { capacity: 24, radius: Math.min(width, height) * 0.39, offset: -Math.PI / 2 + Math.PI / 18 },
      { capacity: Number.POSITIVE_INFINITY, radius: Math.min(width, height) * 0.48, offset: -Math.PI / 2 + Math.PI / 10 },
    ];
    let cursor = 0;
    ringPlan.forEach((ring, ringIndex) => {
      const remaining = neighborNodes.length - cursor;
      if (remaining <= 0) {
        return;
      }
      const ringNodes = neighborNodes.slice(cursor, cursor + Math.min(ring.capacity, remaining));
      const ringCount = Math.max(ringNodes.length, 1);
      ringNodes.forEach((node, rank) => {
        const angle = ring.offset + (Math.PI * 2 * rank) / ringCount;
        const radius = ring.radius + ((rank % 4) - 1.5) * (ringIndex ? 8 : 5);
        node.x = centerX + Math.cos(angle) * radius;
        node.y = centerY + Math.sin(angle) * radius;
        node.homeX = node.x;
        node.homeY = node.y;
        node.phase = (cursor + rank + 2) * 0.57;
      });
      cursor += ringNodes.length;
    });
  }

  function buildPersonNetwork(rows, maxNodes = Number.POSITIVE_INFINITY) {
    const protagonistRow = protagonistPersonRow(rows);
    const protagonistId = protagonistRow.id || "__guo_bi__";
    const selectedRowsAll = rows
      .filter((row) => !isProtagonistPerson(row))
      .sort((a, b) => (b.mention_count || b.count || 0) - (a.mention_count || a.count || 0));
    const selectedRows = Number.isFinite(maxNodes) ? selectedRowsAll.slice(0, maxNodes) : selectedRowsAll;
    const selectedIds = new Set(selectedRows.map((row) => row.id));
    const protagonistNode = {
      id: protagonistId,
      label: protagonistRow.label || "郭畀(곽비)",
      count: state.entries.length,
      mentionCount: state.entries.length,
      degree: 0,
      index: 0,
      row: protagonistRow,
      fixed: true,
      protagonist: true,
    };
    const nodes = [
      protagonistNode,
      ...selectedRows.map((row, index) => ({
        id: row.id,
        label: row.label,
        count: row.count || 0,
        mentionCount: row.mention_count || row.count || 0,
        degree: 0,
        index: index + 1,
        row,
      })),
    ];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edgeMap = new Map();

    state.entries.forEach((entry) => {
      (entry.encounters || []).forEach((encounter) => {
        const participants = encounterParticipants(encounter, protagonistId, selectedIds);
        if (participants.length < 2) {
          return;
        }
        const people = participants.filter((personId) => personId !== protagonistId);
        if (participants.includes(protagonistId)) {
          people.forEach((personId) => {
            addNetworkEdge(edgeMap, protagonistId, personId, "protagonist", entry.entry_id, encounter);
          });
        }
        if (encounter.confidence !== "direct") {
          for (let i = 0; i < people.length; i += 1) {
            for (let j = i + 1; j < people.length; j += 1) {
              addNetworkEdge(edgeMap, people[i], people[j], "encounter", entry.entry_id, encounter);
            }
          }
        }
      });
    });

    const edges = Array.from(edgeMap.values()).map((edge) => {
      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      const weight = Math.max(edge.entries.size, edge.encounters?.size || 0);
      if (sourceNode) sourceNode.degree += weight;
      if (targetNode) targetNode.degree += weight;
      return {
        ...edge,
        sourceNode,
        targetNode,
        weight,
        confidence: Array.from(edge.confidences || [])[0] || "",
      };
    }).filter((edge) => edge.sourceNode && edge.targetNode);

    const width = 1320;
    const height = 780;
    layoutPersonNetwork(nodes, edges, width, height);
    return { nodes, edges, protagonistNode, width, height };
  }

  function buildSelectedPersonNetwork(row, maxNodes = Number.POSITIVE_INFINITY) {
    const peopleRows = state.data.persons || [];
    const selectedId = row.id;
    const selectedEntries = (row.entries || []).map(entryById).filter(Boolean);
    const protagonistRow = protagonistPersonRow(peopleRows);
    const selectedIsProtagonist = isProtagonistPerson(row);
    const neighborMap = new Map();

    selectedEntries.forEach((entry) => {
      (entry.encounters || []).forEach((encounter) => {
        const selectedIds = new Set(peopleRows.map((person) => person.id));
        selectedIds.add(protagonistRow.id || "__guo_bi__");
        const participants = encounterParticipants(encounter, protagonistRow.id || "__guo_bi__", selectedIds);
        if (!participants.includes(selectedId)) {
          return;
        }
        participants
          .filter((personId) => personId !== selectedId)
          .forEach((personId) => {
            const isReference = personId === (protagonistRow.id || "__guo_bi__");
            const fullRow = isReference ? protagonistRow : personRowById(personId);
            if (!fullRow) {
              return;
            }
            if (!neighborMap.has(personId)) {
              neighborMap.set(personId, {
                row: fullRow,
                entries: new Set(),
                encounters: new Set(),
                reference: isReference,
              });
            }
            const neighbor = neighborMap.get(personId);
            neighbor.entries.add(entry.entry_id);
            if (encounter.encounter_id) {
              neighbor.encounters.add(encounter.encounter_id);
            }
            if (isReference) {
              neighbor.reference = true;
            }
          });
      });
    });

    const allNeighbors = Array.from(neighborMap.entries())
      .map(([id, item]) => ({
        id,
        row: item.row,
        entries: item.entries,
        encounters: item.encounters || item.entries,
        reference: item.reference || isProtagonistPerson(item.row),
        mentionCount: item.row.mention_count || item.row.count || item.entries.size,
      }))
      .sort((a, b) => ((b.encounters?.size || b.entries.size) - (a.encounters?.size || a.entries.size)) || (b.mentionCount - a.mentionCount));
    const neighbors = Number.isFinite(maxNodes) ? allNeighbors.slice(0, maxNodes) : allNeighbors;

    const nodes = [
      {
        id: selectedId,
        label: publicEntityLabel(row),
        count: row.count || selectedEntries.length,
        mentionCount: row.mention_count || row.count || selectedEntries.length,
        degree: 0,
        index: 0,
        row,
        fixed: true,
        selected: true,
        protagonist: selectedIsProtagonist,
      },
      ...neighbors.map((item, index) => ({
        id: item.id,
        label: publicEntityLabel(item.row),
        count: item.row.count || item.entries.size,
        mentionCount: item.mentionCount,
        degree: item.entries.size,
        index: index + 1,
        row: item.row,
        protagonist: item.reference,
        reference: item.reference,
      })),
    ];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = neighbors.map((item) => {
      const sourceNode = nodeById.get(selectedId);
      const targetNode = nodeById.get(item.id);
      const weight = Math.max(item.entries.size, item.encounters?.size || 0);
      sourceNode.degree += weight;
      return {
        source: selectedId,
        target: item.id,
        type: item.reference ? "reference" : "selected",
        entries: item.entries,
        sourceNode,
        targetNode,
        weight,
      };
    });
    const width = 900;
    const height = 520;
    layoutSelectedPersonNetwork(nodes, width, height);
    return { nodes, edges, selectedNode: nodes[0], width, height, selectedEntries };
  }

  function renderSelectedPersonNetwork(row) {
    const network = buildSelectedPersonNetwork(row);
    const maxWeight = Math.max(1, ...network.edges.map((edge) => edge.weight));
    const neighborCount = network.nodes.filter((node) => !node.selected).length;
    const relatedCards = network.edges
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6)
      .map((edge) => `
        <button type="button" class="network-pair-card" data-network-pair="${escapeHtml(edge.source)}::${escapeHtml(edge.target)}">
          <strong>${escapeHtml(edge.targetNode.label)}</strong>
          <span>${edge.weight}개 만남 장면</span>
        </button>
      `).join("");

    return `
      <article class="person-network-panel selected-person-network mini-card">
        <div class="network-head">
          <div>
            <strong>${escapeHtml(publicEntityLabel(row))} 중심 네트워크</strong>
          </div>
          <div class="chip-row network-summary">
            <span class="entity-chip">중심 ${escapeHtml(publicEntityLabel(row))}</span>
            <span class="entity-chip">관련 인물 ${neighborCount}</span>
            <span class="entity-chip">관련 날짜 ${network.selectedEntries.length}</span>
            <button type="button" class="entity-chip chip-button" data-people-reset-network="true">전체 인물 보기</button>
          </div>
        </div>
        <div class="network-legend" aria-label="선택 인물 네트워크 범례">
          <span class="legend-item"><i class="legend-dot is-selected"></i>선택 인물</span>
          <span class="legend-item"><i class="legend-dot is-protagonist"></i>곽비: 주인공/기준 인물</span>
          <span class="legend-item"><i class="legend-line"></i>선 두께 = 만남 장면 수</span>
          <span class="legend-item"><i class="legend-dot"></i>점 크기 = 언급 빈도</span>
        </div>
        <div class="network-canvas selected-network-canvas" aria-label="선택 인물 만남 네트워크">
          <svg class="person-network-svg show-spokes show-coappearance" viewBox="0 0 ${network.width} ${network.height}" role="img" data-motion-network="selected-person" data-width="${network.width}" data-height="${network.height}">
            <g class="network-edges">
              ${network.edges.map((edge) => `
                <line
                  class="${edge.type === "reference" ? "is-protagonist-edge" : "is-selected-edge"}"
                  data-network-edge="true"
                  data-source="${escapeHtml(edge.source)}"
                  data-target="${escapeHtml(edge.target)}"
                  data-weight="${edge.weight}"
                  data-edge-type="${escapeHtml(edge.type)}"
                  x1="${edge.sourceNode.x.toFixed(1)}"
                  y1="${edge.sourceNode.y.toFixed(1)}"
                  x2="${edge.targetNode.x.toFixed(1)}"
                  y2="${edge.targetNode.y.toFixed(1)}"
                  stroke-width="${(1.2 + (edge.weight / maxWeight) * 6).toFixed(2)}">
                  <title>${escapeHtml(edge.sourceNode.label)} - ${escapeHtml(edge.targetNode.label)}: ${edge.weight}개 만남 장면</title>
                </line>
              `).join("")}
            </g>
            <g class="network-nodes">
              ${network.nodes.map((node) => {
                const radius = node.selected
                  ? 32
                  : node.protagonist
                    ? 23
                    : Math.min(21, 7 + Math.sqrt(node.mentionCount) * 1.8);
                const showLabel = node.selected || node.protagonist || node.index < 16 || node.degree >= 3;
                const actionAttrs = node.selected || node.reference || node.row?.isSynthetic
                  ? 'aria-label="네트워크 기준 노드" data-fixed="true"'
                  : `tabindex="0" role="button" aria-label="${escapeHtml(node.label)} 인물 상세 보기" data-entity-category="persons" data-entity-id="${escapeHtml(node.id)}"`;
                return `
                  <g
                    class="person-network-node${node.selected ? " is-selected" : ""}${node.protagonist ? " is-protagonist" : ""}"
                    data-network-node="true"
                    data-node-id="${escapeHtml(node.id)}"
                    data-x="${node.x.toFixed(1)}"
                    data-y="${node.y.toFixed(1)}"
                    data-phase="${node.phase.toFixed(2)}"
                    ${actionAttrs}
                    transform="translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})">
                    ${node.selected ? '<circle class="selected-halo" r="55"></circle>' : ""}
                    ${node.protagonist && !node.selected ? '<circle class="protagonist-halo" r="42"></circle>' : ""}
                    <circle r="${radius.toFixed(1)}"></circle>
                    <text class="network-node-label${showLabel ? "" : " is-hidden-label"}" y="${(radius + 14).toFixed(1)}">${escapeHtml(compactText(node.label, 12))}</text>
                    <title>${escapeHtml(node.label)} · ${node.count}개 기록 · ${node.mentionCount}회 언급</title>
                  </g>
                `;
              }).join("")}
            </g>
          </svg>
        </div>
        <div class="network-pair-list selected-network-pairs">
          <span class="analysis-kicker">함께 자주 등장한 인물</span>
          ${relatedCards || '<p class="network-note">이 인물과 같은 자리로 묶인 만남이 아직 충분하지 않습니다.</p>'}
        </div>
      </article>
    `;
  }

  function renderPersonNetwork(rows) {
    const network = buildPersonNetwork(rows);
    const selectedId = state.selectedPersonId;
    const protagonistEdges = network.edges.filter((edge) => edge.type === "protagonist");
    const coappearanceEdges = network.edges
      .filter((edge) => edge.type !== "protagonist")
      .sort((a, b) => (b.weight - a.weight) || (b.sourceNode.mentionCount - a.sourceNode.mentionCount));
    const visibleProtagonistEdges = selectedId
      ? protagonistEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId)
      : protagonistEdges
        .slice()
        .sort((a, b) => (b.weight - a.weight) || (b.targetNode.mentionCount - a.targetNode.mentionCount))
        .slice(0, 18);
    const visibleCoappearanceEdges = coappearanceEdges
      .filter((edge) => edge.weight >= 2 || edge.source === selectedId || edge.target === selectedId)
      .slice(0, selectedId ? 36 : 22);
    const visualEdges = [...visibleProtagonistEdges, ...visibleCoappearanceEdges];
    const maxWeight = Math.max(1, ...visualEdges.map((edge) => edge.weight));
    const connectedNodes = network.nodes.filter((node) => !node.protagonist && node.degree > 0).length;
    const strongEdgeCards = coappearanceEdges.slice(0, 8).map((edge) => `
      <button type="button" class="network-pair-card" data-network-pair="${escapeHtml(edge.source)}::${escapeHtml(edge.target)}">
        <strong>${escapeHtml(edge.sourceNode.label)} - ${escapeHtml(edge.targetNode.label)}</strong>
        <span>${edge.weight}개 만남 장면</span>
      </button>
    `).join("");

    return `
      <article class="person-network-panel mini-card">
        <div class="network-head">
          <div>
            <strong>전체 인물 네트워크</strong>
          </div>
          <div class="chip-row network-summary">
            <span class="entity-chip">곽비 중심 고정</span>
            <span class="entity-chip">표시 인물 ${network.nodes.length - 1}</span>
            <span class="entity-chip">연결 인물 ${connectedNodes}</span>
            <span class="entity-chip">같은 자리 ${coappearanceEdges.length}</span>
          </div>
        </div>
        <div class="network-legend" aria-label="인물 네트워크 범례">
          <span class="legend-item"><i class="legend-dot is-protagonist"></i>곽비 중심 고정</span>
          <span class="legend-item"><i class="legend-dot"></i>점 크기 = 언급/등장 빈도</span>
          <button type="button" class="legend-item legend-toggle is-active" data-network-toggle="spokes"><i class="legend-line is-dashed"></i>점선 = 곽비와 직접 만남</button>
          <button type="button" class="legend-item legend-toggle" data-network-toggle="coappearance"><i class="legend-line"></i>실선 = 같은 자리에서 함께 만남</button>
        </div>
        <div class="network-canvas" aria-label="인물 만남 네트워크">
          <svg class="person-network-svg show-spokes" viewBox="0 0 ${network.width} ${network.height}" role="img" data-motion-network="people" data-width="${network.width}" data-height="${network.height}">
            <g class="network-edges">
              ${visualEdges.map((edge) => `
                <line
                  class="${edge.type === "protagonist" ? "is-protagonist-edge" : "is-coappearance-edge"}"
                  data-network-edge="true"
                  data-source="${escapeHtml(edge.source)}"
                  data-target="${escapeHtml(edge.target)}"
                  data-weight="${edge.weight}"
                  data-edge-type="${escapeHtml(edge.type || "coappearance")}"
                  x1="${edge.sourceNode.x.toFixed(1)}"
                  y1="${edge.sourceNode.y.toFixed(1)}"
                  x2="${edge.targetNode.x.toFixed(1)}"
                  y2="${edge.targetNode.y.toFixed(1)}"
                  stroke-width="${(0.8 + (edge.weight / maxWeight) * 5).toFixed(2)}">
                  <title>${escapeHtml(edge.sourceNode.label)} - ${escapeHtml(edge.targetNode.label)}: ${edge.weight}개 만남 장면</title>
                </line>
              `).join("")}
            </g>
            <g class="network-nodes">
              ${network.nodes.map((node) => {
                const isCurrent = selectedId && node.id === selectedId;
                const radius = node.protagonist ? 34 : isCurrent ? 23 : Math.min(17, 4.5 + Math.sqrt(node.mentionCount) * 1.35);
                const opacity = node.protagonist || node.degree > 0 ? 1 : 0.5;
                const actionAttrs = node.protagonist
                  ? 'aria-label="郭畀(곽비) 중심 노드" data-fixed="true"'
                  : `tabindex="0" role="button" aria-label="${escapeHtml(node.label)} 인물 상세 보기" data-entity-category="persons" data-entity-id="${escapeHtml(node.id)}"`;
                return `
                  <g
                    class="person-network-node${node.protagonist ? " is-protagonist" : ""}${isCurrent ? " is-current-person" : ""}"
                    data-network-node="true"
                    data-node-id="${escapeHtml(node.id)}"
                    data-x="${node.x.toFixed(1)}"
                    data-y="${node.y.toFixed(1)}"
                    data-phase="${node.phase.toFixed(2)}"
                    ${actionAttrs}
                    transform="translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})"
                    style="--node-opacity:${opacity}">
                    ${node.protagonist ? '<circle class="protagonist-halo" r="54"></circle>' : ""}
                    <circle r="${radius.toFixed(1)}"></circle>
                    <text class="network-node-label" y="${(radius + 14).toFixed(1)}">${escapeHtml(compactText(node.label, 12))}</text>
                    <title>${escapeHtml(node.label)} · ${node.count}개 기록 · ${node.mentionCount}회 언급</title>
                  </g>
                `;
              }).join("")}
            </g>
          </svg>
        </div>
        <div class="network-pair-list">
          <span class="analysis-kicker">같은 자리</span>
          ${strongEdgeCards || '<p class="network-note">현재 조건에서는 같은 자리로 묶인 만남이 적습니다.</p>'}
        </div>
      </article>
    `;
  }

  function bindPersonNetworkMotion(root = document) {
    const svgs = $all(".person-network-svg[data-motion-network]", root);
    if (!svgs.length) {
      return;
    }
    svgs.forEach((svg) => bindSinglePersonNetworkMotion(svg, root));
  }

  function bindSinglePersonNetworkMotion(svg, root = document) {
    const panel = svg.closest(".person-network-panel");
    const toggleButtons = $all("[data-network-toggle]", panel || root);
    const pairCards = $all("[data-network-pair]", panel || root);
    const width = Number(svg.dataset.width) || 1100;
    const height = Number(svg.dataset.height) || 640;
    const centerX = width / 2;
    const centerY = height / 2;
    let activeFocusId = "";
    let forcedNeighborIds = null;

    function setNetworkLayer(layer, enabled) {
      const className = layer === "coappearance" ? "show-coappearance" : "show-spokes";
      svg.classList.toggle(className, enabled);
      toggleButtons.forEach((button) => {
        if (button.dataset.networkToggle === layer) {
          button.classList.toggle("is-active", enabled);
        }
      });
    }

    const nodes = $all("[data-network-node]", svg).map((element, index) => ({
      id: element.dataset.nodeId,
      element,
      x: Number(element.dataset.x) || centerX,
      y: Number(element.dataset.y) || centerY,
      homeX: Number(element.dataset.x) || centerX,
      homeY: Number(element.dataset.y) || centerY,
      phase: Number(element.dataset.phase) || index,
      fixed: element.dataset.fixed === "true",
    }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = $all("[data-network-edge]", svg)
      .map((line) => ({
        line,
        source: nodeById.get(line.dataset.source),
        target: nodeById.get(line.dataset.target),
        weight: Number(line.dataset.weight) || 1,
        type: line.dataset.edgeType || "coappearance",
      }))
      .filter((edge) => edge.source && edge.target);
    const adjacency = new Map();
    edges.forEach((edge) => {
      [
        [edge.source, edge.target],
        [edge.target, edge.source],
      ].forEach(([source, target]) => {
        if (!adjacency.has(source.id)) {
          adjacency.set(source.id, []);
        }
        adjacency.get(source.id).push({ node: target, edge, weight: edge.weight, type: edge.type });
      });
    });
    adjacency.forEach((items) => {
      items.sort((left, right) => (right.weight - left.weight) || left.node.label?.localeCompare(right.node.label || "", "ko"));
    });

    function focusedNeighbors(nodeId) {
      const items = adjacency.get(nodeId) || [];
      const forced = forcedNeighborIds instanceof Set
        ? items.filter((item) => forcedNeighborIds.has(item.node.id))
        : items;
      const limit = nodeById.get(nodeId)?.fixed ? 18 : 24;
      return forced.slice(0, limit);
    }

    function clearNetworkFocus() {
      activeFocusId = "";
      forcedNeighborIds = null;
      svg.classList.remove("has-network-focus");
      nodes.forEach((node) => {
        node.focusRank = -1;
        node.element.classList.remove("is-focus", "is-neighbor", "is-dimmed");
      });
      edges.forEach((edge) => {
        edge.line.classList.remove("is-highlighted", "is-dimmed");
      });
    }

    function setNetworkFocus(nodeId, neighborIds = null) {
      const focusNode = nodeById.get(nodeId);
      if (!focusNode) {
        clearNetworkFocus();
        return;
      }
      activeFocusId = nodeId;
      forcedNeighborIds = neighborIds instanceof Set ? neighborIds : null;
      const neighbors = focusedNeighbors(nodeId);
      const neighborIdSet = new Set(neighbors.map((item) => item.node.id));
      svg.classList.add("has-network-focus");
      nodes.forEach((node) => {
        const isFocus = node.id === nodeId;
        const isNeighbor = neighborIdSet.has(node.id);
        node.focusRank = neighbors.findIndex((item) => item.node.id === node.id);
        node.element.classList.toggle("is-focus", isFocus);
        node.element.classList.toggle("is-neighbor", isNeighbor);
        node.element.classList.toggle("is-dimmed", !isFocus && !isNeighbor);
      });
      edges.forEach((edge) => {
        const touchesFocus = edge.source.id === nodeId || edge.target.id === nodeId;
        const otherId = edge.source.id === nodeId ? edge.target.id : edge.source.id;
        const isFocusEdge = touchesFocus && neighborIdSet.has(otherId);
        edge.line.classList.toggle("is-highlighted", isFocusEdge);
        edge.line.classList.toggle("is-dimmed", !isFocusEdge);
      });
    }

    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const layer = button.dataset.networkToggle || "spokes";
        const className = layer === "coappearance" ? "show-coappearance" : "show-spokes";
        setNetworkLayer(layer, !svg.classList.contains(className));
      });
    });

    pairCards.forEach((card) => {
      card.addEventListener("click", () => {
        setNetworkLayer("coappearance", true);
        const [source, target] = (card.dataset.networkPair || "").split("::");
        if (source && target) {
          setNetworkFocus(source, new Set([target]));
        }
      });
    });

    nodes.forEach((node) => {
      const focus = () => setNetworkFocus(node.id);
      node.element.addEventListener("pointerenter", focus);
      node.element.addEventListener("focus", focus);
      node.element.addEventListener("blur", clearNetworkFocus);
    });
    svg.addEventListener("pointerleave", clearNetworkFocus);

    setNetworkLayer("spokes", svg.classList.contains("show-spokes"));
    setNetworkLayer("coappearance", svg.classList.contains("show-coappearance"));
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return;
    }

    function fixedPosition(node) {
      return {
        x: Number.isFinite(node.homeX) ? node.homeX : centerX,
        y: Number.isFinite(node.homeY) ? node.homeY : centerY,
      };
    }

    function targetPosition(node, now) {
      const focusNode = activeFocusId ? nodeById.get(activeFocusId) : null;
      if (!focusNode) {
        if (node.fixed) {
          return fixedPosition(node);
        }
        const amplitude = 2.8 + (node.phase % 2.2);
        return {
          x: node.homeX + Math.sin(now * 0.00055 + node.phase) * amplitude,
          y: node.homeY + Math.cos(now * 0.00048 + node.phase) * amplitude,
        };
      }
      const focusTarget = focusNode.fixed
        ? fixedPosition(focusNode)
        : {
          x: focusNode.homeX * 0.66 + centerX * 0.34,
          y: focusNode.homeY * 0.66 + centerY * 0.34,
        };
      if (node.id === focusNode.id) {
        return focusTarget;
      }
      if (node.fixed) {
        return fixedPosition(node);
      }
      if (node.focusRank >= 0) {
        const neighbors = focusedNeighbors(focusNode.id);
        const count = Math.max(neighbors.length, 1);
        const ring = Math.floor(node.focusRank / 12);
        const rankInRing = node.focusRank % 12;
        const ringCount = Math.min(12, count - ring * 12);
        const radius = 66 + ring * 58 + Math.min(42, count * 1.4);
        const angle = -Math.PI / 2 + (Math.PI * 2 * rankInRing) / Math.max(ringCount, 1);
        return {
          x: Math.max(38, Math.min(width - 38, focusTarget.x + Math.cos(angle) * radius)),
          y: Math.max(38, Math.min(height - 38, focusTarget.y + Math.sin(angle) * radius)),
        };
      }
      return {
        x: node.homeX + Math.sin(now * 0.00032 + node.phase) * 1.4,
        y: node.homeY + Math.cos(now * 0.00029 + node.phase) * 1.4,
      };
    }

    function tick(now) {
      if (!svg.isConnected) {
        return;
      }
      nodes.forEach((node) => {
        const target = targetPosition(node, now);
        const ease = activeFocusId ? 0.16 : 0.08;
        node.x += (target.x - node.x) * ease;
        node.y += (target.y - node.y) * ease;
        node.element.dataset.x = node.x.toFixed(2);
        node.element.dataset.y = node.y.toFixed(2);
        node.element.setAttribute("transform", `translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`);
      });

      edges.forEach((edge) => {
        edge.line.setAttribute("x1", edge.source.x.toFixed(2));
        edge.line.setAttribute("y1", edge.source.y.toFixed(2));
        edge.line.setAttribute("x2", edge.target.x.toFixed(2));
        edge.line.setAttribute("y2", edge.target.y.toFixed(2));
      });

      window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);
  }

  function selectedPeopleRow(rows) {
    const current = rows.find((row) => row.id === state.selectedPersonId);
    if (current && !isProtagonistPerson(current)) {
      return current;
    }
    state.selectedPersonId = "";
    return null;
  }

  function personEvidenceTerms(row) {
    const cleanTerm = (value) => String(value || "")
      .replace(/\+.*/, "")
      .replace(/[()[\]{}]/g, "")
      .trim();
    const values = [
      row.label,
      publicEntityLabel(row),
      ...(row.aliases || []).map((alias) => typeof alias === "string" ? alias : alias?.surface || alias?.label || ""),
      ...publicAliasList(row, 12),
    ];
    const seen = new Set();
    return values
      .flatMap((value) => {
        const term = cleanTerm(value);
        return [term, ...term.split(/[·,，、/／\s]+/u).map(cleanTerm)];
      })
      .filter((value) => {
        if (!value || value.length < 2 || /^(外郞|外郎|都目|教授|提舉|提举|山長|山长|主簿|同知|學正|学正)$/u.test(value) || seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      })
      .sort((left, right) => right.length - left.length);
  }

  function entryPersonEvidenceTerms(entry, row) {
    const entryTerms = (entry.entities?.persons || [])
      .filter((person) => person.id === row.id || person.entity_id === row.id)
      .flatMap((person) => [person.surface, person.normalized, person.label])
      .flatMap((value) => personEvidenceTerms({ label: value, aliases: [] }));
    return expandEvidenceTerms([...entryTerms, ...personEvidenceTerms(row)]);
  }

  function evidenceTermVariants(term) {
    const variants = new Set([term]);
    if (term.includes("輝")) {
      variants.add(term.replaceAll("輝", "煇"));
    }
    if (term.includes("煇")) {
      variants.add(term.replaceAll("煇", "輝"));
    }
    if (term.includes("郞")) {
      variants.add(term.replaceAll("郞", "郎"));
    }
    if (term.includes("郎")) {
      variants.add(term.replaceAll("郎", "郞"));
    }
    return Array.from(variants);
  }

  function expandEvidenceTerms(terms) {
    return Array.from(new Set(terms.flatMap(evidenceTermVariants)))
      .filter((term) => term.length >= 2)
      .sort((left, right) => right.length - left.length);
  }

  function bestEvidenceMatch(text, terms) {
    return terms
      .map((term) => ({ term, index: text.indexOf(term) }))
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index || right.term.length - left.term.length)[0];
  }

  function highlightedEvidenceSnippet(entry, row) {
    const originalText = String(entry.original || "").replace(/\s+/g, " ").trim();
    const fallbackText = String(entry.translation || "").replace(/\s+/g, " ").trim();
    const text = originalText || fallbackText;
    if (!text) {
      return "원문 없음";
    }
    const terms = entryPersonEvidenceTerms(entry, row);
    let source = text;
    let match = bestEvidenceMatch(source, terms);
    if (!match && originalText && fallbackText) {
      source = fallbackText;
      match = bestEvidenceMatch(source, terms);
    }
    if (!match) {
      return escapeHtml(compactText(text, 72));
    }
    const beforeChars = 14;
    const afterChars = 42;
    const start = Math.max(0, match.index - beforeChars);
    const end = Math.min(source.length, match.index + match.term.length + afterChars);
    const prefix = `${start > 0 ? "…" : ""}${source.slice(start, match.index)}`;
    const suffix = `${source.slice(match.index + match.term.length, end)}${end < source.length ? "…" : ""}`;
    return `${escapeHtml(prefix)}<mark class="person-hit">${escapeHtml(match.term)}</mark>${escapeHtml(suffix)}`;
  }

  function renderPersonEvidenceCard(entry, row) {
    const active = entry.entry_id === state.activeEntryId ? " is-active" : "";
    return `
      <button type="button" class="person-evidence-row${active}" data-entry-id="${escapeHtml(entry.entry_id)}">
        <strong>${escapeHtml(entry.date_label || entryDateParts(entry).label)}</strong>
        <span class="person-evidence-snippet">${highlightedEvidenceSnippet(entry, row)}</span>
      </button>
    `;
  }

  function renderSelectedPersonEvidence(row) {
    const entries = (row.entries || []).map(entryById).filter(Boolean);
    const activeEntry = entries.find((entry) => entry.entry_id === state.activeEntryId) || entries[0] || null;
    if (activeEntry) {
      state.activeEntryId = activeEntry.entry_id;
    }
    const aliases = publicAliasList(row, 6);
    const roleClues = [...(row.roles || []), ...(row.register_contexts || [])].filter(Boolean).slice(0, 4);

    return `
      <article class="people-evidence-summary mini-card">
        <div>
          <span class="analysis-kicker">근거 목록</span>
          <strong>${escapeHtml(publicEntityLabel(row))}</strong>
        </div>
        <div class="chip-row">
          <span class="entity-chip">${entries.length}개 날짜</span>
          <span class="entity-chip">${row.mention_count || row.count || entries.length}회 언급</span>
          ${aliases.map((alias) => `<span class="entity-chip">${escapeHtml(alias)}</span>`).join("")}
          ${roleClues.map((role) => `<span class="entity-chip">${escapeHtml(role)}</span>`).join("")}
        </div>
      </article>
      <div class="people-evidence-layout">
        <div class="event-feed people-evidence-list">
          ${entries.map((entry) => renderPersonEvidenceCard(entry, row)).join("") || '<p class="muted">관련 날짜가 아직 없습니다.</p>'}
        </div>
        <article class="panel detail-panel inline-reader people-evidence-reader">
          <div id="entry-reader">
            ${activeEntry ? renderEntryReader(activeEntry) : '<p class="reader-empty">원문 / 번역</p>'}
          </div>
        </article>
      </div>
    `;
  }

  function renderPeopleNetworkWorkbench(rows) {
    const selectedRow = selectedPeopleRow(rows);
    return selectedRow
      ? `
        <section class="people-network-workbench is-single-view">
          <div class="people-network-map">
            ${renderSelectedPersonNetwork(selectedRow)}
          </div>
          <section class="people-network-evidence">
            ${renderSelectedPersonEvidence(selectedRow)}
          </section>
        </section>
      `
      : `
        <section class="people-network-workbench is-single-view">
          <div class="people-network-map">
            ${renderPersonNetwork(rows)}
          </div>
        </section>
      `;
  }

  function bindPeopleNetworkReset(root = document) {
    $all("[data-people-reset-network]", root).forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPersonId = "";
        renderPeoplePage();
      });
    });
  }

  function renderPeoplePage() {
    const target = $("#people-panel-body");
    if (!target) {
      return;
    }
    const query = state.peopleQuery;
    const rows = (state.data.persons || []).filter((row) => entitySearchText(row).includes(normalizeSearchText(query)));
    const networkContent = renderPeopleNetworkWorkbench(rows);
    target.innerHTML = `
      <div class="people-tab-panel">
        ${networkContent}
      </div>
    `;
    bindPeopleNetworkReset(target);
    bindEntityCards(target);
    bindPersonNetworkMotion(target);
  }

  function spaceText(row) {
    return `${row.label || ""} ${row.authority_label || ""} ${(row.aliases || []).join(" ")} ${(row.register_contexts || []).join(" ")} ${placeType(row)} ${placeParentId(row)}`;
  }

  function isTransportPlace(row) {
    const text = spaceText(row);
    return /航行|夜航|登航|航船|船行|舟行|上船/.test(text) && !placeCoordinates(row);
  }

  function isJourneySpace(row) {
    if (isTransportPlace(row)) return false;
    const text = spaceText(row);
    return /journey|呂城|奔牛|常州|元豐橋|太平寺|无華書院|姑蘇|平江|杭州城外|北關門|接待寺/.test(text);
  }

  function isHangzhouInteriorSpace(row) {
    if (isTransportPlace(row)) return false;
    const text = spaceText(row);
    if (isJourneySpace(row)) return false;
    if (/湖州|義興|宜興|江陰|長興|長安|大都|姑蘇|平江|常州|奔牛|呂城|丹徒|毗陵|宣州|宣城|衢州|大名|汴梁|鎮江|揚州|揚子江|天目山|金陵|建康|蘇州|無錫/.test(text)) {
      return false;
    }
    const parentId = placeParentId(row);
    if (parentId === "place-0031" || parentId === "place-0016") {
      return true;
    }
    return /杭州|杭|錢塘|省|司|房|庫|府|院|所|衙|法堂|提舉|照磨|吏房|禮房|寺|觀|宮|廟|祠|庵|書院|橋|門|樓|巷|坊|街|市|亭|館|店|寓|吳山|五山|西湖|浙江|錢塘江|新宮|新门|新門|下馬婆|城|湖|山|江/.test(text);
  }

  function classifyPlace(row) {
    const text = spaceText(row);
    const type = placeType(row);
    const parentId = placeParentId(row);
    if (isJourneySpace(row)) return "항주로 가는 동선";
    if (parentId === "place-0016") return "항주 성외";
    if (/mountain|lake|river|natural/.test(type) || /山|湖|江|水|溪|浦|岸|洞|浙江|西湖|吳山|錢塘江/.test(text)) return "자연";
    if (/temple|shrine|academy|ritual|religious|literary/.test(type) || (row.category === "institutions" && /寺|觀|宮|廟|院|書院|祠|庵|ritual|literary/.test(text))) return "기관·사찰";
    if (/office|administrative|government/.test(type) || row.category === "institutions" || /省|司|房|庫|府|院|所|衙|法堂|提舉|照磨|吏房|禮房|administrative/.test(text)) return "기관·관청";
    if (/social|residential|commercial|宴|席|樓|家|寓/.test(text)) return "체류·사교 공간";
    if (/橋|門|樓|巷|坊|街|市|亭|館|店|岸|城|杭|錢塘/.test(text)) return "도시 공간";
    return "기타 공간";
  }

  const ROUTE_GEO_BOUNDS = {
    minLng: 119.85,
    maxLng: 120.72,
    minLat: 30.18,
    maxLat: 31.86,
  };

  function geoToRoutePoint(coordinates) {
    const lat = Number(coordinates?.lat);
    const lng = Number(coordinates?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    const x = 86 + ((lng - ROUTE_GEO_BOUNDS.minLng) / (ROUTE_GEO_BOUNDS.maxLng - ROUTE_GEO_BOUNDS.minLng)) * 790;
    const y = 350 - ((lat - ROUTE_GEO_BOUNDS.minLat) / (ROUTE_GEO_BOUNDS.maxLat - ROUTE_GEO_BOUNDS.minLat)) * 265;
    return {
      x: Math.max(52, Math.min(908, x)),
      y: Math.max(72, Math.min(365, y)),
    };
  }

  function routeStopView(stop) {
    const place = placeById(stop.placeId);
    const coordinates = placeCoordinates(place);
    const geoPoint = geoToRoutePoint(coordinates);
    return {
      ...stop,
      x: geoPoint?.x ?? stop.x,
      y: geoPoint?.y ?? stop.y,
      place,
      coordinates,
      hasConfirmedCoordinates: Boolean(geoPoint && isConfirmedChgis(place)),
      chgisId: place?.chgis?.id || "",
    };
  }

  function renderRouteReader(entry) {
    if (!entry) {
      return '<p class="reader-empty">원문 / 번역</p>';
    }
    return `
      <div class="route-reader-head">
        <strong>${escapeHtml(entry.date_label || entryDateParts(entry).label)}</strong>
      </div>
      <section class="route-reader-section">
        <h4>Original</h4>
        <p class="route-reader-original">${escapeHtml(entry.original || "원문 없음")}</p>
      </section>
      <section class="route-reader-section">
        <h4>Translation</h4>
        <p>${escapeHtml(entry.translation || "번역 없음")}</p>
      </section>
    `;
  }

  function renderHangzhouRouteMap() {
    const firstEntry = entryById(HANGZHOU_ROUTE_STOPS[0]?.entryId);
    return `
      <article class="route-map-panel mini-card">
        <div class="network-head">
          <div>
            <strong>항주 여정</strong>
          </div>
        </div>
        <div class="route-map-layout">
          <div class="route-map-canvas" aria-label="항주 이동 동선 개략도">
            <svg class="route-map-svg" viewBox="0 0 960 430" role="img">
              <defs>
                <linearGradient id="routeWater" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stop-color="#dcecf8"></stop>
                  <stop offset="100%" stop-color="#b8d4ec"></stop>
                </linearGradient>
                <linearGradient id="routeLine" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stop-color="#6f8faf"></stop>
                  <stop offset="100%" stop-color="#27486f"></stop>
                </linearGradient>
              </defs>
              <rect class="route-map-water" x="24" y="34" width="912" height="360" rx="34"></rect>
              <path class="route-river route-river-bg" d="M54 306 C174 226 252 210 360 174 S544 214 642 254 S774 324 910 354"></path>
              <path class="route-river" d="M54 306 C174 226 252 210 360 174 S544 214 642 254 S774 324 910 354"></path>
              <text class="route-map-region" x="80" y="88">江南 수로</text>
              <text class="route-map-region" x="734" y="102">杭州 권역</text>
              <path class="route-lake" d="M782 132 C850 108 910 148 902 214 C892 284 806 278 774 226 C748 184 742 150 782 132Z"></path>
              <text class="route-lake-label" x="815" y="202">西湖</text>
              ${HANGZHOU_ROUTE_STOPS.map((stop, index) => `
                <g
                  class="route-stop${index === HANGZHOU_ROUTE_STOPS.length - 1 ? " is-destination" : ""}${index === 0 ? " is-active" : ""}"
                  tabindex="0"
                  role="button"
                  data-route-entry-id="${escapeHtml(stop.entryId)}"
                  transform="translate(${stop.x} ${stop.y})">
                  <circle r="${index === HANGZHOU_ROUTE_STOPS.length - 1 ? 17 : 12}"></circle>
                  <text class="route-stop-label" y="-22">${escapeHtml(stop.label)}</text>
                  <text class="route-stop-sub" y="31">${escapeHtml(stop.sublabel)}</text>
                </g>
              `).join("")}
            </svg>
          </div>
          <aside class="route-reader" id="route-entry-reader">
            ${renderRouteReader(firstEntry)}
          </aside>
        </div>
      </article>
    `;
  }

  function bindRouteMap(root = document) {
    $all("[data-route-entry-id]", root).forEach((button) => {
      const openRouteEntry = () => {
        const entryId = button.dataset.routeEntryId;
        const entry = entryById(entryId);
        const reader = $("#route-entry-reader");
        if (!entry || !reader) {
          return;
        }
        $all("[data-route-entry-id]", root).forEach((item) => {
          item.classList.toggle("is-active", item.dataset.routeEntryId === entryId);
        });
        reader.innerHTML = renderRouteReader(entry);
      };
      button.addEventListener("click", openRouteEntry);
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRouteEntry();
        }
      });
    });
  }

  function placeGroupOrder() {
    return [
      "항주로 가는 동선",
      "기관·관청",
      "기관·사찰",
      "도시 공간",
      "자연",
      "체류·사교 공간",
      "항주 성외",
      "기타 공간",
    ];
  }

  function buildPlaceGroups(rows) {
    const groupOrder = placeGroupOrder();
    const groups = new Map();
    rows
      .slice()
      .sort((a, b) => {
        const leftIndex = groupOrder.indexOf(classifyPlace(a));
        const rightIndex = groupOrder.indexOf(classifyPlace(b));
        const groupDiff = (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
        if (groupDiff !== 0) return groupDiff;
        return (b.mention_count || b.count || 0) - (a.mention_count || a.count || 0);
      })
      .forEach((row) => {
        const group = classifyPlace(row);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(row);
      });
    return Array.from(groups.entries()).sort((a, b) => {
      const leftIndex = groupOrder.indexOf(a[0]);
      const rightIndex = groupOrder.indexOf(b[0]);
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
    });
  }

  function renderPlaceSections(groups) {
    if (!groups.length) {
      return '<p class="muted">조건에 맞는 공간이 없습니다.</p>';
    }
    return groups.map(([group, items]) => `
      <section class="place-section-group">
        <div class="place-section-head">
          <h3>${escapeHtml(group)}</h3>
          <p>${items.length}개 공간</p>
        </div>
        <div class="analysis-card-grid browser-grid">
          ${items.map((row) => entityCard(row, row.category || "places", group)).join("")}
        </div>
      </section>
    `).join("");
  }

  function renderPlaceHierarchyTree(rows) {
    const groups = buildPlaceGroups(rows);
    if (!groups.length) {
      return "";
    }
    return `
      <article class="place-hierarchy-panel mini-card">
        <div class="place-section-head">
          <h3>항주 공간 위계</h3>
        </div>
        <div class="place-tree-root">杭州</div>
        <div class="place-tree-grid">
          ${groups.map(([group, items], groupIndex) => `
            <details class="place-tree-group" ${groupIndex < 5 ? "open" : ""}>
              <summary>
                <span>${escapeHtml(group)}</span>
                <em>${items.length}곳</em>
              </summary>
              <div class="place-tree-list">
                ${items
                  .slice()
                  .sort((a, b) => (b.mention_count || b.count || 0) - (a.mention_count || a.count || 0))
                  .map((row) => {
                    const parent = placeById(placeParentId(row));
                    const coordinateBadge = isConfirmedChgis(row) ? "CHGIS" : "";
                    return `
                      <button type="button" class="place-tree-node" data-entity-category="${escapeHtml(row.category || "places")}" data-entity-id="${escapeHtml(row.id)}">
                        <span>${escapeHtml(publicEntityLabel(row))}</span>
                        <em>${escapeHtml(parent ? `상위 ${publicEntityLabel(parent)}` : `${row.count}개 기록`)}${coordinateBadge ? ` · ${coordinateBadge}` : ""}</em>
                      </button>
                    `;
                  }).join("")}
              </div>
            </details>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderCollapsedPlaceCards(groups) {
    if (!groups.length) {
      return "";
    }
    return `
      <details class="place-list-panel">
        <summary>
          <span>공간 카드 전체 보기</span>
          <em>${groups.reduce((total, [, items]) => total + items.length, 0)}곳</em>
        </summary>
        ${renderPlaceSections(groups)}
      </details>
    `;
  }

  function renderPlaceOverview(rows) {
    const topRows = rows
      .slice()
      .sort((a, b) => (b.mention_count || b.count || 0) - (a.mention_count || a.count || 0))
      .slice(0, 8);
    const groups = buildPlaceGroups(rows);
    const anchorNames = ["省中", "杭州", "法堂", "施水坊橋", "西湖", "吳山", "朝天門", "開元宮"];
    const anchors = anchorNames
      .map((name) => rows.find((row) => publicEntityLabel(row).includes(name) || (row.aliases || []).some((alias) => publicLabel(alias).includes(name))))
      .filter(Boolean);
    const sketchRows = [...new Map([...anchors, ...topRows].map((row) => [row.id, row])).values()].slice(0, 8);
    const positions = [
      [45, 28],
      [58, 42],
      [38, 52],
      [67, 58],
      [26, 38],
      [20, 68],
      [76, 30],
      [52, 72],
    ];

    return `
      <article class="place-overview-panel mini-card">
        <div class="network-head">
          <div>
            <strong>항주 내부 공간 한눈에 보기</strong>
          </div>
          <div class="chip-row network-summary">
            <span class="entity-chip">내부 공간 ${rows.length}</span>
            <span class="entity-chip">분류 ${groups.length}</span>
            <span class="entity-chip">대표 공간 ${topRows.length}</span>
          </div>
        </div>
        <div class="place-overview-layout">
          <div class="place-sketch-map" aria-label="항주 내부 공간 개략도">
            <span class="place-sketch-water">西湖</span>
            <span class="place-sketch-wall"></span>
            ${sketchRows.map((row, index) => {
              const [x, y] = positions[index] || [50, 50];
              return `
                <button
                  type="button"
                  class="place-sketch-node"
                  style="--x:${x}%; --y:${y}%"
                  data-entity-category="${escapeHtml(row.category || "places")}"
                  data-entity-id="${escapeHtml(row.id)}">
                  <span>${escapeHtml(compactText(publicEntityLabel(row), 8))}</span>
                </button>
              `;
            }).join("")}
          </div>
          <div class="place-overview-list">
            ${topRows.map((row, index) => `
              <button
                type="button"
                class="place-overview-card"
                data-entity-category="${escapeHtml(row.category || "places")}"
                data-entity-id="${escapeHtml(row.id)}">
                <span>${index + 1}</span>
                <strong>${escapeHtml(publicEntityLabel(row))}</strong>
                <em>${row.count}개 기록 · ${row.mention_count || row.count}회 언급</em>
              </button>
            `).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function syncPlaceTabs() {
    $all('[data-panel-tab="places"]').forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tabValue === state.placesTab);
    });
  }

  function bindPlaceTabs() {
    $all('[data-panel-tab="places"]').forEach((button) => {
      button.addEventListener("click", () => {
        state.placesTab = button.dataset.tabValue || "journey";
        syncPlaceTabs();
        renderPlacesPage();
      });
    });
    syncPlaceTabs();
  }

  function renderPlacesPage() {
    const target = $("#places-panel-body");
    if (!target) {
      return;
    }
    const query = state.placesQuery;
    const placeRows = [
      ...(state.data.places || []),
      ...(state.data.institutions || []),
    ].filter((row) => !isTransportPlace(row));
    const rows = placeRows.filter((row) => entitySearchText(row).includes(normalizeSearchText(query)));

    if (state.placesTab === "journey") {
      target.innerHTML = `
        ${renderHangzhouRouteMap()}
      `;
      bindRouteMap(target);
      return;
    }

    const visibleRows = rows.filter(isHangzhouInteriorSpace);
    const groups = buildPlaceGroups(visibleRows);
    target.innerHTML = `
      ${renderPlaceOverview(visibleRows)}
      ${renderEntityToolbar("places", "항주 내부 공간", placeRows.length, visibleRows.length, "항주 내부 공간명, 기관명, 유형으로 검색")}
      ${renderPlaceHierarchyTree(visibleRows)}
      ${query ? renderPlaceSections(groups) : renderCollapsedPlaceCards(groups)}
      <div id="entity-focus" class="analysis-stack entity-focus"></div>
    `;
    bindEntityToolbar("places", renderPlacesPage);
    bindEntityCards(target);
  }

  function isGovernmentInstitution(row) {
    const text = [
      row.label,
      publicEntityLabel(row),
      row.place_type,
      row.admin_level,
      row.authority_notes,
      ...(row.aliases || []),
    ].filter(Boolean).join(" ");
    if (/寺|觀|宫|宮|廟|院\b|書院|祠|庵|塔|temple|shrine|academy|religious|literary/i.test(text)) {
      return /提舉司|儒學提舉司|泉府院|財賦府|照磨所/.test(text);
    }
    return /省|司|房|府|所|衙|照磨|提舉|儒司|吏房|禮房|選房|廉司|財賦|官署|administrative|government|office/i.test(text);
  }

  function governmentInstitutionRows() {
    return (state.data.institutions || [])
      .filter(isGovernmentInstitution)
      .sort((left, right) => (right.count - left.count) || publicEntityLabel(left).localeCompare(publicEntityLabel(right), "ko"));
  }

  function administrativeWorkEntries() {
    const adminPattern = /省中|儒司|禮房|吏房|選房|照磨所|提舉司|財賦府|泉府院|廉司|擬劄|申狀|解由|呈|官吏|都目|外郞|司丞|提控|文書|吏輩/;
    return state.entries.filter((entry) => {
      const hasOffice = (entry.offices || []).length > 0;
      const hasGovernmentInstitution = (entry.institutions || []).some(isGovernmentInstitution);
      const topicText = entryTopicLabels(entry).join(" ");
      const hasAdminTopic = /관청 업무|관청|청원|문서|정장|공무/.test(topicText);
      const hasAdminText = adminPattern.test(`${entry.original || ""} ${entry.summary || ""}`);
      return hasOffice || hasGovernmentInstitution || hasAdminTopic || hasAdminText;
    });
  }

  function administrativeWorkLabels(entry) {
    const labels = [
      ...(entry.offices || []).map(publicEntityLabel),
      ...(entry.institutions || []).filter(isGovernmentInstitution).map(publicEntityLabel),
      ...entryTopicLabels(entry).filter((label) => /관청|청원|문서|정장|공무/.test(label)),
    ].filter(Boolean);
    return Array.from(new Set(labels)).slice(0, 5);
  }

  function renderAdministrativeWorkList(entries) {
    if (!entries.length) {
      return '<p class="muted">표시할 업무 기록이 없습니다.</p>';
    }
    return `
      <div class="entity-list imperial-work-list" role="list">
        ${entries.map((entry) => {
          const labels = administrativeWorkLabels(entry);
          const excerpt = compactText(entry.original || entry.translation || "", 72);
          return `
            <button type="button" class="entity-list-row imperial-work-row" data-entry-id="${escapeHtml(entry.entry_id)}">
              <strong>${escapeHtml(entry.date_label || entryDateParts(entry).label)}</strong>
              <span>${escapeHtml(labels.join(" · ") || excerpt)}</span>
              <em>원문 보기</em>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderImperialTabs() {
    return `
      <div class="tab-bar imperial-mode-tabs" aria-label="제국기구 보기 방식">
        ${IMPERIAL_TABS.map((tab) => `
          <button class="tab-button${state.institutionsTab === tab.key ? " is-active" : ""}" type="button" data-imperial-tab="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
        `).join("")}
      </div>
    `;
  }

  function syncImperialTabs() {
    $all("[data-imperial-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.imperialTab === state.institutionsTab);
    });
  }

  function bindImperialTabs(root = document) {
    $all("[data-imperial-tab]", root).forEach((button) => {
      if (button.dataset.boundImperialTab === "true") {
        return;
      }
      button.dataset.boundImperialTab = "true";
      button.addEventListener("click", () => {
        state.institutionsTab = button.dataset.imperialTab || "offices";
        state.visibleCount.institutions = PAGE_SIZE;
        syncImperialTabs();
        renderInstitutionsPage();
      });
    });
    syncImperialTabs();
  }

  function renderInstitutionsPage() {
    const target = $("#institutions-panel-body");
    if (!target) {
      return;
    }
    const officeRows = state.data.offices || [];
    const bureauRows = governmentInstitutionRows();
    const workflowRows = administrativeWorkEntries();
    const activeTab = IMPERIAL_TABS.find((tab) => tab.key === state.institutionsTab) || IMPERIAL_TABS[0];
    const rows = activeTab.key === "bureaus"
      ? bureauRows
      : activeTab.key === "workflows"
        ? workflowRows
        : officeRows;
    const visible = rows.slice(0, state.visibleCount.institutions);
    const listContent = activeTab.key === "workflows"
      ? `
        <section class="entity-list-panel">
          <div class="entity-list-head">
            <h2>업무 흐름</h2>
          </div>
          ${renderAdministrativeWorkList(visible)}
          ${rows.length > visible.length ? '<div class="card-actions browser-load-more"><button type="button" class="jump-link" id="institutions-more">업무 더 보기</button></div>' : ""}
        </section>
        <article class="panel detail-panel inline-reader">
          <div id="entry-reader">
            <p class="reader-empty">원문 / 번역</p>
          </div>
        </article>
      `
      : `
        <section class="entity-list-panel">
          <div class="entity-list-head">
            <h2>${activeTab.key === "bureaus" ? "관청 목록" : "관직 목록"}</h2>
          </div>
          ${renderEntityList(visible, activeTab.key === "bureaus" ? "institutions" : "offices", activeTab.key === "bureaus" ? "관청" : "관직")}
          ${rows.length > visible.length ? `<div class="card-actions browser-load-more"><button type="button" class="jump-link" id="institutions-more">${escapeHtml(activeTab.label)} 더 보기</button></div>` : ""}
        </section>
        <div id="entity-focus" class="analysis-stack entity-focus"></div>
      `;
    syncImperialTabs();
    target.innerHTML = listContent;
    bindLoadMore("institutions", renderInstitutionsPage);
    if (activeTab.key === "workflows") {
      bindEntryButtons(target);
      if (visible[0]) {
        selectEntry(visible[0].entry_id);
      }
    } else {
      bindEntityCards(target);
    }
  }

  function activeMaterialTab() {
    return MATERIAL_TABS.find((tab) => tab.key === state.materialsTab) || MATERIAL_TABS[0];
  }

  function syncMaterialTabs() {
    $all('[data-panel-tab="materials"]').forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tabValue === state.materialsTab);
    });
  }

  function bindMaterialTabs() {
    $all('[data-panel-tab="materials"]').forEach((button) => {
      button.addEventListener("click", () => {
        state.materialsTab = button.dataset.tabValue || "documents";
        state.visibleCount.materials = PAGE_SIZE;
        syncMaterialTabs();
        renderMaterialsPage();
      });
    });
    syncMaterialTabs();
  }

  function renderMaterialsPage() {
    const target = $("#materials-panel-body");
    if (!target) {
      return;
    }
    const activeTab = activeMaterialTab();
    const materialRows = activeTab.categories.flatMap((category) => state.data[category] || []);
    const rows = sortMaterialRows(materialRows, activeTab.categories[0]);
    const visible = rows.slice(0, state.visibleCount.materials);

    target.innerHTML = `
      <section class="entity-list-panel">
        <div class="entity-list-head">
          <h2>${escapeHtml(activeTab.label)} 목록</h2>
        </div>
        ${renderMaterialEntityList(visible, activeTab.categories[0], activeTab.label)}
        ${rows.length > visible.length ? `<div class="card-actions browser-load-more"><button type="button" class="jump-link" id="materials-more">${escapeHtml(activeTab.label)} 더 보기</button></div>` : ""}
      </section>
      <div id="entity-focus" class="analysis-stack entity-focus"></div>
    `;
    bindLoadMore("materials", renderMaterialsPage);
    bindEntityCards(target);
  }

  function shortEntryDate(entry) {
    const parts = entryDateParts(entry);
    return parts.month && parts.day ? `${parts.month}/${parts.day}` : compactText(entry.date_label || entry.entry_id, 6);
  }

  function entryTopicLabels(entry) {
    const labels = [];
    const add = (value) => {
      const label = publicTopicLabel(value);
      if (label && !TOPIC_LABELS_EXCLUDED_FROM_MATRIX.has(label)) {
        labels.push(label);
      }
    };
    (entry.topics || []).forEach(add);
    (entry.lifestyle_topics || []).forEach(add);
    (entry.entities?.topics || []).forEach((item) => add(publicEntityLabel(item)));
    (entry.entities?.responses || []).forEach((item) => add(publicEntityLabel(item)));
    return Array.from(new Set(labels));
  }

  function buildEntryTopicRows() {
    const rowsByLabel = new Map();
    state.entries.forEach((entry) => {
      entryTopicLabels(entry).forEach((label) => {
        if (!rowsByLabel.has(label)) {
          rowsByLabel.set(label, {
            id: "",
            kind: "topic",
            category: label.includes("감상") ? "responses" : "topics",
            label,
            count: 0,
            mention_count: 0,
            entries: [],
            aliases: [],
            roles: [],
            register_contexts: [],
            color: "",
            colorIndex: 0,
          });
        }
        const row = rowsByLabel.get(label);
        if (!row.entries.includes(entry.entry_id)) {
          row.entries.push(entry.entry_id);
          row.count = row.entries.length;
        }
        row.mention_count += 1;
      });
    });
    return assignUniqueTopicColors(
      Array.from(rowsByLabel.values())
        .sort((left, right) => (right.count - left.count) || left.label.localeCompare(right.label, "ko"))
    );
  }

  function buildWeatherRow() {
    const entries = state.entries.filter((entry) => String(entry.weather || "").trim());
    return {
      id: "weather-flow",
      kind: "weather",
      category: "weather",
      label: "날씨",
      count: entries.length,
      mention_count: entries.length,
      entries: entries.map((entry) => entry.entry_id),
      aliases: ["晴", "陰", "雨", "寒", "暑"],
      roles: [],
      register_contexts: [],
      color: WEATHER_COLORS.mixed,
      colorIndex: -1,
      isWeather: true,
    };
  }

  function coreTopicRows(rows) {
    const coreSet = new Set(CORE_TOPIC_LABELS);
    return rows
      .filter((row) => coreSet.has(row.label))
      .sort((left, right) => (right.count - left.count) || CORE_TOPIC_LABELS.indexOf(left.label) - CORE_TOPIC_LABELS.indexOf(right.label));
  }

  function secondaryTopicRows(rows) {
    const coreSet = new Set(CORE_TOPIC_LABELS);
    return rows
      .filter((row) => !coreSet.has(row.label))
      .sort((left, right) => (right.count - left.count) || left.label.localeCompare(right.label, "ko"));
  }

  function renderTopicFocus(row) {
    const entries = (row.entries || []).map(entryById).filter(Boolean);
    const focus = $("#entity-focus");
    if (!focus) {
      return;
    }
    focus.innerHTML = `
      <article class="mini-card topic-focus-card" style="--topic-color:${escapeHtml(row.color || topicColor(row.label, row.colorIndex))}">
        <strong>${escapeHtml(row.label)}</strong>
        <div class="chip-row">
          <span class="entity-chip">${entries.length}개 날짜</span>
          <span class="entity-chip">${escapeHtml(publicTopicKind(row))}</span>
          <span class="entity-chip">${row.mention_count || row.count}회 표시</span>
        </div>
      </article>
      <div class="event-feed">
        ${entries.map((entry) => renderEntryCard(entry)).join("")}
      </div>
    `;
    bindEntryButtons(focus);
  }

  function bindTopicCards(rows, root = document) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    $all("[data-topic-id]", root).forEach((button) => {
      button.addEventListener("click", () => {
        const row = rowById.get(button.dataset.topicId);
        if (row) {
          renderTopicFocus(row);
        }
      });
    });
  }

  function renderTopicListItem(row, isSelected) {
    return `
      <button
        type="button"
        class="topic-list-item${isSelected ? " is-active" : ""}"
        data-topic-list-id="${escapeHtml(row.id)}"
        style="--topic-color:${escapeHtml(row.color || topicColor(row.label, row.colorIndex))}">
        <strong>${escapeHtml(row.label)}</strong>
        <span>${row.count}일 · ${row.mention_count || row.count}회</span>
      </button>
    `;
  }

  function renderTopicEntryListCard(entry) {
    return `
      <button type="button" class="topic-entry-row" data-entry-id="${escapeHtml(entry.entry_id)}">
        <strong>${escapeHtml(entry.date_label || entryDateParts(entry).label)}</strong>
        <span>${escapeHtml(compactText(entry.original || entry.translation || "", 190))}</span>
      </button>
    `;
  }

  function renderTopicListDetail(row) {
    if (!row) {
      return '<p class="reader-empty">원문 / 번역</p>';
    }
    const entries = (row.entries || []).map(entryById).filter(Boolean);
    return `
      <article class="topic-list-detail-card" style="--topic-color:${escapeHtml(row.color || topicColor(row.label, row.colorIndex))}">
        <div class="topic-list-detail-head">
          <span>${escapeHtml(publicTopicKind(row))}</span>
          <h3>${escapeHtml(row.label)}</h3>
          <p>${entries.length}개 날짜 · ${row.mention_count || row.count}회 언급</p>
        </div>
        <div class="topic-entry-list">
          ${entries.map(renderTopicEntryListCard).join("") || '<p class="muted">관련 기록이 없습니다.</p>'}
        </div>
      </article>
      <article class="panel detail-panel inline-reader topic-reader-panel">
        <div id="entry-reader">
          <p class="reader-empty">원문 / 번역</p>
        </div>
      </article>
    `;
  }

  function bindTopicListBrowser(rows, root = document) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const detail = $("#topic-list-detail", root);
    $all("[data-topic-list-id]", root).forEach((button) => {
      button.addEventListener("click", () => {
        const row = rowById.get(button.dataset.topicListId);
        if (!row || !detail) {
          return;
        }
        state.selectedTopicId = row.id;
        $all("[data-topic-list-id]", root).forEach((item) => {
          item.classList.toggle("is-active", item.dataset.topicListId === row.id);
        });
        detail.innerHTML = renderTopicListDetail(row);
        bindEntryButtons(detail);
      });
    });
    bindEntryButtons(detail || root);
  }

  function renderTopicTabs() {
    return `
      <div class="tab-bar topic-mode-tabs" aria-label="토픽 보기 방식">
        <button class="tab-button${state.topicsTab === "matrix" ? " is-active" : ""}" type="button" data-topic-tab="matrix">토픽 탐색</button>
        <button class="tab-button${state.topicsTab === "list" ? " is-active" : ""}" type="button" data-topic-tab="list">토픽 목록</button>
      </div>
    `;
  }

  function syncTopicTabs() {
    $all("[data-topic-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.topicTab === state.topicsTab);
    });
  }

  function bindTopicTabs(root = document) {
    $all("[data-topic-tab]", root).forEach((button) => {
      if (button.dataset.boundTopicTab === "true") {
        return;
      }
      button.dataset.boundTopicTab = "true";
      button.addEventListener("click", () => {
        state.topicsTab = button.dataset.topicTab || "matrix";
        syncTopicTabs();
        renderTopicsPage();
      });
    });
    syncTopicTabs();
  }

  function renderTopicTimelineMatrix(rows, totalTopicCount) {
    if (!rows.length) {
      return '<p class="muted">조건에 맞는 토픽이 없습니다.</p>';
    }
    const entries = state.entries;
    const topicEntrySets = new Map(rows.map((row) => [row.id, new Set(row.entries || [])]));
    const columnStyle = `grid-template-columns: 92px repeat(${entries.length}, 14px);`;
    return `
      <section class="topic-matrix-panel">
        <div class="topic-matrix-head">
          <div>
            <strong>토픽 타임라인</strong>
          </div>
        </div>
        <div class="topic-matrix-scroll" aria-label="토픽 날짜 행렬">
          <div class="topic-matrix-grid" style="${columnStyle}">
            <div class="topic-matrix-corner">토픽</div>
            ${entries.map((entry, index) => {
              const parts = entryDateParts(entry);
              const label = index === 0 || parts.day === 1
                ? `${parts.month}/${parts.day}`
                : `${parts.day || ""}`;
              return `
                <button type="button" class="topic-date-head topic-column-head" data-entry-id="${escapeHtml(entry.entry_id)}" title="${escapeHtml(entry.date_label || entry.entry_id)}">
                  ${escapeHtml(label)}
                </button>
              `;
            }).join("")}
            ${rows.map((row) => {
              const entrySet = topicEntrySets.get(row.id) || new Set();
              const label = row.label;
              const color = row.color || topicColor(label, row.colorIndex);
              return `
              <button
                type="button"
                class="topic-row-label"
                data-topic-id="${escapeHtml(row.id)}"
                style="--topic-color:${escapeHtml(color)}"
                title="${escapeHtml(label)}">
                <strong>${escapeHtml(compactText(label, 8))}</strong>
                <span>${row.count}</span>
              </button>
              ${entries.map((entry) => {
                const hasTopic = entrySet.has(entry.entry_id);
                if (!hasTopic) {
                  return '<span class="topic-cell" aria-hidden="true"></span>';
                }
                if (row.isWeather) {
                  const profile = weatherProfile(entry.weather);
                  return `
                    <button
                      type="button"
                      class="topic-cell has-topic weather-cell is-${escapeHtml(profile.key)}"
                      style="--topic-color:${escapeHtml(profile.color)}"
                      data-entry-id="${escapeHtml(entry.entry_id)}"
                      title="${escapeHtml(`${entry.date_label || entry.entry_id} · ${entry.weather || "날씨"}`)}">
                      <span>${escapeHtml(profile.label)}</span>
                    </button>
                  `;
                }
                return `
                  <button
                    type="button"
                    class="topic-cell has-topic"
                    style="--topic-color:${escapeHtml(color)}"
                    data-entry-id="${escapeHtml(entry.entry_id)}"
                    title="${escapeHtml(`${entry.date_label || entry.entry_id} · ${label}`)}">
                    <span class="sr-only">${escapeHtml(`${entry.date_label || entry.entry_id} ${label}`)}</span>
                  </button>
                `;
              }).join("")}
            `;
            }).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderTopicsPage() {
    const target = $("#topics-panel-body");
    if (!target) {
      return;
    }
    const allTopicRows = buildEntryTopicRows();
    const displayTopicRows = allTopicRows.filter((row) => row.count >= 2);
    const matrixTopicRows = displayTopicRows;
    const weatherRow = buildWeatherRow();
    const matrixRows = [weatherRow, ...matrixTopicRows];
    const visible = matrixTopicRows.slice(0, state.visibleCount.topics);
    const selectedTopic = displayTopicRows.find((row) => row.id === state.selectedTopicId) || displayTopicRows[0] || null;
    if (selectedTopic && !state.selectedTopicId) {
      state.selectedTopicId = selectedTopic.id;
    }
    const matrixContent = `
      ${renderTopicTimelineMatrix(matrixRows, allTopicRows.length)}
      <article class="panel detail-panel inline-reader topic-reader-panel">
        <div id="entry-reader">
          <p class="reader-empty">원문 / 번역</p>
        </div>
      </article>
      <div id="entity-focus" class="analysis-stack entity-focus"></div>
    `;
    const listContent = `
      <section class="topic-list-panel">
        <div class="topic-matrix-head">
          <div>
            <strong>토픽 목록</strong>
          </div>
        </div>
        <section class="topic-list-browser">
          <aside class="topic-list-sidebar" aria-label="토픽 목록">
            ${visible.map((row) => `
              ${renderTopicListItem(row, selectedTopic?.id === row.id)}
            `).join("")}
          </aside>
          <div class="topic-list-main" id="topic-list-detail">
            ${renderTopicListDetail(selectedTopic)}
          </div>
        </section>
        ${matrixTopicRows.length > visible.length ? '<div class="card-actions browser-load-more"><button type="button" class="jump-link" id="topics-more">토픽 더 보기</button></div>' : ""}
      </section>
    `;
    syncTopicTabs();
    target.innerHTML = state.topicsTab === "list" ? listContent : matrixContent;
    bindLoadMore("topics", renderTopicsPage);
    if (state.topicsTab === "list") {
      bindTopicListBrowser(displayTopicRows, target);
    } else {
      bindEntryButtons(target);
      bindTopicCards([weatherRow, ...displayTopicRows], target);
    }
  }

  function renderEntityToolbar(scope, label, total, current, placeholder) {
    return `
      <section class="browser-toolbar">
        <div class="browser-summary">
          <span class="entity-chip">전체 ${escapeHtml(label)} ${total}</span>
          <span class="entity-chip">현재 결과 ${current}</span>
        </div>
        <div class="search-box browser-search">
          <input id="${scope}-search" type="search" value="${escapeHtml(state[`${scope}Query`] || "")}" placeholder="${escapeHtml(placeholder)}">
          <button type="button" id="${scope}-search-button">검색</button>
        </div>
      </section>
    `;
  }

  function bindLoadMore(scope, rerender) {
    const more = $(`#${scope}-more`);
    more?.addEventListener("click", () => {
      state.visibleCount[scope] += PAGE_SIZE;
      rerender();
    });
  }

  function bindEntityToolbar(scope, rerender) {
    const input = $(`#${scope}-search`);
    const button = $(`#${scope}-search-button`);
    const more = $(`#${scope}-more`);
    const apply = () => {
      state[`${scope}Query`] = (input?.value || "").trim();
      state.visibleCount[scope] = PAGE_SIZE;
      rerender();
    };
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        apply();
      }
    });
    button?.addEventListener("click", apply);
    more?.addEventListener("click", () => {
      state.visibleCount[scope] += PAGE_SIZE;
      rerender();
    });
  }

  async function init() {
    try {
      state.data = await loadData();
      state.entries = state.data.entries || [];
      state.activeEntryId = state.entries[0]?.entry_id || "";
      renderStats();
      bindHomeSearch();
      if (pageKind() === "calendar") {
        renderCalendarPage();
        if (state.activeEntryId) selectEntry(state.activeEntryId);
      } else if (pageKind() === "people") {
        renderPeoplePage();
      } else if (pageKind() === "places") {
        bindPlaceTabs();
        renderPlacesPage();
      } else if (pageKind() === "institutions") {
        bindImperialTabs();
        renderInstitutionsPage();
      } else if (pageKind() === "materials") {
        bindMaterialTabs();
        renderMaterialsPage();
      } else if (pageKind() === "topics") {
        bindTopicTabs();
        renderTopicsPage();
      }
    } catch (error) {
      const target = $(".analysis-stack") || $("#calendar-years") || $("#entry-reader");
      if (target) {
        target.innerHTML = `<p class="error-box">${escapeHtml(error.message)}</p>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();






