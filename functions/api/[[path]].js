/**
 * Cloudflare Pages Function — /api/*
 * 問卷調查系統 v7 — 多學科（STEAM科 + 科學科 + AI發展組）
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
      P5: ["「AI中華文化翻譯官」讓我學到自然語言處理","第一學段的「AI基礎課程」幫助我懂得正確使用 AI","「狐假虎威」四格漫畫創作讓我更有創意","「八大行星」互動導覽讓我學到更多天文知識","STEAM DAY 活動讓我對環保有更深認識"],
      P6: ["「識花君」AI 植物百科讓我對生物多樣性更感興趣","騰訊專題研習提升了我的科技應用能力（只適用於6A及6C）","「一帶一路」互動地圖幫助我了解中國地理","第一學段的「AI基礎課程」幫助我懂得正確使用 AI","AI 幫助我探索未來的職業方向"]
    },
    teacher: ["STEAM 科課程有效提升學生的運算思維","騰訊 AI 平台適合用於課堂教學","STEAM DAY 活動有助學生理解科技與環保的關係","跨科整合能有效提升學生的學習動機","現有課程安排和資源足以支援教學需要"]
  },
  science: {
    student: {
      P1: ["科學課的觀察和探究活動（如 AI Garden 觀察動植物、探究植物生長需要水和空氣）讓我對生物充滿好奇","科學課的感官探究活動（如測試不同味道、探索感覺器官的功能）幫助我認識自己的身體","科學課的實驗活動（如比較水與洗手液的特性、探究水和空氣的性質）讓我學到科學知識","Magic Science 探究活動（如用環保物料製作「DIY 吉他」、認識聲音和振動）讓我學會動手設計和製作","Magic Science 探究活動（如製作「家務助理機械人」）讓我認識簡易的能量轉換"],
      P4: ["科學課的探究活動（如岩石探究、AI Garden 生態觀察）讓我學到地球科學和生態知識","科學課的實驗和觀察（如植物繁殖觀察、傳染病預防探究）幫助我理解生物和健康知識","科學課的實作活動（如搭建閉合電路、GIGO 太陽能車實驗）讓我認識電學和能源轉換","Magic Science 探究活動（如設計製作「文件夾面罩」）讓我了解物料特性和科學探究方法","Magic Science 探究活動（如製作「芭蕉扇」並結合《西遊記》閱讀）讓我學會公平測試和科學探究"]
    },
    teacher: ["MAGIC SCIENCE 探究課程有效提升學生的科學探究能力","動手做實驗有助學生理解科學概念","跨科協作（STEAM DAY）能有效提升學生的學習動機","PSCG 課程框架適合本校學生的學習需要","現有課程安排和實驗資源足以支援教學需要"]
  },
  ai: {
    student: {},
    teacher: ["2 月 6 日教師 AI 工作坊（如 Gemini、AnyGen、NotebookLM、Canva）提升了我的 AI 教學與行政能力","AI 工具能幫助我在課堂教學中提升教學效能","啟發潛能課的多元化活動安排有效發展學生的多元潛能（只適用於負責老師，其他老師可選「不適用」）","AI 發展組的整體活動規劃（如教師工作坊、啟發潛能課、STEAM DAY）有效推動學校 AI 教育發展","現有 AI 教學資源和支援足以滿足教學需要"],
    naApplicable: [2]
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
  ],
  ai: [
    {code:"許",name:"許敏詩"},{code:"張",name:"張慧文"},{code:"瑞",name:"林瑞芳"},{code:"勞",name:"勞惠嫻"},
    {code:"蕭",name:"蕭蕙欣"},{code:"林",name:"林美玲"},{code:"馮",name:"馮祉禧"},{code:"梁",name:"梁建華"},
    {code:"高",name:"高健倫"},{code:"龔",name:"龔凱凝"},{code:"蓓",name:"黃蓓琪"},{code:"儀",name:"陳婉儀"},
    {code:"睿",name:"吳永睿"},{code:"珞",name:"黃偉珞"},{code:"鋒",name:"楊錦鋒"},{code:"美",name:"林美玲"},
    {code:"明",name:"高俊明"},{code:"楚",name:"張楚雯"},{code:"秋",name:"任秋彤"},{code:"映",name:"卓映彤"},
    {code:"楊",name:"楊惠娟"},{code:"天",name:"李天恩"},{code:"軍",name:"李軍"},{code:"鑫",name:"蔡貴鑫"},
    {code:"雅",name:"郭瑩雅"},{code:"玟",name:"李玟欣"},{code:"雪",name:"陳雪儀"},{code:"卿",name:"潘美卿"},
    {code:"梓",name:"伍梓耀"},{code:"晴",name:"范茵晴"},{code:"慧",name:"黃慧玲"},{code:"鄺",name:"鄺家宜"},
    {code:"淑",name:"凌淑佩"},{code:"秀",name:"李立秀"},{code:"嘉",name:"黃嘉慧"},{code:"施",name:"陳仲施"},
    {code:"偉",name:"黃博偉"},{code:"琳",name:"霍曉琳"},{code:"婷",name:"鍾詩婷"},{code:"鳳",name:"何美鳳"},
    {code:"敏",name:"黃思敏"},{code:"艷",name:"李艷歡"},{code:"荃",name:"陳佩荃"},{code:"珊",name:"蔡曉珊"},
    {code:"蘇",name:"蘇美靜"},{code:"于",name:"任于敏"},{code:"香",name:"香寶媛"},{code:"鄧",name:"鄧思義"},
  ]
};

const DEPT_LABELS = { steam: "STEAM 科", science: "科學科", ai: "AI 發展組" };

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
        naCount: items.reduce((n, item) => n + (Number(item.questions?.[`Q${q+1}`]?.N) || 0), 0),
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
      naCount: results.reduce((n, r) => n + (Number(r.questions?.[`Q${q+1}`]?.N) || 0), 0),
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

    // ── GET /api/completed?dept=steam&type=student ──
    if (subPath === "/completed") {
      const dept = url.searchParams.get("dept") || "steam";
      const type = url.searchParams.get("type") || "student";
      const index = await kv.get("meta:index", "json") || [];
      const done = index
        .filter(e => (e.dept || "steam") === dept && e.type === type)
        .map(e => type === "teacher" ? e.teacherCode : `${e.grade}_${e.className}`);
      return json([...new Set(done)]);
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

      // Duplicate check
      const index = await kv.get("meta:index", "json") || [];
      const d = dept || "steam";
      if (type === "teacher") {
        const exists = index.find(e => (e.dept || "steam") === d && e.type === "teacher" && e.teacherCode === teacherCode);
        if (exists) return json({ error: "此教師代號已完成填寫，不能重複提交" }, 409);
      } else {
        const exists = index.find(e => (e.dept || "steam") === d && e.type === "student" && e.grade === grade && e.className === className);
        if (exists) return json({ error: "此班別已完成填寫，不能重複提交" }, 409);
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
        header += `,Q${i}-5分,Q${i}-4分,Q${i}-3分,Q${i}-2分,Q${i}-1分,Q${i}-不適用,Q${i}-平均分`;
      }
      const rows = [header];
      for (const r of results) {
        const row = [
          DEPT_LABELS[r.dept || "steam"],
          r.grade, r.className, r.type === "student" ? "學生" : "教師", r.teacherCode || "", r.totalStudents || "", r.timestamp
        ];
        for (let i = 1; i <= 5; i++) {
          const qd = r.questions?.[`Q${i}`] || {};
          row.push(qd[5] || 0, qd[4] || 0, qd[3] || 0, qd[2] || 0, qd[1] || 0, qd.N || 0);
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
