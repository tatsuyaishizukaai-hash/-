import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============================================================
   サブスク電卓 — 毎月の固定費をぜんぶ足して、先月と見くらべる
   ============================================================ */

const KEY_V2 = "subsapp:v2";
const KEY_V1 = "subsapp:v1";
const PRICE_ASOF = "2026年9月時点";

/* ---------- 日付 ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const ymKey = (y, m) => `${y}-${pad2(m)}`;
const parseYM = (s) => {
  const [y, m] = String(s).split("-").map(Number);
  return { y, m };
};
const addMonths = (ym, d) => {
  const { y, m } = parseYM(ym);
  const t = y * 12 + (m - 1) + d;
  return ymKey(Math.floor(t / 12), (t % 12) + 1);
};
const monthDiff = (a, b) => {
  const A = parseYM(a), B = parseYM(b);
  return B.y * 12 + B.m - (A.y * 12 + A.m);
};
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const countWeekday = (y, m, wd) => {
  const dim = daysInMonth(y, m);
  let c = 0;
  for (let d = 1; d <= dim; d++) if (new Date(y, m - 1, d).getDay() === wd) c++;
  return c;
};
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const num = (n) => Math.round(n).toLocaleString("ja-JP");
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + "¥" + num(Math.abs(n));
const todayYM = () => {
  const d = new Date();
  return ymKey(d.getFullYear(), d.getMonth() + 1);
};
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const noMotion = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/* 数字が転がって切り替わる（電卓らしさ） */
function useCountUp(value, ms = 420) {
  const [n, setN] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    if (noMotion() || from.current === value) {
      from.current = value; setN(value); return;
    }
    const a = from.current, b = value, start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const v = a + (b - a) * (1 - Math.pow(1 - p, 3));
      from.current = v; setN(v);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, ms]);
  return n;
}

const CYCLES = {
  monthly: { label: "毎月", months: 1 },
  yearly: { label: "年に1回", months: 12 },
  half: { label: "半年に1回", months: 6 },
  quarterly: { label: "3か月に1回", months: 3 },
  weekly: { label: "毎週", months: 0 },
};

const CATEGORIES = ["動画", "音楽", "ソフト", "AI", "ゲーム", "本・マンガ", "通信", "住まい", "保険", "健康", "交通", "その他"];
const CAT_COLOR = {
  "動画": "#F2A0A0", "音楽": "#F8C68C", "ソフト": "#9FC4EC", "AI": "#C3AEEC",
  "ゲーム": "#98D9B8", "本・マンガ": "#F4AECC", "通信": "#96D8DE", "住まい": "#EBCB93",
  "保険": "#AEB9E4", "健康": "#BFDF9B", "交通": "#DCC4A3", "その他": "#C6CBD4",
};
const USE_LEVELS = { often: "よく使う", sometimes: "たまに", never: "使ってない", unset: "未評価" };

/* ---------- プリセット（2026年9月時点の目安・税込） ---------- */
const P = (n, a, c, cat, note) => ({ n, a, c, cat, note });
const PRESETS = [
  /* 動画 */
  P("Netflix 広告つきスタンダード", 890, "monthly", "動画"),
  P("Netflix スタンダード", 1590, "monthly", "動画"),
  P("Netflix プレミアム", 2290, "monthly", "動画"),
  P("Amazonプライム（月払い）", 600, "monthly", "動画"),
  P("Amazonプライム（年払い）", 5900, "yearly", "動画"),
  P("Disney+ スタンダード", 1250, "monthly", "動画", "2026年3月に1,140円から改定"),
  P("Disney+ プレミアム", 1670, "monthly", "動画", "2026年3月に1,520円から改定"),
  P("dアニメストア（Web・店頭で契約）", 660, "monthly", "動画", "2026年2月に550円から改定"),
  P("dアニメストア（App Store・Google Play経由）", 760, "monthly", "動画", "アプリ経由は手数料の分だけ高い"),
  P("U-NEXT", 2189, "monthly", "動画"),
  P("Hulu", 1026, "monthly", "動画", "2026年10月1日から1,320円に改定"),
  P("Hulu（アプリ内課金）", 1450, "monthly", "動画", "2026年10月1日から。Web契約より高い"),
  P("DAZN Standard", 4200, "monthly", "動画"),
  P("ABEMAプレミアム", 1180, "monthly", "動画", "2026年4月に1,080円から改定"),
  P("広告つきABEMAプレミアム", 680, "monthly", "動画", "2026年4月に580円から改定"),
  P("DMM TV", 550, "monthly", "動画"),
  P("Lemino プレミアム", 990, "monthly", "動画"),
  P("Apple TV", 900, "monthly", "動画"),

  /* 音楽 */
  P("Spotify Premium 個人", 1080, "monthly", "音楽"),
  P("Apple Music 個人", 1180, "monthly", "音楽", "2026年7月に1,080円から改定"),
  P("Amazon Music Unlimited", 1080, "monthly", "音楽", "プライム会員価格。2026年に980円から改定"),
  P("YouTube Premium 個人", 1280, "monthly", "音楽", "iPhoneアプリ経由だと高くなる"),
  P("YouTube Premium 年間プラン", 12800, "yearly", "音楽", "月あたり約1,067円"),
  P("YouTube Premium Lite", 780, "monthly", "音楽", "音楽は対象外"),
  P("LINE MUSIC 個人", 1080, "monthly", "音楽"),

  /* ソフト・クラウド */
  P("iCloud+ 50GB", 130, "monthly", "ソフト"),
  P("iCloud+ 200GB", 400, "monthly", "ソフト"),
  P("iCloud+ 2TB", 1300, "monthly", "ソフト"),
  P("Google One 100GB", 290, "monthly", "ソフト"),
  P("Google One 2TB", 1300, "monthly", "ソフト"),
  P("Dropbox Plus", 1500, "monthly", "ソフト"),
  P("Microsoft 365 Personal", 1490, "monthly", "ソフト"),
  P("Adobe Creative Cloud コンプリート", 7780, "monthly", "ソフト"),
  P("Notion プラス", 1650, "monthly", "ソフト"),
  P("1Password 個人", 450, "monthly", "ソフト"),

  /* AI */
  P("ChatGPT Plus", 3000, "monthly", "AI", "ドル建てなので為替で変わる"),
  P("Claude Pro", 3000, "monthly", "AI", "ドル建てなので為替で変わる"),
  P("Google AI Pro", 2900, "monthly", "AI"),
  P("GitHub Copilot Pro", 1500, "monthly", "AI", "ドル建てなので為替で変わる"),

  /* ゲーム */
  P("Nintendo Switch Online 個人（年）", 2400, "yearly", "ゲーム"),
  P("PlayStation Plus エッセンシャル", 850, "monthly", "ゲーム"),
  P("Xbox Game Pass Ultimate", 1300, "monthly", "ゲーム"),
  P("Apple Arcade", 900, "monthly", "ゲーム"),

  /* 本・マンガ */
  P("Kindle Unlimited", 980, "monthly", "本・マンガ"),
  P("Audible", 1500, "monthly", "本・マンガ"),
  P("少年ジャンプ+ 定期購読", 980, "monthly", "本・マンガ"),

  /* 自分の金額を入れるもの */
  P("スマホ代", null, "monthly", "通信"),
  P("光回線", null, "monthly", "通信"),
  P("NHK受信料（2か月ごと）", null, "quarterly", "通信"),
  P("家賃", null, "monthly", "住まい"),
  P("電気代", null, "monthly", "住まい"),
  P("ガス代", null, "monthly", "住まい"),
  P("水道代（2か月ごと）", null, "quarterly", "住まい"),
  P("管理費・町内会費", null, "monthly", "住まい"),
  P("生命保険", null, "monthly", "保険"),
  P("自動車保険（年払い）", null, "yearly", "保険"),
  P("ジム会費", null, "monthly", "健康"),
  P("サプリ定期便", null, "monthly", "健康"),
  P("通勤定期（6か月）", null, "half", "交通"),
  P("駐車場代", null, "monthly", "交通"),
];

/* ---------- レコード ---------- */
function mk(name, amount, cycle, category, extra = {}) {
  const start = extra.startYM || todayYM();
  const { rates, ...rest } = extra;
  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    cycle,
    category,
    rates: rates || [{ fromYM: start, amount: Number(amount) || 0 }],
    billingDay: 1,
    billingWeekday: 1,
    anchorMonth: parseYM(start).m,
    startYM: start,
    endYM: null,
    note: "",
    useLevel: "unset",
    ...rest,
  };
}

const sortedRates = (sub) => {
  const rs = sub.rates && sub.rates.length ? sub.rates : [{ fromYM: sub.startYM, amount: sub.amount || 0 }];
  return [...rs].sort((a, b) => (a.fromYM < b.fromYM ? -1 : 1));
};
function amountAt(sub, ym) {
  const rs = sortedRates(sub);
  let v = rs[0].amount;
  for (const r of rs) if (monthDiff(r.fromYM, ym) >= 0) v = r.amount;
  return Number(v) || 0;
}
const currentAmount = (sub) => Number(sortedRates(sub).slice(-1)[0].amount) || 0;

function isActive(sub, ym) {
  if (sub.startYM && monthDiff(sub.startYM, ym) < 0) return false;
  if (sub.endYM && monthDiff(sub.endYM, ym) > 0) return false;
  return true;
}
function chargeIn(sub, ym, mode) {
  if (!isActive(sub, ym)) return 0;
  const { y, m } = parseYM(ym);
  const a = amountAt(sub, ym);
  if (mode === "even") {
    if (sub.cycle === "weekly") return (a * daysInMonth(y, m)) / 7;
    return a / (CYCLES[sub.cycle]?.months || 1);
  }
  if (sub.cycle === "monthly") return a;
  if (sub.cycle === "weekly") return a * countWeekday(y, m, sub.billingWeekday ?? 1);
  const per = CYCLES[sub.cycle]?.months || 1;
  const anchor = sub.anchorMonth || parseYM(sub.startYM).m;
  return (((m - anchor) % per) + per) % per === 0 ? a : 0;
}
function yearlyCost(sub) {
  const a = currentAmount(sub);
  if (sub.cycle === "weekly") return (a * 365) / 7;
  return (a * 12) / (CYCLES[sub.cycle]?.months || 1);
}
function billingLabel(sub) {
  if (sub.cycle === "weekly") return `毎週${WEEKDAYS[sub.billingWeekday ?? 1]}曜`;
  if (sub.cycle === "monthly") return `毎月${sub.billingDay}日`;
  const anchor = sub.anchorMonth || parseYM(sub.startYM).m;
  return `${CYCLES[sub.cycle].label}・${anchor}月${sub.billingDay}日ごろ`;
}
const migrate = (s) =>
  s.rates ? s : { ...s, rates: [{ fromYM: s.startYM || todayYM(), amount: Number(s.amount) || 0 }] };

const SAMPLE = () => [
  mk("Netflix スタンダード", 1590, "monthly", "動画", { billingDay: 15, startYM: addMonths(todayYM(), -14), useLevel: "often" }),
  mk("Spotify Premium 個人", 1080, "monthly", "音楽", { billingDay: 3, startYM: addMonths(todayYM(), -20), useLevel: "often" }),
  mk("dアニメストア（App Store・Google Play経由）", 760, "monthly", "動画", {
    billingDay: 5, startYM: addMonths(todayYM(), -18), useLevel: "often",
    rates: [{ fromYM: addMonths(todayYM(), -18), amount: 650 }, { fromYM: "2026-02", amount: 760 }],
  }),
  mk("Adobe Creative Cloud コンプリート", 7780, "monthly", "ソフト", { billingDay: 22, startYM: addMonths(todayYM(), -6), useLevel: "sometimes" }),
  mk("iCloud+ 200GB", 400, "monthly", "ソフト", { billingDay: 8, startYM: addMonths(todayYM(), -30), useLevel: "often" }),
  mk("Amazonプライム（年払い）", 5900, "yearly", "動画", { billingDay: 10, anchorMonth: parseYM(todayYM()).m, startYM: addMonths(todayYM(), -24), useLevel: "often" }),
  mk("ジム会費", 8000, "monthly", "健康", { billingDay: 27, startYM: addMonths(todayYM(), -9), useLevel: "never" }),
  mk("ChatGPT Plus", 3000, "monthly", "AI", { billingDay: 1, startYM: addMonths(todayYM(), -2), useLevel: "often" }),
];

/* ============================================================ */
function SubsPage() {
  const [subs, setSubs] = useState([]);
  const [mode, setMode] = useState("actual");
  const [ym, setYm] = useState(todayYM());
  const [tab, setTab] = useState("detail");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [dataPane, setDataPane] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [dir, setDir] = useState(1);
  const [flashId, setFlashId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let v = null;
      try { const r = await window.storage.get(KEY_V2); v = r ? JSON.parse(r.value) : null; } catch (e) {}
      if (!v) { try { const r = await window.storage.get(KEY_V1); v = r ? JSON.parse(r.value) : null; } catch (e) {} }
      if (alive && v) {
        setSubs((Array.isArray(v.subs) ? v.subs : []).map(migrate));
        if (v.mode) setMode(v.mode);
      }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(KEY_V2, JSON.stringify({ subs, mode }));
        setSaveError(false);
      } catch (e) { setSaveError(true); }
    })();
  }, [subs, mode, loaded]);

  const totalOf = (t) => subs.reduce((s, x) => s + chargeIn(x, t, mode), 0);
  const cur = useMemo(() => totalOf(ym), [subs, ym, mode]);
  const prevYM = addMonths(ym, -1);
  const prev = useMemo(() => totalOf(prevYM), [subs, ym, mode]);
  const diff = cur - prev;
  const series = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonths(ym, i - 11)).map((k) => ({ ym: k, total: totalOf(k) })),
    [subs, ym, mode]
  );
  const next12 = useMemo(
    () => Array.from({ length: 12 }, (_, i) => totalOf(addMonths(ym, i))).reduce((a, b) => a + b, 0),
    [subs, ym, mode]
  );
  const rows = useMemo(() => {
    const l = subs.filter((s) => isActive(s, ym)).map((s) => ({ sub: s, amount: chargeIn(s, ym, mode) }));
    l.sort((a, b) => (b.amount > 0) !== (a.amount > 0) ? b.amount - a.amount : (a.sub.billingDay || 0) - (b.sub.billingDay || 0));
    return l;
  }, [subs, ym, mode]);

  const { y: sy, m: sm } = parseYM(ym);
  const isThisMonth = ym === todayYM();
  const today = new Date().getDate();
  const remaining = isThisMonth
    ? rows.filter((r) => r.amount > 0 && (r.sub.cycle === "weekly" || r.sub.billingDay >= today)).reduce((s, r) => s + r.amount, 0)
    : null;

  const jump = (t) => { setDir(monthDiff(ym, t) >= 0 ? 1 : -1); setYm(t); };
  const upsert = (sub) => {
    setSubs((o) => (o.some((s) => s.id === sub.id) ? o.map((s) => (s.id === sub.id ? sub : s)) : [...o, sub]));
    setEditing(null);
    setFlashId(sub.id);
    setTimeout(() => setFlashId((v) => (v === sub.id ? null : v)), 1400);
  };
  const remove = (id) => { setSubs((o) => o.filter((s) => s.id !== id)); setEditing(null); };
  const startNew = (preset) => {
    setAdding(false);
    if (!preset) { setEditing(mk("", 0, "monthly", "その他", { startYM: ym })); return; }
    setEditing(mk(preset.n, preset.a ?? 0, preset.c, preset.cat, { startYM: ym, anchorMonth: parseYM(ym).m, note: preset.note || "" }));
  };

  return (
    <div className="sc">
      {/* ══ 本体 ══ */}
      <div className="case">
        <div className="case-top">
          <span className="brand">サブスク電卓</span>
          <button className="chip" onClick={() => setDataPane(true)}>データ</button>
        </div>

        <div className="lcd">
          <div className="lcd-row">
            <button className="nav" onClick={() => jump(addMonths(ym, -1))} aria-label="前の月">◀</button>
            <span className={"lcd-ym " + (dir > 0 ? "dr" : "dl")} key={ym}>{sy}<i>年</i>{sm}<i>月</i></span>
            <button className="nav" onClick={() => jump(addMonths(ym, 1))} aria-label="次の月">▶</button>
          </div>

          <Rolling value={cur} className="lcd-total" />

          <div className="lcd-diff">
            <span className={"badge " + (diff > 0 ? "up" : diff < 0 ? "down" : "flat")}>
              {signed(diff)}
            </span>
            <span className="lcd-small">
              先月 {yen(prev)}
              {prev > 0 && diff !== 0 ? `（${diff > 0 ? "+" : "−"}${Math.abs((diff / prev) * 100).toFixed(1)}%）` : ""}
            </span>
          </div>

          <div className="spark">
            {series.map((s, i) => {
              const max = Math.max(...series.map((x) => x.total), 1);
              const on = s.ym === ym;
              const future = monthDiff(todayYM(), s.ym) > 0;
              return (
                <button key={s.ym} className={"sp" + (on ? " on" : "") + (future ? " fu" : "")}
                  onClick={() => jump(s.ym)} aria-label={`${parseYM(s.ym).m}月 ${yen(s.total)}`}>
                  <span style={{ height: Math.max(3, (s.total / max) * 100) + "%", transitionDelay: i * 16 + "ms" }} />
                  <em>{parseYM(s.ym).m}</em>
                </button>
              );
            })}
          </div>

          <div className="lcd-foot">
            <span>1日あたり {yen(cur / daysInMonth(sy, sm))}</span>
            <span>{remaining !== null ? `今月の残り ${yen(remaining)}` : `この先1年 ${yen(next12)}`}</span>
          </div>
        </div>

        <div className="keys2">
          <button className={"k sm dark " + (mode === "actual" ? "sel" : "")} onClick={() => setMode("actual")}>実際の請求</button>
          <button className={"k sm dark " + (mode === "even" ? "sel" : "")} onClick={() => setMode("even")}>年払いをならす</button>
          {!isThisMonth && <button className="k sm now" onClick={() => jump(todayYM())}>今月</button>}
        </div>
      </div>

      {/* ══ 一覧 ══ */}
      {subs.length === 0 ? (
        <Empty onAdd={() => setAdding(true)} onSample={() => setSubs(SAMPLE())} />
      ) : (
        <>
          <div className="tabs">
            {[["detail", "明細"], ["change", "先月との差"], ["review", "見直し"]].map(([k, l]) => (
              <button key={k} className={"k tab " + (tab === k ? "k-on" : "")} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {tab === "detail" && <Detail key={"d" + ym} rows={rows} total={cur} isThisMonth={isThisMonth} today={today} mode={mode} flashId={flashId} onEdit={setEditing} />}
          {tab === "change" && <Change key={"c" + ym} subs={subs} ym={ym} prevYM={prevYM} mode={mode} diff={diff} onEdit={setEditing} />}
          {tab === "review" && <Review key="r" subs={subs} ym={ym} onEdit={setEditing} />}

          <button className="k k-add" onClick={() => setAdding(true)}>
            <span className="plus">＋</span> サービスを追加する
          </button>
        </>
      )}

      {saveError && <p className="warn">保存できませんでした。閉じると内容が消えるので「データ」から書き出してください。</p>}

      {adding && <AddSheet onPick={startNew} onClose={() => setAdding(false)} />}
      {editing && <Editor sub={editing} onSave={upsert} onDelete={remove} onClose={() => setEditing(null)} />}
      {dataPane && <DataPane subs={subs} onImport={(v) => setSubs(v.map(migrate))} onClose={() => setDataPane(false)} />}
    </div>
  );
}

/* ---------- 転がる数字 ---------- */
function Rolling({ value, className, prefix = "¥" }) {
  const n = useCountUp(value);
  return <div className={className}>{prefix}{num(n)}</div>;
}

/* ---------- 明細 ---------- */
function Detail({ rows, total, isThisMonth, today, mode, flashId, onEdit }) {
  const paid = rows.filter((r) => r.amount > 0);
  const rest = rows.filter((r) => r.amount === 0);
  const totalN = useCountUp(total);
  return (
    <section className="list">
      {paid.map(({ sub, amount }, i) => {
        const done = isThisMonth && sub.cycle !== "weekly" && sub.billingDay < today;
        return (
          <button key={sub.id} style={{ animationDelay: Math.min(i, 12) * 26 + "ms" }}
            className={"item pop" + (done ? " done" : "") + (flashId === sub.id ? " flash" : "")}
            onClick={() => onEdit(sub)}>
            <span className="dot" style={{ background: CAT_COLOR[sub.category] || "#6F7680" }} />
            <span className="item-main">
              <b>{sub.name || "（名称なし）"}</b>
              <small>{billingLabel(sub)}{done ? " ・支払い済み" : ""}</small>
            </span>
            <span className="item-yen">{yen(amount)}</span>
          </button>
        );
      })}
      <div className="total-line">
        <span>合計</span><span>¥{num(totalN)}</span>
      </div>

      {rest.length > 0 && (
        <>
          <h3 className="sub">今月は請求なし（契約は続いている）</h3>
          {rest.map(({ sub }, i) => (
            <button key={sub.id} style={{ animationDelay: 120 + i * 26 + "ms" }}
              className={"item ghost pop" + (flashId === sub.id ? " flash" : "")} onClick={() => onEdit(sub)}>
              <span className="dot" style={{ background: CAT_COLOR[sub.category] || "#6F7680" }} />
              <span className="item-main">
                <b>{sub.name}</b>
                <small>{billingLabel(sub)} ／ 1年で {yen(yearlyCost(sub))}</small>
              </span>
              <span className="item-yen">—</span>
            </button>
          ))}
        </>
      )}
      {mode === "even" && <p className="hint">年払い・半年払いを12か月で割った金額を表示中。</p>}
    </section>
  );
}

/* ---------- 先月との差 ---------- */
function Change({ subs, ym, prevYM, mode, diff, onEdit }) {
  const items = subs.map((s) => {
    const a = chargeIn(s, ym, mode), b = chargeIn(s, prevYM, mode);
    let reason = "";
    if (a > 0 && b === 0 && !isActive(s, prevYM)) reason = "今月から開始";
    else if (a === 0 && b > 0 && !isActive(s, ym)) reason = "解約した";
    else if (amountAt(s, ym) !== amountAt(s, prevYM) && a > 0 && b > 0)
      reason = amountAt(s, ym) > amountAt(s, prevYM) ? "値上げ" : "値下げ";
    else if (a > 0 && b === 0) reason = "今月が請求月";
    else if (a === 0 && b > 0) reason = "先月が請求月";
    else if (a !== b) reason = "請求回数の違い";
    return { sub: s, d: a - b, reason };
  }).filter((x) => Math.abs(x.d) >= 1).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const diffN = useCountUp(diff);

  return (
    <section className="list">
      <div className="bigdiff">
        <span>{parseYM(prevYM).m}月 → {parseYM(ym).m}月</span>
        <b className={diff > 0 ? "up-t" : diff < 0 ? "down-t" : ""}>{signed(diffN)}</b>
      </div>
      {items.length === 0 ? (
        <p className="hint big-hint">先月とまったく同じ内容です。</p>
      ) : items.map(({ sub, d, reason }, i) => (
        <button key={sub.id} className="item pop" style={{ animationDelay: Math.min(i, 12) * 30 + "ms" }} onClick={() => onEdit(sub)}>
          <span className={"tagpill " + (d > 0 ? "up" : "down")}>{reason}</span>
          <span className="item-main"><b>{sub.name}</b></span>
          <span className={"item-yen " + (d > 0 ? "up-t" : "down-t")}>{signed(d)}</span>
        </button>
      ))}
    </section>
  );
}

/* ---------- 見直し ---------- */
function Review({ subs, ym, onEdit }) {
  const live = subs.filter((s) => isActive(s, ym));
  const ranked = [...live].sort((a, b) => yearlyCost(b) - yearlyCost(a));
  const wasted = live.filter((s) => s.useLevel === "never");
  const wastedYen = wasted.reduce((s, x) => s + yearlyCost(x), 0);
  const byCat = {};
  live.forEach((s) => { byCat[s.category] = (byCat[s.category] || 0) + yearlyCost(s) / 12; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(...cats.map((c) => c[1]), 1);

  return (
    <section className="list">
      {wasted.length > 0 && (
        <div className="alert">
          「使ってない」が{wasted.length}件。やめると1年で <b>{yen(wastedYen)}</b> 残ります。
        </div>
      )}
      <h3 className="sub">1年あたりの負担が大きい順</h3>
      {ranked.map((s, i) => (
        <button key={s.id} className="item pop" style={{ animationDelay: Math.min(i, 12) * 26 + "ms" }} onClick={() => onEdit(s)}>
          <span className="dot" style={{ background: CAT_COLOR[s.category] || "#6F7680" }} />
          <span className="item-main">
            <b>{s.name}</b>
            <small>{USE_LEVELS[s.useLevel || "unset"]} ・ {billingLabel(s)}</small>
          </span>
          <span className="item-yen">{yen(yearlyCost(s))}<i>／年</i></span>
        </button>
      ))}
      <h3 className="sub">カテゴリ別（月あたり）</h3>
      {cats.map(([c, v], i) => (
        <div key={c} className="catrow">
          <span className="catname">{c}</span>
          <span className="catbar"><span className="grow" style={{ width: (v / catMax) * 100 + "%", background: CAT_COLOR[c] || "#6F7680", animationDelay: i * 60 + "ms" }} /></span>
          <span className="item-yen">{yen(v)}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------- 追加シート ---------- */
function AddSheet({ onPick, onClose }) {
  const [q, setQ] = useState("");
  const list = PRESETS.filter((p) => p.n.toLowerCase().includes(q.toLowerCase()) || p.cat.includes(q));
  const grouped = {};
  list.forEach((p) => { (grouped[p.cat] ||= []).push(p); });

  return (
    <Sheet title="サービスを追加する" onClose={onClose}>
      <button className="k k-add own" onClick={() => onPick(null)}>
        <span className="plus">＋</span> 一覧にない　自分で入力する
      </button>
      <input className="fld search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="サービス名で探す" />
      <p className="hint">
        金額は{PRICE_ASOF}の目安です。プランや契約経路（Web／アプリ）で変わるので、
        選んだあとに<b>自分の請求額に直してください</b>。
      </p>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="sub"><span className="dot" style={{ background: CAT_COLOR[cat] }} />{cat}</h3>
          {items.map((p) => (
            <button key={p.n} className="item" onClick={() => onPick(p)}>
              <span className="item-main">
                <b>{p.n}</b>
                <small>{CYCLES[p.c].label}{p.note ? " ・" + p.note : ""}</small>
              </span>
              <span className={"item-yen" + (p.a === null ? " faint" : "")}>{p.a === null ? "自分で入力" : yen(p.a)}</span>
            </button>
          ))}
        </div>
      ))}
      {list.length === 0 && <p className="hint big-hint">見つかりません。上の「自分で入力する」から登録できます。</p>}
    </Sheet>
  );
}

/* ---------- 編集 ---------- */
function Editor({ sub, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ ...sub, rates: sortedRates(sub) });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const isNew = !sub.name;
  const ref = useRef(null);
  useEffect(() => { if (isNew && ref.current) ref.current.focus(); }, [isNew]);

  const rates = f.rates;
  const last = rates.length - 1;
  const setRate = (i, k, v) => setF((o) => ({ ...o, rates: o.rates.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addRate = () => setF((o) => ({ ...o, rates: [...o.rates, { fromYM: todayYM(), amount: o.rates[o.rates.length - 1].amount }] }));
  const delRate = (i) => setF((o) => ({ ...o, rates: o.rates.filter((_, j) => j !== i) }));

  const save = () => {
    if (!f.name.trim()) return;
    onSave({
      ...f,
      billingDay: Math.min(31, Math.max(1, Number(f.billingDay) || 1)),
      rates: [...f.rates]
        .map((r) => ({ fromYM: r.fromYM || f.startYM, amount: Number(r.amount) || 0 }))
        .sort((a, b) => (a.fromYM < b.fromYM ? -1 : 1)),
    });
  };

  return (
    <Sheet title={isNew ? "新しく登録する" : "内容を直す"} onClose={onClose}>
      <label className="row"><span>サービス名</span>
        <input ref={ref} className="fld" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="例：Netflix" />
      </label>

      <div className="row"><span>いまの金額（税込）</span>
        <div className="money">
          <input className="fld big" inputMode="numeric" value={rates[last].amount}
            onChange={(e) => setRate(last, "amount", e.target.value.replace(/[^0-9]/g, ""))} />
          <b>円</b>
        </div>
        <div className="ratefrom">
          <span>この金額になったのは</span>
          <input type="month" className="fld" value={rates[last].fromYM} onChange={(e) => setRate(last, "fromYM", e.target.value || f.startYM)} />
        </div>
      </div>

      {rates.length > 1 && (
        <div className="row"><span>それより前の金額</span>
          {rates.slice(0, last).map((r, i) => (
            <div className="ratefrom" key={i}>
              <input type="month" className="fld" value={r.fromYM} onChange={(e) => setRate(i, "fromYM", e.target.value)} />
              <input className="fld" inputMode="numeric" value={r.amount} onChange={(e) => setRate(i, "amount", e.target.value.replace(/[^0-9]/g, ""))} />
              <button className="k tiny" onClick={() => delRate(i)}>消す</button>
            </div>
          ))}
        </div>
      )}
      <button className="k k-line wide" onClick={addRate}>値上げ・値下げがあった</button>
      <p className="hint">前の金額を残しておくと、過去の月をさかのぼっても正しい金額で集計されます。</p>

      <label className="row"><span>支払いのサイクル</span>
        <select className="fld" value={f.cycle} onChange={(e) => set("cycle", e.target.value)}>
          {Object.entries(CYCLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>

      {f.cycle === "weekly" ? (
        <label className="row"><span>引き落としの曜日</span>
          <select className="fld" value={f.billingWeekday} onChange={(e) => set("billingWeekday", Number(e.target.value))}>
            {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}曜日</option>)}
          </select>
        </label>
      ) : (
        <div className="two">
          <label className="row"><span>引き落とし日</span>
            <input className="fld" inputMode="numeric" value={f.billingDay} onChange={(e) => set("billingDay", e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          {f.cycle !== "monthly" && (
            <label className="row"><span>請求のある月</span>
              <select className="fld" value={f.anchorMonth} onChange={(e) => set("anchorMonth", Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月から</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <label className="row"><span>カテゴリ</span>
        <select className="fld" value={f.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <div className="two">
        <label className="row"><span>使いはじめた月</span>
          <input type="month" className="fld" value={f.startYM} onChange={(e) => set("startYM", e.target.value || todayYM())} />
        </label>
        <label className="row"><span>やめた月（続けているなら空欄）</span>
          <input type="month" className="fld" value={f.endYM || ""} onChange={(e) => set("endYM", e.target.value || null)} />
        </label>
      </div>

      <div className="row"><span>使っている頻度</span>
        <div className="seg">
          {["often", "sometimes", "never"].map((k) => (
            <button key={k} className={"k sm " + (f.useLevel === k ? "k-on" : "")} onClick={() => set("useLevel", k)}>{USE_LEVELS[k]}</button>
          ))}
        </div>
      </div>

      <label className="row"><span>メモ</span>
        <input className="fld" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="解約の窓口、家族と共有、など" />
      </label>

      <div className="yearline">1年あたり {yen(yearlyCost({ ...f, rates: f.rates }))}</div>

      <div className="foot">
        {!isNew && <button className="k k-del" onClick={() => onDelete(f.id)}>削除</button>}
        <button className="k k-add flex" onClick={save}>保存する</button>
      </div>
    </Sheet>
  );
}

/* ---------- データ ---------- */
function DataPane({ subs, onImport, onClose }) {
  const [text, setText] = useState(JSON.stringify(subs, null, 1));
  const [msg, setMsg] = useState("");
  return (
    <Sheet title="データの持ち出し" onClose={onClose}>
      <p className="hint">この文字列をコピーしておけば、別の端末に貼りつけて元どおりにできます。</p>
      <textarea className="fld area" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="foot">
        <button className="k k-line flex" onClick={() => { navigator.clipboard?.writeText(text); setMsg("コピーしました"); }}>コピー</button>
        <button className="k k-add flex" onClick={() => {
          try {
            const v = JSON.parse(text);
            if (!Array.isArray(v)) throw new Error();
            onImport(v); setMsg("読み込みました");
          } catch { setMsg("形式が違います。全文が貼られているか確かめてください。"); }
        }}>読み込む</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </Sheet>
  );
}

function Sheet({ title, children, onClose }) {
  return (
    <div className="ov" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="k tiny" onClick={onClose}>閉じる</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ onAdd, onSample }) {
  return (
    <section className="list empty">
      <p className="empty-lead">まだ1件も入っていません。</p>
      <p className="hint">思いつくものから足していけば、来月には先月との差が出ます。</p>
      <button className="k k-add" onClick={onAdd}><span className="plus">＋</span> サービスを追加する</button>
      <button className="k k-line wide" onClick={onSample}>サンプルを入れて動きを見る</button>
    </section>
  );
}

/* ============================================================
   返済プラン — 借入先ごとに残高・金利・返済方式を入れて完済まで見る
   ============================================================ */
const LOAN_KEY = "subsapp:loans:v1";
const LOAN_ASOF = "2026年9月時点";

const ceilTo = (n, u) => Math.ceil(n / u) * u;

/* 返済方式
   rate … 残高 × 一定の割合（千円未満切上げ）。元金と利息の合計。
   step … 残高の段階ごとに決まった額。元金と利息の合計。
   fixed… 毎月これだけ、と決まった額（元利定額）。
   prin … 元金だけ定額で、利息はその上に乗る（クレカのリボに多い）。 */
const METHOD_LABEL = {
  rate: "残高スライド（定率）",
  step: "残高スライド（段階表）",
  fixed: "元利定額",
  prin: "元金定額＋手数料",
};

/* 会社ごとの返済額のきまり方（2026年9月時点で公表されているもの） */
const EPOS_STD = [
  { upTo: 50000, amt: 3000 }, { upTo: 100000, amt: 5000 }, { upTo: 200000, amt: 10000 },
  { upTo: 300000, amt: 15000 }, { upTo: 400000, amt: 18000 }, { upTo: 500000, amt: 20000 },
  { upTo: 600000, amt: 25000 }, { upTo: 700000, amt: 30000 }, { upTo: 800000, amt: 40000 },
  { upTo: Infinity, amt: 50000 },
];
const EPOS_LONG = [
  { upTo: 30000, amt: 1000 }, { upTo: 50000, amt: 2000 }, { upTo: 100000, amt: 4000 },
  { upTo: 200000, amt: 6000 }, { upTo: 300000, amt: 10000 }, { upTo: 400000, amt: 12000 },
  { upTo: 500000, amt: 15000 }, { upTo: 600000, amt: 20000 }, { upTo: 700000, amt: 25000 },
  { upTo: 800000, amt: 30000 }, { upTo: Infinity, amt: 40000 },
];
const LINE_STEP = [{ upTo: 100000, amt: 4000 }, { upTo: 200000, amt: 8000 }];

const LOAN_PRESETS = [
  { id: "mobit", g: "カードローン", name: "SMBCモビット", sub: "借入後残高スライド", apr: 18.0, method: "rate",
    tiers: [{ upTo: 300000, pct: 3.66 }, { upTo: 1000000, pct: 2.56 }, { upTo: Infinity, pct: 2.03 }],
    note: "最終借入後残高×一定の割合（千円未満切上げ）。30万円以下は3.66%、100万円以下は2.56%、200万円以下は2.03%。金利は年3.0〜18.0%。" },

  { id: "linepm", g: "カードローン", name: "LINEポケットマネー", sub: "残高スライド元利定額", apr: 15.0, method: "step",
    steps: LINE_STEP,
    note: "返済額は「最後に借りたあとの残高」と契約金利の組み合わせで決まります。公式の返済金額表は画像で、ここに入れてあるのは金利15%のとき公表されている例（10万円までなら4,000円、12万円だと8,000円）。実際の額はLINEの「次回の返済金額」を見て、返済のきまり方を元利定額にして入れ直すのが確実です。" },

  { id: "eposstd", g: "エポスカード", name: "エポス ショッピングリボ", sub: "標準コース", apr: 18.0, method: "step",
    steps: EPOS_STD,
    note: "締切日の残高で支払額が決まります（手数料込み）。5万円まで3,000円、10万円まで5,000円、20万円まで10,000円。手数料は2025年10月1日に年15.0%から18.0%へ改定され、その時点の残高すべてが18.0%になりました。" },
  { id: "eposlong", g: "エポスカード", name: "エポス ショッピングリボ", sub: "長期コース", apr: 18.0, method: "step",
    steps: EPOS_LONG,
    note: "毎月の支払いを抑えるコース。3万円まで1,000円、10万円まで4,000円、20万円まで6,000円。支払いが軽いぶん手数料の総額はいちばん大きくなります。" },
  { id: "eposfix", g: "エポスカード", name: "エポス ショッピングリボ", sub: "定額コース", apr: 18.0, method: "fixed", fixed: 5000,
    note: "残高にかかわらず毎月同じ額（手数料込み）。5,000円〜5万円は5,000円刻み、6万〜10万は1万円刻み、12万〜20万は2万円刻み。手数料が定額を超える月は手数料額の支払いになります。" },
  { id: "eposcash", g: "エポスカード", name: "エポス キャッシング", sub: "リボ・定額コース", apr: 18.0, method: "fixed", fixed: 5000,
    note: "月づき5,000円〜10万円のコースから選ぶ方式。支払額には利息が含まれます。実際のコース額を入れてください。" },

  { id: "free", g: "そのほか", name: "自分で入れる", sub: "", apr: 15.0, method: "fixed", fixed: 10000,
    note: "明細に載っている残高・金利・毎月の返済額をそのまま入れてください。" },
];

const presetById = (id) => LOAN_PRESETS.find((p) => p.id === id) || null;

/* 約定返済額（その月に最低限はらう額）。prin は元金ぶんだけを返す */
function requiredPay(loan, bal) {
  if (bal <= 0) return 0;
  if (loan.method === "rate") {
    const t = (loan.tiers || []).find((x) => bal <= x.upTo) || (loan.tiers || []).slice(-1)[0];
    if (!t) return 0;
    return Math.max(1000, ceilTo(bal * (t.pct / 100), 1000));
  }
  if (loan.method === "step") {
    const steps = loan.steps || [];
    const hit = steps.find((x) => bal <= x.upTo);
    if (hit) return hit.amt;
    const last = steps[steps.length - 1];
    if (!last) return 0;
    if (loan.over) return last.amt + Math.ceil((bal - last.upTo) / loan.over.per) * loan.over.add;
    return last.amt;
  }
  if (loan.method === "prin") {
    if (loan.prinSteps) {
      const hit = loan.prinSteps.find((x) => bal <= x.upTo);
      if (hit) return hit.amt;
    }
    return Number(loan.fixed) || 0;
  }
  return Number(loan.fixed) || 0;
}

/* 完済までを1か月ずつ積む */
function simulate(loan, startYM, opt = {}) {
  const extra = Math.max(0, Number(opt.extra ?? loan.extra) || 0);
  const bonusAmt = Math.max(0, Number(opt.bonusAmount ?? loan.bonusAmount) || 0);
  const bonusMonths = opt.bonusMonths ?? loan.bonusMonths ?? [];
  const apr = (Number(loan.apr) || 0) / 100;
  let bal = Math.max(0, Number(loan.balance) || 0);
  const fixedDue = requiredPay(loan, bal); // スライドを固定するときの基準
  const rows = [];
  let interestSum = 0;
  let stuck = false;

  for (let i = 0; i < 600 && bal > 0; i++) {
    const ym = addMonths(startYM, i);
    const { y, m } = parseYM(ym);
    const days = daysInMonth(y, m);
    const interest = Math.round(bal * apr / 365 * days);
    const due = loan.reslide ? requiredPay(loan, bal) : fixedDue;
    let pay = (loan.method === "prin" ? due + interest : due) + extra;
    if (bonusMonths.includes(m)) pay += bonusAmt;
    if (pay >= bal + interest) pay = bal + interest;
    const principal = pay - interest;
    if (principal <= 0) { stuck = true; break; }
    bal = Math.max(0, bal - principal);
    interestSum += interest;
    rows.push({ ym, y, m, pay, interest, principal, bal });
  }
  const total = rows.reduce((s, r) => s + r.pay, 0);
  return { rows, interestSum, total, months: rows.length, stuck, done: !stuck && bal <= 0, left: bal };
}

const mkLoan = (p) => ({
  id: Math.random().toString(36).slice(2, 10),
  name: p ? p.name : "借入先",
  preset: p ? p.id : "free",
  balance: 0,
  apr: p ? p.apr : 15.0,
  method: p ? p.method : "fixed",
  tiers: p ? p.tiers : undefined,
  steps: p ? p.steps : undefined,
  over: p ? p.over : undefined,
  prinSteps: p ? p.prinSteps : undefined,
  fixed: p && p.fixed ? p.fixed : 10000,
  reslide: false,
  extra: 0,
  bonusMonths: [],
  bonusAmount: 0,
  note: p ? p.note : "",
});

/* ---------- 返済プランのページ ---------- */
function LoanPage() {
  const [loans, setLoans] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("list");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [extra, setExtra] = useState(0);
  const [bonusAmt, setBonusAmt] = useState(0);
  const [bonusOn, setBonusOn] = useState([]);
  const [saveError, setSaveError] = useState(false);

  const startYM = todayYM();

  useEffect(() => {
    let alive = true;
    (async () => {
      let v = null;
      try { const r = await window.storage.get(LOAN_KEY); v = r ? JSON.parse(r.value) : null; } catch (e) {}
      if (!alive) return;
      if (v && Array.isArray(v.loans)) {
        setLoans(v.loans);
        setExtra(Number(v.extra) || 0);
        setBonusAmt(Number(v.bonusAmount) || 0);
        setBonusOn(Array.isArray(v.bonusMonths) ? v.bonusMonths : []);
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(LOAN_KEY, JSON.stringify({ loans, extra, bonusAmount: bonusAmt, bonusMonths: bonusOn }));
        setSaveError(false);
      } catch (e) { setSaveError(true); }
    })();
  }, [loans, extra, bonusAmt, bonusOn, loaded]);

  /* 素の計画（最低返済のみ）と、上乗せありの計画 */
  const base = useMemo(
    () => loans.map((l) => ({ loan: l, sim: simulate(l, startYM, { extra: 0, bonusAmount: 0, bonusMonths: [] }) })),
    [loans, startYM]
  );
  const plan = useMemo(
    () => loans.map((l) => ({ loan: l, sim: simulate(l, startYM, { extra, bonusAmount: bonusAmt, bonusMonths: bonusOn }) })),
    [loans, startYM, extra, bonusAmt, bonusOn]
  );

  const totalBal = loans.reduce((s, l) => s + (Number(l.balance) || 0), 0);
  const thisMonth = plan.reduce((s, p) => s + (p.sim.rows[0] ? p.sim.rows[0].pay : 0), 0);
  const thisInt = plan.reduce((s, p) => s + (p.sim.rows[0] ? p.sim.rows[0].interest : 0), 0);
  const anyStuck = plan.some((p) => p.sim.stuck);

  const lastYM = (list) => {
    let last = null;
    list.forEach((p) => {
      const r = p.sim.rows[p.sim.rows.length - 1];
      if (r && (!last || r.ym > last)) last = r.ym;
    });
    return last;
  };
  const endBase = lastYM(base);
  const endPlan = lastYM(plan);
  const intBase = base.reduce((s, p) => s + p.sim.interestSum, 0);
  const intPlan = plan.reduce((s, p) => s + p.sim.interestSum, 0);
  const saveMonths = endBase && endPlan ? monthDiff(endPlan, endBase) : 0;

  /* 残高の推移（全部の合計） */
  const curve = useMemo(() => {
    const n = Math.min(120, Math.max(1, ...plan.map((p) => p.sim.months)));
    const out = [];
    for (let i = 0; i < n; i++) {
      let b = 0;
      plan.forEach((p) => {
        const r = p.sim.rows[i];
        if (r) b += r.bal;
        else if (p.sim.rows.length && i >= p.sim.rows.length) b += 0;
        else b += Number(p.loan.balance) || 0;
      });
      out.push({ ym: addMonths(startYM, i), bal: b });
    }
    return out;
  }, [plan, startYM]);

  const save = (l) => {
    setLoans((prev) => (prev.some((x) => x.id === l.id) ? prev.map((x) => (x.id === l.id ? l : x)) : [...prev, l]));
    setEditing(null);
  };
  const remove = (id) => { setLoans((prev) => prev.filter((x) => x.id !== id)); setEditing(null); };

  const endLabel = (ym) => { if (!ym) return "—"; const { y, m } = parseYM(ym); return `${y}年${m}月`; };

  return (
    <div className="sc">
      <div className="case">
        <div className="case-top">
          <span className="brand">返済プラン</span>
          <span className="asof">{LOAN_ASOF}の目安</span>
        </div>

        <div className="lcd">
          <div className="lcd-row">
            <span className="lcd-small">借入残高の合計</span>
          </div>
          <Rolling value={totalBal} className="lcd-total" />
          <div className="lcd-foot">
            <span>今月の支払い {yen(thisMonth)}</span>
            <span>うち利息 {yen(thisInt)}</span>
          </div>
          <div className="lcd-foot">
            <span>完済の見込み {endLabel(endPlan)}</span>
            <span>{plan.length ? `残り${Math.max(...plan.map((p) => p.sim.months))}回` : "—"}</span>
          </div>
        </div>

        <div className="tabs">
          {[["list", "借入先"], ["table", "月々の内訳"], ["fast", "早く返す"]].map(([k, l]) => (
            <button key={k} className={"k tab " + (tab === k ? "k-on" : "")} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      {saveError && <p className="warn">保存できませんでした。書き出しから控えを取っておいてください。</p>}
      {anyStuck && <p className="warn">利息のほうが支払いより大きくて、元金が減らない借入先があります。返済額を上げるか、貸金業協会の相談窓口（0570-051-051）で相談できます。</p>}

      {!loans.length && (
        <section className="list empty">
          <p className="empty-lead">まだ1件も入っていません。</p>
          <p className="hint">明細を見ながら、残高・金利・毎月の返済額を入れると、完済までの月数と利息の総額が出ます。</p>
          <button className="k k-add" onClick={() => setAdding(true)}><span className="plus">＋</span> 借入先を追加する</button>
        </section>
      )}

      {!!loans.length && tab === "list" && (
        <section className="list">
          {plan.map(({ loan, sim }) => {
            const r0 = sim.rows[0];
            const b = base.find((x) => x.loan.id === loan.id);
            const intPct = r0 && r0.pay > 0 ? Math.round((r0.interest / r0.pay) * 100) : 0;
            return (
              <button key={loan.id} className="loan" onClick={() => setEditing(loan)}>
                <div className="loan-top">
                  <b>{loan.name}</b>
                  <span className="loan-bal">{yen(loan.balance)}</span>
                </div>
                <div className="loan-sub">
                  年{Number(loan.apr).toFixed(2).replace(/\.?0+$/, "")}%・{METHOD_LABEL[loan.method]}
                </div>
                {r0 ? (
                  <>
                    <div className="bar2" aria-hidden="true">
                      <span className="bar2-i" style={{ width: intPct + "%" }} />
                      <span className="bar2-p" style={{ width: 100 - intPct + "%" }} />
                    </div>
                    <div className="loan-row">
                      <span>今月 {yen(r0.pay)}</span>
                      <span className="i-int">利息 {yen(r0.interest)}</span>
                      <span className="i-pri">元金 {yen(r0.principal)}</span>
                    </div>
                    <div className="loan-row2">
                      <span>{sim.stuck ? "元金が減りません" : `${endLabel(sim.rows[sim.rows.length - 1].ym)}に完済（あと${sim.months}回）`}</span>
                      <span>利息 {yen(sim.interestSum)}</span>
                    </div>
                    {b && b.sim.months > sim.months && (
                      <div className="loan-win">上乗せで{b.sim.months - sim.months}か月ぶん短縮、利息{yen(b.sim.interestSum - sim.interestSum)}減</div>
                    )}
                  </>
                ) : (
                  <div className="loan-row2"><span>残高を入れると計算します</span></div>
                )}
              </button>
            );
          })}
          <button className="k k-add" onClick={() => setAdding(true)}><span className="plus">＋</span> 借入先を追加する</button>
          <p className="hint">
            残高スライドは「最後に借りたときの残高」で返済額が決まる会社が多く、返しても自動では下がりません。下げるには会社への申し出が要ります。
          </p>
        </section>
      )}

      {!!loans.length && tab === "table" && (
        <section className="list">
          <p className="sub">残高の推移</p>
          <div className="curve">
            {curve.slice(0, 60).map((c, i) => {
              const max = curve[0] ? curve[0].bal : 1;
              const h = max > 0 ? Math.max(2, Math.round((c.bal / max) * 100)) : 2;
              return (
                <div className="cv" key={c.ym} title={c.ym}>
                  <span style={{ height: h + "%" }} />
                  {i % 12 === 0 && <em>{parseYM(c.ym).y % 100}</em>}
                </div>
              );
            })}
          </div>
          <p className="hint">棒は月末の残高の合計です。目盛りは年の下2桁。</p>

          {plan.map(({ loan, sim }) => (
            <div key={loan.id} className="tblwrap">
              <p className="sub">{loan.name}</p>
              <table className="tbl">
                <thead>
                  <tr><th>月</th><th>支払い</th><th>利息</th><th>元金</th><th>残高</th></tr>
                </thead>
                <tbody>
                  {sim.rows.slice(0, 24).map((r) => (
                    <tr key={r.ym}>
                      <td>{r.m}月</td>
                      <td>{num(r.pay)}</td>
                      <td className="i-int">{num(r.interest)}</td>
                      <td className="i-pri">{num(r.principal)}</td>
                      <td>{num(r.bal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sim.rows.length > 24 && <p className="hint">このあと{sim.rows.length - 24}回つづきます。総額 {yen(sim.total)}（うち利息 {yen(sim.interestSum)}）</p>}
            </div>
          ))}
        </section>
      )}

      {!!loans.length && tab === "fast" && (
        <section className="list">
          <p className="sub">毎月の上乗せ</p>
          <div className="seg wrap">
            {[0, 3000, 5000, 10000, 20000, 30000].map((v) => (
              <button key={v} className={"k k-line" + (extra === v ? " on" : "")} onClick={() => setExtra(v)}>
                {v === 0 ? "なし" : "+" + num(v)}
              </button>
            ))}
          </div>
          <div className="row">
            <span>自分で決める</span>
            <input className="fld" type="number" inputMode="numeric" value={extra}
              onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))} />
          </div>

          <p className="sub">ボーナス払い</p>
          <div className="seg wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <button key={m} className={"k k-line sm" + (bonusOn.includes(m) ? " on" : "")}
                onClick={() => setBonusOn((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)))}>
                {m}月
              </button>
            ))}
          </div>
          <div className="row">
            <span>その月に上乗せする額</span>
            <input className="fld" type="number" inputMode="numeric" value={bonusAmt}
              onChange={(e) => setBonusAmt(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <p className="hint">上乗せぶんは、借入先が複数あるときはそれぞれに同じ額が乗ります。1社に集中させたいときは、その借入先を開いて設定してください。</p>

          <div className="bigdiff">
            <div className="bd-row"><span>最低返済だけ</span><b>{endLabel(endBase)}・利息 {yen(intBase)}</b></div>
            <div className="bd-row"><span>上乗せしたら</span><b>{endLabel(endPlan)}・利息 {yen(intPlan)}</b></div>
            <div className="bd-win">
              {saveMonths > 0 ? `${saveMonths}か月みじかく、利息が${yen(intBase - intPlan)}へる` : "上乗せするとここに差が出ます"}
            </div>
          </div>

          <p className="hint">
            利息は「残高×年利÷365×その月の日数」で日割り計算しています。実際は返済日や締め日、手数料の有無で数百円ずれます。正確な数字は各社の明細で確認してください。
          </p>
        </section>
      )}

      {adding && <LoanPicker onPick={(p) => { setAdding(false); setEditing(mkLoan(p)); }} onClose={() => setAdding(false)} />}
      {editing && <LoanEditor loan={editing} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ---------- 借入先をえらぶ ---------- */
function LoanPicker({ onPick, onClose }) {
  const groups = [];
  LOAN_PRESETS.forEach((p) => {
    let g = groups.find((x) => x.g === p.g);
    if (!g) { g = { g: p.g, items: [] }; groups.push(g); }
    g.items.push(p);
  });
  return (
    <Sheet title="借入先をえらぶ" onClose={onClose}>
      <p className="hint">えらんだあと、明細を見ながら残高と金利を直してください。</p>
      {groups.map((g) => (
        <div key={g.g}>
          <p className="sub">{g.g}</p>
          {g.items.map((p) => (
            <button key={p.id} className="pick" onClick={() => onPick(p)}>
              <b>{p.name}</b>
              <span>{p.sub}{p.sub ? "・" : ""}年{p.apr}%</span>
            </button>
          ))}
        </div>
      ))}
    </Sheet>
  );
}

/* ---------- 借入先の編集 ---------- */
function LoanEditor({ loan, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ ...loan });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const p = presetById(f.preset);
  const sim = simulate({ ...f, balance: Number(f.balance) || 0 }, todayYM(), { extra: 0, bonusAmount: 0, bonusMonths: [] });
  const r0 = sim.rows[0];
  const due = requiredPay(f, Number(f.balance) || 0);

  return (
    <Sheet title={f.name || "借入先"} onClose={onClose}>
      <div className="row">
        <span>借入先の名前</span>
        <input className="fld" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="◯◯カードローン" />
      </div>

      <div className="two">
        <div className="row">
          <span>いまの残高</span>
          <input className="fld big" type="number" inputMode="numeric" value={f.balance}
            onChange={(e) => set("balance", Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="row">
          <span>年利（%）</span>
          <input className="fld big" type="number" inputMode="decimal" step="0.01" value={f.apr}
            onChange={(e) => set("apr", Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>

      <div className="row">
        <span>返済のきまり方</span>
        <div className="seg wrap">
          {["rate", "step", "fixed", "prin"].map((m) => (
            <button key={m} className={"k k-line sm" + (f.method === m ? " on" : "")} onClick={() => set("method", m)}>
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {(f.method === "fixed" || f.method === "prin") && (
        <div className="row">
          <span>{f.method === "prin" ? "毎月の元金（手数料は別に乗ります）" : "毎月の返済額"}</span>
          <input className="fld" type="number" inputMode="numeric" value={f.fixed}
            onChange={(e) => set("fixed", Math.max(0, Number(e.target.value) || 0))} />
        </div>
      )}

      {(f.method === "rate" || f.method === "step") && (
        <>
          <p className="calcline">この残高だと約定返済額は <b>{yen(due)}</b>{p ? "（" + p.name + (p.sub ? "・" + p.sub : "") + "の決まり方）" : ""}</p>
          <label className="chk">
            <input type="checkbox" checked={!!f.reslide} onChange={(e) => set("reslide", e.target.checked)} />
            <span>残高が減ったら返済額も下げる（下げてもらう前提で試算）</span>
          </label>
        </>
      )}

      <div className="two">
        <div className="row">
          <span>この借入先だけ上乗せ</span>
          <input className="fld" type="number" inputMode="numeric" value={f.extra || 0}
            onChange={(e) => set("extra", Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="row">
          <span>ボーナス月の上乗せ</span>
          <input className="fld" type="number" inputMode="numeric" value={f.bonusAmount || 0}
            onChange={(e) => set("bonusAmount", Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>
      <div className="row">
        <span>ボーナス月</span>
        <div className="seg wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
            <button key={m} className={"k k-line sm" + ((f.bonusMonths || []).includes(m) ? " on" : "")}
              onClick={() => set("bonusMonths", (f.bonusMonths || []).includes(m) ? f.bonusMonths.filter((x) => x !== m) : [...(f.bonusMonths || []), m].sort((a, b) => a - b))}>
              {m}月
            </button>
          ))}
        </div>
      </div>

      {r0 && (
        <div className="prev">
          <div className="prev-row"><span>今月の支払い</span><b>{yen(r0.pay)}</b></div>
          <div className="prev-row"><span>うち利息</span><b className="i-int">{yen(r0.interest)}</b></div>
          <div className="prev-row"><span>元金がへる額</span><b className="i-pri">{yen(r0.principal)}</b></div>
          <div className="prev-row"><span>完済まで</span><b>{sim.stuck ? "減りません" : `${sim.months}回`}</b></div>
          <div className="prev-row"><span>利息の総額</span><b>{sim.stuck ? "—" : yen(sim.interestSum)}</b></div>
        </div>
      )}
      {sim.stuck && <p className="warn">いまの返済額だと利息のほうが大きく、残高が減りません。</p>}
      {p && p.note && <p className="hint">{p.note}</p>}

      <div className="foot">
        <button className="k k-del" onClick={() => onDelete(f.id)}>削除</button>
        <button className="k k-add own" onClick={() => onSave({ ...f, balance: Number(f.balance) || 0 })}>保存する</button>
      </div>
    </Sheet>
  );
}


/* ============================================================
   2ページのシェル — 横にスクロールすると切り替わる
   ============================================================ */
const PAGES = [
  { key: "subs", label: "固定費" },
  { key: "loan", label: "返済" },
];

export default function App() {
  const [page, setPage] = useState(0);
  const ref = useRef(null);

  const onScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    if (i !== page && i >= 0 && i < PAGES.length) setPage(i);
  };
  const go = (i) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: noMotion() ? "auto" : "smooth" });
    setPage(i);
  };

  return (
    <div className="shell">
      <style>{CSS}</style>
      <div className="pager" ref={ref} onScroll={onScroll}>
        <div className="page"><SubsPage /></div>
        <div className="page"><LoanPage /></div>
      </div>
      <div className="dots" role="tablist">
        {PAGES.map((p, i) => (
          <button key={p.key} role="tab" aria-selected={page === i}
            className={"dotbtn" + (page === i ? " on" : "")} onClick={() => go(i)}>
            <i /> {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
const CSS = `
.sc{
  --case:#BFC9E4; --case-d:#96A3C4; --case-l:#D4DBEF; --case-ink:#242B3A;
  --lcd:#CBE6D4; --lcd-ink:#22402F;
  --paper:#F1EEF7; --key:#FFFFFF; --edge:#3B4150; --sec:#E2DCEF;
  --ink:#252932; --focus:#D9852E;
  --orange:#FFC085; --orange-e:#D19752; --orange-ink:#5A3300;
  --up:#F5B3AC; --up-ink:#8C2E22; --up-t:#BE4738;
  --down:#A8DCC4; --down-ink:#12543E; --down-t:#17795A;
  background:var(--paper); color:var(--ink); min-height:100vh;
  max-width:640px; margin:0 auto; padding:0 0 40px;
  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif;
  font-feature-settings:"palt" 1; -webkit-font-smoothing:antialiased;
}
.sc *{box-sizing:border-box;}
.sc button{font-family:inherit;color:inherit;cursor:pointer;}
.sc b{font-weight:700;}

/* ── キー ── */
.k{
  background:var(--key); border:2px solid var(--edge); border-bottom-width:5px;
  border-radius:11px; padding:12px 14px; font-size:14px; font-weight:700; line-height:1.2;
  transition:transform .06s, border-bottom-width .06s;
}
.k:active{transform:translateY(3px); border-bottom-width:2px;}
.k-on{background:#AEBBDD; color:var(--case-ink); border-color:var(--case-d);}
.k-line{background:var(--sec);}
.k.dark{background:#FFFFFF; color:var(--case-ink); border-color:var(--edge);}
.k.dark.sel{background:var(--orange); color:var(--orange-ink); border-color:var(--orange-e);}
.k.now{background:#FFF6EC; color:var(--ink); border-color:var(--edge);}
.k-add{
  display:flex; align-items:center; justify-content:center; gap:8px;
  margin:20px 16px 0; background:var(--orange); color:var(--orange-ink); border-color:var(--orange-e); font-size:16px; padding:16px;
}
.k-add .plus{font-size:20px; line-height:1;}
.k-add.own{margin:0 0 14px; width:100%; background:#fff; color:var(--ink); border-color:var(--edge);}
.k-del{background:#fff; color:var(--up-t); border-color:var(--up-t);}
.k.tiny{padding:7px 11px; font-size:12px; border-bottom-width:4px;}
.k.sm{padding:10px 8px; font-size:12.5px; flex:1;}
.k.wide{width:100%; margin-top:10px;}
.k.flex{flex:1;}
.k.tab{flex:1; font-size:14px;}

/* ── 本体 ── */
.case{
  background:var(--case); margin:0 0 4px; padding:14px 14px 18px;
  border-radius:0 0 22px 22px; box-shadow:0 5px 0 var(--case-d);
}
.case-top{display:flex; justify-content:space-between; align-items:center; padding:2px 2px 12px;}
.brand{color:var(--case-ink); font-size:14px; font-weight:800; letter-spacing:.1em;}
.chip{background:#FFFFFF; border:2px solid var(--edge); border-bottom-width:4px; color:var(--ink); font-size:12px; font-weight:700; padding:7px 13px; border-radius:9px;}
.chip:active{transform:translateY(2px); border-bottom-width:2px;}

/* ── 液晶 ── */
.lcd{
  background:var(--lcd); border-radius:8px; padding:14px 14px 12px;
  box-shadow:inset 0 3px 0 rgba(34,64,47,.13), inset 0 -1px 0 rgba(255,255,255,.6);
  background-image:repeating-linear-gradient(90deg,rgba(34,64,47,.045) 0 1px,transparent 1px 4px);
  color:var(--lcd-ink); animation:power .55s ease-out;
}
@keyframes power{
  0%{filter:brightness(.82) contrast(.7);}
  35%{filter:brightness(1.12);}
  100%{filter:none;}
}
.lcd-row{display:flex; align-items:center; justify-content:space-between;}
.nav{background:rgba(34,64,47,.13); border:1px solid rgba(34,64,47,.32); color:var(--lcd-ink);
  width:44px; height:34px; border-radius:7px; font-size:13px; transition:background .12s, transform .08s;}
.nav:active{background:var(--lcd-ink); color:var(--lcd); transform:scale(.94);}
.lcd-ym{font-size:19px; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:.02em;}
.lcd-ym.dr{animation:ymR .3s cubic-bezier(.22,1,.36,1);}
.lcd-ym.dl{animation:ymL .3s cubic-bezier(.22,1,.36,1);}
@keyframes ymR{from{opacity:0; transform:translateX(16px);}to{opacity:1; transform:none;}}
@keyframes ymL{from{opacity:0; transform:translateX(-16px);}to{opacity:1; transform:none;}}
.lcd-ym i{font-style:normal; font-size:12px; font-weight:600; padding:0 3px;}
.lcd-total{
  font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:44px; font-weight:700;
  text-align:right; letter-spacing:-.03em; line-height:1.2; padding:2px 0;
  font-variant-numeric:tabular-nums;
}
.lcd-diff{display:flex; align-items:center; justify-content:flex-end; gap:8px; padding-bottom:8px;}
.badge{
  font-family:ui-monospace,Menlo,monospace; font-size:14px; font-weight:700;
  padding:3px 8px; border-radius:5px; color:#2E3440; background:#CDD3DD;
}
.badge.up{background:var(--up); color:var(--up-ink);} .badge.down{background:var(--down); color:var(--down-ink);}
.lcd-small{font-size:11.5px; color:rgba(34,64,47,.85); font-weight:600;}
.spark{display:flex; align-items:flex-end; gap:3px; height:56px; border-top:1px solid rgba(34,64,47,.2); padding-top:8px;}
.spark .sp{flex:1; height:100%; background:none; border:0; padding:0 0 13px; display:flex; align-items:flex-end; position:relative;}
.spark .sp span{display:block; width:100%; background:rgba(34,64,47,.42); border-radius:2px 2px 0 0; transition:height .38s cubic-bezier(.22,1,.36,1);}
.spark .sp.on span{background:var(--lcd-ink);}
.spark .sp.fu span{background:repeating-linear-gradient(45deg,rgba(34,64,47,.4) 0 2px,rgba(34,64,47,.07) 2px 5px);}
.spark .sp em{position:absolute; left:0; right:0; bottom:0; font-style:normal; font-size:9.5px; text-align:center; color:rgba(34,64,47,.82); font-variant-numeric:tabular-nums;}
.spark .sp.on em{color:var(--lcd-ink); font-weight:800;}
.lcd-foot{display:flex; justify-content:space-between; font-size:11.5px; font-weight:600; color:rgba(34,64,47,.86); padding-top:7px; font-variant-numeric:tabular-nums;}
.keys2{display:flex; gap:8px; padding-top:12px;}

/* ── タブ・一覧 ── */
.tabs{display:flex; gap:8px; padding:16px 16px 4px;}
.list{padding:0 16px;}
.item{
  width:100%; display:flex; align-items:center; gap:11px; text-align:left;
  background:var(--key); border:2px solid var(--edge); border-radius:10px;
  padding:12px; margin-top:8px; min-height:58px;
  transition:transform .09s ease, background .2s ease, border-color .2s ease;
}
.item:active{transform:translateY(2px) scale(.995);}
.item.pop{animation:pop .34s cubic-bezier(.22,1,.36,1) backwards;}
@keyframes pop{from{opacity:0; transform:translateY(10px);}to{opacity:1; transform:none;}}
.item.flash{animation:flash 1.4s ease-out;}
@keyframes flash{
  0%{box-shadow:0 0 0 0 rgba(209,151,82,.85); background:#FFE7C9;}
  40%{box-shadow:0 0 0 8px rgba(209,151,82,0); background:#FFF4E7;}
  100%{box-shadow:none; background:var(--key);}
}
.item.ghost{background:var(--sec); border-style:dashed;}
.item.done{background:#EFEDF5;}
.item.done .item-main b{color:#787D89;}
.item.done .item-yen{color:#787D89;}
.dot{width:12px; height:12px; border-radius:4px; flex:0 0 12px; border:1.5px solid rgba(59,65,80,.55);}
.item-main{flex:1; min-width:0;}
.item-main b{display:block; font-size:14.5px; line-height:1.35;}
.item-main small{display:block; font-size:11px; color:#5B6070; padding-top:2px;}
.item-yen{font-size:16px; font-weight:800; font-variant-numeric:tabular-nums; white-space:nowrap;}
.item-yen i{font-style:normal; font-size:10px; font-weight:600; color:#5B6070;}
.item-yen.faint{font-size:12px; font-weight:700; color:#4E5462;}
.up-t{color:var(--up-t);} .down-t{color:var(--down-t);}
.total-line{
  display:flex; justify-content:space-between; align-items:center; margin-top:10px;
  background:var(--case); color:var(--case-ink); border-radius:10px; padding:13px 14px;
  border:2px solid var(--edge);
  font-size:13px; font-weight:700;
}
.total-line{animation:pop .38s cubic-bezier(.22,1,.36,1) 120ms backwards;}
.total-line span:last-child{font-size:22px; font-weight:800; font-variant-numeric:tabular-nums;}
.sub{font-size:12px; font-weight:800; color:#3E4453; margin:22px 0 0; display:flex; align-items:center; gap:7px;}
.hint{font-size:11.5px; color:#565C6B; line-height:1.7; padding:9px 2px 0;}
.big-hint{text-align:center; padding:26px 0;}
.warn{font-size:12px; color:var(--up-t); font-weight:700; padding:14px 18px 0; line-height:1.6;}
.bigdiff{
  display:flex; justify-content:space-between; align-items:center; margin-top:10px;
  background:var(--case); color:var(--case-ink); border-radius:10px; padding:14px;
  border:2px solid var(--edge);
  font-size:13px; font-weight:700;
}
.bigdiff b{font-size:24px; font-family:ui-monospace,Menlo,monospace; font-variant-numeric:tabular-nums;}
.bigdiff .up-t{color:#A83A2B;} .bigdiff .down-t{color:#0E6247;}
.tagpill{font-size:10.5px; font-weight:700; color:#343A47; background:#D7D2E6; padding:4px 7px; border-radius:5px; white-space:nowrap;}
.tagpill.up{background:var(--up); color:var(--up-ink);} .tagpill.down{background:var(--down); color:var(--down-ink);}
.alert{
  background:#FDF0DC; border:2px solid var(--edge); border-left-width:7px; border-left-color:var(--orange-e);
  border-radius:10px; padding:13px; margin-top:12px; font-size:13px; line-height:1.7;
}
.alert b{font-size:17px; font-variant-numeric:tabular-nums;}
.catrow{display:flex; align-items:center; gap:10px; padding:9px 2px; border-bottom:1px solid #D5D0E1;}
.catname{flex:0 0 78px; font-size:12px; font-weight:700;}
.catbar{flex:1; height:14px; background:#E3DEEE; border:1.5px solid rgba(59,65,80,.45); border-radius:5px; overflow:hidden;}
.catbar span{display:block; height:100%;}
.catbar .grow{animation:grow .55s cubic-bezier(.22,1,.36,1) backwards; transform-origin:left;}
@keyframes grow{from{transform:scaleX(0);}to{transform:none;}}
.catrow .item-yen{flex:0 0 72px; text-align:right; font-size:13px;}
.empty{padding-top:26px;}
.empty .k-add{margin-left:0; margin-right:0;}
.empty-lead{font-size:17px; font-weight:800; margin:0;}

/* ── シート ── */
.ov{position:fixed; inset:0; background:rgba(50,48,72,.42); display:flex; align-items:flex-end; justify-content:center; z-index:50; animation:fade .2s ease-out;}
@keyframes fade{from{opacity:0;}to{opacity:1;}}
.sheet{
  background:var(--paper); width:100%; max-width:640px; max-height:92vh; overflow:auto;
  border-radius:20px 20px 0 0; border-top:5px solid var(--case); padding:16px 16px 28px;
  animation:up .32s cubic-bezier(.22,1,.36,1);
}
@keyframes up{from{transform:translateY(60px);}to{transform:none;}}
@media (prefers-reduced-motion:reduce){
  .sheet,.ov,.lcd,.lcd-ym,.item.pop,.item.flash,.total-line,.catbar .grow{animation:none;}
  .k,.nav,.item,.spark .sp span{transition:none;}
}
.sheet-head{display:flex; justify-content:space-between; align-items:center; padding-bottom:14px;}
.sheet-head h2{font-size:16px; font-weight:800; margin:0;}
.row{display:block; padding:8px 0;}
.row>span{display:block; font-size:11.5px; font-weight:700; color:#3E4453; padding-bottom:6px;}
.fld{
  width:100%; background:#fff; border:2px solid var(--edge); border-radius:9px;
  padding:11px; font-size:16px; font-family:inherit; color:var(--ink);
}
.fld:focus{outline:3px solid var(--focus); outline-offset:1px;}
.fld.big{font-size:22px; font-weight:800; font-variant-numeric:tabular-nums;}
.money{display:flex; align-items:center; gap:8px;}
.money b{font-size:15px;}
.ratefrom{display:flex; align-items:center; gap:8px; padding-top:8px;}
.ratefrom span{font-size:11.5px; color:#3E4453; font-weight:600; white-space:nowrap;}
.two{display:flex; gap:10px;}
.two .row{flex:1;}
.seg{display:flex; gap:7px;}
.search{margin-bottom:2px;}
.area{height:170px; font-size:12px; line-height:1.5; resize:vertical;}
.yearline{font-size:12.5px; font-weight:700; color:#3E4453; padding:14px 0 2px; font-variant-numeric:tabular-nums;}
.foot{display:flex; gap:10px; padding-top:14px;}
.sc button:focus-visible,.sc .fld:focus-visible{outline:3px solid var(--focus); outline-offset:2px;}

/* ── 2ページのシェル ── */
.shell{position:relative; background:#BFC9E4;}
.pager{
  display:flex; height:100dvh; overflow-x:auto; overflow-y:hidden;
  scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}
.pager::-webkit-scrollbar{display:none;}
.page{
  flex:0 0 100%; width:100%; height:100%;
  overflow-y:auto; overflow-x:hidden; scroll-snap-align:start; scroll-snap-stop:always;
  -webkit-overflow-scrolling:touch; background:#F1EEF7;
}
.page .sc{padding-bottom:96px;}
.dots{
  position:fixed; left:0; right:0; bottom:0; z-index:40;
  display:flex; justify-content:center; gap:10px;
  padding:9px 12px calc(9px + env(safe-area-inset-bottom));
  background:rgba(241,238,247,.94); border-top:2px solid #3B4150;
  backdrop-filter:blur(6px);
}
.dotbtn{
  display:flex; align-items:center; gap:7px; border:2px solid #3B4150;
  border-bottom-width:4px; border-radius:10px; background:#fff; color:#252932;
  font-family:inherit; font-size:12.5px; font-weight:800; padding:8px 15px; cursor:pointer;
}
.dotbtn.on{background:#AEBBDD; border-color:#96A3C4;}
.dotbtn i{width:8px; height:8px; border-radius:50%; background:#96A3C4; display:block;}
.dotbtn.on i{background:#3B4150;}

/* ── 返済プラン ── */
.asof{font-size:10.5px; font-weight:700; color:var(--case-ink); opacity:.85;}
.loan{
  display:block; width:100%; text-align:left; background:#fff;
  border:2px solid var(--edge); border-bottom-width:4px; border-radius:11px;
  padding:13px 14px; margin-bottom:11px; font-family:inherit; color:var(--ink);
}
.loan:active{transform:translateY(2px); border-bottom-width:2px;}
.loan-top{display:flex; justify-content:space-between; align-items:baseline; gap:10px;}
.loan-top b{font-size:15px;}
.loan-bal{font-size:19px; font-weight:800; font-variant-numeric:tabular-nums;}
.loan-sub{font-size:11px; color:#5B6070; padding:3px 0 9px; font-weight:600;}
.bar2{display:flex; height:11px; border:1.5px solid rgba(59,65,80,.5); border-radius:5px; overflow:hidden; background:#E3DEEE;}
.bar2-i{background:var(--up); display:block;}
.bar2-p{background:var(--down); display:block;}
.loan-row{display:flex; gap:10px; padding-top:8px; font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums;}
.loan-row span:first-child{flex:1;}
.loan-row2{display:flex; justify-content:space-between; gap:10px; padding-top:5px; font-size:11.5px; color:#4E5462; font-weight:600;}
.i-int{color:var(--up-t);} .i-pri{color:var(--down-t);}
.loan-win{margin-top:9px; background:#E8F5EE; border:1.5px solid var(--down-t); border-radius:7px;
  padding:6px 9px; font-size:11.5px; font-weight:700; color:var(--down-t);}
.curve{display:flex; align-items:flex-end; gap:2px; height:96px; padding:10px 0 16px;
  border-bottom:2px solid var(--edge); position:relative;}
.cv{flex:1; height:100%; display:flex; align-items:flex-end; position:relative; min-width:3px;}
.cv span{display:block; width:100%; background:#AEBBDD; border-top:1.5px solid var(--edge); border-radius:2px 2px 0 0;
  transition:height .4s cubic-bezier(.22,1,.36,1);}
.cv em{position:absolute; left:-6px; bottom:-15px; font-style:normal; font-size:9.5px; color:#5B6070; font-weight:700;}
.tblwrap{padding-top:6px;}
.tbl{width:100%; border-collapse:collapse; font-size:11.5px; font-variant-numeric:tabular-nums;
  background:#fff; border:2px solid var(--edge); border-radius:9px; overflow:hidden;}
.tbl th{background:var(--sec); font-size:10.5px; font-weight:800; padding:6px 5px; text-align:right; color:#3E4453;}
.tbl th:first-child{text-align:left;}
.tbl td{padding:6px 5px; text-align:right; border-top:1px solid #D5D0E1;}
.tbl td:first-child{text-align:left; font-weight:700;}
.pick{display:flex; justify-content:space-between; align-items:baseline; gap:10px; width:100%;
  background:#fff; border:2px solid var(--edge); border-bottom-width:4px; border-radius:9px;
  padding:11px 13px; margin-bottom:8px; font-family:inherit; color:var(--ink); text-align:left;}
.pick:active{transform:translateY(2px); border-bottom-width:2px;}
.pick b{font-size:13.5px;}
.pick span{font-size:11px; color:#5B6070; font-weight:600; text-align:right;}
.calcline{font-size:12.5px; font-weight:700; color:#3E4453; padding:10px 2px 4px;}
.calcline b{font-size:15px;}
.chk{display:flex; align-items:flex-start; gap:9px; padding:4px 2px 10px; font-size:11.5px; color:#3E4453; font-weight:600; line-height:1.5;}
.chk input{width:19px; height:19px; flex:0 0 19px; accent-color:#3B4150;}
.prev{background:var(--sec); border:2px solid var(--edge); border-radius:10px; padding:11px 13px; margin-top:12px;}
.prev-row{display:flex; justify-content:space-between; gap:10px; padding:3px 0; font-size:12.5px; font-variant-numeric:tabular-nums;}
.prev-row span{color:#3E4453; font-weight:600;}
.bd-row{display:flex; justify-content:space-between; gap:10px; padding:3px 0; font-size:12.5px; font-variant-numeric:tabular-nums;}
.bd-win{margin-top:9px; padding-top:9px; border-top:1.5px solid var(--case-d); font-size:13.5px; font-weight:800;}
.seg.wrap{flex-wrap:wrap;}
.k-line.on{background:#AEBBDD; border-color:var(--case-d);}
.k-line.sm{font-size:11.5px; padding:8px 11px;}
@media (prefers-reduced-motion: reduce){
  .pager{scroll-behavior:auto;}
  .cv span{transition:none;}
}
`;
