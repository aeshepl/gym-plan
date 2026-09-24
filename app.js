// ============ التخزين ============
const STORE_KEY = "gymapp-v1";
const store = (() => {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { s = null; }
  s = s || {};
  s.days = s.days || {};
  s.gates = s.gates || { rightBiceps: false, leftArm: false };
  s.physio = s.physio || [];
  s.body = s.body || [];
  return s;
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {} }
function day(k) { return (store.days[k] = store.days[k] || { sets: {}, checks: {}, water: 0, supps: {}, physio: {} }); }

// ============ أدوات ============
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const short = d => `${d.getDate()}/${d.getMonth() + 1}`;
const todayKey = () => keyOf(new Date());
const weekNum = d => Math.floor((parseKey(keyOf(d)) - parseKey(START_DATE)) / 864e5 / 7) + 1;
const restLabel = r => r < 60 ? `${r} ث` : r % 60 === 0 ? (r === 60 ? "دقيقة" : r === 120 ? "دقيقتين" : `${r / 60} د`) : `${Math.floor(r / 60)}:${pad(r % 60)} د`;
const fmtTime = s => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
function sessionFor(k) { const rec = store.days[k]; return (rec && rec.session) || SCHEDULE[parseKey(k).getDay()]; }
function weekStart(d) { const x = parseKey(keyOf(d)); const back = (x.getDay() + 1) % 7; x.setDate(x.getDate() - back); return x; } // السبت

const ICON = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M11 10h2v7h-2zM11 7h2v2h-2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3 1.5 21h21zM11 10h2v5h-2zm0 6.5h2v2h-2z"/></svg>'
};

// ============ الحالة ============
const ui = { tab: "today", date: todayKey(), open: {}, follow: true };

// ============ الشاشات ============
function render() {
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === ui.tab));
  const v = { today: viewDay, week: viewWeek, food: viewFood, progress: viewProgress, settings: viewSettings }[ui.tab];
  $("#main").innerHTML = v();
  window.scrollTo(0, ui.tab === "today" && ui.keepScroll ? window.scrollY : 0);
  ui.keepScroll = false;
}
function rerender() { const y = window.scrollY; $("#main").innerHTML = ({ today: viewDay, week: viewWeek, food: viewFood, progress: viewProgress, settings: viewSettings })[ui.tab](); window.scrollTo(0, y); if (ui.tab === "settings") offlineStatus(); }

function estMinutes(sess) {
  let s = 0;
  for (const b of sess.blocks) for (const it of b.items) {
    if (it.kind === "lift" && (!it.gate || store.gates[it.gate])) s += it.sets * (45 + it.rest);
    if (it.kind === "cardio") s += (it.min || 0) * 60;
    if (it.kind === "task") s += 7 * 60;
    if (it.kind === "stretch") s += it.items.length * 60;
  }
  return Math.round(s / 60 / 5) * 5;
}

function viewDay() {
  const k = ui.date, d = parseKey(k), isToday = k === todayKey();
  const sk = sessionFor(k), sess = SESSIONS[sk], rec = day(k);
  const wk = weekNote(weekNum(d));
  const mins = estMinutes(sess);
  let h = `
  <section class="hero">
    <div class="hero-top">
      <span class="eyebrow">${isToday ? "النهارده" : "يوم تاني"} • ${DAY_NAMES[d.getDay()]} ${short(d)}</span>
      ${isToday ? "" : `<button class="link" data-act="goToday">ارجع للنهارده</button>`}
    </div>
    <h1>${esc(sess.title)}</h1>
    <p class="sub">${esc(sess.sub)}</p>
    <div class="chips">
      ${mins ? `<span class="chip">≈ ${mins} دقيقة</span>` : ""}
      <span class="chip">أسبوع ${Math.max(weekNum(d), 1)}</span>
      ${rec.done ? `<span class="chip ok">${ICON.check} خلصت</span>` : ""}
    </div>
    <label class="swap">بدّل تمرين اليوم:
      <select data-act="swap">
        ${Object.keys(SESSIONS).map(s => `<option value="${s}" ${s === sk ? "selected" : ""}>${esc(SESSIONS[s].title)} — ${esc(SESSIONS[s].sub.split(" • ")[0])}</option>`).join("")}
      </select>
    </label>
  </section>
  <section class="note-card">
    <b>${esc(wk.t)}</b><p>${esc(wk.d)}</p>
  </section>
  ${safetyCard()}
  ${physioCard(k)}`;

  let n = 0;
  for (const b of sess.blocks) {
    h += `<h2 class="block-title">${esc(b.title)}</h2>`;
    for (const it of b.items) h += itemHTML(it, k, b.title !== "تسخين" && it.kind === "lift" && (!it.gate || store.gates[it.gate]) ? ++n : "•");
  }
  h += waterMini(k);
  h += `<button class="btn primary big" data-act="finish">${rec.done ? "✓ اتسجّل إنك خلصت — دوس للإلغاء" : "خلصت تمرين النهارده"}</button>`;
  return h;
}

function safetyCard() {
  const open = ui.open.safety;
  return `<section class="safety ${open ? "open" : ""}">
    <button class="safety-head" data-act="toggle" data-id="safety">${ICON.warn}<span>وقّف فورًا لو حسيت بأي حاجة من دول</span><span class="chev">${open ? "−" : "+"}</span></button>
    <ul class="stop">${SAFETY.stop.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
    ${open ? `<h3>قواعد الكتف</h3><ul class="rules">${SAFETY.rules.map(s => `<li>${esc(s)}</li>`).join("")}</ul><p class="muted small">${esc(SAFETY.next)}</p>` : `<button class="link" data-act="toggle" data-id="safety">قواعد الكتف كلها</button>`}
  </section>`;
}

function physioCard(k) {
  const rec = day(k);
  if (!store.physio.length) return `<section class="card physio">
    <div class="row-between"><b>تمارين العلاج الطبيعي</b></div>
    <p class="muted small">أهم تمرين في يومك. ضيف التمارين اللي الفيزيو مديهالك من <button class="link" data-act="tab" data-tab="settings">الإعدادات</button> عشان تظهرلك هنا كل يوم.</p>
  </section>`;
  const done = store.physio.filter((_, i) => rec.physio[i]).length;
  return `<section class="card physio">
    <div class="row-between"><b>تمارين العلاج الطبيعي</b><span class="muted small">${done}/${store.physio.length}</span></div>
    ${store.physio.map((p, i) => `<button class="check-row ${rec.physio[i] ? "on" : ""}" data-act="physio" data-i="${i}"><span class="box">${ICON.check}</span><span>${esc(p)}</span></button>`).join("")}
  </section>`;
}

function lastTime(key, beforeK) {
  const ks = Object.keys(store.days).filter(x => x < beforeK).sort().reverse();
  for (const x of ks) {
    const sets = store.days[x].sets[key];
    if (sets && sets.some(s => s.w || s.r)) return { k: x, sets };
  }
  return null;
}

function itemHTML(it, k, n) {
  const rec = day(k);
  if (it.kind === "task" || it.kind === "cardio") {
    const id = it.key || it.text;
    const on = rec.checks[id];
    return `<section class="card task ${on ? "done" : ""}">
      <button class="check-row" data-act="check" data-id="${esc(id)}"><span class="box">${ICON.check}</span><span><b>${esc(it.text)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span></button>
      ${it.steps ? `<ol class="steps">${it.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    </section>`;
  }
  if (it.kind === "stretch") {
    const id = "stretch-" + it.items.join("|");
    const on = rec.checks[id];
    return `<section class="card task ${on ? "done" : ""}">
      <button class="check-row" data-act="check" data-id="${esc(id)}"><span class="box">${ICON.check}</span><span><b>استريتش</b><small>${esc(it.hold)}</small></span></button>
      <div class="stretch-list">${it.items.map(x => { const e = EX[x]; return `<div class="stretch">
        <button class="vid-btn" data-act="video" data-ex="${x}" aria-label="فيديو ${esc(e.ar)}">${ICON.play}</button>
        <div><b>${esc(e.ar)}</b><small>${esc(e.cues[e.cues.length - 1])}</small></div></div>`; }).join("")}</div>
    </section>`;
  }
  // lift
  const e = EX[it.ex];
  if (it.gate && !store.gates[it.gate]) {
    return `<section class="locked">${ICON.lock}<span><b dir="ltr">${esc(e.en)}</b> — ${esc(it.side || "")}<small>بعد موافقة الفيزيو. فعّلها من الإعدادات</small></span></section>`;
  }
  const sets = rec.sets[it.key] || [];
  const last = lastTime(it.key, k);
  const openInfo = ui.open["i-" + it.key];
  const allDone = sets.filter(s => s && s.d).length >= it.sets;
  let rows = "";
  for (let i = 0; i < it.sets; i++) {
    const s = sets[i] || {};
    const ls = last && last.sets[i];
    rows += `<div class="set ${s.d ? "done" : ""}">
      <span class="set-n">${i + 1}</span>
      <label><input inputmode="decimal" data-act="input" data-key="${it.key}" data-i="${i}" data-f="w" value="${esc(s.w || "")}" placeholder="${ls && ls.w ? esc(ls.w) : "—"}"><span>كجم</span></label>
      <label><input inputmode="numeric" data-act="input" data-key="${it.key}" data-i="${i}" data-f="r" value="${esc(s.r || "")}" placeholder="${ls && ls.r ? esc(ls.r) : "—"}"><span>عدة</span></label>
      <button class="set-ok" data-act="set" data-key="${it.key}" data-i="${i}" data-rest="${it.rest}" data-name="${esc(e.ar)}" aria-label="خلصت المجموعة">${ICON.check}</button>
    </div>`;
  }
  return `<section class="card ex ${allDone ? "done" : ""}" id="ex-${it.key}">
    <div class="ex-head">
      <span class="num">${n}</span>
      <div class="ex-name"><b dir="ltr">${esc(e.en)}</b><span>${esc(e.ar)}${it.side ? ` • <em>${esc(it.side)}</em>` : ""}</span></div>
    </div>
    <div class="ex-meta"><span><b>${it.sets}</b> × <b>${esc(it.reps)}</b></span><span>راحة ${restLabel(it.rest)}</span></div>
    ${it.note ? `<p class="ex-note">${esc(it.note)}</p>` : ""}
    <div class="ex-actions">
      <button class="btn soft" data-act="video" data-ex="${it.ex}">${ICON.play} فيديو</button>
      <button class="btn soft" data-act="toggle" data-id="i-${it.key}">${ICON.info} ازاي؟</button>
    </div>
    ${openInfo ? `<ul class="cues">${e.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul>${e.safe ? `<p class="safe-note">${esc(e.safe)}</p>` : ""}${e.alt ? `<p class="alt-note">${esc(e.alt)}</p>` : ""}` : (e.safe ? `<p class="safe-note">${esc(e.safe)}</p>` : "")}
    ${last ? `<p class="last">آخر مرة (${DAY_NAMES[parseKey(last.k).getDay()]} ${short(parseKey(last.k))}): <span dir="ltr">${last.sets.filter(s => s && (s.w || s.r)).map(s => `${s.w || "–"}×${s.r || "–"}`).join(" · ")}</span></p>` : ""}
    <div class="sets">${rows}</div>
  </section>`;
}

function waterMini(k) {
  const w = day(k).water || 0;
  return `<section class="card water-mini">
    <div class="row-between"><b>المية</b><span><b>${(w * 0.25).toFixed(2).replace(/\.?0+$/, "")}</b> / 3.5 لتر</span></div>
    <div class="water-bar"><i style="width:${Math.min(100, w / 14 * 100)}%"></i></div>
    <div class="row-gap"><button class="btn soft" data-act="water" data-d="-1">− كوباية</button><button class="btn primary" data-act="water" data-d="1">+ كوباية 250 مل</button></div>
  </section>`;
}

function viewWeek() {
  const ws = weekStart(new Date());
  let h = `<section class="hero compact"><h1>الأسبوع</h1><p class="sub">أسبوع ${Math.max(weekNum(new Date()), 1)} • من السبت ${short(ws)}</p></section>`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(ws.getDate() + i);
    const k = keyOf(d), s = SESSIONS[sessionFor(k)], rec = store.days[k];
    h += `<button class="day-row ${k === todayKey() ? "today" : ""} ${rec && rec.done ? "done" : ""}" data-act="openDay" data-k="${k}">
      <span class="day-name">${DAY_NAMES[d.getDay()]}<small>${short(d)}</small></span>
      <span class="day-sess"><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></span>
      <span class="day-st">${rec && rec.done ? ICON.check : k === todayKey() ? "النهارده" : ""}</span>
    </button>`;
  }
  h += `<section class="card"><b>ليه كده؟</b>
    <ul class="rules">
      <li>الرجل مرتين في الأسبوع لأنها أكبر عضلة في جسمك: أحسن حاجة للحرق وللحفاظ على العضل وإنت الكتف واقف.</li>
      <li>الساعد والباي مرتين، والدراع الشمال بيشتغل. تمرين الناحية السليمة بيحافظ على جزء من قوة الناحية المصابة.</li>
      <li>يومين كارديو هادي عشان الدهون، ويوم راحة كامل.</li>
      <li>فاتك يوم؟ افتحه من هنا واعمله، أو بدّل التمرين من شاشة النهارده.</li>
    </ul></section>`;
  return h;
}

function viewFood() {
  const k = todayKey(), rec = day(k), w = rec.water || 0;
  let h = `<section class="hero compact"><h1>الأكل</h1><p class="sub">صيام متقطع • وجبة واحدة • من غير نشويات</p></section>
  <div class="targets">${FOOD.targets.map(t => `<div class="target"><b>${esc(t.v)}</b><span>${esc(t.u)}</span><small>${esc(t.k)}</small></div>`).join("")}</div>
  <p class="why">${esc(FOOD.why)}</p>
  <section class="card">
    <div class="row-between"><b>مية النهارده</b><span><b>${(w * 0.25).toFixed(2).replace(/\.?0+$/, "")}</b> / 3.5 لتر</span></div>
    <div class="cups">${Array.from({ length: 14 }, (_, i) => `<button class="cup ${i < w ? "on" : ""}" data-act="cup" data-i="${i}" aria-label="كوباية ${i + 1}"></button>`).join("")}</div>
    <p class="muted small">كل كوباية 250 مل. أقل حاجة 12 كوباية (3 لتر)، و14 في أيام التمرين.</p>
  </section>
  <h2 class="block-title">يومك</h2>
  <section class="card timeline">${FOOD.timeline.map(t => `<div class="tl"><b>${esc(t.t)}</b><span>${esc(t.d)}</span></div>`).join("")}</section>
  <h2 class="block-title">الوجبة: اختار بروتين واحد</h2>
  ${FOOD.proteins.map(p => `<section class="card protein"><div class="row-between"><b>${esc(p.n)}</b><span class="pill">${esc(p.p)} جم بروتين • ${esc(p.c)} سعر</span></div><p>${esc(p.q)}</p>${p.tip ? `<p class="muted small">${esc(p.tip)}</p>` : ""}</section>`).join("")}
  <h2 class="block-title">وجنبه</h2>
  <section class="card">${FOOD.plate.map(p => `<div class="tl"><b>${esc(p.n)}</b><span>${esc(p.d)}</span></div>`).join("")}</section>
  <h2 class="block-title">المكملات</h2>
  <section class="card">${FOOD.supps.map(s => `<button class="check-row ${rec.supps[s.key] ? "on" : ""}" data-act="supp" data-key="${s.key}"><span class="box">${ICON.check}</span><span><b>${esc(s.n)}</b> <span class="pill">${esc(s.dose)}</span><small>${esc(s.when)}: ${esc(s.why)}</small></span></button>`).join("")}
  <p class="muted small">${esc(FOOD.suppNote)}</p></section>
  <h2 class="block-title">نصايح</h2>
  <section class="card"><ul class="rules">${FOOD.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul></section>
  <h2 class="block-title">المتابعة كل أسبوع</h2>
  <section class="card"><ul class="rules">${FOOD.rules.map(t => `<li>${esc(t)}</li>`).join("")}</ul></section>`;
  return h;
}

function chartSVG(points) {
  if (points.length < 2) return "";
  const W = 340, H = 150, P = 26;
  const xs = points.map(p => parseKey(p.d).getTime()), ys = points.map(p => p.w);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.floor(Math.min(...ys) - 1), y1 = Math.ceil(Math.max(...ys) + 1);
  const X = t => P + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (W - 2 * P);
  const Y = v => H - P + 4 - ((v - y0) / (y1 - y0)) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p.w).toFixed(1)}`).join(" ");
  const grid = [y0, (y0 + y1) / 2, y1].map(v => `<line x1="${P}" x2="${W - P}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${W - P + 4}" y="${Y(v) + 4}" class="axis">${Math.round(v)}</text>`).join("");
  const dots = points.map((p, i) => `<circle cx="${X(xs[i])}" cy="${Y(p.w)}" r="3.5" class="dot"/>`).join("");
  const lastP = points[points.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="منحنى الوزن" direction="ltr">${grid}<path d="${path}" class="line"/>${dots}
    <text x="${X(xs[xs.length - 1])}" y="${Y(lastP.w) - 9}" text-anchor="end" class="label">${lastP.w}</text></svg>`;
}

function viewProgress() {
  const entries = store.body.slice().sort((a, b) => a.d < b.d ? -1 : 1);
  const weights = [...HISTORY.map(h => ({ d: h.d, w: h.w })), ...entries.filter(e => e.w).map(e => ({ d: e.d, w: +e.w }))].sort((a, b) => a.d < b.d ? -1 : 1);
  const recent = weights.filter(p => parseKey(p.d) >= new Date(2026, 4, 1));
  // متوسط آخر 7 أيام مقابل اللي قبله
  const now = new Date(); const avg = (from, to) => { const v = entries.filter(e => e.w && parseKey(e.d) > from && parseKey(e.d) <= to).map(e => +e.w); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
  const d7 = new Date(now); d7.setDate(now.getDate() - 7); const d14 = new Date(now); d14.setDate(now.getDate() - 14);
  const a1 = avg(d7, now), a0 = avg(d14, d7);
  const waists = entries.filter(e => e.waist);
  const today = entries.find(e => e.d === todayKey()) || {};
  return `<section class="hero compact"><h1>التقدم</h1><p class="sub">وزن ووسط، والأوزان بتاعة التمارين بتتسجل لوحدها</p></section>
  <section class="card">
    <b>سجّل النهارده</b>
    <div class="row-gap inputs">
      <label>الوزن<input inputmode="decimal" id="in-w" value="${esc(today.w || "")}" placeholder="كجم"></label>
      <label>الوسط<input inputmode="decimal" id="in-waist" value="${esc(today.waist || "")}" placeholder="سم"></label>
      <button class="btn primary" data-act="saveBody">سجّل</button>
    </div>
    <p class="muted small">الوزن: السبت والتلات والخميس الصبح. الوسط: الجمعة عند السُرّة.</p>
  </section>
  <div class="targets three">
    <div class="target"><b>${a1 ? a1.toFixed(1) : "—"}</b><span>كجم</span><small>متوسط آخر 7 أيام</small></div>
    <div class="target"><b dir="ltr">${a1 && a0 ? ((a1 - a0 > 0 ? "+" : "") + (a1 - a0).toFixed(1)) : "—"}</b><span>كجم</span><small>عن الأسبوع اللي قبله</small></div>
    <div class="target"><b>${waists.length ? waists[waists.length - 1].waist : "97.1"}</b><span>سم</span><small>الوسط${waists.length ? "" : " (InBody مايو)"}</small></div>
  </div>
  <section class="card"><b>الوزن من مايو</b>${chartSVG(recent)}<p class="muted small">من أكتوبر 2024: ${weights.map(p => p.w).slice(0, 4).join(" ← ")}${weights.length > 4 ? " ← …" : ""}</p></section>
  <section class="card"><b>آخر InBody (${INBODY_LAST.date})، قبل الإصابة</b>
    <div class="kv">${INBODY_LAST.items.map(i => `<div><small>${esc(i.k)}</small><b>${esc(i.v)}</b></div>`).join("")}</div>
    <p class="muted small">أول ما تقدر اعمل InBody جديد، ويفضل على نفس الجهاز الصبح على الريق، وابعتهولي عشان أظبط الأرقام.</p>
  </section>
  ${entries.length ? `<section class="card"><b>السجل</b><div class="log">${entries.slice().reverse().slice(0, 20).map(e => `<div><span>${DAY_NAMES[parseKey(e.d).getDay()]} ${short(parseKey(e.d))}</span><span>${e.w ? e.w + " كجم" : ""}</span><span>${e.waist ? e.waist + " سم" : ""}</span></div>`).join("")}</div></section>` : ""}`;
}

function viewSettings() {
  return `<section class="hero compact"><h1>الإعدادات</h1></section>
  <section class="card">
    <b>الفيديوهات</b>
    <p class="muted small">الفيديوهات متشفرة، ومحدش يقدر يشغلها غيرك بالكود.</p>
    ${store.code ? `<p class="okline">${ICON.check} الكود متسجل</p>` : `<div class="row-gap inputs"><input id="in-code" placeholder="كود الفيديوهات" autocapitalize="off" autocomplete="off" spellcheck="false" dir="ltr"><button class="btn primary" data-act="saveCode">تمام</button></div><p class="err" id="code-err"></p>`}
    <p id="offline-status" class="muted small">بشوف الفيديوهات المتنزلة…</p>
    <button class="btn soft" data-act="downloadAll">نزّل كل الفيديوهات عشان تشتغل من غير نت</button>
  </section>
  <section class="card">
    <b>الفيزيو سمحلك؟</b>
    <p class="muted small">متفعّلش حاجة من دول غير لما الفيزيو يقولك صراحةً.</p>
    ${toggle("rightBiceps", "باي الدراع اليمين (خفيف)", "Curl وHammer وPreacher بنص وزن الشمال، والكوع لازق في جنبك")}
    ${toggle("leftArm", "تمارين الدراع الشمال لوحده", "Row وPushdown بالشمال، واليمين مرتاح")}
  </section>
  <section class="card">
    <b>تمارين العلاج الطبيعي</b>
    <p class="muted small">اكتب كل تمرين الفيزيو مديهولك، هيظهرلك كل يوم كـ checklist.</p>
    ${store.physio.map((p, i) => `<div class="physio-edit"><span>${esc(p)}</span><button class="link danger" data-act="delPhysio" data-i="${i}">امسح</button></div>`).join("")}
    <div class="row-gap inputs"><input id="in-physio" placeholder="مثال: External rotation بالأستك 3×15"><button class="btn primary" data-act="addPhysio">ضيف</button></div>
  </section>
  <section class="card">
    <b>نسخة احتياطية</b>
    <p class="muted small">كل تسجيلاتك محفوظة على الموبايل ده بس. خد نسخة كل كام أسبوع.</p>
    <div class="row-gap"><button class="btn soft" data-act="export">احفظ نسخة</button><label class="btn soft">استرجع نسخة<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>
  </section>
  <p class="muted small center">البرنامج: المرحلة الأولى • اتعمل 24/9/2026<br>لما الفيزيو يسمح بحاجة جديدة، أو تعمل InBody، قولّي وأحدّث البرنامج.</p>`;
}
function toggle(g, t, s) {
  return `<button class="toggle ${store.gates[g] ? "on" : ""}" data-act="gate" data-g="${g}"><span><b>${esc(t)}</b><small>${esc(s)}</small></span><i></i></button>`;
}

// ============ الأحداث ============
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-act]");
  if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
  const a = el.dataset.act, k = ui.date;
  if (a === "tab") { ui.tab = el.dataset.tab; if (ui.tab === "today") { ui.date = todayKey(); ui.follow = true; } render(); if (ui.tab === "settings") offlineStatus(); return; }
  if (a === "toggle") { ui.open[el.dataset.id] = !ui.open[el.dataset.id]; rerender(); return; }
  if (a === "goToday") { ui.date = todayKey(); ui.follow = true; render(); return; }
  if (a === "openDay") { ui.date = el.dataset.k; ui.follow = ui.date === todayKey(); ui.tab = "today"; render(); return; }
  if (a === "check") { const r = day(k); r.checks[el.dataset.id] = !r.checks[el.dataset.id]; save(); rerender(); return; }
  if (a === "physio") { const r = day(k); r.physio[el.dataset.i] = !r.physio[el.dataset.i]; save(); rerender(); return; }
  if (a === "supp") { const r = day(todayKey()); r.supps[el.dataset.key] = !r.supps[el.dataset.key]; save(); rerender(); return; }
  if (a === "water") { const r = day(k); r.water = Math.max(0, Math.min(20, (r.water || 0) + +el.dataset.d)); save(); rerender(); return; }
  if (a === "cup") { const r = day(todayKey()); const i = +el.dataset.i; r.water = r.water === i + 1 ? i : i + 1; save(); rerender(); return; }
  if (a === "finish") { const r = day(k); r.done = !r.done; save(); rerender(); if (r.done) toast("عاش! 💪 اتسجّل"); return; }
  if (a === "set") {
    const r = day(k), key = el.dataset.key, i = +el.dataset.i;
    r.sets[key] = r.sets[key] || [];
    const s = (r.sets[key][i] = r.sets[key][i] || {});
    // لو فاضي خد أرقام المرة اللي فاتت
    if (!s.d && !s.w && !s.r) { const l = lastTime(key, k); const ls = l && l.sets[i]; if (ls) { s.w = ls.w; s.r = ls.r; } }
    s.d = !s.d; save(); rerender();
    if (s.d) startTimer(+el.dataset.rest, el.dataset.name);
    return;
  }
  if (a === "video") { openVideo(el.dataset.ex); return; }
  if (a === "gate") { store.gates[el.dataset.g] = !store.gates[el.dataset.g]; save(); rerender(); return; }
  if (a === "addPhysio") { const v = $("#in-physio").value.trim(); if (v) { store.physio.push(v); save(); rerender(); } return; }
  if (a === "delPhysio") { store.physio.splice(+el.dataset.i, 1); save(); rerender(); return; }
  if (a === "saveBody") {
    const w = $("#in-w").value.trim().replace(",", "."), wa = $("#in-waist").value.trim().replace(",", ".");
    if (!w && !wa) return;
    const t = todayKey(); let e = store.body.find(x => x.d === t); if (!e) store.body.push(e = { d: t });
    if (w) e.w = w; if (wa) e.waist = wa; save(); rerender(); toast("اتسجّل"); return;
  }
  if (a === "saveCode") { saveCode(); return; }
  if (a === "downloadAll") { downloadAll(); return; }
  if (a === "export") { exportData(); return; }
  if (a === "timerAdd") { timer.end += 15000; timer.total += 15; return; }
  if (a === "timerSkip") { stopTimer(); return; }
  if (a === "closeVideo") { closeVideo(); return; }
});
document.addEventListener("input", ev => {
  const el = ev.target;
  if (el.dataset.act === "input") {
    const r = day(ui.date), key = el.dataset.key, i = +el.dataset.i;
    r.sets[key] = r.sets[key] || [];
    const s = (r.sets[key][i] = r.sets[key][i] || {});
    s[el.dataset.f] = el.value.replace(",", ".");
    save();
  }
});
document.addEventListener("change", ev => {
  const el = ev.target;
  if (el.dataset.act === "swap") { const r = day(ui.date); r.session = el.value === SCHEDULE[parseKey(ui.date).getDay()] ? undefined : el.value; save(); rerender(); }
  if (el.dataset.act === "import") importData(el.files[0]);
});
document.querySelector(".tabbar").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  ui.tab = b.dataset.tab; if (ui.tab === "today") { ui.date = todayKey(); ui.follow = true; } render(); if (ui.tab === "settings") offlineStatus();
});

function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 1800); }

// ============ تايمر الراحة ============
const timer = { end: 0, total: 0, id: 0 };
let actx;
let wakeLock = null;
async function keepAwake() { try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) {} }
function startTimer(sec, name) {
  keepAwake();
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {}
  timer.end = Date.now() + sec * 1000; timer.total = sec;
  $("#timer-name").textContent = "راحة • " + name;
  $("#timer").classList.add("show");
  clearInterval(timer.id); timer.id = setInterval(tick, 250); tick();
}
function tick() {
  const left = Math.max(0, (timer.end - Date.now()) / 1000);
  $("#timer-left").textContent = fmtTime(Math.ceil(left));
  $("#timer-bar").style.width = (100 - left / timer.total * 100) + "%";
  if (left <= 0) { beep(); stopTimer(); toast("يلا المجموعة الجاية"); }
}
function stopTimer() { clearInterval(timer.id); $("#timer").classList.remove("show"); }
function beep() {
  try {
    const now = actx.currentTime;
    [0, 0.25, 0.5].forEach(t => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.25, now + t); g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18); o.connect(g).connect(actx.destination); o.start(now + t); o.stop(now + t + 0.2); });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ============ الفيديوهات المتشفرة ============
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let keyPromise = null;
function getKey(code) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"])
    .then(base => crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(CRYPTO.salt), iterations: CRYPTO.iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]));
}
async function decrypt(key, buf) {
  const u = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, key, u.slice(12));
}
async function checkCode(code) {
  try { const key = await getKey(code); const pt = await decrypt(key, b64(CRYPTO.check)); return new TextDecoder().decode(pt) === "ok" ? key : null; } catch (e) { return null; }
}
async function saveCode() {
  const code = $("#in-code").value.trim().toLowerCase();
  const key = await checkCode(code);
  if (!key) { $("#code-err").textContent = "الكود غلط، جرب تاني"; return; }
  store.code = code; save(); keyPromise = Promise.resolve(key); rerender(); offlineStatus(); toast("تمام، الفيديوهات اشتغلت"); downloadAll();
}
function ensureKey() { if (!store.code) return null; return (keyPromise = keyPromise || getKey(store.code)); }
const blobCache = {};
async function openVideo(exId) {
  const e = EX[exId], m = $("#video-modal");
  $("#vm-title").innerHTML = `<b dir="ltr">${esc(e.en)}</b><span>${esc(e.ar)}</span>`;
  $("#vm-cues").innerHTML = e.cues.map(c => `<li>${esc(c)}</li>`).join("") + (e.safe ? `<li class="safe">${esc(e.safe)}</li>` : "");
  const v = $("#vm-video"), msg = $("#vm-msg");
  v.removeAttribute("src"); v.load(); msg.textContent = ""; m.classList.add("show"); document.body.classList.add("noscroll");
  if (!ensureKey()) { msg.innerHTML = `محتاج كود الفيديوهات الأول. <button class="link" data-act="tab" data-tab="settings" onclick="closeVideo()">روح للإعدادات</button>`; return; }
  msg.textContent = "بيحمّل…";
  try {
    if (!blobCache[e.video]) {
      const res = await fetch(`v/${e.video}.bin`);
      if (!res.ok) throw new Error("net");
      const pt = await decrypt(await ensureKey(), await res.arrayBuffer());
      blobCache[e.video] = URL.createObjectURL(new Blob([pt], { type: "video/mp4" }));
    }
    if (!m.classList.contains("show")) return;
    v.src = blobCache[e.video]; msg.textContent = ""; v.play().catch(() => {});
  } catch (err) { msg.textContent = navigator.onLine ? "حصلت مشكلة في الفيديو، جرب تاني" : "الفيديو ده مش متنزل. افتح التطبيق مرة على واي فاي ونزّل الفيديوهات من الإعدادات"; }
}
function closeVideo() { const v = $("#vm-video"); v.pause(); $("#video-modal").classList.remove("show"); document.body.classList.remove("noscroll"); }
window.closeVideo = closeVideo;

const VIDEOS = [...new Set(Object.values(EX).map(e => e.video))];
async function offlineStatus() {
  if (!("caches" in window)) return;
  const el = $("#offline-status");
  const c = await caches.open("gym-videos");
  let n = 0; for (const v of VIDEOS) if (await c.match(new URL(`v/${v}.bin`, location.href).href)) n++;
  const chip = $("#net-chip"); chip.hidden = n !== VIDEOS.length; chip.classList.toggle("ready", n === VIDEOS.length);
  if (el) el.textContent = n === VIDEOS.length ? `✓ كل الفيديوهات متنزلة (${n}) وشغالة من غير نت` : `متنزل ${n} من ${VIDEOS.length} فيديو`;

  return n;
}
let downloading = false;
async function downloadAll() {
  if (downloading || !("caches" in window)) return; downloading = true;
  const c = await caches.open("gym-videos"); let i = 0;
  for (const v of VIDEOS) {
    const url = new URL(`v/${v}.bin`, location.href).href;
    if (!(await c.match(url))) { try { const r = await fetch(url, { cache: "reload" }); if (r.ok) await c.put(url, r.clone()); } catch (e) {} }
    i++; const el = $("#offline-status"); if (el) el.textContent = `بينزّل… ${i}/${VIDEOS.length}`;
  }
  downloading = false; offlineStatus();
}

// ============ نسخة احتياطية ============
async function exportData() {
  const data = JSON.stringify({ ...store, code: undefined }, null, 1);
  const file = new File([data], `gym-backup-${todayKey()}.json`, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "Gym backup" }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
}
function importData(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.days) throw 0;
      const code = store.code;
      Object.keys(store).forEach(k => delete store[k]); Object.assign(store, d, { code });
      store.gates = store.gates || {}; store.physio = store.physio || []; store.body = store.body || [];
      save(); render(); toast("اترجعت النسخة");
    } catch (e) { toast("الملف ده مش نسخة صحيحة"); }
  };
  r.readAsText(f);
}

// ============ البداية ============
function header() {
  const d = new Date();
  $("#hdr-date").textContent = `${DAY_NAMES[d.getDay()]} ${short(d)}`;
}
header(); render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(() => { if (store.code) downloadAll(); else offlineStatus(); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
// لو اليوم اتغير والتطبيق مفتوح
document.addEventListener("visibilitychange", () => { if (!document.hidden) { header(); if (ui.tab === "today" && ui.follow && ui.date !== todayKey()) { ui.date = todayKey(); render(); } if (wakeLock === null && timer.id) keepAwake(); } });
// بانر الإضافة للشاشة الرئيسية
if (!navigator.standalone && !matchMedia("(display-mode: standalone)").matches) $("#a2hs").hidden = false;
