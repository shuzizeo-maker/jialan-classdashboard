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
/* ---------------- 🧩 應用中心：資料（v1.14.0） ----------------
 * state.apps：所有班級共用、包含在備份裡；完全重設回到預設；開始新學年保留。
 *   { id, name, emoji, url（只能 https）, desc, cat, openMode: 'embed' 在儀表板裡打開／'newtab' 新分頁, pinned, order }
 * 監考是內建的第一個應用（id 'exam'），不能刪除；網址沿用 settings.examUrl，「顯示按鈕」＝ pinned。
 * settings.examUrl／examBtn 仍然同步保留（舊版打開備份也看得懂）。
 */
const DEFAULT_EXAM_URL = 'https://exam-smart-board-v6-persistent-audio.pages.dev/';
const APP_MAX_PINNED = 3;
const APP_CATS = ['課堂', '評量', '班務', '其他'];
const APP_MODES = { embed: '在儀表板裡打開', newtab: '用新分頁打開' };
function parseExamUrl(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (!v) return { ok: false, reason: 'empty' };
  let u;
  try { u = new URL(v); } catch (e) { return { ok: false, reason: 'bad' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'scheme' };
  if (!u.hostname || !u.hostname.includes('.')) return { ok: false, reason: 'bad' };
  return { ok: true, url: u.href };
}
const parseAppUrl = parseExamUrl;
function defaultExamApp(url = DEFAULT_EXAM_URL, pinned = true) {
  return { id: 'exam', name: '監考', emoji: '📝', url, desc: '全畫面打開智慧評量監考看板', cat: '評量', openMode: 'embed', pinned: !!pinned, order: 0, builtin: true };
}
/* v1.15.0：嘉蘭的內建應用（排在監考後面）。可以編輯、刪除；刪掉後不會再自動加回來（state.appsSeen 記住已經加過哪些）。
 * openMode 依各網站是否允許嵌入決定（2026-11-20 檢查）：
 *   嘉蘭樂學島（Google 協作平台）回應 X-Frame-Options: DENY → 只能新分頁
 *   嘉蘭工具箱（GitHub Pages）沒有禁止嵌入 → 在儀表板裡打開
 *   儀表板教學網（Netlify）沒有禁止嵌入，但學習進度存在教學網自己的瀏覽器空間，嵌在別的網站裡會跟直接打開的進度分開 → 新分頁
 */
const TUTORIAL_URL = 'https://classboard-teaching.netlify.app/';
const JL_APPS = [
  { id: 'jl-learn', name: '嘉蘭樂學島', emoji: '🏝️', url: 'https://sites.google.com/ttct.edu.tw/jalanlearn?usp=sharing', desc: '嘉蘭國小的學習網站（Google 協作平台）', cat: '課堂', openMode: 'newtab' },
  { id: 'jl-toolbox', name: '嘉蘭工具箱', emoji: '🧰', url: 'https://shuzizeo-maker.github.io/jialan-toolbox/', desc: '柯北老師整理的教學行政小工具，會持續增加', cat: '課堂', openMode: 'embed' },
  { id: 'jl-guide', name: '儀表板教學網', emoji: '📘', url: TUTORIAL_URL, desc: '零基礎教學：一步一步學會用班級儀表板', cat: '其他', openMode: 'newtab' }
];
const BUILTIN_APP_IDS = ['exam', ...JL_APPS.map(a => a.id)];
const jlApp = (a, order) => ({ ...a, pinned: false, order });
const defaultApps = () => [defaultExamApp(), ...JL_APPS.map((a, i) => jlApp(a, i + 1))];
// 把還沒加過的內建應用加進清單（插在前一個內建應用或監考後面），回傳更新後的 seen
function addMissingBuiltins(apps, seen) {
  const s = new Set(Array.isArray(seen) ? seen.filter(x => typeof x === 'string') : []);
  s.add('exam');
  JL_APPS.forEach((b, bi) => {
    if (s.has(b.id)) return;
    s.add(b.id);
    // 已經有同一個網站（老師自己加過）就不重複加
    const key = u => { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, '').toLowerCase(); } catch (e) { return ''; } };
    if (apps.some(a => a.id === b.id || key(a.url) === key(b.url))) return;
    let at = -1;
    for (let k = bi; k >= 0 && at < 0; k--) at = apps.findIndex(a => a.id === BUILTIN_APP_IDS[k]);
    apps.splice(at + 1, 0, jlApp(b, 0));
  });
  apps.forEach((a, i) => { a.order = i; });
  return [...s];
}
// 整理應用清單：補上監考、擋掉不安全的網址、最多釘選 3 個、依順序排好
function normalizeApps(list, settings = {}) {
  const sUrl = parseExamUrl(settings.examUrl);
  const hasBtn = typeof settings.examBtn === 'boolean';
  let apps;
  if (!Array.isArray(list)) {
    apps = [defaultExamApp(sUrl.ok ? sUrl.url : DEFAULT_EXAM_URL, settings.examBtn !== false), ...JL_APPS.map((a, i) => jlApp(a, i + 1))];
  } else {
    const seen = new Set();
    apps = list.filter(a => a && typeof a === 'object').map((a, i) => {
      const id = a.id === 'exam' ? 'exam' : String(a.id || '').trim() || 'a' + uid();
      if (seen.has(id)) return null;
      seen.add(id);
      const u = parseExamUrl(a.url);
      if (id !== 'exam' && !u.ok) return null;   // 不安全或格式不對的網址直接略過
      const name = String(a.name || '').trim().slice(0, 20) || (id === 'exam' ? '監考' : '');
      if (!name) return null;
      return {
        id, name, emoji: String(a.emoji || '').trim().slice(0, 4) || (id === 'exam' ? '📝' : '🔗'),
        url: u.ok ? u.url : DEFAULT_EXAM_URL,
        desc: String(a.desc || '').trim().slice(0, 60),
        cat: String(a.cat || '').trim().slice(0, 8) || '其他',
        openMode: a.openMode === 'newtab' ? 'newtab' : 'embed',
        pinned: !!a.pinned, order: Number.isFinite(+a.order) ? +a.order : i,
        ...(id === 'exam' ? { builtin: true } : {})
      };
    }).filter(Boolean);
    let ex = apps.find(a => a.id === 'exam');
    if (!ex) { ex = defaultExamApp(sUrl.ok ? sUrl.url : DEFAULT_EXAM_URL, settings.examBtn !== false); ex.order = -1; apps.push(ex); }
    // 舊版（v1.13 以前）改過 settings 裡的監考網址或按鈕 → 以 settings 為準（新版一定讓兩邊一致）
    if (sUrl.ok && sUrl.url !== ex.url) ex.url = sUrl.url;
    if (hasBtn && settings.examBtn !== ex.pinned) ex.pinned = settings.examBtn;
  }
  apps.sort((a, b) => a.order - b.order);
  let pins = 0;
  apps.forEach((a, i) => { a.order = i; if (a.pinned) { pins++; if (pins > APP_MAX_PINNED) a.pinned = false; } });
  return apps;
}
// 監考的網址、顯示按鈕同步回 settings（舊版相容）
function syncExamMirror(st) {
  const ex = (st.apps || []).find(a => a.id === 'exam');
  if (!ex) return;
  st.settings.examUrl = ex.url;
  st.settings.examBtn = !!ex.pinned;
}
/* ---------------- 🎌 國定假日與本校自訂（v1.16.0） ----------------
 * 國定假日：內建行政院人事行政總處「中華民國政府行政機關辦公日曆表」115、116 年（2026、2027）官方 CSV 轉成的表；
 *   只存「放假的平日」與「有名稱的假日」（HOL_BUILTIN），以及「週末補班」（HOL_WORK_BUILTIN，2026、2027 都沒有）。
 *   內建以外的年份：設定 settings.holOnline（預設開）時，從 ruyut/TaiwanCalendar 的公開 CDN 網址（同一份官方資料的 JSON）下載，
 *   存在這個瀏覽器的 localStorage（HOL_CACHE_KEY，不放進備份；完全重設會清掉）。沒有網路就先不顯示那一年。
 * 本校自訂：state.schoolDays（所有班級共用、包含在備份裡、開始新學年保留），優先於國定假日：
 *   { id, from, to, name, type: 'off' 放假 | 'work' 上課／補課, wd: 補課上星期幾的課（1～5） }
 * 放假日：作息表顯示「🎌 今天 X 放假」、不算上課日（科任自動換班、整週課表、一週作業都會跳過）；補班／補課日照選定星期的課表上課。
 */
const HOL_BUILTIN = {
  2026: { '01-01': '開國紀念日', '02-15': '小年夜', '02-16': '農曆除夕', '02-17': '春節', '02-18': '春節', '02-19': '春節', '02-20': '補假', '02-27': '補假', '02-28': '和平紀念日', '04-03': '補假', '04-04': '兒童節', '04-05': '清明節', '04-06': '補假', '05-01': '勞動節', '06-19': '端午節', '09-25': '中秋節', '09-28': '孔子誕辰紀念日／教師節', '10-09': '補假', '10-10': '國慶日', '10-25': '臺灣光復暨金門古寧頭大捷紀念日', '10-26': '補假', '12-25': '行憲紀念日' },
  2027: { '01-01': '開國紀念日', '02-04': '小年夜', '02-05': '農曆除夕', '02-06': '春節', '02-07': '春節', '02-08': '春節', '02-09': '補假', '02-10': '補假', '02-28': '和平紀念日', '03-01': '補假', '04-04': '兒童節', '04-05': '清明節', '04-06': '補假', '04-30': '補假', '05-01': '勞動節', '06-09': '端午節', '09-15': '中秋節', '09-28': '孔子誕辰紀念日／教師節', '10-10': '國慶日', '10-11': '補假', '10-25': '臺灣光復暨金門古寧頭大捷紀念日', '12-24': '補假', '12-25': '行憲紀念日', '12-31': '補假' },
};
const HOL_WORK_BUILTIN = { 2026: {}, 2027: {} };
const HOL_CACHE_KEY = 'jialan-holidays-v1';
const HOL_CDN = y => `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${y}.json`;
const HOL_DAYS_OPTIONS = [1, 3, 7];
const SCHOOL_OFF_NAMES = ['歲時祭儀', '寒假', '暑假', '颱風假', '校慶補假', '運動會補假', '停課'];
const SCHOOL_WORK_NAMES = ['補課', '校慶', '運動會', '調整上課'];
const HOL_GENERIC = ['補假', '放假', '小年夜', '農曆除夕', '調整放假'];
const dkOf = d => typeof d === 'string' ? d.slice(0, 10) : dateKey(d);
const dkDate = dk => { const [y, m, da] = String(dk).split('-').map(Number); return new Date(y, m - 1, da, 12, 0, 0); };
const dkAdd = (dk, n) => { const d = dkDate(dk); d.setDate(d.getDate() + n); return dateKey(d); };
const dkWd = dk => dkDate(dk).getDay();
const holFmt = dk => { const d = dkDate(dk); return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`; };
let _holCache = null;   // 讀一次就記在記憶體（每秒都會用到）
function holCache() {
  if (_holCache) return _holCache;
  try { const c = JSON.parse(localStorage.getItem(HOL_CACHE_KEY) || 'null'); _holCache = c && typeof c === 'object' && c.years ? c : { years: {} }; }
  catch (e) { _holCache = { years: {} }; }
  return _holCache;
}
// 把 ruyut/TaiwanCalendar 的 JSON（一年 365 天）轉成 { off: {'MM-DD': 名稱}, work: {...} }
function parseHolJSON(arr, y) {
  if (!Array.isArray(arr) || arr.length < 365) return null;
  const off = {}, work = {};
  for (const x of arr) {
    const ds = String(x && x.date || '');
    if (!/^\d{8}$/.test(ds) || ds.slice(0, 4) !== String(y)) return null;
    const k = ds.slice(4, 6) + '-' + ds.slice(6), we = x.week === '六' || x.week === '日';
    const note = String(x.description || '').trim().replace('/', '／').slice(0, 30);
    if (x.isHoliday && (note || !we)) off[k] = note || '放假';
    if (!x.isHoliday && we) work[k] = note || '補行上班';
  }
  return { off, work };
}
// 某一年的國定假日（內建 → 網路下載過的 → 沒有）
function holYear(y) {
  if (HOL_BUILTIN[y]) return { off: HOL_BUILTIN[y], work: HOL_WORK_BUILTIN[y] || {}, src: 'builtin' };
  const c = holCache().years[y];
  return c && c.off ? { off: c.off, work: c.work || {}, src: 'online', at: c.at } : null;
}
let holFetching = false;
let holHourKey = -1;   // 每小時整點檢查一次
// 下載還沒有的年份（今年、明年）；失敗 6 小時內不再試；網路版的資料 30 天更新一次
async function refreshHolidays({ force = false, now = new Date() } = {}) {
  if (holFetching) return { ok: false, msg: '正在更新' };
  if (state.settings.holOnline === false && !force) return { ok: false, msg: '已關閉自動更新' };
  if (typeof fetch !== 'function' || navigator.onLine === false) return { ok: false, msg: '沒有網路' };
  const y0 = now.getFullYear();
  const cache = holCache();
  const want = [y0, y0 + 1].filter(y => {
    if (HOL_BUILTIN[y]) return false;
    const c = cache.years[y];
    if (force) return true;
    if (c && c.off) return Date.now() - (c.at || 0) > 30 * 86400000;
    return !(c && c.failAt && Date.now() - c.failAt < 6 * 3600000);
  });
  if (!want.length) return { ok: true, got: [] };
  holFetching = true;
  const got = [];
  try {
    for (const y of want) {
      try {
        const data = parseHolJSON(await getJSON(HOL_CDN(y), 15000), y);
        if (!data) throw new Error('格式不符');
        cache.years[y] = { ...data, at: Date.now() };
        got.push(y);
      } catch (e) {
        const old = cache.years[y] || {};
        cache.years[y] = { ...old, failAt: Date.now() };   // 舊資料（如果有）留著繼續用
      }
    }
    try { localStorage.setItem(HOL_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
    _holCache = cache;
  } finally { holFetching = false; }
  if (got.length) { try { renderAll(); } catch (e) {} }
  return { ok: got.length === want.length, got };
}
// 本校自訂（後面的優先）
function schoolDayOn(dk) {
  let hit = null;
  (state.schoolDays || []).forEach(s => { if (s.from <= dk && dk <= (s.to || s.from)) hit = s; });
  return hit;
}
// 這一天是什麼日子：{ type: 'off' 放假 | 'work' 補班／補課 | 'normal', name, src: 'school' | 'national', wd }
function dayInfo(d) {
  const dk = dkOf(d);
  const sd = schoolDayOn(dk);
  if (sd) return sd.type === 'work' ? { type: 'work', name: sd.name || '補課', src: 'school', wd: sd.wd || 1, dk } : { type: 'off', name: sd.name || '放假', src: 'school', dk };
  if (state.settings.holShow !== false) {
    const Y = holYear(+dk.slice(0, 4)), k = dk.slice(5);
    if (Y && Y.work[k]) return { type: 'work', name: '補班', src: 'national', wd: 1, dk };
    if (Y && Y.off[k]) return { type: 'off', name: Y.off[k], src: 'national', dk };
  }
  return { type: 'normal', dk };
}
const isOffDay = d => dayInfo(d).type === 'off';
// 上課日：補班／補課日算；放假日不算；其他看星期一～五
function isSchoolDay(d) {
  const i = dayInfo(d);
  if (i.type === 'work') return true;
  if (i.type === 'off') return false;
  const w = dkWd(i.dk); return w >= 1 && w <= 5;
}
// 課表要看星期幾（補班／補課日看老師選的那一天）
function effWd(d) {
  const i = dayInfo(d);
  return i.type === 'work' ? i.wd : dkWd(i.dk);
}
function nextSchoolDay(from = new Date()) {
  let dk = dkOf(from);
  for (let i = 0; i < 120; i++) { dk = dkAdd(dk, 1); if (isSchoolDay(dk)) return dk; }
  return '';
}
// 連假：連續的放假日＋週末（補班日會中斷）
const offRunDay = dk => { const i = dayInfo(dk); if (i.type !== 'normal') return i.type === 'off'; const w = dkWd(dk); return w === 0 || w === 6; };
function holRunAround(dk) {
  let a = dk, b = dk;
  for (let i = 0; i < 120 && offRunDay(dkAdd(a, -1)); i++) a = dkAdd(a, -1);
  for (let i = 0; i < 120 && offRunDay(dkAdd(b, 1)); i++) b = dkAdd(b, 1);
  const days = [];
  for (let x = a; x <= b; x = dkAdd(x, 1)) days.push(x);
  return days;
}
function holRunName(days) {
  const names = [];
  days.forEach(dk => { const i = dayInfo(dk); if (i.type === 'off' && !names.includes(i.name)) names.push(i.name); });
  const main = names.filter(n => !HOL_GENERIC.includes(n));
  const pick = main.length ? main : names.filter(n => n !== '補假');
  return pick.length ? pick.slice(0, 2).join('、') : '';
}
// 公告用：今天起 N 天內的放假與補班
function buildHolidayParts(now = new Date(), opt = {}) {
  const s = state.settings;
  const N = HOL_DAYS_OPTIONS.includes(+(opt.days ?? s.holAnnDays)) ? +(opt.days ?? s.holAnnDays) : 3;
  const today = dkOf(now), tomorrow = dkAdd(today, 1);
  const parts = [], seen = new Set();
  const until = k => k === 0 ? '' : `（還有 ${k} 天）`;
  const diff = dk => Math.round((dkDate(dk) - dkDate(today)) / 86400000);
  for (let i = 0; i <= N; i++) {
    const dk = dkAdd(today, i);
    if (seen.has(dk) || !offRunDay(dk)) continue;
    const run = holRunAround(dk);
    run.forEach(x => seen.add(x));
    // 整段都只是週末（例如假日剛好在星期六、日又沒有補假）→ 不公告
    if (!run.some(x => { const w = dkWd(x); return w >= 1 && w <= 5 && dayInfo(x).type === 'off'; })) continue;
    const name = holRunName(run);
    const a = run[0], b = run[run.length - 1], n = run.length;
    if (n === 1) {
      const nm = name || '放假';
      parts.push(a === today ? `🎌 今天 ${holFmt(a)} ${nm}，放假` : a === tomorrow ? `🎌 明天 ${holFmt(a)} ${nm} 放假` : `🎌 ${holFmt(a)} ${nm} 放假${until(diff(a))}`);
    } else {
      const label = !name ? `連假 ${n} 天` : /假$/.test(name) ? `${name} ${n} 天` : `${name}連假 ${n} 天`;
      const range = `${holFmt(a)}～${holFmt(b)}`;
      parts.push(a < today ? `🎌 ${label}，放到 ${holFmt(b)}` : a === today ? `🎌 今天起 ${range} ${label}` : a === tomorrow ? `🎌 明天起 ${range} ${label}` : `🎌 ${range} ${label}${until(diff(a))}`);
    }
  }
  if (s.holAnnWork !== false) {
    for (let i = 0; i <= N; i++) {
      const dk = dkAdd(today, i), inf = dayInfo(dk);
      if (inf.type !== 'work') continue;
      const when = dk === today ? '今天 ' : dk === tomorrow ? '明天 ' : '';
      const nm = inf.src === 'national' ? '補班' : (inf.name || '補課');
      parts.push(`⚠️ ${when}${holFmt(dk)} ${nm}，要上課（上星期${WEEK[inf.wd]}的課）${when ? '' : until(i)}`);
    }
  }
  return parts;
}
// 接下來的放假／補班清單（控制台預覽）
function upcomingHolidays(days = 120, now = new Date()) {
  const today = dkOf(now), list = [];
  for (let i = 0; i <= days; i++) {
    const dk = dkAdd(today, i), inf = dayInfo(dk), w = dkWd(dk);
    if (inf.type === 'work' || (inf.type === 'off' && (w >= 1 && w <= 5 || inf.src === 'school' || !HOL_GENERIC.includes(inf.name)))) list.push(inf);
  }
  return list;
}
function normalizeSchoolDays(list) {
  const okDk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(dkDate(v));
  return (Array.isArray(list) ? list : []).filter(x => x && okDk(x.from)).map(x => {
    const to = okDk(x.to) && x.to >= x.from ? x.to : x.from;
    const type = x.type === 'work' ? 'work' : 'off';
    const o = { id: String(x.id || 's' + uid()), from: x.from, to, name: String(x.name || '').trim().slice(0, 20) || (type === 'work' ? '補課' : '放假'), type };
    if (type === 'work') o.wd = [1, 2, 3, 4, 5].includes(+x.wd) ? +x.wd : 1;
    return o;
  }).sort((a, b) => a.from.localeCompare(b.from));
}
// 國定假日資料狀態（控制台顯示）
function holStatusText(now = new Date()) {
  const y0 = now.getFullYear();
  return [y0, y0 + 1].map(y => {
    const Y = holYear(y);
    if (Y && Y.src === 'builtin') return `${y} 年：內建（行政院人事行政總處）`;
    if (Y) return `${y} 年：已從網路更新（${new Date(Y.at).getMonth() + 1}/${new Date(Y.at).getDate()}）`;
    return `${y} 年：還沒有資料${state.settings.holOnline === false ? '（自動更新已關閉）' : '（連上網路時會自動下載；政府通常在前一年 6～7 月公布）'}`;
  }).join('；');
}

/* ---- 教師控制台 → 🎌 假日 ---- */
let sdEditId = null;   // null：沒在編輯；''：新增
function upsertSchoolDay(data, id = '') {
  const from = String(data.from || ''), to = String(data.to || '') || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ok: false, msg: '請選開始日期' };
  if (to < from) return { ok: false, msg: '結束日期不能比開始日期早' };
  if (Math.round((dkDate(to) - dkDate(from)) / 86400000) > 120) return { ok: false, msg: '一筆最多 120 天，寒暑假請分開輸入' };
  const rec = normalizeSchoolDays([{ ...data, from, to, id: id || 's' + uid() }])[0];
  const i = id ? state.schoolDays.findIndex(x => x.id === id) : -1;
  if (i >= 0) state.schoolDays[i] = rec; else state.schoolDays.push(rec);
  state.schoolDays = normalizeSchoolDays(state.schoolDays);
  save(); renderAll();
  return { ok: true, rec };
}
function deleteSchoolDay(id) {
  const n = state.schoolDays.length;
  state.schoolDays = state.schoolDays.filter(x => x.id !== id);
  if (state.schoolDays.length !== n) { save(); renderAll(); return true; }
  return false;
}
const sdRange = x => x.to && x.to !== x.from ? `${holFmt(x.from)}～${holFmt(x.to)}` : holFmt(x.from);
function ctHoliday(el) {
  const s = state.settings;
  const ed = sdEditId === null ? null : (sdEditId ? state.schoolDays.find(x => x.id === sdEditId) : { from: dateKey(), to: '', name: '', type: 'off', wd: 1 });
  const up = upcomingHolidays(120).slice(0, 15);
  el.innerHTML = `<p class="sub">國定假日會自動標在作息表、整週課表、一週作業和日期上，也會出現在跑馬燈公告。放假的平日不算上課日（科任老師的自動換班也會跳過）。</p>
    <h4 style="margin:6px 0 8px">⚙️ 設定（所有班級共用）</h4>
    <label class="chk" style="font-size:14px"><input type="checkbox" id="hShow" ${s.holShow !== false ? 'checked' : ''}> 顯示國定假日（關掉後只看「本校自訂」）</label>
    <div class="field" style="margin:8px 0"><span>公告提前幾天提醒放假</span><select id="hDays">${HOL_DAYS_OPTIONS.map(n => `<option value="${n}"${+s.holAnnDays === n || (!HOL_DAYS_OPTIONS.includes(+s.holAnnDays) && n === 3) ? ' selected' : ''}>${n} 天${n === 3 ? '（預設）' : ''}</option>`).join('')}</select></div>
    <label class="chk" style="font-size:14px"><input type="checkbox" id="hWork" ${s.holAnnWork !== false ? 'checked' : ''}> 公告提醒補班、補課（「⚠️ …補班，要上課」）</label>
    <label class="chk" style="font-size:14px"><input type="checkbox" id="hOnline" ${s.holOnline !== false ? 'checked' : ''}> 沒有內建的年份，自動從網路下載國定假日</label>
    <p class="sub hol-status" id="hStatus" style="font-size:12px">${esc(holStatusText())}</p>
    <div class="modal-actions" style="justify-content:space-between"><button type="button" class="btn" id="hRefresh">🔄 立刻從網路更新</button><button type="button" class="primary" id="hSave">儲存設定</button></div>
    <h4 style="margin:16px 0 8px">🏫 本校自訂（優先於國定假日）</h4>
    <p class="sub" style="font-size:13px">原住民族歲時祭儀、寒暑假、颱風假、校慶補假……加成「放假」；要補課的日子加成「上課（補課）」，並選上哪一天的課。所有班級共用，包含在備份裡，開始新學年會保留。</p>
    ${ed ? `<div class="ap-edit" id="sdEdit">
      <h4 style="margin:0 0 8px">${sdEditId ? '✏️ 編輯' : '＋ 新增'}</h4>
      <div class="ap-grid ap-grid2">
        <div class="field"><span>開始日期</span><input type="date" id="sdFrom" value="${esc(ed.from)}"></div>
        <div class="field"><span>結束日期（只有一天就留空）</span><input type="date" id="sdTo" value="${esc(ed.to && ed.to !== ed.from ? ed.to : '')}"></div>
      </div>
      <div class="ap-grid ap-grid2">
        <div class="field"><span>類型</span><select id="sdType"><option value="off"${ed.type !== 'work' ? ' selected' : ''}>🎌 放假</option><option value="work"${ed.type === 'work' ? ' selected' : ''}>📚 上課（補課）</option></select></div>
        <div class="field"><span>名稱</span><input id="sdName" maxlength="20" list="sdNames" value="${esc(ed.name)}" placeholder="${ed.type === 'work' ? '例如：補課' : '例如：歲時祭儀'}"><datalist id="sdNames">${[...SCHOOL_OFF_NAMES, ...SCHOOL_WORK_NAMES].map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
      </div>
      <div class="field" id="sdWdRow" style="display:${ed.type === 'work' ? '' : 'none'}"><span>這天上哪一天的課</span><select id="sdWd">${[1, 2, 3, 4, 5].map(w => `<option value="${w}"${(ed.wd || 1) === w ? ' selected' : ''}>星期${WEEK[w]}的課表</option>`).join('')}</select></div>
      <div class="err" id="sdErr"></div>
      <div class="modal-actions"><button type="button" class="btn" id="sdCancel">取消</button><button type="button" class="primary" id="sdSave">儲存</button></div>
    </div>` : `<div class="modal-actions" style="justify-content:flex-start;margin-top:0"><button type="button" class="primary" id="sdAdd">＋ 新增本校放假／補課</button></div>`}
    <div class="ap-list" id="sdList">${state.schoolDays.map(x => `<div class="ap-row sd-row sd-${x.type}" data-id="${esc(x.id)}">
      <span class="ap-emoji">${x.type === 'work' ? '📚' : '🎌'}</span>
      <div class="ap-info"><b>${esc(x.name)}</b><small>${esc(sdRange(x))}・${x.type === 'work' ? `上課（星期${WEEK[x.wd]}的課）` : '放假'}</small></div>
      <div class="ap-btns"><button type="button" class="btn" data-sd-edit="${esc(x.id)}">✏️ 編輯</button><button type="button" class="btn danger" data-sd-del="${esc(x.id)}">🗑️ 刪除</button></div></div>`).join('') || '<div class="empty">還沒有本校自訂的日子</div>'}</div>
    <h4 style="margin:16px 0 6px">🗓️ 接下來 120 天的放假與補班</h4>
    <div class="hol-up" id="hUp">${up.map(i => `<div class="hol-up-row hu-${i.type}"><span class="d">${holFmt(i.dk)}</span><b>${esc(i.type === 'work' && i.src === 'national' ? '補班' : i.name)}</b><small>${i.src === 'school' ? '本校' : '國定'}${i.type === 'work' ? `・上課（星期${WEEK[i.wd]}的課）` : '・放假'}</small></div>`).join('') || '<div class="empty">接下來 120 天沒有國定假日或本校自訂的日子</div>'}</div>`;
  const redraw = () => ctHoliday(el);
  $('#hSave').onclick = () => {
    s.holShow = $('#hShow').checked; s.holAnnDays = +$('#hDays').value || 3; s.holAnnWork = $('#hWork').checked; s.holOnline = $('#hOnline').checked;
    save(); renderAll(); toast('✅ 假日設定已儲存');
    if (s.holOnline) refreshHolidays().then(() => { const st = $('#hStatus'); if (st) st.textContent = holStatusText(); });
    redraw();
  };
  $('#hRefresh').onclick = async () => {
    $('#hStatus').textContent = '更新中…';
    const r = await refreshHolidays({ force: true });
    const st = $('#hStatus'); if (st) st.textContent = holStatusText();
    toast(r.got && r.got.length ? `✅ 已更新 ${r.got.join('、')} 年的國定假日` : r.msg === '沒有網路' ? '⚠️ 沒有網路，等連上網路再試' : r.ok ? '內建的年份不用更新，已經是最新' : '⚠️ 這次沒有更新成功（可能還沒公布），會再自動試', 4000);
  };
  if ($('#sdAdd')) $('#sdAdd').onclick = () => { sdEditId = ''; redraw(); };
  if ($('#sdType')) $('#sdType').onchange = e => { $('#sdWdRow').style.display = e.target.value === 'work' ? '' : 'none'; };
  if ($('#sdCancel')) $('#sdCancel').onclick = () => { sdEditId = null; redraw(); };
  if ($('#sdSave')) $('#sdSave').onclick = () => {
    const r = upsertSchoolDay({ from: $('#sdFrom').value, to: $('#sdTo').value, name: $('#sdName').value, type: $('#sdType').value, wd: +$('#sdWd').value }, sdEditId);
    if (!r.ok) { $('#sdErr').textContent = '⚠️ ' + r.msg; return; }
    toast(`✅ 已儲存「${r.rec.name}」${sdRange(r.rec)}`);
    sdEditId = null; redraw();
  };
  $('#sdList').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sdEdit) { sdEditId = b.dataset.sdEdit; redraw(); return; }
    if (b.dataset.sdDel) {
      const x = state.schoolDays.find(y => y.id === b.dataset.sdDel); if (!x) return;
      if (!(await askConfirm(`確定刪除「${x.name}」（${sdRange(x)}）？`, '刪除'))) return;
      deleteSchoolDay(x.id); toast(`🗑️ 已刪除「${x.name}」`); if (sdEditId === x.id) sdEditId = null; redraw();
    }
  };
}
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

// 預設跑馬燈歡迎詞：只放校名，班級名稱顯示時才自動接上（避免寫死某一班）
const ANN_WELCOME = '歡迎蒞臨';
const OLD_DEFAULT_ANN = '歡迎蒞臨臺東縣金峰鄉嘉蘭國民小學六年甲班'; // v1.8.1 以前的預設（寫死六年甲班）
function defaultAnnouncement(school) { return ANN_WELCOME + String(school || '').trim(); }
// 公告是不是「沒改過的預設歡迎詞」（舊版預設、或「歡迎蒞臨＋校名（＋班級）」）
function isDefaultAnnouncement(text, school, className) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t === OLD_DEFAULT_ANN || t === defaultAnnouncement('臺東縣金峰鄉嘉蘭國民小學')) return true;
  const sc = String(school || '').trim();
  if (!sc) return false;
  const base = defaultAnnouncement(sc);
  return t === base || (!!className && t === base + String(className).trim());
}
// 舊資料：公告還是舊版預設（含寫死的六年甲班）→ 換成「歡迎蒞臨＋校名」，班級名稱改由畫面自動接上
function migrateAnnouncement(st) {
  const s = st && st.settings; if (!s) return false;
  if (String(s.announcement || '').trim() === OLD_DEFAULT_ANN) { s.announcement = defaultAnnouncement(s.school); return true; }
  return false;
}
// 改了校名：如果公告還是預設歡迎詞，跟著換成新校名
function refreshDefaultAnnouncement(s, oldSchool, oldClass) {
  if (isDefaultAnnouncement(s.announcement, oldSchool, oldClass)) s.announcement = defaultAnnouncement(s.school);
}
function defaults() {
  return {
    settings: {
      setupDone: false,
      school: '臺東縣金峰鄉嘉蘭國民小學',
      className: '六年甲班',
      schoolYear: '',
      semester: '',
      studentEdit: false,
      announcement: defaultAnnouncement('臺東縣金峰鄉嘉蘭國民小學'), // 班級名稱由 withClassName 自動接在校名後面
      theme: 'default',
      maxSeat: 20,
      vacant: [],
      names: {},
      pwHash: '',
      mode: 'single', // single＝導師（一個班）；multi＝科任老師（多個班）
      autoSwitch: true, // 多班級：上課時間到依週課表自動切換班級
      attAnnounce: true, // 點名：跑馬燈自動加上今日缺席
      attNames: false, // 點名：首頁與跑馬燈要不要顯示姓名（畫面是公開的，預設只顯示座號）
      examUrl: 'https://exam-smart-board-v6-persistent-audio.pages.dev/', // 📝 監考看板網址（所有班級共用）
      examBtn: true, // 底部是否顯示「📝 監考」
      timerStyle: 'island', // 計時器畫面：island＝🏝️ 3D 島嶼、simple＝簡潔、wheel＝🎡 彩色轉盤（v1.17.0）
      timerChar: '',        // 🎡 轉盤中間的角色：''＝知心、'custom'＝老師上傳（圖片在 IndexedDB）
      danceMusic: true, danceMusicVol: 60, // 🎵 跳舞音樂（v1.19.0）：彩色轉盤計時中播放；音量 0～100
      drawAnim: 'random', // 抽號動畫：random、slot、wheel、gacha、cards、pet、off
      holShow: true, holAnnDays: 3, holAnnWork: true, holOnline: true, // 🎌 國定假日：顯示、公告提前幾天、提醒補班、自動從網路更新
      loc: { name: '臺東縣 金峰鄉', lat: 22.60, lon: 120.96, source: 'openmeteo', cwaKey: '', cwaDataset: 'F-D0047-037', cwaTown: '金峰鄉' }
    },
    schedule: DEFAULT_SCHEDULE.map(r => ({ ...r })),
    timetable: {}, // { 1: { p1: '國語', ... }, ... 5: {...} }，1=星期一
    ttOverrides: {}, // { '2026-11-13': { periods:[{start,end,name,slot,subject,classId?}], note } }
    ttClass: {}, // 多班級：週課表每一格是哪一班 { 1: { p3: 'c_xxx' } }
    classes: [], // 多班級：[{ id, name, subject, data }]，目前班級的 data 為 null（資料在最上層）
    curClass: '',
    backup: { auto: false, freq: 'daily', weekdays: [5], time: '15:00', lastAt: '', lastName: '', lastError: '', folderName: '', target: '' },
    music: { tracks: [], loop: 'all', currentId: '' }, // 我的音樂：只存清單，音檔本身留在電腦
    contact: {},
    countdowns: [],
    taskDefs: [
      { id: 't1', name: '繳交作業', announce: false },
      { id: 't2', name: '訂正完成', announce: false },
      { id: 't3', name: '打掃完成', announce: false },
      { id: 't4', name: '放學整理', announce: false }
    ],
    done: {},
    // 作業檢查：依「佈置日」追蹤，今天佈置的明天才開始檢查
    homework: [],
    _hwMigrated: false,
    attendance: {}, // 點名：{ '2026-11-19': { 3: 'sick', 12: 'personal' } }；{} ＝ 已點名、全部出席
    students: {},
    forest: { level: 1, points: 0 },
    log: [],
    redemptions: [], coinManual: [], coinDaily: {}, // 金幣存摺（每班各自）
    prizes: [], // 獎品清單（所有班級共用）
    apps: defaultApps(), // 🧩 應用中心（所有班級共用）
    schoolDays: [], // 🎌 本校自訂放假／補課（所有班級共用）
    schoolCal: defaultSchoolCal(), // 📅 學校行事曆（GAS 網址、天數、排除關鍵字、活動快取：所有班級共用）
    scalPicks: [], // 📅 要放進公告的活動 id（每班各自）
    appsSeen: BUILTIN_APP_IDS.slice(), // 已經自動加過的內建應用（刪掉的不會再加回來）
    ui: { widgetTask: 't1', pageTask: 't1', tasksTab: 'hw', showHwDone: false, hwBrush: 'done' }
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return ensureClasses(defaults());
    return normalizeState(JSON.parse(raw));
  } catch (e) { console.warn(e); return ensureClasses(defaults()); }
}
// 把讀進來的資料（localStorage 或備份檔）補齊欄位、跑舊版轉換
function normalizeState(s) {
  {
    const d = defaults();
    // 舊版作息表沒有「節次」欄位，依名稱推算
    (s.schedule || []).forEach(r => { if (r.slot === undefined) r.slot = inferSlot(r.name); });
    // 舊版把「115學年度第一學期」整串放在學年度，拆成學年度＋學期
    const m = String(s.settings?.schoolYear || '').match(/(\d+)\s*學年度?\s*(?:第\s*([一二12])\s*學期)?/);
    if (m && s.settings) { s.settings.schoolYear = m[1]; if (m[2] && !s.settings.semester) s.settings.semester = { 1: '一', 2: '二' }[m[2]] || m[2]; }
    const merged = { ...d, ...s, settings: { ...d.settings, ...s.settings, loc: { ...d.settings.loc, ...(s.settings?.loc || {}) } }, ui: { ...d.ui, ...s.ui }, forest: { ...d.forest, ...s.forest }, backup: { ...d.backup, ...(s.backup || {}) }, ttOverrides: (s.ttOverrides && typeof s.ttOverrides === 'object') ? s.ttOverrides : {}, music: normalizeMusic(s.music) };
    if (!Array.isArray(merged.homework)) merged.homework = [];
    merged.attendance = normalizeAttendance(merged.attendance);
    if (!parseExamUrl(merged.settings.examUrl).ok) merged.settings.examUrl = d.settings.examUrl;
    merged.settings.examBtn = merged.settings.examBtn !== false;
    // v1.14.0 🧩 應用中心：舊資料沒有 apps → 用監考設定建立（監考是第一個內建應用）
    // 用原始資料的監考設定（沒有就不算「舊版改過」，避免預設值蓋掉應用中心的網址）
    merged.apps = normalizeApps(s.apps, { examUrl: s.settings?.examUrl, examBtn: s.settings?.examBtn });
    // v1.15.0：已經有應用清單的舊資料，補上還沒加過的嘉蘭內建應用（只補一次）
    merged.appsSeen = Array.isArray(s.apps) ? addMissingBuiltins(merged.apps, s.appsSeen) : BUILTIN_APP_IDS.slice();
    syncExamMirror(merged);
    if (!['island', 'simple', 'wheel'].includes(merged.settings.timerStyle)) merged.settings.timerStyle = 'island';
    if (merged.settings.timerChar !== 'custom') merged.settings.timerChar = '';
    merged.settings.danceMusic = merged.settings.danceMusic !== false;
    { const v = Math.round(Number(merged.settings.danceMusicVol)); merged.settings.danceMusicVol = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 60; }
    if (!['random', 'slot', 'wheel', 'gacha', 'cards', 'pet', 'off'].includes(merged.settings.drawAnim)) merged.settings.drawAnim = 'random';
    if (!HW_BRUSH_ORDER.includes(merged.ui.hwBrush)) merged.ui.hwBrush = 'done';
    // v1.16.0 🎌 假日
    merged.settings.holShow = merged.settings.holShow !== false;
    merged.settings.holAnnWork = merged.settings.holAnnWork !== false;
    merged.settings.holOnline = merged.settings.holOnline !== false;
    if (!HOL_DAYS_OPTIONS.includes(+merged.settings.holAnnDays)) merged.settings.holAnnDays = 3; else merged.settings.holAnnDays = +merged.settings.holAnnDays;
    merged.schoolDays = normalizeSchoolDays(merged.schoolDays);
    // v1.20.0 📅 學校行事曆
    merged.schoolCal = normalizeSchoolCal(merged.schoolCal);
    merged.scalPicks = normalizeScalPicks(merged.scalPicks);
    (Array.isArray(merged.classes) ? merged.classes : []).forEach(c => { if (c && c.data) c.data.scalPicks = normalizeScalPicks(c.data.scalPicks); });
    // v1.13.0 金幣存摺：舊資料補上 earned／spent、兌換紀錄等欄位
    merged.prizes = normalizePrizes(merged.prizes);
    fixClassBook(merged);
    (Array.isArray(merged.classes) ? merged.classes : []).forEach(c => { if (c && c.data) fixClassBook(c.data); });
    migrateTaskAnnounce(merged);
    migrateHomework(merged);
    migrateAnnouncement(merged);
    (Array.isArray(merged.classes) ? merged.classes : []).forEach(c => {
      const cs = c && c.data && c.data.settings;
      if (cs && String(cs.announcement || '').trim() === OLD_DEFAULT_ANN) cs.announcement = defaultAnnouncement(merged.settings.school);
    });
    return ensureClasses(merged);
  }
}

/* ---------------- 📅 學校行事曆（v1.20.0） ----------------
 * 資料來源：老師自己部署的 Google Apps Script 網頁應用程式（scripts/school-calendar-gas.gs），
 *   用老師的 Google 帳號讀學校日曆，回傳 JSON；日曆不用公開、沒有 CORS 問題。
 *   fetch(網址?days=N, { signal, cache: 'no-store' })，不加自訂 header（不會觸發 preflight）。
 * state.schoolCal（所有班級共用、包含在備份裡、開始新學年保留）：
 *   { url, days（1～30，預設 7）, exclude（排除關鍵字）, excludeOn, cache: { events, calendarName, updatedAt, fetchedAt, error, errorAt } }
 * state.scalPicks（每班各自）：勾選要放進跑馬燈公告的活動 id。新抓到的活動一律「不勾」（避免教師專屬活動誤上公告）。
 * 公告：只放「已勾選、沒被排除、日期在今天～今天＋天數−1」的活動；過期的自動消失。
 * 兩個地方都可以勾：教師控制台「📅 學校行事曆」、點公告打開的「基本資料」（手寫公告下面），同一份資料。
 */
const SCAL_DAYS_DEFAULT = 7, SCAL_DAYS_MIN = 1, SCAL_DAYS_MAX = 30;
const SCAL_CAL_ID = 'c_e5107a5c48d5f34dfbe44359b98e0fa6fe034002f45eae1e60cb8e8a7449e521@group.calendar.google.com';
const SCAL_AUTO_MS = 60 * 60 * 1000;   // 自動更新：超過 1 小時（或換日）
const SCAL_GAS_CODE = "/**\n * 嘉蘭班級儀表板：📅 學校行事曆橋接（Google Apps Script 網頁應用程式）\n *\n * 用途：用「您自己的 Google 帳號」讀學校的 Google 日曆，回傳 JSON 給儀表板。\n *       日曆不用公開，也沒有 CORS 問題（儀表板直接 fetch 這個網址）。\n *\n * 3 分鐘設定：\n *   1. 用看得到學校日曆的 Google 帳號打開 https://script.google.com →「新專案」。\n *   2. 把這整個檔案貼進 Code.gs（取代原本的內容），按 💾 儲存。\n *      （日曆 ID 不同時，改下面的 CALENDAR_ID。）\n *   3. 右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」：\n *        執行身分：我（您的帳號）\n *        誰可以存取：所有人\n *      按「部署」→ 第一次會要求授權（選帳號 →「進階」→「前往（不安全）」→「允許」）。\n *   4. 複製「網頁應用程式網址」（https://script.google.com/macros/s/……/exec），\n *      貼到儀表板「教師控制台 → 📅 學校行事曆」，按「🔄 立即更新」。\n *   之後改了程式要「部署 → 管理部署作業 → ✏️ → 版本：新版本」，網址才會用到新程式。\n *\n * 網址參數：?days=N   今天起 N 天（含今天，預設 7，限制 1～30）\n * 回傳：{ ok: true, calendarName, updatedAt, days, events: [ { id, title, start, end, allDay, location } ] }\n *   start／end：全天活動是 YYYY-MM-DD（end＝最後一天，含當天）；有時間的是 YYYY-MM-DDTHH:mm；都是台灣時間。\n *   id：活動 ID＋'_'＋開始日期（重複活動每一次都可以分別勾選）。\n * 錯誤：{ ok: false, error: '說明' }\n * 只回傳標題、時間、地點，不回傳活動說明和參加者。\n */\nvar CALENDAR_ID = 'c_e5107a5c48d5f34dfbe44359b98e0fa6fe034002f45eae1e60cb8e8a7449e521@group.calendar.google.com';\nvar TZ = 'Asia/Taipei';\nvar DAY_MS = 24 * 60 * 60 * 1000;\nvar MAX_EVENTS = 300;\n\nfunction doGet(e) {\n  try {\n    var days = parseDays_(e && e.parameter ? e.parameter.days : '');\n    var cal = CalendarApp.getCalendarById(CALENDAR_ID);\n    if (!cal) {\n      return json_({ ok: false, error: '找不到日曆：請確認 CALENDAR_ID，以及部署這個程式的帳號看得到這個日曆' });\n    }\n    // 台灣時間「今天 00:00:00」到「今天＋days−1 的 23:59:59」（台灣沒有日光節約時間）\n    var todayKey = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');\n    var start = new Date(todayKey + 'T00:00:00+08:00');\n    var end = new Date(start.getTime() + days * DAY_MS - 1000);\n    var list = cal.getEvents(start, end);\n    var events = [];\n    for (var i = 0; i < list.length && events.length < MAX_EVENTS; i++) {\n      events.push(eventJson_(list[i]));\n    }\n    events.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });\n    return json_({\n      ok: true,\n      calendarName: cal.getName(),\n      updatedAt: Utilities.formatDate(new Date(), TZ, \"yyyy-MM-dd'T'HH:mm:ssXXX\"),\n      days: days,\n      events: events\n    });\n  } catch (err) {\n    return json_({ ok: false, error: String(err && err.message || err) });\n  }\n}\n\nfunction parseDays_(v) {\n  var n = parseInt(v, 10);\n  if (isNaN(n)) n = 7;\n  return Math.max(1, Math.min(30, n));\n}\n\nfunction eventJson_(ev) {\n  var allDay = ev.isAllDayEvent();\n  var start, end;\n  if (allDay) {\n    // 全天活動的日期以日曆的時區為準；結束日是「隔天 0 點」，減 1 毫秒變成最後一天\n    var ctz = Session.getScriptTimeZone();\n    var s = ev.getAllDayStartDate(), x = ev.getAllDayEndDate();\n    start = Utilities.formatDate(s, ctz, 'yyyy-MM-dd');\n    end = Utilities.formatDate(new Date(x.getTime() - 1), ctz, 'yyyy-MM-dd');\n    if (end < start) end = start;\n  } else {\n    start = Utilities.formatDate(ev.getStartTime(), TZ, \"yyyy-MM-dd'T'HH:mm\");\n    end = Utilities.formatDate(ev.getEndTime(), TZ, \"yyyy-MM-dd'T'HH:mm\");\n  }\n  return {\n    id: ev.getId() + '_' + start.slice(0, 10),\n    title: String(ev.getTitle() || '').trim(),\n    start: start,\n    end: end,\n    allDay: allDay,\n    location: String(ev.getLocation() || '').trim()\n  };\n}\n\nfunction json_(obj) {\n  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);\n}\n";
function defaultSchoolCal() {
  return { url: '', days: SCAL_DAYS_DEFAULT, exclude: '', excludeOn: true, cache: { events: [], calendarName: '', updatedAt: '', fetchedAt: 0, error: '', errorAt: 0 } };
}
const scalDays = v => { const n = (v === '' || v === null || v === undefined || (typeof v === 'string' && !v.trim())) ? NaN : Math.round(Number(v)); return Number.isFinite(n) ? Math.max(SCAL_DAYS_MIN, Math.min(SCAL_DAYS_MAX, n)) : SCAL_DAYS_DEFAULT; };
// 天數輸入框（v1.20.1）：打字中不碰它；離開／按 Enter 時才驗證。空白或不是數字 → 回到原本的天數；超出 → 限制在 1～30
const scalDaysInput = (v, cur) => { const t = String(v ?? '').trim(); const n = t === '' ? NaN : Math.round(Number(t)); return Number.isFinite(n) ? Math.max(SCAL_DAYS_MIN, Math.min(SCAL_DAYS_MAX, n)) : scalDays(cur); };
const SCAL_DK = /^\d{4}-\d{2}-\d{2}$/, SCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// 一筆活動（GAS 回傳或快取）→ 乾淨的格式；格式不對回傳 null
function scalEvent(x) {
  if (!x || typeof x !== 'object') return null;
  const start = String(x.start || '').slice(0, 16);
  if (!SCAL_DK.test(start) && !SCAL_DT.test(start)) return null;
  const allDay = typeof x.allDay === 'boolean' ? x.allDay : SCAL_DK.test(start);
  let end = String(x.end || '').slice(0, 16);
  if (!SCAL_DK.test(end) && !SCAL_DT.test(end)) end = start;
  if (allDay) { end = end.slice(0, 10); if (end < start.slice(0, 10)) end = start.slice(0, 10); }
  else if (end < start) end = start;
  return {
    id: String(x.id || '').slice(0, 300) || `${start}_${String(x.title || '').slice(0, 20)}`,
    title: String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 80) || '（沒有標題）',
    start: allDay ? start.slice(0, 10) : start, end, allDay,
    location: String(x.location || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  };
}
function scalEvents(list) {
  const seen = new Set(), out = [];
  (Array.isArray(list) ? list : []).forEach(x => { const e = scalEvent(x); if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); } });
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)).slice(0, 300);
}
function normalizeSchoolCal(c) {
  const d = defaultSchoolCal();
  c = c && typeof c === 'object' ? c : {};
  const k = c.cache && typeof c.cache === 'object' ? c.cache : {};
  const url = String(c.url || '').trim();
  return {
    url: /^https:\/\//i.test(url) ? url.slice(0, 500) : '',
    days: scalDays(c.days ?? d.days),
    exclude: String(c.exclude || '').slice(0, 300),
    excludeOn: c.excludeOn !== false,
    cache: {
      events: scalEvents(k.events), calendarName: String(k.calendarName || '').slice(0, 100), updatedAt: String(k.updatedAt || '').slice(0, 40),
      fetchedAt: Number(k.fetchedAt) || 0, error: String(k.error || '').slice(0, 300), errorAt: Number(k.errorAt) || 0
    }
  };
}
function normalizeScalPicks(a) { return [...new Set((Array.isArray(a) ? a : []).map(x => String(x || '')).filter(Boolean))].slice(0, 500); }
// GAS 回傳的 JSON → { ok, events, ... }；格式不對丟出錯誤（訊息給老師看）
function parseSchoolCal(j) {
  if (!j || typeof j !== 'object') throw new Error('回傳的資料不是 JSON');
  if (j.ok === false) throw new Error('Apps Script 回報錯誤：' + String(j.error || '不明原因').slice(0, 200));
  if (j.ok !== true || !Array.isArray(j.events)) throw new Error('回傳的資料格式不對（不是學校行事曆的 Apps Script？）');
  return { events: scalEvents(j.events), calendarName: String(j.calendarName || '').slice(0, 100), updatedAt: String(j.updatedAt || '').slice(0, 40), days: scalDays(j.days) };
}
function scalUrl(base, days) {
  const u = new URL(base); u.searchParams.set('days', String(scalDays(days))); return u.toString();
}
// 驗證老師貼上的網址
function parseScalUrl(v) {
  const t = String(v || '').trim();
  if (!t) return { ok: true, url: '' };
  let u; try { u = new URL(t); } catch (e) { return { ok: false, msg: '網址格式不對，請整段複製「網頁應用程式網址」' }; }
  if (u.protocol !== 'https:') return { ok: false, msg: '網址要用 https:// 開頭' };
  const warn = /^script\.google(usercontent)?\.com$/.test(u.hostname) && /\/exec$/.test(u.pathname) ? '' : /\/dev$/.test(u.pathname) ? '這是「測試部署」網址（/dev），只有您登入時能用；請用「部署」產生的 /exec 網址' : '';
  return { ok: true, url: t, warn };
}
let scalFetching = false;
let scalAgain = false;   // v1.20.1
async function scalRefresh({ force = false } = {}) {
  const c = state.schoolCal;
  if (!c.url) return { ok: false, msg: '還沒有設定 Apps Script 網址' };
  if (scalFetching) { if (force) scalAgain = true; return { ok: false, msg: '正在更新' }; }   // v1.20.1：正在抓時改了天數／網址 → 抓完再抓一次
  if (typeof fetch !== 'function' || navigator.onLine === false) { c.cache.error = '沒有網路'; c.cache.errorAt = Date.now(); scalRender(); return { ok: false, msg: '沒有網路' }; }
  scalFetching = true; scalRender();
  const ac = typeof AbortController === 'function' ? new AbortController() : null, t = ac ? setTimeout(() => ac.abort(), 20000) : 0;
  try {
    const r = await fetch(scalUrl(c.url, c.days), { signal: ac ? ac.signal : undefined, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('回傳的不是 JSON：請確認部署時「誰可以存取」選「所有人」，而且網址是 /exec 結尾'); }
    const data = parseSchoolCal(j);
    Object.assign(c.cache, { events: data.events, calendarName: data.calendarName, updatedAt: data.updatedAt, fetchedAt: Date.now(), error: '', errorAt: 0 });
    // 日曆上已經刪掉的活動，從這一班的勾選拿掉（其他班切換回來時看不到也不會公告）
    const ids = new Set(data.events.map(e => e.id));
    state.scalPicks = normalizeScalPicks(state.scalPicks).filter(id => ids.has(id));
    save(); renderAll();
    return { ok: true, count: data.events.length, force };
  } catch (e) {
    c.cache.error = e && e.name === 'AbortError' ? '連線逾時（20 秒）' : e && e.name === 'TypeError' ? '無法連線（網路中斷，或網址不正確）' : String(e && e.message || e);
    c.cache.errorAt = Date.now(); save();
    return { ok: false, msg: c.cache.error };
  } finally {
    clearTimeout(t); scalFetching = false; scalRender();
    if (scalAgain) { scalAgain = false; setTimeout(() => scalRefresh({ force: true }).catch(() => {}), 0); }
  }
}
// 自動更新：有網址、超過 1 小時或換日了才抓
function scalAuto(now = new Date()) {
  const c = state.schoolCal; if (!c || !c.url) return;
  const k = c.cache, last = Math.max(k.fetchedAt || 0, k.errorAt || 0);
  if (!last || Date.now() - last > SCAL_AUTO_MS || dkOf(new Date(last)) !== dkOf(now)) scalRefresh().catch(() => {});
}
// 今天～今天＋天數−1 之間（跨日活動只要還沒結束就算）
function scalInRange(e, now = new Date(), days = state.schoolCal.days) {
  const today = dkOf(now), last = dkAdd(today, scalDays(days) - 1);
  return e.end.slice(0, 10) >= today && e.start.slice(0, 10) <= last;
}
const scalWords = v => String(v || '').split(/[,，、;；\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
const scalHit = (e, words) => words.some(w => (e.title + ' ' + e.location).toLowerCase().includes(w));
function scalExcluded(e, c = state.schoolCal) { return c.excludeOn !== false && scalHit(e, scalWords(c.exclude)); }
// 清單要顯示的活動（搜尋＋排除）；excluded＝被排除關鍵字擋掉的數量
function scalVisible(q = scalQuery, now = new Date()) {
  const c = state.schoolCal, words = scalWords(q);
  const inRange = c.cache.events.filter(e => scalInRange(e, now));
  const notEx = inRange.filter(e => !scalExcluded(e, c));
  return { list: words.length ? notEx.filter(e => words.every(w => (e.title + ' ' + e.location).toLowerCase().includes(w))) : notEx, excluded: inRange.length - notEx.length, total: inRange.length };
}
// 日期文字：11/24（二）；今天／明天加前綴；有時間加 08:30；跨日 11/26（四）～11/27（五）
function scalWhen(e, now = new Date()) {
  const today = dkOf(now), tomorrow = dkAdd(today, 1);
  const a = e.start.slice(0, 10), b = e.end.slice(0, 10);
  const tm = e.allDay ? '' : ' ' + e.start.slice(11, 16);
  const pre = a === today ? '今天 ' : a === tomorrow ? '明天 ' : '';
  if (b > a) return `${pre}${holFmt(a)}${tm}～${holFmt(b)}`;
  return `${pre}${holFmt(a)}${tm}`;
}
function buildSchoolCalParts(now = new Date(), picks = state.scalPicks) {
  const c = state.schoolCal; if (!c || !c.cache) return [];
  const on = new Set(normalizeScalPicks(picks));
  return c.cache.events.filter(e => on.has(e.id) && scalInRange(e, now) && !scalExcluded(e, c)).map(e => `📅 ${scalWhen(e, now)} ${e.title}`);
}
function scalSetPick(id, on) {
  const set = new Set(normalizeScalPicks(state.scalPicks));
  if (on) set.add(id); else set.delete(id);
  state.scalPicks = [...set]; save(); renderAll(); scalRender();
}
function scalPickVisible() {   // 全選「目前顯示」的（搜尋、排除後看得到的）
  const set = new Set(normalizeScalPicks(state.scalPicks));
  scalVisible().list.forEach(e => set.add(e.id));
  state.scalPicks = [...set]; save(); renderAll(); scalRender();
}
function scalClearPicks() { state.scalPicks = []; save(); renderAll(); scalRender(); }
function scalStatusText(now = Date.now()) {
  const c = state.schoolCal, k = c.cache;
  if (!c.url) return '還沒有設定 Apps Script 網址';
  if (scalFetching) return '⏳ 更新中…';
  const ago = t => { const m = Math.round((now - t) / 60000); return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : `${new Date(t).getMonth() + 1}/${new Date(t).getDate()} ${pad(new Date(t).getHours())}:${pad(new Date(t).getMinutes())}`; };
  const okT = k.fetchedAt ? `上次更新：${ago(k.fetchedAt)}（${k.calendarName ? esc(k.calendarName) + '，' : ''}${k.events.length} 筆）` : '還沒有更新過';
  return k.error && k.errorAt >= (k.fetchedAt || 0) ? `⚠️ ${esc(k.error)}　${okT}` : okT;
}
/* ---- 畫面：兩個地方（控制台頁籤 prefix 'sc'、基本資料 prefix 'b'）共用 ---- */
let scalQuery = '';
const scalMounts = new Set();
function scalListHTML(now = new Date()) {
  const v = scalVisible(scalQuery, now), on = new Set(state.scalPicks), today = dkOf(now);
  if (!state.schoolCal.cache.events.length) return `<p class="sub scal-empty">${state.schoolCal.cache.fetchedAt ? `接下來 ${state.schoolCal.days} 天沒有活動。` : '還沒有活動資料，請按「🔄 立即更新」。'}</p>`;
  const rows = v.list.map(e => `<label class="scal-row${on.has(e.id) ? ' on' : ''}${e.start.slice(0, 10) === today ? ' today' : ''}"><input type="checkbox" data-scal-id="${esc(e.id)}"${on.has(e.id) ? ' checked' : ''}>
    <span class="scal-when">${esc(scalWhen(e, now))}${e.allDay ? '<small>全天</small>' : ''}</span><b class="scal-title">${esc(e.title)}</b>${e.location ? `<small class="scal-loc">📍${esc(e.location)}</small>` : ''}</label>`).join('');
  const note = [v.excluded ? `已排除 ${v.excluded} 筆（排除關鍵字）` : '', scalQuery.trim() ? `搜尋到 ${v.list.length} 筆` : '', `已勾選 ${buildSchoolCalParts(now).length} 筆會出現在公告`].filter(Boolean).join('・');
  return (rows || '<p class="sub scal-empty">沒有符合的活動。</p>') + `<p class="sub scal-note">${note}</p>`;
}
function scalMount(el, pre) {
  if (!el) return;
  el.dataset.scalPre = pre; scalMounts.add(el);
  const c = state.schoolCal;
  if (pre === 'b') {
    el.innerHTML = `<h4 style="margin:0 0 8px">📅 本週學校行事曆（勾選加入公告）${isMulti() ? `<b class="cls-note">勾選只影響「${esc(classLabel(curClassObj()))}」</b>` : ''}</h4>
      <div id="bScNoUrl" style="display:${c.url ? 'none' : ''}"><p class="sub" style="margin:0 0 8px">還沒有設定學校行事曆（需要先部署一個 Google Apps Script，約 3 分鐘）。</p><button type="button" class="btn" id="bScGo">📅 前往設定學校行事曆</button></div>
      <div id="bScMain" style="display:${c.url ? '' : 'none'}">
        <div class="scal-tools"><input id="bScQ" class="scal-q scal-input" type="search" placeholder="🔍 搜尋標題或地點" value="${esc(scalQuery)}"><button type="button" class="btn" id="bScAll">全選目前顯示</button><button type="button" class="btn" id="bScNone">全部取消</button><button type="button" class="btn" id="bScRefresh">🔄 重新整理</button></div>
        <small class="scal-status" id="bScStatus">${scalStatusText()}</small>
        <div class="scal-list" id="bScList">${scalListHTML()}</div>
      </div>`;
    $('#bScGo').onclick = () => openConsole('scal');
  } else {
    el.innerHTML = `<p class="sub">用 Google Apps Script 讀學校的 Google 日曆（日曆不用公開）。勾選的活動會出現在首頁跑馬燈公告（📅 今天 11/24（二） 活動名稱）；<b>新抓到的活動預設不勾</b>，過期的自動消失。</p>
      <h4 style="margin:6px 0 8px">⚙️ 設定（所有班級共用）</h4>
      <div class="field"><span>Apps Script 網頁應用程式網址（https://script.google.com/macros/s/……/exec）</span>
        <div class="exam-url-row"><input id="scUrl" type="url" value="${esc(c.url)}" placeholder="https://script.google.com/macros/s/……/exec" autocomplete="off"><button type="button" class="btn primary" id="scSave">儲存網址</button></div></div>
      <div class="scal-tools"><label class="scal-days">顯示天數 <input id="scDays" class="scal-input scal-days-in" type="number" inputmode="numeric" min="${SCAL_DAYS_MIN}" max="${SCAL_DAYS_MAX}" step="1" value="${c.days}" aria-label="顯示天數（1～30）"> 天（今天起，1～30，預設 7）</label><button type="button" class="btn" id="scRefresh">🔄 立即更新</button></div>
      <small class="scal-status" id="scStatus">${scalStatusText()}</small>
      <div class="err" id="scErr"></div>
      <h4 style="margin:14px 0 8px">📋 活動清單（勾選＝加入${isMulti() ? `「${esc(classLabel(curClassObj()))}」的` : ''}公告）</h4>
      <div class="scal-tools"><input id="scQ" class="scal-q scal-input" type="search" placeholder="🔍 搜尋標題或地點" value="${esc(scalQuery)}"></div>
      <div class="scal-tools"><input id="scEx" class="scal-q scal-input" value="${esc(c.exclude)}" placeholder="排除關鍵字，例：教師, 會議, 研習"><label class="chk" style="font-size:14px"><input type="checkbox" id="scExOn"${c.excludeOn !== false ? ' checked' : ''}> 排除（不顯示、不公告）</label></div>
      <div class="scal-tools"><button type="button" class="btn" id="scAll">全選目前顯示</button><button type="button" class="btn" id="scNone">全部取消</button></div>
      <div class="scal-list" id="scList">${scalListHTML()}</div>
      <details class="scal-gas" id="scGas"><summary>📖 GAS 程式碼與 3 分鐘設定步驟</summary>
        <ol class="scal-steps">
          <li>用<b>看得到學校日曆</b>的 Google 帳號打開 <b>script.google.com</b> →「新專案」。</li>
          <li>按下面的「📋 複製 GAS 程式碼」，貼進 <b>Code.gs</b>（取代原本的內容），按 💾 儲存。日曆 ID 已經填好（<code>${esc(SCAL_CAL_ID.slice(0, 14))}…</code>）。</li>
          <li>右上角「<b>部署</b>」→「新增部署作業」→ 類型選「<b>網頁應用程式</b>」：執行身分「<b>我</b>」、誰可以存取「<b>所有人</b>」→「部署」。第一次要授權：選帳號 →「進階」→「前往（不安全）」→「允許」。</li>
          <li>複製「網頁應用程式網址」（<b>/exec</b> 結尾），貼到上面，按「儲存網址」。</li>
        </ol>
        <p class="sub" style="font-size:12px">只會回傳活動的標題、時間、地點（不含說明、參加者）。網址等於「讀取這個日曆」的鑰匙，請不要公開分享。改了程式要「部署 → 管理部署作業 → ✏️ → 新版本」。</p>
        <div class="scal-tools"><button type="button" class="btn" id="scCopy">📋 複製 GAS 程式碼</button></div>
        <p class="sub scal-code-hint" style="font-size:12px;margin:8px 0 4px">👇 下面就是完整程式碼（共 ${SCAL_GAS_CODE.split('\n').length} 行），可以上下捲動閱讀、反白看日曆 ID；要部署時按上面的「📋 複製 GAS 程式碼」。</p>
        <textarea id="scCode" class="scal-code" readonly rows="12" wrap="off" spellcheck="false" autocomplete="off" aria-label="GAS 程式碼（唯讀）">${esc(SCAL_GAS_CODE)}</textarea>
      </details>`;
    $('#scSave').onclick = () => {
      const r = parseScalUrl($('#scUrl').value);
      if (!r.ok) { $('#scErr').textContent = '⚠️ ' + r.msg; return; }
      $('#scErr').textContent = r.warn ? '⚠️ ' + r.warn : '';
      const changed = r.url !== c.url;
      c.url = r.url;
      if (changed) { c.cache = defaultSchoolCal().cache; state.scalPicks = []; }
      save(); renderAll(); toast(r.url ? '✅ 網址已儲存，正在更新…' : '已清除網址');
      if (r.url) scalRefresh({ force: true }); else scalRender();
    };
    // v1.20.1：打字時（input）完全不處理，不改值、不重畫；change 才驗證並存檔
    const applyDays = e => {
      const n = scalDaysInput(e.target.value, c.days);
      if (String(e.target.value).trim() !== String(n)) e.target.value = n;
      if (n === c.days) return;
      c.days = n; save(); renderAll(); scalRender();
      if (c.url) scalRefresh({ force: true });
    };
    $('#scDays').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
    $('#scDays').onchange = applyDays;   // 按上下微調、離開欄位、按 Enter
    $('#scDays').onblur = applyDays;     // 有些瀏覽器離開時不發 change，再保險一次（同一個值不會重複抓）
    $('#scEx').oninput = e => { c.exclude = e.target.value.slice(0, 300); save(); renderAll(); scalRender(['scList', 'bScList']); };
    $('#scExOn').onchange = e => { c.excludeOn = e.target.checked; save(); renderAll(); scalRender(); };
    $('#scCopy').onclick = () => scalCopyCode();
  }
  const q = el.querySelector('.scal-q');
  if (q) q.oninput = e => { scalQuery = e.target.value; scalRender(['scList', 'bScList']); };
  const btn = id => el.querySelector('#' + (pre === 'b' ? 'bSc' : 'sc') + id);
  if (btn('All')) btn('All').onclick = () => scalPickVisible();
  if (btn('None')) btn('None').onclick = () => scalClearPicks();
  if (btn('Refresh')) btn('Refresh').onclick = async () => { const r = await scalRefresh({ force: true }); toast(r.ok ? `📅 已更新：${r.count} 筆活動` : '⚠️ ' + r.msg, 3500); };
  el.addEventListener('change', e => { const cb = e.target.closest('[data-scal-id]'); if (cb) scalSetPick(cb.dataset.scalId, cb.checked); });
}
// 重畫還在畫面上的清單與狀態（only：只重畫清單，搜尋框不動，避免打字時游標跳掉）
function scalRender(only) {
  [...scalMounts].forEach(el => {
    if (!el.isConnected) { scalMounts.delete(el); return; }
    const pre = el.dataset.scalPre, list = el.querySelector('#' + pre + 'ScList') || el.querySelector('#scList'), st = el.querySelector('#' + pre + 'ScStatus') || el.querySelector('#scStatus');
    if (list) list.innerHTML = scalListHTML();
    if (st) st.innerHTML = scalStatusText();
    if (!only && pre === 'b') { const has = !!state.schoolCal.url; $('#bScNoUrl').style.display = has ? 'none' : ''; $('#bScMain').style.display = has ? '' : 'none'; }
  });
}
async function scalCopyCode() {
  let ok = false;
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(SCAL_GAS_CODE); ok = true; } } catch (e) {}
  if (!ok) { const t = $('#scCode'); if (t) { t.focus(); t.select(); try { ok = document.execCommand('copy'); } catch (e) {} } }
  toast(ok ? '📋 已複製 GAS 程式碼，貼到 script.google.com 的 Code.gs' : '請在下面的框框按 Ctrl+A 全選、Ctrl+C 複製', 3500);
  return ok;
}
function ctSchoolCal(el) { scalMount(el, 'sc'); }

/* ---------------- 多班級（科任老師）資料層 ----------------
 * 目前班級的資料直接放在 state 最上層（欄位與 v1.7 完全相同，其他功能不用改）；
 * 其他班級的資料收在 state.classes[i].data，切換班級時互相交換。
 * 每班各自：學生名單（最大座號、空號、姓名）、金幣／物種／山林、每日任務與打卡、
 *           聯絡簿、作業檢查、加扣分紀錄、跑馬燈公告、班級名稱、任務選擇。
 * 每班各自（v1.20.0）：📅 學校行事曆要放進公告的活動（scalPicks）。
 * 全部共用：校名、學年學期、作息時間、週課表（含班級標記）、臨時調課、倒數日、📅 學校行事曆的設定與活動、
 *           天氣、環境音、我的音樂、備份設定、密碼、主題。
 */
const CLASS_KEYS = ['students', 'done', 'contact', 'homework', '_hwMigrated', 'forest', 'log', 'taskDefs', 'attendance', 'redemptions', 'coinManual', 'coinDaily', 'scalPicks'];
const CLASS_SETTINGS = ['className', 'maxSeat', 'vacant', 'names', 'announcement'];
const CLASS_UI = ['widgetTask', 'pageTask'];
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
function freshClassData(name, { maxSeat = 20, vacant = [], taskDefs } = {}) {
  return {
    students: {}, done: {}, contact: {}, homework: [], _hwMigrated: true, attendance: {},
    redemptions: [], coinManual: [], coinDaily: {}, scalPicks: [],
    forest: { level: 1, points: 0 }, log: [],
    taskDefs: clone(taskDefs || defaults().taskDefs),
    settings: { className: String(name || ''), maxSeat: Number(maxSeat) || 20, vacant: [...(vacant || [])], names: {}, announcement: '' },
    ui: { widgetTask: '', pageTask: '' }
  };
}
// 從最上層取出目前班級的資料
function pickClassData(st) {
  const o = { settings: {}, ui: {} };
  CLASS_KEYS.forEach(k => { o[k] = st[k]; });
  CLASS_SETTINGS.forEach(k => { o.settings[k] = st.settings[k]; });
  CLASS_UI.forEach(k => { o.ui[k] = st.ui ? st.ui[k] : ''; });
  return o;
}
// 把某班的資料放到最上層（缺的欄位用空白班級補）
function putClassData(st, data) {
  const f = freshClassData(data?.settings?.className || '');
  data = data && typeof data === 'object' ? data : {};
  const ds = data.settings && typeof data.settings === 'object' ? data.settings : {};
  CLASS_KEYS.forEach(k => { st[k] = data[k] !== undefined ? data[k] : f[k]; });
  CLASS_SETTINGS.forEach(k => { st.settings[k] = ds[k] !== undefined ? ds[k] : f.settings[k]; });
  st.ui ||= {};
  CLASS_UI.forEach(k => { st.ui[k] = (data.ui && data.ui[k]) || ''; });
  if (!st.students || typeof st.students !== 'object') st.students = {};
  if (!st.done || typeof st.done !== 'object') st.done = {};
  if (!st.contact || typeof st.contact !== 'object') st.contact = {};
  st.attendance = normalizeAttendance(st.attendance);
  if (!Array.isArray(st.homework)) st.homework = [];
  if (!Array.isArray(st.log)) st.log = [];
  st.scalPicks = normalizeScalPicks(st.scalPicks);
  if (!Array.isArray(st.taskDefs)) st.taskDefs = f.taskDefs;
  st.forest = { level: 1, points: 0, ...(st.forest || {}) };
  if (!Array.isArray(st.settings.vacant)) st.settings.vacant = [];
  if (!st.settings.names || typeof st.settings.names !== 'object') st.settings.names = {};
  st.settings.maxSeat = Number(st.settings.maxSeat) || 20;
  migrateTaskAnnounce(st);
  migrateHomework(st);
}
// 確保有班級清單：舊版（只有一個班）的資料自動變成第一個班，資料完全不動
function ensureClasses(st) {
  st.settings ||= {};
  st.settings.mode = st.settings.mode === 'multi' ? 'multi' : 'single';
  if (typeof st.settings.autoSwitch !== 'boolean') st.settings.autoSwitch = true;
  if (!st.ttClass || typeof st.ttClass !== 'object' || Array.isArray(st.ttClass)) st.ttClass = {};
  const seen = new Set();
  let list = (Array.isArray(st.classes) ? st.classes : [])
    .filter(c => c && typeof c === 'object' && c.id && !seen.has(String(c.id)) && seen.add(String(c.id)))
    .map(c => ({
      id: String(c.id),
      name: String(c.name || c.data?.settings?.className || '').trim() || '未命名班級',
      subject: String(c.subject || '').trim(),
      data: c.data && typeof c.data === 'object' ? c.data : null
    }));
  if (!list.length) list = [{ id: 'c' + uid(), name: String(st.settings.className || '').trim() || '我的班級', subject: '', data: null }];
  const cur = list.find(c => c.id === st.curClass) || list.find(c => !c.data) || list[0];
  cur.data = null; // 目前班級的資料在最上層
  if (String(st.settings.className || '').trim()) cur.name = String(st.settings.className).trim();
  else st.settings.className = cur.name;
  list.forEach(c => {
    if (c === cur) return;
    if (!c.data) c.data = freshClassData(c.name);
    c.data.settings = { ...(c.data.settings || {}), className: c.name };
  });
  st.classes = list;
  st.curClass = cur.id;
  // 單班模式卻有好幾班（不應發生）→ 改成多班級模式，避免資料被藏起來
  if (list.length > 1) st.settings.mode = 'multi';
  return st;
}
// 匯入備份檔（舊版只有一個班、新版含所有班級都可以）
function importBackupData(d) {
  if (!d || typeof d !== 'object' || !d.settings || !d.students) throw new Error('格式不符');
  return normalizeState(clone(d));
}
// 舊資料沒有 announce 欄位時：名稱含「訂正」的任務預設顯示在公告，其餘不顯示
function migrateTaskAnnounce(st) {
  if (!Array.isArray(st.taskDefs) || !st.taskDefs.length) return;
  if (st.taskDefs.some(t => 'announce' in t)) return;
  st.taskDefs.forEach(t => { t.announce = /訂正/.test(String(t.name || '')); });
}
/* ---------------- 點名（資料層） ----------------
 * state.attendance = { 'YYYY-MM-DD': { 座號: 狀態 } }，每班分開（多班級時跟著班級資料走）。
 * 沒有那一天＝還沒點名；有那一天但是空物件＝已點名、全部出席。
 * 遲到算「有到」，不算缺席。保留最近 ATT_KEEP_DAYS 天（約一學期），新學年／完全重設會清空。
 */
const ATT = {
  sick: { label: '病假', short: '病', icon: '🤒' },
  personal: { label: '事假', short: '事', icon: '📝' },
  official: { label: '公假', short: '公', icon: '🏅' },
  truant: { label: '曠課', short: '曠', icon: '❗' },
  late: { label: '遲到', short: '遲', icon: '⏰' }
};
const ATT_ORDER = ['sick', 'personal', 'official', 'truant', 'late'];
const ATT_ABSENT = new Set(['sick', 'personal', 'official', 'truant']);
const ATT_KEEP_DAYS = 200;
function normalizeAttendance(a) {
  const out = {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) return out;
  Object.keys(a).forEach(dk => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
    const day = a[dk]; const d = {};
    if (day && typeof day === 'object') Object.keys(day).forEach(seat => { if (ATT[day[seat]] && +seat >= 1) d[+seat] = day[seat]; });
    out[dk] = d;
  });
  return out;
}
// 刪掉太舊的點名紀錄（預設留 200 天）
function pruneAttendance(att, today = dateKey(), keepDays = ATT_KEEP_DAYS) {
  const [y, m, d] = today.split('-').map(Number);
  const cut = dateKey(new Date(y, m - 1, d - keepDays));
  Object.keys(att || {}).forEach(k => { if (k < cut) delete att[k]; });
  return att;
}
// 設定某一天某座號的狀態（'' 或 'present' ＝ 出席）
function setAttendance(st, dk, seat, status) {
  st.attendance ||= {};
  const day = (st.attendance[dk] ||= {});
  if (!status || status === 'present' || !ATT[status]) delete day[seat];
  else day[seat] = status;
  pruneAttendance(st.attendance, dateKey());
  return day;
}
// 全部出席：清掉那一天的假別，並記錄「已點名」
function markAllPresent(st, dk) { st.attendance ||= {}; st.attendance[dk] = {}; return st.attendance[dk]; }
// 那一天的點名（只算還在名單上的座號，空號不算）
function attendanceOf(st, dk, seats) {
  const rec = st.attendance && st.attendance[dk];
  const ok = new Set(seats);
  const list = rec ? Object.keys(rec).map(Number).filter(n => ok.has(n)).sort((a, b) => a - b).map(n => ({ seat: n, status: rec[n] })) : [];
  const absent = list.filter(x => ATT_ABSENT.has(x.status));
  const late = list.filter(x => x.status === 'late');
  return { taken: !!rec, list, absent, late, present: seats.length - absent.length };
}
// 某一天缺席的座號（抽號、每日任務會跳過）
function absentSeats(st, dk, seats) { return attendanceOf(st, dk, seats).absent.map(x => x.seat); }
// 「03 號（病假）」；names：顯示姓名
function attWho(x, names, showNames) {
  const nm = showNames && names ? String(names[x.seat] || '').trim() : '';
  return `${pad(x.seat)} 號${nm ? ' ' + nm : ''}（${ATT[x.status].label}）`;
}
// 首頁卡片文字
function attSummaryText(info, names, showNames) {
  if (!info.taken) return '';
  const parts = [];
  if (info.absent.length) parts.push(`今日缺席 ${info.absent.length} 人：${info.absent.map(x => attWho(x, names, showNames)).join('、')}`);
  if (info.late.length) parts.push(`遲到：${info.late.map(x => { const nm = showNames && names ? String(names[x.seat] || '').trim() : ''; return `${pad(x.seat)} 號${nm ? ' ' + nm : ''}`; }).join('、')}`);
  return parts.length ? parts.join('　') : '今日全到 🎉';
}
// 跑馬燈片段（有缺席才出現）
function buildAttAnnPart(info, names, showNames) {
  if (!info.taken || !info.absent.length) return '';
  return `🙋 今日缺席 ${info.absent.length} 人：${info.absent.map(x => attWho(x, names, showNames)).join('、')}`;
}

/* ---------------- 作業檢查（資料層） ---------------- */
const HW_CYCLE = { miss: 'fix', fix: 'done', done: 'miss' };
const HW_LABEL = { miss: '沒交', fix: '要訂正', done: '完成' };
// v1.12.0：作業檢查「先選狀態，再點座號」（跟點名一樣），預設 ✓ 完成
const HW_BRUSH_ORDER = ['done', 'fix', 'miss'];
const HW_BRUSH = { done: { icon: '✓', label: '完成' }, fix: { icon: '✏️', label: '要訂正' }, miss: { icon: '✗', label: '沒交' } };
const HW_ICON = { miss: '📕', fix: '✏️', done: '✅' };

function migrateHomework(st) {
  if (!Array.isArray(st.homework)) st.homework = [];
  if (st._hwMigrated) return;
  // 從既有聯絡簿產生作業紀錄（今天的仍會被 UI 排除到隔天）
  Object.keys(st.contact || {}).forEach(dk => syncContactToHomework(dk, st));
  // 啟用作業檢查後，舊的「繳交作業／訂正完成」預設不再佔跑馬燈（老師仍可手動勾選）
  (st.taskDefs || []).forEach(t => {
    if (/^(繳交作業|訂正完成)$/.test(String(t.name || ''))) t.announce = false;
  });
  st._hwMigrated = true;
}

// 聯絡簿某一天 ↔ 作業紀錄同步
function syncContactToHomework(dk, st = state) {
  if (!Array.isArray(st.homework)) st.homework = [];
  const items = st.contact[dk] || [];
  const byCid = new Map();
  st.homework.forEach(h => {
    if (h.source === 'contact' && h.date === dk) byCid.set(h.contactId || h.id, h);
  });
  items.forEach(it => {
    const key = it.id;
    const exist = byCid.get(key);
    if (exist) {
      exist.title = it.text;
      byCid.delete(key);
    } else {
      st.homework.push({
        id: 'hw_' + it.id,
        contactId: it.id,
        date: dk,
        title: it.text,
        source: 'contact',
        skipped: false,
        statuses: {},
        coinAwarded: {}
      });
    }
  });
  // 聯絡簿已刪：沒有任何狀態紀錄就一併移除；已有檢查進度則保留
  byCid.forEach(h => {
    const has = h.statuses && Object.keys(h.statuses).length > 0;
    if (!has) st.homework = st.homework.filter(x => x.id !== h.id);
  });
}

function hwDateLabel(dk) {
  const [y, m, d] = dk.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d}（${WEEK[dt.getDay()]}）`;
}
function hwShortDate(dk) {
  const [, m, d] = dk.split('-');
  return `${+m}/${+d}`;
}
function hwStatusOf(h, seat) {
  return (h.statuses && h.statuses[seat]) || 'miss';
}
function hwCounts(h, seats = activeSeats()) {
  const c = { miss: 0, fix: 0, done: 0 };
  seats.forEach(s => { c[hwStatusOf(h, s)]++; });
  return c;
}
function hwIsComplete(h, seats = activeSeats()) {
  if (!seats.length) return true;
  return seats.every(s => hwStatusOf(h, s) === 'done');
}
// 開放檢查中的作業：佈置日早於今天、未略過、尚未全班完成
function openHomework(today = dateKey()) {
  return state.homework
    .filter(h => !h.skipped && h.date < today && !hwIsComplete(h))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function doneHomework(today = dateKey(), days = 14) {
  const cut = new Date(); cut.setHours(0, 0, 0, 0); cut.setDate(cut.getDate() - days);
  const cutKey = dateKey(cut);
  return state.homework
    .filter(h => !h.skipped && h.date < today && h.date >= cutKey && hwIsComplete(h))
    .sort((a, b) => b.date.localeCompare(a.date));
}
function addManualHomework(dk, title) {
  const t = String(title || '').trim();
  if (!t || !dk) return null;
  const item = {
    id: 'hwm_' + uid(),
    contactId: null,
    date: dk,
    title: t,
    source: 'manual',
    skipped: false,
    statuses: {},
    coinAwarded: {}
  };
  state.homework.push(item);
  return item;
}

/* ---------------- 一週作業規劃 ---------------- */
// weekAnchor = 該週任意一天；回傳週一～週五的 dateKey
function weekdaysOf(anchor = new Date()) {
  const d = new Date(anchor); d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0日
  const monOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d); mon.setDate(d.getDate() + monOffset);
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(mon); x.setDate(mon.getDate() + i);
    return dateKey(x);
  });
}
function weekRangeLabel(keys) {
  if (!keys.length) return '';
  const a = keys[0], b = keys[4];
  const fmt = k => `${+k.slice(5, 7)}/${+k.slice(8)}`;
  const thisWeek = weekdaysOf()[0] === keys[0];
  return `${fmt(a)}～${fmt(b)}${thisWeek ? '（本週）' : ''}`;
}

// 草稿：{ dateKey: string[] } 只存標題列
let weekDraft = null; // { anchor: Date, lines: { [dk]: string[] } }
function ensureWeekDraft(anchor) {
  const keys = weekdaysOf(anchor);
  const lines = {};
  keys.forEach(dk => {
    // 從聯絡簿載入（含一週作業寫入的項目）
    const items = (state.contact[dk] || []).map(it => it.text);
    lines[dk] = items.length ? items.slice() : [''];
  });
  weekDraft = { anchor: new Date(anchor), lines };
  return weekDraft;
}
// 把草稿的週一～週五依序對應到下一週的週一～週五
function copyWeekLines(draft) {
  const src = weekdaysOf(draft.anchor);
  const a = new Date(draft.anchor); a.setDate(a.getDate() + 7);
  const dst = weekdaysOf(a);
  const lines = {}; let total = 0;
  src.forEach((dk, i) => {
    const ls = (draft.lines[dk] || []).map(x => String(x || '').trim()).filter(Boolean);
    total += ls.length;
    lines[dst[i]] = ls.length ? ls : [''];
  });
  return { lines, total };
}
function readWeekGridFromDom() {
  if (!weekDraft) return;
  $$('#weekGrid .week-day').forEach(col => {
    const dk = col.dataset.date;
    weekDraft.lines[dk] = $$('.week-line input', col).map(inp => inp.value);
  });
}
function renderWeekPlanner() {
  if (!weekDraft) ensureWeekDraft(new Date());
  const keys = weekdaysOf(weekDraft.anchor);
  $('#weekRangeLabel').textContent = weekRangeLabel(keys);
  const DAYN = ['一', '二', '三', '四', '五'];
  $('#weekGrid').innerHTML = keys.map((dk, i) => {
    const lines = weekDraft.lines[dk] || [''];
    const [y, m, d] = dk.split('-').map(Number);
    const inf = dayInfo(dk);
    return `<div class="week-day${inf.type === 'off' ? ' hol' : ''}" data-date="${dk}" data-i="${i}">
      <div class="week-day-head"><b>週${DAYN[i]}</b><small>${m}/${d}</small></div>${inf.type === 'off' ? `<div class="week-hol">🎌 ${esc(inf.name)}・放假</div>` : ''}
      <div class="week-day-lines">${lines.map((v, li) =>
        `<div class="week-line" data-li="${li}">
          <input value="${esc(v)}" placeholder="作業（可空白）" maxlength="80">
          <button type="button" data-rm-line title="刪除此列">✕</button>
        </div>`).join('')}</div>
      <div class="week-day-actions">
        <button type="button" data-add-line>＋ 新增一列</button>
        ${i < 4 ? `<button type="button" data-copy-next>複製到下一天</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/** 將一週草稿寫入聯絡簿＋作業（依 date+title 合併，不重複）
 *  @returns {{added, kept, removed, skipped}} */
function applyWeekPlan(linesByDate) {
  const result = { added: 0, kept: 0, removed: 0, skipped: [] };
  Object.keys(linesByDate).forEach(dk => {
    const desired = [...new Set(
      (linesByDate[dk] || []).map(s => String(s || '').trim()).filter(Boolean)
    )];
    const existing = state.contact[dk] || [];
    const byText = new Map();
    existing.forEach(it => { if (!byText.has(it.text)) byText.set(it.text, it); });

    const next = [];
    const used = new Set();

    // 1) 規劃中的標題：已有就保留（標 fromWeek），沒有就新增
    desired.forEach(title => {
      const hit = byText.get(title);
      if (hit) {
        hit.fromWeek = true;
        next.push(hit);
        used.add(hit.id);
        used.add('t:' + title);
        result.kept++;
      } else {
        const id = uid();
        next.push({ id, text: title, fromWeek: true });
        used.add(id);
        used.add('t:' + title);
        result.added++;
      }
    });

    // 2) 保留非一週規劃的聯絡簿項目
    existing.forEach(it => {
      if (it.fromWeek) return;
      if (used.has(it.id) || used.has('t:' + it.text)) return;
      next.push(it);
      used.add(it.id);
      used.add('t:' + it.text);
    });

    // 3) 舊的 fromWeek 但不在 desired：無打卡則刪；有打卡則保留並列出
    existing.forEach(it => {
      if (!it.fromWeek) return;
      if (desired.includes(it.text)) return;
      const hw = (state.homework || []).find(h => h.contactId === it.id || h.id === 'hw_' + it.id);
      const hasStatus = hw && hw.statuses && Object.keys(hw.statuses).length > 0;
      if (hasStatus) {
        if (!used.has(it.id)) {
          next.push(it);
          used.add(it.id);
        }
        result.skipped.push(`${hwShortDate(dk)} ${it.text}`);
      } else {
        result.removed++;
        // 順便清掉無狀態的 homework
        if (hw && (!hw.statuses || !Object.keys(hw.statuses).length)) {
          state.homework = state.homework.filter(h => h.id !== hw.id);
        }
      }
    });

    state.contact[dk] = next;
    syncContactToHomework(dk);
  });
  return result;
}
function setHwStatus(h, seat, next) {
  h.statuses ||= {};
  h.coinAwarded ||= {};
  const prev = hwStatusOf(h, seat);
  if (prev === next) return;
  // 金幣：進入「完成」+1、離開「完成」−1（與每日任務打卡相同，避免同一次循環重複給）
  if (next === 'done' && prev !== 'done') {
    addCoins(seat, 1, '作業完成：' + h.title, false, 'hw');
    h.coinAwarded[seat] = true;
  } else if (prev === 'done' && next !== 'done') {
    if (h.coinAwarded[seat]) {
      addCoins(seat, -1, '取消作業完成：' + h.title, false, 'hw');
      delete h.coinAwarded[seat];
    }
  }
  if (next === 'miss') delete h.statuses[seat];
  else h.statuses[seat] = next;
}
// 一鍵全班完成：作業（沒交／要訂正 → 完成，各 +1 金幣），回傳這次改了幾位
function markHwAllDone(h, seats) {
  let n = 0;
  seats.forEach(s => { if (hwStatusOf(h, s) !== 'done') { setHwStatus(h, s, 'done'); n++; } });
  return n;
}
// 一鍵全班完成：每日任務（尚未打卡的人補上，各 +1 金幣），回傳這次補了幾位
function markTaskAllDone(rec, tid, seats, taskName = '') {
  const arr = (rec[tid] ||= []);
  let n = 0;
  seats.forEach(s => { if (!arr.includes(s)) { arr.push(s); addCoins(s, 1, '任務：' + taskName, false, 'task'); n++; } });
  return n;
}
/* 點座號：設成上方選好的狀態。
 * 已經是這個狀態再點一次 → 改回「沒交」（點錯可以馬上改回來）；
 * 選「✗ 沒交」時，已經是沒交就不變。金幣照 setHwStatus：進入完成 +1、離開完成 −1。 */
function hwBrushOf() { return HW_BRUSH_ORDER.includes(state.ui.hwBrush) ? state.ui.hwBrush : 'done'; }
function applyHwBrush(h, seat, brush = hwBrushOf()) {
  if (!HW_BRUSH_ORDER.includes(brush)) brush = 'done';
  const cur = hwStatusOf(h, seat);
  const next = brush === 'miss' ? 'miss' : (cur === brush ? 'miss' : brush);
  setHwStatus(h, seat, next);
  return next;
}
function hwPickHTML() {
  const b = hwBrushOf();
  return HW_BRUSH_ORDER.map(k => `<button type="button" class="att-pk hw-pk hw-pk-${k}${k === b ? ' active' : ''}" data-hw-brush="${k}" aria-pressed="${k === b}">${HW_BRUSH[k].icon} ${HW_BRUSH[k].label}</button>`).join('');
}
// 舊的「點一下換下一個狀態」（v1.11.0 以前）；畫面已改用 applyHwBrush，保留給測試／相容
function cycleHwSeat(h, seat) {
  const next = HW_CYCLE[hwStatusOf(h, seat)] || 'fix';
  setHwStatus(h, seat, next);
  return next;
}

// 跑馬燈：開放作業的未繳／待訂正（依作業、依狀態，含多天累積）
function buildHwAnnParts(homework, seats, today = dateKey()) {
  if (!seats.length) return [];
  const open = (homework || [])
    .filter(h => !h.skipped && h.date < today && !hwIsComplete(h, seats))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const parts = [];
  open.forEach(h => {
    const miss = seats.filter(s => hwStatusOf(h, s) === 'miss');
    const fix = seats.filter(s => hwStatusOf(h, s) === 'fix');
    const label = `${hwShortDate(h.date)} ${h.title}`;
    if (miss.length) parts.push(`📕 未繳 ${label}：${miss.map(n => pad(n)).join('、')}`);
    if (fix.length) parts.push(`✏️ 待訂正 ${label}：${fix.map(n => pad(n)).join('、')}`);
  });
  return parts;
}

/* ---------------- 我的音樂（資料層） ----------------
 * state.music 只存清單（名稱、網址、id），本機檔案的 handle／備份副本存在 IndexedDB，
 * 音檔本身不會進 localStorage、也不會上傳。
 */
function normalizeMusic(m) {
  const src = (m && typeof m === 'object') ? m : {};
  const tracks = (Array.isArray(src.tracks) ? src.tracks : []).filter(t => t && typeof t === 'object' && t.id && (t.kind === 'file' || (t.kind === 'url' && parseMusicUrl(t.url).ok)))
    .map(t => {
      const o = { id: String(t.id), name: String(t.name || '未命名曲目'), kind: t.kind };
      if (t.kind === 'url') o.url = parseMusicUrl(t.url).url;
      else { if (t.size) o.size = Number(t.size) || 0; if (t.type) o.type = String(t.type); if (t.store) o.store = t.store === 'blob' ? 'blob' : 'handle'; }
      return o;
    });
  const loop = ['off', 'one', 'all'].includes(src.loop) ? src.loop : 'all';
  const currentId = tracks.some(t => t.id === src.currentId) ? String(src.currentId) : '';
  return { tracks, loop, currentId };
}
// 檢查網址：只接受 http(s)；YouTube／Spotify 等影音網站頁面不是音檔
function parseMusicUrl(raw) {
  const str = String(raw ?? '').trim();
  if (!str) return { ok: false, reason: 'empty' };
  let u;
  try { u = new URL(str); } catch (e) { return { ok: false, reason: 'invalid' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'scheme' };
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const isAudioFile = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i.test(u.pathname);
  if (!isAudioFile && /(^|\.)(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com|music\.youtube\.com|soundcloud\.com|kkbox\.com)$/.test(host)) return { ok: false, reason: 'page', url: u.href };
  return { ok: true, url: u.href };
}
function nameFromUrl(url) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    let n = seg;
    try { n = decodeURIComponent(seg); } catch (e) {}
    n = n.replace(/\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i, '').trim();
    return n || '未命名曲目';
  } catch (e) { return '未命名曲目'; }
}
function musicFileName(name) { return String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim() || '未命名曲目'; }
// 播完一首之後的下一首（auto=true：自然播完；false：按上一首／下一首）
function musicNextIndex(len, idx, loop, dir = 1, auto = false) {
  if (!len) return -1;
  if (idx < 0 || idx >= len) return dir < 0 ? len - 1 : 0;
  if (auto) {
    if (loop === 'one') return idx;
    const n = idx + 1;
    if (n < len) return n;
    return loop === 'all' ? 0 : -1;
  }
  return (idx + dir + len) % len;
}
function nextLoopMode(loop) { return ({ off: 'one', one: 'all', all: 'off' })[loop] || 'all'; }

let state = load();
let saveTimer;
function save() {
  syncCurClassName();
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
// 點名：今天（或指定日期）有到的座號＝名單座號扣掉請假／曠課（遲到算有到）
const presentSeats = (dk = dateKey()) => { const seats = activeSeats(); const ab = new Set(absentSeats(state, dk, seats)); return seats.filter(n => !ab.has(n)); };
const todayAttendance = () => attendanceOf(state, dateKey(), activeSeats());
const stu = n => (state.students[n] ||= { coins: 0, nextAt: 10, species: [], earned: 0, spent: 0 });
const todayDone = () => (state.done[dateKey()] ||= {});
const classSpecies = () => {
  const set = new Set();
  activeSeats().forEach(n => (state.students[n]?.species || []).forEach(id => set.add(id)));
  return set;
};

/* ---------------- 多班級：切換與自動換班 ---------------- */
const isMulti = () => state.settings.mode === 'multi';
const classList = () => Array.isArray(state.classes) ? state.classes : [];
const curClassObj = () => classList().find(c => c.id === state.curClass) || null;
const classById = id => classList().find(c => c.id === id) || null;
const classLabel = c => c ? (c.subject ? `${c.name} ${c.subject}` : c.name) : '';
function syncCurClassName() {
  const c = curClassObj();
  if (c && String(state.settings.className || '').trim()) c.name = String(state.settings.className).trim();
}
// 抽號紀錄：每班分開（只存在這次開啟期間，跟原本一樣重新整理就清空）
let drawnBy = {};
let autoKey = null; // 目前「節次」的識別；只有換節（或剛打開）時才會自動切換
function periodAt(d = new Date()) {
  const now = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  return todaySchedule(d).find(r => toMin(r.start) <= now && now < toMin(r.end)) || null;
}
function periodKey(d = new Date()) {
  const p = periodAt(d);
  return p ? `${dateKey(d)}|${p.start}|${p.end}|${p.name}|${p.classId || ''}` : `${dateKey(d)}|none`;
}
function modalBusy() {
  const m = document.getElementById('modal');
  const ask = document.getElementById('askConfirm');
  return !!((m && !m.classList.contains('hidden')) || (ask && ask.style.display === 'flex'));
}
/** 切換目前班級。opt.auto：依課表自動切換；opt.now：手動切換的時間（測試用） */
function switchClass(id, { auto = false, period = '', silent = false, now } = {}) {
  const target = classById(id);
  if (!target) return false;
  if (!auto) autoKey = periodKey(now || new Date()); // 手動切換：這一節內不再被自動切回去
  if (id === state.curClass) return false;
  const cur = curClassObj();
  if (cur) {
    drawnBy[cur.id] = drawn;
    syncCurClassName();
    cur.data = pickClassData(state);
  }
  putClassData(state, target.data);
  target.data = null;
  state.settings.className = target.name;
  state.curClass = target.id;
  drawn = drawnBy[target.id] || [];
  weekDraft = null;
  save();
  refreshDrawUI();
  const pop = $('#classPop'); if (pop) pop.style.display = 'none';
  renderAll();
  if (!silent) toast(auto ? `已切換到 ${classLabel(target)}${period ? `（${period}）` : ''}` : `已切換到 ${classLabel(target)}`, auto ? 3500 : 2200);
  return true;
}
/** 每秒檢查：換節或剛打開時，若這節有標班級就自動切過去 */
function checkAutoSwitch(d = new Date()) {
  if (!state.settings.setupDone || !isMulti()) return null;
  const key = periodKey(d);
  if (key === autoKey) return null;
  if (modalBusy()) return null; // 老師正在對話框裡編輯，先不切，關掉後再切
  autoKey = key;
  if (state.settings.autoSwitch === false) return null;
  const p = periodAt(d);
  if (!p || !p.classId || !classById(p.classId) || p.classId === state.curClass) return null;
  switchClass(p.classId, { auto: true, period: p.name });
  return p.classId;
}
function refreshDrawUI() {
  const num = $('#drawNum'); if (!num) return;
  const last = drawn[drawn.length - 1];
  num.textContent = last ? pad(last) : '?';
  const nm = $('#drawName'); if (nm) nm.textContent = last ? (nameOf(last) || `${last} 號`) : '按下按鈕抽一位幸運兒';
  const h = $('#drawHistory'); if (h) h.textContent = drawn.length ? '已抽：' + drawn.map(pad).join('、') : '';
}
// 首頁「換班級」按鈕：多班級且有 2 班以上才顯示
function renderClassSwitch() {
  const wrap = $('#classSwitch'); if (!wrap) return;
  const show = isMulti() && classList().length >= 2;
  wrap.style.display = show ? '' : 'none';
  const pop = $('#classPop');
  if (pop && (!show || pop.style.display === 'none')) { if (!show) pop.style.display = 'none'; return; }
  if (pop) drawClassPop();
}
function drawClassPop() {
  const pop = $('#classPop'); if (!pop) return;
  pop.innerHTML = `<div class="cp-title">切換班級</div>` + classList().map(c => {
    const on = c.id === state.curClass;
    const max = on ? state.settings.maxSeat : c.data?.settings?.maxSeat;
    const vac = (on ? state.settings.vacant : c.data?.settings?.vacant) || [];
    const n = Math.max(0, (Number(max) || 0) - vac.filter(v => v >= 1 && v <= max).length);
    return `<button type="button" class="cp-item${on ? ' active' : ''}" data-cls="${esc(c.id)}"><b>${esc(c.name)}</b>${c.subject ? `<small>${esc(c.subject)}</small>` : ''}<em>${on ? '目前' : n + ' 人'}</em></button>`;
  }).join('') + `<p class="cp-hint">${state.settings.autoSwitch !== false ? '上課時間到，會依週課表自動切換。' : '自動切換已關閉（教師控制台 → 班級管理）。'}</p>`;
}
document.addEventListener('click', e => {
  const btn = e.target.closest('#classSwitchBtn');
  const pop = $('#classPop');
  if (btn) {
    if (!pop) return;
    const show = pop.style.display === 'none';
    if (show) drawClassPop();
    pop.style.display = show ? '' : 'none';
    return;
  }
  const it = e.target.closest('#classPop [data-cls]');
  if (it) { pop.style.display = 'none'; switchClass(it.dataset.cls); return; }
  if (pop && pop.style.display !== 'none' && !e.target.closest('#classSwitch')) pop.style.display = 'none';
});
// 新學年：每一班的學生資料都清空，班級清單、週課表與班級標記保留
function newYearReset() {
  const clear = () => ({ students: {}, done: {}, contact: {}, homework: [], log: [], attendance: {}, forest: { level: 1, points: 0 }, redemptions: [], coinManual: [], coinDaily: {}, scalPicks: [] });
  Object.assign(state, clear(), { ttOverrides: {} });
  Object.assign(state.settings, { names: {}, vacant: [], schoolYear: '', semester: '' });
  classList().forEach(c => {
    if (!c.data) return;
    Object.assign(c.data, clear());
    c.data.settings = { ...(c.data.settings || {}), names: {}, vacant: [] };
  });
  drawnBy = {}; drawn = []; weekDraft = null;
  refreshDrawUI();
}
// 刪除班級（目前班級要先切走）；週課表與調課裡標這班的格子改回不指定
function deleteClass(id) {
  const list = classList();
  if (list.length <= 1) return false;
  const c = classById(id); if (!c) return false;
  if (id === state.curClass) {
    const other = list.find(x => x.id !== id);
    switchClass(other.id, { silent: true });
  }
  state.classes = list.filter(x => x.id !== id);
  Object.values(state.ttClass || {}).forEach(day => Object.keys(day || {}).forEach(k => { if (day[k] === id) delete day[k]; }));
  Object.values(state.ttOverrides || {}).forEach(ov => (ov.periods || []).forEach(p => { if (p.classId === id) delete p.classId; }));
  delete drawnBy[id];
  save();
  return true;
}
function addClass(name, { subject = '', maxSeat = 20, vacant = [] } = {}) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  const c = { id: 'c' + uid(), name: nm, subject: String(subject || '').trim(), data: freshClassData(nm, { maxSeat, vacant, taskDefs: state.taskDefs }) };
  classList().push(c);
  save();
  return c;
}
function moveClass(id, dir) {
  const list = classList(), i = list.findIndex(c => c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  save();
  return true;
}
function setClassMode(mode) {
  if (mode === 'single' && classList().length > 1) return false;
  state.settings.mode = mode === 'multi' ? 'multi' : 'single';
  save();
  return true;
}

// 自製確認視窗：不用瀏覽器 confirm()，避免被嵌入框架（如 Google 協作平台）或瀏覽器擋掉
function askConfirm(msg, okText = '確定', opt = {}) {
  return new Promise(resolve => {
    let ov = document.getElementById('askConfirm');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'askConfirm';
      ov.className = 'ask-confirm';
      ov.innerHTML = '<div class="ask-card glass"><p class="ask-msg"></p><div class="ask-actions"><button type="button" class="btn ask-no">取消</button><button type="button" class="primary ask-yes"></button></div></div>';
      document.body.appendChild(ov);
    }
    ov.querySelector('.ask-msg').textContent = msg;
    ov.querySelector('.ask-yes').textContent = okText;
    ov.querySelector('.ask-yes').classList.toggle('danger', !!opt.danger);
    ov.style.display = 'flex';
    const done = v => { ov.style.display = 'none'; ov.onclick = null; resolve(v); };
    ov.onclick = e => {
      if (e.target.closest('.ask-yes')) done(true);
      else if (e.target.closest('.ask-no') || e.target === ov) done(false);
    };
  });
}
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

/* ---------------- 點名（畫面） ----------------
 * 首頁班級名稱下方的「點名」卡片：誰都看得到（走進教室的科任老師也看得到）；
 * 點進去標記假別要教師登入（跟調課、教師控制台一樣），避免學生亂改。
 */
function renderAttChip(info = todayAttendance()) {
  const el = $('#attChip'); if (!el) return;
  if (!state.settings.setupDone) { el.style.display = 'none'; return; }
  el.style.display = '';
  const txt = attSummaryText(info, state.settings.names, !!state.settings.attNames);
  el.className = 'att-chip ' + (!info.taken ? 'att-none' : info.absent.length || info.late.length ? 'att-has' : 'att-all');
  el.textContent = info.taken ? '🙋 ' + txt : '🙋 點名';
  el.title = info.taken ? '今日點名（老師點這裡修改）' : '今天還沒點名（老師點這裡點名）';
}
let attBrush = 'sick';
function attDateLabel(dk) { return hwDateLabel(dk); }
function openAttendance(dk) {
  if (!state.settings.setupDone) return openSetup();
  if (!isAuthed()) { _afterUnlock = () => openAttendance(dk); return teacherOpen('unlock'); }
  dk = dk || dateKey();
  const cc = isMulti() ? curClassObj() : null;
  openModal(`<button class="close" data-close>✕</button>
    <h2>🙋 點名${cc ? ` <small class="cls-subj">${esc(classLabel(cc))}</small>` : ''}</h2>
    <p class="sub">先在上方選假別，再點座號；再點一次就改回出席。沒有標記的同學都算出席。改了會馬上儲存。${isMulti() ? '<br>每一班的點名分開記錄，要點別班請先「⇄ 換班級」。' : ''}</p>
    <div class="att-top">
      <label class="att-date">日期 <input type="date" id="attDate" value="${esc(dk)}"></label>
      <button type="button" class="btn" id="attToday">今天</button>
      <span class="att-sum" id="attSum"></span>
    </div>
    <div class="att-pick" id="attPick">${ATT_ORDER.map(k => `<button type="button" class="att-pk att-${k}${k === attBrush ? ' active' : ''}" data-brush="${k}">${ATT[k].icon} ${ATT[k].label}</button>`).join('')}</div>
    <div class="seat-grid att-grid" id="attGrid"></div>
    <div class="btn-row" style="justify-content:flex-start;margin:12px 0 4px">
      <button type="button" class="btn" id="attAllPresent">👌 全部出席</button>
    </div>
    <h4 style="margin:18px 0 6px">顯示設定</h4>
    <label class="chk att-opt"><input type="checkbox" id="attAnn"${state.settings.attAnnounce !== false ? ' checked' : ''}> 跑馬燈公告自動加上「今日缺席」</label>
    <label class="chk att-opt"><input type="checkbox" id="attNm"${state.settings.attNames ? ' checked' : ''}> 首頁和跑馬燈也顯示學生姓名（畫面是公開的，不勾選只會顯示座號）</label>
    <h4 style="margin:18px 0 6px">最近的點名紀錄</h4>
    <div class="att-hist" id="attHist"></div>
    <div class="modal-actions"><button type="button" class="primary" id="attDone">✅ 完成點名</button></div>`, { wide: true });
  const draw = () => {
    const seats = activeSeats();
    const day = state.attendance[dk] || {};
    const info = attendanceOf(state, dk, seats);
    $('#attGrid').innerHTML = seats.map(n => {
      const st = day[n];
      return `<button type="button" class="seat att-seat${st ? ' att-' + st : ''}${st && ATT_ABSENT.has(st) ? ' absent' : ''}" data-att-seat="${n}"><b>${pad(n)}</b><small>${esc(nameOf(n)) || '&nbsp;'}</small><i class="att-tag${st ? ' att-' + st : ''}">${st ? ATT[st].label : '出席'}</i></button>`;
    }).join('') || '<p class="hint">還沒有學生座號，請先到「教師控制台 → 座號與名單」設定。</p>';
    const cnt = ATT_ORDER.map(k => [k, info.list.filter(x => x.status === k).length]).filter(x => x[1]);
    $('#attSum').textContent = `${attDateLabel(dk)}${info.taken ? '' : '（還沒點名）'}　出席 ${info.present}／${seats.length} 人${cnt.length ? '　' + cnt.map(([k, c]) => `${ATT[k].label} ${c}`).join('・') : ''}`;
    const keys = Object.keys(state.attendance || {}).sort().reverse().slice(0, 10);
    $('#attHist').innerHTML = keys.length ? keys.map(k => {
      const i = attendanceOf(state, k, seats);
      const t = i.list.length ? i.list.map(x => `${pad(x.seat)} ${ATT[x.status].short}`).join('、') : '全到';
      return `<button type="button" class="att-h${k === dk ? ' active' : ''}" data-att-day="${k}"><b>${attDateLabel(k)}</b><span>${i.absent.length ? `缺 ${i.absent.length}：` : ''}${esc(t)}</span></button>`;
    }).join('') : '<p class="hint" style="margin:0">還沒有點名紀錄。</p>';
  };
  const changed = () => { save(); renderHeader(); renderTaskWidget(); if ($('.page.active')?.dataset.page === 'tasks') renderTasksPage(); draw(); };
  draw();
  $('#attPick').onclick = e => {
    const b = e.target.closest('[data-brush]'); if (!b) return;
    attBrush = b.dataset.brush;
    $$('#attPick [data-brush]').forEach(x => x.classList.toggle('active', x === b));
  };
  $('#attGrid').onclick = e => {
    const b = e.target.closest('[data-att-seat]'); if (!b) return;
    const n = +b.dataset.attSeat;
    const cur = (state.attendance[dk] || {})[n];
    setAttendance(state, dk, n, cur === attBrush ? '' : attBrush);
    changed();
    const nb = $(`#attGrid [data-att-seat="${n}"]`); nb && nb.classList.add('pop');
  };
  $('#attAllPresent').onclick = () => { markAllPresent(state, dk); changed(); toast(`✅ ${attDateLabel(dk)} 全部出席`); };
  $('#attDate').onchange = () => { const v = $('#attDate').value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { dk = v; draw(); } };
  $('#attToday').onclick = () => { dk = dateKey(); $('#attDate').value = dk; draw(); };
  $('#attHist').onclick = e => { const b = e.target.closest('[data-att-day]'); if (!b) return; dk = b.dataset.attDay; $('#attDate').value = dk; draw(); };
  $('#attAnn').onchange = () => { state.settings.attAnnounce = $('#attAnn').checked; save(); renderHeader(); };
  $('#attNm').onchange = () => { state.settings.attNames = $('#attNm').checked; save(); renderHeader(); };
  $('#attDone').onclick = () => {
    if (!state.attendance[dk]) markAllPresent(state, dk); // 沒標任何人就按完成＝全部出席
    save(); renderAll(); closeModal();
    const i = attendanceOf(state, dk, activeSeats());
    toast(`✅ ${attDateLabel(dk)} 點名完成：${i.absent.length ? `缺席 ${i.absent.length} 人` : '全部出席'}${i.late.length ? `、遲到 ${i.late.length} 人` : ''}`, 3000);
  };
}
document.addEventListener('click', e => {
  if (e.target.closest('#attChip, #attNavBtn')) openAttendance();
});

/* ---------------- 頂部 ---------------- */
// 組成跑馬燈片段：老師公告 + 每日任務自動則 + 作業未繳／待訂正（不寫入 settings.announcement）
// 歡迎詞裡出現校名、但後面沒接班級時，自動補上班級（例：嘉蘭國民小學 → 嘉蘭國民小學一年甲班）
// 不重複：公告裡已經有目前的班級名稱就不再補；校名後面已經接著別的班名（老師自己寫的）也不再補
const CLASS_LIKE = /^\s*(?:[一二三四五六七八九十\d]{1,2}\s*年\s*[^\s，,。！!、]{1,3}?\s*班|[一二三四五六七八九十][甲乙丙丁戊己庚辛壬癸忠孝仁愛信義和平]|\d{3}\s*班)/;
function withClassName(text, school, className) {
  text = String(text || '');
  className = String(className || '').trim();
  school = String(school || '').trim();
  if (!text || !school || !className) return text;
  if (text.includes(className)) return text;
  const segs = text.split(school);
  return segs.reduce((acc, seg, i) => i === 0 ? seg : acc + school + (CLASS_LIKE.test(seg) ? '' : className) + seg, '');
}
// 倒數日 → 跑馬燈：取最近 3 個還沒過的事件
function buildCountdownParts(countdowns, max = 3) {
  return (countdowns || []).filter(c => c && c.name && c.date)
    .map(c => ({ c, d: daysUntil(c.date) })).filter(x => x.d >= 0)
    .sort((a, b) => a.d - b.d).slice(0, max)
    .map(({ c, d }) => d === 0 ? `⏳ 今天就是${c.name}！` : `⏳ 距離${c.name}還有 ${d} 天`);
}
// taskSeats：每日任務只算今天有到的人（請假的同學不會被列在「尚未…」）；attPart：點名的今日缺席
function buildAnnParts(announcement, taskDefs, seats, doneRec, homework, countdowns, taskSeats = seats, attPart = '', holParts = [], calParts = []) {
  const ann = (announcement || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (attPart) ann.push(attPart);
  ann.push(...buildCountdownParts(countdowns));
  ann.push(...(holParts || []));   // 🎌 放假、⚠️ 補班
  ann.push(...(calParts || []));   // 📅 學校行事曆（老師勾選的活動）
  const auto = [];
  if (taskSeats.length) {
    (taskDefs || []).forEach(t => {
      if (!t.announce) return;
      const done = new Set(doneRec[t.id] || []);
      const miss = taskSeats.filter(n => !done.has(n));
      if (!miss.length) return;
      // 公告用語：「尚未」+ 任務名稱，名稱結尾的「完成」去掉（訂正完成 → 尚未訂正）
      const label = t.name.replace(/完成$/, '').trim() || t.name;
      auto.push(`📝 尚未${label}：${miss.map(n => pad(n)).join('、')}`);
    });
  }
  // 作業檢查公告（可跨多天累積）
  auto.push(...buildHwAnnParts(homework || [], seats));
  return [...ann, ...auto];
}
// 跑馬燈速度依「實際像素寬度」計算：字變大時不會跟著變快，維持約每秒 4 個字的閱讀速度
function setMarqueeSpeed() {
  const annEl = $('#annText'); if (!annEl) return;
  const fs = parseFloat(getComputedStyle(annEl).fontSize) || 38;
  const dist = annEl.offsetWidth || (annEl.textContent.length * fs);
  const dur = Math.min(240, Math.max(12, dist / (fs * 4)));
  annEl.style.animationDuration = dur + 's';
}
// 公告字級：中 m／大 l／特大 xl，存在 localStorage
const ANN_SIZES = [['m', '中'], ['l', '大'], ['xl', '特大']];
function applyAnnSize(k) {
  if (!ANN_SIZES.some(a => a[0] === k)) k = 'l';
  document.body.dataset.annSize = k;
  try { localStorage.setItem('jialan-ann-size', k); } catch (e) {}
  const lbl = $('#annSizeLbl'); if (lbl) lbl.textContent = ANN_SIZES.find(a => a[0] === k)[1];
  requestAnimationFrame(setMarqueeSpeed);
}
function initAnnSize() {
  let k = 'l'; try { k = localStorage.getItem('jialan-ann-size') || 'l'; } catch (e) {}
  applyAnnSize(k);
  const btn = $('#annSize');
  if (btn) btn.onclick = e => {
    e.stopPropagation(); // 不要觸發公告編輯
    const i = ANN_SIZES.findIndex(a => a[0] === document.body.dataset.annSize);
    applyAnnSize(ANN_SIZES[(i + 1) % ANN_SIZES.length][0]);
  };
  window.addEventListener('resize', () => setMarqueeSpeed());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAnnSize); else initAnnSize();
function renderHeader() {
  const s = state.settings;
  const term = termText();
  $('#schoolName').textContent = s.school + (term ? `　${term}` : '');
  const cc = isMulti() ? curClassObj() : null;
  if (cc && cc.subject) $('#className').innerHTML = `${esc(s.className)} <small class="cls-subj">${esc(cc.subject)}</small>`;
  else $('#className').textContent = s.className;
  document.title = `${cc ? classLabel({ name: s.className, subject: cc.subject }) : s.className}｜班級儀表板`;
  renderClassSwitch();
  const seats = activeSeats();
  const att = todayAttendance();
  const attPart = s.attAnnounce !== false ? buildAttAnnPart(att, s.names, !!s.attNames) : '';
  const offToday = isOffDay(new Date());
  // 放假日不列「尚未完成的每日任務」（大家都不在學校）
  const parts = buildAnnParts(withClassName(s.announcement, s.school, s.className), state.taskDefs, seats, todayDone(), state.homework, state.countdowns, offToday ? [] : presentSeats(), attPart, buildHolidayParts(), buildSchoolCalParts());
  renderAttChip(att);
  const text = parts.length ? parts.join('　　★　　') : '（尚無公告，老師可以點這裡輸入）';
  const annEl = $('#annText');
  // 文字沒變就別重畫，避免跑馬燈動畫每秒重來
  if (annEl.dataset.key !== text) {
    annEl.dataset.key = text;
    if (parts.length) {
      // 依公告類型上高亮色：老師公告＝螢光黃、未繳＝亮粉紅、待訂正＝亮橘、每日任務未完成＝亮青
      annEl.innerHTML = parts.map(p => {
        const c = p.startsWith('📕') ? 'ann-miss' : p.startsWith('✏️') ? 'ann-fix' : p.startsWith('📝') ? 'ann-task' : p.startsWith('⏳') ? 'ann-cd' : p.startsWith('🙋') ? 'ann-att' : p.startsWith('🎌') ? 'ann-hol' : p.startsWith('⚠️') ? 'ann-work' : p.startsWith('📅') ? 'ann-cal' : 'ann-note';
        return `<b class="${c}">${esc(p)}</b>`;
      }).join('<i class="ann-sep">　　★　　</i>');
    } else annEl.textContent = text;
    setMarqueeSpeed();
  }
  annEl.classList.toggle('placeholder', !parts.length);
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
  const seats = presentSeats(key), rec = state.done[key];
  if (!rec || !seats.length || !state.taskDefs.length) return 0;
  const set = new Set(seats);
  let n = 0;
  state.taskDefs.forEach(t => (rec[t.id] || []).forEach(s => set.has(s) && n++));
  return Math.round(n / (seats.length * state.taskDefs.length) * 100);
}

/* ---------------- 作息表 ---------------- */
const dayTT = wd => state.timetable?.[wd] || {};
const hasTT = wd => Object.values(dayTT(wd)).some(v => String(v || '').trim());
// 平常的課表（不看當天調課）：該天課表有填 → 依課表（空格=沒課）；該天課表全空 → 依作息表的「星期」欄
function regularSchedule(d = new Date()) {
  if (isOffDay(d)) return [];   // v1.16.0：國定假日、本校放假日沒有課
  const wd = effWd(d), wdc = WEEK[wd], tt = dayTT(wd), useTT = hasTT(wd);
  return state.schedule
    .filter(r => r.slot ? (useTT ? !!String(tt[r.slot] || '').trim() : (r.days || '').includes(wdc)) : (!r.days || r.days.includes(wdc)))
    .map(r => {
      const o = { start: r.start, end: r.end, name: r.name, slot: r.slot || '', subject: r.slot ? String(tt[r.slot] || '').trim() : '' };
      const cid = r.slot && useTT ? ttClassOf(wd, r.slot) : '';
      if (cid) o.classId = cid;
      return o;
    })
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}
// 多班級：週課表某一格標記的班級 id
function ttClassOf(wd, slot) { return String((state.ttClass && state.ttClass[wd] && state.ttClass[wd][slot]) || ''); }
function classOnDate(d, slot) {
  const ov = getOverride(d);
  if (ov && Array.isArray(ov.periods)) {
    const p = ov.periods.find(r => r.slot === slot);
    return p ? String(p.classId || '') : '';
  }
  if (isOffDay(d)) return '';
  return ttClassOf(effWd(d), slot);
}
// 畫面上顯示的班級小標籤（只在多班級模式）
function clsTag(id, cls = 'cls-tag') {
  if (!id || !isMulti()) return '';
  const c = classById(id);
  return c ? `<i class="${cls}">${esc(c.name)}</i>` : '';
}
function parseDk(dk) {
  const [y, m, da] = String(dk).split('-').map(Number);
  return new Date(y, m - 1, da, 12, 0, 0);
}
function overrideKey(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  if (d && typeof d.getFullYear === 'function') return dateKey(d);
  return String(d);
}
function getOverride(d) {
  const ov = (state.ttOverrides || {})[overrideKey(d)];
  return ov && typeof ov === 'object' ? ov : null;
}
function applyDayOverride(dk, periods, note = '') {
  (state.ttOverrides ||= {})[dk] = {
    periods: (periods || []).map(r => {
      const o = {
        start: r.start, end: r.end, name: String(r.name || '').trim(),
        slot: r.slot || inferSlot(r.name) || '', subject: String(r.subject || '').trim()
      };
      if (r.classId) o.classId = String(r.classId);
      return o;
    }),
    note: String(note || '').trim()
  };
  return state.ttOverrides[dk];
}
function clearDayOverride(dk) {
  if (state.ttOverrides) delete state.ttOverrides[dk];
}
function todaySchedule(d = new Date()) {
  const ov = getOverride(d);
  if (ov && Array.isArray(ov.periods)) {
    return ov.periods
      .map(r => ({ ...r, subject: String(r.subject || '').trim(), _ov: true }))
      .sort((a, b) => toMin(a.start) - toMin(b.start));
  }
  return regularSchedule(d);
}
function periodChanged(r, base) {
  const b = (base || []).find(x => (r.slot && x.slot === r.slot) || (x.name === r.name && x.start === r.start));
  if (!b) return true;
  return b.subject !== r.subject || b.start !== r.start || b.end !== r.end || b.name !== r.name || (b.classId || '') !== (r.classId || '');
}
function dateOfWeekday(wd, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const monOffset = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const out = new Date(mon);
  out.setDate(mon.getDate() + (wd === 0 ? 6 : wd - 1));
  return out;
}
function subjectOnDate(d, slot) {
  const ov = getOverride(d);
  if (ov && Array.isArray(ov.periods)) {
    const p = ov.periods.find(r => r.slot === slot);
    return p ? String(p.subject || '').trim() : '';
  }
  if (isOffDay(d)) return '';
  return String(dayTT(effWd(d))[slot] || '').trim();
}

const periodLabel = r => r.subject ? `${r.name}・${r.subject}` : r.name;
function classOptions(sel = '') {
  return `<option value="">不指定班級</option>` + classList().map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(classLabel(c))}</option>`).join('');
}
const periodHTML = r => r.subject ? `${esc(r.subject)} <small class="np-slot">${esc(r.name)}</small>` : esc(r.name);
function renderSchedule() {
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const list = todaySchedule(d);
  const ov = getOverride(d);
  const base = regularSchedule(d);
  $('#schedDate').textContent = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  const adjBtn = $('#adjustBtn');
  if (adjBtn) {
    adjBtn.classList.toggle('is-on', !!ov);
    adjBtn.textContent = ov ? '🔄 已調課' : '🔄 今日調課';
  }
  const noteEl = $('#schedAdjNote');
  if (noteEl) {
    if (ov) {
      noteEl.style.display = '';
      noteEl.textContent = ov.note ? `🔄 今日調課・${ov.note}` : '🔄 今日課表已調整，平常的週課表沒有更動。';
    } else {
      const inf = dayInfo(d);
      if (inf.type === 'work') { noteEl.style.display = ''; noteEl.textContent = `⚠️ 今天${inf.src === 'national' ? '補班' : inf.name}，上星期${WEEK[inf.wd]}的課`; }
      else { noteEl.style.display = 'none'; noteEl.textContent = ''; }
    }
  }
  const box = $('#nowPeriod');
  if (!list.length) {
    $('#schedList').innerHTML = '';
    if (ov) box.innerHTML = `<div class="np-name">今天沒有排課</div><div class="np-sub">${ov.note ? esc(ov.note) : '已用臨時調課清空今天的節次。'}</div>`;
    else if (isOffDay(d)) {
      const inf = dayInfo(d), nx = nextSchoolDay(d);
      box.innerHTML = `<div class="np-name np-hol">🎌 今天 ${esc(inf.name)} 放假</div><div class="np-sub">好好休息！${nx ? `下一個上課日是 ${holFmt(nx)}` : ''}</div>`;
    }
    else box.innerHTML = `<div class="np-name">今天是假日 🌿</div><div class="np-sub">好好休息，下週見！</div>`;
    return null;
  }
  let cur = null, next = null;
  $('#schedList').innerHTML = list.map(r => {
    const s = toMin(r.start), e = toMin(r.end);
    let cls = '';
    if (now >= e) cls = 'past';
    else if (now >= s) { cls = 'now'; cur = r; }
    else if (!next) next = r;
    const ch = ov && periodChanged(r, base);
    return `<li class="${cls}${ch ? ' adj' : ''}"><span>${r.start}–${r.end}</span><span>${r.subject ? `<small class="sl-slot">${esc(r.name)}</small> <b>${esc(r.subject)}</b>` : esc(r.name)}${clsTag(r.classId)}${ch ? '<i class="adj-tag">調</i>' : ''}</span></li>`;
  }).join('');
  if (cur) {
    const left = Math.max(0, toMin(cur.end) - now);
    box.innerHTML = `<div class="np-sub">現在是</div><div class="np-name">${periodHTML(cur)}${clsTag(cur.classId)}</div>
      <div class="np-sub">還有 ${Math.floor(left)} 分 ${pad(Math.floor((left % 1) * 60))} 秒${next ? `・下一節：${esc(periodLabel(next))}` : ''}</div>
      <div class="bar"><i style="width:${(now - toMin(cur.start)) / (toMin(cur.end) - toMin(cur.start)) * 100}%"></i></div>`;
  } else if (next) {
    const left = toMin(next.start) - now;
    box.innerHTML = `<div class="np-sub">下課／休息中</div><div class="np-name">下一節：${periodHTML(next)}${clsTag(next.classId)}</div>
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
  const dates = {};
  [1, 2, 3, 4, 5].forEach(w => dates[w] = dateOfWeekday(w, d));
  const rows = SLOTS.filter(s => [1, 2, 3, 4, 5].some(w => subjectOnDate(dates[w], s) || String(dayTT(w)[s] || '').trim()));
  if (!rows.length) return '<div class="empty">還沒有填寫週課表。請到「教師控制台 → 週課表」填寫，或從 Excel／照片匯入。</div>';
  return `<table class="week-table"><thead><tr><th></th>${[1, 2, 3, 4, 5].map(w => {
    const ov = getOverride(dates[w]), inf = dayInfo(dates[w]);
    const hol = inf.type === 'off' ? `<i class="hol-tag">🎌 ${esc(inf.name)}</i>` : inf.type === 'work' ? `<i class="hol-tag work">⚠️ ${esc(inf.src === 'national' ? '補班' : inf.name)}</i>` : '';
    return `<th class="${w === today ? 'today' : ''}${ov ? ' has-adj' : ''}${inf.type === 'off' ? ' hol' : ''}">星期${WEEK[w]}${ov ? ' <i class="adj-tag">調</i>' : ''}${hol}</th>`;
  }).join('')}</tr></thead>
    <tbody>${rows.map(s => `<tr><th>${slotName(s)}<small>${slotTime(s)}</small></th>${[1, 2, 3, 4, 5].map(w => {
      const ov = getOverride(dates[w]);
      const v = subjectOnDate(dates[w], s);
      const orig = String(dayTT(w)[s] || '').trim();
      const ch = ov && v !== orig;
      const cid = v ? classOnDate(dates[w], s) : '';
      const chC = ov && cid !== ttClassOf(w, s);
      const offC = !ov && isOffDay(dates[w]) ? ' hol' : '';
      return `<td class="${w === today ? 'today' : ''} ${w === today && s === curSlot ? 'now' : ''} ${v ? '' : 'none'}${ch || chC ? ' adj' : ''}${offC}">${esc(v) || '—'}${clsTag(cid, 'cls-tag blk')}${ch || chC ? '<i class="adj-tag">調</i>' : ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
}
$('#weekBtn') && ($('#weekBtn').onclick = () => openModal(`<button class="close" data-close>✕</button>
  <h2>📅 ${isMulti() ? '我的' : esc(state.settings.className) + ' '}週課表</h2><p class="sub">${esc(termText())}　今天的欄位以綠色標示，正在上的課會發亮。本週有調課的日子會標上「調」，放假的日子是紅色。</p>
  ${weekTableHTML()}`, { wide: true }));
$('#adjustBtn') && ($('#adjustBtn').onclick = () => openAdjustModal());
let _afterUnlock = null;
function openAdjustModal(initDate) {
  if (!state.settings.setupDone) return openSetup();
  if (!isAuthed()) {
    _afterUnlock = () => openAdjustModal(initDate);
    return teacherOpen('unlock');
  }
  let dk = dateKey(initDate || new Date());
  let rows = [], note = '';
  const load = () => {
    const d = parseDk(dk);
    const ov = getOverride(d);
    rows = (ov && Array.isArray(ov.periods) ? ov.periods : regularSchedule(d)).map(r => ({ ...r }));
    note = ov?.note || '';
  };
  load();
  const subjectList = SUBJECTS.map(s => `<option value="${esc(s)}">`).join('');
  openModal(`<button class="close" data-close>✕</button>
    <h2>🔄 臨時調課</h2>
    <p class="sub">只改指定那一天的課表與時間，平常的週課表和作息時間不會被更動。適合當天對調科目、改上一節，或提早放學。</p>
    <div class="row2">
      <div class="field"><span>日期</span><input id="adjDate" type="date" value="${dk}"></div>
      <div class="field"><span>原因（選填，會顯示在作息表上）</span><input id="adjNote" placeholder="例如：因運動會彩排，一、二節對調" value="${esc(note)}"></div>
    </div>
    <p class="sub" id="adjBaseHint"></p>
    <div class="adj-head${isMulti() ? ' multi' : ''}"><span>開始</span><span>結束</span><span>節次</span><span>科目</span>${isMulti() ? '<span>班級</span>' : ''}<span></span></div>
    <div id="adjRows" class="adj-rows"></div>
    <div class="btn-row" style="justify-content:flex-start;margin:10px 0">
      <button type="button" class="btn" id="adjAdd">＋ 加一節</button>
      <button type="button" class="btn" id="adjReload">從原課表重新載入</button>
    </div>
    <div id="adjUpcoming" class="adj-upcoming"></div>
    <div class="modal-actions" style="justify-content:space-between">
      <button type="button" class="btn danger" id="adjClear">還原為原課表</button>
      <button type="button" class="primary" id="adjSave">儲存調課</button>
    </div>
    <datalist id="adjSubjects">${subjectList}</datalist>`, { wide: true });
  const sync = () => {
    rows = $$('#adjRows .adj-row').map(er => ({
      start: $('[data-k=start]', er).value,
      end: $('[data-k=end]', er).value,
      name: $('[data-k=name]', er).value.trim(),
      slot: er.dataset.slot || inferSlot($('[data-k=name]', er).value) || '',
      subject: $('[data-k=subject]', er).value.trim(),
      classId: $('[data-k=classId]', er) ? $('[data-k=classId]', er).value : (rows[+er.dataset.i]?.classId || '')
    }));
    note = $('#adjNote').value;
  };
  const draw = () => {
    const base = regularSchedule(parseDk(dk));
    const ov = getOverride(parseDk(dk));
    $('#adjBaseHint').textContent = ov
      ? `這天已經有調課紀錄${ov.note ? '（' + ov.note + '）' : ''}，儲存後會覆蓋。`
      : (base.length ? '目前顯示的是原來的課表，改完按「儲存調課」就只對這一天生效。' : '這天原本沒有排課，你可以自行加上臨時的節次。');
    $('#adjNote').value = note;
    $('#adjRows').innerHTML = rows.map((r, i) => {
      const ch = periodChanged(r, base);
      return `<div class="adj-row${isMulti() ? ' multi' : ''}${ch ? ' changed' : ''}" data-i="${i}" data-slot="${esc(r.slot || '')}">
        <input type="time" data-k="start" value="${esc(r.start || '')}">
        <input type="time" data-k="end" value="${esc(r.end || '')}">
        <input data-k="name" value="${esc(r.name || '')}" placeholder="第一節">
        <input data-k="subject" value="${esc(r.subject || '')}" placeholder="科目（空白=該節沒課）" list="adjSubjects">
        ${isMulti() ? `<select data-k="classId" title="這節是哪一班">${classOptions(r.classId)}</select>` : ''}
        <button type="button" data-del="${i}" title="刪除這節">✕</button>
      </div>`;
    }).join('') || '<p class="hint">還沒有節次。按「＋ 加一節」，或「從原課表重新載入」。</p>';
    const upcoming = Object.keys(state.ttOverrides || {}).sort().filter(k => k >= dateKey());
    $('#adjUpcoming').innerHTML = upcoming.length
      ? `<p class="sub">已排定的調課：</p><div class="adj-days">${upcoming.map(k => {
          const n = (state.ttOverrides[k].note || '').trim();
          const [y, m, da] = k.split('-');
          return `<button type="button" class="btn ${k === dk ? 'active' : ''}" data-goto-dk="${k}">${+m}/${+da}${n ? '・' + esc(n) : ''}</button>`;
        }).join('')}</div>`
      : '';
  };
  draw();
  $('#adjDate').onchange = () => { sync(); dk = $('#adjDate').value; load(); draw(); };
  $('#adjNote').oninput = () => { note = $('#adjNote').value; };
  $('#adjRows').onclick = e => {
    const d = e.target.closest('[data-del]'); if (!d) return;
    sync(); rows.splice(+d.dataset.del, 1); draw();
  };
  $('#adjAdd').onclick = () => {
    sync();
    const last = rows[rows.length - 1];
    const start = last?.end || '15:00';
    const endMin = toMin(start) + 40;
    const end = `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`;
    rows.push({ start, end, name: '', slot: '', subject: '', classId: '' });
    draw();
  };
  $('#adjReload').onclick = () => {
    rows = regularSchedule(parseDk(dk)).map(r => ({ ...r }));
    draw();
    toast('已載入原來的課表，還沒儲存');
  };
  $('#adjUpcoming').onclick = e => {
    const b = e.target.closest('[data-goto-dk]'); if (!b) return;
    sync(); dk = b.dataset.gotoDk; $('#adjDate').value = dk; load(); draw();
  };
  $('#adjClear').onclick = () => {
    askConfirm(`要把 ${dk} 還原成原來的週課表嗎？\n這一天的調課紀錄會被刪除。`, '還原').then(ok => {
      if (!ok) return;
      clearDayOverride(dk);
      save(); renderSchedule(); tick();
      load(); draw();
      toast('✅ 已還原為原課表');
    });
  };
  $('#adjSave').onclick = () => {
    sync();
    const periods = rows.filter(r => r.start && r.end && r.name);
    const base = regularSchedule(parseDk(dk));
    const same = !note.trim() && periods.length === base.length &&
      periods.every((r, i) => r.start === base[i].start && r.end === base[i].end && r.name === base[i].name && r.subject === base[i].subject && (r.classId || '') === (base[i].classId || ''));
    if (same) {
      clearDayOverride(dk);
      save(); renderSchedule(); tick(); closeModal();
      toast('跟原課表一樣，沒有儲存調課');
      return;
    }
    applyDayOverride(dk, periods, note);
    save(); renderSchedule(); tick(); closeModal();
    const when = dk === dateKey() ? '今天' : `${+dk.slice(5, 7)}/${+dk.slice(8)}`;
    toast(`✅ ${when}的調課已儲存（週課表沒有更動）`);
  };
}


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
  syncContactToHomework(key);
  $('#contactInput').value = '';
  save(); renderContact(); renderHeader(); renderTaskWidget();
  if ($('.page.active')?.dataset.page === 'tasks') renderTasksPage();
});
$('#contactList').addEventListener('click', e => {
  const b = e.target.closest('.del'); if (!b || !canEditBoard()) return;
  const key = dateKey();
  state.contact[key] = (state.contact[key] || []).filter(i => i.id !== b.dataset.id);
  syncContactToHomework(key);
  save(); renderContact(); renderHeader(); renderTaskWidget();
  if ($('.page.active')?.dataset.page === 'tasks') renderTasksPage();
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
  save(); renderCountdowns(); renderHeader();
});
$('#cdList').addEventListener('click', e => {
  const b = e.target.closest('.del'); if (!b || !canEditBoard()) return;
  if (!confirm('刪除這個倒數事件？')) return;
  state.countdowns = state.countdowns.filter(c => c.id !== b.dataset.id);
  save(); renderCountdowns(); renderHeader();
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
  const hinf = dayInfo(d);
  $('#wDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日　星期${WEEK[d.getDay()]}` + (hinf.type === 'off' ? `　🎌 ${hinf.name}` : hinf.type === 'work' ? `　⚠️ ${hinf.src === 'national' ? '補班' : hinf.name}` : '');
  try { checkAutoSwitch(d); } catch (e) { console.warn(e); }
  const cur = renderSchedule();
  const cc = cur && isMulti() && cur.classId ? classById(cur.classId) : null;
  const sub = cur ? (toMin(cur.start) <= d.getHours() * 60 + d.getMinutes() ? `現在：${periodLabel(cur)}` : `下一節：${periodLabel(cur)}（${cur.start}）`) + (cc ? `・${cc.name}` : '') : `星期${WEEK[d.getDay()]}`;
  $('#clockSub').textContent = sub;
  if (document.body.classList.contains('clean')) {
    $('#cleanClock').innerHTML = `<div class="cc-time">${hh}:${mm}</div><div class="cc-sub">${esc(state.settings.className)}・${esc(sub)}</div><div class="cc-hint">點一下畫面回到儀表板</div>`;
  }
  if (d.getSeconds() === 0) {
    updateSky();
    if (d.getMinutes() % 30 === 0) loadWeather();
    if (d.getHours() === 0 && d.getMinutes() === 0) renderAll();
    if (d.getMinutes() === 0 && holHourKey !== d.getHours()) { holHourKey = d.getHours(); refreshHolidays().catch(() => {}); scalAuto(); }
    try { maybeAutoBackup(); } catch (_) {}
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
    else if (sp.cat === 'animal') h += `<span class="critter walk" style="bottom:${12 + r * 8}%;left:${5 + r * 80}%;animation-duration:${(6 + r * 6) * 2}s">${sp.emoji}</span>`;
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
  stopMusic();
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
  $('#ambList').innerHTML = AMB.map(a => `<li data-id="${a.id}" class="${a.id === ambCur && !musicPlayingId ? 'on' : ''}"><span class="ai">${a.icon}</span><div><b>${a.name}</b><small>${a.sub}</small></div></li>`).join('');
}
$('#ambList').addEventListener('click', e => {
  const li = e.target.closest('li'); if (!li) return;
  if (li.dataset.id !== 'none') dmUserAudio(); else dm.restoreAmb = 'none';   // 老師自己選了環境音 → 這一輪倒數讓給老師
  playAmbient(li.dataset.id);
});
$('#ambVol').addEventListener('input', e => {
  if (ambGain) ambGain.gain.value = e.target.value / 100 * .6;
  const a = musicAudio(); if (a) a.volume = musicVolume();
});

/* ---------------- 我的音樂（播放器） ----------------
 * 本機檔：Chrome／Edge 直接打開網址時用 showOpenFilePicker，把檔案 handle 存在 IndexedDB（重新整理後從原位置再讀）；
 * 嵌在 Google 協作平台等網頁裡（iframe）、Firefox、Safari：不能記住電腦裡的檔案位置，
 * 改用一般檔案選擇（📁 上傳檔案／📂 加入整個資料夾），把音樂「複製一份」存在這個瀏覽器的 IndexedDB，
 * 重新整理後在原畫面就能播，不需要開新分頁（v1.9.1）。都不會上傳到伺服器。
 */
const MUSIC_ACCEPT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm'];
const LOOP_INFO = { off: { icon: '➡️', label: '不循環（播完清單就停）' }, one: { icon: '🔂', label: '單曲循環' }, all: { icon: '🔁', label: '清單循環' } };
let musicPlayingId = '';      // 目前載入在播放器的曲目（暫停時仍保留）
let musicObjUrl = '';         // 給 <audio> 用的暫時網址，換歌或移除時要釋放
let musicErrCount = 0;        // 連續播放失敗次數，避免無限跳歌
let musicSeeking = false;
let _musicReplaceId = '';     // 「重新指定」時要換掉的曲目
const musicMissing = new Set();   // 找不到檔案、需重新指定的曲目
const musicNeedPerm = new Set();  // 需要按一下重新授權的曲目
const musicMem = {};              // 本次開啟期間的檔案（IndexedDB 存不下時的後援）
const musicNotSaved = new Set();  // 瀏覽器存不下、只能這次播放的曲目
const MUSIC_BIG_FILE = 50 * 1024 * 1024;   // 單一檔案超過這個大小會提醒
const MUSIC_MAX_FOLDER = 200;              // 一次從資料夾加入的上限
function fmtMB(bytes) {
  const mb = (Number(bytes) || 0) / 1048576;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}
// 這次要用「存一份在瀏覽器裡」的方式嗎？（iframe、或不支援 showOpenFilePicker）
function musicUsesBrowserCopy() { return inIframe() || !canPickMusicFile(); }
function canPickMusicFolder() {
  try { return 'webkitdirectory' in document.createElement('input'); } catch (e) { return false; }
}
// 瀏覽器還剩多少空間（不知道時回 null）
async function musicFreeSpace() {
  try {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') return null;
    const e = await navigator.storage.estimate();
    if (!e || !isFinite(e.quota)) return null;
    return Math.max(0, (e.quota || 0) - (e.usage || 0));
  } catch (e) { return null; }
}
let _musicPersistAsked = false;
function musicAskPersist() {
  if (_musicPersistAsked) return; _musicPersistAsked = true;
  try { if (navigator.storage && typeof navigator.storage.persist === 'function') navigator.storage.persist().catch(() => {}); } catch (e) {}
}
// 存在這個瀏覽器裡的音樂：幾首、多大
function musicStoredSummary() {
  const list = musicTracks().filter(t => t.kind === 'file' && t.store === 'blob' && !musicMissing.has(t.id) && !musicNotSaved.has(t.id));
  return { count: list.length, bytes: list.reduce((s, t) => s + (Number(t.size) || 0), 0) };
}

const musicAudio = () => document.getElementById('musicAudio');
const musicVolume = () => { const v = $('#ambVol'); return Math.max(0, Math.min(1, (v ? Number(v.value) : 50) / 100)); };
const musicTracks = () => (state.music ||= normalizeMusic(null)).tracks;
const musicTrack = id => musicTracks().find(t => t.id === id);
function fmtSec(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}
function isAudioFile(f) {
  if (!f) return false;
  if (String(f.type || '').startsWith('audio/')) return true;
  return MUSIC_ACCEPT.some(ext => String(f.name || '').toLowerCase().endsWith(ext));
}

/* ---- 清單資料 ---- */
function addUrlTrack(raw, name) {
  const r = parseMusicUrl(raw);
  if (!r.ok) return r;
  const t = { id: 'm' + uid(), name: String(name || '').trim() || nameFromUrl(r.url), kind: 'url', url: r.url };
  musicTracks().push(t);
  save(); renderMusic();
  return { ok: true, track: t };
}
function addFileTrackMeta(info = {}) {
  const t = { id: 'm' + uid(), name: musicFileName(info.name), kind: 'file', store: info.store === 'blob' ? 'blob' : 'handle' };
  if (info.size) t.size = Number(info.size) || 0;
  if (info.type) t.type = String(info.type);
  musicTracks().push(t);
  save(); renderMusic();
  return t;
}
function removeTrack(id) {
  const list = musicTracks();
  const i = list.findIndex(t => t.id === id);
  if (i < 0) return false;
  if (musicPlayingId === id) stopMusic(true);
  list.splice(i, 1);
  if (state.music.currentId === id) state.music.currentId = '';
  musicMissing.delete(id); musicNeedPerm.delete(id); musicNotSaved.delete(id); delete musicMem[id];
  idbDel('musicFile_' + id); idbDel('musicBlob_' + id);
  save(); renderMusic();
  return true;
}
function setMusicLoop(mode) {
  state.music.loop = ['off', 'one', 'all'].includes(mode) ? mode : 'all';
  save(); renderMusicControls();
  return state.music.loop;
}
function cycleMusicLoop() {
  const m = setMusicLoop(nextLoopMode(state.music.loop));
  toast(LOOP_INFO[m].icon + ' ' + LOOP_INFO[m].label);
  return m;
}
// 按上一首／下一首要跳到哪一首
function musicStepId(dir = 1) {
  const list = musicTracks();
  const cur = musicPlayingId || state.music.currentId;
  const i = musicNextIndex(list.length, list.findIndex(t => t.id === cur), state.music.loop, dir, false);
  return i < 0 ? '' : list[i].id;
}
// 一首自然播完後要接哪一首（''＝停止）
function musicAfterEndId(curId = musicPlayingId) {
  const list = musicTracks();
  const i = musicNextIndex(list.length, list.findIndex(t => t.id === curId), state.music.loop, 1, true);
  return i < 0 ? '' : list[i].id;
}

/* ---- 取得音源 ---- */
function musicErr(code) { const e = new Error(code); e.code = code; return e; }
async function musicSrcFor(t, fromGesture) {
  if (t.kind === 'url') return { src: t.url, obj: false };
  if (musicMem[t.id]) return { src: URL.createObjectURL(musicMem[t.id]), obj: true };
  const handle = await idbGet('musicFile_' + t.id);
  if (handle && typeof handle.getFile === 'function') {
    let perm = 'granted';
    if (typeof handle.queryPermission === 'function') perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      if (!fromGesture || typeof handle.requestPermission !== 'function') throw musicErr('perm');
      perm = await handle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') throw musicErr('denied');
    }
    musicNeedPerm.delete(t.id);
    let file;
    try { file = await handle.getFile(); } catch (e) { throw musicErr('missing'); }
    return { src: URL.createObjectURL(file), obj: true };
  }
  const blob = await idbGet('musicBlob_' + t.id);
  if (blob && typeof blob === 'object') return { src: URL.createObjectURL(blob), obj: true };
  throw musicErr('missing');
}
function revokeMusicUrl() {
  if (musicObjUrl) { try { URL.revokeObjectURL(musicObjUrl); } catch (e) {} musicObjUrl = ''; }
}
// 開始播自己的音樂：關掉內建環境音
function musicTakeOver() {
  dmUserAudio();   // 老師自己播「我的音樂」→ 跳舞音樂讓開（恢復播放時不算）
  stopAmbient(); ambCur = 'none';
  $$('#ambList li').forEach(li => li.classList.remove('on'));
}
function safePlay(a) {
  let p;
  try { p = a.play(); } catch (e) { p = Promise.reject(e); }
  if (p && typeof p.catch === 'function') p.catch(e => {
    if (e && e.name === 'NotAllowedError') toast('瀏覽器擋住了自動播放，請再按一次 ▶');
    renderMusicControls();
  });
}

/* ---- 播放控制 ---- */
async function playTrack(id, { fromGesture = true } = {}) {
  const t = musicTrack(id);
  const a = musicAudio();
  if (!t || !a) return false;
  musicTakeOver();
  state.music.currentId = id; save();
  let r;
  try { r = await musicSrcFor(t, fromGesture); }
  catch (e) {
    const code = e && e.code;
    if (code === 'perm') { musicNeedPerm.add(id); showMusicPerm(); toast('請先按「點一下以使用本機音樂檔」，再播放'); }
    else if (code === 'denied') toast('沒有讀取這個檔案的權限，請再試一次');
    else { musicMissing.add(id); toast(`找不到「${t.name}」這個檔案，請按「重新指定」選擇檔案`, 3500); }
    renderMusic();
    return false;
  }
  try { a.pause(); } catch (e) {}
  revokeMusicUrl();
  if (r.obj) musicObjUrl = r.src;
  musicMissing.delete(id);
  musicPlayingId = id;
  a.loop = false;
  a.volume = musicVolume();
  a.src = r.src;
  safePlay(a);
  renderMusic();
  return true;
}
function pauseMusic() {
  const a = musicAudio();
  if (a) { try { a.pause(); } catch (e) {} }
  renderMusicControls();
}
// 停止並卸下音源（播放內建環境音、移除正在播的曲目、還原備份時）
function stopMusic(unload = true) {
  const a = musicAudio();
  if (a) {
    try { a.pause(); } catch (e) {}
    if (unload && musicPlayingId) { a.removeAttribute('src'); try { a.load(); } catch (e) {} }
  }
  if (unload) { revokeMusicUrl(); musicPlayingId = ''; }
  if (document.getElementById('musicList')) renderMusic();
}
function toggleMusic() {
  const a = musicAudio(); if (!a) return;
  if (musicPlayingId && a.getAttribute('src')) {
    if (a.paused) { musicTakeOver(); safePlay(a); } else a.pause();
    renderMusicControls();
    return;
  }
  const list = musicTracks();
  if (!list.length) return toast('清單是空的，先上傳檔案或加入網址');
  playTrack(musicTrack(state.music.currentId) ? state.music.currentId : list[0].id);
}
function musicStep(dir) {
  const id = musicStepId(dir);
  if (!id) return toast('清單是空的，先上傳檔案或加入網址');
  playTrack(id);
}

/* ---- 新增：本機檔案 ---- */
function canPickMusicFile() { return typeof window.showOpenFilePicker === 'function'; }
async function pickMusicFiles(replaceId = '') {
  _musicReplaceId = replaceId;
  if (canPickMusicFile() && !inIframe()) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: !replaceId,
        types: [{ description: '音訊', accept: { 'audio/*': MUSIC_ACCEPT } }]
      });
      await addMusicHandles(handles, replaceId);
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (!(e && e.name === 'SecurityError')) { toast('無法開啟檔案選擇，改用一般上傳'); }
    }
  }
  const inp = $('#musicFileInput');
  if (inp) { inp.multiple = !replaceId; inp.value = ''; inp.click(); }
}
async function addMusicHandles(handles, replaceId = '') {
  let n = 0, skip = 0;
  for (const h of handles || []) {
    let f;
    try { f = await h.getFile(); } catch (e) { skip++; continue; }
    if (!isAudioFile(f)) { skip++; continue; }
    let t;
    if (replaceId && musicTrack(replaceId)) {
      t = musicTrack(replaceId);
      Object.assign(t, { name: musicFileName(f.name), kind: 'file', store: 'handle', size: f.size || 0, type: f.type || '' });
      if (musicPlayingId === replaceId) stopMusic(true);
      idbDel('musicBlob_' + t.id); delete musicMem[t.id];
      musicMissing.delete(t.id); musicNeedPerm.delete(t.id);
    } else t = addFileTrackMeta({ name: f.name, size: f.size, type: f.type, store: 'handle' });
    try { await idbSet('musicFile_' + t.id, h); }
    catch (e) { musicMem[t.id] = f; toast('瀏覽器無法記住這個檔案，重新整理後需要重新選擇'); }
    n++;
  }
  save(); renderMusic();
  if (n) toast(replaceId ? '✅ 已重新指定檔案' : `✅ 已加入 ${n} 首（檔案仍在你的電腦裡）`);
  if (skip) toast(`有 ${skip} 個檔案不是音樂檔，已略過`);
}
function pickMusicFolder() {
  const inp = $('#musicFolderInput');
  if (!inp || !canPickMusicFolder()) return toast('這個瀏覽器不能選資料夾，請按「📁 上傳檔案」一次選多首');
  inp.value = ''; inp.click();
}
async function addMusicFiles(files, replaceId = '', opt = {}) {
  let n = 0, skip = 0, mem = 0, big = 0;
  files = [...(files || [])];
  const audio = files.filter(isAudioFile);
  skip = files.length - audio.length;
  let over = 0;
  if (opt.folder && audio.length > MUSIC_MAX_FOLDER) { over = audio.length - MUSIC_MAX_FOLDER; audio.length = MUSIC_MAX_FOLDER; }
  if (opt.folder && !audio.length) {
    toast('這個資料夾裡沒有音樂檔（mp3、wav、ogg、m4a、aac、flac、webm）', 3500);
    return { n: 0, skip, mem: 0 };
  }
  const need = audio.reduce((s, f) => s + (f.size || 0), 0);
  const free = await musicFreeSpace();
  if (free !== null && need > free) {
    toast(`⚠️ 瀏覽器空間可能不夠：這次選了 ${fmtMB(need)}，大約只剩 ${fmtMB(free)}。放不下的歌，重新整理後要重新選擇`, 6000);
  }
  if (audio.length) musicAskPersist();
  for (const f of audio) {
    if ((f.size || 0) > MUSIC_BIG_FILE) big++;
    let t;
    if (replaceId && musicTrack(replaceId)) {
      t = musicTrack(replaceId);
      Object.assign(t, { name: musicFileName(f.name), kind: 'file', store: 'blob', size: f.size || 0, type: f.type || '' });
      if (musicPlayingId === replaceId) stopMusic(true);
      idbDel('musicFile_' + t.id);
      musicMissing.delete(t.id); musicNeedPerm.delete(t.id);
    } else t = addFileTrackMeta({ name: f.name, size: f.size, type: f.type, store: 'blob' });
    musicMem[t.id] = f;
    try { await idbSet('musicBlob_' + t.id, f); musicNotSaved.delete(t.id); } catch (e) { mem++; musicNotSaved.add(t.id); }
    n++;
  }
  save(); renderMusic();
  const msgs = [];
  if (n) msgs.push(replaceId ? '✅ 已重新指定檔案（存一份在這個瀏覽器裡）' : `✅ 已加入 ${n} 首，存一份在這個瀏覽器裡（共 ${fmtMB(need)}，不會上傳），重新整理後也能播`);
  if (mem) msgs.push(`⚠️ 瀏覽器空間不足，有 ${mem} 首只能這次播放，重新整理後要重新選擇`);
  if (big) msgs.push(`有 ${big} 首檔案比較大（超過 ${fmtMB(MUSIC_BIG_FILE)}），會佔用較多瀏覽器空間`);
  if (over) msgs.push(`資料夾裡的音樂太多，只加入前 ${MUSIC_MAX_FOLDER} 首`);
  if (skip && !opt.folder) msgs.push(`有 ${skip} 個檔案不是音樂檔，已略過`);
  if (msgs.length) toast(msgs.join('　'), mem || big || over ? 6000 : 3500);
  return { n, skip, mem, big, over };
}

/* ---- 新增：網址 ---- */
function submitMusicUrl() {
  const inp = $('#musicUrlInput'); if (!inp) return;
  const r = addUrlTrack(inp.value);
  if (!r.ok) {
    if (r.reason === 'empty') toast('請貼上音樂檔的網址');
    else if (r.reason === 'page') toast('這個播放器需要「音樂檔」的直接網址（例如 .mp3），YouTube、Spotify 等影音網站的頁面無法播放', 4500);
    else toast('網址格式不對，只能用 http:// 或 https:// 開頭的網址');
    inp.focus();
    return;
  }
  inp.value = '';
  $('#musicUrlRow').style.display = 'none';
  toast(`✅ 已加入「${r.track.name}」`);
}

/* ---- 重新整理後檢查本機檔狀態（不主動跳授權視窗） ---- */
async function refreshMusicAvail() {
  const files = musicTracks().filter(t => t.kind === 'file');
  for (const t of files) {
    if (musicMem[t.id]) continue;
    const h = await idbGet('musicFile_' + t.id);
    if (h && typeof h.getFile === 'function') {
      musicMissing.delete(t.id);
      try {
        const p = typeof h.queryPermission === 'function' ? await h.queryPermission({ mode: 'read' }) : 'granted';
        if (p === 'granted') musicNeedPerm.delete(t.id); else musicNeedPerm.add(t.id);
      } catch (e) { musicNeedPerm.add(t.id); }
      continue;
    }
    const b = await idbGet('musicBlob_' + t.id);
    if (b) musicMissing.delete(t.id); else musicMissing.add(t.id);
  }
  renderMusic();
}
function showMusicPerm() {
  const el = $('#musicPerm');
  if (el) el.style.display = musicNeedPerm.size ? '' : 'none';
}
async function grantMusicPerm() {
  let ok = 0, fail = 0;
  for (const id of [...musicNeedPerm]) {
    const h = await idbGet('musicFile_' + id);
    if (!h || typeof h.requestPermission !== 'function') { musicNeedPerm.delete(id); continue; }
    try {
      const p = await h.requestPermission({ mode: 'read' });
      if (p === 'granted') { musicNeedPerm.delete(id); ok++; } else fail++;
    } catch (e) { fail++; }
  }
  renderMusic();
  if (ok && !fail) toast('✅ 已可使用本機音樂檔');
  else if (fail) toast('有些檔案沒有授權，播放時會再詢問');
}

/* ---- 畫面 ---- */
function musicNeedsAuth(after) {
  if (!state.settings.setupDone) { openSetup(); return true; }
  if (isAuthed()) { touchAuth(); return false; }
  _afterUnlock = after;
  teacherOpen('unlock');
  return true;
}
function renderMusicControls() {
  const a = musicAudio();
  const playing = !!(a && musicPlayingId && !a.paused);
  const pb = $('#musicPlay');
  if (pb) { pb.textContent = playing ? '⏸' : '▶'; pb.title = playing ? '暫停' : '播放'; }
  const lb = $('#musicLoop');
  const info = LOOP_INFO[state.music.loop] || LOOP_INFO.all;
  if (lb) { lb.textContent = info.icon; lb.title = info.label; lb.classList.toggle('active', state.music.loop !== 'off'); }
  const now = $('#musicNow');
  const t = musicTrack(musicPlayingId);
  if (now) now.textContent = t ? (playing ? '♪ ' : '⏸ ') + t.name : '尚未播放';
  if (!t) {
    const s = $('#musicSeek'); if (s) s.value = 0;
    const c = $('#musicCur'); if (c) c.textContent = '0:00';
    const d = $('#musicDur'); if (d) d.textContent = '0:00';
  }
}
function renderMusic() {
  const ul = $('#musicList'); if (!ul) return;
  const list = musicTracks();
  ul.innerHTML = list.map(t => {
    const miss = musicMissing.has(t.id);
    const on = t.id === musicPlayingId;
    return `<li data-mid="${esc(t.id)}" class="${on ? 'on' : ''}${miss ? ' missing' : ''}" title="${esc(t.kind === 'url' ? t.url : t.name)}">
      <span class="mi">${on ? '♪' : '▸'}</span>
      <span class="mn"><b>${esc(t.name)}</b>${miss ? '<small>檔案找不到，請重新指定</small>' : ''}</span>
      <span class="mbadge ${t.kind}">${t.kind === 'url' ? '網址' : '檔案'}</span>
      ${t.kind === 'file' && miss ? `<button type="button" class="mre" data-repick="${esc(t.id)}" title="重新選擇這首的檔案">重新指定</button>` : ''}
      <button type="button" class="mdel" data-mdel="${esc(t.id)}" title="從清單移除（不會刪除電腦裡的檔案）">✕</button>
    </li>`;
  }).join('');
  const em = $('#musicEmpty');
  if (em) {
    em.style.display = list.length ? 'none' : '';
    em.textContent = musicUsesBrowserCopy()
      ? '還沒有自己的音樂。可以上傳電腦裡的音樂檔（會存一份在這個瀏覽器裡），或貼上音樂網址。'
      : '還沒有自己的音樂。可以上傳電腦裡的檔案，或貼上音樂網址。';
  }
  ul.style.display = list.length ? '' : 'none';
  const note = $('#musicStoreNote');
  if (note) {
    const sum = musicStoredSummary();
    note.style.display = sum.count ? '' : 'none';
    note.textContent = sum.count
      ? `🗂️ 有 ${sum.count} 首存在這個瀏覽器裡（共 ${fmtMB(sum.bytes)}），重新整理後也能播。清除瀏覽器資料、換電腦或換瀏覽器時會不見，原始檔請留著。`
      : '';
  }
  const fb = $('#musicAddFolder'); if (fb) fb.style.display = canPickMusicFolder() ? '' : 'none';
  showMusicPerm();
  renderMusicControls();
  if (musicPlayingId) $$('#ambList li').forEach(li => li.classList.remove('on'));
}

/* ---- 事件 ---- */
(function bindMusic() {
  const a = musicAudio(); if (!a) return;
  a.addEventListener('play', renderMusicControls);
  a.addEventListener('pause', renderMusicControls);
  a.addEventListener('playing', () => { musicErrCount = 0; renderMusicControls(); });
  a.addEventListener('loadedmetadata', () => { const d = $('#musicDur'); if (d) d.textContent = fmtSec(a.duration); });
  a.addEventListener('timeupdate', () => {
    if (musicSeeking) return;
    const c = $('#musicCur'); if (c) c.textContent = fmtSec(a.currentTime);
    const s = $('#musicSeek'); if (s && isFinite(a.duration) && a.duration > 0) s.value = Math.round(a.currentTime / a.duration * 1000);
  });
  a.addEventListener('ended', () => {
    const cur = musicPlayingId;
    const next = musicAfterEndId(cur);
    if (!next) { renderMusicControls(); return; }
    if (next === cur) { a.currentTime = 0; safePlay(a); return; }
    playTrack(next, { fromGesture: false });
  });
  a.addEventListener('error', () => {
    if (!musicPlayingId || !a.getAttribute('src')) return;
    const t = musicTrack(musicPlayingId);
    toast(`⚠️ 無法播放「${t ? t.name : ''}」：檔案不存在、網址失效或格式不支援`, 3500);
    musicErrCount++;
    const list = musicTracks();
    const next = musicAfterEndId(musicPlayingId);
    if (list.length > 1 && musicErrCount < list.length && next && next !== musicPlayingId) {
      setTimeout(() => playTrack(next, { fromGesture: false }), 800);
    } else { musicErrCount = 0; stopMusic(true); }
  });
  const seek = $('#musicSeek');
  if (seek) {
    seek.addEventListener('input', () => {
      musicSeeking = true;
      if (isFinite(a.duration) && a.duration > 0) {
        const c = $('#musicCur'); if (c) c.textContent = fmtSec(seek.value / 1000 * a.duration);
      }
    });
    seek.addEventListener('change', () => {
      if (musicPlayingId && isFinite(a.duration) && a.duration > 0) a.currentTime = seek.value / 1000 * a.duration;
      musicSeeking = false;
    });
  }
  $('#musicPlay').onclick = () => toggleMusic();
  $('#musicPrev').onclick = () => musicStep(-1);
  $('#musicNext').onclick = () => musicStep(1);
  $('#musicLoop').onclick = () => cycleMusicLoop();
  $('#musicPerm').onclick = () => grantMusicPerm();
  $('#musicAddFile').onclick = () => {
    if (musicNeedsAuth(() => pickMusicFiles())) return;
    pickMusicFiles();
  };
  const fbtn = $('#musicAddFolder');
  if (fbtn) fbtn.onclick = () => {
    if (musicNeedsAuth(() => pickMusicFolder())) return;
    pickMusicFolder();
  };
  const finp = $('#musicFolderInput');
  if (finp) finp.onchange = e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length) addMusicFiles(files, '', { folder: true });
  };
  $('#musicAddUrl').onclick = () => {
    const open = () => {
      const row = $('#musicUrlRow');
      const show = row.style.display === 'none';
      row.style.display = show ? '' : 'none';
      if (show) setTimeout(() => $('#musicUrlInput').focus(), 30);
    };
    if (musicNeedsAuth(open)) return;
    open();
  };
  $('#musicUrlOk').onclick = () => { if (!musicNeedsAuth(submitMusicUrl)) submitMusicUrl(); };
  $('#musicUrlInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!musicNeedsAuth(submitMusicUrl)) submitMusicUrl(); }
    if (e.key === 'Escape') { e.stopPropagation(); $('#musicUrlRow').style.display = 'none'; }
  });
  $('#musicFileInput').onchange = e => {
    const files = [...(e.target.files || [])];
    const rid = _musicReplaceId; _musicReplaceId = '';
    e.target.value = '';
    if (files.length) addMusicFiles(files, rid);
  };
  $('#musicList').addEventListener('click', e => {
    const del = e.target.closest('[data-mdel]');
    if (del) {
      const id = del.dataset.mdel;
      const go = () => { const t = musicTrack(id); if (removeTrack(id) && t) toast(`已從清單移除「${t.name}」`); };
      if (musicNeedsAuth(go)) return;
      go(); return;
    }
    const re = e.target.closest('[data-repick]');
    if (re) {
      const id = re.dataset.repick;
      if (musicNeedsAuth(() => pickMusicFiles(id))) return;
      pickMusicFiles(id); return;
    }
    const li = e.target.closest('li[data-mid]');
    if (!li) return;
    const id = li.dataset.mid;
    if (id === musicPlayingId && a.getAttribute('src')) return toggleMusic();
    playTrack(id);
  });
})();

/* ---------------- 倒數計時 ---------------- */
const timer = { total: 300, left: 300, running: false, end: 0, iv: null };
function showTimer() {
  const l = Math.max(0, Math.ceil(timer.left));
  $('#timerDisp').textContent = `${pad(Math.floor(l / 60))}:${pad(l % 60)}`;
  $('#timerStart').textContent = timer.running ? '暫停' : '開始';
  updateIslPill();
  updateWheel();
  dmSync();
}
function timerSet(sec) { dmStop(false); timer.total = timer.left = Math.max(0, sec); timer.running = false; clearInterval(timer.iv); $('#timerDisp').classList.remove('ringing'); isl.done = 0; isl.lastSec = -1; whl.done = false; whl.started = false; showTimer(); }
$$('.presets button').forEach(b => b.onclick = () => timerSet(b.dataset.min * 60));
$('#timerPlus').onclick = () => { timer.left += 60; if (timer.running) timer.end += 60000; showTimer(); };
$('#timerMinus').onclick = () => { timer.left = Math.max(0, timer.left - 60); if (timer.running) timer.end -= 60000; showTimer(); };
$('#timerReset').onclick = () => timerSet(timer.total);
$('#timerStart').onclick = () => {
  ensureAudio();
  $('#timerDisp').classList.remove('ringing'); isl.done = 0; isl.lastSec = -1; whl.done = false;
  if (timer.running) { timer.running = false; clearInterval(timer.iv); showTimer(); return; }
  if (timer.left <= 0) return;
  timer.running = true; timer.end = Date.now() + timer.left * 1000;
  timer.iv = setInterval(() => {
    timer.left = (timer.end - Date.now()) / 1000;
    if (timer.left <= 0) { timer.left = 0; timer.running = false; clearInterval(timer.iv); dmStop(true); $('#timerDisp').classList.add('ringing'); beep(4); toast('⏰ 時間到！'); islFinish(); whlFinish(); }
    else if (timer.left <= 10) islTickSound(Math.ceil(timer.left));
    showTimer();
  }, 200);
  showTimer();
};
/* ---------------- 🏝️ 3D 島嶼倒數（v1.11.0） ----------------
 * 原創設計：用 canvas 2D 自己做簡單的 3D 投影，畫一座漂浮的低多邊形「山林島嶼」：
 * 中間一座小山（山頂有雪）、四周的樹、一條小溪流到島邊變成瀑布、雲朵繞著島飄，
 * 班上已經發現的動物在島上散步（emoji 臉朝左，往右走時左右翻轉，和 v1.8.1 一樣）。
 * 不用 Three.js、不用網路，平板也跑得動：最多每秒 30 張、畫面看不到時（切到別的工具、別的頁面、
 * 監考模式、瀏覽器分頁在背景）就停止繪圖。系統設定「減少動態效果」時只畫靜止的島。
 * 教師控制台 → 基本資料 → 🎬 動畫效果 可以改成「簡潔」（只有數字，跟以前一樣）。
 */
const isl = { raf: 0, poll: 0, t: 0, last: 0, yaw: .6, done: 0, ctx: null, w: 0, h: 0, dpr: 1, pets: [], lastSec: -1, geo: null, frames: 0 };
function islandMode() { return state.settings.timerStyle === 'island'; }
function renderTimerStyle() {
  const st = state.settings.timerStyle, on = st === 'island', wh = st === 'wheel';
  const simple = $('#timerDisp'), wrap = $('#islWrap'), ww = $('#whlWrap');
  if (simple) simple.style.display = on || wh ? 'none' : '';
  if (wrap) wrap.style.display = on ? '' : 'none';
  if (ww) ww.style.display = wh ? '' : 'none';
  updateIslPill();
  if (wh) updateWheel(); else whlStopDance();
  dmSync();
  const mb = $('#whlMusicBtn'); if (mb) { mb.style.display = wh ? '' : 'none'; dmRenderBtn(); }
  if (on) islStart();
}
function islVisible() {
  if (!islandMode()) return false;
  if (document.hidden) return false;
  if (typeof isExamOpen === 'function' && isExamOpen()) return false;
  const body = $('.tool-body[data-body="timer"]');
  if (!body || body.classList.contains('hidden')) return false;
  const page = body.closest('.page');
  if (page && !page.classList.contains('active')) return false;
  if (document.body.classList.contains('clean')) return false;
  return true;
}
function updateIslPill() {
  const pill = $('#islPill'), num = $('#islNum'); if (!pill || !num) return;
  const l = Math.max(0, Math.ceil(timer.left));
  const done = !timer.running && timer.left <= 0 && isl.done > 0;
  num.textContent = done ? '⏰ 時間到！' : `${pad(Math.floor(l / 60))}:${pad(l % 60)}`;
  pill.classList.toggle('warn', timer.running && l <= 10 && l > 0);
  pill.classList.toggle('done', done);
}
// 最後 10 秒的滴答聲（只在 3D 島嶼模式）
function islTickSound(l) {
  if (!(islandMode() || wheelMode()) || !actx || l === isl.lastSec) return;
  isl.lastSec = l;
  try {
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'square'; o.frequency.value = l <= 3 ? 1320 : 990;
    g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .07);
  } catch (e) {}
}
function islFinish() {
  if (!islandMode()) return;
  isl.done = 3.2;   // 動物跳 3 秒
  updateIslPill();
  if (islVisible()) confetti();
}

/* ---- 幾何（固定的亂數，每次長一樣） ---- */
function islRand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function islGeometry() {
  if (isl.geo) return isl.geo;
  const r = islRand(20261119), N = 11;
  const top = [], band = [], mid = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, rr = .92 + r() * .16;
    top.push([Math.cos(a) * rr, 0, Math.sin(a) * rr]);
    band.push([Math.cos(a) * rr * .97, -.14, Math.sin(a) * rr * .97]);
    const rm = .55 + r() * .15;
    mid.push([Math.cos(a + .15) * rm, -.5 - r() * .12, Math.sin(a + .15) * rm]);
  }
  const tip = [.05, -1.25, -.02];
  const trees = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = .45 + r() * .4;
    const p = [Math.cos(a) * d, 0, Math.sin(a) * d];
    if (Math.hypot(p[0] + .12, p[2] + .1) < .38) continue;   // 不要長在山上
    if (Math.abs(a - .35) < .25 && d > .5) continue;          // 溪流旁邊空出來
    trees.push({ p, s: .13 + r() * .08, hue: 120 + r() * 30 });
  }
  const mountain = { c: [-.12, 0, -.1], r: .34, h: .62, n: 6 };
  const fallAt = 0;   // 瀑布在第 0 個邊
  isl.geo = { N, top, band, mid, tip, trees, mountain, fallAt };
  return isl.geo;
}
function islPetList() {
  if (isl.pets.length && isl.frames % 60) return isl.pets;   // 每 60 張才重新看一次班上有哪些動物
  const found = [...classSpecies()].map(spById).filter(s => s && s.cat === 'animal').map(s => s.emoji);
  const list = (found.length ? found : ['🐕', '🐈']).slice(0, 4);
  if (isl.pets.length !== list.length || isl.pets.some((p, i) => p.e !== list[i])) {
    isl.pets = list.map((e, i) => ({ e, a: i * 1.7 + .4, r: .55 + (i % 2) * .18, sp: (i % 2 ? -1 : 1) * (.22 + i * .05), px: null, face: 1 }));
  }
  return isl.pets;
}

/* ---- 投影 ---- */
function islProject(p, cam) {
  const [x, y, z] = p;
  const x1 = x * cam.cy - z * cam.sy, z1 = x * cam.sy + z * cam.cy;
  const y2 = y * cam.cp - z1 * cam.sp, d = z1 * cam.cp + y * cam.sp;   // d：越大越靠近畫面
  const k = cam.F / (cam.F - d);
  return { x: cam.cx + x1 * cam.S * k, y: cam.cy0 - (y2 + cam.bob) * cam.S * k, d, k, x1, y2 };
}
function islShade(pts3, base, cam) {
  // 用投影前的 3D 座標算面法向量，光從左上前方照過來
  const P = pts3.map(p => { const x1 = p[0] * cam.cy - p[2] * cam.sy, z1 = p[0] * cam.sy + p[2] * cam.cy; return [x1, p[1] * cam.cp - z1 * cam.sp, z1 * cam.cp + p[1] * cam.sp]; });
  const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], v = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1; n = n.map(c => c / len);
  if (n[2] < 0) n = n.map(c => -c);
  const L = [-.45, .65, .6], ll = Math.hypot(...L);
  const lit = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll);
  return `hsl(${base[0]},${base[1]}%,${Math.round(base[2] * (.55 + .6 * lit))}%)`;
}
function islPoly(ctx, pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1; ctx.stroke();
}

/* ---- 畫一張 ---- */
function islDraw(ctx, W, H, t, dt) {
  const g = islGeometry();
  const S = Math.min(W * .3, H * .36);
  const cam = { F: 4.2, cx: W / 2, cy0: H * .5, S, bob: Math.sin(t * .9) * .04, cp: Math.cos(.5), sp: Math.sin(.5), cy: Math.cos(isl.yaw), sy: Math.sin(isl.yaw) };
  ctx.clearRect(0, 0, W, H);
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.beginPath(); ctx.ellipse(W / 2, H * .93, S * (.75 - cam.bob), S * .11, 0, 0, Math.PI * 2); ctx.fill();
  const items = [];
  // 下面的岩石
  const N = g.N, faces = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    faces.push({ p: [g.top[i], g.top[j], g.band[j], g.band[i]], c: [32, 45, 42] });
    faces.push({ p: [g.band[i], g.band[j], g.mid[j], g.mid[i]], c: [28, 22, 40] });
    faces.push({ p: [g.mid[i], g.mid[j], g.tip], c: [25, 18, 30] });
  }
  faces.map(f => ({ f, pp: f.p.map(p => islProject(p, cam)) }))
    .map(o => ({ ...o, d: o.pp.reduce((s, q) => s + q.d, 0) / o.pp.length }))
    .sort((a, b) => a.d - b.d)
    .forEach(o => islPoly(ctx, o.pp, islShade(o.f.p, o.f.c, cam)));
  // 島的上面（草地）
  const c0 = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    islPoly(ctx, [c0, g.top[i], g.top[j]].map(p => islProject(p, cam)), `hsl(${100 + (i % 3) * 8},48%,${46 + (i % 2) * 6}%)`);
  }
  // 小溪：從山腳流到島邊
  const fa = g.top[g.fallAt], fb = g.top[(g.fallAt + 1) % N];
  const edge = [(fa[0] + fb[0]) / 2, 0, (fa[2] + fb[2]) / 2];
  const river = [[-.05, .001, -.02], [edge[0] * .6, .001, edge[2] * .6 + .04], edge].map(p => islProject(p, cam));
  ctx.strokeStyle = 'rgba(122,200,255,.95)'; ctx.lineWidth = Math.max(2, S * .045); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(river[0].x, river[0].y); ctx.quadraticCurveTo(river[1].x, river[1].y, river[2].x, river[2].y); ctx.stroke();
  // 瀑布（島的那一邊轉到前面時才看得到）
  const e2 = islProject(edge, cam);
  if (e2.d > -.05) {
    const bot = islProject([edge[0] * 1.02, -1.0, edge[2] * 1.02], cam);
    const wv = Math.max(4, S * .07);
    const grd = ctx.createLinearGradient ? ctx.createLinearGradient(0, e2.y, 0, bot.y) : null;
    if (grd && grd.addColorStop) { grd.addColorStop(0, 'rgba(170,225,255,.95)'); grd.addColorStop(1, 'rgba(170,225,255,0)'); ctx.fillStyle = grd; }
    else ctx.fillStyle = 'rgba(170,225,255,.7)';
    ctx.fillRect(e2.x - wv / 2, e2.y, wv, bot.y - e2.y);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const yy = e2.y + ((t * 60 + k * 18) % Math.max(1, bot.y - e2.y));
      ctx.beginPath(); ctx.moveTo(e2.x - wv / 3, yy); ctx.lineTo(e2.x - wv / 3, yy + 6); ctx.moveTo(e2.x + wv / 4, yy + 9); ctx.lineTo(e2.x + wv / 4, yy + 15); ctx.stroke();
    }
  }
  // 山（低多邊形角錐、山頂有雪）
  const m = g.mountain, peak = [m.c[0], m.h, m.c[2]];
  for (let i = 0; i < m.n; i++) {
    const a0 = i / m.n * Math.PI * 2, a1 = (i + 1) / m.n * Math.PI * 2;
    const b0 = [m.c[0] + Math.cos(a0) * m.r, 0, m.c[2] + Math.sin(a0) * m.r], b1 = [m.c[0] + Math.cos(a1) * m.r, 0, m.c[2] + Math.sin(a1) * m.r];
    const pts = [b0, b1, peak];
    const pp = pts.map(p => islProject(p, cam));
    items.push({ d: (pp[0].d + pp[1].d) / 2, draw: () => {
      islPoly(ctx, pp, islShade(pts, [140, 25, 46], cam));
      const s0 = [peak[0] + (b0[0] - peak[0]) * .3, peak[1] * .7, peak[2] + (b0[2] - peak[2]) * .3], s1 = [peak[0] + (b1[0] - peak[0]) * .3, peak[1] * .7, peak[2] + (b1[2] - peak[2]) * .3];
      islPoly(ctx, [s0, s1, peak].map(p => islProject(p, cam)), islShade(pts, [200, 30, 95], cam));
    } });
  }
  // 樹（兩層三角形，左右兩半不同亮度，看起來有面）
  g.trees.forEach(tr => {
    const b = islProject(tr.p, cam), top = islProject([tr.p[0], tr.s * 2.2, tr.p[2]], cam);
    items.push({ d: b.d, draw: () => {
      const w = tr.s * S * b.k * .55, hgt = b.y - top.y;
      ctx.fillStyle = '#7a5434'; ctx.fillRect(b.x - w * .12, b.y - hgt * .22, w * .24, hgt * .22);
      [[.15, 1], [.5, .78]].forEach(([y0, sc]) => {
        const by = b.y - hgt * y0, ty = by - hgt * .62 * sc + hgt * .1;
        ctx.fillStyle = `hsl(${tr.hue},45%,30%)`; ctx.beginPath(); ctx.moveTo(b.x - w * sc, by); ctx.lineTo(b.x, ty); ctx.lineTo(b.x, by); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `hsl(${tr.hue},48%,42%)`; ctx.beginPath(); ctx.moveTo(b.x + w * sc, by); ctx.lineTo(b.x, ty); ctx.lineTo(b.x, by); ctx.closePath(); ctx.fill();
      });
    } });
  });
  // 動物
  const pets = islPetList();
  pets.forEach((pt, i) => {
    pt.a += pt.sp * dt;
    const jump = isl.done > 0 ? Math.abs(Math.sin(t * 7 + i)) * .28 : Math.abs(Math.sin(t * 5 + i * 2)) * .035;
    const p = [Math.cos(pt.a) * pt.r, jump, Math.sin(pt.a) * pt.r];
    const q = islProject(p, cam);
    if (pt.px !== null && Math.abs(q.x - pt.px) > .05) pt.face = q.x > pt.px ? -1 : 1;   // 往右走 → 翻轉（emoji 預設臉朝左）
    pt.px = q.x;
    items.push({ d: q.d + .01, draw: () => {
      const fs = Math.max(12, S * .2 * q.k);
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(pt.face, 1);
      ctx.font = `${fs}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(pt.e, 0, 0); ctx.restore();
    } });
  });
  // 雲
  for (let i = 0; i < 3; i++) {
    const a = t * (.05 + i * .02) + i * 2.1, rr = 1.45 + i * .12;
    const q = islProject([Math.cos(a) * rr, .35 + i * .18, Math.sin(a) * rr], cam);
    items.push({ d: q.d, draw: () => {
      const s = S * .16 * q.k;
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      [[0, 0, 1], [-.8, .15, .7], [.8, .15, .75], [.3, -.35, .7]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(q.x + dx * s, q.y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); });
    } });
  }
  items.sort((a, b) => a.d - b.d).forEach(it => it.draw());
  isl.frames++;
}
function islSetup() {
  const cv = $('#islCanvas'); if (!cv) return null;
  const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { width: 0, height: 0 };
  const w = Math.round(rect.width || cv.clientWidth || 360), h = Math.round(rect.height || cv.clientHeight || 220);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!isl.ctx) { try { isl.ctx = cv.getContext('2d'); } catch (e) { isl.ctx = null; } }
  if (!isl.ctx) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  isl.w = w; isl.h = h; isl.dpr = dpr;
  return isl.ctx;
}
function islFrame(ts) {
  isl.raf = 0;
  if (!islVisible()) { islSchedulePoll(); return; }
  const now = ts || (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const reduce = prefersReducedMotion();
  const minGap = reduce ? 1000 : 33;   // 最多每秒 30 張；減少動態效果時每秒 1 張、而且不動
  if (isl.last && now - isl.last < minGap) { isl.raf = requestAnimationFrame(islFrame); return; }
  const dt = isl.last ? Math.min(.1, (now - isl.last) / 1000) : 0;
  isl.last = now;
  const ctx = islSetup();
  if (!ctx) { islSchedulePoll(2000); return; }
  if (!reduce) { isl.t += dt; isl.yaw += dt * .16; }
  if (isl.done > 0) isl.done = Math.max(0, isl.done - dt);
  ctx.setTransform && ctx.setTransform(isl.dpr, 0, 0, isl.dpr, 0, 0);
  islDraw(ctx, isl.w, isl.h, isl.t, reduce ? 0 : dt);
  isl.raf = requestAnimationFrame(islFrame);
}
function islSchedulePoll(ms = 600) {
  clearTimeout(isl.poll);
  isl.last = 0;
  isl.poll = setTimeout(() => islStart(), ms);
}
function islStart() {
  clearTimeout(isl.poll);
  if (isl.raf || !islandMode()) return;
  isl.raf = requestAnimationFrame(islFrame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) islStart(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) whlStopDance(); else if (wheelMode()) updateWheel(); });

/* ---------------- 🎡 彩色轉盤倒數（v1.17.0） ----------------
 * 計時器的第三種畫面：一圈 20 格彩虹色塊（每格一個白點）、外圈一圈小燈泡、上方數字框、中間是角色「知心」。
 * 時間一秒一秒過去，色塊從最上面開始、順時針一格一格變暗（依經過的時間比例）；計時中外圈燈泡跑馬燈。
 * 時間到：知心跳一跳、燈泡一起閃，加上原本的鈴聲。
 * 全部用 SVG＋CSS 動畫（不用 canvas、不用網路）；系統設定「減少動態效果」時不跑動畫。
 * 中間的圖片：預設 images/zhixin.webp（知心，已去背、只留上半身）；老師可以在
 * 「教師控制台 → 基本資料 → 🎬 動畫效果」換成自己的圖片（縮小後存在這個瀏覽器的 IndexedDB，
 * 不放 localStorage、不放在備份檔裡；settings.timerChar = 'custom' 只是記號），也可以恢復知心。
 */
const WHL_N = 20, WHL_BULBS = 32;
const WHL_DEFAULT_IMG = 'images/zhixin.webp';
const WHL_IDB_KEY = 'timerChar';
const WHL_MAX_PX = 360;          // 自訂圖片縮到最長邊 360px
const WHL_MAX_BYTES = 400000;    // 存起來的圖片最多約 400KB
const WHL_RAW_MAX = 300000;      // 瀏覽器不能縮圖時，原圖最多 300KB
const whl = { built: false, lit: -1, done: false, customUrl: '', loaded: false };
function wheelMode() { return state.settings.timerStyle === 'wheel'; }
// 還亮著幾格（依剩下的時間比例；超過原本時間＝全亮）
function whlLit(left, total) {
  if (!(total > 0)) return left > 0 ? WHL_N : 0;
  return Math.max(0, Math.min(WHL_N, Math.ceil(left / total * WHL_N - 1e-9)));
}
// HSL → #rrggbb（直接寫色碼，舊瀏覽器也不會出錯）
function whlHex(h, sat = .88, l = .58) {
  const f = n => { const k = (n + h / 30) % 12, c = l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}
const whlPt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)]; };
// 轉盤的 SVG（viewBox -100～100；0 度在正上方、順時針）
function whlSVG() {
  const R1 = 60, R2 = 85, gap = 1.4, step = 360 / WHL_N;
  const segs = [];
  for (let i = 0; i < WHL_N; i++) {
    const a0 = i * step + gap / 2, a1 = (i + 1) * step - gap / 2;
    const [x1, y1] = whlPt(R2, a0), [x2, y2] = whlPt(R2, a1), [x3, y3] = whlPt(R1, a1), [x4, y4] = whlPt(R1, a0);
    const [dx, dy] = whlPt((R1 + R2) / 2, (a0 + a1) / 2);
    const hue = Math.round(i * 360 / WHL_N);
    segs.push(`<g class="whl-seg" data-i="${i}"><path d="M${x1} ${y1}A${R2} ${R2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${R1} ${R1} 0 0 0 ${x4} ${y4}Z" fill="${whlHex(hue)}"/><circle class="whl-dot" cx="${dx}" cy="${dy}" r="3.4"/></g>`);
  }
  const bulbs = [];
  for (let i = 0; i < WHL_BULBS; i++) {
    const [x, y] = whlPt(93, i * 360 / WHL_BULBS + 360 / WHL_BULBS / 2);
    bulbs.push(`<circle class="whl-bulb b${i % 4}" cx="${x}" cy="${y}" r="2.7"/>`);
  }
  return `<svg class="whl-svg" viewBox="-100 -100 200 200" aria-hidden="true">
    <circle class="whl-rim" r="93" />
    <circle class="whl-base" r="${R2 + 1.5}" />
    ${segs.join('')}
    <circle class="whl-hub" r="${R1 - 1.5}" />
    ${bulbs.join('')}
  </svg>`;
}
function buildWheel() {
  const ring = $('#whlRing'); if (!ring) return;
  const old = ring.querySelector('svg'); if (old) old.remove();
  ring.insertAdjacentHTML('afterbegin', whlSVG());
  whl.built = true; whl.lit = -1;
  applyWheelChar();
}
function updateWheel() {
  const wrap = $('#whlWrap'); if (!wrap || !wheelMode()) return;
  if (!whl.built) buildWheel();
  const l = Math.max(0, Math.ceil(timer.left));
  const done = whl.done && !timer.running && timer.left <= 0;
  const num = $('#whlNum');
  if (num) num.textContent = done ? '⏰ 時間到！' : `${pad(Math.floor(l / 60))}:${pad(l % 60)}`;
  const lit = done ? 0 : whlLit(timer.left, timer.total);
  if (lit !== whl.lit) {
    $$('#whlRing .whl-seg').forEach(g => g.classList.toggle('off', +g.dataset.i < WHL_N - lit));
    whl.lit = lit;
  }
  wrap.classList.toggle('run', timer.running);
  wrap.classList.toggle('warn', timer.running && l <= 10 && l > 0);
  wrap.classList.toggle('done', done);
  if (timer.running) whl.started = true;   // 開始過（暫停時停在當下的動作；換時間、重設、時間到才回到半身照）
  if (done || timer.left <= 0) whl.started = false;
  whlDance(done ? 'done' : timer.running ? 'run' : whl.started ? 'pause' : 'idle');
}
/* ---- 💃 知心跳舞（v1.18.0） ----
 * 計時中：知心站在中間的圓上跳舞（身體可以超出轉盤上緣，數字框上面已經預留空間，不會疊到）。
 * 暫停：停在當下的動作（WebM 暫停；動態 WebP 換成靜止畫面）。還沒開始：圓裡面是知心的半身照。時間到：半身照跳一跳＋鈴聲。
 * 用哪一種：
 *   Chrome、Edge、Firefox（電腦、Android）→ 透明 WebM（VP9 alpha，24fps）
 *   iPad、iPhone、Mac 的 Safari → 動態 WebP（Safari 播 WebM 時透明背景會變黑）；WebM 播不出來時也改用它
 *   不跳舞（只顯示半身照）：系統「減少動態效果」、老師換了自己的圖片、兩種檔案都打不開
 * 看不到時（切到別的工具、別的頁面、監考、瀏覽器在背景）會暫停，不浪費電。檔案只有第一次要跳舞時才下載。
 */
const WHL_DANCE = { webm: 'images/zhixin-dance.webm', webp: 'images/zhixin-dance.webp', still: 'images/zhixin-dance-still.webp' };
function whlIsAppleWebKit() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;   // iPadOS 偽裝成 Mac
  return /Safari/.test(ua) && /Macintosh/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(ua);
}
function whlDanceKind() {
  if (whl.danceBroken === 'all' || state.settings.timerChar === 'custom' || prefersReducedMotion()) return 'none';
  if (whl.danceBroken !== 'video' && !whlIsAppleWebKit()) {
    let ok = '';
    try { const v = document.createElement('video'); ok = v.canPlayType ? v.canPlayType('video/webm; codecs="vp9"') : ''; } catch (e) {}
    if (ok === 'probably' || ok === 'maybe') return 'video';
  }
  return 'webp';
}
function whlVisible() {
  if (!wheelMode() || document.hidden) return false;
  if (typeof isExamOpen === 'function' && isExamOpen()) return false;
  const body = $('.tool-body[data-body="timer"]');
  if (!body || body.classList.contains('hidden')) return false;
  const page = body.closest('.page');
  if (page && !page.classList.contains('active')) return false;
  return !document.body.classList.contains('clean');
}
function whlStopDance() {
  const v = $('#whlDanceVid'); if (v) { try { v.pause(); } catch (e) {} }
}
function whlDance(mode) {
  const box = $('#whlDancer'), v = $('#whlDanceVid'), img = $('#whlDanceImg'), wrap = $('#whlWrap'), center = $('#whlRing .whl-center');
  if (!box || !v || !img) return;
  const kind = whlDanceKind();
  if (wrap) wrap.classList.toggle('no-dance', kind === 'none');
  const show = kind !== 'none' && (mode === 'run' || mode === 'pause');
  whl.danceMode = show ? (mode === 'run' ? 'dance' : 'freeze') : 'off';
  box.style.display = show ? '' : 'none';
  if (center) center.style.visibility = show ? 'hidden' : '';
  if (!show) { whlStopDance(); return; }
  const play = mode === 'run' && whlVisible();
  if (kind === 'video') {
    img.style.display = 'none'; v.style.display = '';
    if (!v.getAttribute('src')) {
      v.muted = true; v.loop = true; v.setAttribute('playsinline', ''); v.setAttribute('poster', WHL_DANCE.still);
      v.onerror = () => { whl.danceBroken = 'video'; whlStopDance(); whlDance(whl.danceMode === 'dance' ? 'run' : 'pause'); };
      v.setAttribute('src', WHL_DANCE.webm);
    }
    if (play) { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }
    else whlStopDance();
    whl.danceSrc = WHL_DANCE.webm;
  } else {
    whlStopDance(); v.style.display = 'none'; img.style.display = '';
    img.onerror = () => { if (img.getAttribute('src') === WHL_DANCE.webp) { whl.danceBroken = 'all'; whlDance('idle'); } };
    const want = play ? WHL_DANCE.webp : WHL_DANCE.still;
    if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    whl.danceSrc = want;
  }
}
/* ---------------- 🎵 跳舞音樂（v1.19.0） ----------------
 * 🎡 彩色轉盤「計時中」重複播放；按「暫停」停在原來的位置，再按「開始」接著播；
 * 時間到：先停音樂（回到開頭）再響鈴，鈴聲聽得清楚；按「重設」或換時間也回到開頭。
 * 音樂跟著「轉盤在計時」，不是跟著跳舞：老師換成自己的圖片、系統「減少動態效果」、跳舞檔案打不開時照樣播
 *   （音樂不是動態效果；不想要就關掉「🎵 跳舞音樂」或按計時器下面的 🎵）。
 * 監考時暫停，關掉監考後倒數還在跑就接著播。切到別的工具、瀏覽器在背景時照常播（倒數還在進行）。
 * 和其他聲音不打架：開始播時關掉環境音、暫停「我的音樂」，音樂停下來後（暫停、重設、時間到的鈴聲響完）再恢復原本的。
 *   計時中老師自己點了環境音或播「我的音樂」→ 這一輪倒數就讓給老師（不再搶回來），換時間、重設或時間到後恢復。
 * 由按「開始」觸發，瀏覽器允許播放；被擋住時提醒一次。音樂檔第一次開始計時才下載。
 */
const DM_SRC = 'sounds/dance-music.mp3';
const DM_RESTORE_MS = 3500;   // 時間到：鈴聲（約 3 秒）響完再恢復環境音／我的音樂
const dm = { playing: false, yielded: false, restoreAmb: 'none', restoreMusic: false, restoreTimer: 0, restoring: false, blocked: false, blockedWait: false, broken: false, pv: null, pvTimer: 0 };
function dmAudio() { return $('#whlMusic'); }
function dmVol() { const v = Number(state.settings.danceMusicVol); return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 60)) / 100; }
function dmWanted() {
  return wheelMode() && timer.running && !whl.done && state.settings.danceMusic !== false && !dm.yielded && !dm.broken && !dm.blockedWait && !(typeof isExamOpen === 'function' && isExamOpen());
}
function dmDuckOthers() {
  clearTimeout(dm.restoreTimer); dm.restoreTimer = 0;
  if (ambCur !== 'none') { dm.restoreAmb = ambCur; stopAmbient(); ambCur = 'none'; $$('#ambList li').forEach(li => li.classList.remove('on')); }
  const a = musicAudio();
  if (a && musicPlayingId && !a.paused) { dm.restoreMusic = true; try { a.pause(); } catch (e) {} renderMusicControls(); }
}
function dmRestore() {
  clearTimeout(dm.restoreTimer); dm.restoreTimer = 0;
  if (typeof isExamOpen === 'function' && isExamOpen()) return;   // 監考中先不恢復，關掉監考後再說
  const amb = dm.restoreAmb, mus = dm.restoreMusic;
  dm.restoreAmb = 'none'; dm.restoreMusic = false;
  dm.restoring = true;
  try {
    if (amb !== 'none') playAmbient(amb);
    else if (mus) { const a = musicAudio(); if (a && musicPlayingId && a.getAttribute('src')) { musicTakeOver(); safePlay(a); } }
  } finally { dm.restoring = false; }
}
function dmPause() {
  const a = dmAudio(); dm.playing = false;
  if (a) { try { a.pause(); } catch (e) {} }
}
function dmStop(done) {   // 時間到（done）／重設、換時間：停下來並回到開頭
  dmPause(); dm.yielded = false;
  const a = dmAudio(); if (a && a.getAttribute('src')) { try { a.currentTime = 0; } catch (e) {} }
  clearTimeout(dm.restoreTimer); dm.restoreTimer = 0;
  if (done && (dm.restoreAmb !== 'none' || dm.restoreMusic)) dm.restoreTimer = setTimeout(() => { dm.restoreTimer = 0; if (!dmWanted()) dmRestore(); }, DM_RESTORE_MS);
}
function dmSync() {
  const a = dmAudio(); if (!a) return;
  if (dmWanted()) {
    a.volume = dmVol();
    if (dm.playing && !a.paused) return;
    if (!a.getAttribute('src')) {
      a.loop = true; a.preload = 'auto';
      a.onerror = () => { dm.broken = true; dmPause(); dmRestore(); toast('⚠️ 跳舞音樂載入失敗（可能沒有網路），倒數照常進行'); };
      a.setAttribute('src', DM_SRC);
    }
    dmDuckOthers();
    dm.playing = true;
    let p; try { p = a.play(); } catch (e) { p = Promise.reject(e); }
    if (p && typeof p.catch === 'function') p.catch(e => {
      if (!dm.playing) return;            // 已經被暫停了（例如馬上按了暫停）
      dm.playing = false; dmRestore();
      if (e && e.name === 'NotAllowedError') dm.blockedWait = true;   // 等老師下一次按（🎵、暫停再開始），不要每 0.2 秒重試
      if (e && e.name === 'NotAllowedError' && !dm.blocked) { dm.blocked = true; toast('🎵 瀏覽器擋住了跳舞音樂，按一下計時器下面的 🎵 就會播放', 4000); }
      dmRenderBtn();
    });
  } else {
    if (dm.playing || !a.paused) dmPause();
    if (!timer.running) dm.blockedWait = false;
    if (!dm.restoreTimer && (dm.restoreAmb !== 'none' || dm.restoreMusic)) dmRestore();
  }
  dmRenderBtn();
}
function dmUserAudio() {   // 老師自己開了環境音或「我的音樂」
  if (dm.restoring) return;
  clearTimeout(dm.restoreTimer); dm.restoreTimer = 0;
  dm.restoreAmb = 'none'; dm.restoreMusic = false;
  if (wheelMode() && (timer.running || whl.started) && !whl.done) dm.yielded = true;
  if (dm.playing) dmPause();
  dmRenderBtn();
}
function dmRenderBtn() {
  const b = $('#whlMusicBtn'); if (!b) return;
  const on = state.settings.danceMusic !== false;
  b.textContent = on ? '🎵' : '🔇';
  b.classList.toggle('off', !on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.title = on ? (dm.yielded && timer.running ? '跳舞音樂：這一輪讓給您播的音樂（按一下改回跳舞音樂）' : '跳舞音樂：開（按一下關掉）') : '跳舞音樂：關（按一下打開）';
  b.setAttribute('aria-label', b.title);
}
function dmToggle(on = state.settings.danceMusic === false) {
  state.settings.danceMusic = !!on; save();
  dm.blockedWait = false;
  if (on) { dm.yielded = false; dm.blocked = false; dm.broken = false; }
  dmSync();
  toast(on ? '🎵 跳舞音樂：開' : '🔇 跳舞音樂：關');
}
function dmSetVol(v) {
  state.settings.danceMusicVol = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); save();
  const a = dmAudio(); if (a) a.volume = dmVol();
  if (dm.pv) dm.pv.volume = dmVol();
}
function dmPreview() {   // 教師控制台的「▶ 試聽」：播 8 秒（計時中直接聽轉盤的就好）
  if (dm.pv) return dmStopPreview();
  if (dm.playing) { toast('🎵 正在播放跳舞音樂'); return; }
  const a = document.createElement('audio'); a.src = DM_SRC; a.volume = dmVol(); dm.pv = a;
  let p; try { p = a.play(); } catch (e) { p = Promise.reject(e); }
  if (p && typeof p.catch === 'function') p.catch(() => { dmStopPreview(); toast('⚠️ 播放不出來，請確認音量或網路'); });
  dm.pvTimer = setTimeout(dmStopPreview, 8000);
  const b = $('#bDmTry'); if (b) b.textContent = '⏹ 停止';
}
function dmStopPreview() {
  clearTimeout(dm.pvTimer); dm.pvTimer = 0;
  if (dm.pv) { try { dm.pv.pause(); } catch (e) {} dm.pv = null; }
  const b = $('#bDmTry'); if (b) b.textContent = '▶ 試聽';
}
function dmBtnClick() {
  // 這一輪讓給老師的音樂時，按 🎵 是「改回跳舞音樂」；其他時候是開／關
  // 被瀏覽器擋住時，按 🎵 是「再播一次」（老師按的，瀏覽器會允許）
  if ((dm.yielded || dm.blockedWait) && state.settings.danceMusic !== false && wheelMode() && timer.running) {
    const was = dm.yielded; dm.yielded = false; dm.blockedWait = false; dmSync(); if (was) toast('🎵 改回跳舞音樂'); return;
  }
  dmToggle();
}
{ const b = $('#whlMusicBtn'); if (b) b.onclick = () => dmBtnClick(); }
function whlFinish() {
  if (!wheelMode()) return;
  whl.done = true;
  const wrap = $('#whlWrap');
  if (wrap) { wrap.classList.remove('done'); void wrap.offsetWidth; }   // 重新開始跳的動畫
  updateWheel();
}
// 中間的角色圖片
function whlCharSrc() { return state.settings.timerChar === 'custom' && whl.customUrl ? whl.customUrl : WHL_DEFAULT_IMG; }
function applyWheelChar() {
  const img = $('#whlChar'), fb = $('#whlCharFb'); if (!img) return;
  const src = whlCharSrc();
  img.onerror = () => {
    if (img.getAttribute('src') !== WHL_DEFAULT_IMG) { img.setAttribute('src', WHL_DEFAULT_IMG); return; }
    img.style.display = 'none'; if (fb) fb.style.display = '';
  };
  img.onload = () => { img.style.display = ''; if (fb) fb.style.display = 'none'; };
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  img.alt = src === WHL_DEFAULT_IMG ? '知心' : '自訂角色';
  const pv = $('#bWhlPreview'); if (pv) pv.setAttribute('src', src);
  if (whl.built && wheelMode()) updateWheel();
  const st = $('#bWhlState'); if (st) st.textContent = whlCharStateText();
}
function whlCharStateText() {
  if (state.settings.timerChar !== 'custom') return '目前：知心（預設）';
  return whl.customUrl ? '目前：您上傳的圖片' : '目前：知心（這台電腦沒有您上傳的圖片，例如從備份還原到新電腦時；請再上傳一次）';
}
async function loadWheelChar() {
  if (state.settings.timerChar === 'custom') {
    const v = await idbGet(WHL_IDB_KEY);
    whl.customUrl = typeof v === 'string' && /^data:image\//.test(v) ? v : '';
  } else whl.customUrl = '';
  whl.loaded = true;
  applyWheelChar();
}
function readAsDataURL(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
}
// 把老師選的圖片縮小成 dataURL（WebP，不支援時用 PNG；保留透明背景）
async function whlShrinkImage(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('請選圖片檔（PNG、JPG、WebP、GIF）');
  if (file.size > 15 * 1024 * 1024) throw new Error('圖片太大（超過 15MB），請先縮小再上傳');
  const raw = await readAsDataURL(file);
  let out = '';
  try {
    const cv = document.createElement('canvas');
    let ctx = null; try { ctx = cv.getContext && cv.getContext('2d'); } catch (e) { ctx = null; }
    const img = ctx ? await new Promise((resolve, reject) => { const im = new Image(), t = setTimeout(() => reject(new Error('timeout')), 8000); im.onload = () => { clearTimeout(t); resolve(im); }; im.onerror = () => { clearTimeout(t); reject(new Error('bad')); }; im.src = raw; }) : null;
    const w0 = img ? img.naturalWidth || img.width : 0, h0 = img ? img.naturalHeight || img.height : 0;
    const k = Math.min(1, WHL_MAX_PX / Math.max(w0, h0, 1));
    cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
    if (ctx && w0 && h0) {
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      out = cv.toDataURL('image/webp', .86);
      if (!/^data:image\/webp/.test(out) || out.length > WHL_MAX_BYTES) { const png = cv.toDataURL('image/png'); if (!/^data:image\/webp/.test(out) || png.length < out.length) out = png; }
    }
  } catch (e) { out = ''; }
  if (!out) {   // 瀏覽器不能縮圖：小的圖片直接用
    if (raw.length > WHL_RAW_MAX * 1.37) throw new Error('這個瀏覽器不能縮小圖片，請先把圖片縮小到 300KB 以下');
    out = raw;
  }
  if (out.length > WHL_MAX_BYTES * 1.37) throw new Error('圖片縮小後還是太大，請換一張');
  return out;
}
async function setWheelChar(dataUrl) {
  if (!/^data:image\//.test(String(dataUrl || ''))) throw new Error('圖片格式不對');
  await idbSet(WHL_IDB_KEY, dataUrl);
  whl.customUrl = dataUrl; state.settings.timerChar = 'custom';
  save(); applyWheelChar();
}
async function resetWheelChar() {
  try { await idbDel(WHL_IDB_KEY); } catch (e) {}
  whl.customUrl = ''; state.settings.timerChar = '';
  save(); applyWheelChar();
}


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

/* ---------------- 任務／作業檢查 ---------------- */
function taskOptions(sel) {
  const daily = state.taskDefs.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>✅ ${esc(t.name)}</option>`).join('');
  const hw = openHomework().map(h => {
    const v = 'hw:' + h.id;
    return `<option value="${v}" ${v === sel ? 'selected' : ''}>📕 ${esc(hwShortDate(h.date) + ' ' + h.title)}</option>`;
  }).join('');
  const grp = [];
  if (hw) grp.push(`<optgroup label="作業檢查（未完成）">${hw}</optgroup>`);
  if (daily) grp.push(`<optgroup label="每日任務">${daily}</optgroup>`);
  return grp.join('') || '<option>尚未設定</option>';
}
function renderTaskWidget() {
  const open = openHomework();
  // 若目前選的作業已不存在，改選第一筆開放作業或第一個每日任務
  const cur = state.ui.widgetTask;
  const validHw = cur && cur.startsWith('hw:') && open.some(h => ('hw:' + h.id) === cur);
  const validDaily = state.taskDefs.some(t => t.id === cur);
  if (!validHw && !validDaily) state.ui.widgetTask = open[0] ? 'hw:' + open[0].id : (state.taskDefs[0]?.id || '');
  const id = state.ui.widgetTask;
  $('#taskSelect').innerHTML = taskOptions(id);
  let seats = activeSeats();
  let n = 0, missHtml = '';
  if (id && id.startsWith('hw:')) {
    const h = state.homework.find(x => x.id === id.slice(3));
    if (h) {
      const c = hwCounts(h, seats);
      n = c.done;
      missHtml = !seats.length ? '' : (c.miss + c.fix)
        ? `沒交 <b>${c.miss}</b>　要訂正 <b>${c.fix}</b>　完成 <b>${c.done}</b>`
        : '🎉 全班都完成了！';
    }
  } else {
    // 每日任務只算今天有到的人；請假／曠課的同學不算「尚未完成」
    const all = seats.length;
    seats = presentSeats();
    const done = new Set(todayDone()[id] || []);
    n = seats.filter(s => done.has(s)).length;
    const miss = seats.filter(s => !done.has(s));
    const off = all - seats.length;
    missHtml = !seats.length ? '' : (miss.length ? `尚未完成：<b>${miss.map(s => pad(s)).join('、')}</b>` : '🎉 全班都完成了！') + (off ? `<small class="att-off">（今日缺席 ${off} 人不列入）</small>` : '');
  }
  $('#taskDone').textContent = n; $('#taskTotal').textContent = seats.length;
  $('#taskRing').style.strokeDashoffset = 314.16 * (1 - (seats.length ? n / seats.length : 0));
  $('#taskMissing').innerHTML = missHtml;
}
$('#taskSelect').onchange = e => { state.ui.widgetTask = e.target.value; save(); renderTaskWidget(); };

function renderTasksPage() {
  const d = new Date();
  $('#tasksDate').textContent = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  const tab = ['daily', 'week', 'hw'].includes(state.ui.tasksTab) ? state.ui.tasksTab : 'hw';
  state.ui.tasksTab = tab;
  $$('#tasksModeTabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === tab));
  const hwPanel = $('#hwPanel'), dailyPanel = $('#dailyTaskPanel'), weekPanel = $('#weekPanel');
  if (hwPanel) hwPanel.style.display = tab === 'hw' ? '' : 'none';
  if (dailyPanel) dailyPanel.style.display = tab === 'daily' ? '' : 'none';
  if (weekPanel) weekPanel.style.display = tab === 'week' ? '' : 'none';
  if (tab === 'hw') renderHomeworkPanel();
  else if (tab === 'week') { if (!weekDraft) ensureWeekDraft(new Date()); renderWeekPlanner(); }
  else renderDailyTaskPanel();
}
function renderDailyTaskPanel() {
  if (!state.taskDefs.find(t => t.id === state.ui.pageTask)) state.ui.pageTask = state.taskDefs[0]?.id;
  const rec = todayDone(), all = activeSeats(), seats = presentSeats();
  const absMap = {}; todayAttendance().list.forEach(x => { absMap[x.seat] = x.status; });
  $('#taskTabs').innerHTML = state.taskDefs.map(t => {
    const c = (rec[t.id] || []).filter(s => seats.includes(s)).length;
    return `<button data-id="${t.id}" class="${t.id === state.ui.pageTask ? 'active' : ''}">${esc(t.name)}<em>${c}/${seats.length}</em></button>`;
  }).join('') || '<span class="hint">還沒有任務，按右邊「⚙️ 自訂任務」新增</span>';
  const done = new Set(rec[state.ui.pageTask] || []);
  const allBtn = $('#taskAllDone');
  if (allBtn) {
    const left = seats.filter(s => !done.has(s)).length;
    allBtn.style.display = state.ui.pageTask && seats.length ? '' : 'none';
    allBtn.disabled = !left;
    allBtn.textContent = left ? `✅ 全班完成（補 ${left} 人）` : '🎉 全班已完成';
  }
  // 請假／曠課的座號照樣顯示（變淡、標上假別），老師還是可以幫他打卡
  $('#seatGrid').innerHTML = all.map(s => {
    const a = absMap[s], off = a && ATT_ABSENT.has(a);
    return `<button class="seat ${done.has(s) ? 'done' : ''}${off ? ' absent' : ''}" data-seat="${s}"${a ? ` title="今日${ATT[a].label}"` : ''}><b>${pad(s)}</b><small>${esc(nameOf(s)) || '&nbsp;'}</small>${a ? `<i class="att-tag att-${a}">${ATT[a].label}</i>` : ''}</button>`;
  }).join('');
}
function renderHomeworkPanel() {
  const seats = activeSeats();
  const open = openHomework();
  const box = $('#hwOpenList');
  if (!box) return;
  if (!open.length) {
    const nx = nextSchoolDay();
    box.innerHTML = `<p class="hint">${isOffDay(new Date()) ? `🎌 今天放假（${esc(dayInfo(new Date()).name)}）。` : ''}目前沒有待檢查的作業。今天聯絡簿新增的項目，<b>${nx && nx !== dkAdd(dateKey(), 1) ? `下一個上課日 ${holFmt(nx)}` : '明天'}</b>才會出現在這裡；也可按「＋ 補登作業」。</p>`;
  } else {
    box.innerHTML = open.map(h => hwCardHTML(h, seats)).join('');
  }
  const done = doneHomework();
  const pick = $('#hwPick');
  if (pick) { pick.innerHTML = hwPickHTML(); pick.style.display = (open.length || done.length) ? '' : 'none'; }
  const hist = $('#hwDoneList');
  const wrap = $('#hwDoneWrap');
  if (wrap) wrap.style.display = done.length ? '' : 'none';
  if (hist) {
    hist.style.display = state.ui.showHwDone ? '' : 'none';
    hist.innerHTML = done.map(h => {
      const c = hwCounts(h, seats);
      return `<div class="hw-card done-card" data-hw="${h.id}">
        <div class="hw-head"><div><b>${esc(hwDateLabel(h.date))}</b> ${esc(h.title)}
          <span class="hw-src">${h.source === 'manual' ? '補登' : '聯絡簿'}</span></div>
          <span class="hw-counts">✅ 完成 ${c.done}/${seats.length}</span></div>
        <div class="seat-grid compact">${seats.map(s => seatHwBtn(h, s)).join('')}</div>
      </div>`;
    }).join('') || '';
  }
  const tog = $('#hwDoneToggle');
  if (tog) tog.textContent = state.ui.showHwDone ? '收合已完成' : `查看已完成（${done.length}）`;
}
function seatHwBtn(h, s) {
  const st = hwStatusOf(h, s);
  return `<button class="seat hw-${st}" data-hw="${h.id}" data-seat="${s}" title="${HW_LABEL[st]}">
    <b>${pad(s)}</b><small>${esc(nameOf(s)) || '&nbsp;'}</small>
    <i class="hw-badge">${st === 'done' ? '✓' : st === 'fix' ? '訂' : '未'}</i></button>`;
}
function hwCardHTML(h, seats) {
  const c = hwCounts(h, seats);
  return `<div class="hw-card" data-hw="${h.id}">
    <div class="hw-head">
      <div><b>${esc(hwDateLabel(h.date))}</b> ${esc(h.title)}
        <span class="hw-src">${h.source === 'manual' ? '補登' : '聯絡簿'}</span></div>
      <div class="hw-actions">
        <span class="hw-counts">沒交 ${c.miss}　要訂正 ${c.fix}　完成 ${c.done}</span>
        <button class="btn all-done-btn" data-hw-all="${h.id}" title="檢查完全班都過關，一鍵標成完成">✅ 全班完成</button>
        <button class="btn hw-skip" data-skip="${h.id}" title="不當作業檢查（例如班級事項）">不需檢查</button>
      </div>
    </div>
    <div class="seat-grid">${seats.map(s => seatHwBtn(h, s)).join('')}</div>
    <p class="hw-legend">先選上方的狀態（<span class="lg-done">✓ 完成</span>／<span class="lg-fix">✏️ 要訂正</span>／<span class="lg-miss">✗ 沒交</span>），再點座號（完成 +1 金幣；再點一次改回沒交）</p>
  </div>`;
}

// 頁面模式切換：作業檢查 / 每日任務
document.addEventListener('click', e => {
  const modeBtn = e.target.closest('#tasksModeTabs [data-mode]');
  if (modeBtn) {
    state.ui.tasksTab = modeBtn.dataset.mode;
    if (modeBtn.dataset.mode === 'week') ensureWeekDraft(weekDraft?.anchor || new Date());
    save(); renderTasksPage();
    return;
  }
  if (e.target.closest('#openWeekFromContact')) {
    state.ui.tasksTab = 'week';
    ensureWeekDraft(new Date());
    save(); goto('tasks');
    return;
  }
  if (e.target.closest('#hwDoneToggle')) {
    state.ui.showHwDone = !state.ui.showHwDone;
    save(); renderHomeworkPanel();
    return;
  }
  const skip = e.target.closest('[data-skip]');
  if (skip) {
    const h = state.homework.find(x => x.id === skip.dataset.skip);
    if (!h) return;
    askConfirm(`確定「${h.title}」不需檢查？\n（可在已略過項目中復原；不會刪除聯絡簿內容）`, '不需檢查').then(ok => {
      if (!ok) return;
      h.skipped = true;
      save(); renderTasksPage(); renderTaskWidget(); renderHeader();
      toast('已標示為不需檢查');
    });
    return;
  }
  const allHw = e.target.closest('[data-hw-all]');
  if (allHw) {
    const h = state.homework.find(x => x.id === allHw.dataset.hwAll);
    if (!h) return;
    const seats = activeSeats();
    const c = hwCounts(h, seats);
    if (!c.miss && !c.fix) { toast('這份作業全班都已經完成囉'); return; }
    askConfirm(`「${h.title}」全班都完成了嗎？\n\n會把 沒交 ${c.miss} 人、要訂正 ${c.fix} 人 一起改成「完成」，每人 +1 金幣。`, '✅ 全班完成').then(ok => {
      if (!ok) return;
      const n = markHwAllDone(h, seats);
      save(); renderTasksPage(); renderTaskWidget(); renderHeader();
      toast(`🎉 「${h.title}」全班完成！（${n} 人 +1 金幣）`, 3500);
      try { ensureAudio(); chime(); } catch (_) {}
    });
    return;
  }
  if (e.target.closest('#taskAllDone')) {
    const tid = state.ui.pageTask; if (!tid) return;
    const t = state.taskDefs.find(x => x.id === tid);
    const seats = presentSeats(); // 今天請假／曠課的同學不用補打卡
    const rec = todayDone();
    const left = seats.filter(s => !(rec[tid] || []).includes(s));
    if (!left.length) return;
    askConfirm(`「${t?.name || ''}」今天全班都完成了嗎？\n\n會幫 ${left.map(pad).join('、')} 號（共 ${left.length} 人）打卡，每人 +1 金幣。`, '✅ 全班完成').then(ok => {
      if (!ok) return;
      const n = markTaskAllDone(rec, tid, seats, t?.name || '');
      save(); renderDailyTaskPanel(); renderTaskWidget(); renderHeader();
      toast(`🎉 「${t?.name || ''}」全班完成！（${n} 人 +1 金幣）`, 3500);
      try { ensureAudio(); chime(); } catch (_) {}
    });
    return;
  }
  if (e.target.closest('#taskManage')) { teacherOpen('tasks'); return; }
  if (e.target.closest('#hwAddBtn')) {
    openHwAddModal();
    return;
  }
});

$('#taskTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.ui.pageTask = b.dataset.id; save(); renderDailyTaskPanel();
});
$('#seatGrid').addEventListener('click', e => {
  const b = e.target.closest('.seat'); if (!b) return;
  const seat = +b.dataset.seat, tid = state.ui.pageTask; if (!tid) return;
  const rec = todayDone(), arr = (rec[tid] ||= []);
  const i = arr.indexOf(seat);
  if (i >= 0) { arr.splice(i, 1); addCoins(seat, -1, '取消打卡', false, 'task'); }
  else { arr.push(seat); addCoins(seat, 1, '任務：' + (state.taskDefs.find(t => t.id === tid)?.name || ''), false, 'task'); ensureAudio(); chime(); }
  save(); renderDailyTaskPanel(); renderTaskWidget(); renderHeader();
  const nb = $(`#seatGrid .seat[data-seat="${seat}"]`); nb && nb.classList.add('pop');
});
// 作業檢查：選狀態（事件委派）
document.addEventListener('click', e => {
  const pk = e.target.closest('#hwPick [data-hw-brush]');
  if (!pk) return;
  state.ui.hwBrush = pk.dataset.hwBrush;
  $$('#hwPick [data-hw-brush]').forEach(x => { const on = x === pk; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); });
  save();
});
// 作業座號點擊：設成上方選好的狀態（事件委派在作業列表）
document.addEventListener('click', e => {
  const b = e.target.closest('#hwOpenList .seat, #hwDoneList .seat');
  if (!b) return;
  const h = state.homework.find(x => x.id === b.dataset.hw); if (!h) return;
  const seat = +b.dataset.seat;
  const next = applyHwBrush(h, seat);
  if (next === 'done') { ensureAudio(); chime(); }
  save(); renderHomeworkPanel(); renderTaskWidget(); renderHeader();
  const nb = $(`.seat[data-hw="${h.id}"][data-seat="${seat}"]`);
  nb && nb.classList.add('pop');
});

/* 一週作業：欄位操作 */
document.addEventListener('click', e => {
  if (!$('#weekPanel') || $('#weekPanel').style.display === 'none') return;
  if (e.target.closest('#weekPrev')) {
    readWeekGridFromDom();
    const a = new Date(weekDraft.anchor); a.setDate(a.getDate() - 7);
    ensureWeekDraft(a); renderWeekPlanner(); return;
  }
  if (e.target.closest('#weekNext')) {
    readWeekGridFromDom();
    const a = new Date(weekDraft.anchor); a.setDate(a.getDate() + 7);
    ensureWeekDraft(a); renderWeekPlanner(); return;
  }
  if (e.target.closest('#weekThis')) {
    readWeekGridFromDom();
    ensureWeekDraft(new Date()); renderWeekPlanner(); return;
  }
  // 複製本週 → 下一週（週一對週一…），跳到下一週讓老師改頁數後再儲存
  if (e.target.closest('#weekCopyNext')) {
    readWeekGridFromDom();
    const plan = copyWeekLines(weekDraft);
    if (!plan.total) return toast('這一週還沒有作業可以複製');
    const a = new Date(weekDraft.anchor); a.setDate(a.getDate() + 7);
    const next = ensureWeekDraft(a);
    const hasOld = Object.values(next.lines).some(ls => ls.some(x => x.trim()));
    if (hasOld && !confirm('下一週已經有作業了，要用這一週的內容覆蓋嗎？\n（按「取消」則不複製）')) { renderWeekPlanner(); return; }
    Object.assign(next.lines, plan.lines);
    renderWeekPlanner();
    toast(`⏭️ 已複製 ${plan.total} 項到下一週，改好頁數再按「💾 儲存一週作業」`, 4000);
    return;
  }
  if (e.target.closest('#weekApplyAll')) {
    readWeekGridFromDom();
    const keys = weekdaysOf(weekDraft.anchor);
    const src = (weekDraft.lines[keys[0]] || []).map(s => s.trim()).filter(Boolean);
    if (!src.length) return toast('請先在「週一」填至少一項');
    const offs = keys.slice(1).filter(dk => isOffDay(dk));
    keys.slice(1).forEach(dk => { if (!isOffDay(dk)) weekDraft.lines[dk] = src.slice(); });
    renderWeekPlanner(); toast(offs.length ? `已套用到週二～週五，跳過放假的 ${offs.map(hwShortDate).join('、')}（尚未儲存）` : '已套用到週二～週五（尚未儲存）', 3500);
    return;
  }
  if (e.target.closest('#weekSave')) {
    if (!canEditBoard()) return teacherOpen('unlock');
    readWeekGridFromDom();
    const keys = weekdaysOf(weekDraft.anchor);
    const payload = {};
    keys.forEach(dk => { payload[dk] = weekDraft.lines[dk] || []; });
    // 若有「已打卡卻要刪除」的項目，先確認
    const doomed = [];
    keys.forEach(dk => {
      const desired = new Set((payload[dk] || []).map(s => String(s || '').trim()).filter(Boolean));
      (state.contact[dk] || []).forEach(it => {
        if (!it.fromWeek) return;
        if (desired.has(it.text)) return;
        const hw = (state.homework || []).find(h => h.contactId === it.id || h.id === 'hw_' + it.id);
        if (hw && hw.statuses && Object.keys(hw.statuses).length) doomed.push(`${hwShortDate(dk)} ${it.text}`);
      });
    });
    if (doomed.length) {
      if (!confirm(`以下作業已有學生打卡紀錄，儲存時會保留它們（不會刪除）：\n\n${doomed.join('\n')}\n\n仍要儲存其餘變更嗎？`)) return;
    }
    const r = applyWeekPlan(payload);
    save(); renderContact(); renderHeader(); renderTaskWidget(); renderWeekPlanner();
    toast(`✅ 一週作業已儲存（新增 ${r.added}、保留 ${r.kept}、移除 ${r.removed}）`, 3500);
    return;
  }
  const col = e.target.closest('#weekGrid .week-day');
  if (!col) return;
  readWeekGridFromDom();
  const dk = col.dataset.date;
  if (e.target.closest('[data-add-line]')) {
    (weekDraft.lines[dk] ||= []).push('');
    renderWeekPlanner(); return;
  }
  if (e.target.closest('[data-rm-line]')) {
    const li = +e.target.closest('.week-line').dataset.li;
    weekDraft.lines[dk].splice(li, 1);
    if (!weekDraft.lines[dk].length) weekDraft.lines[dk] = [''];
    renderWeekPlanner(); return;
  }
  if (e.target.closest('[data-copy-next]')) {
    const i = +col.dataset.i;
    const keys = weekdaysOf(weekDraft.anchor);
    if (i >= keys.length - 1) return;
    const src = (weekDraft.lines[dk] || []).map(s => s.trim()).filter(Boolean);
    let j = i + 1;
    while (j < keys.length && isOffDay(keys[j])) j++;   // 下一天放假 → 複製到下一個上課日
    if (j >= keys.length) return toast('這一週後面的日子都放假，沒有複製');
    weekDraft.lines[keys[j]] = src.length ? src.slice() : [''];
    renderWeekPlanner(); toast(j > i + 1 ? `下一天放假，已複製到 ${hwShortDate(keys[j])}（尚未儲存）` : '已複製到下一天（尚未儲存）');
  }
});

function openHwAddModal() {

  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const def = dateKey(yest);
  openModal(`<button class="close" data-close>✕</button>
    <h2>＋ 補登作業</h2>
    <p class="sub">用於漏登的舊作業，或聯絡簿沒寫但需要檢查的項目。佈置日必須早於今天才會進入檢查清單。</p>
    <div class="field"><span>佈置日期</span><input type="date" id="hwAddDate" value="${def}"></div>
    <div class="field"><span>作業名稱</span><input id="hwAddTitle" placeholder="例如：數習 p48、生甲：p36-p40" maxlength="80"></div>
    <div class="modal-actions"><button class="primary" id="hwAddSave">新增</button></div>`);
  setTimeout(() => {
    const saveBtn = $('#hwAddSave');
    if (!saveBtn) return;
    saveBtn.onclick = () => {
      const dk = $('#hwAddDate').value, title = $('#hwAddTitle').value.trim();
      if (!dk) return toast('請選擇日期');
      if (!title) return toast('請輸入作業名稱');
      if (dk >= dateKey()) return toast('佈置日須早於今天（今天的作業明天再檢查）');
      addManualHomework(dk, title);
      save(); closeModal(); renderTasksPage(); renderTaskWidget(); renderHeader();
      toast('✅ 已補登作業');
    };
  }, 0);
}


/* ---------------- 金幣 / 物種 ---------------- */
const celebrateQueue = [];
// kind：'hw' 作業、'task' 每日任務（存摺記每天合計）、'manual' 老師加扣分（存摺逐筆永久保留）
// 兌換不走這裡（redeemCoins），所以兌換不會讓班級山林和物種進度倒退
function addCoins(seat, delta, reason, silent, kind = 'manual') {
  const s = fixStudentBook(stu(seat));
  delta = Math.round(Number(delta) || 0);
  if (delta < 0) delta = -Math.min(-delta, s.coins);   // 不會扣到負數；紀錄寫實際扣掉的數字
  if (!delta) { if (!celebrateQueue.running) runCelebrations(); return 0; }
  s.coins += delta;
  s.earned = s.coins + s.spent;
  recordCoin(seat, delta, reason, kind);
  if (delta > 0) {
    state.forest.points += delta;
    while (state.forest.points >= 100) { state.forest.points -= 100; state.forest.level++; celebrateQueue.push({ type: 'level', level: state.forest.level }); }
    while (s.earned >= s.nextAt) {
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
  return delta;
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

/* ---------------- 抽號 ----------------
 * v1.11.0：抽號動畫。先用原本的規則決定結果（跳過今天請假、曠課的同學；勾「不重複」就不抽已抽過的），
 * 再播動畫「演」到這個結果。五種動畫：🎰 拉霸機、🎡 幸運轉盤、🥚 扭蛋機、🃏 翻牌、🐾 班寵抽號。
 * 「每次隨機」不會連續兩次同一種。點一下畫面或按「⏭ 跳過動畫」直接看結果。
 * 教師控制台 → 基本資料 → 🎬 動畫效果 可以固定一種，或「關閉動畫」（回到原本的跳數字）。
 */
let drawn = [];
const DRAW_STYLES = {
  slot: { icon: '🎰', name: '拉霸機' },
  wheel: { icon: '🎡', name: '幸運轉盤' },
  gacha: { icon: '🥚', name: '扭蛋機' },
  cards: { icon: '🃏', name: '翻牌' },
  pet: { icon: '🐾', name: '班寵抽號' }
};
const DRAW_STYLE_KEYS = Object.keys(DRAW_STYLES);
const DRAW_ANIM_OPTIONS = ['random', ...DRAW_STYLE_KEYS, 'off'];
const TIMER_STYLE_OPTIONS = ['island', 'simple', 'wheel'];
const prefersReducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
let lastDrawStyle = '';
// 這次要用哪一種動畫（'off'＝原本的跳數字）
function chooseDrawStyle(setting = state.settings.drawAnim, last = lastDrawStyle, rnd = Math.random) {
  if (setting === 'off') return 'off';
  if (DRAW_STYLES[setting]) return setting;
  const opts = DRAW_STYLE_KEYS.filter(k => k !== last);
  return opts[Math.floor(rnd() * opts.length) % opts.length];
}
// 依原本規則選出這次的號碼（null＝沒得抽）
function pickDrawSeat(noRep = $('#drawNoRepeat') ? $('#drawNoRepeat').checked : true, rnd = Math.random) {
  const pool = presentSeats().filter(s => !noRep || !drawn.includes(s));
  if (!pool.length) { toast(presentSeats().length ? '全部都抽過了，按「重置」重新開始' : '今天沒有可以抽的同學'); return null; }
  return { pick: pool[Math.floor(rnd() * pool.length) % pool.length], pool };
}
function showDrawResult(pick) {
  const el = $('#drawNum');
  el.textContent = pad(pick); el.classList.remove('rolling');
  $('#drawName').textContent = nameOf(pick) || `${pick} 號`;
  $('#drawHistory').textContent = '已抽：' + drawn.map(pad).join('、');
}
// 原本的跳數字（關閉動畫、或系統設定「減少動態效果」時）
function drawRollSimple(pick, pool) {
  const el = $('#drawNum'); el.classList.add('rolling');
  let k = 0;
  const iv = setInterval(() => {
    el.textContent = pad(pool[Math.floor(Math.random() * pool.length)]);
    if (++k > 18) { clearInterval(iv); showDrawResult(pick); chime(); drawAnim.busy = false; }
    else beepTick();
  }, 70);
}
$('#drawBtn').onclick = () => startDraw();
function startDraw(opt = {}) {
  if (drawAnim.busy) return null;
  const r = pickDrawSeat(opt.noRep, opt.rnd);
  if (!r) return null;
  ensureAudio();
  drawn.push(r.pick);   // 結果先定好，動畫只是演出來
  drawAnim.busy = true;
  let style = opt.style || chooseDrawStyle();
  if (style !== 'off' && prefersReducedMotion() && !opt.style) style = 'off';
  if (style === 'off') { drawRollSimple(r.pick, r.pool); return { pick: r.pick, style }; }
  lastDrawStyle = style;
  runDrawAnim(style, r.pick, r.pool);
  return { pick: r.pick, style };
}
function beepTick() {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.frequency.value = 1400; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .04);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .05);
}
$('#drawReset').onclick = () => { if (drawAnim.busy) return; drawn = []; $('#drawNum').textContent = '?'; $('#drawName').textContent = '按下按鈕抽一位幸運兒'; $('#drawHistory').textContent = ''; };

/* ---- 抽號音效：小鼓滾奏（Web Audio 合成，不用下載音檔） ---- */
function drumroll(sec = 3) {
  try {
    if (!actx || typeof actx.createBufferSource !== 'function') return () => {};
    const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noiseBuf('white'); src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = 1800; if (bp.Q) bp.Q.value = .7;
    const t0 = actx.currentTime, hit = .055;
    g.gain.setValueAtTime(0, t0);
    for (let t = 0; t < sec; t += hit) {
      const v = .05 + .1 * (t / sec);   // 越來越大聲
      g.gain.setValueAtTime(v, t0 + t); g.gain.exponentialRampToValueAtTime(.004, t0 + t + hit * .9);
    }
    src.connect(bp).connect(g).connect(actx.destination);
    src.start(t0); src.stop(t0 + sec + .1);
    return () => { try { g.gain.cancelScheduledValues && g.gain.cancelScheduledValues(actx.currentTime); g.gain.setValueAtTime(0, actx.currentTime); src.stop(); } catch (e) {} };
  } catch (e) { return () => {}; }
}
function revealSound() {
  try {
    chime();
    if (!actx) return;
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(392, t); o.frequency.exponentialRampToValueAtTime(784, t + .25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .03); g.gain.exponentialRampToValueAtTime(.001, t + .6);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .65);
  } catch (e) {}
}

/* ---- 動畫舞台 ---- */
const drawAnim = { busy: false, timers: [], stopDrum: null, finish: null, revealed: false, pick: 0, style: '', closeT: 0 };
const DRAW_ANIM_MS = 3300;
function dsLater(fn, ms) { const id = setTimeout(fn, ms); drawAnim.timers.push(id); return id; }
const petEmoji = () => {
  const pets = [...classSpecies()].map(spById).filter(s => s && s.cat === 'animal').map(s => s.emoji);
  return pets[0] || '🐕';
};
function shuffled(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// 舞台上要顯示的其他號碼（一定包含 pick）
function drawExtras(pick, pool, n) {
  const others = shuffled(pool.filter(s => s !== pick)).slice(0, Math.max(0, n - 1));
  return shuffled([pick, ...others]);
}
function runDrawAnim(style, pick, pool) {
  const st = $('#drawStage'), area = $('#dsArea');
  if (!st || !area) { showDrawResult(pick); drawAnim.busy = false; return; }
  clearTimeout(drawAnim.closeT);
  Object.assign(drawAnim, { timers: [], revealed: false, pick, style, finish: null });
  $('#dsTitle').textContent = `${DRAW_STYLES[style].icon} ${DRAW_STYLES[style].name}`;
  $('#dsResult').style.display = 'none';
  $('#dsSkip').style.display = '';
  $('#dsClose').style.display = 'none';
  area.className = 'ds-area ds-' + style;
  area.innerHTML = '';
  st.style.display = 'flex';
  $('#drawNum').classList.add('rolling'); $('#drawNum').textContent = '?';
  drawAnim.stopDrum = drumroll(DRAW_ANIM_MS / 1000 - .2);
  ({ slot: animSlot, wheel: animWheel, gacha: animGacha, cards: animCards, pet: animPet })[style](area, pick, pool);
  dsLater(() => dsReveal(), DRAW_ANIM_MS);
}
function skipDrawAnim() {
  if (!drawAnim.busy || drawAnim.revealed) return;
  drawAnim.timers.forEach(clearTimeout); drawAnim.timers = [];
  try { drawAnim.finish && drawAnim.finish(); } catch (e) {}
  dsReveal();
}
function dsReveal() {
  if (drawAnim.revealed) return;
  drawAnim.revealed = true;
  drawAnim.timers.forEach(clearTimeout); drawAnim.timers = [];
  if (drawAnim.stopDrum) { drawAnim.stopDrum(); drawAnim.stopDrum = null; }
  const pick = drawAnim.pick;
  $('#dsNum').textContent = pad(pick);
  $('#dsName').textContent = nameOf(pick) || `${pick} 號`;
  $('#dsResult').style.display = '';
  $('#dsSkip').style.display = 'none';
  $('#dsClose').style.display = '';
  showDrawResult(pick);
  revealSound(); confetti();
  drawAnim.closeT = setTimeout(() => closeDrawStage(), 3500);
}
function closeDrawStage() {
  clearTimeout(drawAnim.closeT);
  if (!drawAnim.revealed && drawAnim.busy) { skipDrawAnim(); return; }
  const st = $('#drawStage'); if (st) st.style.display = 'none';
  const area = $('#dsArea'); if (area) area.innerHTML = '';
  drawAnim.busy = false;
}
(function bindDrawStage() {
  const st = $('#drawStage'); if (!st) return;
  st.addEventListener('click', e => {
    if (e.target.closest('#dsClose')) return closeDrawStage();
    if (!drawAnim.revealed) return skipDrawAnim();
    closeDrawStage();
  });
})();

// 🎰 拉霸機：兩個轉輪（十位數、個位數），一個一個停
function animSlot(area, pick) {
  const digits = pad(pick).split('');
  const LOOPS = 5;
  const strip = Array.from({ length: LOOPS * 10 }, (_, i) => `<i>${i % 10}</i>`).join('');
  area.innerHTML = `<div class="slot-box"><div class="slot-lights">✦ ✦ ✦</div><div class="slot-reels">${digits.map((_, i) => `<div class="reel"><div class="strip" data-reel="${i}">${strip}</div></div>`).join('')}</div><div class="slot-lever" id="slotLever"></div></div>`;
  const strips = $$('.strip', area);
  const target = d => (LOOPS - 1) * 10 + Number(d);
  const set = (el, idx, ms) => { el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.12,.75,.2,1)` : 'none'; el.style.transform = `translateY(${-idx * 1.2}em)`; };
  const lever = $('#slotLever');
  dsLater(() => { if (lever) lever.classList.add('pull'); strips.forEach((el, i) => set(el, target(digits[i]), 1500 + i * 1000)); }, 60);
  dsLater(() => beepTick(), 1600); dsLater(() => beepTick(), 2600);
  drawAnim.finish = () => strips.forEach((el, i) => set(el, target(digits[i]), 0));
}
// 🎡 幸運轉盤：今天可以抽的座號排成一圈
function wheelPath(i, n) {
  if (n === 1) return 'M0 -100 A100 100 0 1 1 -0.01 -100 Z';
  const a0 = i / n * 2 * Math.PI, a1 = (i + 1) / n * 2 * Math.PI;
  const p = a => `${(100 * Math.sin(a)).toFixed(2)} ${(-100 * Math.cos(a)).toFixed(2)}`;
  return `M0 0 L${p(a0)} A100 100 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
}
function wheelTargetAngle(idx, n, turns = 5, jitter = 0) {
  const seg = 360 / n, c = (idx + .5) * seg + jitter * seg * .3;
  return turns * 360 + ((360 - c) % 360 + 360) % 360;
}
function animWheel(area, pick, pool) {
  const seats = pool.slice().sort((a, b) => a - b);
  const n = seats.length, idx = seats.indexOf(pick);
  const fs = n > 30 ? 7 : n > 20 ? 9 : n > 12 ? 12 : 16;
  const seg = 360 / n;
  const segs = seats.map((s, i) => {
    const mid = (i + .5) * seg;
    return `<path d="${wheelPath(i, n)}" fill="hsl(${Math.round(i * 360 / n)},70%,${i % 2 ? 58 : 66}%)" stroke="rgba(255,255,255,.7)" stroke-width="${n > 30 ? .4 : .8}"/>
      <text transform="rotate(${mid.toFixed(2)}) translate(0 ${n === 1 ? -50 : -74})" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="800" fill="#2b2b2b">${pad(s)}</text>`;
  }).join('');
  area.innerHTML = `<div class="wheel-box"><div class="wheel-pointer">▼</div><svg class="wheel" id="dsWheel" viewBox="-104 -104 208 208"><g>${segs}</g><circle r="12" fill="#fff" stroke="#c9a24a" stroke-width="3"/></svg></div>`;
  const w = $('#dsWheel');
  const end = wheelTargetAngle(idx, n, 5, Math.random() - .5);
  w.dataset.target = String(end);
  const set = ms => { w.style.transition = ms ? `transform ${ms}ms cubic-bezier(.1,.65,.12,1)` : 'none'; w.style.transform = `rotate(${end}deg)`; };
  dsLater(() => set(3000), 60);
  drawAnim.finish = () => set(0);
}
// 🥚 扭蛋機：轉把手、扭蛋掉下來、打開
function animGacha(area, pick) {
  const colors = ['#ff8a8a', '#ffc46b', '#8ad7a8', '#7ad7ff', '#c9a6ff', '#ffb3d0'];
  const caps = Array.from({ length: 14 }, (_, i) => `<i style="left:${8 + (i * 37) % 78}%;top:${18 + (i * 23) % 56}%;background:${colors[i % colors.length]}"></i>`).join('');
  const col = colors[pick % colors.length];
  area.innerHTML = `<div class="gacha-box"><div class="g-dome">${caps}</div><div class="g-body"><div class="g-handle" id="gHandle"><span></span></div><div class="g-chute"></div></div>
    <div class="g-cap" id="gCap" style="--cap:${col}"><i class="top"></i><i class="bot"></i><b>${pad(pick)}</b></div></div>`;
  const dome = $('.g-dome', area), handle = $('#gHandle'), cap = $('#gCap');
  dsLater(() => { dome.classList.add('shake'); handle.classList.add('turn'); }, 60);
  dsLater(() => { beepTick(); cap.classList.add('drop'); }, 1400);
  dsLater(() => { cap.classList.add('center'); }, 2200);
  dsLater(() => { cap.classList.add('open'); }, 2800);
  drawAnim.finish = () => { dome.classList.remove('shake'); cap.classList.add('drop', 'center', 'open', 'instant'); };
}
// 🃏 翻牌：洗牌後翻開一張
function animCards(area, pick, pool) {
  const n = Math.min(pool.length, 7);
  const cards = drawExtras(pick, pool, n);
  area.innerHTML = `<div class="cards-box">${cards.map((s, i) => `<div class="dcard" data-i="${i}"${s === pick ? ' data-pick="1"' : ''}><div class="dcard-in"><div class="face back">🌿</div><div class="face front">${s === pick ? pad(s) : '？'}</div></div></div>`).join('')}</div>`;
  const els = $$('.dcard', area);
  const place = order => order.forEach((el, k) => { el.style.left = `calc(50% + ${(k - (n - 1) / 2) * 13}% - 6%)`; });
  let order = els.slice();
  place(order);
  [300, 700, 1100, 1500].forEach(ms => dsLater(() => { order = shuffled(order); place(order); beepTick(); }, ms));
  const pickEl = els.find(el => el.dataset.pick);
  dsLater(() => { els.forEach(el => { if (el !== pickEl) el.classList.add('fade'); }); pickEl.classList.add('chosen'); }, 2000);
  dsLater(() => pickEl.classList.add('flip'), 2450);
  drawAnim.finish = () => { els.forEach(el => { if (el !== pickEl) el.classList.add('fade'); }); pickEl.classList.add('chosen', 'flip', 'instant'); };
}
// 🐾 班寵抽號：班上的小動物跑來跑去，叼回號碼牌（emoji 臉朝左，往右跑時左右翻轉）
function animPet(area, pick, pool) {
  const n = Math.min(pool.length, 8);
  const signs = drawExtras(pick, pool, n);
  const xOf = i => 8 + (n === 1 ? 42 : i * (84 / (n - 1)));
  area.innerHTML = `<div class="pet-box"><div class="pet-grass"></div>${signs.map((s, i) => `<div class="pet-sign${s === pick ? ' target' : ''}" style="left:${xOf(i)}%"><b>${pad(s)}</b><i></i></div>`).join('')}
    <div class="pet-runner" id="petRunner" style="left:0%"><span class="pet-emo" id="petEmo">${petEmoji()}</span></div></div>`;
  const runner = $('#petRunner'), emo = $('#petEmo'), ti = signs.indexOf(pick), tx = xOf(ti);
  const sign = $('.pet-sign.target', area);
  let x = 0;
  const runTo = (nx, ms) => {
    emo.style.transform = nx > x ? 'scaleX(-1)' : 'scaleX(1)';   // 往右跑要翻轉
    runner.dataset.dir = nx > x ? 'right' : 'left';
    runner.style.transition = `left ${ms}ms ease-in-out`; runner.style.left = nx + '%'; x = nx;
  };
  runner.classList.add('run');
  dsLater(() => runTo(88, 850), 60);
  dsLater(() => runTo(6, 800), 950);
  dsLater(() => runTo(tx, 650), 1800);
  dsLater(() => { runner.classList.remove('run'); runner.classList.add('fetch'); sign.classList.add('picked'); beepTick(); }, 2500);
  drawAnim.finish = () => { runner.style.transition = 'none'; runner.style.left = tx + '%'; runner.classList.remove('run'); runner.classList.add('fetch'); sign.classList.add('picked'); };
}

/* ---------------- 音量偵測（含人聲雜音過濾） ---------------- */
let mic = null;
const VF = () => window.VoiceFilter;
$('#noiseThreshold').oninput = e => $('#noiseLine').style.left = e.target.value + '%';
$('#noiseFilter') && ($('#noiseFilter').onchange = e => { if (mic?.tracker) mic.tracker.setStrength(e.target.value); });
$('#noiseCalBtn') && ($('#noiseCalBtn').onclick = () => {
  if (!mic?.tracker) return toast('請先按「開始偵測」');
  mic.tracker.startCalibrate();
  toast('正在測 5 秒環境音，請保持安靜…', 5000);
});
function stopMic() {
  if (!mic) return;
  mic.stream.getTracks().forEach(t => t.stop());
  cancelAnimationFrame(mic.raf);
  clearTimeout(mic.timer);
  mic = null;
  $('#noiseBtn').textContent = '開始偵測';
  $('#noiseText').textContent = '已停止';
  $('#noiseBar').style.width = 0;
  $('#noiseRaw').textContent = '0';
  $('#noiseVoice').textContent = '0';
  const ig = $('#noiseIgnore'); if (ig) ig.style.display = 'none';
}
$('#noiseBtn').onclick = async () => {
  if (mic) { stopMic(); return; }
  try {
    ensureAudio();
    if (!VF()) throw new Error('VoiceFilter missing');
    // 盡量壓低系統 AGC／回音，讓咳嗽／掉筆的突發更明顯、也好過濾
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }
    });
    const sr = actx.sampleRate;
    const src = actx.createMediaStreamSource(stream);
    // 人聲帶：高通 ~250 Hz → 低通 ~3500 Hz，再送進 Analyser
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250; hp.Q.value = 0.707;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; lp.Q.value = 0.707;
    const anRaw = actx.createAnalyser(); anRaw.fftSize = 2048; anRaw.smoothingTimeConstant = 0.2;
    const anVoice = actx.createAnalyser(); anVoice.fftSize = 2048; anVoice.smoothingTimeConstant = 0.2;
    src.connect(anRaw);
    src.connect(hp); hp.connect(lp); lp.connect(anVoice);
    // 不接到 destination，避免回授嘯叫
    const rawBuf = new Float32Array(anRaw.fftSize);
    const voiceBuf = new Float32Array(anVoice.fftSize);
    // 給 VoiceFilter 用的降採樣緩衝（約 16k 等效，加速自相關）
    const workN = 1024;
    const work = new Float32Array(workN);
    const strength = $('#noiseFilter')?.value || 'std';
    const tracker = VF().createTracker(strength);
    mic = { stream, raf: 0, timer: 0, tracker, lastTs: 0 };
    $('#noiseBtn').textContent = '停止偵測';
    $('#noiseText').textContent = '偵測中…';

    // 約 25 fps 分析，避免平板過熱；畫面用 rAF 更新
    const analyse = () => {
      if (!mic) return;
      anRaw.getFloatTimeDomainData(rawBuf);
      anVoice.getFloatTimeDomainData(voiceBuf);
      // 從人聲帶訊號抽 1024 點（等間距）給分類器
      const step = Math.max(1, Math.floor(voiceBuf.length / workN));
      for (let i = 0, j = 0; i < workN; i++, j += step) work[i] = voiceBuf[j] || 0;
      // 取樣率依抽樣後等效
      const effSr = sr / step;
      const th = +$('#noiseThreshold').value;
      const st = tracker.process(work, effSr, Date.now(), th);
      mic.last = st;
      mic.timer = setTimeout(analyse, 40); // ~25 fps
    };
    const paint = () => {
      if (!mic) return;
      const st = mic.last;
      if (st) {
        const use = (st.strength === 'off') ? st.rawLevel : st.voiceLevel;
        $('#noiseBar').style.width = use + '%';
        $('#noiseRaw').textContent = Math.round(st.rawLevel);
        $('#noiseVoice').textContent = Math.round(st.voiceLevel);
        const ig = $('#noiseIgnore');
        if (ig) {
          if (st.ignore) { ig.textContent = '已忽略：' + st.ignore; ig.style.display = ''; }
          else if (st.calibrating) { ig.textContent = '安靜校正中…'; ig.style.display = ''; }
          else { ig.style.display = 'none'; }
        }
        const [f, t] = st.loud > 40 ? ['😣', '太吵了！請降低音量']
          : use > (+$('#noiseThreshold').value) * .8 ? ['😐', '有點吵喔']
          : ['😊', '很安靜，很棒！'];
        $('#noiseFace').textContent = f;
        $('#noiseText').textContent = st.calibrating ? '安靜校正中，請保持安靜…' : t;
        $('#noiseText').style.color = st.loud > 40 ? 'var(--danger)' : '';
      }
      mic.raf = requestAnimationFrame(paint);
    };
    analyse();
    paint();
  } catch (e) {
    console.warn(e);
    toast('無法使用麥克風：請允許瀏覽器使用麥克風');
  }
};

/* ---------------- 全班夥伴 ---------------- */
function renderStudents() {
  $('#studentGrid').innerHTML = activeSeats().map(n => {
    const s = fixStudentBook({ coins: 0, nextAt: 10, species: [], ...(state.students[n] || {}) });
    const prog = 100 - (s.nextAt - s.earned) * 10;
    return `<button class="s-card" data-seat="${n}">
      <div class="s-top"><div class="s-no">${pad(n)}</div><div><div class="s-name">${esc(nameOf(n)) || n + ' 號'}</div><div class="s-coin">$ ${s.coins} 金幣・${s.species.length} 種${s.spent ? `<span class="s-spent">・已兌換 ${s.spent}</span>` : ''}</div></div></div>
      <div class="s-sp">${s.species.map(id => spById(id)?.emoji || '').join('') || '<small style="color:var(--muted);font-size:13px">還沒有發現物種</small>'}</div>
      <div class="s-next">再 ${Math.max(0, s.nextAt - s.earned)} 金幣發現新物種・點我看📒金幣紀錄</div>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, prog))}%"></i></div>
    </button>`;
  }).join('');
}
/* ---------------- 金幣存摺（v1.13.0） ----------------
 * 餘額 coins ＝ 累計獲得 earned − 已兌換 spent。
 *   earned：所有加分減掉扣分／取消打卡（不含兌換）。物種進度看 earned，所以兌換獎品不會讓進度倒退，也不會讓班級山林變小。
 * 每一班各自保存（跟著換班級、包含在備份裡、開始新學年清空）：
 *   redemptions 兌換紀錄（永久保留；撤銷只標記「已撤銷」並退回金幣）
 *   coinManual  老師加扣分（永久保留）
 *   coinDaily   每天自動得到的金幣合計 { 'YYYY-MM-DD': { 座號: { h: 作業, k: 任務 } } }（逐筆太多，改存每天合計）
 * 所有班級共用：prizes 獎品清單 [{ id, name, cost }]
 * 查看金幣存摺不需要密碼；兌換、撤銷要教師密碼。
 */
const COIN_KIND_LABEL = { hw: '作業', task: '任務', manual: '老師', redeem: '兌換', legacy: '舊版' };
function fixStudentBook(s) {
  if (!s || typeof s !== 'object') return s;
  s.coins = Math.max(0, Math.round(Number(s.coins) || 0));
  if (typeof s.spent !== 'number' || !isFinite(s.spent) || s.spent < 0) s.spent = 0;
  if (typeof s.earned !== 'number' || !isFinite(s.earned)) {
    // 舊資料（v1.12 以前）：目前的金幣當作累計獲得，並記下來在存摺裡顯示一行「v1.13.0 以前的金幣」
    if (s.coins > 0 && s.legacy === undefined) s.legacy = s.coins;
  }
  s.earned = s.coins + s.spent;   // 一律維持 餘額 ＝ 累計獲得 − 已兌換
  if (!Array.isArray(s.species)) s.species = [];
  if (!(Number(s.nextAt) > 0)) s.nextAt = 10;
  return s;
}
function normalizePrizes(list) {
  return (Array.isArray(list) ? list : [])
    .filter(p => p && String(p.name || '').trim() && Math.round(Number(p.cost)) >= 1)
    .map(p => ({ id: String(p.id || 'p' + uid()), name: String(p.name).trim().slice(0, 40), cost: Math.min(9999, Math.round(Number(p.cost))) }));
}
function fixClassBook(d) {
  if (!d || typeof d !== 'object') return d;
  d.redemptions = (Array.isArray(d.redemptions) ? d.redemptions : [])
    .filter(r => r && Number(r.seat) > 0 && Number(r.cost) > 0)
    .map(r => ({ ...r, seat: Number(r.seat), cost: Math.round(Number(r.cost)), name: String(r.name || '獎品'), id: String(r.id || 'r' + uid()), t: Number(r.t) || 0 }));
  d.coinManual = (Array.isArray(d.coinManual) ? d.coinManual : []).filter(m => m && Number(m.seat) > 0 && Number(m.delta));
  if (!d.coinDaily || typeof d.coinDaily !== 'object' || Array.isArray(d.coinDaily)) d.coinDaily = {};
  if (d.students && typeof d.students === 'object') Object.values(d.students).forEach(fixStudentBook);
  return d;
}
// 把每一筆金幣變動記進存摺（addCoins 會呼叫）
function recordCoin(seat, delta, reason, kind) {
  if (!delta) return;
  if (kind === 'hw' || kind === 'task') {
    const day = (state.coinDaily[dateKey()] ||= {});
    const r = (day[seat] ||= {});
    const k = kind === 'hw' ? 'h' : 'k';
    r[k] = (r[k] || 0) + delta;
    if (!r[k]) delete r[k];
    if (!Object.keys(r).length) delete day[seat];
  } else {
    state.coinManual.push({ t: Date.now(), seat, delta, reason: String(reason || (delta > 0 ? '老師加分' : '老師扣分')) });
  }
}
const seatWho = n => `${pad(n)} 號${nameOf(n) ? ' ' + nameOf(n) : ''}`;
// 兌換：先檢查餘額，不夠就擋下來並說明還差多少
function redeemCoins(seat, name, cost, prizeId = '') {
  seat = Number(seat); name = String(name || '').trim(); cost = Math.round(Number(cost));
  if (!activeSeats().includes(seat)) return { ok: false, msg: '請先選擇座號' };
  if (!name) return { ok: false, msg: '請輸入獎品名稱' };
  if (!(cost >= 1)) return { ok: false, msg: '金幣數請填 1 以上的整數' };
  const s = fixStudentBook(stu(seat));
  if (s.coins < cost) return { ok: false, msg: `金幣不夠，不能兌換：${seatWho(seat)} 目前只有 ${s.coins} 金幣，「${name}」要 ${cost} 金幣（還差 ${cost - s.coins} 金幣）` };
  s.coins -= cost; s.spent += cost;
  const r = { id: 'r' + uid(), t: Date.now(), seat, name, cost };
  if (prizeId) r.prizeId = prizeId;
  state.redemptions.unshift(r);
  state.log.unshift({ t: r.t, seat, delta: -cost, reason: '🎁 兌換：' + name });
  state.log.length = Math.min(state.log.length, 300);
  return { ok: true, rec: r };
}
// 撤銷兌換：退回金幣，紀錄保留並標上「已撤銷」
function undoRedemption(id) {
  const r = state.redemptions.find(x => x.id === id);
  if (!r || r.undone) return { ok: false, msg: '找不到這筆兌換，或已經撤銷過了' };
  const s = fixStudentBook(stu(r.seat));
  s.coins += r.cost; s.spent = Math.max(0, s.spent - r.cost);
  r.undone = Date.now();
  state.log.unshift({ t: r.undone, seat: r.seat, delta: r.cost, reason: '↩️ 撤銷兌換：' + r.name });
  state.log.length = Math.min(state.log.length, 300);
  return { ok: true, rec: r };
}
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dk0 = t => dateKey(new Date(t));
// 某位學生的存摺（新的在上面）
function coinRecord(seat) {
  seat = Number(seat);
  const rows = [];
  Object.entries(state.coinDaily || {}).forEach(([d, day]) => {
    const r = day && day[seat]; if (!r) return;
    if (r.h) rows.push({ date: d, time: '', kind: 'hw', text: '作業完成（當天合計）', delta: r.h });
    if (r.k) rows.push({ date: d, time: '', kind: 'task', text: '每日任務（當天合計）', delta: r.k });
  });
  (state.coinManual || []).filter(m => m.seat === seat).forEach(m => rows.push({ date: dk0(m.t), time: hm(m.t), t: m.t, kind: 'manual', text: m.reason, delta: m.delta }));
  (state.redemptions || []).filter(r => r.seat === seat).forEach(r => rows.push({ date: dk0(r.t), time: hm(r.t), t: r.t, kind: 'redeem', text: '🎁 兌換：' + r.name + (r.undone ? `（已撤銷，${dk0(r.undone).slice(5).replace('-', '/')} 退回金幣）` : ''), delta: -r.cost, undone: !!r.undone, id: r.id }));
  rows.sort((a, b) => (b.date + (b.time || '99:99')).localeCompare(a.date + (a.time || '99:99')) || (b.t || 0) - (a.t || 0));
  const s = state.students[seat];
  if (s && s.legacy > 0) rows.push({ date: '', time: '', kind: 'legacy', text: 'v1.13.0 以前累積的金幣（舊版沒有逐筆紀錄）', delta: s.legacy });
  return rows;
}
function coinSummary(seat) {
  const s = fixStudentBook(state.students[seat] ? state.students[seat] : { coins: 0, nextAt: 10, species: [] });
  return { coins: s.coins, earned: s.earned, spent: s.spent };
}
const fmtDelta = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
const rowDate = r => r.date ? r.date.slice(5).replace('-', '/') + (r.time ? ' ' + r.time : '') : '—';
function coinRecordText(seat) {
  const c = coinSummary(seat);
  const head = `${state.settings.className || ''} ${seatWho(seat)} 金幣存摺（${dateKey()}）\n餘額 ${c.coins}｜累計獲得 ${c.earned}｜已兌換 ${c.spent}\n`;
  return head + coinRecord(seat).map(r => `${r.date || '—'} ${r.time || ''}\t${COIN_KIND_LABEL[r.kind]}\t${r.text}\t${r.undone ? '（0）' : fmtDelta(r.delta)}`).join('\n');
}
function coinRecordCSV(seat) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const c = coinSummary(seat);
  const lines = [['班級', '座號', '姓名', '餘額', '累計獲得', '已兌換'].join(','), [state.settings.className, seat, nameOf(seat), c.coins, c.earned, c.spent].map(q).join(','), '',
    ['日期', '時間', '類別', '說明', '金幣', '已撤銷'].join(',')];
  coinRecord(seat).forEach(r => lines.push([r.date, r.time, COIN_KIND_LABEL[r.kind], r.text, r.delta, r.undone ? '是' : ''].map(q).join(',')));
  return '\ufeff' + lines.join('\r\n');
}
function coinRowHTML(r, canUndo = true) {
  return `<div class="cb-row kind-${r.kind}${r.undone ? ' undone' : ''}"><span class="d">${rowDate(r)}</span><span class="k">${COIN_KIND_LABEL[r.kind]}</span><span class="t">${esc(r.text)}</span><b class="v ${r.delta > 0 ? 'up' : 'down'}">${fmtDelta(r.delta)}</b>${r.kind === 'redeem' && !r.undone && canUndo ? `<button type="button" class="btn cb-undo" data-undo="${esc(r.id)}">撤銷</button>` : ''}</div>`;
}
function needTeacher(after) {
  if (isAuthed()) { after(); return true; }
  _afterUnlock = after; teacherOpen('unlock'); return false;
}
// 全班夥伴 → 點學生卡片：金幣存摺（不需要密碼）
function openCoinBook(n, tab = 'log') {
  n = Number(n);
  const s = state.students[n] || { coins: 0, species: [] };
  const c = coinSummary(n);
  const rows = coinRecord(n);
  openModal(`<button class="close" data-close>✕</button>
    <h2>${pad(n)} 號 ${esc(nameOf(n))} <small class="cls-subj">金幣存摺</small></h2>
    <div class="cb-stats"><div><small>💰 餘額</small><b id="cbBal">${c.coins}</b></div><div><small>📈 累計獲得</small><b>${c.earned}</b></div><div><small>🎁 已兌換</small><b>${c.spent}</b></div></div>
    <p class="sub">餘額 ＝ 累計獲得 − 已兌換。兌換獎品不會讓物種進度和班級山林倒退。</p>
    <div class="btn-row cb-actions"><button type="button" class="primary" id="cbRedeem">🎁 兌換獎品</button><button type="button" class="btn" id="cbCopy">📋 複製紀錄</button><button type="button" class="btn" id="cbCsv">⬇️ 下載 CSV</button></div>
    <div class="cb-tabs" id="cbTabs"><button type="button" data-cb="log" class="${tab === 'log' ? 'active' : ''}">📒 金幣紀錄</button><button type="button" data-cb="dex" class="${tab === 'dex' ? 'active' : ''}">🌿 已發現物種（${s.species.length} / ${SP.length}）</button></div>
    <div id="cbLog" class="cb-log" style="display:${tab === 'log' ? '' : 'none'}">${rows.map(r => coinRowHTML(r)).join('') || '<div class="empty">還沒有金幣紀錄。完成作業、每日任務就會得到金幣喔！</div>'}</div>
    <div id="cbDex" class="dex-grid" style="display:${tab === 'dex' ? '' : 'none'}">${s.species.map(id => dexCard(spById(id), true)).join('') || '<div class="empty">完成任務累積金幣，就能發現新物種喔！</div>'}</div>
    <textarea id="cbTa" class="cb-ta" readonly aria-hidden="true" tabindex="-1"></textarea>`, { wide: true });
  $('#cbTabs').onclick = e => {
    const b = e.target.closest('[data-cb]'); if (!b) return;
    $$('#cbTabs [data-cb]').forEach(x => x.classList.toggle('active', x === b));
    $('#cbLog').style.display = b.dataset.cb === 'log' ? '' : 'none';
    $('#cbDex').style.display = b.dataset.cb === 'dex' ? '' : 'none';
  };
  $('#cbRedeem').onclick = () => needTeacher(() => openRedeem(n));
  $('#cbCopy').onclick = async () => {
    const t = coinRecordText(n); $('#cbTa').value = t;
    toast(await copyText(t, $('#cbTa')) ? '✅ 已複製金幣紀錄，可以貼到 Word、Excel 或聯絡簿' : '⚠️ 這個瀏覽器不讓複製，請改用「⬇️ 下載 CSV」', 3500);
  };
  $('#cbCsv').onclick = () => {
    const ok = downloadText(coinRecordCSV(n), `金幣存摺_${state.settings.className || '班級'}_${pad(n)}號_${dateKey()}.csv`, 'text/csv;charset=utf-8');
    toast(ok ? '⬇️ 已下載 CSV（可用 Excel 打開）；嵌在協作平台裡沒看到檔案時，請改用「📋 複製紀錄」' : '⚠️ 下載失敗，請改用「📋 複製紀錄」', 4000);
  };
  $('#cbLog').onclick = e => {
    const b = e.target.closest('[data-undo]'); if (!b) return;
    needTeacher(() => confirmUndo(b.dataset.undo, () => openCoinBook(n)));
  };
}
function confirmUndo(id, back) {
  const r = state.redemptions.find(x => x.id === id); if (!r) return;
  askConfirm(`確定撤銷 ${seatWho(r.seat)} 兌換「${r.name}」？會退回 ${r.cost} 金幣，這筆紀錄會保留並標上「已撤銷」。`, '撤銷並退回金幣').then(ok => {
    if (!ok) return back && back();
    const res = undoRedemption(id);
    if (!res.ok) { toast(res.msg); return back && back(); }
    save(); renderAll();
    toast(`↩️ 已撤銷，${seatWho(r.seat)} 退回 ${r.cost} 金幣`);
    back && back();
  });
}
// 兌換畫面（彈出視窗與控制台共用）
function redeemPanelHTML(n) {
  const bal = n ? coinSummary(n).coins : 0;
  const prizes = state.prizes || [];
  return `<p class="sub rd-who">${n ? `${esc(seatWho(n))}・目前 <b>${bal}</b> 金幣` : '請先選座號'}</p>
    <h4 class="rd-h">從獎品清單選</h4>
    <div class="prize-grid">${prizes.length ? prizes.map(p => `<button type="button" class="prize${n && p.cost > bal ? ' short' : ''}" data-prize="${esc(p.id)}"><b>${esc(p.name)}</b><small>${p.cost} 金幣</small></button>`).join('') : '<div class="empty">還沒有獎品清單。可以在下面直接輸入，或到「教師控制台 → 加扣金幣／兌換 → 🏷️ 獎品清單」新增。</div>'}</div>
    <h4 class="rd-h">或直接輸入</h4>
    <div class="rd-free"><input class="mini-input rd-name" maxlength="40" placeholder="獎品名稱，例如：換座位一天"><input class="mini-input rd-cost" type="number" min="1" step="1" inputmode="numeric" placeholder="金幣"><button type="button" class="primary rd-go">🎁 兌換</button></div>
    <div class="err rd-err"></div>`;
}
function bindRedeemPanel(root, n, done) {
  const err = $('.rd-err', root);
  const go = (name, cost, prizeId) => {
    if (!n) { err.textContent = '請先選座號'; return; }
    const bal = coinSummary(n).coins; cost = Math.round(Number(cost)); name = String(name || '').trim();
    if (!name) { err.textContent = '請輸入獎品名稱'; return; }
    if (!(cost >= 1)) { err.textContent = '金幣數請填 1 以上的整數'; return; }
    if (bal < cost) { err.textContent = `金幣不夠，不能兌換：${seatWho(n)} 目前只有 ${bal} 金幣，「${name}」要 ${cost} 金幣（還差 ${cost - bal} 金幣）`; toast('⚠️ 金幣不夠，不能兌換'); return; }
    err.textContent = '';
    askConfirm(`確定讓 ${seatWho(n)} 用 ${cost} 金幣兌換「${name}」？兌換後剩 ${bal - cost} 金幣。`, '確定兌換').then(ok => {
      if (!ok) return;
      const res = redeemCoins(n, name, cost, prizeId);
      if (!res.ok) { err.textContent = res.msg; return; }
      save(); renderAll(); ensureAudio(); chime();
      toast(`🎁 ${seatWho(n)} 兌換「${name}」，扣 ${cost} 金幣，剩 ${coinSummary(n).coins} 金幣`, 3500);
      done && done(res.rec);
    });
  };
  root.onclick = e => {
    const p = e.target.closest('[data-prize]');
    if (p) { const pr = (state.prizes || []).find(x => x.id === p.dataset.prize); if (pr) go(pr.name, pr.cost, pr.id); return; }
    if (e.target.closest('.rd-go')) go($('.rd-name', root).value, $('.rd-cost', root).value, '');
  };
}
function openRedeem(n) {
  openModal(`<button class="close" data-close>✕</button>
    <h2>🎁 兌換獎品</h2>
    <div id="rdBox">${redeemPanelHTML(n)}</div>
    <div class="modal-actions"><button type="button" class="btn" id="rdBack">← 回到金幣存摺</button></div>`);
  bindRedeemPanel($('#rdBox'), n, () => openCoinBook(n));
  $('#rdBack').onclick = () => openCoinBook(n);
}
$('#studentGrid').addEventListener('click', e => {
  const c = e.target.closest('.s-card'); if (!c) return;
  openCoinBook(+c.dataset.seat);
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
    const r = todayRate(dateKey(d)), off = isOffDay(d) && !r;
    return `<div class="wc${off ? ' hol' : ''}"${off ? ` title="${esc(dayInfo(d).name)}"` : ''}><b>${off ? '🎌' : r + '%'}</b><i style="height:${Math.max(r, 1) * .8}%"></i><span>${d.getMonth() + 1}/${d.getDate()}<br>週${WEEK[d.getDay()]}</span></div>`;
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
// 第一次設定：先選身分（導師一個班／科任老師多個班）
function openSetup(role) {
  if (role === 'multi') return openSetupMulti();
  if (role !== 'single') {
    openModal(`
      <h2>🌄 歡迎使用班級儀表板</h2>
      <p class="sub">請先選擇你的身分。之後也可以在「教師控制台 → 班級管理」修改。</p>
      <div class="role-pick">
        <button type="button" class="role-card" data-role="single"><span class="rc-ico">👩‍🏫</span><b>導師（一個班）</b><small>只帶一個班級，例如：六年甲班</small></button>
        <button type="button" class="role-card" data-role="multi"><span class="rc-ico">🧑‍🔬</span><b>科任老師（多個班）</b><small>教好幾個班，例如：六甲自然、五乙自然、四甲自然</small></button>
      </div>`);
    $$('#modalCard .role-card').forEach(b => b.onclick = () => openSetup(b.dataset.role));
    return;
  }
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
    <div class="modal-actions" style="justify-content:space-between"><button type="button" class="btn" id="sBack">← 重新選擇身分</button><button class="primary" id="sGo">開始使用</button></div>`);
  $('#sBack').onclick = () => openSetup();
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
    const oldSchool = s.school, oldClass = s.className;
    Object.assign(s, {
      school: $('#sSchool').value.trim(), className: $('#sClass').value.trim(), schoolYear: $('#sYear').value.trim(), semester: $('#sSem').value,
      maxSeat: max, vacant: parseVacant($('#sVac').value).filter(n => n <= max), pwHash: await hashPw(pw), setupDone: true, mode: 'single', seenVersion: APP_VERSION
    });
    refreshDefaultAnnouncement(s, oldSchool, oldClass);
    setAuth();
    save(); closeModal(); renderAll(); toast('✅ 設定完成！');
  };
}
// 科任老師：一次加入好幾個班，每班有自己的座號名單
function openSetupMulti() {
  const s = state.settings;
  let rows = [{ name: '', subject: '', max: 20, vac: '' }, { name: '', subject: '', max: 20, vac: '' }];
  openModal(`
    <h2>🧑‍🔬 科任老師設定</h2>
    <p class="sub">把你教的班級一班一班加進來。每一班有自己的學生名單、金幣、作業與聯絡簿，彼此不會混在一起。學生姓名之後可以到「教師控制台 → 座號與名單」填寫。</p>
    <div class="field"><span>學校名稱</span><input id="sSchool" value="${esc(s.school)}"></div>
    ${termFields(s, 's')}
    <div class="setup-cls-head"><span>班級名稱</span><span>科目（選填）</span><span>最大座號</span><span>空號</span><span></span></div>
    <div id="suRows" class="setup-cls-rows"></div>
    <div class="btn-row" style="justify-content:flex-start;margin:8px 0 14px"><button type="button" class="btn" id="suAdd">＋ 再加一班</button></div>
    <div class="row2">
      <div class="field"><span>設定教師後台密碼（至少 4 碼）</span><input id="sPw" type="password" autocomplete="new-password"></div>
      <div class="field"><span>再輸入一次密碼</span><input id="sPw2" type="password" autocomplete="new-password"></div>
    </div>
    <div class="err" id="sErr"></div>
    <div class="modal-actions" style="justify-content:space-between"><button type="button" class="btn" id="sBack">← 重新選擇身分</button><button class="primary" id="sGo">開始使用</button></div>`, { wide: true });
  const ph = ['六甲', '五乙', '四甲', '三甲', '二甲', '一甲'];
  const sync = () => { rows = $$('#suRows .setup-cls-row').map(r => ({ name: $('[data-k=name]', r).value, subject: $('[data-k=subject]', r).value, max: $('[data-k=max]', r).value, vac: $('[data-k=vac]', r).value })); };
  const draw = () => {
    $('#suRows').innerHTML = rows.map((r, i) => `<div class="setup-cls-row" data-i="${i}">
      <input data-k="name" value="${esc(r.name)}" placeholder="例如：${ph[i % ph.length]}" maxlength="20">
      <input data-k="subject" value="${esc(r.subject)}" placeholder="例如：自然" list="suSubj" maxlength="20">
      <input data-k="max" type="number" min="1" max="60" value="${esc(r.max)}">
      <input data-k="vac" value="${esc(r.vac)}" placeholder="例如：7、15">
      <button type="button" data-del="${i}" title="刪除這一列">✕</button></div>`).join('') + `<datalist id="suSubj">${SUBJECTS.map(x => `<option value="${x}">`).join('')}</datalist>`;
  };
  draw();
  $('#suAdd').onclick = () => { sync(); const last = rows[rows.length - 1] || {}; rows.push({ name: '', subject: last.subject || '', max: last.max || 20, vac: '' }); draw(); };
  $('#suRows').onclick = e => { const d = e.target.closest('[data-del]'); if (!d) return; sync(); if (rows.length > 1) rows.splice(+d.dataset.del, 1); draw(); };
  $('#sBack').onclick = () => openSetup();
  $('#sGo').onclick = async () => {
    sync();
    const list = rows.filter(r => r.name.trim());
    const pw = $('#sPw').value;
    if (!list.length) return $('#sErr').textContent = '請至少輸入一個班級名稱';
    const bad = list.find(r => !(+r.max >= 1 && +r.max <= 60));
    if (bad) return $('#sErr').textContent = `「${bad.name.trim()}」的最大座號請填 1～60`;
    if (pw.length < 4) return $('#sErr').textContent = '密碼至少 4 碼';
    if (pw !== $('#sPw2').value) return $('#sErr').textContent = '兩次密碼不一樣';
    const pwHash = await hashPw(pw);
    setupMultiClasses(list.map(r => ({ name: r.name.trim(), subject: r.subject.trim(), maxSeat: +r.max, vacant: parseVacant(r.vac).filter(n => n <= +r.max) })));
    Object.assign(s, { school: $('#sSchool').value.trim(), schoolYear: $('#sYear').value.trim(), semester: $('#sSem').value, pwHash, setupDone: true, seenVersion: APP_VERSION });
    // 每一班都用「歡迎蒞臨＋校名」，畫面上會自動接上各班自己的班名
    s.announcement = defaultAnnouncement(s.school);
    classList().forEach(c => { if (c.data && c.data.settings && !String(c.data.settings.announcement || '').trim()) c.data.settings.announcement = defaultAnnouncement(s.school); });
    setAuth();
    save(); closeModal(); renderAll();
    toast(`✅ 設定完成！共 ${list.length} 個班級。到「教師控制台 → 週課表」標記每一節是哪一班，上課時就會自動換班。`, 6000);
  };
}
// 依清單建立班級；第一班成為目前班級
function setupMultiClasses(list) {
  const tasks = clone(state.taskDefs);
  const classes = list.map(r => ({ id: 'c' + uid(), name: r.name, subject: r.subject || '', data: freshClassData(r.name, { maxSeat: r.maxSeat, vacant: r.vacant, taskDefs: tasks }) }));
  putClassData(state, classes[0].data);
  classes[0].data = null;
  state.settings.className = classes[0].name;
  state.classes = classes;
  state.curClass = classes[0].id;
  state.settings.mode = 'multi';
  state.settings.autoSwitch = true;
  drawnBy = {}; drawn = []; weekDraft = null; autoKey = null;
  return classes;
}

/* ---------------- 教師登入 ---------------- */
$('#consoleBtn').onclick = () => teacherOpen();
$('#announceBox').onclick = () => teacherOpen('basic', '#bAnn');
function teacherOpen(tab, focusSel) {
  const go = () => {
    if (tab === 'unlock') {
      const fn = _afterUnlock; _afterUnlock = null;
      closeModal();
      if (fn) fn();
      else toast('🔓 已解鎖，可以編輯聯絡簿與倒數日（閒置 5 分鐘自動上鎖）', 3000);
      return;
    }
    openConsole(tab); if (focusSel) setTimeout(() => { const f = $(focusSel); if (f) { f.focus(); f.select?.(); } }, 80); };
  if (!state.settings.setupDone) return openSetup();
  if (isAuthed()) return go();
  openModal(`<button class="close" data-close>✕</button>
    <h2>🔒 教師控制台</h2><p class="sub">請輸入教師密碼</p>
    <form id="loginForm"><div class="field"><input id="lPw" type="password" autofocus autocomplete="current-password"></div>
    <div class="err" id="lErr"></div>
    <div class="modal-actions"><button class="primary" type="submit">登入</button></div></form>
    <p class="sub" style="margin-top:14px;font-size:12px">忘記密碼？只能在「這台電腦的瀏覽器」清除網站資料後重新設定（會清空班級資料，建議平時先匯出備份）。</p>`, { onClose: () => { _afterUnlock = null; } });
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
  const tabs = [['basic', '基本資料'], ['classes', '班級管理'], ['seats', '座號與名單'], ['timetable', '週課表'], ['schedule', '作息時間'], ['holiday', '🎌 假日'], ['scal', '📅 學校行事曆'], ['tasks', '每日任務'], ['points', '加扣金幣／兌換'], ['apps', '🧩 應用中心'], ['data', '資料管理'], ['notes', '📜 更新紀錄']];
  openModal(`<button class="close" data-close>✕</button>
    <h2>🛠️ 教師控制台</h2><p class="sub">TEACHER CONSOLE・修改後按「儲存」立即生效</p>
    ${isMulti() && classList().length > 1 ? `<div class="ct-class"><span>目前班級</span><select id="ctClassSel">${classList().map(c => `<option value="${esc(c.id)}"${c.id === state.curClass ? ' selected' : ''}>${esc(classLabel(c))}</option>`).join('')}</select><small>名單、公告、每日任務、加扣金幣都是改這一班</small></div>` : ''}
    <div class="console-tabs">${tabs.map(([k, v]) => `<button data-ct="${k}" class="${k === consoleTab ? 'active' : ''}">${v}</button>`).join('')}</div>
    <div id="ctBody"></div>`, { wide: true });
  $$('[data-ct]').forEach(b => b.onclick = () => openConsole(b.dataset.ct));
  const sel = $('#ctClassSel');
  if (sel) sel.onchange = () => { switchClass(sel.value); openConsole(consoleTab); };
  ({ basic: ctBasic, classes: ctClasses, seats: ctSeats, timetable: ctTimetable, schedule: ctSchedule, holiday: ctHoliday, scal: ctSchoolCal, tasks: ctTasks, points: ctPoints, apps: ctApps, data: ctData, notes: ctNotes })[consoleTab]($('#ctBody'));
}

function ctBasic(el) {
  const s = state.settings;
  const L = s.loc;
  el.innerHTML = `
    <div class="field"><span>📢 跑馬燈公告（可以輸入多則，一行一則，會在畫面左上角輪流捲動）${isMulti() ? `<b class="cls-note">只顯示在「${esc(classLabel(curClassObj()))}」</b>` : ''}</span>
      <textarea id="bAnn" placeholder="例如：明天穿運動服&#10;星期五校外教學，記得帶水壺">${esc(s.announcement)}</textarea></div>
    <label class="chk" style="margin:-4px 0 14px;font-size:14px"><input type="checkbox" id="bStuEdit" ${s.studentEdit ? 'checked' : ''}> 允許不輸入密碼就新增／刪除聯絡簿、倒數日（不勾選比較安全，學生無法亂寫）</label>
    <div class="scal-box" id="bScal"></div>
    <div class="field"><span>學校名稱</span><input id="bSchool" value="${esc(s.school)}"></div>
    <div class="field"><span>${isMulti() ? '目前班級名稱（其他班請到「班級管理」改）' : '班級名稱'}</span><input id="bClass" value="${esc(s.className)}"></div>
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
    <h4 style="margin:8px 0 10px">📝 監考看板</h4>
    <div class="field"><span>監考看板網址（按底部「📝 監考」打開；只能用 https:// 開頭的網址，所有班級共用）</span>
      <div class="exam-url-row"><input id="bExamUrl" type="url" value="${esc(s.examUrl || DEFAULT_EXAM_URL)}" placeholder="${esc(DEFAULT_EXAM_URL)}" autocomplete="off"><button type="button" class="btn" id="bExamReset">恢復預設網址</button></div></div>
    <label class="chk" style="margin:-4px 0 6px;font-size:14px"><input type="checkbox" id="bExamBtn" ${s.examBtn !== false ? 'checked' : ''}> 在最下面一排顯示「📝 監考」按鈕（📌 釘選）</label>
    <p class="sub" style="margin:0 0 14px;font-size:12px">監考是「🧩 應用中心」的第一個內建應用；其他教學網站可以到「教師控制台 → 🧩 應用中心」新增。</p>
    <h4 style="margin:8px 0 10px">🎬 動畫效果</h4>
    <div class="row2">
      <div class="field"><span>倒數計時的畫面</span><select id="bTimerStyle">
        <option value="island"${s.timerStyle !== 'simple' && s.timerStyle !== 'wheel' ? ' selected' : ''}>🏝️ 3D 島嶼（預設）</option>
        <option value="wheel"${s.timerStyle === 'wheel' ? ' selected' : ''}>🎡 彩色轉盤（知心陪你倒數）</option>
        <option value="simple"${s.timerStyle === 'simple' ? ' selected' : ''}>簡潔（只有數字，舊平板比較順）</option></select></div>
      <div class="field"><span>抽號動畫</span><select id="bDrawAnim">
        <option value="random"${!s.drawAnim || s.drawAnim === 'random' ? ' selected' : ''}>每次隨機（預設）</option>
        ${DRAW_STYLE_KEYS.map(k => `<option value="${k}"${s.drawAnim === k ? ' selected' : ''}>${DRAW_STYLES[k].icon} ${DRAW_STYLES[k].name}</option>`).join('')}
        <option value="off"${s.drawAnim === 'off' ? ' selected' : ''}>關閉動畫（只跳數字）</option></select></div>
    </div>
    <div class="whl-set" id="bWhlSet">
      <img class="whl-set-pv" id="bWhlPreview" src="${esc(whlCharSrc())}" alt="轉盤中間的角色">
      <div class="whl-set-info"><b>🎡 彩色轉盤中間的角色</b><small id="bWhlState">${esc(whlCharStateText())}</small>
        <div class="whl-set-btns"><button type="button" class="btn" id="bWhlUp">🖼️ 換成自己的圖片</button><button type="button" class="btn" id="bWhlReset">↩️ 恢復知心</button></div>
        <small>建議用去背的 PNG，人物在中間；會自動縮小，只存在這台電腦的瀏覽器裡（不在備份檔裡）。</small></div>
      <input type="file" id="bWhlFile" accept="image/*" style="display:none">
    </div>
    <div class="whl-set dm-set" id="bDmSet">
      <div class="whl-set-info"><b>🎵 跳舞音樂</b>
        <label class="chk" style="font-size:14px"><input type="checkbox" id="bDmOn" ${s.danceMusic !== false ? 'checked' : ''}> 彩色轉盤計時中播放跳舞音樂（重複播放；暫停時停住，時間到先停音樂再響鈴）</label>
        <div class="dm-vol"><span>音量</span><input type="range" id="bDmVol" min="0" max="100" step="5" value="${Number(s.danceMusicVol ?? 60)}" aria-label="跳舞音樂音量"><b id="bDmVolV">${Number(s.danceMusicVol ?? 60)}%</b><button type="button" class="btn" id="bDmTry">▶ 試聽</button></div>
        <small>改了馬上生效（不用按儲存）。播放時會先關掉環境音、暫停「我的音樂」，停下來後再恢復。計時器下面的 🎵 按鈕也可以快速開關。</small></div>
    </div>
    <div class="err" id="bErr"></div>
    <div class="modal-actions"><button class="primary" id="bSave">儲存</button></div>`;
  scalMount($('#bScal'), 'b');
  $('#bWhlUp').onclick = () => $('#bWhlFile').click();
  $('#bDmOn').onchange = e => dmToggle(e.target.checked);
  $('#bDmVol').oninput = e => { dmSetVol(e.target.value); $('#bDmVolV').textContent = state.settings.danceMusicVol + '%'; };
  $('#bDmTry').onclick = () => dmPreview();
  $('#bWhlFile').onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { await setWheelChar(await whlShrinkImage(f)); toast('✅ 轉盤中間換成您的圖片了'); }
    catch (err) { toast('⚠️ ' + (err && err.message || '圖片沒有換成功'), 4000); }
  };
  $('#bWhlReset').onclick = async () => {
    if (state.settings.timerChar !== 'custom') return toast('現在就是知心');
    if (!(await askConfirm('確定換回知心？您上傳的圖片會從這台電腦刪除。', '換回知心'))) return;
    await resetWheelChar(); toast('↩️ 已換回知心');
  };
  $('#bExamReset').onclick = () => { $('#bExamUrl').value = DEFAULT_EXAM_URL; toast('已填回預設網址，按「儲存」才會生效'); };
  $('#bSrc').onchange = e => { $('#bCwa').classList.toggle('hidden', e.target.value !== 'cwa'); $('#bOm').classList.toggle('hidden', e.target.value === 'cwa'); };
  $('#bSave').onclick = async () => {
    const ex = parseExamUrl($('#bExamUrl').value);
    if (!ex.ok) {
      $('#bErr').style.color = '';
      $('#bErr').textContent = ex.reason === 'empty' ? '⚠️ 請填監考看板網址，或按「恢復預設網址」'
        : ex.reason === 'scheme' ? '⚠️ 監考看板網址要用 https:// 開頭（安全連線）' : '⚠️ 監考看板網址格式不對，請確認有沒有打錯';
      $('#bExamUrl').focus();
      return;
    }
    const exA = appById('exam'), wantBtn = $('#bExamBtn').checked;
    if (wantBtn && exA && !exA.pinned && pinnedApps().length >= APP_MAX_PINNED) {
      $('#bErr').style.color = '';
      $('#bErr').textContent = `⚠️ 最下面一排最多只能釘選 ${APP_MAX_PINNED} 個應用，請先到「🧩 應用中心」取消釘選其他應用`;
      return;
    }
    s.examUrl = ex.url; s.examBtn = wantBtn;
    if (exA) { exA.url = ex.url; exA.pinned = wantBtn; }
    s.timerStyle = TIMER_STYLE_OPTIONS.includes($('#bTimerStyle').value) ? $('#bTimerStyle').value : 'island';
    s.drawAnim = DRAW_ANIM_OPTIONS.includes($('#bDrawAnim').value) ? $('#bDrawAnim').value : 'random';
    const oldSchool = s.school, oldClass = s.className, oldAnn = String(s.announcement || '').trim(), annTyped = $('#bAnn').value.trim();
    Object.assign(s, { school: $('#bSchool').value.trim(), className: $('#bClass').value.trim() || s.className, schoolYear: $('#bYear').value.trim(), semester: $('#bSem').value, announcement: $('#bAnn').value.trim(), studentEdit: $('#bStuEdit').checked });
    if (annTyped === oldAnn) refreshDefaultAnnouncement(s, oldSchool, oldClass); // 公告沒動、只改校名 → 預設歡迎詞跟著換校名
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
  el.innerHTML = `${curClassNote('名單')}
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

// 多班級：提醒老師現在改的是哪一班
function curClassNote(what) {
  if (!isMulti() || classList().length < 2) return '';
  return `<p class="cls-note-line">正在編輯：<b>${esc(classLabel(curClassObj()))}</b> 的${what}（每一班分開存；要改別班，請先在上方「目前班級」切換）</p>`;
}

/* ---------------- 班級管理（導師／科任老師） ---------------- */
function ctClasses(el) {
  const multi = isMulti();
  const list = classList();
  const seatsOf = c => {
    const on = c.id === state.curClass;
    const max = Number(on ? state.settings.maxSeat : c.data?.settings?.maxSeat) || 0;
    const vac = (on ? state.settings.vacant : c.data?.settings?.vacant) || [];
    return Math.max(0, max - vac.filter(v => v >= 1 && v <= max).length);
  };
  el.innerHTML = `
    <h4 style="margin:0 0 8px">身分</h4>
    <div class="role-pick small">
      <button type="button" class="role-card${!multi ? ' active' : ''}" data-role="single"><span class="rc-ico">👩‍🏫</span><b>導師（一個班）</b><small>畫面只有一個班級</small></button>
      <button type="button" class="role-card${multi ? ' active' : ''}" data-role="multi"><span class="rc-ico">🧑‍🔬</span><b>科任老師（多個班）</b><small>可新增好幾個班，上方會出現「換班級」</small></button>
    </div>
    <div class="err" id="clsErr"></div>
    ${multi ? `
    <h4 style="margin:14px 0 8px">班級清單</h4>
    <p class="sub">每一班有自己的學生名單、金幣、圖鑑、山林、作業、聯絡簿、每日任務和公告。作息時間、週課表、倒數日、天氣、音樂、備份和密碼是全部班級共用的。</p>
    <div class="cls-head"><span>順序</span><span>班級名稱</span><span>科目（選填）</span><span>人數</span><span></span></div>
    <div id="clsRows" class="cls-rows">${list.map((c, i) => `<div class="cls-row${c.id === state.curClass ? ' cur' : ''}" data-id="${esc(c.id)}">
      <span class="cls-move"><button type="button" class="btn" data-up title="往上移" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="btn" data-down title="往下移" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></span>
      <input data-k="name" value="${esc(c.name)}" maxlength="20" placeholder="班級名稱">
      <input data-k="subject" value="${esc(c.subject)}" maxlength="20" placeholder="例如：自然" list="clsSubj">
      <span class="cls-n">${seatsOf(c)} 人</span>
      <span class="cls-act">${c.id === state.curClass ? '<em class="cls-cur">目前</em>' : `<button type="button" class="btn" data-go>切換</button>`}<button type="button" class="btn danger" data-del title="刪除這一班" ${list.length <= 1 ? 'disabled' : ''}>刪除</button></span>
    </div>`).join('')}</div>
    <datalist id="clsSubj">${SUBJECTS.map(x => `<option value="${x}">`).join('')}</datalist>
    <div class="modal-actions" style="justify-content:flex-end;margin-top:8px"><button type="button" class="primary" id="clsSave">儲存班級名稱</button></div>
    <h4 style="margin:18px 0 8px">＋ 新增班級</h4>
    <div class="cls-add">
      <input id="clsNewName" class="mini-input" placeholder="班級名稱，例如：五乙" maxlength="20">
      <input id="clsNewSubj" class="mini-input" placeholder="科目（選填）" list="clsSubj" maxlength="20">
      <input id="clsNewMax" class="mini-input" type="number" min="1" max="60" value="20" title="最大座號">
      <input id="clsNewVac" class="mini-input" placeholder="空號，例如：7、15">
      <button type="button" class="btn" id="clsAdd">＋ 新增班級</button>
    </div>
    <h4 style="margin:18px 0 8px">⏰ 依課表自動換班</h4>
    <label class="ann-chk" style="display:inline-flex"><input type="checkbox" id="clsAuto"${state.settings.autoSwitch !== false ? ' checked' : ''}>上課時間到，依週課表自動切換到那一班</label>
    <p class="sub">到「週課表」分頁，在每一格下方選這節是哪一班（臨時調課也可以改）。每一節開始時、或剛打開儀表板時會自動切換；在同一節裡你手動換班，不會被切回去。</p>` : `
    <p class="sub" style="margin-top:12px">目前是導師模式，只有一個班級（${esc(state.settings.className)}）。如果你也教其他班，請改成「科任老師（多個班）」，現在這個班的資料會成為第一個班，不會遺失。</p>`}`;
  const err = m => { $('#clsErr').textContent = m || ''; };
  $$('.role-pick .role-card', el).forEach(b => b.onclick = () => {
    const role = b.dataset.role;
    if (role === (multi ? 'multi' : 'single')) return;
    if (role === 'single' && !setClassMode('single')) return err(`目前有 ${classList().length} 個班級。請先刪除其他班級、只留下一班，才能改回導師模式。`);
    if (role === 'multi') { setClassMode('multi'); toast('✅ 已改成科任老師模式，可以在下方新增班級', 3500); }
    else toast('✅ 已改回導師模式');
    renderAll(); openConsole('classes');
  });
  if (!multi) return;
  const commitNames = () => {
    let bad = false;
    $$('#clsRows .cls-row').forEach(r => {
      const c = classById(r.dataset.id); if (!c) return;
      const nm = $('[data-k=name]', r).value.trim();
      if (!nm) { bad = true; return; }
      c.name = nm; c.subject = $('[data-k=subject]', r).value.trim();
      if (c.id === state.curClass) state.settings.className = nm;
      else if (c.data) c.data.settings = { ...(c.data.settings || {}), className: nm };
    });
    return !bad;
  };
  $('#clsSave').onclick = () => {
    if (!commitNames()) return err('班級名稱不能空白');
    err(''); save(); renderAll(); toast('✅ 班級名稱已儲存'); openConsole('classes');
  };
  $('#clsRows').onclick = e => {
    const row = e.target.closest('.cls-row'); if (!row) return;
    const id = row.dataset.id, c = classById(id);
    if (e.target.closest('[data-up]') || e.target.closest('[data-down]')) {
      commitNames();
      moveClass(id, e.target.closest('[data-up]') ? -1 : 1);
      renderAll(); openConsole('classes'); return;
    }
    if (e.target.closest('[data-go]')) { commitNames(); switchClass(id); openConsole('classes'); return; }
    if (e.target.closest('[data-del]')) {
      if (classList().length <= 1) return err('至少要保留一個班級');
      askConfirm(`確定要刪除「${classLabel(c)}」嗎？\n\n這一班的學生名單、金幣、圖鑑、作業、聯絡簿和每日任務紀錄都會一起刪除，無法復原。\n（建議先到「資料管理」手動備份）`, '刪除這一班', { danger: true }).then(ok => {
        if (!ok) return;
        commitNames();
        const name = classLabel(c);
        deleteClass(id);
        renderAll(); openConsole('classes');
        toast(`已刪除「${name}」`);
      });
    }
  };
  $('#clsAdd').onclick = () => {
    const name = $('#clsNewName').value.trim(), max = +$('#clsNewMax').value;
    if (!name) return err('請輸入新班級的名稱');
    if (!(max >= 1 && max <= 60)) return err('最大座號請填 1～60');
    commitNames();
    const c = addClass(name, { subject: $('#clsNewSubj').value, maxSeat: max, vacant: parseVacant($('#clsNewVac').value).filter(n => n <= max) });
    renderAll(); openConsole('classes');
    toast(`✅ 已新增「${classLabel(c)}」。學生姓名請先切換到這班，再到「座號與名單」填寫`, 4500);
  };
  $('#clsAuto').onchange = () => {
    state.settings.autoSwitch = $('#clsAuto').checked;
    save(); renderClassSwitch();
    toast(state.settings.autoSwitch ? '✅ 已開啟依課表自動換班' : '已關閉自動換班，請用上方「換班級」手動切換');
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
  const multi = isMulti();
  el.innerHTML = `
    <p class="sub">在格子裡輸入科目（可從下拉選單挑選），空白代表那節沒課。首頁會依今天星期幾自動顯示科目。<br>每一節的時間請在「作息時間」分頁設定。</p>
    ${multi ? '<p class="cls-note-line">科任老師：每一格下方可以選「這節是哪一班」。上課時間到，儀表板會自動切換到那一班（可在「班級管理」關閉）。只選班級、科目空白時，會自動填入該班的科目。</p>' : ''}
    <div class="tt-wrap"><table class="tt-edit">
      <thead><tr><th>節次</th>${[1, 2, 3, 4, 5].map(w => `<th>星期${WEEK[w]}</th>`).join('')}</tr></thead>
      <tbody>${SLOTS.map(s => `<tr><th>${slotName(s)}<small>${slotTime(s) || '<i>未設定時間</i>'}</small></th>${[1, 2, 3, 4, 5].map(w =>
        `<td><input list="subjList" data-w="${w}" data-s="${s}" value="${esc((tt[w] || {})[s] || '')}">${multi ? `<select class="tt-cls" data-w="${w}" data-s="${s}" title="這節是哪一班">${classOptions(ttClassOf(w, s))}</select>` : ''}</td>`).join('')}</tr>`).join('')}</tbody>
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
  $('#ttClear').onclick = () => { if (confirm('清空所有格子？（按「儲存」後才會生效）')) { $$('.tt-edit input').forEach(i => i.value = ''); $$('.tt-edit select.tt-cls').forEach(x => x.value = ''); } };
  const cellInput = sel => $(`.tt-edit input[data-w="${sel.dataset.w}"][data-s="${sel.dataset.s}"]`);
  $$('.tt-edit select.tt-cls').forEach(sel => sel.onchange = () => {
    const c = classById(sel.value), inp = cellInput(sel);
    if (c && inp && !inp.value.trim() && c.subject) inp.value = c.subject;
  });
  $('#ttSave').onclick = () => {
    const t = {}, tc = {};
    $$('.tt-edit select.tt-cls').forEach(sel => {
      const c = classById(sel.value); if (!c) return;
      const inp = cellInput(sel);
      if (inp && !inp.value.trim()) inp.value = c.subject || c.name;
      (tc[sel.dataset.w] ||= {})[sel.dataset.s] = c.id;
    });
    $$('.tt-edit input').forEach(i => { const v = i.value.trim(); if (v) (t[i.dataset.w] ||= {})[i.dataset.s] = v; });
    state.timetable = t;
    if (multi) state.ttClass = tc;
    const noTime = SLOTS.filter(s => Object.values(t).some(d => d[s]) && !slotTime(s));
    save(); renderSchedule(); tick();
    toast(noTime.length ? `⚠️ 已儲存，但 ${noTime.map(slotName).join('、')} 還沒設定時間，請到「作息時間」補上` : '✅ 週課表已儲存', 3500);
  };
}

function ctTasks(el) {
  let rows = state.taskDefs.map(t => ({ ...t, announce: !!t.announce }));
  const draw = () => {
    $('#tkRows').innerHTML = rows.map((t, i) => `<div class="er task" data-i="${i}">
      <input value="${esc(t.name)}" placeholder="任務名稱" data-k="name">
      <label class="ann-chk" title="今天還沒打卡的座號會自動出現在左上角跑馬燈"><input type="checkbox" data-k="announce"${t.announce ? ' checked' : ''}>顯示在公告</label>
      <button data-del="${i}">✕</button></div>`).join('');
  };
  el.innerHTML = `${curClassNote('每日任務')}<p class="sub">每天都會出現的打卡任務。學生每完成一項 +1 金幣、班級山林 +1。（刪除任務不會影響已得到的金幣）</p>
    <p class="sub">勾選「顯示在公告」後，該任務今天尚未完成的座號會自動出現在左上角跑馬燈；全班完成就會自動消失，不用手動輸入。</p>
    <div class="edit-rows" id="tkRows"></div>
    <div class="modal-actions" style="justify-content:space-between"><button class="btn" id="tkAdd">＋ 新增任務</button><button class="primary" id="tkSave">儲存</button></div>`;
  draw();
  const sync = () => $$('#tkRows .er').forEach(er => {
    const i = +er.dataset.i;
    rows[i].name = $('input[data-k="name"]', er).value;
    rows[i].announce = !!$('input[data-k="announce"]', er)?.checked;
  });
  $('#tkRows').onclick = e => { const d = e.target.closest('[data-del]'); if (d) { sync(); rows.splice(+d.dataset.del, 1); draw(); } };
  $('#tkAdd').onclick = () => { sync(); rows.push({ id: 't' + uid(), name: '', announce: false }); draw(); };
  $('#tkSave').onclick = () => {
    sync();
    // 保留 announce，避免舊版只存 {id,name} 把欄位洗掉
    state.taskDefs = rows.filter(t => t.name.trim()).map(t => ({ id: t.id, name: t.name.trim(), announce: !!t.announce }));
    save(); renderAll(); toast('✅ 任務已儲存'); draw();
  };
}

let ptMode = 'add';
function ctPoints(el) {
  const modes = [['add', '➕ 加扣分'], ['redeem', '🎁 兌換'], ['prizes', '🏷️ 獎品清單']];
  el.innerHTML = `${curClassNote('金幣')}<div class="att-pick pt-mode" id="ptMode">${modes.map(([k, v]) => `<button type="button" class="att-pk${k === ptMode ? ' active' : ''}" data-pm="${k}">${v}</button>`).join('')}</div><div id="ptBody"></div>`;
  $('#ptMode').onclick = e => { const b = e.target.closest('[data-pm]'); if (!b) return; ptMode = b.dataset.pm; ctPoints(el); };
  const body = $('#ptBody');
  if (ptMode === 'redeem') return ctRedeem(body);
  if (ptMode === 'prizes') return ctPrizes(body);
  const sel = new Set();
  body.innerHTML = `<p class="sub">選擇座號（可多選），再按要加或扣的金幣數。加分也會讓班級山林成長，並可能發現新物種。加扣分會永久記在每位學生的「📒 金幣紀錄」裡（全班夥伴 → 點學生）。</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="pAll">全選</button><button class="btn" id="pNone">清除選擇</button>
      <input class="mini-input" id="pReason" placeholder="原因（例如：熱心助人）" style="flex:1;min-width:180px"></div>
    <div class="pick-grid" id="pGrid">${activeSeats().map(n => `<button data-n="${n}"><b>${pad(n)}</b>${esc(nameOf(n)) || '&nbsp;'}</button>`).join('')}</div>
    <div class="btn-row" style="justify-content:flex-start">
      ${[1, 2, 3, 5, 10].map(v => `<button class="btn" data-v="${v}">＋${v}</button>`).join('')}
      ${[-1, -2, -5].map(v => `<button class="btn danger" data-v="${v}">${v}</button>`).join('')}
    </div>
    <p class="sub" style="font-size:12px">扣分會讓「累計獲得」減少；學生用金幣換獎品請改用上方的「🎁 兌換」，才會記成兌換、不會讓物種進度和班級山林倒退。</p>
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
  $$('[data-v]', body).forEach(b => b.onclick = () => {
    if (!sel.size) return toast('請先選擇座號');
    const v = +b.dataset.v, reason = $('#pReason').value.trim() || (v > 0 ? '老師加分' : '老師扣分');
    const hadCeleb = celebrateQueue.length;
    celebrateQueue.running = true; // 先暫停慶祝動畫，等關閉控制台後再播放
    [...sel].forEach(n => addCoins(n, v, reason, false, 'manual'));
    save(); renderAll(); drawLog();
    toast(`✅ ${sel.size} 位同學 ${v > 0 ? '+' : ''}${v} 金幣`);
    if (celebrateQueue.length > hadCeleb) {
      toast(`🎉 有 ${celebrateQueue.length} 個新發現！關閉控制台後會播放`, 3000);
      modalOnClose = () => { celebrateQueue.running = false; runCelebrations(); };
    } else celebrateQueue.running = false;
  });
}
let ptSeat = 0;
function ctRedeem(body) {
  if (ptSeat && !activeSeats().includes(ptSeat)) ptSeat = 0;
  const recs = (state.redemptions || []).slice(0, 60);
  body.innerHTML = `<p class="sub">點一位學生，再選獎品（或直接輸入名稱和金幣）。金幣不夠時不能兌換。兌換只扣這位學生的金幣，不會讓物種進度和班級山林倒退。</p>
    <div class="pick-grid" id="rdGrid">${activeSeats().map(n => `<button data-n="${n}" class="${n === ptSeat ? 'sel' : ''}"><b>${pad(n)}</b>${esc(nameOf(n)) || '&nbsp;'}<small class="rd-bal">${coinSummary(n).coins} 幣</small></button>`).join('')}</div>
    <div id="rdArea" class="rd-area">${redeemPanelHTML(ptSeat)}</div>
    <h4 style="margin:18px 0 6px">這一班的兌換紀錄</h4>
    <div class="cb-log" id="rdList">${recs.map(r => coinRowHTML({ date: dk0(r.t), time: hm(r.t), kind: 'redeem', text: `${seatWho(r.seat)}：${r.name}` + (r.undone ? '（已撤銷，已退回金幣）' : ''), delta: -r.cost, undone: !!r.undone, id: r.id })).join('') || '<div class="empty">還沒有兌換紀錄</div>'}</div>`;
  $('#rdGrid').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; ptSeat = +b.dataset.n; ctRedeem(body); };
  bindRedeemPanel($('#rdArea'), ptSeat, () => ctRedeem(body));
  $('#rdList').onclick = e => {
    const b = e.target.closest('[data-undo]'); if (!b) return;
    confirmUndo(b.dataset.undo, () => ctRedeem(body));
  };
}
function ctPrizes(body) {
  let rows = (state.prizes || []).map(p => ({ ...p }));
  body.innerHTML = `<p class="sub">常用的獎品和要幾個金幣。<b>所有班級共用</b>，包含在備份裡。兌換時點一下就好；清單沒有的獎品，兌換時也可以直接輸入。</p>
    <div class="edit-rows" id="przRows"></div>
    <div class="modal-actions" style="justify-content:space-between"><button class="btn" id="przAdd">＋ 新增獎品</button><button class="primary" id="przSave">儲存</button></div>`;
  const draw = () => {
    $('#przRows').innerHTML = rows.map((p, i) => `<div class="er prize-row" data-i="${i}">
      <input value="${esc(p.name)}" placeholder="獎品名稱，例如：🍬 糖果" maxlength="40" data-k="name">
      <input type="number" min="1" step="1" value="${esc(p.cost)}" placeholder="金幣" data-k="cost" class="prz-cost">
      <button data-del="${i}" title="刪除">✕</button></div>`).join('') || '<div class="empty">還沒有獎品，按「＋ 新增獎品」。</div>';
  };
  const sync = () => $$('#przRows .er').forEach(er => { const i = +er.dataset.i; rows[i].name = $('[data-k="name"]', er).value; rows[i].cost = $('[data-k="cost"]', er).value; });
  draw();
  $('#przRows').onclick = e => { const d = e.target.closest('[data-del]'); if (d) { sync(); rows.splice(+d.dataset.del, 1); draw(); } };
  $('#przAdd').onclick = () => { sync(); rows.push({ id: 'p' + uid(), name: '', cost: '' }); draw(); const ins = $$('#przRows [data-k="name"]'); ins.length && ins[ins.length - 1].focus(); };
  $('#przSave').onclick = () => {
    sync();
    const bad = rows.find(p => String(p.name).trim() && !(Math.round(Number(p.cost)) >= 1));
    if (bad) return toast(`「${String(bad.name).trim()}」的金幣請填 1 以上的整數`);
    state.prizes = normalizePrizes(rows);
    save(); toast(`✅ 獎品清單已儲存（${state.prizes.length} 項）`);
    rows = state.prizes.map(p => ({ ...p })); draw();
  };
}

const DEFAULT_BACKUP = { auto: false, freq: 'daily', weekdays: [5], time: '15:00', lastAt: '', lastName: '', lastError: '', folderName: '', target: '' }; // target：'folder' 資料夾／'browser' 瀏覽器裡（空白＝能選資料夾就用資料夾）
function backupCfg() { return { ...DEFAULT_BACKUP, ...(state.backup || {}) }; }
function backupDays(cfg) {
  if ((cfg.freq || 'daily') === 'weekly') {
    const w = (cfg.weekdays || []).map(Number).filter(n => n >= 0 && n <= 6);
    return w.length ? w : [5];
  }
  return [0, 1, 2, 3, 4, 5, 6];
}
function backupTimeParts(cfg) {
  const m = String(cfg.time || '15:00').match(/(\d{1,2}):(\d{2})/);
  const hh = m ? Math.min(23, Math.max(0, +m[1])) : 15;
  const mm = m ? Math.min(59, Math.max(0, +m[2])) : 0;
  return [hh, mm];
}
function lastDueSlot(cfg, now = new Date()) {
  const [hh, mm] = backupTimeParts(cfg);
  const days = backupDays(cfg);
  for (let i = 0; i < 16; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, hh, mm, 0, 0);
    if (d <= now && days.includes(d.getDay())) return d;
  }
  return null;
}
function nextBackupAt(cfg, now = new Date()) {
  const [hh, mm] = backupTimeParts(cfg);
  const days = backupDays(cfg);
  for (let i = 0; i < 16; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hh, mm, 0, 0);
    if (d > now && days.includes(d.getDay())) return d;
  }
  return null;
}
function isBackupDue(cfg, now = new Date()) {
  if (!cfg || !cfg.auto) return false;
  const slot = lastDueSlot(cfg, now);
  if (!slot) return false;
  if (!cfg.lastAt) return true;
  const last = new Date(cfg.lastAt);
  return !isNaN(last) && last < slot;
}
function fmtWhen(d) {
  if (!d || isNaN(d)) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function backupPayload() { return JSON.stringify(state, null, 1); }
function backupFileName(tag = '手動備份') {
  const who = isMulti() && classList().length > 1 ? `科任${classList().length}班` : (state.settings.className || '班級');
  return `班級儀表板_${who}_${tag}_${dateKey()}.json`;
}

const IDB_BACKUP = 'jl-dashboard-fs';
function idbGet(key) {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve(undefined);
      const req = indexedDB.open(IDB_BACKUP, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onerror = () => resolve(undefined);
      req.onsuccess = () => {
        const db = req.result;
        const q = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        q.onsuccess = () => { db.close(); resolve(q.result); };
        q.onerror = () => { db.close(); resolve(undefined); };
      };
    } catch (e) { resolve(undefined); }
  });
}
function idbSet(key, val) {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_BACKUP, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        let tx;
        try {
          tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(val, key);
        } catch (e) { try { db.close(); } catch (e2) {} return reject(e); }   // 例如 DataCloneError
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        // 空間不夠（QuotaExceededError）時交易會被中止，只會觸發 onabort
        tx.onabort = () => { db.close(); reject(tx.error || new Error('abort')); };
      };
    } catch (e) { reject(e); }
  });
}

function idbDel(key) {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve();
      const req = indexedDB.open(IDB_BACKUP, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
    } catch (e) { resolve(); }
  });
}
// 刪除某個開頭的所有 key（完全重設時清掉音樂檔 handle／副本）
function idbDelPrefix(prefix) {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve();
      const req = indexedDB.open(IDB_BACKUP, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        const st = tx.objectStore('kv');
        const cur = st.openCursor();
        cur.onsuccess = () => {
          const c = cur.result; if (!c) return;
          if (String(c.key).startsWith(prefix)) c.delete();
          c.continue();
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
    } catch (e) { resolve(); }
  });
}

// 列出某個開頭的所有 key（瀏覽器內備份清單）
function idbList(prefix) {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve([]);
      const req = indexedDB.open(IDB_BACKUP, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const db = req.result, out = [];
        const tx = db.transaction('kv', 'readonly');
        const cur = tx.objectStore('kv').openCursor();
        cur.onsuccess = () => {
          const c = cur.result; if (!c) return;
          if (String(c.key).startsWith(prefix)) out.push({ key: String(c.key), value: c.value });
          c.continue();
        };
        tx.oncomplete = () => { db.close(); resolve(out); };
        tx.onerror = () => { db.close(); resolve(out); };
      };
    } catch (e) { resolve([]); }
  });
}

/* ---------------- 備份：瀏覽器內備份（不能選資料夾時的自動備份） ----------------
 * 嵌在 Google 協作平台等網頁裡（iframe）時，瀏覽器不讓網頁選資料夾，也開不了新分頁；
 * 而且嵌入框裡的資料和獨立分頁的資料本來就是分開存的，開新分頁去備份會備份到「另一份」資料。
 * 所以這時自動備份改存在「這個瀏覽器裡」（IndexedDB），保留最近 SNAP_KEEP 份，可以下載或還原。
 * 這種備份可以救回改錯、刪錯的資料，但清除瀏覽器資料、換電腦時會一起不見，仍要偶爾手動備份。
 */
const SNAP_PREFIX = 'snap:';
const SNAP_KEEP = 14;
function folderUsable() { return canPickFolder() && !inIframe(); }
// 實際的自動備份位置：能選資料夾、而且老師沒選「瀏覽器裡」→ 資料夾；其餘 → 瀏覽器裡
function backupTarget(cfg = backupCfg()) { return folderUsable() && cfg.target !== 'browser' ? 'folder' : 'browser'; }
async function saveSnapshot(tag = '自動備份', now = new Date()) {
  if (!window.indexedDB) { const e = new Error('這個瀏覽器不能存備份'); e.code = 'noidb'; throw e; }
  const data = backupPayload();
  const at = now.toISOString();
  await idbSet(SNAP_PREFIX + at, { at, tag, name: backupFileName(tag), size: data.length, classes: classList().length, data });
  await pruneSnapshots();
  return { key: SNAP_PREFIX + at, at, tag };
}
async function listSnapshots() {
  const all = await idbList(SNAP_PREFIX);
  return all.filter(x => x.value && typeof x.value.data === 'string')
    .map(x => ({ key: x.key, at: x.value.at, tag: x.value.tag, name: x.value.name, size: x.value.size, classes: x.value.classes }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
async function pruneSnapshots(keep = SNAP_KEEP) {
  const list = await listSnapshots();
  for (const s of list.slice(keep)) await idbDel(s.key);
  return Math.max(0, list.length - keep);
}
async function getSnapshot(key) { const v = await idbGet(key); return v && typeof v.data === 'string' ? v : null; }
function fmtSize(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

/* ---------------- 備份：下載、複製、貼上 ---------------- */
// 一般下載（嵌入框沒有允許下載時，瀏覽器可能會默默擋掉，所以嵌入時會另外顯示「複製備份內容」）
function downloadText(text, name, type = 'application/json') {
  try {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (_) {} }, 4000);
    return true;
  } catch (e) { console.warn(e); return false; }
}
async function copyText(text, ta) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (_) { /* 嵌入框常常沒有剪貼簿權限，改用下面的方法 */ }
  try {
    if (ta) {
      ta.removeAttribute('readonly'); ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
      const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
      ta.setAttribute('readonly', '');
      if (ok) return true;
    }
  } catch (_) {}
  return false;
}
// 顯示備份內容（可以複製後貼到記事本存檔）。tried：剛剛已經試著下載
function showBackupText(text, name, { tried = false, back = true } = {}) {
  const lead = tried
    ? `已經試著下載「<b>${esc(name)}</b>」。請看看電腦的「下載」資料夾有沒有這個檔案。<br>如果沒有（儀表板嵌在 Google 協作平台等網頁裡時，下載有可能被擋），請改用下面的方法，一樣可以備份：`
    : '把備份內容複製起來，存成一個檔案就完成備份：';
  openModal(`<button class="close" data-close>✕</button>
    <h2>📦 備份內容</h2>
    <p class="sub">${lead}</p>
    <ol class="bk-steps">
      <li>按下面的「<b>📋 複製備份內容</b>」。</li>
      <li>打開「記事本」（Windows）或「文字編輯」（Mac），按 <b>Ctrl＋V</b>（Mac 是 ⌘＋V）貼上。</li>
      <li>存檔，檔名可以取「${esc(name)}」。存到隨身碟或雲端硬碟更安全。</li>
      <li>要還原時：教師控制台 → 資料管理 →「⬆️ 還原備份檔」選這個檔，或按「📋 貼上備份內容還原」把內容貼回來。</li>
    </ol>
    <textarea id="bkText" class="bk-text" readonly spellcheck="false"></textarea>
    <div class="modal-actions" style="justify-content:space-between">
      ${back ? '<button type="button" class="btn" id="bkTextBack">← 回到資料管理</button>' : '<span></span>'}
      <button type="button" class="primary" id="bkCopy">📋 複製備份內容</button>
    </div>`, { wide: true });
  const ta = $('#bkText');
  ta.value = text;
  $('#bkCopy').onclick = async () => {
    if (await copyText(text, ta)) toast('✅ 已複製備份內容，請貼到記事本並存檔', 3500);
    else { ta.focus(); ta.select(); toast('沒辦法自動複製，請在框框裡按 Ctrl＋A 全選，再按 Ctrl＋C 複製', 5000); }
  };
  const b = $('#bkTextBack'); if (b) b.onclick = () => openConsole('data');
}
// 手動備份：先試一般下載；嵌在別的網頁裡時，同時顯示「複製備份內容」的方法
function exportData(tag = '手動備份', { quiet = false } = {}) {
  const name = backupFileName(tag), text = backupPayload();
  const ok = downloadText(text, name);
  if (!quiet && (!ok || inIframe())) { showBackupText(text, name, { tried: ok }); return ok; }
  if (ok) toast('✅ 已下載「' + name + '」');
  return ok;
}
// 還原：把讀進來的備份換成目前資料
async function applyRestored(next) {
  try { await saveSnapshot('還原前自動保留'); } catch (_) {} // 還原前先在瀏覽器留一份，按錯還救得回來
  state = next;
  drawnBy = {}; drawn = []; weekDraft = null; autoKey = null; refreshDrawUI();
  setAuth();
  stopMusic(); musicMissing.clear();
  save(); renderAll(); renderMusic(); loadWeather();
  const nFile = state.music.tracks.filter(t => t.kind === 'file').length;
  if (nFile) {
    toast(`✅ 已還原備份。備份只含音樂清單，不含音檔本身；有 ${nFile} 首本機音樂若顯示「請重新指定」，請重新選擇檔案`, 6000);
    refreshMusicAvail();
  } else toast('✅ 已還原備份');
  openConsole('data');
}
// 從文字（檔案內容、貼上的內容、瀏覽器內備份）還原；label：給老師看的來源名稱
function parseBackupText(text) {
  const t = String(text || '').trim().replace(/^\uFEFF/, '');
  return importBackupData(JSON.parse(t));
}
function restoreFromText(text, label) {
  let next;
  try { next = parseBackupText(text); } catch (err) { toast('❌ 這不是正確的備份內容'); return Promise.resolve(false); }
  const n = next.classes.length;
  return askConfirm(`要用${label}取代目前全部資料嗎？${isMulti() ? '\n（目前所有班級都會被取代）' : ''}${n > 1 ? `\n備份檔裡有 ${n} 個班級。` : ''}\n（還原前會先在這個瀏覽器自動保留一份目前的資料）`, '還原').then(async ok => {
    if (!ok) return false;
    await applyRestored(next);
    return true;
  });
}
function openPasteRestore() {
  openModal(`<button class="close" data-close>✕</button>
    <h2>📋 貼上備份內容還原</h2>
    <p class="sub">把之前存下來的備份內容貼到下面（一大段以「{」開頭的文字），再按「還原」。<br>用記事本打開備份檔，按 Ctrl＋A 全選、Ctrl＋C 複製，就能拿到備份內容。</p>
    <textarea id="bkPaste" class="bk-text" spellcheck="false" placeholder='{"settings": …'></textarea>
    <div class="modal-actions" style="justify-content:space-between">
      <button type="button" class="btn" id="bkPasteBack">← 回到資料管理</button>
      <button type="button" class="primary" id="bkPasteGo">還原</button>
    </div>`, { wide: true });
  $('#bkPasteBack').onclick = () => openConsole('data');
  $('#bkPasteGo').onclick = () => {
    const v = $('#bkPaste').value;
    if (!v.trim()) return toast('請先貼上備份內容');
    restoreFromText(v, '貼上的備份內容');
  };
}

/* ---------------- 備份：資料夾（Chrome／Edge、獨立分頁） ---------------- */
function canPickFolder() { return typeof window.showDirectoryPicker === 'function'; }
let lastPickBlocked = false;
async function pickBackupFolder() {
  lastPickBlocked = false;
  if (!folderUsable()) { lastPickBlocked = true; return null; }
  try {
    const handle = await window.showDirectoryPicker({ id: 'jl-backup', mode: 'readwrite', startIn: 'documents' });
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { toast('沒有寫入這個資料夾的權限'); return null; }
    await idbSet('backupDir', handle);
    state.backup = { ...backupCfg(), folderName: handle.name, target: 'folder' };
    save();
    return handle;
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    if (e && (e.name === 'SecurityError' || e.name === 'NotAllowedError')) { lastPickBlocked = true; return null; }
    toast('無法選擇資料夾');
    return null;
  }
}
async function writeBackupToFolder(handle, tag = '自動備份') {
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const req = await handle.requestPermission({ mode: 'readwrite' });
    if (req !== 'granted') { const err = new Error('permission'); err.code = 'permission'; throw err; }
  }
  const name = backupFileName(tag);
  const file = await handle.getFileHandle(name, { create: true });
  const w = await file.createWritable();
  await w.write(backupPayload());
  await w.close();
  return name;
}
function hideBackupBanner() {
  const el = document.getElementById('backupBanner');
  if (el) el.style.display = 'none';
}
function showBackupBanner(kind) {
  let el = document.getElementById('backupBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'backupBanner';
    el.className = 'backup-banner';
    el.innerHTML = `<span class="bb-msg"></span><button type="button" class="primary" id="backupBannerGo">授權並備份</button><button type="button" class="btn" id="backupBannerDismiss">稍後</button>`;
    document.body.appendChild(el);
    el.querySelector('#backupBannerDismiss').onclick = hideBackupBanner;
    el.querySelector('#backupBannerGo').onclick = async () => {
      hideBackupBanner();
      const handle = await idbGet('backupDir') || await pickBackupFolder();
      if (!handle) return;
      try {
        const name = await writeBackupToFolder(handle, '自動備份');
        markBackupOk(name);
        toast('✅ 已自動備份到「' + (state.backup.folderName || '') + '」');
      } catch (e) {
        toast('❌ 備份沒有成功，請再試一次或改用手動備份');
      }
    };
  }
  const msg = el.querySelector('.bb-msg');
  const go = el.querySelector('#backupBannerGo');
  if (kind === 'nofolder') {
    msg.textContent = '自動備份已開啟，但還沒指定資料夾。';
    go.textContent = '選擇資料夾並備份';
  } else {
    msg.textContent = '今日的自動備份需要你按一下，授權寫入備份資料夾。';
    go.textContent = '授權並備份';
  }
  go.style.display = '';
  el.style.display = 'flex';
}
function markBackupOk(name) {
  state.backup = { ...backupCfg(), lastAt: new Date().toISOString(), lastName: name || '', lastError: '' };
  save();
  hideBackupBanner();
}
let _backupBusy = false;
async function maybeAutoBackup(fromUser = false) {
  const cfg = backupCfg();
  if (!cfg.auto || _backupBusy) return false;
  if (!fromUser && !isBackupDue(cfg)) return false;
  _backupBusy = true;
  const target = backupTarget(cfg);
  try {
    if (target === 'browser') {
      await saveSnapshot('自動備份');
      markBackupOk('瀏覽器內備份');
      toast('✅ 已自動備份（存在這個瀏覽器裡）', 3000);
      if ($('#bkSnaps')) renderSnapList();
      return true;
    }
    const handle = await idbGet('backupDir');
    if (!handle) { showBackupBanner('nofolder'); return false; }
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && !fromUser) { showBackupBanner('permission'); return false; }
    const name = await writeBackupToFolder(handle, '自動備份');
    markBackupOk(name);
    toast('✅ 已自動備份到「' + (cfg.folderName || handle.name || '') + '」', 3500);
    return true;
  } catch (e) {
    if (e && e.code === 'permission') { showBackupBanner('permission'); return false; }
    state.backup = { ...cfg, lastError: String(e && e.message || e) };
    save();
    if (fromUser) toast(target === 'browser' ? '❌ 瀏覽器裡存不下備份，請改用手動備份' : '❌ 寫入資料夾失敗，請重新選擇資料夾，或改用手動備份');
    return false;
  } finally { _backupBusy = false; }
}

function backupStatusText(cfg) {
  const last = cfg.lastAt ? fmtWhen(new Date(cfg.lastAt)) : '尚未備份';
  const next = cfg.auto ? fmtWhen(nextBackupAt(cfg)) : '（未啟用）';
  const folder = backupTarget(cfg) === 'browser' ? '存在這個瀏覽器裡' : cfg.folderName ? `資料夾「${cfg.folderName}」` : '還沒指定資料夾';
  const freq = (cfg.freq || 'daily') === 'weekly'
    ? `每週星期${(backupDays(cfg)).map(d => WEEK[d]).join('、')} ${cfg.time || '15:00'}`
    : `每日 ${cfg.time || '15:00'}`;
  return { last, next, folder, freq };
}
// 瀏覽器內備份清單
async function renderSnapList() {
  const box = $('#bkSnaps'); if (!box) return;
  const list = await listSnapshots();
  if (!$('#bkSnaps')) return;
  box.innerHTML = list.length ? list.map(s => {
    const d = new Date(s.at);
    return `<div class="bk-snap"><span><b>${esc(fmtWhen(d))}</b>　${esc(s.tag || '')}${s.classes > 1 ? `・${s.classes} 班` : ''}・${fmtSize(s.size)}</span>
      <span class="bk-snap-btns"><button type="button" class="btn" data-snap-dl="${esc(s.key)}">⬇️ 下載</button><button type="button" class="btn" data-snap-restore="${esc(s.key)}">還原</button></span></div>`;
  }).join('') : '<p class="sub" style="margin:0">目前還沒有。開啟自動備份（存在瀏覽器裡），或按「💾 立刻存一份到瀏覽器」就會出現在這裡。</p>';
}
function ctData(el) {
  const cfg = backupCfg();
  const st = backupStatusText(cfg);
  const tgt = backupTarget(cfg);
  const canFolder = folderUsable();
  const wdBtns = [1, 2, 3, 4, 5, 6, 0].map(d =>
    `<button type="button" class="btn wd${(cfg.weekdays || []).includes(d) ? ' active' : ''}" data-wd="${d}">${WEEK[d]}</button>`
  ).join('');
  el.innerHTML = `
    <h4 style="margin:0 0 8px">手動備份</h4>
    <p class="sub">把全部資料存成一個備份檔（通常在「下載」資料夾）。換電腦、換瀏覽器或清除紀錄前，請先做一次，也可以隨時用來還原。「我的音樂」只會備份清單（曲名、網址），不含音檔本身。<br>如果儀表板嵌在 Google 協作平台等網頁裡、檔案沒有下載下來，可以按「📋 複製備份內容」，貼到記事本存成檔案。</p>
    <div class="btn-row" style="justify-content:flex-start;flex-wrap:wrap">
      <button class="btn" id="dExport">⬇️ 手動備份（下載檔案）</button>
      <button class="btn" id="dCopy">📋 複製備份內容</button>
    </div>
    <div class="btn-row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:8px">
      <label class="btn" style="cursor:pointer">⬆️ 還原備份檔<input type="file" id="dImport" accept=".json,.txt,application/json,text/plain" hidden></label>
      <button class="btn" id="dPaste">📋 貼上備份內容還原</button>
    </div>

    <h4 style="margin:22px 0 8px">自動備份</h4>
    <p class="sub">${canFolder
      ? '啟用後，到了指定時間會自動備份：可以存到電腦裡的資料夾（Chrome、Edge），也可以直接存在這個瀏覽器裡（不用選資料夾）。網頁要開著才會當場備份；如果那時沒開，下次打開儀表板時會補做一次。瀏覽器只會記住資料夾本身，不會顯示完整路徑（例如 C:\\…），這是瀏覽器的安全限制。'
      : `${inIframe() ? '儀表板現在嵌在別的網頁裡（例如 Google 協作平台），' : '這個瀏覽器'}不能選電腦裡的資料夾，所以自動備份會<b>存在這個瀏覽器裡</b>，不用選資料夾，也不用開新分頁。網頁要開著才會當場備份；如果那時沒開，下次打開儀表板時會補做一次。`}</p>
    <label class="ann-chk" style="margin:8px 0 12px;display:inline-flex"><input type="checkbox" id="bkAuto"${cfg.auto ? ' checked' : ''}>啟用自動備份</label>
    <div id="bkOpts" class="bk-opts" style="display:${cfg.auto ? '' : 'none'}">
      <div class="field"><span>備份頻率</span>
        <div class="btn-row" style="justify-content:flex-start">
          <button type="button" class="btn${cfg.freq !== 'weekly' ? ' active' : ''}" id="bkDaily">每日</button>
          <button type="button" class="btn${cfg.freq === 'weekly' ? ' active' : ''}" id="bkWeekly">每週（指定星期）</button>
        </div>
      </div>
      <div class="field" id="bkWdWrap" style="display:${cfg.freq === 'weekly' ? '' : 'none'}"><span>每週的哪幾天</span>
        <div class="btn-row" id="bkWds" style="justify-content:flex-start">${wdBtns}</div>
      </div>
      <div class="field"><span>備份時間（沒指定就用下午 3:00）</span>
        <input type="time" id="bkTime" value="${esc(cfg.time || '15:00')}"></div>
      ${canFolder ? `<div class="field"><span>備份存放位置</span>
        <div class="btn-row" style="justify-content:flex-start;flex-wrap:wrap">
          <button type="button" class="btn${tgt === 'folder' ? ' active' : ''}" id="bkTgtFolder">📁 電腦裡的資料夾</button>
          <button type="button" class="btn${tgt === 'browser' ? ' active' : ''}" id="bkTgtBrowser">🗂️ 這個瀏覽器裡</button>
        </div></div>` : ''}
      ${tgt === 'folder' ? `<div class="field"><span>備份資料夾</span>
        <div class="btn-row" style="justify-content:flex-start;align-items:center;flex-wrap:wrap">
          <button type="button" class="btn" id="bkPick">📁 ${cfg.folderName ? '更改資料夾' : '選擇資料夾'}</button>
          <span class="sub" id="bkFolder" style="margin:0">${esc(st.folder)}</span>
        </div>
      </div>` : ''}
      <p class="sub" id="bkStatus">上次備份：${esc(st.last)}　下次：${esc(st.next)}　${esc(st.freq)}${tgt === 'browser' ? '　（存在這個瀏覽器裡）' : ''}</p>
      <button type="button" class="btn" id="bkNow">${tgt === 'folder' ? '⬇️ 立刻備份到這個資料夾' : '💾 立刻存一份到瀏覽器'}</button>
    </div>

    <h4 style="margin:22px 0 8px">🗂️ 存在這個瀏覽器裡的備份（最近 ${SNAP_KEEP} 份）</h4>
    <p class="sub bk-warn">這些備份存在<b>這台電腦的這個瀏覽器</b>裡，可以救回改錯、刪錯的資料。但是<b>清除瀏覽器資料、換電腦或換瀏覽器時，會一起不見</b>，所以還是要偶爾按上面的「⬇️ 手動備份」或「📋 複製備份內容」，把檔案存到隨身碟或雲端硬碟。</p>
    <div id="bkSnaps" class="bk-snaps"><p class="sub" style="margin:0">讀取中…</p></div>

    <h4 style="margin:22px 0 8px">變更密碼</h4>
    <div class="row3">
      <input class="mini-input" id="dOld" type="password" placeholder="目前密碼">
      <input class="mini-input" id="dNew" type="password" placeholder="新密碼（至少 4 碼）">
      <button class="btn" id="dPw">變更密碼</button>
    </div>
    <div class="danger-zone">
      <h4>🎓 新學年／換班級</h4>
      ${isMulti() ? `<p class="sub">會先自動備份一份（含所有班級；下載一份，也在這個瀏覽器裡留一份），然後清空<b>每一班</b>的：學生金幣與物種、任務打卡紀錄、聯絡簿、作業、點名紀錄、加扣分紀錄、班級山林等級、學生名單。<br>保留：班級清單（班名、科目）、學校名稱、作息表、週課表與班級標記、每日任務、倒數日、我的音樂、密碼。接著可到「班級管理」改班名、刪除或新增班級。</p>` : `<p class="sub">會先自動備份一份（下載一份，也在這個瀏覽器裡留一份），然後清空：學生金幣與物種、任務打卡紀錄、聯絡簿、點名紀錄、加扣分紀錄、班級山林等級、學生名單。<br>保留：學校名稱、作息表、每日任務、倒數日、我的音樂、密碼。接著會帶你設定新班級。</p>`}
      <button class="btn danger" id="dNewYear">開始新學年</button>
      <h4 style="margin-top:18px">完全重設</h4>
      <p class="sub">清除所有資料（包含密碼${isMulti() ? '、所有班級' : ''}、點名紀錄、瀏覽器裡的備份），回到第一次使用的狀態。</p>
      <button class="btn danger" id="dWipe">完全重設</button>
    </div>
    <div class="modal-actions"><button class="btn" id="dLogout">🔓 登出教師模式</button></div>`;

  const refreshStatus = () => {
    const c = backupCfg();
    const s = backupStatusText(c);
    const stEl = $('#bkStatus'); if (stEl) stEl.textContent = `上次備份：${s.last}　下次：${s.next}　${s.freq}${backupTarget(c) === 'browser' ? '　（存在這個瀏覽器裡）' : ''}`;
    const fo = $('#bkFolder'); if (fo) fo.textContent = s.folder;
  };
  const saveBk = (patch, { reopen } = {}) => {
    state.backup = { ...backupCfg(), ...patch };
    if (!state.backup.time) state.backup.time = '15:00';
    save();
    if (reopen) openConsole('data');
    else refreshStatus();
  };
  renderSnapList();
  $('#dExport').onclick = () => exportData();
  $('#dCopy').onclick = () => showBackupText(backupPayload(), backupFileName('手動備份'));
  $('#dPaste').onclick = () => openPasteRestore();
  $('#dImport').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => restoreFromText(r.result, `備份檔「${f.name}」`);
    r.onerror = () => toast('❌ 讀不到這個檔案，可以改用「📋 貼上備份內容還原」');
    r.readAsText(f);
  };
  $('#bkSnaps').onclick = async e => {
    const dl = e.target.closest('[data-snap-dl]'), rs = e.target.closest('[data-snap-restore]');
    if (!dl && !rs) return;
    const snap = await getSnapshot((dl || rs).dataset.snapDl || (dl || rs).dataset.snapRestore);
    if (!snap) { toast('找不到這份備份'); renderSnapList(); return; }
    if (dl) {
      const ok = downloadText(snap.data, snap.name || backupFileName('瀏覽器備份'));
      if (!ok || inIframe()) showBackupText(snap.data, snap.name || backupFileName('瀏覽器備份'), { tried: ok });
      else toast('✅ 已下載「' + snap.name + '」');
    } else restoreFromText(snap.data, `「${fmtWhen(new Date(snap.at))} ${snap.tag || ''}」這份瀏覽器裡的備份`);
  };
  $('#bkAuto').onchange = async () => {
    if ($('#bkAuto').checked) {
      if (backupTarget() === 'folder' && !backupCfg().folderName) {
        const handle = await pickBackupFolder();
        if (!handle && !lastPickBlocked) { $('#bkAuto').checked = false; return; }
        if (!handle) { state.backup = { ...backupCfg(), target: 'browser' }; toast('這裡不能選資料夾，自動備份改存在這個瀏覽器裡', 4000); }
      }
      saveBk({ auto: true }, { reopen: true });
      toast('✅ 已啟用自動備份（' + backupStatusText(backupCfg()).freq + (backupTarget() === 'browser' ? '，存在這個瀏覽器裡' : '') + '）');
      maybeAutoBackup(true);
    } else {
      saveBk({ auto: false }, { reopen: true });
      hideBackupBanner();
      toast('已關閉自動備份，手動備份仍可使用');
    }
  };
  $('#bkTgtFolder') && ($('#bkTgtFolder').onclick = async () => {
    if (!backupCfg().folderName) {
      const handle = await pickBackupFolder();
      if (!handle) { if (lastPickBlocked) toast('這裡不能選資料夾，請用「這個瀏覽器裡」'); return; }
    }
    saveBk({ target: 'folder' }, { reopen: true });
  });
  $('#bkTgtBrowser') && ($('#bkTgtBrowser').onclick = () => { saveBk({ target: 'browser' }, { reopen: true }); hideBackupBanner(); });
  $('#bkDaily') && ($('#bkDaily').onclick = () => saveBk({ freq: 'daily' }, { reopen: true }));
  $('#bkWeekly') && ($('#bkWeekly').onclick = () => saveBk({ freq: 'weekly', weekdays: backupCfg().weekdays.length ? backupCfg().weekdays : [5] }, { reopen: true }));
  $('#bkWds') && ($('#bkWds').onclick = e => {
    const b = e.target.closest('[data-wd]'); if (!b) return;
    const d = +b.dataset.wd;
    let w = [...(backupCfg().weekdays || [])];
    if (w.includes(d)) { if (w.length === 1) return toast('至少要選一天'); w = w.filter(x => x !== d); }
    else w.push(d);
    saveBk({ weekdays: w.sort((a, b) => a - b) }, { reopen: true });
  });
  $('#bkTime') && ($('#bkTime').onchange = () => saveBk({ time: $('#bkTime').value || '15:00' }));
  $('#bkPick') && ($('#bkPick').onclick = async () => {
    const handle = await pickBackupFolder();
    if (handle) { refreshStatus(); const p = $('#bkPick'); if (p) p.textContent = '📁 更改資料夾'; toast('✅ 已指定資料夾「' + handle.name + '」'); }
    else if (lastPickBlocked) toast('這裡不能選資料夾，請用「這個瀏覽器裡」');
  });
  $('#bkNow') && ($('#bkNow').onclick = async () => {
    if (backupTarget() === 'browser') {
      try { await saveSnapshot('手動備份'); markBackupOk('瀏覽器內備份'); refreshStatus(); renderSnapList(); toast('✅ 已存一份備份在這個瀏覽器裡'); }
      catch (err) { toast('❌ 瀏覽器裡存不下備份，請改用上方的手動備份'); }
      return;
    }
    let handle = await idbGet('backupDir');
    if (!handle) handle = await pickBackupFolder();
    if (!handle) return;
    try {
      const name = await writeBackupToFolder(handle, '手動備份');
      markBackupOk(name);
      refreshStatus();
      toast('✅ 已備份到「' + (backupCfg().folderName || handle.name) + '／' + name + '」', 3500);
    } catch (err) { toast('❌ 寫入失敗，請重新選擇資料夾，或改用上方的下載備份'); }
  });
  $('#dPw').onclick = async () => {
    if (await hashPw($('#dOld').value) !== state.settings.pwHash) return toast('目前密碼不正確');
    if ($('#dNew').value.length < 4) return toast('新密碼至少 4 碼');
    state.settings.pwHash = await hashPw($('#dNew').value);
    setAuth(); save(); toast('✅ 密碼已變更');
    $('#dOld').value = $('#dNew').value = '';
  };
  $('#dNewYear').onclick = () => {
    askConfirm(isMulti() ? `確定要開始新學年？全部 ${classList().length} 個班級的學生資料都會被清空（會先備份）。` : '確定要開始新學年？目前班級的學生資料會被清空（會先備份）。', '開始新學年').then(async ok => {
      if (!ok) return;
      let snapOk = false;
      try { await saveSnapshot('學年結束備份'); snapOk = true; } catch (_) {}
      exportData('學年結束備份', { quiet: true });
      newYearReset();
      save(); renderAll();
      toast((isMulti() ? '✅ 每一班都已清空，請到「班級管理」與「座號與名單」設定新學年的班級' : '✅ 已清空，請設定新班級資料') + (snapOk ? '。清空前的資料也在「資料管理 → 存在這個瀏覽器裡的備份」' : ''), 5000);
      openConsole(isMulti() ? 'classes' : 'basic');
    });
  };
  $('#dWipe').onclick = () => {
    askConfirm('確定要清除「全部」資料嗎？此動作無法復原。', '下一步').then(ok => {
      if (!ok) return;
      const t = prompt('請輸入「確定重設」四個字');
      if (t !== '確定重設') return;
      stopMusic();
      localStorage.removeItem(KEY); sessionStorage.removeItem('jl-auth');
      try { localStorage.removeItem(HOL_CACHE_KEY); } catch (e) {}
      state.music = normalizeMusic(null);
      Promise.all([idbDelPrefix('music'), idbDelPrefix(SNAP_PREFIX), idbDel(WHL_IDB_KEY)]).finally(() => location.reload());
    });
  };
  $('#dLogout').onclick = () => { lockNow(); closeModal(); toast('🔒 已上鎖'); };
}


/* ---------------- 其他按鈕 ---------------- */
/* ---------------- 全螢幕（含 Google Sites iframe 後援） ---------------- */
function inIframe() {
  try { return window.self !== window.top; } catch (e) { return true; }
}
function fsEnabled() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}
function fsElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function reqFs(el = document.documentElement) {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
  return fn ? Promise.resolve(fn.call(el)) : Promise.reject(new Error('no fs'));
}
function exitFs() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  return fn ? Promise.resolve(fn.call(document)) : Promise.resolve();
}
function isZoomMode() { return document.body.classList.contains('fs-zoom'); }
function setZoomMode(on) {
  document.body.classList.toggle('fs-zoom', !!on);
  const btn = $('#fsZoomExit');
  if (btn) btn.style.display = on ? '' : 'none';
  if (on) toast('已進入放大模式（按 Esc 或右上角離開）', 2500);
}
function updateFsButtons() {
  const top = $('#fsTopControls'), ifr = $('#fsIframeControls');
  const embed = inIframe();
  // 頂層且瀏覽器支援全螢幕 → 單一全螢幕鈕；iframe 或無支援 → 新分頁＋放大
  const useIframeUi = embed || !fsEnabled();
  if (top) top.style.display = useIframeUi ? 'none' : 'contents';
  if (ifr) ifr.style.display = useIframeUi ? 'contents' : 'none';
  const lab = $('#fullBtnLabel');
  if (lab) lab.textContent = fsElement() ? '離開全螢幕' : '全螢幕';
}
async function toggleRealFullscreen() {
  try {
    if (fsElement()) await exitFs();
    else await reqFs();
  } catch (e) {
    // 被拒（常見於 iframe 未允許 allowfullscreen）→ 放大模式
    setZoomMode(true);
    toast('無法使用系統全螢幕，已改為放大模式', 2800);
  }
  updateFsButtons();
}
function openFullscreenNewTab() {
  // 必須在 click 同步呼叫；不要加noopener，才能偵測是否被擋
  const w = window.open(location.href, '_blank');
  if (w) {
    try { w.opener = null; } catch (e) {}
    toast('已在新分頁開啟，到新分頁再按一次「全螢幕」', 3500);
  } else {
    setZoomMode(true);
    toast('瀏覽器擋住新分頁，已改放大模式。也可直接打開：' + location.href, 10000);
  }
}
$('#fullBtn') && ($('#fullBtn').onclick = () => toggleRealFullscreen());
$('#fsNewTabBtn') && ($('#fsNewTabBtn').onclick = () => openFullscreenNewTab());
$('#fsZoomBtn') && ($('#fsZoomBtn').onclick = () => setZoomMode(!isZoomMode()));
$('#fsZoomExit') && ($('#fsZoomExit').onclick = () => setZoomMode(false));
document.addEventListener('fullscreenchange', updateFsButtons);
document.addEventListener('webkitfullscreenchange', updateFsButtons);
updateFsButtons();

$('#cleanBtn').onclick = () => { document.body.classList.add('clean'); $('#cleanClock').classList.remove('hidden'); tick(); };
$('#cleanClock').onclick = () => { document.body.classList.remove('clean'); $('#cleanClock').classList.add('hidden'); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (isExamOpen()) return;   // 監考中不要用 Esc 關東西
    if (isZoomMode()) { setZoomMode(false); return; }
    if (!$('#modal').classList.contains('hidden') && !celebrateQueue.running) closeModal();
  }
});

// 測試用：iframe／全螢幕可用性判斷
if (typeof globalThis !== 'undefined') {
  globalThis.__jlFs = { inIframe, fsEnabled, fsElement, setZoomMode, isZoomMode, openFullscreenNewTab, updateFsButtons };
}

/* ---------------- 🧩 應用中心（v1.14.0；由 v1.10.0 的 📝 監考模式擴充） ----------------
 * 最下面一排「🧩 應用」（不需要密碼）打開應用中心；釘選的應用（最多 3 個）直接出現在最下面一排。
 * 「在儀表板裡打開」的應用用全畫面的嵌入框打開，蓋住整個儀表板（跑馬燈、山林動物都先停下來），
 * 暫停環境音和我的音樂，關掉後再恢復。「✕ 回到儀表板」要再按一次確認；按 Esc 不會關掉。
 * 有些網站不允許被嵌在別的網頁裡（畫面空白或顯示「拒絕連線」），這種請改成「用新分頁打開」。
 */
const EXAM_LOAD_TIMEOUT = 15000;
const appList = () => (state.apps || []).slice().sort((a, b) => a.order - b.order);
const appById = id => (state.apps || []).find(a => a.id === id);
const appLabel = a => a && a.id === 'exam' ? '監考看板' : (a ? a.name : '');
function examUrl() {
  const ex = appById('exam');
  const r = parseExamUrl(ex ? ex.url : state.settings.examUrl);
  return r.ok ? r.url : DEFAULT_EXAM_URL;
}
const exam = { open: false, amb: 'none', musicWasPlaying: false, timer: null, loaded: false, appId: '' };
function isExamOpen() { return exam.open; }
function curOverlayApp() { return appById(exam.appId) || (exam.appId === 'exam' ? defaultExamApp(examUrl()) : null); }
function pinnedApps() { return appList().filter(a => a.pinned); }
// 最下面一排：📝 監考（固定的按鈕，沿用 v1.10 的位置）＋其他釘選的應用，依順序排
function renderAppButtons() {
  const box = $('#appPinned'); if (!box) return;
  const exBtn = $('#examNavBtn');
  $$('.app-pin-btn', box).forEach(b => b.remove());
  appList().forEach(a => {
    if (a.id === 'exam') { if (exBtn) { box.appendChild(exBtn); exBtn.style.display = a.pinned ? '' : 'none'; } return; }
    if (!a.pinned) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'app-pin-btn'; b.dataset.app = a.id;
    b.title = `${a.name}：${a.desc || a.url}${a.openMode === 'newtab' ? '（新分頁）' : ''}`;
    b.innerHTML = `<span>${esc(a.emoji)}</span>${esc(a.name)}`;
    box.appendChild(b);
  });
  if (exBtn && !appById('exam')) exBtn.style.display = 'none';
}
const renderExamBtn = renderAppButtons;
function examShowMsg(kind) {
  const ld = $('#examLoading'), fl = $('#examFail');
  if (ld) ld.style.display = kind === 'loading' ? '' : 'none';
  if (fl) fl.style.display = kind === 'fail' ? '' : 'none';
}
function examLoad() {
  const fr = $('#examFrame'); if (!fr) return;
  const app = curOverlayApp();
  const url = app ? (parseExamUrl(app.url).ok ? parseExamUrl(app.url).url : examUrl()) : examUrl();
  exam.loaded = false;
  clearTimeout(exam.timer);
  $$('#examNewTab, #examFailNewTab').forEach(a => { a.href = url; });
  const lab = $('#examUrlLabel'); if (lab) { lab.textContent = url.replace(/^https:\/\//, '').replace(/\/$/, ''); lab.title = url; }
  if (navigator.onLine === false) { fr.removeAttribute('src'); examShowMsg('fail'); return; }
  examShowMsg('loading');
  fr.onload = () => {
    if (!exam.open || !fr.getAttribute('src')) return;
    exam.loaded = true; clearTimeout(exam.timer); examShowMsg('');
  };
  fr.onerror = () => { if (exam.open) examShowMsg('fail'); };
  exam.timer = setTimeout(() => { if (exam.open && !exam.loaded) examShowMsg('fail'); }, EXAM_LOAD_TIMEOUT);
  fr.src = url;
}
// 用新分頁打開（瀏覽器擋掉時提示）
function openAppNewTab(app) {
  const url = parseExamUrl(app && app.url).ok ? parseExamUrl(app.url).url : '';
  if (!url) { toast('⚠️ 這個應用的網址不正確，請到「教師控制台 → 🧩 應用中心」修改'); return false; }
  let w = null;
  try { w = window.open(url, '_blank', 'noopener'); } catch (e) { w = null; }
  if (w === null && typeof window.open === 'function') {
    // 有些瀏覽器加了 noopener 會回傳 null；只有真的被擋時才提示
    toast(`↗ 已用新分頁打開「${app.name}」。沒有看到新分頁的話，請允許這個網站開啟彈出式視窗`, 4500);
  } else toast(`↗ 已用新分頁打開「${app.name}」`);
  return 'newtab';
}
// 打開一個應用：嵌入的用全畫面框；新分頁的直接開新分頁
function openApp(id) {
  const app = appById(id) || (id === 'exam' ? defaultExamApp(examUrl()) : null);
  if (!app) { toast('找不到這個應用'); return false; }
  if (app.openMode === 'newtab') return openAppNewTab(app);
  const ov = $('#examOverlay'); if (!ov || exam.open) return false;
  // 先記下並暫停聲音
  exam.amb = ambCur;
  const a = musicAudio();
  exam.musicWasPlaying = !!(a && musicPlayingId && !a.paused);
  if (ambCur !== 'none') { stopAmbient(); $$('#ambList li').forEach(li => li.classList.remove('on')); }
  if (exam.musicWasPlaying) { try { a.pause(); } catch (e) {} renderMusicControls(); }
  exam.open = true; exam.appId = app.id;
  dmSync();   // 跳舞音樂暫停（關掉監考後，倒數還在跑就接著播）
  const isEx = app.id === 'exam';
  const t = $('#examTitle'); if (t) t.textContent = isEx ? '📝 監考模式' : `${app.emoji} ${app.name}`;
  ov.setAttribute('aria-label', isEx ? '監考模式' : app.name);
  const fr = $('#examFrame'); if (fr) fr.title = appLabel(app);
  const rl = $('#examReload'); if (rl) rl.title = `重新載入${appLabel(app)}`;
  const nt = $('#examNewTab'); if (nt) nt.title = `${appLabel(app)}在這裡顯示不出來時，用新分頁打開`;
  const ld = $('#examLoading'); if (ld) ld.textContent = `⏳ ${appLabel(app)}載入中…`;
  const ft = $('#examFailTitle'); if (ft) ft.textContent = `⚠️ ${appLabel(app)}沒有順利打開`;
  const fh = $('#examFailHint'); if (fh) fh.textContent = isEx
    ? '可能是網路斷了，或監考看板的網址換了。請確認網路後按「🔄 再試一次」；也可以用新分頁打開。網址可以在「教師控制台 → 基本資料 → 📝 監考看板」或「🧩 應用中心」修改。'
    : '可能是網路斷了，或這個網站不允許放在儀表板裡（有些網站會擋）。請按「↗ 用新分頁打開」；如果每次都這樣，可以到「教師控制台 → 🧩 應用中心」把開啟方式改成「用新分頁打開」。';
  const hint = $('#examEmbedHint'); if (hint) hint.style.display = isEx ? 'none' : '';
  document.body.classList.add('exam-open');
  ov.style.display = 'flex';
  const fsb = $('#examFsBtn'); if (fsb) fsb.style.display = fsEnabled() ? '' : 'none';
  examLoad();
  return true;
}
function openExam() { return openApp('exam'); }
async function closeExam(force = false) {
  if (!exam.open) return false;
  if (!force) {
    const app = curOverlayApp();
    const yes = exam.appId === 'exam'
      ? await askConfirm('確定結束監考、回到儀表板？（監考看板會關閉；看板自己的設定會保留在看板網站裡）', '結束監考')
      : await askConfirm(`確定關閉「${app ? app.name : '應用'}」、回到儀表板？`, '回到儀表板');
    if (!yes) return false;
  }
  const ov = $('#examOverlay'), fr = $('#examFrame');
  try { if (fsElement() && ov && (fsElement() === ov || ov.contains(fsElement()))) await exitFs(); } catch (e) {}
  clearTimeout(exam.timer);
  if (fr) { fr.onload = null; fr.removeAttribute('src'); }
  exam.open = false; exam.loaded = false; exam.appId = '';
  if (ov) ov.style.display = 'none';
  examShowMsg('');
  document.body.classList.remove('exam-open');
  // 恢復聲音
  dm.restoring = true;
  try {
    if (exam.amb && exam.amb !== 'none') playAmbient(exam.amb);
    else if (exam.musicWasPlaying) { const a = musicAudio(); if (a && musicPlayingId) { musicTakeOver(); safePlay(a); } }
  } finally { dm.restoring = false; }
  dmSync();
  renderAmbient(); renderMusicControls();
  exam.amb = 'none'; exam.musicWasPlaying = false;
  islStart();
  return true;
}
const closeApp = closeExam;
function examFullscreen() {
  const ov = $('#examOverlay'); if (!ov) return;
  if (fsElement()) { exitFs(); return; }
  reqFs(ov).catch(() => toast('這裡不能使用全螢幕（例如嵌在協作平台裡）。畫面已經填滿這個框，也可以按「↗ 用新分頁打開」', 4500));
}
function updateExamFsLabel() {
  const b = $('#examFsBtn'); if (b) b.textContent = fsElement() ? '⛶ 離開全螢幕' : '⛶ 全螢幕';
}

/* ---- 應用中心（啟動畫面，不需要密碼） ---- */
let appCat = '全部', appQuery = '';
function appCategories() {
  const used = [...new Set(appList().map(a => a.cat))];
  return ['全部', ...APP_CATS.filter(c => used.includes(c)), ...used.filter(c => !APP_CATS.includes(c))];
}
function appTileHTML(a) {
  return `<button type="button" class="app-tile" data-open-app="${esc(a.id)}" data-cat="${esc(a.cat)}" data-q="${esc((a.name + ' ' + a.desc + ' ' + a.cat).toLowerCase())}">
    <span class="at-emoji">${esc(a.emoji)}</span><b class="at-name">${esc(a.name)}</b><small class="at-desc">${esc(a.desc || a.url.replace(/^https:\/\//, ''))}</small>
    <span class="at-tags">${a.pinned ? '<i>📌 已釘選</i>' : ''}<i>${a.openMode === 'newtab' ? '↗ 新分頁' : '🖥️ 在儀表板裡'}</i><i>${esc(a.cat)}</i></span></button>`;
}
function filterAppTiles() {
  const q = appQuery.trim().toLowerCase();
  let n = 0;
  $$('#appGrid .app-tile').forEach(t => {
    const show = (appCat === '全部' || t.dataset.cat === appCat) && (!q || t.dataset.q.includes(q));
    t.style.display = show ? '' : 'none'; if (show) n++;
  });
  const em = $('#appEmpty'); if (em) em.style.display = n ? 'none' : '';
  $$('#appCats [data-cat]').forEach(c => c.classList.toggle('active', c.dataset.cat === appCat));
}
function openAppCenter() {
  const cats = appCategories();
  if (!cats.includes(appCat)) appCat = '全部';
  const list = appList();
  openModal(`<button class="close" data-close>✕</button>
    <h2>🧩 應用中心</h2>
    <p class="sub">點一下就打開。📌 釘選的應用也會出現在最下面一排（最多 ${APP_MAX_PINNED} 個；螢幕比較窄時會收進「🧩 應用」）。</p>
    <div class="app-top">
      <div class="app-cats att-pick" id="appCats">${cats.map(c => `<button type="button" class="att-pk${c === appCat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <input type="search" id="appSearch" class="mini-input app-search" placeholder="🔍 搜尋應用" value="${esc(appQuery)}" style="display:${list.length > 6 ? '' : 'none'}">
    </div>
    <div class="app-grid" id="appGrid">${list.map(appTileHTML).join('')}</div>
    <div class="empty" id="appEmpty" style="display:none">沒有符合的應用</div>
    <div class="modal-actions"><button type="button" class="btn" id="appManage">⚙️ 管理應用（教師）</button></div>`, { wide: true });
  filterAppTiles();
  $('#appCats').onclick = e => { const c = e.target.closest('[data-cat]'); if (!c) return; appCat = c.dataset.cat; filterAppTiles(); };
  $('#appSearch').oninput = e => { appQuery = e.target.value; filterAppTiles(); };
  $('#appGrid').onclick = e => {
    const t = e.target.closest('[data-open-app]'); if (!t) return;
    const app = appById(t.dataset.openApp);
    if (app && app.openMode !== 'newtab') closeModal();
    openApp(t.dataset.openApp);
  };
  $('#appManage').onclick = () => teacherOpen('apps');
}
document.addEventListener('click', e => {
  const b = e.target.closest('#appPinned .app-pin-btn'); if (!b) return;
  openApp(b.dataset.app);
});
$('#appsNavBtn') && ($('#appsNavBtn').onclick = () => openAppCenter());
$('#examNavBtn') && ($('#examNavBtn').onclick = () => openExam());
$('#examClose') && ($('#examClose').onclick = () => closeExam());
$('#examFsBtn') && ($('#examFsBtn').onclick = () => examFullscreen());
$('#examReload') && ($('#examReload').onclick = () => examLoad());
$('#examRetry') && ($('#examRetry').onclick = () => examLoad());
document.addEventListener('fullscreenchange', updateExamFsLabel);
document.addEventListener('webkitfullscreenchange', updateExamFsLabel);
window.addEventListener('online', () => { if (exam.open && !exam.loaded) examLoad(); });
renderAppButtons();

/* ---- 教師控制台 → 🧩 應用中心（管理） ---- */
let apEditId = null;   // null：沒在編輯；''：新增；其他：編輯這個 id
function saveApps() {
  state.apps = normalizeApps(state.apps, {});
  syncExamMirror(state);
  save(); renderAppButtons();
}
function setAppPinned(id, on) {
  const a = appById(id); if (!a) return { ok: false, msg: '找不到這個應用' };
  if (on && !a.pinned && pinnedApps().length >= APP_MAX_PINNED) {
    return { ok: false, msg: `最下面一排最多只能釘選 ${APP_MAX_PINNED} 個應用。請先把其他應用「取消釘選」，再釘選「${a.name}」。` };
  }
  a.pinned = !!on; saveApps();
  return { ok: true };
}
function moveApp(id, dir) {
  const list = appList(); const i = list.findIndex(a => a.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((a, k) => { a.order = k; });
  state.apps = list; saveApps();
  return true;
}
function upsertApp(data, id = '') {
  const name = String(data.name || '').trim();
  const u = parseExamUrl(data.url);
  if (!name) return { ok: false, msg: '請填應用名稱' };
  if (!u.ok) return { ok: false, msg: u.reason === 'empty' ? '請填網址' : u.reason === 'scheme' ? '網址要用 https:// 開頭（安全連線）' : '網址格式不對，請確認有沒有打錯' };
  const wantPin = !!data.pinned;
  const cur = id ? appById(id) : null;
  if (wantPin && !(cur && cur.pinned) && pinnedApps().length >= APP_MAX_PINNED) {
    return { ok: false, msg: `最下面一排最多只能釘選 ${APP_MAX_PINNED} 個應用。請先把其他應用「取消釘選」，或不要勾「釘選到最下面一排」。` };
  }
  const fields = {
    name: name.slice(0, 20), emoji: String(data.emoji || '').trim().slice(0, 4) || '🔗', url: u.url,
    desc: String(data.desc || '').trim().slice(0, 60), cat: String(data.cat || '').trim().slice(0, 8) || '其他',
    openMode: data.openMode === 'newtab' ? 'newtab' : 'embed', pinned: wantPin
  };
  let app;
  if (cur) { Object.assign(cur, fields); app = cur; }
  else { app = { id: 'a' + uid(), ...fields, order: (state.apps || []).length }; state.apps.push(app); }
  saveApps();
  return { ok: true, app: appById(app.id) };
}
function deleteApp(id) {
  const a = appById(id); if (!a || a.id === 'exam') return false;
  state.apps = state.apps.filter(x => x.id !== id);
  saveApps();
  return true;
}
function ctApps(el) {
  const list = appList();
  const cats = [...new Set([...APP_CATS, ...list.map(a => a.cat)])];
  const ed = apEditId === null ? null : (apEditId ? appById(apEditId) : { emoji: '🔗', name: '', url: '', desc: '', cat: '課堂', openMode: 'embed', pinned: false });
  el.innerHTML = `<p class="sub">常用的教學網站放在這裡，按最下面一排的「🧩 應用」就能打開（不需要密碼）。<b>所有班級共用</b>，包含在備份裡；開始新學年會保留，完全重設會回到只有「📝 監考」。</p>
    <p class="sub" style="font-size:13px">「在儀表板裡打開」：全畫面蓋住儀表板，關掉就回來。有些網站不允許被放在別的網頁裡（畫面空白或顯示「拒絕連線」），請改成「用新分頁打開」。📌 釘選的應用會出現在最下面一排，最多 ${APP_MAX_PINNED} 個。</p>
    ${ed ? `<div class="ap-edit" id="apEdit">
      <h4 style="margin:0 0 8px">${apEditId ? '✏️ 編輯應用' : '＋ 新增應用'}</h4>
      <div class="ap-grid">
        <div class="field"><span>圖示</span><input id="apEmoji" maxlength="4" value="${esc(ed.emoji)}" placeholder="🔗"></div>
        <div class="field"><span>名稱（最下面一排會顯示，建議 2～6 個字）</span><input id="apName" maxlength="20" value="${esc(ed.name)}" placeholder="例如：Kahoot"></div>
      </div>
      <div class="field"><span>網址（只能用 https:// 開頭）</span><input id="apUrl" type="url" value="${esc(ed.url)}" placeholder="https://" autocomplete="off"></div>
      <div class="field"><span>一句話說明</span><input id="apDesc" maxlength="60" value="${esc(ed.desc)}" placeholder="例如：課堂即時問答"></div>
      <div class="ap-grid ap-grid2">
        <div class="field"><span>分類（可以自己打新的分類）</span><input id="apCat" maxlength="8" list="apCatList" value="${esc(ed.cat)}"><datalist id="apCatList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="field"><span>開啟方式</span><select id="apMode"><option value="embed"${ed.openMode !== 'newtab' ? ' selected' : ''}>🖥️ 在儀表板裡打開</option><option value="newtab"${ed.openMode === 'newtab' ? ' selected' : ''}>↗ 用新分頁打開</option></select></div>
      </div>
      <label class="chk" style="font-size:14px;margin:4px 0 10px"><input type="checkbox" id="apPin" ${ed.pinned ? 'checked' : ''}> 📌 釘選到最下面一排</label>
      <div class="err" id="apErr"></div>
      <div class="modal-actions"><button type="button" class="btn" id="apCancel">取消</button><button type="button" class="primary" id="apSave">儲存</button></div>
    </div>` : `<div class="modal-actions" style="justify-content:flex-start;margin-top:0"><button type="button" class="primary" id="apAdd">＋ 新增應用</button></div>`}
    <div class="ap-list" id="apList">${list.map((a, i) => `<div class="ap-row" data-id="${esc(a.id)}">
      <span class="ap-emoji">${esc(a.emoji)}</span>
      <div class="ap-info"><b>${esc(a.name)}</b>${a.id === 'exam' ? '<small class="ap-builtin">內建</small>' : BUILTIN_APP_IDS.includes(a.id) ? '<small class="ap-builtin">預設</small>' : ''}<small>${esc(a.cat)}・${a.openMode === 'newtab' ? '↗ 新分頁' : '🖥️ 在儀表板裡'}・${esc(a.url.replace(/^https:\/\//, ''))}</small></div>
      <div class="ap-btns">
        <button type="button" class="btn ap-pin${a.pinned ? ' on' : ''}" data-pin="${esc(a.id)}" title="釘選到最下面一排">${a.pinned ? '📌 已釘選' : '📌 釘選'}</button>
        <button type="button" class="btn" data-up="${esc(a.id)}" ${i === 0 ? 'disabled' : ''} title="往前">↑</button>
        <button type="button" class="btn" data-down="${esc(a.id)}" ${i === list.length - 1 ? 'disabled' : ''} title="往後">↓</button>
        <button type="button" class="btn" data-test="${esc(a.id)}" title="試開一次">▶ 試開</button>
        <button type="button" class="btn" data-edit="${esc(a.id)}">✏️ 編輯</button>
        ${a.id === 'exam' ? '' : `<button type="button" class="btn danger" data-del="${esc(a.id)}">🗑️ 刪除</button>`}
      </div></div>`).join('')}</div>`;
  const redraw = () => ctApps(el);
  if ($('#apAdd')) $('#apAdd').onclick = () => { apEditId = ''; redraw(); setTimeout(() => $('#apName') && $('#apName').focus(), 30); };
  if ($('#apCancel')) $('#apCancel').onclick = () => { apEditId = null; redraw(); };
  if ($('#apSave')) $('#apSave').onclick = () => {
    const res = upsertApp({ emoji: $('#apEmoji').value, name: $('#apName').value, url: $('#apUrl').value, desc: $('#apDesc').value, cat: $('#apCat').value, openMode: $('#apMode').value, pinned: $('#apPin').checked }, apEditId);
    if (!res.ok) { $('#apErr').textContent = '⚠️ ' + res.msg; return; }
    toast(`✅ 已儲存「${res.app.name}」`);
    apEditId = null; redraw();
  };
  $('#apList').onclick = async e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.pin) { const a = appById(b.dataset.pin); const r = setAppPinned(a.id, !a.pinned); if (!r.ok) { toast('⚠️ ' + r.msg, 4500); return; } toast(a.pinned ? `📌 已釘選「${a.name}」到最下面一排` : `已取消釘選「${a.name}」`); redraw(); return; }
    if (b.dataset.up) { moveApp(b.dataset.up, -1); redraw(); return; }
    if (b.dataset.down) { moveApp(b.dataset.down, 1); redraw(); return; }
    if (b.dataset.test) { openApp(b.dataset.test); return; }
    if (b.dataset.edit) { apEditId = b.dataset.edit; redraw(); return; }
    if (b.dataset.del) {
      const a = appById(b.dataset.del); if (!a) return;
      if (!(await askConfirm(`確定刪除「${a.name}」？（只是從應用中心拿掉，不會影響那個網站）`, '刪除'))) return;
      deleteApp(a.id); toast(`🗑️ 已刪除「${a.name}」`); if (apEditId === a.id) apEditId = null; redraw();
    }
  };
}

/* ---------------- 主題色 ---------------- */
const THEMES = [
  { id: 'default', name: '原始山林', sw1: '#2f5c46', sw2: '#8fd694' },
  { id: 'sakura', name: '櫻花粉紫', sw1: '#8a3a6a', sw2: '#ffb3d0' },
  { id: 'aurora', name: '極光藍', sw1: '#1a5080', sw2: '#7ad7ff' },
  { id: 'neon', name: '螢光橘', sw1: '#a04010', sw2: '#ffb060' },
  { id: 'flow', name: '流光綠', sw1: '#1a8058', sw2: '#6ef0b0' },
  { id: 'starry', name: '星空夜', sw1: '#282060', sw2: '#a8b4ff' },
  { id: 'dawn', name: '晨曦金', sw1: '#a07030', sw2: '#ffd080' }
];
function applyTheme(id) {
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  if (t.id === 'default') document.body.removeAttribute('data-theme');
  else document.body.setAttribute('data-theme', t.id);
  state.settings.theme = t.id;
  $$('#themePop .theme-swatch').forEach(b => b.classList.toggle('active', b.dataset.theme === t.id));
}
function renderThemePop() {
  const pop = $('#themePop'); if (!pop) return;
  pop.innerHTML = THEMES.map(t =>
    `<button type="button" class="theme-swatch ${state.settings.theme === t.id ? 'active' : ''}" data-theme="${t.id}" style="--sw1:${t.sw1};--sw2:${t.sw2}">
      <div class="chip"></div><small>${esc(t.name)}</small></button>`).join('');
}
$('#themeBtn') && ($('#themeBtn').onclick = e => {
  e.stopPropagation();
  const pop = $('#themePop');
  const show = pop.style.display === 'none';
  renderThemePop();
  pop.style.display = show ? '' : 'none';
});
document.addEventListener('click', e => {
  const pop = $('#themePop'); if (!pop || pop.style.display === 'none') return;
  if (e.target.closest('#themePop .theme-swatch')) {
    applyTheme(e.target.closest('.theme-swatch').dataset.theme);
    save();
    pop.style.display = 'none';
    toast('🎨 已套用主題');
    return;
  }
  if (!e.target.closest('.theme-wrap')) pop.style.display = 'none';
});

/* ---------------- 啟動 ---------------- */
function renderAll() {
  renderHeader(); renderSchedule(); renderContact(); renderCountdowns(); renderTaskWidget(); renderCritters(); renderAppButtons(); renderTimerStyle();
  const active = $('.page.active')?.dataset.page; if (active) renderPage(active);
}
bindTabs('left');
bindTabs('tool');
renderAmbient();
renderMusic();
buildStars();
updateSky();
showTimer(); showPomo();
$('#noiseLine').style.left = $('#noiseThreshold').value + '%';
applyTheme(state.settings.theme || 'default');
renderAll();
// 舊版（v1.7 以前）資料：轉成「第一個班級」後馬上存一次，班級 id 固定下來
try { const raw = localStorage.getItem(KEY); if (raw && !Array.isArray(JSON.parse(raw).classes)) save(); } catch (e) {}
tick();
setInterval(tick, 1000);
setTimeout(() => scalAuto(), 4000);   // 📅 開啟後自動更新學校行事曆（有設定網址、超過 1 小時才抓）
setTimeout(() => { refreshHolidays().catch(() => {}); }, 2500);
loadWheelChar().catch(() => {});   // 🎡 轉盤：讀老師上傳的角色圖片   // 🎌 內建以外的年份從網路補
loadWeather();
if (!state.settings.setupDone) openSetup();
setTimeout(() => { try { maybeAutoBackup(); } catch (_) {} }, 800);
setTimeout(() => { try { refreshMusicAvail(); } catch (_) {} }, 400);
/* ---------------- 版本號 ----------------
 * 每次更新改這裡：主版號.次版號.修正號
 *   主版號：大改版（資料格式變動）
 *   次版號：新增功能
 *   修正號：小修正、調整外觀
 */
const APP_VERSION = '1.20.2';
const APP_UPDATED = '2026-11-24';
(function showVersion() {
  const el = document.getElementById('appVer');
  if (el) { el.textContent = `v${APP_VERSION}`; el.title = `班級儀表板 v${APP_VERSION}（更新於 ${APP_UPDATED}）`; }
  console.info(`班級儀表板 v${APP_VERSION}（${APP_UPDATED}）`);
})();
/* ---------------- 更新紀錄（v1.13.0） ----------------
 * 給老師看的白話更新說明（技術細節在 CHANGELOG.md）。每次改版在最上面加一筆：
 *   add 新增、change 修改、remove 移除、fix 修正（沒有就留空陣列）
 * 打開新版本時，比較「上次看過的版本」settings.seenVersion 和 APP_VERSION，
 * 不一樣就跳出一次「🆕 這次更新了什麼」，按「知道了」才記住。
 */
const RELEASE_NOTES = [
  { v: '1.20.2', d: '2026-11-24',
    add: [], change: ['GAS 程式碼框改成深色底、亮色等寬字，高度約 240px，可以上下左右捲動、反白；上方多一行說明共有幾行。'], remove: [],
    fix: ['「📅 學校行事曆」→「📖 GAS 程式碼與 3 分鐘設定步驟」裡的程式碼框看不到字（白底白字），只能按複製。現在打開就看得清楚，「📋 複製 GAS 程式碼」一樣可以用。'] },
  { v: '1.20.1', d: '2026-11-24',
    add: [], change: ['「📅 學校行事曆」的天數、搜尋、排除關鍵字輸入框改成和其他欄位一樣的深色底、淺色字，按 Enter 或離開欄位時才套用天數。'], remove: [],
    fix: ['「📅 學校行事曆」的「顯示天數」看起來打不進數字：其實有打進去，但框框是白底、字也是白色，所以看不到。現在看得清楚，可以反白、刪掉、直接打 14、3、30 或按上下微調；清空後離開會回到原本的天數，超過 30 會變成 30、小於 1 會變成 1。公告編輯畫面的搜尋框也一併修好。'] },
  { v: '1.20.0', d: '2026-11-24',
    add: [
      '📅 學校行事曆：把學校 Google 日曆接上儀表板（教師控制台多了「📅 學校行事曆」分頁）。只要部署一次 Google Apps Script（約 3 分鐘，步驟和程式碼都在分頁裡，可以一鍵複製），日曆不用公開。',
      '勾選要讓學生知道的活動，就會出現在首頁跑馬燈，例如「📅 今天 11/24（二） 08:30 朝會」「📅 明天 11/25（三） 校外教學」；過期的活動自動消失。',
      '點首頁公告打開的「基本資料」，手寫公告下面也可以直接勾選本週活動，和「📅 學校行事曆」分頁是同一份資料。'
    ],
    change: [
      '新抓到的活動預設「不勾」，避免老師的會議、研習誤上公告；可以用關鍵字搜尋、設定排除關鍵字（例如：教師, 會議, 研習），或「全選目前顯示」「全部取消」。',
      '顯示天數預設 7 天（今天起），可以改成 1～30 天。科任老師（多班級）每一班可以各自勾選要公告的活動；網址和活動資料所有班級共用。'
    ],
    remove: [],
    fix: [] },
  { v: '1.19.0', d: '2026-11-23',
    add: [
      '🎵 彩色轉盤倒數時，會一邊跳舞一邊播放跳舞音樂（重複播放）。按「暫停」音樂停住，再按「開始」接著播；時間到時先停音樂再響鈴，鈴聲聽得很清楚。',
      '計時器下面多了 🎵 按鈕，按一下就能關掉／打開跳舞音樂；教師控制台 → 基本資料 → 🎬 動畫效果 可以調整音量、試聽。'
    ],
    change: [
      '播放跳舞音樂時，環境音和「我的音樂」會先停下來，音樂停了以後自動恢復；監考時不播放。計時中如果您自己打開環境音或「我的音樂」，這一輪就改播您選的。',
      '中間換成自己的圖片、或系統設定「減少動態效果」時，知心不跳舞，但音樂照樣播（不想要可以按 🎵 關掉）。'
    ],
    remove: [],
    fix: [] },
  { v: '1.18.0', d: '2026-11-23',
    add: [
      '💃 彩色轉盤倒數時，知心會站在中間的圓上跳舞，一直跳到時間到；按「暫停」時停在當下的動作。時間到時知心跳一跳，鈴聲照常響。'
    ],
    change: [
      '轉盤上方的數字框改成放在轉盤上面、中間留空隙，不會再蓋住外圈的小燈泡；也預留了知心跳舞時頭和手的空間，跳舞時不會碰到數字框。',
      '電腦和 Android 平板用透明影片，iPad、iPhone 用動態圖片，看起來一樣。系統設定「減少動態效果」、或把中間換成自己的圖片時，不會跳舞（顯示原本的圖片）。'
    ],
    remove: [],
    fix: [] },
  { v: '1.17.0', d: '2026-11-23',
    add: [
      '🎡 倒數計時多了一種畫面「彩色轉盤」：一圈彩虹色塊和小燈泡，中間是知心，上方是剩下的時間。時間一點一點過去，色塊會從最上面開始一格一格變暗；計時中外圈的小燈泡會像跑馬燈一樣轉。時間到時知心會跳起來，鈴聲照常響。',
      '🖼️ 可以把轉盤中間的知心換成自己的圖片（例如班級吉祥物），也可以隨時換回知心。'
    ],
    change: [
      '在「教師控制台 → 基本資料 → 🎬 動畫效果」的「倒數計時的畫面」選「🎡 彩色轉盤」就能使用；原本的 3D 島嶼和簡潔畫面都沒有變，預設還是 3D 島嶼。',
      '自己的圖片只存在這台電腦的瀏覽器裡，不會放進備份檔；換電腦或還原備份後會先顯示知心，再上傳一次就好。'
    ],
    remove: [],
    fix: [] },
  { v: '1.16.0', d: '2026-11-20',
    add: [
      '🎌 國定假日：作息表在放假的日子會顯示「🎌 今天 行憲紀念日 放假」；整週課表、一週作業的放假日是紅色並寫上假日名稱；上方日期也會顯示假日名稱。資料是行政院人事行政總處公布的 2026、2027 年辦公日曆。',
      '🎌 跑馬燈公告會提前提醒放假，例如「🎌 6/9（三） 端午節 放假（還有 2 天）」；放假接上週末會合成一句連假（例如「🎌 明天起 12/25（五）～12/27（日） 行憲紀念日連假 3 天」）；有補班、補課時會提醒「⚠️ …補班，要上課」。',
      '🏫 本校自訂：在「教師控制台 → 🎌 假日」加入原住民族歲時祭儀、寒暑假、颱風假、校慶補假等放假日，或要補課的日子（可以選上星期幾的課）。'
    ],
    change: [
      '放假的平日不再當成上課日：科任老師的自動換班、整週課表不會排課；一週作業的「套用到每天」「複製到下一天」會跳過放假日；放假日的公告不列「尚未完成的每日任務」。',
      '「教師控制台 → 🎌 假日」可以設定公告提前幾天提醒（1／3／7 天，預設 3 天）、要不要提醒補班；2028 年以後的國定假日會在連上網路時自動下載（可以關掉）。'
    ],
    remove: [],
    fix: [] },
  { v: '1.15.0', d: '2026-11-20',
    add: [
      '🧩 應用中心多了三個嘉蘭的預設應用（排在「📝 監考」後面）：🏝️ 嘉蘭樂學島、🧰 嘉蘭工具箱（柯北老師會持續放進新工具）、📘 儀表板教學網。',
      '📘 教學網：最下面一排「❓ 說明」旁邊多了「📘 教學網」，用新分頁打開零基礎教學；「📜 更新紀錄」和這個視窗也有連結。'
    ],
    change: [
      '嘉蘭樂學島是 Google 協作平台，不允許放在儀表板裡，所以用新分頁打開；嘉蘭工具箱在儀表板裡打開；教學網用新分頁打開（學習進度才不會分開）。',
      '這三個預設應用沒有釘選，可以自己釘選、編輯或刪除；刪掉後不會再自動出現。'
    ],
    remove: [],
    fix: [] },
  { v: '1.14.0', d: '2026-11-19',
    add: [
      '🧩 應用中心：最下面一排多了「🧩 應用」，點開就能看到常用的教學網站，點一下就打開，不需要密碼。可以用分類（課堂／評量／班務／其他）篩選，應用多的時候還能搜尋。',
      '➕ 新增自己的網站：到「教師控制台 → 🧩 應用中心」按「＋ 新增應用」，填圖示、名稱、網址（https:// 開頭）、一句話說明、分類，選「在儀表板裡打開」或「用新分頁打開」。也可以編輯、刪除、調整順序、按「▶ 試開」先試試看。',
      '📌 釘選：最常用的應用可以釘選到最下面一排（最多 3 個）。螢幕比較窄時，釘選的按鈕會收進「🧩 應用」裡。'
    ],
    change: [
      '「📝 監考」變成應用中心裡的第一個內建應用：網址和「顯示按鈕」的設定都保留，按鈕還在原來的位置。',
      '在儀表板裡打開的網站，和監考一樣蓋住整個畫面、暫停環境音和音樂；按「✕ 回到儀表板」並確認才會關掉，按 Esc 不會關掉。',
      '有些網站不允許放在儀表板裡（畫面空白或顯示「拒絕連線」），這時按「↗ 用新分頁打開」，或把那個應用改成「用新分頁打開」。'
    ],
    remove: [],
    fix: [] },
  { v: '1.13.0', d: '2026-11-19',
    add: [
      '📒 金幣存摺：到「全班夥伴」點學生，就能看到「餘額／累計獲得／已兌換」和每一筆金幣紀錄（作業、任務、老師加扣分、兌換）。學生自己查不需要密碼。',
      '🎁 兌換獎品：在學生的金幣存摺按「🎁 兌換獎品」，或到「教師控制台 → 加扣金幣／兌換 → 🎁 兌換」。可以從獎品清單點選，也可以直接輸入獎品名稱和金幣。兌換和撤銷要教師密碼。',
      '🏷️ 獎品清單：在「教師控制台 → 加扣金幣／兌換 → 🏷️ 獎品清單」設定常用獎品和金幣，所有班級共用。',
      '📋 複製紀錄、⬇️ 下載 CSV：把一位學生的金幣紀錄貼到 Word／Excel，或下載成 Excel 打得開的檔案。',
      '🆕 更新說明：以後儀表板更新時會跳出這個視窗；想再看，點畫面下方的版本號，或到「教師控制台 → 📜 更新紀錄」。'
    ],
    change: [
      '兌換獎品扣金幣時，不會讓物種進度倒退，也不會讓班級山林變小（物種看的是「累計獲得」）。',
      '金幣不夠時不能兌換，會說明還差幾個金幣。兌換錯了可以「撤銷」，金幣會退回，紀錄保留並標上「已撤銷」。',
      '老師扣分超過學生現有的金幣時，紀錄會寫實際扣掉的數字（不會再出現扣的數字和餘額對不起來）。'
    ],
    remove: [],
    fix: [] },
  { v: '1.12.1', d: '2026-11-19',
    add: [], change: ['螢幕比較矮時，「倒數」的 3D 島嶼會縮小一點；分頁內容放不下時可以在框內上下捲動。'], remove: [],
    fix: ['中間的「現在時間／倒數／番茄鐘…」分頁有時變灰色、點不到，要先點「音量」才能點其他分頁。現在不會了。'] },
  { v: '1.12.0', d: '2026-11-19',
    add: ['作業檢查上方多了「✓ 完成」「✏️ 要訂正」「✗ 沒交」：先選狀態再點座號，預設「✓ 完成」，過關的同學點一下就好。'],
    change: ['點錯了，同一個座號再點一次就改回「沒交」（金幣也會收回）。'], remove: ['作業檢查不再用「點一下換下一個狀態」的循環方式。'], fix: [] },
  { v: '1.11.0', d: '2026-11-19',
    add: ['「倒數」變成會轉動的 🏝️ 3D 島嶼，最後 10 秒變紅、時間到動物跳起來。', '抽號有五種動畫：🎰 拉霸機、🎡 幸運轉盤、🥚 扭蛋機、🃏 翻牌、🐾 班寵抽號，預設每次隨機；可按「⏭ 跳過動畫」。'],
    change: ['「教師控制台 → 基本資料 → 🎬 動畫效果」可以把倒數改回「簡潔」、把抽號動畫關閉（舊平板比較順）。'], remove: [], fix: [] },
  { v: '1.10.0', d: '2026-11-19',
    add: ['最下面一排多了「📝 監考」：全畫面打開監考看板，不需要密碼；監考看板網址可在「教師控制台 → 基本資料」修改。'], change: [], remove: [], fix: [] },
  { v: '1.9.1', d: '2026-11-19',
    add: ['「我的音樂」新增「📂 加入資料夾」，一次加入整個資料夾的音樂。'], change: [],
    remove: [], fix: ['嵌在 Google 協作平台裡也能上傳本機音樂，重新整理後還能播（音樂會存一份在這個瀏覽器裡）。'] },
  { v: '1.9.0', d: '2026-11-19',
    add: ['🙋 點名：標記病假、事假、公假、曠課、遲到；首頁顯示今日缺席，抽號和每日任務會跳過缺席的同學。'],
    change: ['備份可以「📋 複製備份內容」和「📋 貼上備份內容還原」，嵌在協作平台裡也能備份。'], remove: [], fix: [] }
];
const NOTE_SECTIONS = [['add', '✨ 新增'], ['change', '🔧 修改'], ['remove', '🗑️ 移除'], ['fix', '🩹 修正']];
function cmpVer(a, b) {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
// 從上次看過的版本到現在之間的更新（沒有紀錄＝舊資料，只顯示最新一版）
function notesBetween(seen, cur = APP_VERSION) {
  if (!seen) { const n = RELEASE_NOTES.find(x => x.v === cur) || RELEASE_NOTES[0]; return n ? [n] : []; }
  return RELEASE_NOTES.filter(n => cmpVer(n.v, seen) > 0 && cmpVer(n.v, cur) <= 0);
}
function notesHTML(list) {
  return list.map(n => `<div class="rn-ver"><h3>v${esc(n.v)} <small>${esc(n.d)}</small></h3>${NOTE_SECTIONS.filter(([k]) => (n[k] || []).length).map(([k, label]) =>
    `<div class="rn-sec rn-${k}"><b>${label}</b><ul>${n[k].map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>`).join('');
}
let wnTimer = 0;
const whatsNewDue = () => !!state.settings.setupDone && state.settings.seenVersion !== APP_VERSION;
function markSeenVersion() { state.settings.seenVersion = APP_VERSION; save(); }
// 監考中、簡潔畫面、有其他視窗開著時先不跳，過一下再看
function maybeShowWhatsNew() {
  clearTimeout(wnTimer);
  if (!whatsNewDue()) return false;
  const list = notesBetween(state.settings.seenVersion);
  if (!list.length) { markSeenVersion(); return false; }
  const ask = $('#askConfirm');
  const busy = isExamOpen() || document.body.classList.contains('clean') || !$('#modal').classList.contains('hidden') || (ask && ask.style.display === 'flex') || (typeof drawAnim !== 'undefined' && drawAnim.busy);
  if (busy) { wnTimer = setTimeout(maybeShowWhatsNew, 3000); return false; }
  openWhatsNew(list);
  return true;
}
function openWhatsNew(list) {
  const seen = state.settings.seenVersion;
  openModal(`<h2>🆕 這次更新了什麼</h2>
    <p class="sub">${seen ? `從 v${esc(seen)} 更新到 v${APP_VERSION}。` : `目前版本 v${APP_VERSION}。`}看完按「知道了」，下次就不會再出現；想再看，點畫面下方的版本號，或到「教師控制台 → 📜 更新紀錄」。</p>
    <div class="rn-list">${notesHTML(list)}</div>
    <div class="modal-actions">${tutorialLinkHTML()}<button type="button" class="btn" id="wnAll">📜 看全部更新紀錄</button><button type="button" class="primary" id="wnOk">知道了</button></div>`, { wide: true });
  $('#wnOk').onclick = () => { markSeenVersion(); closeModal(); };
  $('#wnAll').onclick = () => { markSeenVersion(); openReleaseNotes(); };
}
function openReleaseNotes() {
  openModal(`<button class="close" data-close>✕</button>
    <h2>📜 更新紀錄</h2><p class="sub">目前版本 v${APP_VERSION}（${APP_UPDATED}）。新的在最上面。想從頭學怎麼用：${tutorialLinkHTML()}</p>
    <div class="rn-list">${notesHTML(RELEASE_NOTES)}</div>`, { wide: true });
}
const tutorialLinkHTML = (cls = 'btn') => `<a class="${cls} tut-link" href="${TUTORIAL_URL}" target="_blank" rel="noopener">📘 儀表板教學網（新分頁）</a>`;
function ctNotes(el) {
  el.innerHTML = `<p class="sub tut-row">想從頭學怎麼用儀表板？${tutorialLinkHTML()}</p><p class="sub">目前版本 <b>v${APP_VERSION}</b>（${APP_UPDATED}）。每次更新後第一次打開，會跳出「🆕 這次更新了什麼」。</p><div class="rn-list">${notesHTML(RELEASE_NOTES)}</div>`;
}
(function bindVersionBadge() {
  const el = document.getElementById('appVer'); if (!el) return;
  el.classList.add('clickable'); el.setAttribute('role', 'button'); el.tabIndex = 0;
  el.title += '・點一下看更新紀錄';
  el.onclick = () => openReleaseNotes();
  el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReleaseNotes(); } };
})();
wnTimer = setTimeout(maybeShowWhatsNew, 1200);
// 測試用 hook（正式畫面不依賴）
if (typeof globalThis !== 'undefined') {
  globalThis.__jlTest = {
    goto, renderWeekPlanner, renderTasksPage, weekdaysOf, weekRangeLabel, ensureWeekDraft, copyWeekLines, applyWeekPlan, applyTheme, THEMES,
    getWeekDraft: () => weekDraft,
    VoiceFilter: window.VoiceFilter,
    Fs: globalThis.__jlFs,
    
    APP_VERSION, askConfirm, addCoins, stu, fixStudentBook, fixClassBook, normalizePrizes, redeemCoins, undoRedemption, coinRecord, coinSummary, coinRecordText, coinRecordCSV, openCoinBook, openRedeem, renderStudents, CLASS_KEYS,
    RELEASE_NOTES, cmpVer, notesBetween, maybeShowWhatsNew, openWhatsNew, openReleaseNotes, whatsNewDue, getPtMode: () => ptMode, setPtMode: m => { ptMode = m; }, chooseDrawStyle, pickDrawSeat, startDraw, skipDrawAnim, closeDrawStage, getDrawAnim: () => drawAnim, getDrawn: () => drawn, DRAW_STYLES, DRAW_STYLE_KEYS, wheelTargetAngle, wheelPath, isl, islDraw, islVisible, islandMode, renderTimerStyle, updateIslPill, islFinish, islFrame, timer, wheelMode, whl, whlLit, whlSVG, whlHex, buildWheel, updateWheel, whlFinish, whlCharSrc, whlDance, whlDanceKind, whlIsAppleWebKit, whlVisible, whlStopDance, WHL_DANCE, dm, dmSync, dmStop, dmWanted, dmUserAudio, dmToggle, dmBtnClick, dmSetVol, dmVol, dmPreview, dmStopPreview, dmRestore, DM_SRC, DM_RESTORE_MS, getAmbCur: () => ambCur, getMusicPlayingId: () => musicPlayingId, setMusicPlayingId: v => { musicPlayingId = v; }, applyWheelChar, whlCharStateText, loadWheelChar, whlShrinkImage, setWheelChar, resetWheelChar, WHL_N, WHL_BULBS, WHL_DEFAULT_IMG, WHL_IDB_KEY, TIMER_STYLE_OPTIONS, timerSet, showTimer, idbGet, parseExamUrl, examUrl, openExam, closeExam, isExamOpen, renderExamBtn, DEFAULT_EXAM_URL, APP_UPDATED, HOL_BUILTIN, HOL_WORK_BUILTIN, HOL_CACHE_KEY, HOL_CDN, parseHolJSON, holYear, holCache, resetHolCache: () => { _holCache = null; }, refreshHolidays, schoolDayOn, dayInfo, isOffDay, isSchoolDay, effWd, nextSchoolDay, holRunAround, buildHolidayParts, upcomingHolidays, normalizeSchoolDays, holStatusText, upsertSchoolDay, deleteSchoolDay, ctHoliday, regularSchedule, todaySchedule, subjectOnDate, classOnDate, weekTableHTML, renderSchedule, renderHomeworkPanel, setSdEdit: v => { sdEditId = v; }, normalizeApps, defaultApps, JL_APPS, BUILTIN_APP_IDS, addMissingBuiltins, TUTORIAL_URL, syncExamMirror, appList, appById, pinnedApps, renderAppButtons, openApp, closeApp, openAppCenter, setAppPinned, moveApp, upsertApp, deleteApp, ctApps, APP_MAX_PINNED, appCategories, filterAppTiles, getAppCat: () => appCat, setAppCat: c => { appCat = c; }, setAppQuery: q => { appQuery = q; }, setApEdit: v => { apEditId = v; }, getExam: () => exam, defaultAnnouncement, isDefaultAnnouncement, migrateAnnouncement, OLD_DEFAULT_ANN, buildAnnParts, buildHwAnnParts, SCAL_GAS_CODE, scalDaysInput, scalDays, SCAL_CAL_ID, SCAL_DAYS_DEFAULT, defaultSchoolCal, normalizeSchoolCal, normalizeScalPicks, scalEvent, scalEvents, parseSchoolCal, scalUrl, parseScalUrl, scalRefresh, scalAuto, scalInRange, scalExcluded, scalVisible, scalWhen, buildSchoolCalParts, scalSetPick, scalPickVisible, scalClearPicks, scalStatusText, scalRender, scalCopyCode, ctSchoolCal, setScalQuery: q => { scalQuery = q; }, getScalQuery: () => scalQuery, newYearReset, markHwAllDone, markTaskAllDone, withClassName, buildCountdownParts, migrateTaskAnnounce, migrateHomework,
    todaySchedule, regularSchedule, applyDayOverride, clearDayOverride, getOverride, periodChanged, subjectOnDate, dateOfWeekday,
    normalizeMusic, parseMusicUrl, nameFromUrl, musicNextIndex, nextLoopMode, addUrlTrack, addFileTrackMeta, removeTrack, setMusicLoop, cycleMusicLoop, addMusicFiles, pickMusicFiles, pickMusicFolder, musicStoredSummary, musicUsesBrowserCopy, canPickMusicFolder, fmtMB, refreshMusicAvail, musicIdbGet: k => idbGet(k), MUSIC_MAX_FOLDER,
    musicStepId, musicAfterEndId, playTrack, stopMusic, pauseMusic, playAmbient, renderMusic, renderAmbient, refreshMusicAvail, idbGet, idbSet, idbDel, idbDelPrefix,
    getAmbCur: () => ambCur, getMusicPlayingId: () => musicPlayingId, getMusicMissing: () => [...musicMissing], musicMem,
    isBackupDue, lastDueSlot, nextBackupAt, backupDays, backupCfg, backupFileName, backupPayload, DEFAULT_BACKUP, maybeAutoBackup,
    folderUsable, backupTarget, saveSnapshot, listSnapshots, getSnapshot, pruneSnapshots, SNAP_KEEP, exportData, downloadText, copyText, showBackupText, restoreFromText, parseBackupText, openPasteRestore, pickBackupFolder, idbList,
    syncContactToHomework, openHomework, doneHomework, hwIsComplete, hwCounts, hwStatusOf,
    setHwStatus, cycleHwSeat, applyHwBrush, hwBrushOf, HW_BRUSH, HW_BRUSH_ORDER, renderHomeworkPanel, addManualHomework, HW_CYCLE, pad, dateKey,
    ATT, ATT_ABSENT, normalizeAttendance, pruneAttendance, setAttendance, markAllPresent, attendanceOf, absentSeats, attSummaryText, buildAttAnnPart,
    presentSeats, todayAttendance, renderAttChip, renderAll, openAttendance, todayRate, renderTaskWidget, renderDailyTaskPanel, isAuthed, setAuth, lockNow,
    ensureClasses, normalizeState, importBackupData, switchClass, checkAutoSwitch, periodAt, periodKey, addClass, deleteClass, moveClass, setClassMode,
    newYearReset, setupMultiClasses, ttClassOf, classOnDate, isMulti, curClassObj, classLabel, renderClassSwitch, openSetup, openConsole, activeSeats,
    getDrawn: () => drawn, setDrawn: a => { drawn = a; }, getAutoKey: () => autoKey,
    getState: () => state, setState: (s) => { state = s; }
  };
}
})();
