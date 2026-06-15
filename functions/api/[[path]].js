/**
 * Cloudflare Pages Function — /api/*
 * 問卷調查系統 v6 — 多學科（STEAM科 + 科學科）
 *
 * 提交格式：
 *   { dept, grade, className, type, totalStudents,
 *     questions: { Q1: {5:n, 4:n, 3:n, 2:n, 1:n}, ... } }
 *
 * Endpoints:
 *   POST /api/submit       — 提交問卷
 *   GET  /api/results      — 讀取結果 (?dept=steam&grade=P1&type=student&auth=xxx)
 *   GET  /api/results/all  — 讀取所有結果 (?auth=xxx)
 *   GET  /api/export       — 匯出 CSV (?dept=steam&auth=xxx)
 *   GET  /api/questions    — 取得問題清單
 *   GET  /api/teachers     — 取得教師清單 (?dept=steam)
 */

const ADMIN_PASSWORD = "lstlwwf";

const QUESTIONS = {
  steam: {
    student: {
      P1: ["我喜歡用 Matatalab 機械人學習編程","Code.org 的編程遊戲讓我覺得很有趣","我學會了用鍵盤正確地打字","電腦堂的活動讓我學到新知識","我期待每一節 STEAM 課"],
      P2: ["我喜歡用 Scratch Jr 創作故事","Matatalab 方向挑戰幫助我理解方向概念","我學會了用 Word 製作文件","用 iPad 學習讓課堂更有趣","STEAM 科的活動讓我更有創意"],
      P3: ["我喜歡用 Micro:bit 進行編程","Code.org 幫助我理解序列和重複的概念","我學會了製作 PowerPoint 簡報","我學會了安全地使用互聯網","STEAM 科的課堂活動很有趣"],
      P4: ["我喜歡在騰訊 AI 平台上學習","AI 生成圖片和文字讓我覺得很有趣","第一學段的「AI基礎課程」幫助我懂得正確使用 AI","GIGO「太陽能動力車」讓我學到能源轉換知識","「健康生活天使」程式設計幫助我了解健康生活習慣"],
      P5: ["「AI中華文化翻譯官」讓我學到自然語言處理","第一學段的「AI基礎課程」幫助我懂得判斷 AI 資訊是否可信","「狐假虎威」四格漫畫創作讓我更有創意","「八大行星」互動導覽讓我學到更多天文知識","STEAM DAY 活動讓我對環保有更深認識"],
      P6: ["「識花君」AI 植物百科讓我對生物多樣性更感興趣","騰訊專題研習提升了我的研究能力","「一帶一路」互動地圖幫助我了解中國地理","第一學段的「AI基礎課程」幫助我懂得運用 AI 輔助學習","AI 幫助我探索未來的職業方向"]
    },
    teacher: ["STEAM 科課程有效提升學生的運算思維","騰訊 AI 平台適合用於課堂教學","STEAM DAY 活動有助學生理解科技與環保的關係","跨科整合能有效提升學生的學習動機","現有課程安排和資源足以支援教學需要"]
  },
  science: {
    student: {
      P1: ["觀察樹葉和動物的活動讓我對科學感到好奇","動手做實驗讓我更理解科學原理","感官探索活動幫助我認識自己的身體","水和空氣的實驗讓我學到科學知識","我期待每一節科學課"],
      P4: ["「認識地球」單元的岩石和土壤實驗讓我學到地球科學知識","「生物與環境」單元幫助我理解食物鏈和生態平衡","遺傳特徵調查活動讓我明白生物的繁殖與遺傳","口罩效能實驗讓我了解傳染病的預防方法","「芭蕉扇」科學探究活動讓我學會公平測試"]
    },
    teacher: ["MAGIC SCIENCE 探究課程有效提升學生的科學探究能力","動手做實驗有助學生理解科學概念","跨科協作（STEAM DAY）能有效提升學生的學習動機","PSCG 課程框架適合本校學生的學習需要","現有課程安排和實驗資源足以支援教學需要"]
  }
};

const TEACHERS = {
  steam: [
    {code:"鋒",name:"楊錦鋒"},{code:"蕭",name:"蕭蕙欣"},{code:"高",name:"高健倫"},{code:"梁",name:"梁建華"},
    {code:"鄧",name:"鄧思義"},{code:"珞",name:"黃偉珞"},{code:"容",name:"吳永容"},{code:"偉",name:"黃博偉"},
    {code:"婷",name:"鍾詩婷"},{code:"軍",name:"李軍"},{code:"鳳",name:"何美鳳"},{code:"卿",name:"潘美卿"},
  ],
  science: [
    {code:"鋒",name:"楊錦鋒"},{code:"軍",name:"李軍"},{code:"蕭",name:"蕭蕙欣"},
    {code:"珞",name:"黃偉珞"},{code:"婷",name:"鍾詩婷"},{code:"卿",name:"潘美卿"},
    {code:"睿",name:"吳永睿"},{code:"鳳",name:"何美鳳"},
  ]
};

const DEPT_LABELS = { steam: "STEAM 科", science: "科學科" };

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
      if (q === 0) totalStudents = count;
      qStats[`Q${q+1}`] = {
        distribution: dist,
        average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
        totalResponses: count,
      };
    }
    aggregated[cls] = { studentCount: totalStudents, questions: qStats };
  }

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

    // ── GET /api/teachers?dept=steam ──
    if (subPath === "/teachers") {
      const dept = url.searchParams.get("dept") || "steam";
      return json(TEACHERS[dept] || []);
    }

    // ── POST /api/submit ──
    if (subPath === "/submit" && request.method === "POST") {
      const body = await request.json();
      const { dept, grade, className, type, totalStudents, questions, teacherCode } = body;
      if (!type || !questions) {
        return json({ error: "Missing fields: type, questions" }, 400);
      }
      if (type === "student" && !grade) {
        return json({ error: "Student survey requires grade" }, 400);
      }

      const id = crypto.randomUUID();
      const record = {
        id,
        dept: dept || "steam",
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
      index.push({ id, dept: record.dept, grade, className: record.className, type, teacherCode: record.teacherCode, ts: record.timestamp });
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
        const key = `${r.dept || "steam"}_${r.grade}_${r.type}`;
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
      const dept = url.searchParams.get("dept") || "steam";
      const grade = url.searchParams.get("grade");
      const type = url.searchParams.get("type") || "student";
      const index = await kv.get("meta:index", "json") || [];
      const filtered = index.filter(e =>
        (e.dept || "steam") === dept &&
        (!grade || e.grade === grade) &&
        e.type === type
      );
      const results = [];
      for (const e of filtered) { const r = await kv.get(`r:${e.id}`, "json"); if (r) results.push(r); }
      return json({ count: results.length, results, aggregated: aggregateResults(results) });
    }

    // ── GET /api/export ──
    if (subPath === "/export") {
      if (checkAuth(url, request.headers) !== ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);
      const dept = url.searchParams.get("dept") || "steam";
      const index = await kv.get("meta:index", "json") || [];
      const results = [];
      for (const e of index) {
        if ((e.dept || "steam") !== dept) continue;
        const r = await kv.get(`r:${e.id}`, "json");
        if (r) results.push(r);
      }

      const deptLabel = DEPT_LABELS[dept] || dept;
      let header = "學科,年級,班別,類型,教師代號,總人數,提交時間";
      for (let i = 1; i <= 5; i++) {
        header += `,Q${i}-5分,Q${i}-4分,Q${i}-3分,Q${i}-2分,Q${i}-1分,Q${i}-平均分`;
      }
      const rows = [header];
      for (const r of results) {
        const row = [
          DEPT_LABELS[r.dept || "steam"],
          r.grade, r.className, r.type === "student" ? "學生" : "教師", r.teacherCode || "", r.totalStudents || "", r.timestamp
        ];
        for (let i = 1; i <= 5; i++) {
          const qd = r.questions?.[`Q${i}`] || {};
          row.push(qd[5] || 0, qd[4] || 0, qd[3] || 0, qd[2] || 0, qd[1] || 0);
          let sum = 0, cnt = 0;
          for (let s = 1; s <= 5; s++) { const n = Number(qd[s]) || 0; sum += s * n; cnt += n; }
          row.push(cnt > 0 ? (sum / cnt).toFixed(2) : "");
        }
        rows.push(row.join(","));
      }
      return new Response("\uFEFF" + rows.join("\n"), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${dept}_survey_results.csv"`, "Access-Control-Allow-Origin": "*" },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
