/**
 * Cloudflare Pages Function — /api/*
 * STEAM 科問卷調查系統 v2 — 班級分佈格式
 *
 * 提交格式（每題直接輸入各分數人數）：
 *   { grade, className, type, totalStudents,
 *     questions: { Q1: {5:n, 4:n, 3:n, 2:n, 1:n}, ... } }
 *
 * Endpoints:
 *   POST /api/submit       — 提交班級問卷分佈
 *   GET  /api/results      — 讀取結果 (?grade=P1&type=student&auth=xxx)
 *   GET  /api/results/all  — 讀取所有結果 (?auth=xxx)
 *   GET  /api/export       — 匯出 CSV (?auth=xxx)
 *   GET  /api/questions    — 取得問題清單
 *   GET  /api/health       — 健康檢查
 */

const ADMIN_PASSWORD = "lstlwwf";

const QUESTIONS = {
  student: {
    P1: ["我喜歡用 Matatalab 機械人學習編程","Code.org 的編程遊戲讓我覺得很有趣","我學會了用鍵盤正確地打字","電腦堂的活動讓我學到新知識","我期待每一節 STEAM 課"],
    P2: ["我喜歡用 Scratch Jr 創作故事","Matatalab 方向挑戰幫助我理解方向概念","我學會了用 Word 製作文件","用 iPad 學習讓課堂更有趣","STEAM 科的活動讓我更有創意"],
    P3: ["我喜歡用 Micro:bit 進行編程","Code.org 幫助我理解序列和重複的概念","我學會了製作 PowerPoint 簡報","我學會了安全地使用互聯網","STEAM 科的課堂活動很有趣"],
    P4: ["我喜歡在騰訊 AI 平台上學習","AI 生成圖片和文字讓我覺得很有趣","製作太陽能動力車讓我學到科學知識","健康生活程式設計幫助我了解健康生活習慣","STEAM 科的活動讓我更有解難能力"],
    P5: ["我喜歡用 AI 製作中華文化翻譯官","四格漫畫創作讓我更有創意","八大行星互動導覽讓我學到更多知識","STEAM DAY 活動讓我對環保有更深認識","我覺得 AI 工具能幫助我更好地學習"],
    P6: ["AI 植物百科（識花君）讓我對植物更感興趣","專題研習提升了我的研究能力","一帶一路互動地圖幫助我了解中國地理","AI 幫助我探索未來的職業方向","SUNO AI 音樂創作讓我體驗到科技的樂趣"]
  },
  teacher: ["STEAM 科課程有效提升學生的運算思維","騰訊 AI 平台適合用於課堂教學","STEAM DAY 活動有助學生理解科技與環保的關係","跨科整合能有效提升學生的學習動機","現有課程安排和資源足以支援教學需要"]
};

const TEACHERS = [
  {code:"鋒",name:"楊錦鋒"},{code:"蕭",name:"蕭蕙欣"},{code:"高",name:"高健倫"},{code:"梁",name:"梁建華"},
  {code:"鄧",name:"鄧思義"},{code:"瑤",name:"黃偉瑤"},{code:"容",name:"吳永容"},{code:"偉",name:"黃博偉"},
  {code:"婷",name:"鍾詩婷"},{code:"軍",name:"李軍"},{code:"鳳",name:"何美鳳"},{code:"卿",name:"潘美卿"},
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function checkAuth(url, headers) {
  return url.searchParams.get("auth") || headers.get("Authorization") === `Bearer ${ADMIN_PASSWORD}`;
}

/* ═══════════ Aggregation (v2 distribution format) ═══════════ */
function aggregateResults(results) {
  const numQ = 5;
  const byClass = {};
  for (const r of results) {
    const key = r.className;
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(r);
  }

  const aggregated = {};
  for (const [cls, items] of Object.entries(byClass)) {
    const qStats = {};
    let totalStudents = 0;
    for (let q = 0; q < numQ; q++) {
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0, count = 0;
      for (const item of items) {
        // v2 format: item.questions.Q1 = {5:n, 4:n, ...}
        const qData = item.questions?.[`Q${q+1}`];
        if (qData) {
          for (let s = 1; s <= 5; s++) {
            const n = Number(qData[s]) || 0;
            dist[s] += n;
            sum += s * n;
            count += n;
          }
        }
      }
      if (q === 0) totalStudents = count; // Use Q1 total as class size
      qStats[`Q${q+1}`] = {
        distribution: dist,
        average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
        totalResponses: count,
      };
    }
    aggregated[cls] = { studentCount: totalStudents, questions: qStats };
  }

  // Overall
  const overall = {};
  let overallTotal = 0;
  for (let q = 0; q < numQ; q++) {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0, count = 0;
    for (const r of results) {
      const qData = r.questions?.[`Q${q+1}`];
      if (qData) {
        for (let s = 1; s <= 5; s++) {
          const n = Number(qData[s]) || 0;
          dist[s] += n;
          sum += s * n;
          count += n;
        }
      }
    }
    if (q === 0) overallTotal = count;
    overall[`Q${q+1}`] = {
      distribution: dist,
      average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      totalResponses: count,
    };
  }

  return { byClass: aggregated, overall, totalStudents: overallTotal };
}

/* ═══════════ Main handler ═══════════ */
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  const url = new URL(request.url);
  const subPath = url.pathname.replace("/api", "") || "/";
  const kv = env.SURVEY_KV;

  try {
    // ── GET /api/health ──
    if (subPath === "/" && request.method === "GET") {
      return json({ ok: true, ts: Date.now() });
    }

    // ── GET /api/questions ──
    if (subPath === "/questions") {
      return json(QUESTIONS);
    }

    // ── GET /api/teachers ──
    if (subPath === "/teachers") {
      return json(TEACHERS);
    }

    // ── POST /api/submit (v2 distribution format) ──
    if (subPath === "/submit" && request.method === "POST") {
      const body = await request.json();
      const { grade, className, type, totalStudents, questions, teacherCode } = body;
      if (!type || !questions) {
        return json({ error: "Missing fields: type, questions" }, 400);
      }
      if (type === "student" && !grade) {
        return json({ error: "Student survey requires grade" }, 400);
      }

      const id = crypto.randomUUID();
      const record = {
        id,
        grade: grade || "",
        className: className || (teacherCode ? "teacher" : ""),
        type,
        totalStudents: totalStudents || 0,
        teacherCode: teacherCode || "",
        questions,
        timestamp: new Date().toISOString(),
      };
      await kv.put(`r:${id}`, JSON.stringify(record));

      const index = await kv.get("meta:index", "json") || [];
      index.push({ id, grade, className: record.className, type, teacherCode: record.teacherCode, ts: record.timestamp });
      await kv.put("meta:index", JSON.stringify(index));

      return json({ success: true, id });
    }

    // ── GET /api/results/all ──
    if (subPath === "/results/all") {
      if (checkAuth(url, request.headers) !== ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);
      const index = await kv.get("meta:index", "json") || [];
      const results = [];
      for (const e of index) { const r = await kv.get(`r:${e.id}`, "json"); if (r) results.push(r); }
      const grouped = {};
      for (const r of results) {
        const key = `${r.grade}_${r.type}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      }
      const allAgg = {};
      for (const [k, items] of Object.entries(grouped)) allAgg[k] = aggregateResults(items);
      return json({ total: results.length, data: allAgg, raw: results });
    }

    // ── GET /api/results ──
    if (subPath === "/results") {
      if (checkAuth(url, request.headers) !== ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);
      const grade = url.searchParams.get("grade");
      const type = url.searchParams.get("type") || "student";
      const index = await kv.get("meta:index", "json") || [];
      const filtered = index.filter(e => (!grade || e.grade === grade) && e.type === type);
      const results = [];
      for (const e of filtered) { const r = await kv.get(`r:${e.id}`, "json"); if (r) results.push(r); }
      return json({ count: results.length, results, aggregated: aggregateResults(results) });
    }

    // ── GET /api/export ──
    if (subPath === "/export") {
      if (checkAuth(url, request.headers) !== ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);
      const index = await kv.get("meta:index", "json") || [];
      const results = [];
      for (const e of index) { const r = await kv.get(`r:${e.id}`, "json"); if (r) results.push(r); }

      // CSV header
      let header = "年級,班別,類型,教師代號,總人數,提交時間";
      for (let i = 1; i <= 5; i++) {
        header += `,Q${i}-5分,Q${i}-4分,Q${i}-3分,Q${i}-2分,Q${i}-1分,Q${i}-平均分`;
      }
      const rows = [header];
      for (const r of results) {
        const row = [r.grade, r.className, r.type === "student" ? "學生" : "教師", r.teacherCode || "", r.totalStudents || "", r.timestamp];
        for (let i = 1; i <= 5; i++) {
          const qd = r.questions?.[`Q${i}`] || {};
          row.push(qd[5] || 0, qd[4] || 0, qd[3] || 0, qd[2] || 0, qd[1] || 0);
          // Calculate average
          let sum = 0, cnt = 0;
          for (let s = 1; s <= 5; s++) { const n = Number(qd[s]) || 0; sum += s * n; cnt += n; }
          row.push(cnt > 0 ? (sum / cnt).toFixed(2) : "");
        }
        rows.push(row.join(","));
      }
      return new Response("\uFEFF" + rows.join("\n"), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="STEAM_survey_results.csv"', "Access-Control-Allow-Origin": "*" },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
