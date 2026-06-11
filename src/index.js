/**
 * STEAM 科問卷調查 Cloudflare Worker API
 *
 * Endpoints:
 *   POST /api/submit       — 提交問卷回覆
 *   GET  /api/results       — 讀取結果 (?grade=P1&type=student)
 *   GET  /api/results/all   — 讀取所有結果
 *   GET  /api/questions     — 回傳問題清單
 *   GET  /api/health        — 健康檢查
 */

const ADMIN_PASSWORD = "steam2026";

const QUESTIONS = {
  student: {
    P1: [
      "我喜歡用 Matatalab 機械人學習編程",
      "Code.org 的編程遊戲讓我覺得很有趣",
      "我學會了用鍵盤正確地打字",
      "電腦堂的活動讓我學到新知識",
      "我期待每一節 STEAM 課"
    ],
    P2: [
      "我喜歡用 Scratch Jr 創作故事",
      "Matatalab 方向挑戰幫助我理解方向概念",
      "我學會了用 Word 製作文件",
      "用 iPad 學習讓课堂更有趣",
      "STEAM 科的活動讓我更有創意"
    ],
    P3: [
      "我喜歡用 Micro:bit 進行編程",
      "Code.org 幫助我理解序列和重複的概念",
      "我學會了製作 PowerPoint 簡報",
      "我學會了安全地使用互聯網",
      "STEAM 科的課堂活動很有趣"
    ],
    P4: [
      "我喜歡在騰訊 AI 平台上學習",
      "AI 生成圖片和文字讓我覺得很有趣",
      "製作太陽能動力車讓我學到科學知識",
      "健康生活程式設計幫助我了解健康生活習慣",
      "STEAM 科的活動讓我更有解難能力"
    ],
    P5: [
      "我喜歡用 AI 製作中華文化翻譯官",
      "四格漫畫創作讓我更有創意",
      "八大行星互動導覽讓我學到更多知識",
      "STEAM DAY 活動讓我對環保有更深認識",
      "我覺得 AI 工具能幫助我更好地學習"
    ],
    P6: [
      "AI 植物百科（識花君）讓我對植物更感興趣",
      "專題研習提升了我的研究能力",
      "一帶一路互動地圖幫助我了解中國地理",
      "AI 幫助我探索未來的職業方向",
      "SUNO AI 音樂創作讓我體驗到科技的樂趣"
    ]
  },
  teacher: {
    all: [
      "STEAM 科課程有效提升學生的運算思維",
      "騰訊 AI 平台適合用於課堂教學",
      "STEAM DAY 活動有助學生理解科技與環保的關係",
      "跨科整合能有效提升學生的學習動機",
      "現有課程安排和資源足以支援教學需要"
    ]
  }
};

/* ═══════════ CORS ═══════════ */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/* ═══════════ Main Router ═══════════ */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") {
        return corsJson({ ok: true, ts: Date.now() });
      }

      if (path === "/api/questions") {
        return corsJson(QUESTIONS);
      }

      if (path === "/api/submit" && request.method === "POST") {
        return await handleSubmit(request, env);
      }

      if (path === "/api/results/all" && request.method === "GET") {
        return await handleResultsAll(request, env);
      }

      if (path === "/api/results" && request.method === "GET") {
        return await handleResults(request, env);
      }

      if (path === "/api/export" && request.method === "GET") {
        return await handleExport(request, env);
      }

      return corsJson({ error: "Not found" }, 404);
    } catch (e) {
      return corsJson({ error: e.message }, 500);
    }
  },
};

/* ═══════════ POST /api/submit ═══════════ */
async function handleSubmit(request, env) {
  const body = await request.json();
  const { grade, className, type, responses } = body;

  if (!grade || !className || !type || !responses) {
    return corsJson({ error: "Missing required fields: grade, className, type, responses" }, 400);
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    grade,
    className,
    type,
    responses,
    timestamp: new Date().toISOString(),
  };

  // Store individual response
  await env.SURVEY_KV.put(`r:${id}`, JSON.stringify(record));

  // Append to index (atomic-ish: read, append, write)
  const indexRaw = await env.SURVEY_KV.get("meta:index", "json") || [];
  indexRaw.push({
    id,
    grade,
    className,
    type,
    ts: record.timestamp,
  });
  await env.SURVEY_KV.put("meta:index", JSON.stringify(indexRaw));

  return corsJson({ success: true, id });
}

/* ═══════════ GET /api/results?grade=&type= ═══════════ */
async function handleResults(request, env) {
  const url = new URL(request.url);
  const auth = url.searchParams.get("auth") || request.headers.get("Authorization");

  if (auth !== ADMIN_PASSWORD) {
    return corsJson({ error: "Unauthorized" }, 401);
  }

  const grade = url.searchParams.get("grade");
  const type = url.searchParams.get("type") || "student";

  const index = await env.SURVEY_KV.get("meta:index", "json") || [];
  const filtered = index.filter((e) => {
    const matchGrade = !grade || e.grade === grade;
    const matchType = e.type === type;
    return matchGrade && matchType;
  });

  const results = [];
  for (const entry of filtered) {
    const raw = await env.SURVEY_KV.get(`r:${entry.id}`, "json");
    if (raw) results.push(raw);
  }

  // Aggregate
  const aggregated = aggregateResults(results, type);
  return corsJson({ count: results.length, results, aggregated });
}

/* ═══════════ GET /api/results/all ═══════════ */
async function handleResultsAll(request, env) {
  const url = new URL(request.url);
  const auth = url.searchParams.get("auth") || request.headers.get("Authorization");

  if (auth !== ADMIN_PASSWORD) {
    return corsJson({ error: "Unauthorized" }, 401);
  }

  const index = await env.SURVEY_KV.get("meta:index", "json") || [];
  const results = [];
  for (const entry of index) {
    const raw = await env.SURVEY_KV.get(`r:${entry.id}`, "json");
    if (raw) results.push(raw);
  }

  const grouped = {};
  for (const r of results) {
    const key = `${r.grade}_${r.type}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const allAggregated = {};
  for (const [key, items] of Object.entries(grouped)) {
    allAggregated[key] = aggregateResults(items, items[0].type);
  }

  return corsJson({ total: results.length, data: allAggregated, raw: results });
}

/* ═══════════ GET /api/export ═══════════ */
async function handleExport(request, env) {
  const url = new URL(request.url);
  const auth = url.searchParams.get("auth") || request.headers.get("Authorization");

  if (auth !== ADMIN_PASSWORD) {
    return corsJson({ error: "Unauthorized" }, 401);
  }

  const index = await env.SURVEY_KV.get("meta:index", "json") || [];
  const results = [];
  for (const entry of index) {
    const raw = await env.SURVEY_KV.get(`r:${entry.id}`, "json");
    if (raw) results.push(raw);
  }

  // Build CSV
  const maxQ = 5;
  let header = "年級,班別,類型,提交時間";
  for (let i = 1; i <= maxQ; i++) header += `,Q${i}`;
  const rows = [header];

  for (const r of results) {
    const row = [
      r.grade,
      r.className,
      r.type === "student" ? "學生" : "教師",
      r.timestamp,
    ];
    for (let i = 0; i < maxQ; i++) {
      row.push(r.responses[i] ?? "");
    }
    rows.push(row.join(","));
  }

  const csv = "\uFEFF" + rows.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="STEAM_survey_results.csv"',
      ...CORS_HEADERS,
    },
  });
}

/* ═══════════ Aggregation ═══════════ */
function aggregateResults(results, type) {
  const numQ = 5;
  const aggregated = {};

  // Group by class
  const byClass = {};
  for (const r of results) {
    const key = r.className;
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(r);
  }

  for (const [cls, items] of Object.entries(byClass)) {
    const qStats = {};
    for (let q = 0; q < numQ; q++) {
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      let count = 0;
      for (const item of items) {
        const val = Number(item.responses[q]);
        if (val >= 1 && val <= 5) {
          dist[val]++;
          sum += val;
          count++;
        }
      }
      qStats[`Q${q + 1}`] = {
        distribution: dist,
        average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
        totalResponses: count,
      };
    }
    aggregated[cls] = {
      studentCount: items.length,
      questions: qStats,
    };
  }

  // Overall
  const overall = {};
  for (let q = 0; q < numQ; q++) {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let count = 0;
    for (const r of results) {
      const val = Number(r.responses[q]);
      if (val >= 1 && val <= 5) {
        dist[val]++;
        sum += val;
        count++;
      }
    }
    overall[`Q${q + 1}`] = {
      distribution: dist,
      average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      totalResponses: count,
    };
  }

  return { byClass: aggregated, overall, totalStudents: results.length };
}
