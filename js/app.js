/* =========================================================
   班級儀表板（山林版） — 臺東縣金峰鄉嘉蘭國小
   資料全部存在這台電腦的瀏覽器 localStorage
   ========================================================= */
(() => {
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const WEEK = '日一二三四五六';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
const SP = window.SPECIES, CATS = window.SPECIES_CATS, RAR = window.RARITY;
const spById = id => SP.find(s => s.id === id);

/* ---------------- 資料 ---------------- */
const KEY = 'jialan-class-dashboard-v1';
const DEFAULT_SCHEDULE = [
  ['07:50', '08:30', '早自修', '一二三四五'],
  ['08:40', '09:20', '第一節', '一二三四五'],
  ['09:30', '10:10', '第二節', '一二三四五'],
  ['10:10', '10:30', '大下課', '一二三四五'],
  ['10:30', '11:10', '第三節', '一二三四五'],
  ['11:20', '12:00', '第四節', '一二三四五'],
  ['12:00', '12:40', '午餐時間', '一二三四五'],
  ['12:40', '13:20', '午休', '一二四五'],
  ['13:30', '14:10', '第五節', '一二四五'],
  ['14:20', '15:00', '第六節', '一二四五'],
  ['15:10', '15:50', '第七節', '一二四五'],
  ['15:50', '16:00', '打掃・放學', '一二四五'],
  ['16:00', '16:40', '第八節', ''],
  ['16:50', '17:30', '第九節', '']
].map(([start, end, name, days]) => ({ start, end, name, days, slot: inferSlot(name) }));
// 第幾節 ↔ 課表欄位 p1～p9
const CN_NUM = '一二三四五六七八九';
const SLOTS = Array.from({ length: 9 }, (_, i) => 'p' + (i + 1));
const slotName = s => `第${CN_NUM[+s.slice(1) - 1]}節`;
function inferSlot(name) {
  const m = String(name || '').match(/第\s*([一二三四五六七八九\d])\s*節/);
  if (!m) return '';
  const n = /\d/.test(m[1]) ? +m[1] : '一二三四五六七八九'.indexOf(m[1]) + 1;
  return n >= 1 && n <= 9 ? 'p' + n : '';
}
const SUBJECTS = ['國語', '數學', '英語', '社會', '自然', '健康', '體育', '音樂', '視覺藝術', '表演藝術', '綜合', '本土語', '族語', '閩南語', '資訊', '閱讀', '彈性', '生活', '學扶', '社團', '班會', '導師時間'];

function defaults() {
  return {
    settings: {
      setupDone: false,
      school: '臺東縣金峰鄉嘉蘭國民小學',
      className: '六年甲班',
      schoolYear: '',
      semester: '',
      studentEdit: false,
      announcement: '歡迎蒞臨臺東縣金峰鄉嘉蘭國民小學',
      maxSeat: 20,
      vacant: [],
      names: {},
      pwHash: '',
      loc: { name: '臺東縣 金峰鄉', lat: 22.60, lon: 120.96, source: 'openmeteo', cwaKey: '', cwaDataset: 'F-D0047-037', cwaTown: '金峰鄉' }
    },
    schedule: DEFAULT_SCHEDULE.map(r => ({ ...r })),
    timetable: {}, // { 1: { p1: '國語', ... }, ... 5: {...} }，1=星期一
    contact: {},
    countdowns: [],
    taskDefs: [
      { id: 't1', name: '繳交作業' },
      { id: 't2', name: '訂正完成' },
      { id: 't3', name: '打掃完成' },
      { id: 't4', name: '放學整理' }
    ],
    done: {},
    students: {},
    forest: { level: 1, points: 0 },
    log: [],
    ui: { widgetTask: 't1', pageTask: 't1' }
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = defaults(), s = JSON.parse(raw);
    // 舊版作息表沒有「節次」欄位，依名稱推算
    (s.schedule || []).forEach(r => { if (r.slot === undefined) r.slot = inferSlot(r.name); });
    // 舊版把「115學年度第一學期」整串放在學年度，拆成學年度＋學期
    const m = String(s.settings?.schoolYear || '').match(/(\d+)\s*學年度?\s*(?:第\s*([一二12])\s*學期)?/);
    if (m && s.settings) { s.settings.schoolYear = m[1]; if (m[2] && !s.settings.semester) s.settings.semester = { 1: '一', 2: '二' }[m[2]] || m[2]; }
    return { ...d, ...s, settings: { ...d.settings, ...s.settings, loc: { ...d.settings.loc, ...(s.settings?.loc || {}) } }, ui: { ...d.ui, ...s.ui }, forest: { ...d.forest, ...s.forest } };
  } catch (e) { console.warn(e); return defaults(); }
}
let state = load();
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ 無法儲存資料（瀏覽器儲存空間不足或被封鎖）'); }
  }, 150);
}

const activeSeats = () => {
  const v = new Set(state.settings.vacant.map(Number));
  return Array.from({ length: Number(state.settings.maxSeat) || 0 }, (_, i) => i + 1).filter(n => !v.has(n));
};
const nameOf = n => state.settings.names[n] || '';
const stu = n => (state.students[n] ||= { coins: 0, nextAt: 10, species: [] });
const todayDone = () => (state.done[dateKey()] ||= {});
const classSpecies = () => {
  const set = new Set();
  activeSeats().forEach(n => (state.students[n]?.species || []).forEach(id => set.add(id)));
  return set;
};

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

/* ---------------- 頁面切換 ---------------- */
function goto(page) {
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  $$('.bottomnav [data-goto]').forEach(b => b.classList.toggle('active', b.dataset.goto === page));
  renderPage(page);
}
function renderPage(page) {
  if (page === 'tasks') renderTasksPage();
  if (page === 'students') renderStudents();
  if (page === 'dex') renderDex();
  if (page === 'stats') renderStats();
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]');
  if (g) goto(g.dataset.goto);
});

function bindTabs(group, onChange) {
  const wrap = $(`[data-tabs="${group}"]`);
  const panel = wrap.parentElement;
  wrap.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', wrap).forEach(x => x.classList.toggle('active', x === b));
    $$(':scope > [data-body]', panel).forEach(x => x.classList.toggle('hidden', x.dataset.body !== b.dataset.tab));
    onChange && onChange(b.dataset.tab);
  });
}

/* ---------------- 頂部 ---------------- */
function renderHeader() {
  const s = state.settings;
  const term = termText();
  $('#schoolName').textContent = s.school + (term ? `　${term}` : '');
  $('#className').textContent = s.className;
  document.title = `${s.className}｜班級儀表板`;
  const ann = (s.announcement || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const annEl = $('#annText');
  annEl.textContent = ann.length ? ann.join('　　★　　') : '（尚無公告，老師可以點這裡輸入）';
  annEl.classList.toggle('placeholder', !ann.length);
  annEl.style.animationDuration = Math.max(14, annEl.textContent.length * .45) + 's';
  const seats = activeSeats();
  $('#statCoins').textContent = seats.reduce((a, n) => a + (state.students[n]?.coins || 0), 0);
  $('#statEnergy').textContent = todayRate() + '%';
  $('#statDex').textContent = `${classSpecies().size}/${SP.length}`;
  $('#forestLv').textContent = 'Lv.' + state.forest.level;
  $('#forestPts').textContent = `${state.forest.points}/100`;
  $('#forestBar').style.width = Math.min(100, state.forest.points) + '%';
}
function termText(s = state.settings) {
  const y = String(s.schoolYear || '').trim();
  if (!y) return '';
  const base = /學年/.test(y) ? y : `${y}學年度`;
  return s.semester && !/學期/.test(base) ? `${base}第${s.semester}學期` : base;
}
// 依今天日期推算民國學年度與學期（8 月起為新學年；2～7 月為第二學期）
function guessTerm(d = new Date()) {
  const m = d.getMonth() + 1, roc = d.getFullYear() - 1911;
  return { year: String(m >= 8 ? roc : roc - 1), sem: m >= 2 && m <= 7 ? '二' : '一' };
}
function termFields(s, prefix) {
  const g = guessTerm();
  const y = s.schoolYear || g.year, sem = s.schoolYear ? s.semester : g.sem;
  return `<div class="row2">
      <div class="field"><span>學年度（只填數字，例如 115）</span><input id="${prefix}Year" value="${esc(String(y).replace(/學年度?.*$/, ''))}" placeholder="115"></div>
      <div class="field"><span>學期</span><select id="${prefix}Sem">
        <option value="" ${!sem ? 'selected' : ''}>不顯示學期</option>
        <option value="一" ${sem === '一' ? 'selected' : ''}>第一學期</option>
        <option value="二" ${sem === '二' ? 'selected' : ''}>第二學期</option></select></div>
    </div>`;
}
function todayRate(key = dateKey()) {
  const seats = activeSeats(), rec = state.done[key];
  if (!rec || !seats.length || !state.taskDefs.length) return 0;
  const set = new Set(seats);
  let n = 0;
  state.taskDefs.forEach(t => (rec[t.id] || []).forEach(s => set.has(s) && n++));
  return Math.round(n / (seats.length * state.taskDefs.length) * 100);
}

/* ---------------- 作息表 ---------------- */
const dayTT = wd => state.timetable?.[wd] || {};
const hasTT = wd => Object.values(dayTT(wd)).some(v => String(v || '').trim());
// 上課節次：該天課表有填 → 依課表（空格=沒課）；該天課表全空 → 依作息表的「星期」欄
function todaySchedule(d = new Date()) {
  const wd = d.getDay(), wdc = WEEK[wd], tt = dayTT(wd), useTT = hasTT(wd);
  return state.schedule
    .filter(r => r.slot ? (useTT ? !!String(tt[r.slot] || '').trim() : (r.days || '').includes(wdc)) : (!r.days || r.days.includes(wdc)))
    .map(r => ({ ...r, subject: r.slot ? String(tt[r.slot] || '').trim() : '' }))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}
const periodLabel = r => r.subject ? `${r.name}・${r.subject}` : r.name;
const periodHTML = r => r.subject ? `${esc(r.subject)} <small class="np-slot">${esc(r.name)}</small>` : esc(r.name);
function renderSchedule() {
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const list = todaySchedule(d);
  $('#schedDate').textContent = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  const box = $('#nowPeriod');
  if (!list.length) {
    $('#schedList').innerHTML = '';
    box.innerHTML = `<div class="np-name">今天是假日 🌿</div><div class="np-sub">好好休息，下週見！</div>`;
    return null;
  }
  let cur = null, next = null;
  $('#schedList').innerHTML = list.map(r => {
    const s = toMin(r.start), e = toMin(r.end);
    let cls = '';
    if (now >= e) cls = 'past';
    else if (now >= s) { cls = 'now'; cur = r; }
    else if (!next) next = r;
    return `<li class="${cls}"><span>${r.start}–${r.end}</span><span>${r.subject ? `<small class="sl-slot">${esc(r.name)}</small> <b>${esc(r.subject)}</b>` : esc(r.name)}</span></li>`;
  }).join('');
  if (cur) {
    const left = Math.max(0, toMin(cur.end) - now);
    box.innerHTML = `<div class="np-sub">現在是</div><div class="np-name">${periodHTML(cur)}</div>
      <div class="np-sub">還有 ${Math.floor(left)} 分 ${pad(Math.floor((left % 1) * 60))} 秒${next ? `・下一個：${esc(periodLabel(next))}` : ''}</div>
      <div class="bar"><i style="width:${(now - toMin(cur.start)) / (toMin(cur.end) - toMin(cur.start)) * 100}%"></i></div>`;
  } else if (next) {
    const left = toMin(next.start) - now;
    box.innerHTML = `<div class="np-sub">下課／休息中</div><div class="np-name">下一個：${periodHTML(next)}</div>
      <div class="np-sub">${next.start} 開始，還有 ${Math.ceil(left)} 分鐘</div>`;
  } else {
    box.innerHTML = `<div class="np-name">今天的課程結束了 🎒</div><div class="np-sub">路上小心，明天見！</div>`;
  }
  return cur || next;
}

/* ---------------- 整週課表 ---------------- */
function slotTime(slot) { const r = state.schedule.find(x => x.slot === slot); return r ? `${r.start}–${r.end}` : ''; }
function weekTableHTML() {
  const d = new Date(), today = d.getDay(), now = d.getHours() * 60 + d.getMinutes();
  const curSlot = (state.schedule.find(r => r.slot && toMin(r.start) <= now && now < toMin(r.end)) || {}).slot;
  const rows = SLOTS.filter(s => [1, 2, 3, 4, 5].some(w => String(dayTT(w)[s] || '').trim()));
  if (!rows.length) return '<div class="empty">還沒有填寫週課表。請到「教師控制台 → 週課表」填寫，或從 Excel／照片匯入。</div>';
  return `<table class="week-table"><thead><tr><th></th>${[1, 2, 3, 4, 5].map(w => `<th class="${w === today ? 'today' : ''}">星期${WEEK[w]}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(s => `<tr><th>${slotName(s)}<small>${slotTime(s)}</small></th>${[1, 2, 3, 4, 5].map(w => {
      const v = String(dayTT(w)[s] || '').trim();
      return `<td class="${w === today ? 'today' : ''} ${w === today && s === curSlot ? 'now' : ''} ${v ? '' : 'none'}">${esc(v) || '—'}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
}
$('#weekBtn').onclick = () => openModal(`<button class="close" data-close>✕</button>
  <h2>📅 ${esc(state.settings.className)} 週課表</h2><p class="sub">${esc(termText())}　今天的欄位以綠色標示，正在上的課會發亮。</p>
  ${weekTableHTML()}`, { wide: true });

/* ---------------- 聯絡簿 ---------------- */
function renderContact() {
  const key = dateKey();
  let items = state.contact[key] || [];
  let label = `${new Date().getMonth() + 1}/${new Date().getDate()}`;
  let old = false;
  if (!items.length) {
    const prev = Object.keys(state.contact).filter(k => k < key && state.contact[k].length).sort().pop();
    if (prev) { items = state.contact[prev]; label = `${+prev.slice(5, 7)}/${+prev.slice(8)}（前次）`; old = true; }
  }
  $('#contactDate').textContent = label;
  $('#contactList').innerHTML = items.map(it =>
    `<li style="${old ? 'opacity:.55' : ''}"><span class="txt">${esc(it.text)}</span>${old ? '' : `<button class="del" data-id="${it.id}" title="刪除">✕</button>`}</li>`).join('');
  $('#contactEmpty').classList.toggle('hidden', items.length > 0);
  updateLockUI();
}
const canEditBoard = () => state.settings.studentEdit || isAuthed();
$$('.lock-hint').forEach(b => b.onclick = () => teacherOpen('unlock'));
$('#contactForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!canEditBoard()) return;
  const v = $('#contactInput').value.trim(); if (!v) return;
  const key = dateKey();
  (state.contact[key] ||= []).push({ id: uid(), text: v });
  const keys = Object.keys(state.contact).sort();
  while (keys.length > 60) delete state.contact[keys.shift()];
  $('#contactInput').value = '';
  save(); renderContact();
});
$('#contactList').addEventListener('click', e => {
  const b = e.target.closest('.del'); if (!b || !canEditBoard()) return;
  const key = dateKey();
  state.contact[key] = (state.contact[key] || []).filter(i => i.id !== b.dataset.id);
  save(); renderContact();
});

/* ---------------- 倒數日 ---------------- */
function daysUntil(ds) {
  const t = new Date(ds + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.round((t - n) / 86400000);
}
function renderCountdowns() {
  const list = [...state.countdowns].sort((a, b) => a.date.localeCompare(b.date));
  $('#cdList').innerHTML = list.length ? list.map(c => {
    const d = daysUntil(c.date);
    const txt = d > 0 ? `${d}<small>天</small>` : d === 0 ? '<small style="color:var(--gold);font-size:20px">就是今天</small>' : `<small>已過</small>`;
    return `<li style="${d < 0 ? 'opacity:.45' : ''}"><div class="days">${txt}</div>
      <div class="info"><b>${esc(c.name)}</b><span>${c.date.replace(/-/g, '/')}（${WEEK[new Date(c.date + 'T00:00').getDay()]}）</span></div>
      <button class="del" data-id="${c.id}" title="刪除">✕</button></li>`;
  }).join('') : '<div class="empty">還沒有倒數事件，在下方新增，例如：校慶、段考、畢業典禮。</div>';
  updateLockUI();
}
$('#cdForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!canEditBoard()) return;
  state.countdowns.push({ id: uid(), name: $('#cdName').value.trim(), date: $('#cdDate').value });
  $('#cdName').value = ''; $('#cdDate').value = '';
  save(); renderCountdowns();
});
$('#cdList').addEventListener('click', e => {
  const b = e.target.closest('.del'); if (!b || !canEditBoard()) return;
  if (!confirm('刪除這個倒數事件？')) return;
  state.countdowns = state.countdowns.filter(c => c.id !== b.dataset.id);
  save(); renderCountdowns();
});

/* ---------------- 天氣 ---------------- */
const WMO = c => c === 0 ? ['☀️', '晴'] : c <= 2 ? ['🌤️', '晴時多雲'] : c === 3 ? ['☁️', '陰'] : c <= 48 ? ['🌫️', '有霧']
  : c <= 57 ? ['🌦️', '毛毛雨'] : c <= 67 ? ['🌧️', '下雨'] : c <= 77 ? ['🌨️', '降雪'] : c <= 82 ? ['🌧️', '陣雨'] : ['⛈️', '雷雨'];
const wxIcon = t => /雷/.test(t) ? '⛈️' : /雪/.test(t) ? '🌨️' : /雨/.test(t) ? '🌧️' : /霧/.test(t) ? '🌫️' : /陰/.test(t) ? '☁️' : /晴/.test(t) && /雲/.test(t) ? '🌤️' : /雲/.test(t) ? '⛅' : /晴/.test(t) ? '☀️' : '🌡️';
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
async function getJSON(url, ms = 12000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === 'false' || j.error) throw new Error(j.message || j.reason || 'HTTP ' + r.status);
    return j;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? '連線逾時' : e instanceof TypeError ? '無法連線（網路中斷，或授權碼不正確）' : e.message || '網路錯誤');
  }
  finally { clearTimeout(t); }
}
async function fetchOpenMeteo(L) {
  const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=1`);
  const temp = num(j.current?.temperature_2m);
  if (temp === null) throw new Error('資料格式不符');
  const [icon, text] = WMO(j.current.weather_code ?? 0);
  return { icon, text, temp, min: num(j.daily?.temperature_2m_min?.[0]), max: num(j.daily?.temperature_2m_max?.[0]), pop: num(j.daily?.precipitation_probability_max?.[0]), src: 'Open-Meteo' };
}
// 中央氣象署 鄉鎮天氣預報（同時相容新舊兩種 JSON 欄位格式）
async function fetchCWA(L) {
  const j = await getJSON(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/${encodeURIComponent(L.cwaDataset || 'F-D0047-037')}?Authorization=${encodeURIComponent(L.cwaKey)}&format=JSON&LocationName=${encodeURIComponent(L.cwaTown || '金峰鄉')}`);
  const rec = j.records || {};
  const locs = (rec.Locations || rec.locations || []).flatMap(x => x.Location || x.location || []);
  const town = L.cwaTown || '金峰鄉';
  const loc = locs.find(l => (l.LocationName || l.locationName) === town);
  if (!loc) throw new Error(`資料中找不到「${town}」`);
  const els = loc.WeatherElement || loc.weatherElement || [];
  const el = names => els.find(e => names.includes(e.ElementName || e.elementName));
  const times = e => e?.Time || e?.time || [];
  const tParse = s => s ? new Date(String(s).replace(' ', 'T')).getTime() : NaN;
  const tStart = x => tParse(x.StartTime || x.startTime || x.DataTime || x.dataTime);
  const tEnd = x => tParse(x.EndTime || x.endTime) || tStart(x) + 3 * 3600e3;
  const val = x => { const v = (x?.ElementValue || x?.elementValue || [])[0]; return v ? Object.values(v)[0] : x?.parameter?.parameterName; };
  const now = Date.now();
  const pick = e => {
    const ts = times(e); if (!ts.length) return null;
    return ts.filter(x => tStart(x) <= now && now < tEnd(x)).pop() || ts.reduce((a, b) => Math.abs(tStart(b) - now) < Math.abs(tStart(a) - now) ? b : a);
  };
  const tEl = el(['溫度', 'T']);
  const temp = num(val(pick(tEl)));
  const text = String(val(pick(el(['天氣現象', 'Wx']))) || '');
  const pop = num(val(pick(el(['3小時降雨機率', '6小時降雨機率', '12小時降雨機率', 'PoP3h', 'PoP6h', 'PoP12h']))));
  const today = dateKey();
  const todayVals = times(tEl).filter(x => dateKey(new Date(tStart(x))) === today).map(x => num(val(x))).filter(v => v !== null);
  const mx = num(val(pick(el(['最高溫度', 'MaxT'])))), mn = num(val(pick(el(['最低溫度', 'MinT']))));
  if (temp === null && !text) throw new Error('資料格式不符');
  return { icon: wxIcon(text), text: text || '—', temp, min: mn ?? (todayVals.length ? Math.min(...todayVals) : null), max: mx ?? (todayVals.length ? Math.max(...todayVals) : null), pop, src: '中央氣象署' };
}
let wLast = null, wRetry = null;
async function loadWeather() {
  const L = state.settings.loc;
  $('#wLoc').textContent = L.name;
  clearTimeout(wRetry);
  const errs = []; let data = null;
  if (L.source === 'cwa') {
    if (!L.cwaKey) errs.push('尚未填氣象署授權碼');
    else try { data = await fetchCWA(L); } catch (e) { errs.push('氣象署：' + e.message); }
  }
  if (!data) try { data = await fetchOpenMeteo(L); } catch (e) { errs.push('Open-Meteo：' + e.message); }
  if (data) {
    wLast = { ...data, at: new Date() };
    $('#wIcon').textContent = data.icon;
    $('#wTemp').textContent = data.temp !== null ? Math.round(data.temp) + '°C' : '--°C';
    $('#wRange').textContent = data.min !== null && data.max !== null ? `${Math.round(data.min)}° / ${Math.round(data.max)}°` : '';
    $('#wDesc').textContent = `${data.text}　降雨機率 ${data.pop ?? '--'}%`;
    $('#wSrc').textContent = `資料來源：${data.src}・${pad(wLast.at.getHours())}:${pad(wLast.at.getMinutes())} 更新`;
  } else {
    console.warn('天氣更新失敗', errs);
    wRetry = setTimeout(loadWeather, 5 * 60e3); // 5 分鐘後自動重試
    if (wLast) $('#wSrc').textContent = `⚠️ 更新失敗，顯示 ${pad(wLast.at.getHours())}:${pad(wLast.at.getMinutes())} 的資料，稍後自動重試`;
    else { $('#wDesc').textContent = '天氣暫時無法取得，5 分鐘後自動重試'; $('#wSrc').textContent = errs.join('；'); }
  }
  return { ok: !!data, src: data?.src, errs };
}

/* ---------------- 時鐘與每秒更新 ---------------- */
function tick() {
  const d = new Date();
  const hh = pad(d.getHours()), mm = pad(d.getMinutes()), ss = pad(d.getSeconds());
  $('#bigClock').innerHTML = `${hh}:${mm}<span>${ss}</span>`;
  updateLockUI();
  $('#wDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日　星期${WEEK[d.getDay()]}`;
  const cur = renderSchedule();
  const sub = cur ? (toMin(cur.start) <= d.getHours() * 60 + d.getMinutes() ? `現在：${periodLabel(cur)}` : `下一個：${periodLabel(cur)}（${cur.start}）`) : `星期${WEEK[d.getDay()]}`;
  $('#clockSub').textContent = sub;
  if (document.body.classList.contains('clean')) {
    $('#cleanClock').innerHTML = `<div class="cc-time">${hh}:${mm}</div><div class="cc-sub">${esc(state.settings.className)}・${esc(sub)}</div><div class="cc-hint">點一下畫面回到儀表板</div>`;
  }
  if (d.getSeconds() === 0) {
    updateSky();
    if (d.getMinutes() % 30 === 0) loadWeather();
    if (d.getHours() === 0 && d.getMinutes() === 0) renderAll();
  }
}

/* ---------------- 背景天空 ---------------- */
function updateSky() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const night = h < 5.5 || h >= 18.8, dusk = (h >= 5.5 && h < 6.8) || (h >= 17.3 && h < 18.8);
  document.body.classList.toggle('night', night);
  document.body.classList.toggle('dusk', dusk && !night);
  const sky = night ? ['#0b1530', '#1c2b4a', '#2c3f55'] : dusk ? ['#3b3a6b', '#c77d7a', '#f2c48d'] : ['#3d7ea6', '#8fc4d6', '#dceccf'];
  ['#sky0', '#sky1', '#sky2'].forEach((id, i) => $(id).setAttribute('stop-color', sky[i]));
  // 太陽/月亮軌跡
  let t = night ? ((h < 12 ? h + 24 : h) - 18.8) / 10.7 : (h - 5.5) / 13.3;
  t = Math.max(0, Math.min(1, t));
  const x = 150 + t * 1300, y = 420 - Math.sin(t * Math.PI) * 330;
  ['#sunHalo', '#sunDisc'].forEach(id => { $(id).setAttribute('cx', x); $(id).setAttribute('cy', y); });
  $('#sunDisc').setAttribute('fill', night ? '#e8ecf5' : dusk ? '#ffd29a' : '#fff3c4');
  $('#sunDisc').setAttribute('r', night ? 30 : 46);
  $('#sunHalo').style.opacity = night ? .35 : 1;
  $('#stars').style.display = night ? '' : 'none';
}
function buildStars() {
  let h = '';
  for (let i = 0; i < 90; i++) {
    h += `<circle cx="${Math.random() * 1600}" cy="${Math.random() * 420}" r="${Math.random() * 1.6 + .4}" style="animation-delay:${-Math.random() * 3}s"/>`;
  }
  $('#stars').innerHTML = h;
}
function renderCritters() {
  const box = $('#critters');
  const found = [...classSpecies()].map(spById).filter(Boolean);
  let h = '';
  // 班級山林等級 → 樹
  const trees = Math.min(4 + state.forest.level * 3, 40);
  for (let i = 0; i < trees; i++) {
    const left = (i * 37 + 11) % 100, size = 22 + ((i * 7) % 18);
    h += `<span class="critter sway" style="left:${left}%;bottom:${3 + (i % 5) * 2.2}%;font-size:${size}px;animation-delay:-${i % 4}s">${i % 3 ? '🌲' : '🌳'}</span>`;
  }
  found.slice(0, 24).forEach((sp, i) => {
    const r = (i * 53 % 97) / 97;
    if (sp.cat === 'bird') h += `<span class="critter fly" style="top:${8 + r * 22}%;left:0;animation-duration:${30 + r * 30}s;animation-delay:-${r * 50}s">${sp.emoji}</span>`;
    else if (sp.cat === 'insect') h += `<span class="critter flutter" style="top:${52 + r * 22}%;left:${5 + r * 85}%;animation-duration:${4 + r * 4}s;font-size:22px">${sp.emoji}</span>`;
    else if (sp.cat === 'animal') h += `<span class="critter walk" style="bottom:${12 + r * 8}%;left:${5 + r * 80}%;animation-duration:${6 + r * 6}s">${sp.emoji}</span>`;
    else h += `<span class="critter sway" style="bottom:${2 + r * 6}%;left:${3 + r * 92}%;font-size:30px">${sp.emoji}</span>`;
  });
  box.innerHTML = h;
}

/* ---------------- 音效 ---------------- */
let actx, ambGain;
function ensureAudio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    ambGain = actx.createGain(); ambGain.gain.value = $('#ambVol').value / 100 * .6; ambGain.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
}
function beep(times = 3) {
  ensureAudio();
  for (let i = 0; i < times; i++) {
    [0, .18].forEach(off => {
      const o = actx.createOscillator(), g = actx.createGain();
      const t = actx.currentTime + i * .7 + off;
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .15);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .16);
    });
  }
}
function chime() {
  ensureAudio();
  [523, 659, 784, 1047].forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * .12;
    o.frequency.value = f; o.type = 'triangle';
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .5);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .5);
  });
}
function noiseBuf(type) {
  const len = actx.sampleRate * 3, b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
const AMB = [
  { id: 'none', icon: '🔇', name: '無', sub: '安靜模式' },
  { id: 'stream', icon: '🏞️', name: '溪流潺潺', sub: '太麻里溪水聲' },
  { id: 'wind', icon: '🍃', name: '山谷微風', sub: '風吹過樹林' },
  { id: 'rain', icon: '🌧️', name: '山間細雨', sub: '雨落在葉子上' },
  { id: 'birds', icon: '🐦', name: '山林鳥鳴', sub: '清晨的森林' },
  { id: 'night', icon: '🌙', name: '夏夜蟲鳴', sub: '草叢裡的合唱' }
];
let ambNodes = [], ambTimers = [], ambCur = 'none';
function stopAmbient() {
  ambNodes.forEach(n => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
  ambTimers.forEach(clearInterval); ambNodes = []; ambTimers = [];
}
function noiseSrc(type) { const s = actx.createBufferSource(); s.buffer = noiseBuf(type); s.loop = true; ambNodes.push(s); return s; }
function lfo(freq, depth, target) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); o.start(); ambNodes.push(o, g);
}
function chirp(t, f1, f2, dur, vol, dest) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .2); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + .02);
}
function playAmbient(id) {
  stopAmbient(); ambCur = id;
  $$('#ambList li').forEach(li => li.classList.toggle('on', li.dataset.id === id));
  if (id === 'none') return;
  ensureAudio();
  const out = ambGain;
  if (id === 'stream') {
    const s = noiseSrc('white'), bp = actx.createBiquadFilter(), lp = actx.createBiquadFilter(), g = actx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .6; lp.type = 'lowpass'; lp.frequency.value = 2600; g.gain.value = .5;
    s.connect(bp).connect(lp).connect(g).connect(out); lfo(.25, 300, bp.frequency); lfo(.4, .12, g.gain); s.start(); ambNodes.push(bp, lp, g);
  } else if (id === 'wind') {
    const s = noiseSrc('brown'), lp = actx.createBiquadFilter(), g = actx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 450; g.gain.value = .55;
    s.connect(lp).connect(g).connect(out); lfo(.07, .35, g.gain); lfo(.11, 200, lp.frequency); s.start(); ambNodes.push(lp, g);
  } else if (id === 'rain') {
    const s = noiseSrc('white'), hp = actx.createBiquadFilter(), lp = actx.createBiquadFilter(), g = actx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 1200; lp.type = 'lowpass'; lp.frequency.value = 7000; g.gain.value = .22;
    s.connect(hp).connect(lp).connect(g).connect(out); s.start(); ambNodes.push(hp, lp, g);
    ambTimers.push(setInterval(() => {
      for (let i = 0; i < 4; i++) { const t = actx.currentTime + Math.random() * .25; chirp(t, 2500 + Math.random() * 3000, 1200, .03, .05, out); }
    }, 250));
  } else if (id === 'birds') {
    const s = noiseSrc('brown'), lp = actx.createBiquadFilter(), g = actx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 400; g.gain.value = .18; s.connect(lp).connect(g).connect(out); s.start(); ambNodes.push(lp, g);
    ambTimers.push(setInterval(() => {
      if (Math.random() < .55) return;
      const base = 2200 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4), sp = .09 + Math.random() * .08;
      for (let i = 0; i < n; i++) { const t = actx.currentTime + i * sp; chirp(t, base, base * (1.25 + Math.random() * .4), .07, .07, out); }
    }, 700));
  } else if (id === 'night') {
    const s = noiseSrc('brown'), lp = actx.createBiquadFilter(), g = actx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 300; g.gain.value = .15; s.connect(lp).connect(g).connect(out); s.start(); ambNodes.push(lp, g);
    [[4300, .04], [3700, .03]].forEach(([f, v], k) => {
      const o = actx.createOscillator(), am = actx.createGain(), gate = actx.createGain();
      o.frequency.value = f; am.gain.value = 0; gate.gain.value = v;
      o.connect(am).connect(gate).connect(out); o.start();
      lfo(28 + k * 9, .5, am.gain);
      lfo(.5 + k * .3, v, gate.gain);
      ambNodes.push(o, am, gate);
    });
  }
}
function renderAmbient() {
  $('#ambList').innerHTML = AMB.map(a => `<li data-id="${a.id}" class="${a.id === ambCur ? 'on' : ''}"><span class="ai">${a.icon}</span><div><b>${a.name}</b><small>${a.sub}</small></div></li>`).join('');
}
$('#ambList').addEventListener('click', e => { const li = e.target.closest('li'); if (li) playAmbient(li.dataset.id); });
$('#ambVol').addEventListener('input', e => { if (ambGain) ambGain.gain.value = e.target.value / 100 * .6; });

/* ---------------- 倒數計時 ---------------- */
const timer = { total: 300, left: 300, running: false, end: 0, iv: null };
function showTimer() {
  const l = Math.max(0, Math.ceil(timer.left));
  $('#timerDisp').textContent = `${pad(Math.floor(l / 60))}:${pad(l % 60)}`;
  $('#timerStart').textContent = timer.running ? '暫停' : '開始';
}
function timerSet(sec) { timer.total = timer.left = Math.max(0, sec); timer.running = false; clearInterval(timer.iv); $('#timerDisp').classList.remove('ringing'); showTimer(); }
$$('.presets button').forEach(b => b.onclick = () => timerSet(b.dataset.min * 60));
$('#timerPlus').onclick = () => { timer.left += 60; if (timer.running) timer.end += 60000; showTimer(); };
$('#timerMinus').onclick = () => { timer.left = Math.max(0, timer.left - 60); if (timer.running) timer.end -= 60000; showTimer(); };
$('#timerReset').onclick = () => timerSet(timer.total);
$('#timerStart').onclick = () => {
  ensureAudio();
  $('#timerDisp').classList.remove('ringing');
  if (timer.running) { timer.running = false; clearInterval(timer.iv); showTimer(); return; }
  if (timer.left <= 0) return;
  timer.running = true; timer.end = Date.now() + timer.left * 1000;
  timer.iv = setInterval(() => {
    timer.left = (timer.end - Date.now()) / 1000;
    if (timer.left <= 0) { timer.left = 0; timer.running = false; clearInterval(timer.iv); $('#timerDisp').classList.add('ringing'); beep(4); toast('⏰ 時間到！'); }
    showTimer();
  }, 200);
  showTimer();
};

/* ---------------- 番茄鐘 ---------------- */
const pomo = { focus: true, left: 25 * 60, running: false, end: 0, iv: null, count: 0 };
function showPomo() {
  const l = Math.max(0, Math.ceil(pomo.left));
  $('#pomoDisp').textContent = `${pad(Math.floor(l / 60))}:${pad(l % 60)}`;
  $('#pomoMode').textContent = pomo.focus ? '🍅 專心時間' : '☕ 休息一下';
  $('#pomoMode').classList.toggle('break', !pomo.focus);
  $('#pomoStart').textContent = pomo.running ? '暫停' : '開始';
  $('#pomoCount').textContent = pomo.count;
}
function pomoNext() {
  if (pomo.focus) pomo.count++;
  pomo.focus = !pomo.focus; pomo.left = (pomo.focus ? 25 : 5) * 60; pomo.running = false; clearInterval(pomo.iv); showPomo();
}
$('#pomoStart').onclick = () => {
  ensureAudio();
  if (pomo.running) { pomo.running = false; clearInterval(pomo.iv); showPomo(); return; }
  pomo.running = true; pomo.end = Date.now() + pomo.left * 1000;
  pomo.iv = setInterval(() => {
    pomo.left = (pomo.end - Date.now()) / 1000;
    if (pomo.left <= 0) { beep(3); toast(pomo.focus ? '🍅 專心時間結束，休息 5 分鐘！' : '☕ 休息結束，繼續加油！'); pomoNext(); }
    showPomo();
  }, 250);
  showPomo();
};
$('#pomoSkip').onclick = pomoNext;
$('#pomoReset').onclick = () => { clearInterval(pomo.iv); Object.assign(pomo, { focus: true, left: 1500, running: false, count: 0 }); showPomo(); };

/* ---------------- 任務 ---------------- */
function taskOptions(sel) {
  return state.taskDefs.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
}
function renderTaskWidget() {
  if (!state.taskDefs.find(t => t.id === state.ui.widgetTask)) state.ui.widgetTask = state.taskDefs[0]?.id;
  const id = state.ui.widgetTask;
  $('#taskSelect').innerHTML = taskOptions(id) || '<option>尚未設定任務</option>';
  const seats = activeSeats(), done = new Set(todayDone()[id] || []);
  const n = seats.filter(s => done.has(s)).length;
  $('#taskDone').textContent = n; $('#taskTotal').textContent = seats.length;
  $('#taskRing').style.strokeDashoffset = 314.16 * (1 - (seats.length ? n / seats.length : 0));
  const miss = seats.filter(s => !done.has(s));
  $('#taskMissing').innerHTML = !seats.length ? '' : miss.length ? `尚未完成：<b>${miss.map(s => pad(s)).join('、')}</b>` : '🎉 全班都完成了！';
}
$('#taskSelect').onchange = e => { state.ui.widgetTask = e.target.value; save(); renderTaskWidget(); };

function renderTasksPage() {
  if (!state.taskDefs.find(t => t.id === state.ui.pageTask)) state.ui.pageTask = state.taskDefs[0]?.id;
  const d = new Date();
  $('#tasksDate').textContent = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  const rec = todayDone(), seats = activeSeats();
  $('#taskTabs').innerHTML = state.taskDefs.map(t => {
    const c = (rec[t.id] || []).filter(s => seats.includes(s)).length;
    return `<button data-id="${t.id}" class="${t.id === state.ui.pageTask ? 'active' : ''}">${esc(t.name)}<em>${c}/${seats.length}</em></button>`;
  }).join('') || '<span class="hint">請到教師控制台新增任務</span>';
  const done = new Set(rec[state.ui.pageTask] || []);
  $('#seatGrid').innerHTML = seats.map(s => `<button class="seat ${done.has(s) ? 'done' : ''}" data-seat="${s}"><b>${pad(s)}</b><small>${esc(nameOf(s)) || '&nbsp;'}</small></button>`).join('');
}
$('#taskTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.ui.pageTask = b.dataset.id; save(); renderTasksPage();
});
$('#seatGrid').addEventListener('click', e => {
  const b = e.target.closest('.seat'); if (!b) return;
  const seat = +b.dataset.seat, tid = state.ui.pageTask; if (!tid) return;
  const rec = todayDone(), arr = (rec[tid] ||= []);
  const i = arr.indexOf(seat);
  if (i >= 0) { arr.splice(i, 1); addCoins(seat, -1, '取消打卡'); }
  else { arr.push(seat); addCoins(seat, 1, '任務：' + (state.taskDefs.find(t => t.id === tid)?.name || '')); ensureAudio(); chime(); }
  save(); renderTasksPage(); renderTaskWidget(); renderHeader();
  const nb = $(`.seat[data-seat="${seat}"]`); nb && nb.classList.add('pop');
});

/* ---------------- 金幣 / 物種 ---------------- */
const celebrateQueue = [];
function addCoins(seat, delta, reason, silent) {
  const s = stu(seat);
  s.coins = Math.max(0, s.coins + delta);
  if (delta > 0) {
    state.forest.points += delta;
    while (state.forest.points >= 100) { state.forest.points -= 100; state.forest.level++; celebrateQueue.push({ type: 'level', level: state.forest.level }); }
    while (s.coins >= s.nextAt) {
      s.nextAt += 10;
      const sp = discover(seat);
      if (sp) celebrateQueue.push({ type: 'species', seat, sp });
    }
  } else {
    state.forest.points = Math.max(0, state.forest.points + delta);
  }
  if (reason && !silent) {
    state.log.unshift({ t: Date.now(), seat, delta, reason });
    state.log.length = Math.min(state.log.length, 300);
  }
  if (!celebrateQueue.running) runCelebrations();
}
function discover(seat) {
  const s = stu(seat), have = new Set(s.species);
  const pool = SP.filter(x => !have.has(x.id));
  if (!pool.length) return null;
  const W = { 1: 6, 2: 3, 3: 1 };
  let r = Math.random() * pool.reduce((a, x) => a + W[x.rarity], 0);
  const pick = pool.find(x => (r -= W[x.rarity]) <= 0) || pool[0];
  s.species.push(pick.id);
  return pick;
}
function runCelebrations() {
  const c = celebrateQueue.shift();
  if (!c) { celebrateQueue.running = false; renderCritters(); renderHeader(); return; }
  celebrateQueue.running = true;
  const skip = celebrateQueue.length ? `<button class="btn" id="cSkip" style="margin-left:8px">略過其餘 ${celebrateQueue.length} 個</button>` : '';
  setTimeout(() => {
    const b = $('#cSkip');
    if (b) b.onclick = () => {
      const rest = [c, ...celebrateQueue.splice(0)];
      const sp = rest.filter(x => x.type === 'species');
      modalOnClose = null;
      openModal(`<div class="celebrate"><h2>🎉 這次一共有 ${sp.length} 個新發現！</h2>
        <div class="dex-grid" style="text-align:left;margin:14px 0">${sp.map(x => `<div class="dex-card" style="--cat:${CATS[x.sp.cat].color}"><div class="d-emo">${x.sp.emoji}</div><div class="d-name">${esc(x.sp.name)}</div><div class="d-desc">${pad(x.seat)} 號 ${esc(nameOf(x.seat))}</div></div>`).join('')}</div>
        <button class="primary" data-close>好的</button></div>`, { wide: true, onClose: runCelebrations });
    };
  }, 0);
  confetti();
  setTimeout(chime, 50);
  if (c.type === 'species') {
    const cat = CATS[c.sp.cat];
    openModal(`<div class="celebrate">
      <p class="sub" style="margin:0">${pad(c.seat)} 號 ${esc(nameOf(c.seat))} 在山林裡發現了新物種！</p>
      <div class="c-emo">${c.sp.emoji}</div>
      <div class="c-name">${esc(c.sp.name)}</div>
      <div class="d-meta" style="justify-content:center;display:flex;gap:6px;margin-bottom:10px">
        <span style="background:${cat.color};color:#10261f;padding:2px 10px;border-radius:99px;font-weight:700">${cat.name}</span>
        <span style="background:${c.sp.rarity === 3 ? 'var(--gold)' : 'rgba(255,255,255,.12)'};color:${c.sp.rarity === 3 ? '#3a2b05' : 'inherit'};padding:2px 10px;border-radius:99px">${RAR[c.sp.rarity]}</span>
      </div>
      <p class="sub">${esc(c.sp.desc)}</p>
      <button class="primary" data-close>太棒了！</button>${skip}</div>`, { onClose: runCelebrations });
  } else {
    openModal(`<div class="celebrate"><div class="c-emo">🌳</div><h2>班級山林升級了！</h2>
      <div class="c-name">Lv.${c.level}</div><p class="sub">全班一起努力，山林長出了更多樹木，動物們更喜歡這裡了！</p>
      <button class="primary" data-close>繼續加油</button>${skip}</div>`, { onClose: runCelebrations });
  }
}
function confetti() {
  const em = ['🍃', '🌸', '✨', '🍂', '🌿', '⭐'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.className = 'confetti'; s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + 'vw'; s.style.animationDuration = 2 + Math.random() * 2 + 's'; s.style.animationDelay = Math.random() * .6 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 5000);
  }
}

/* ---------------- 抽號 ---------------- */
let drawn = [];
$('#drawBtn').onclick = () => {
  const noRep = $('#drawNoRepeat').checked;
  let pool = activeSeats().filter(s => !noRep || !drawn.includes(s));
  if (!pool.length) { toast('全部都抽過了，按「重置」重新開始'); return; }
  ensureAudio();
  const el = $('#drawNum'); el.classList.add('rolling');
  let k = 0;
  const iv = setInterval(() => {
    el.textContent = pad(pool[Math.floor(Math.random() * pool.length)]);
    if (++k > 18) {
      clearInterval(iv);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      drawn.push(pick); el.textContent = pad(pick); el.classList.remove('rolling');
      $('#drawName').textContent = nameOf(pick) || `${pick} 號`;
      $('#drawHistory').textContent = '已抽：' + drawn.map(pad).join('、');
      chime();
    } else beepTick();
  }, 70);
};
function beepTick() {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.frequency.value = 1400; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .04);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .05);
}
$('#drawReset').onclick = () => { drawn = []; $('#drawNum').textContent = '?'; $('#drawName').textContent = '按下按鈕抽一位幸運兒'; $('#drawHistory').textContent = ''; };

/* ---------------- 音量偵測 ---------------- */
let mic = null;
$('#noiseThreshold').oninput = e => $('#noiseLine').style.left = e.target.value + '%';
$('#noiseBtn').onclick = async () => {
  if (mic) { mic.stream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(mic.raf); mic = null; $('#noiseBtn').textContent = '開始偵測'; $('#noiseText').textContent = '已停止'; $('#noiseBar').style.width = 0; return; }
  try {
    ensureAudio();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    mic = { stream, raf: 0, smooth: 0, loud: 0 };
    $('#noiseBtn').textContent = '停止偵測';
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / buf.length), lvl = Math.max(0, Math.min(100, (20 * Math.log10(rms + 1e-6) + 60) * 100 / 60));
      mic.smooth = mic.smooth * .85 + lvl * .15;
      const th = +$('#noiseThreshold').value;
      $('#noiseBar').style.width = mic.smooth + '%';
      mic.loud = mic.smooth > th ? mic.loud + 1 : Math.max(0, mic.loud - 2);
      const [f, t] = mic.loud > 40 ? ['😣', '太吵了！請降低音量'] : mic.smooth > th * .8 ? ['😐', '有點吵喔'] : ['😊', '很安靜，很棒！'];
      $('#noiseFace').textContent = f; $('#noiseText').textContent = t;
      $('#noiseText').style.color = mic.loud > 40 ? 'var(--danger)' : '';
      mic.raf = requestAnimationFrame(loop);
    };
    loop();
  } catch (e) { toast('無法使用麥克風：請允許瀏覽器使用麥克風'); }
};

/* ---------------- 全班夥伴 ---------------- */
function renderStudents() {
  $('#studentGrid').innerHTML = activeSeats().map(n => {
    const s = state.students[n] || { coins: 0, nextAt: 10, species: [] };
    const prog = 100 - (s.nextAt - s.coins) * 10;
    return `<button class="s-card" data-seat="${n}">
      <div class="s-top"><div class="s-no">${pad(n)}</div><div><div class="s-name">${esc(nameOf(n)) || n + ' 號'}</div><div class="s-coin">$ ${s.coins} 金幣・${s.species.length} 種</div></div></div>
      <div class="s-sp">${s.species.map(id => spById(id)?.emoji || '').join('') || '<small style="color:var(--muted);font-size:13px">還沒有發現物種</small>'}</div>
      <div class="s-next">再 ${Math.max(0, s.nextAt - s.coins)} 金幣發現新物種</div>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, prog))}%"></i></div>
    </button>`;
  }).join('');
}
$('#studentGrid').addEventListener('click', e => {
  const c = e.target.closest('.s-card'); if (!c) return;
  const n = +c.dataset.seat, s = state.students[n] || { coins: 0, species: [] };
  openModal(`<button class="close" data-close>✕</button>
    <h2>${pad(n)} 號 ${esc(nameOf(n))}</h2>
    <p class="sub">目前 $ ${s.coins} 金幣，已發現 ${s.species.length} / ${SP.length} 種物種</p>
    <div class="dex-grid">${s.species.map(id => dexCard(spById(id), true)).join('') || '<div class="empty">完成任務累積金幣，就能發現新物種喔！</div>'}</div>`, { wide: true });
});

/* ---------------- 山林圖鑑 ---------------- */
let dexCat = 'all';
function dexCard(sp, open, finders) {
  if (!sp) return '';
  const cat = CATS[sp.cat];
  return `<div class="dex-card ${open ? '' : 'locked'}" style="--cat:${cat.color}">
    <div class="d-emo">${sp.emoji}</div>
    <div class="d-name">${open ? esc(sp.name) : '？？？'}</div>
    <div class="d-meta"><span class="cat">${cat.name}</span><span class="r${sp.rarity}">${RAR[sp.rarity]}</span>${finders ? `<span>${finders} 人發現</span>` : ''}</div>
    <div class="d-desc">${open ? esc(sp.desc) : '還沒有人發現這個物種，繼續完成任務去探索山林吧！'}</div></div>`;
}
function renderDex() {
  const cnt = {};
  activeSeats().forEach(n => (state.students[n]?.species || []).forEach(id => cnt[id] = (cnt[id] || 0) + 1));
  const list = SP.filter(s => dexCat === 'all' || s.cat === dexCat);
  $('#dexCount').textContent = `已發現 ${Object.keys(cnt).length} / ${SP.length}`;
  $('#dexGrid').innerHTML = list.map(sp => dexCard(sp, !!cnt[sp.id], cnt[sp.id])).join('');
}
$('#dexTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  dexCat = b.dataset.cat; $$('#dexTabs button').forEach(x => x.classList.toggle('active', x === b)); renderDex();
});

/* ---------------- 班級統計 ---------------- */
function renderStats() {
  const seats = activeSeats();
  const coins = seats.map(n => state.students[n]?.coins || 0);
  const total = coins.reduce((a, b) => a + b, 0);
  const cards = [
    ['全班人數', seats.length + ' 人'], ['全班金幣', total], ['平均金幣', seats.length ? (total / seats.length).toFixed(1) : 0],
    ['圖鑑發現', `${classSpecies().size} / ${SP.length}`], ['班級山林', 'Lv.' + state.forest.level], ['今日完成率', todayRate() + '%']
  ];
  $('#statCards').innerHTML = cards.map(([a, b]) => `<div class="stat-card"><small>${a}</small><b>${b}</b></div>`).join('');
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  $('#weekChart').innerHTML = days.map(d => {
    const r = todayRate(dateKey(d));
    return `<div class="wc"><b>${r}%</b><i style="height:${Math.max(r, 1) * .8}%"></i><span>${d.getMonth() + 1}/${d.getDate()}<br>週${WEEK[d.getDay()]}</span></div>`;
  }).join('');
  const max = Math.max(10, ...coins);
  $('#seatBars').innerHTML = seats.map((n, i) => `<div class="sb"><span>${pad(n)} ${esc(nameOf(n))}</span><div class="bar"><i style="width:${coins[i] / max * 100}%"></i></div><span>${coins[i]}</span></div>`).join('');
}

/* ---------------- 對話框 ---------------- */
let modalOnClose = null;
function openModal(html, opt = {}) {
  $('#modalCard').className = 'modal-card glass' + (opt.wide ? ' wide' : '');
  $('#modalCard').innerHTML = html;
  $('#modal').classList.remove('hidden');
  modalOnClose = opt.onClose || null;
  setTimeout(() => { const f = $('#modalCard [autofocus]'); f && f.focus(); }, 50);
}
function closeModal() {
  $('#modal').classList.add('hidden');
  const cb = modalOnClose; modalOnClose = null; cb && cb();
}
$('#modal').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) closeModal();
});

/* ---------------- 密碼 ---------------- */
async function hashPw(pw) {
  const salted = 'jialan::' + pw;
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const c of salted) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return 'f' + h.toString(16);
}
/* 教師解鎖：閒置超過 AUTH_IDLE 自動上鎖（只要老師在控制台或解鎖狀態下操作，就重新計時） */
const AUTH_IDLE = 5 * 60 * 1000;
let authAt = 0;
const isAuthed = () => !!state.settings.pwHash && sessionStorage.getItem('jl-auth') === state.settings.pwHash && Date.now() - authAt < AUTH_IDLE;
function setAuth() { sessionStorage.setItem('jl-auth', state.settings.pwHash); authAt = Date.now(); updateLockUI(); }
function lockNow() { sessionStorage.removeItem('jl-auth'); authAt = 0; updateLockUI(); }
function touchAuth() { if (isAuthed()) authAt = Date.now(); }
let wasAuthed = false;
function updateLockUI() {
  const on = isAuthed();
  if (wasAuthed && !on) {
    sessionStorage.removeItem('jl-auth');
    if ($('#ctBody') && !$('#modal').classList.contains('hidden')) closeModal();
    toast('🔒 閒置 5 分鐘，已自動上鎖');
  }
  wasAuthed = on;
  document.body.classList.toggle('unlocked', on);
  const left = Math.max(0, Math.ceil((AUTH_IDLE - (Date.now() - authAt)) / 60000));
  $('#consoleBtn').innerHTML = on ? `<span>🔓</span>已解鎖 ${left} 分` : '<span>🔒</span>教師控制台';
  $('#annEdit').textContent = on ? '✎' : '🔒';
  const free = state.settings.studentEdit || on;
  $$('#contactForm input, #contactForm button, #cdForm input, #cdForm button').forEach(x => x.disabled = !free);
  $$('.lock-hint').forEach(x => x.classList.toggle('hidden', free));
  $$('#contactList .del, #cdList .del').forEach(x => x.classList.toggle('hidden', !free));
}
['click', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, e => {
  if (e.target.closest?.('#modal, #contactForm, #cdForm, #contactList, #cdList')) touchAuth();
}, true));

/* ---------------- 初次設定 ---------------- */
function parseVacant(str) {
  return [...new Set(String(str).split(/[^0-9]+/).filter(Boolean).map(Number))].sort((a, b) => a - b);
}
function seatSummary(max, vac) {
  const v = parseVacant(vac).filter(n => n >= 1 && n <= max);
  return `座號 01～${pad(max)}，實際 <b>${max - v.length}</b> 人`;
}
function openSetup() {
  const s = state.settings;
  const presets = [15, 18, 20, 22, 24, 25, 26, 28, 30, 32, 35, 40];
  openModal(`
    <h2>🌄 歡迎使用班級儀表板</h2>
    <p class="sub">先完成基本設定。之後換班級、換學年，都可以在「教師控制台」修改。</p>
    <div class="field"><span>學校名稱</span><input id="sSchool" value="${esc(s.school)}"></div>
    <div class="field"><span>班級名稱</span><input id="sClass" value="${esc(s.className)}"></div>
    ${termFields(s, 's')}
    <div class="field"><span>班上最大的座號是幾號？</span></div>
    <div class="seat-presets">${presets.map(p => `<button data-p="${p}" class="${p === +s.maxSeat ? 'active' : ''}">${p} 號</button>`).join('')}</div>
    <div class="row2">
      <div class="field"><span>最大座號</span><input id="sMax" type="number" min="1" max="60" value="${s.maxSeat}"></div>
      <div class="field"><span>空號（沒有就不用填）</span><input id="sVac" placeholder="例如：7、15" value="${s.vacant.join('、')}"></div>
    </div>
    <div class="seat-summary" id="sSum"></div>
    <div class="row2">
      <div class="field"><span>設定教師後台密碼（至少 4 碼）</span><input id="sPw" type="password" autocomplete="new-password"></div>
      <div class="field"><span>再輸入一次密碼</span><input id="sPw2" type="password" autocomplete="new-password"></div>
    </div>
    <div class="err" id="sErr"></div>
    <div class="modal-actions"><button class="primary" id="sGo">開始使用</button></div>`);
  const upd = () => $('#sSum').innerHTML = seatSummary(+$('#sMax').value || 0, $('#sVac').value);
  upd();
  $$('.seat-presets button').forEach(b => b.onclick = () => {
    $('#sMax').value = b.dataset.p; $$('.seat-presets button').forEach(x => x.classList.toggle('active', x === b)); upd();
  });
  $('#sMax').oninput = upd; $('#sVac').oninput = upd;
  $('#sGo').onclick = async () => {
    const max = +$('#sMax').value, pw = $('#sPw').value;
    if (!$('#sClass').value.trim()) return $('#sErr').textContent = '請輸入班級名稱';
    if (!(max >= 1 && max <= 60)) return $('#sErr').textContent = '最大座號請填 1～60';
    if (pw.length < 4) return $('#sErr').textContent = '密碼至少 4 碼';
    if (pw !== $('#sPw2').value) return $('#sErr').textContent = '兩次密碼不一樣';
    Object.assign(s, {
      school: $('#sSchool').value.trim(), className: $('#sClass').value.trim(), schoolYear: $('#sYear').value.trim(), semester: $('#sSem').value,
      maxSeat: max, vacant: parseVacant($('#sVac').value).filter(n => n <= max), pwHash: await hashPw(pw), setupDone: true
    });
    setAuth();
    save(); closeModal(); renderAll(); toast('✅ 設定完成！');
  };
}

/* ---------------- 教師登入 ---------------- */
$('#consoleBtn').onclick = () => teacherOpen();
$('#announceBox').onclick = () => teacherOpen('basic', '#bAnn');
function teacherOpen(tab, focusSel) {
  const go = () => {
    if (tab === 'unlock') { closeModal(); toast('🔓 已解鎖，可以編輯聯絡簿與倒數日（閒置 5 分鐘自動上鎖）', 3000); return; }
    openConsole(tab); if (focusSel) setTimeout(() => { const f = $(focusSel); if (f) { f.focus(); f.select?.(); } }, 80); };
  if (!state.settings.setupDone) return openSetup();
  if (isAuthed()) return go();
  openModal(`<button class="close" data-close>✕</button>
    <h2>🔒 教師控制台</h2><p class="sub">請輸入教師密碼</p>
    <form id="loginForm"><div class="field"><input id="lPw" type="password" autofocus autocomplete="current-password"></div>
    <div class="err" id="lErr"></div>
    <div class="modal-actions"><button class="primary" type="submit">登入</button></div></form>
    <p class="sub" style="margin-top:14px;font-size:12px">忘記密碼？只能在「這台電腦的瀏覽器」清除網站資料後重新設定（會清空班級資料，建議平時先匯出備份）。</p>`);
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    if (await hashPw($('#lPw').value) === state.settings.pwHash) {
      setAuth(); go();
    } else { $('#lErr').textContent = '密碼錯誤'; $('#lPw').select(); }
  };
}

let consoleTab = 'basic';
function openConsole(tab) {
  if (tab) consoleTab = tab;
  const tabs = [['basic', '基本資料'], ['seats', '座號與名單'], ['timetable', '週課表'], ['schedule', '作息時間'], ['tasks', '每日任務'], ['points', '加扣金幣'], ['data', '資料管理']];
  openModal(`<button class="close" data-close>✕</button>
    <h2>🛠️ 教師控制台</h2><p class="sub">TEACHER CONSOLE・修改後按「儲存」立即生效</p>
    <div class="console-tabs">${tabs.map(([k, v]) => `<button data-ct="${k}" class="${k === consoleTab ? 'active' : ''}">${v}</button>`).join('')}</div>
    <div id="ctBody"></div>`, { wide: true });
  $$('[data-ct]').forEach(b => b.onclick = () => openConsole(b.dataset.ct));
  ({ basic: ctBasic, seats: ctSeats, timetable: ctTimetable, schedule: ctSchedule, tasks: ctTasks, points: ctPoints, data: ctData })[consoleTab]($('#ctBody'));
}

function ctBasic(el) {
  const s = state.settings;
  const L = s.loc;
  el.innerHTML = `
    <div class="field"><span>📢 跑馬燈公告（可以輸入多則，一行一則，會在畫面左上角輪流捲動）</span>
      <textarea id="bAnn" placeholder="例如：明天穿運動服&#10;星期五校外教學，記得帶水壺">${esc(s.announcement)}</textarea></div>
    <label class="chk" style="margin:-4px 0 14px;font-size:14px"><input type="checkbox" id="bStuEdit" ${s.studentEdit ? 'checked' : ''}> 允許不輸入密碼就新增／刪除聯絡簿、倒數日（不勾選比較安全，學生無法亂寫）</label>
    <div class="field"><span>學校名稱</span><input id="bSchool" value="${esc(s.school)}"></div>
    <div class="field"><span>班級名稱</span><input id="bClass" value="${esc(s.className)}"></div>
    ${termFields(s, 'b')}
    <h4 style="margin:8px 0 10px">🌤️ 天氣</h4>
    <div class="row2">
      <div class="field"><span>資料來源</span><select id="bSrc">
        <option value="openmeteo" ${L.source !== 'cwa' ? 'selected' : ''}>Open-Meteo（免申請，預設）</option>
        <option value="cwa" ${L.source === 'cwa' ? 'selected' : ''}>中央氣象署開放資料（需授權碼）</option></select></div>
      <div class="field"><span>畫面顯示的地點名稱</span><input id="bLoc" value="${esc(L.name)}"></div>
    </div>
    <div id="bCwa" class="${L.source === 'cwa' ? '' : 'hidden'}">
      <p class="sub" style="margin:0 0 10px">到 <b>opendata.cwa.gov.tw</b> 免費註冊會員，登入後在「取得授權碼」複製貼到下面。授權碼只存在這台電腦的瀏覽器。若氣象署連不上，會自動改用 Open-Meteo。</p>
      <div class="row3">
        <div class="field"><span>氣象署授權碼</span><input id="bKey" value="${esc(L.cwaKey)}" placeholder="CWA-XXXXXXXX-…" autocomplete="off"></div>
        <div class="field"><span>資料集（臺東縣鄉鎮預報）</span><input id="bDs" value="${esc(L.cwaDataset)}"></div>
        <div class="field"><span>鄉鎮名稱</span><input id="bTown" value="${esc(L.cwaTown)}"></div>
      </div>
    </div>
    <div id="bOm" class="row2 ${L.source === 'cwa' ? 'hidden' : ''}">
      <div class="field"><span>緯度</span><input id="bLat" type="number" step="0.01" value="${L.lat}"></div>
      <div class="field"><span>經度</span><input id="bLon" type="number" step="0.01" value="${L.lon}"></div>
    </div>
    <div class="err" id="bErr"></div>
    <div class="modal-actions"><button class="primary" id="bSave">儲存</button></div>`;
  $('#bSrc').onchange = e => { $('#bCwa').classList.toggle('hidden', e.target.value !== 'cwa'); $('#bOm').classList.toggle('hidden', e.target.value === 'cwa'); };
  $('#bSave').onclick = async () => {
    Object.assign(s, { school: $('#bSchool').value.trim(), className: $('#bClass').value.trim(), schoolYear: $('#bYear').value.trim(), semester: $('#bSem').value, announcement: $('#bAnn').value.trim(), studentEdit: $('#bStuEdit').checked });
    s.loc = { ...L, name: $('#bLoc').value.trim(), lat: +$('#bLat').value || 22.6, lon: +$('#bLon').value || 120.96,
      source: $('#bSrc').value, cwaKey: $('#bKey').value.trim(), cwaDataset: $('#bDs').value.trim() || 'F-D0047-037', cwaTown: $('#bTown').value.trim() || '金峰鄉' };
    save(); renderAll(); toast('✅ 基本資料已儲存');
    const r = await loadWeather();
    $('#bErr').textContent = r.ok ? (s.loc.source === 'cwa' && r.src !== '中央氣象署' ? `⚠️ 氣象署連線失敗（${r.errs[0] || ''}），目前改用 Open-Meteo` : '') : '⚠️ 天氣暫時無法取得：' + r.errs.join('；');
    $('#bErr').style.color = '';
  };
}

function ctSeats(el) {
  const s = state.settings;
  const draw = () => {
    const max = Math.min(60, Math.max(1, +$('#cMax').value || 1)), vac = new Set(parseVacant($('#cVac').value));
    const cur = {}; $$('#namesGrid input').forEach(i => cur[i.dataset.n] = i.value);
    $('#cSum').innerHTML = seatSummary(max, $('#cVac').value);
    $('#namesGrid').innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(n =>
      `<label class="${vac.has(n) ? 'vacant' : ''}"><b>${pad(n)}</b><input class="mini-input" data-n="${n}" value="${esc(cur[n] ?? s.names[n] ?? '')}" placeholder="${vac.has(n) ? '空號' : '姓名（可空白）'}"></label>`).join('');
  };
  el.innerHTML = `
    <div class="row2">
      <div class="field"><span>最大座號</span><input id="cMax" type="number" min="1" max="60" value="${s.maxSeat}"></div>
      <div class="field"><span>空號（例如轉出：7、15）</span><input id="cVac" value="${s.vacant.join('、')}"></div>
    </div>
    <div class="seat-summary" id="cSum"></div>
    <div class="field"><span>學生姓名（可只填名字或暱稱；保護隱私也可以全部空白）</span>
      <textarea id="cPaste" placeholder="或從 Excel 貼上整欄姓名（一行一位，依座號排列），再按「套用貼上」" style="min-height:52px"></textarea></div>
    <div class="modal-actions" style="justify-content:flex-start;margin:-6px 0 12px"><button class="btn" id="cApply">套用貼上</button></div>
    <div class="names-grid" id="namesGrid"></div>
    <div class="modal-actions"><button class="primary" id="cSave">儲存</button></div>`;
  draw();
  $('#cMax').oninput = draw; $('#cVac').oninput = draw;
  $('#cApply').onclick = () => {
    const lines = $('#cPaste').value.split(/\r?\n/).map(x => x.trim());
    $$('#namesGrid input').forEach((inp, i) => { if (lines[i] !== undefined) inp.value = lines[i].replace(/^\d+[\s.、,]*/, ''); });
  };
  $('#cSave').onclick = () => {
    const max = Math.min(60, Math.max(1, +$('#cMax').value || 1));
    s.maxSeat = max; s.vacant = parseVacant($('#cVac').value).filter(n => n <= max);
    const names = {}; $$('#namesGrid input').forEach(i => { if (i.value.trim()) names[i.dataset.n] = i.value.trim(); });
    s.names = names;
    save(); renderAll(); toast('✅ 座號與名單已儲存');
  };
}

function ctSchedule(el) {
  let rows = state.schedule.map(r => ({ ...r }));
  const draw = () => {
    $('#schRows').innerHTML = rows.map((r, i) => `<div class="er" data-i="${i}">
      <input type="time" value="${r.start}" data-k="start"><input type="time" value="${r.end}" data-k="end">
      <div style="display:flex;gap:6px"><input value="${esc(r.name)}" data-k="name" placeholder="名稱" style="flex:1;min-width:0"><input value="${esc(r.days)}" data-k="days" title="星期幾有這節（一二三四五）" style="width:96px"></div>
      <select data-k="slot" title="對應週課表的第幾節">${['', ...SLOTS].map(s => `<option value="${s}" ${s === (r.slot || '') ? 'selected' : ''}>${s ? slotName(s) : '非上課'}</option>`).join('')}</select>
      <button data-del="${i}" title="刪除">✕</button></div>`).join('');
  };
  el.innerHTML = `<p class="sub">設定每一節的<b>時間</b>（全週共用）。最後一欄「節次」對應到週課表，科目請到「週課表」分頁填寫。<br>
    「星期」欄：非上課時段（早自修、午休…）依此判斷哪幾天有；上課節次則以週課表為準（課表空白＝那天沒課）。</p>
    <div class="er er-head"><span>開始</span><span>結束</span><span>名稱／星期</span><span>節次</span><span></span></div>
    <div class="edit-rows" id="schRows"></div>
    <div class="modal-actions" style="justify-content:space-between">
      <div style="display:flex;gap:8px"><button class="btn" id="schAdd">＋ 新增一列</button><button class="btn" id="schDef">恢復預設</button></div>
      <button class="primary" id="schSave">儲存</button></div>`;
  draw();
  const sync = () => $$('#schRows .er').forEach(er => $$('input, select', er).forEach(inp => rows[er.dataset.i][inp.dataset.k] = inp.value));
  $('#schRows').onclick = e => { const d = e.target.closest('[data-del]'); if (d) { sync(); rows.splice(+d.dataset.del, 1); draw(); } };
  $('#schAdd').onclick = () => { sync(); rows.push({ start: '08:00', end: '08:40', name: '', days: '一二三四五', slot: '' }); draw(); };
  $('#schDef').onclick = () => { rows = DEFAULT_SCHEDULE.map(r => ({ ...r })); draw(); };
  $('#schSave').onclick = () => {
    sync();
    state.schedule = rows.filter(r => r.start && r.end && r.name.trim()).sort((a, b) => toMin(a.start) - toMin(b.start));
    save(); renderSchedule(); toast('✅ 作息表已儲存'); draw();
  };
}

const AI_PROMPT = `請幫我把這張「國小班級課表」照片轉成 CSV 文字，規則如下：
1. 只輸出 CSV 內容，放在一個程式碼區塊裡，不要任何說明。
2. 第一行固定是：節次,一,二,三,四,五
3. 之後每一行是一節課，依序從第1節到第9節，格式：第1節,星期一科目,星期二科目,星期三科目,星期四科目,星期五科目
4. 沒有課的格子留空，但逗號要保留（例如：第5節,國語,數學,,英語,體育）。
5. 不要包含早自修、午餐、午休、打掃、放學等非上課時段。
6. 科目名稱照課表上的文字，不要加老師姓名或教室。
7. 看不清楚的字寫成「?」。`;

// 解析從 Excel／校務系統／AI 貼上的課表文字，回傳 { p1: [一,二,三,四,五], ... }
function parseTimetable(text) {
  const out = {}; let seq = 0;
  const lines = String(text).split(/\r?\n/).map(l => l.trim())
    .filter(l => l && !/^```/.test(l) && !/^[\s|:：\-–—]+$/.test(l));
  for (const line of lines) {
    let cells = line.includes('\t') ? line.split('\t')
      : line.includes('|') ? line.replace(/^\||\|$/g, '').split('|')
      : /[,，]/.test(line) ? line.split(/[,，]/)
      : line.split(/\s+/);
    cells = cells.map(c => c.trim().replace(/^["']|["']$/g, ''));
    const dayHead = cells.filter(c => /^(星期|週|周|禮拜)?[一二三四五]$|^(mon|tue|wed|thu|fri)/i.test(c)).length;
    if (dayHead >= 3) continue; // 標題列
    const first = cells[0] || '';
    if (/早自修|早修|晨光|午餐|午休|打掃|放學|升旗|導師時間|下課/.test(first)) continue;
    let slot = inferSlot(first) || (/^[1-9]$/.test(first) ? 'p' + first : '');
    let subj = (slot || /節|^\d{1,2}[:：]\d{2}/.test(first) || cells.length >= 6) ? cells.slice(1) : cells;
    if (/^\d{1,2}[:：]\d{2}/.test(subj[0] || '')) subj = subj.slice(1); // 第二欄是時間就略過
    if (!slot) slot = 'p' + (seq + 1);
    seq = +slot.slice(1);
    if (seq > 9) continue;
    out[slot] = Array.from({ length: 5 }, (_, i) => (subj[i] || '').replace(/[?？]/g, '').trim());
  }
  return out;
}

function ctTimetable(el) {
  const tt = state.timetable || {};
  el.innerHTML = `
    <p class="sub">在格子裡輸入科目（可從下拉選單挑選），空白代表那節沒課。首頁會依今天星期幾自動顯示科目。<br>每一節的時間請在「作息時間」分頁設定。</p>
    <div class="tt-wrap"><table class="tt-edit">
      <thead><tr><th>節次</th>${[1, 2, 3, 4, 5].map(w => `<th>星期${WEEK[w]}</th>`).join('')}</tr></thead>
      <tbody>${SLOTS.map(s => `<tr><th>${slotName(s)}<small>${slotTime(s) || '<i>未設定時間</i>'}</small></th>${[1, 2, 3, 4, 5].map(w =>
        `<td><input list="subjList" data-w="${w}" data-s="${s}" value="${esc((tt[w] || {})[s] || '')}"></td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <datalist id="subjList">${SUBJECTS.map(x => `<option value="${x}">`).join('')}</datalist>

    <details class="tt-import"><summary>📋 從 Excel 或校務系統貼上整張課表</summary>
      <p class="sub">在 Excel（或校務系統網頁）選取課表範圍 → 複製 → 貼到下面 → 按「填入格子」。<br>建議包含左邊的節次欄（第1節、第2節…），標題列與早自修、午休等列會自動略過。</p>
      <textarea id="ttPaste" placeholder="節次	一	二	三	四	五&#10;第1節	國語	數學	國語	英語	數學&#10;第2節	…"></textarea>
      <div class="modal-actions" style="justify-content:flex-start"><button class="btn" id="ttApply">⬇️ 填入格子</button><span class="sub" id="ttMsg" style="margin:0;align-self:center"></span></div>
    </details>

    <details class="tt-import"><summary>📷 用課表照片產生（借助免費 AI）</summary>
      <ol class="sub tt-steps">
        <li>按下方「複製 AI 指令」。</li>
        <li>打開 Claude（claude.ai）、ChatGPT 或 Gemini，<b>上傳課表照片或截圖</b>，再貼上剛剛複製的指令送出。</li>
        <li>複製 AI 回覆的 CSV 文字，貼到上面「從 Excel 貼上」的框框，按「填入格子」。</li>
        <li><b>一定要核對</b>格子內容，AI 偶爾會看錯字，確認後再按「儲存」。</li>
      </ol>
      <pre class="ai-prompt" id="aiPrompt">${esc(AI_PROMPT)}</pre>
      <button class="btn" id="ttCopy">📋 複製 AI 指令</button>
    </details>

    <div class="modal-actions" style="justify-content:space-between">
      <button class="btn danger" id="ttClear">清空課表</button>
      <button class="primary" id="ttSave">儲存</button>
    </div>`;
  $('#ttApply').onclick = () => {
    const res = parseTimetable($('#ttPaste').value), keys = Object.keys(res);
    if (!keys.length) return $('#ttMsg').textContent = '⚠️ 看不懂貼上的內容，請確認有包含課表格子';
    keys.forEach(s => res[s].forEach((v, i) => { const inp = $(`.tt-edit input[data-w="${i + 1}"][data-s="${s}"]`); if (inp) inp.value = v; }));
    $('#ttMsg').textContent = `✅ 已填入 ${keys.length} 節（${keys.map(slotName).join('、')}），請核對後按「儲存」`;
    $('.tt-wrap').scrollIntoView({ behavior: 'smooth' });
  };
  $('#ttCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(AI_PROMPT); toast('✅ 已複製 AI 指令'); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#aiPrompt')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('請按 Ctrl+C 複製已選取的文字'); }
  };
  $('#ttClear').onclick = () => { if (confirm('清空所有格子？（按「儲存」後才會生效）')) $$('.tt-edit input').forEach(i => i.value = ''); };
  $('#ttSave').onclick = () => {
    const t = {};
    $$('.tt-edit input').forEach(i => { const v = i.value.trim(); if (v) (t[i.dataset.w] ||= {})[i.dataset.s] = v; });
    state.timetable = t;
    const noTime = SLOTS.filter(s => Object.values(t).some(d => d[s]) && !slotTime(s));
    save(); renderSchedule(); tick();
    toast(noTime.length ? `⚠️ 已儲存，但 ${noTime.map(slotName).join('、')} 還沒設定時間，請到「作息時間」補上` : '✅ 週課表已儲存', 3500);
  };
}

function ctTasks(el) {
  let rows = state.taskDefs.map(t => ({ ...t }));
  const draw = () => {
    $('#tkRows').innerHTML = rows.map((t, i) => `<div class="er task" data-i="${i}"><input value="${esc(t.name)}" placeholder="任務名稱"><button data-del="${i}">✕</button></div>`).join('');
  };
  el.innerHTML = `<p class="sub">每天都會出現的打卡任務。學生每完成一項 +1 金幣、班級山林 +1。（刪除任務不會影響已得到的金幣）</p>
    <div class="edit-rows" id="tkRows"></div>
    <div class="modal-actions" style="justify-content:space-between"><button class="btn" id="tkAdd">＋ 新增任務</button><button class="primary" id="tkSave">儲存</button></div>`;
  draw();
  const sync = () => $$('#tkRows .er').forEach(er => rows[er.dataset.i].name = $('input', er).value);
  $('#tkRows').onclick = e => { const d = e.target.closest('[data-del]'); if (d) { sync(); rows.splice(+d.dataset.del, 1); draw(); } };
  $('#tkAdd').onclick = () => { sync(); rows.push({ id: 't' + uid(), name: '' }); draw(); };
  $('#tkSave').onclick = () => {
    sync(); state.taskDefs = rows.filter(t => t.name.trim()).map(t => ({ id: t.id, name: t.name.trim() }));
    save(); renderAll(); toast('✅ 任務已儲存'); draw();
  };
}

function ctPoints(el) {
  const sel = new Set();
  el.innerHTML = `<p class="sub">選擇座號（可多選），再按要加或扣的金幣數。加分也會讓班級山林成長，並可能發現新物種。</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="pAll">全選</button><button class="btn" id="pNone">清除選擇</button>
      <input class="mini-input" id="pReason" placeholder="原因（例如：熱心助人）" style="flex:1;min-width:180px"></div>
    <div class="pick-grid" id="pGrid">${activeSeats().map(n => `<button data-n="${n}"><b>${pad(n)}</b>${esc(nameOf(n)) || '&nbsp;'}</button>`).join('')}</div>
    <div class="btn-row" style="justify-content:flex-start">
      ${[1, 2, 3, 5, 10].map(v => `<button class="btn" data-v="${v}">＋${v}</button>`).join('')}
      ${[-1, -2, -5].map(v => `<button class="btn danger" data-v="${v}">${v}</button>`).join('')}
    </div>
    <h4 style="margin:18px 0 0">最近紀錄</h4>
    <div class="log-list" id="pLog"></div>`;
  const drawLog = () => $('#pLog').innerHTML = state.log.slice(0, 40).map(l => {
    const d = new Date(l.t);
    return `<div>${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}　${pad(l.seat)} 號 ${esc(nameOf(l.seat))}　<b style="color:${l.delta > 0 ? 'var(--accent)' : 'var(--danger)'}">${l.delta > 0 ? '+' : ''}${l.delta}</b>　${esc(l.reason)}</div>`;
  }).join('') || '尚無紀錄';
  drawLog();
  const paint = () => $$('#pGrid button').forEach(b => b.classList.toggle('sel', sel.has(+b.dataset.n)));
  $('#pGrid').onclick = e => { const b = e.target.closest('button'); if (!b) return; const n = +b.dataset.n; sel.has(n) ? sel.delete(n) : sel.add(n); paint(); };
  $('#pAll').onclick = () => { activeSeats().forEach(n => sel.add(n)); paint(); };
  $('#pNone').onclick = () => { sel.clear(); paint(); };
  $$('[data-v]', el).forEach(b => b.onclick = () => {
    if (!sel.size) return toast('請先選擇座號');
    const v = +b.dataset.v, reason = $('#pReason').value.trim() || (v > 0 ? '老師加分' : '老師扣分');
    const hadCeleb = celebrateQueue.length;
    celebrateQueue.running = true; // 先暫停慶祝動畫，等關閉控制台後再播放
    [...sel].forEach(n => addCoins(n, v, reason));
    save(); renderAll(); drawLog();
    toast(`✅ ${sel.size} 位同學 ${v > 0 ? '+' : ''}${v} 金幣`);
    if (celebrateQueue.length > hadCeleb) {
      toast(`🎉 有 ${celebrateQueue.length} 個新發現！關閉控制台後會播放`, 3000);
      modalOnClose = () => { celebrateQueue.running = false; runCelebrations(); };
    } else celebrateQueue.running = false;
  });
}

function ctData(el) {
  el.innerHTML = `
    <h4 style="margin:0 0 8px">備份與還原</h4>
    <p class="sub">資料只存在這台電腦的瀏覽器裡。換電腦、換瀏覽器或清除瀏覽紀錄前，請先「匯出備份」。</p>
    <div class="btn-row" style="justify-content:flex-start">
      <button class="btn" id="dExport">⬇️ 匯出備份檔</button>
      <label class="btn" style="cursor:pointer">⬆️ 匯入備份檔<input type="file" id="dImport" accept=".json,application/json" hidden></label>
    </div>
    <h4 style="margin:22px 0 8px">變更密碼</h4>
    <div class="row3">
      <input class="mini-input" id="dOld" type="password" placeholder="目前密碼">
      <input class="mini-input" id="dNew" type="password" placeholder="新密碼（至少 4 碼）">
      <button class="btn" id="dPw">變更密碼</button>
    </div>
    <div class="danger-zone">
      <h4>🎓 新學年／換班級</h4>
      <p class="sub">會先自動下載一份備份，然後清空：學生金幣與物種、任務打卡紀錄、聯絡簿、加扣分紀錄、班級山林等級、學生名單。<br>保留：學校名稱、作息表、每日任務、倒數日、密碼。接著會帶你設定新班級。</p>
      <button class="btn danger" id="dNewYear">開始新學年</button>
      <h4 style="margin-top:18px">完全重設</h4>
      <p class="sub">清除所有資料（包含密碼），回到第一次使用的狀態。</p>
      <button class="btn danger" id="dWipe">完全重設</button>
    </div>
    <div class="modal-actions"><button class="btn" id="dLogout">🔓 登出教師模式</button></div>`;
  $('#dExport').onclick = () => exportData();
  $('#dImport').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.settings || !d.students) throw new Error('格式不符');
        if (!confirm(`要用備份檔「${f.name}」取代目前全部資料嗎？`)) return;
        state = { ...defaults(), ...d, settings: { ...defaults().settings, ...d.settings } };
        setAuth();
        save(); renderAll(); loadWeather(); toast('✅ 已匯入備份'); openConsole('data');
      } catch (err) { toast('❌ 這不是正確的備份檔'); }
    };
    r.readAsText(f);
  };
  $('#dPw').onclick = async () => {
    if (await hashPw($('#dOld').value) !== state.settings.pwHash) return toast('目前密碼不正確');
    if ($('#dNew').value.length < 4) return toast('新密碼至少 4 碼');
    state.settings.pwHash = await hashPw($('#dNew').value);
    setAuth(); save(); toast('✅ 密碼已變更');
    $('#dOld').value = $('#dNew').value = '';
  };
  $('#dNewYear').onclick = () => {
    if (!confirm('確定要開始新學年？目前班級的學生資料會被清空（會先下載備份）。')) return;
    exportData('學年結束備份');
    Object.assign(state, { students: {}, done: {}, contact: {}, log: [], forest: { level: 1, points: 0 } });
    Object.assign(state.settings, { names: {}, vacant: [], schoolYear: '', semester: '' });
    save(); renderAll();
    toast('✅ 已清空，請設定新班級資料', 3000);
    openConsole('basic');
  };
  $('#dWipe').onclick = () => {
    if (!confirm('確定要清除「全部」資料嗎？此動作無法復原。')) return;
    if (prompt('請輸入「確定重設」四個字') !== '確定重設') return;
    localStorage.removeItem(KEY); sessionStorage.removeItem('jl-auth'); location.reload();
  };
  $('#dLogout').onclick = () => { lockNow(); closeModal(); toast('🔒 已上鎖'); };
}
function exportData(tag = '備份') {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `班級儀表板_${state.settings.className}_${tag}_${dateKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- 其他按鈕 ---------------- */
$('#fullBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
$('#cleanBtn').onclick = () => { document.body.classList.add('clean'); $('#cleanClock').classList.remove('hidden'); tick(); };
$('#cleanClock').onclick = () => { document.body.classList.remove('clean'); $('#cleanClock').classList.add('hidden'); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden') && !celebrateQueue.running) closeModal();
});

/* ---------------- 啟動 ---------------- */
function renderAll() {
  renderHeader(); renderSchedule(); renderContact(); renderCountdowns(); renderTaskWidget(); renderCritters();
  const active = $('.page.active')?.dataset.page; if (active) renderPage(active);
}
bindTabs('left');
bindTabs('tool');
renderAmbient();
buildStars();
updateSky();
showTimer(); showPomo();
$('#noiseLine').style.left = $('#noiseThreshold').value + '%';
renderAll();
tick();
setInterval(tick, 1000);
loadWeather();
if (!state.settings.setupDone) openSetup();
})();
