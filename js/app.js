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
      announcement: '歡迎蒞臨臺東縣金峰鄉嘉蘭國民小學六年甲班',
      theme: 'default',
      maxSeat: 20,
      vacant: [],
      names: {},
      pwHash: '',
      loc: { name: '臺東縣 金峰鄉', lat: 22.60, lon: 120.96, source: 'openmeteo', cwaKey: '', cwaDataset: 'F-D0047-037', cwaTown: '金峰鄉' }
    },
    schedule: DEFAULT_SCHEDULE.map(r => ({ ...r })),
    timetable: {}, // { 1: { p1: '國語', ... }, ... 5: {...} }，1=星期一
    ttOverrides: {}, // { '2026-11-13': { periods:[{start,end,name,slot,subject}], note } }
    backup: { auto: false, freq: 'daily', weekdays: [5], time: '15:00', lastAt: '', lastName: '', lastError: '', folderName: '' },
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
    students: {},
    forest: { level: 1, points: 0 },
    log: [],
    ui: { widgetTask: 't1', pageTask: 't1', tasksTab: 'hw', showHwDone: false }
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
    const merged = { ...d, ...s, settings: { ...d.settings, ...s.settings, loc: { ...d.settings.loc, ...(s.settings?.loc || {}) } }, ui: { ...d.ui, ...s.ui }, forest: { ...d.forest, ...s.forest }, backup: { ...d.backup, ...(s.backup || {}) }, ttOverrides: (s.ttOverrides && typeof s.ttOverrides === 'object') ? s.ttOverrides : {}, music: normalizeMusic(s.music) };
    if (!Array.isArray(merged.homework)) merged.homework = [];
    migrateTaskAnnounce(merged);
    migrateHomework(merged);
    return merged;
  } catch (e) { console.warn(e); return defaults(); }
}
// 舊資料沒有 announce 欄位時：名稱含「訂正」的任務預設顯示在公告，其餘不顯示
function migrateTaskAnnounce(st) {
  if (!Array.isArray(st.taskDefs) || !st.taskDefs.length) return;
  if (st.taskDefs.some(t => 'announce' in t)) return;
  st.taskDefs.forEach(t => { t.announce = /訂正/.test(String(t.name || '')); });
}
/* ---------------- 作業檢查（資料層） ---------------- */
const HW_CYCLE = { miss: 'fix', fix: 'done', done: 'miss' };
const HW_LABEL = { miss: '沒交', fix: '要訂正', done: '完成' };
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
    return `<div class="week-day" data-date="${dk}" data-i="${i}">
      <div class="week-day-head"><b>週${DAYN[i]}</b><small>${m}/${d}</small></div>
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
    addCoins(seat, 1, '作業完成：' + h.title);
    h.coinAwarded[seat] = true;
  } else if (prev === 'done' && next !== 'done') {
    if (h.coinAwarded[seat]) {
      addCoins(seat, -1, '取消作業完成：' + h.title);
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
  seats.forEach(s => { if (!arr.includes(s)) { arr.push(s); addCoins(s, 1, '任務：' + taskName); n++; } });
  return n;
}
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

// 自製確認視窗：不用瀏覽器 confirm()，避免被嵌入框架（如 Google 協作平台）或瀏覽器擋掉
function askConfirm(msg, okText = '確定') {
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

/* ---------------- 頂部 ---------------- */
// 組成跑馬燈片段：老師公告 + 每日任務自動則 + 作業未繳／待訂正（不寫入 settings.announcement）
// 歡迎詞裡出現校名、但後面沒接班級時，自動補上班級（例：嘉蘭國民小學 → 嘉蘭國民小學六年甲班）
function withClassName(text, school, className) {
  if (!text || !school || !className) return text || '';
  const segs = text.split(school);
  return segs.reduce((acc, seg, i) => i === 0 ? seg : acc + school + (seg.trimStart().startsWith(className) ? '' : className) + seg, '');
}
// 倒數日 → 跑馬燈：取最近 3 個還沒過的事件
function buildCountdownParts(countdowns, max = 3) {
  return (countdowns || []).filter(c => c && c.name && c.date)
    .map(c => ({ c, d: daysUntil(c.date) })).filter(x => x.d >= 0)
    .sort((a, b) => a.d - b.d).slice(0, max)
    .map(({ c, d }) => d === 0 ? `⏳ 今天就是${c.name}！` : `⏳ 距離${c.name}還有 ${d} 天`);
}
function buildAnnParts(announcement, taskDefs, seats, doneRec, homework, countdowns) {
  const ann = (announcement || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  ann.push(...buildCountdownParts(countdowns));
  const auto = [];
  if (seats.length) {
    (taskDefs || []).forEach(t => {
      if (!t.announce) return;
      const done = new Set(doneRec[t.id] || []);
      const miss = seats.filter(n => !done.has(n));
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
  $('#className').textContent = s.className;
  document.title = `${s.className}｜班級儀表板`;
  const seats = activeSeats();
  const parts = buildAnnParts(withClassName(s.announcement, s.school, s.className), state.taskDefs, seats, todayDone(), state.homework, state.countdowns);
  const text = parts.length ? parts.join('　　★　　') : '（尚無公告，老師可以點這裡輸入）';
  const annEl = $('#annText');
  // 文字沒變就別重畫，避免跑馬燈動畫每秒重來
  if (annEl.dataset.key !== text) {
    annEl.dataset.key = text;
    if (parts.length) {
      // 依公告類型上高亮色：老師公告＝螢光黃、未繳＝亮粉紅、待訂正＝亮橘、每日任務未完成＝亮青
      annEl.innerHTML = parts.map(p => {
        const c = p.startsWith('📕') ? 'ann-miss' : p.startsWith('✏️') ? 'ann-fix' : p.startsWith('📝') ? 'ann-task' : p.startsWith('⏳') ? 'ann-cd' : 'ann-note';
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
// 平常的課表（不看當天調課）：該天課表有填 → 依課表（空格=沒課）；該天課表全空 → 依作息表的「星期」欄
function regularSchedule(d = new Date()) {
  const wd = d.getDay(), wdc = WEEK[wd], tt = dayTT(wd), useTT = hasTT(wd);
  return state.schedule
    .filter(r => r.slot ? (useTT ? !!String(tt[r.slot] || '').trim() : (r.days || '').includes(wdc)) : (!r.days || r.days.includes(wdc)))
    .map(r => ({ start: r.start, end: r.end, name: r.name, slot: r.slot || '', subject: r.slot ? String(tt[r.slot] || '').trim() : '' }))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
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
    periods: (periods || []).map(r => ({
      start: r.start, end: r.end, name: String(r.name || '').trim(),
      slot: r.slot || inferSlot(r.name) || '', subject: String(r.subject || '').trim()
    })),
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
  return b.subject !== r.subject || b.start !== r.start || b.end !== r.end || b.name !== r.name;
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
  return String(dayTT(d.getDay())[slot] || '').trim();
}

const periodLabel = r => r.subject ? `${r.name}・${r.subject}` : r.name;
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
    } else { noteEl.style.display = 'none'; noteEl.textContent = ''; }
  }
  const box = $('#nowPeriod');
  if (!list.length) {
    $('#schedList').innerHTML = '';
    if (ov) box.innerHTML = `<div class="np-name">今天沒有排課</div><div class="np-sub">${ov.note ? esc(ov.note) : '已用臨時調課清空今天的節次。'}</div>`;
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
    return `<li class="${cls}${ch ? ' adj' : ''}"><span>${r.start}–${r.end}</span><span>${r.subject ? `<small class="sl-slot">${esc(r.name)}</small> <b>${esc(r.subject)}</b>` : esc(r.name)}${ch ? '<i class="adj-tag">調</i>' : ''}</span></li>`;
  }).join('');
  if (cur) {
    const left = Math.max(0, toMin(cur.end) - now);
    box.innerHTML = `<div class="np-sub">現在是</div><div class="np-name">${periodHTML(cur)}</div>
      <div class="np-sub">還有 ${Math.floor(left)} 分 ${pad(Math.floor((left % 1) * 60))} 秒${next ? `・下一節：${esc(periodLabel(next))}` : ''}</div>
      <div class="bar"><i style="width:${(now - toMin(cur.start)) / (toMin(cur.end) - toMin(cur.start)) * 100}%"></i></div>`;
  } else if (next) {
    const left = toMin(next.start) - now;
    box.innerHTML = `<div class="np-sub">下課／休息中</div><div class="np-name">下一節：${periodHTML(next)}</div>
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
    const ov = getOverride(dates[w]);
    return `<th class="${w === today ? 'today' : ''}${ov ? ' has-adj' : ''}">星期${WEEK[w]}${ov ? ' <i class="adj-tag">調</i>' : ''}</th>`;
  }).join('')}</tr></thead>
    <tbody>${rows.map(s => `<tr><th>${slotName(s)}<small>${slotTime(s)}</small></th>${[1, 2, 3, 4, 5].map(w => {
      const ov = getOverride(dates[w]);
      const v = subjectOnDate(dates[w], s);
      const orig = String(dayTT(w)[s] || '').trim();
      const ch = ov && v !== orig;
      return `<td class="${w === today ? 'today' : ''} ${w === today && s === curSlot ? 'now' : ''} ${v ? '' : 'none'}${ch ? ' adj' : ''}">${esc(v) || '—'}${ch ? '<i class="adj-tag">調</i>' : ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
}
$('#weekBtn') && ($('#weekBtn').onclick = () => openModal(`<button class="close" data-close>✕</button>
  <h2>📅 ${esc(state.settings.className)} 週課表</h2><p class="sub">${esc(termText())}　今天的欄位以綠色標示，正在上的課會發亮。本週有調課的日子會標上「調」。</p>
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
    <div class="adj-head"><span>開始</span><span>結束</span><span>節次</span><span>科目</span><span></span></div>
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
      subject: $('[data-k=subject]', er).value.trim()
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
      return `<div class="adj-row${ch ? ' changed' : ''}" data-i="${i}" data-slot="${esc(r.slot || '')}">
        <input type="time" data-k="start" value="${esc(r.start || '')}">
        <input type="time" data-k="end" value="${esc(r.end || '')}">
        <input data-k="name" value="${esc(r.name || '')}" placeholder="第一節">
        <input data-k="subject" value="${esc(r.subject || '')}" placeholder="科目（空白=該節沒課）" list="adjSubjects">
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
    rows.push({ start, end, name: '', slot: '', subject: '' });
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
      periods.every((r, i) => r.start === base[i].start && r.end === base[i].end && r.name === base[i].name && r.subject === base[i].subject);
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
  $('#wDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日　星期${WEEK[d.getDay()]}`;
  const cur = renderSchedule();
  const sub = cur ? (toMin(cur.start) <= d.getHours() * 60 + d.getMinutes() ? `現在：${periodLabel(cur)}` : `下一節：${periodLabel(cur)}（${cur.start}）`) : `星期${WEEK[d.getDay()]}`;
  $('#clockSub').textContent = sub;
  if (document.body.classList.contains('clean')) {
    $('#cleanClock').innerHTML = `<div class="cc-time">${hh}:${mm}</div><div class="cc-sub">${esc(state.settings.className)}・${esc(sub)}</div><div class="cc-hint">點一下畫面回到儀表板</div>`;
  }
  if (d.getSeconds() === 0) {
    updateSky();
    if (d.getMinutes() % 30 === 0) loadWeather();
    if (d.getHours() === 0 && d.getMinutes() === 0) renderAll();
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
$('#ambList').addEventListener('click', e => { const li = e.target.closest('li'); if (li) playAmbient(li.dataset.id); });
$('#ambVol').addEventListener('input', e => {
  if (ambGain) ambGain.gain.value = e.target.value / 100 * .6;
  const a = musicAudio(); if (a) a.volume = musicVolume();
});

/* ---------------- 我的音樂（播放器） ----------------
 * 本機檔：Chrome／Edge 用 showOpenFilePicker，把檔案 handle 存在 IndexedDB（重新整理後從原位置再讀）；
 * 其他瀏覽器或嵌在協作平台裡：改用一般檔案選擇，副本存在這台電腦瀏覽器的 IndexedDB。
 * 都不會上傳到伺服器。
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
  musicMissing.delete(id); musicNeedPerm.delete(id); delete musicMem[id];
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
  if (inIframe()) toast('目前嵌在別的網頁裡，改用一般上傳（音樂會存在這台電腦的瀏覽器）。想直接讀電腦裡的檔案，請用新分頁打開儀表板。', 5000);
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
async function addMusicFiles(files, replaceId = '') {
  let n = 0, skip = 0, mem = 0;
  for (const f of files || []) {
    if (!isAudioFile(f)) { skip++; continue; }
    let t;
    if (replaceId && musicTrack(replaceId)) {
      t = musicTrack(replaceId);
      Object.assign(t, { name: musicFileName(f.name), kind: 'file', store: 'blob', size: f.size || 0, type: f.type || '' });
      if (musicPlayingId === replaceId) stopMusic(true);
      idbDel('musicFile_' + t.id);
      musicMissing.delete(t.id); musicNeedPerm.delete(t.id);
    } else t = addFileTrackMeta({ name: f.name, size: f.size, type: f.type, store: 'blob' });
    musicMem[t.id] = f;
    try { await idbSet('musicBlob_' + t.id, f); } catch (e) { mem++; }
    n++;
  }
  save(); renderMusic();
  if (n) toast(replaceId ? '✅ 已重新指定檔案' : `✅ 已加入 ${n} 首（存在這台電腦的瀏覽器裡，不會上傳）`);
  if (mem) toast(`瀏覽器空間不足，有 ${mem} 首重新整理後要重新選擇`, 3500);
  if (skip) toast(`有 ${skip} 個檔案不是音樂檔，已略過`);
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
  const em = $('#musicEmpty'); if (em) em.style.display = list.length ? 'none' : '';
  ul.style.display = list.length ? '' : 'none';
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
  const seats = activeSeats();
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
    const done = new Set(todayDone()[id] || []);
    n = seats.filter(s => done.has(s)).length;
    const miss = seats.filter(s => !done.has(s));
    missHtml = !seats.length ? '' : miss.length ? `尚未完成：<b>${miss.map(s => pad(s)).join('、')}</b>` : '🎉 全班都完成了！';
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
  const rec = todayDone(), seats = activeSeats();
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
  $('#seatGrid').innerHTML = seats.map(s => `<button class="seat ${done.has(s) ? 'done' : ''}" data-seat="${s}"><b>${pad(s)}</b><small>${esc(nameOf(s)) || '&nbsp;'}</small></button>`).join('');
}
function renderHomeworkPanel() {
  const seats = activeSeats();
  const open = openHomework();
  const box = $('#hwOpenList');
  if (!box) return;
  if (!open.length) {
    box.innerHTML = '<p class="hint">目前沒有待檢查的作業。今天聯絡簿新增的項目，<b>明天</b>才會出現在這裡；也可按「＋ 補登作業」。</p>';
  } else {
    box.innerHTML = open.map(h => hwCardHTML(h, seats)).join('');
  }
  const done = doneHomework();
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
    <p class="hw-legend">點座號循環：<span class="lg-miss">沒交</span> → <span class="lg-fix">要訂正</span> → <span class="lg-done">完成</span>（完成 +1 金幣）</p>
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
    const seats = activeSeats();
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
  if (i >= 0) { arr.splice(i, 1); addCoins(seat, -1, '取消打卡'); }
  else { arr.push(seat); addCoins(seat, 1, '任務：' + (state.taskDefs.find(t => t.id === tid)?.name || '')); ensureAudio(); chime(); }
  save(); renderDailyTaskPanel(); renderTaskWidget(); renderHeader();
  const nb = $(`#seatGrid .seat[data-seat="${seat}"]`); nb && nb.classList.add('pop');
});
// 作業座號循環點擊（事件委派在作業列表）
document.addEventListener('click', e => {
  const b = e.target.closest('#hwOpenList .seat, #hwDoneList .seat');
  if (!b) return;
  const h = state.homework.find(x => x.id === b.dataset.hw); if (!h) return;
  const seat = +b.dataset.seat;
  const next = cycleHwSeat(h, seat);
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
    keys.slice(1).forEach(dk => { weekDraft.lines[dk] = src.slice(); });
    renderWeekPlanner(); toast('已套用到週二～週五（尚未儲存）');
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
    weekDraft.lines[keys[i + 1]] = src.length ? src.slice() : [''];
    renderWeekPlanner(); toast('已複製到下一天（尚未儲存）');
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
  let rows = state.taskDefs.map(t => ({ ...t, announce: !!t.announce }));
  const draw = () => {
    $('#tkRows').innerHTML = rows.map((t, i) => `<div class="er task" data-i="${i}">
      <input value="${esc(t.name)}" placeholder="任務名稱" data-k="name">
      <label class="ann-chk" title="今天還沒打卡的座號會自動出現在左上角跑馬燈"><input type="checkbox" data-k="announce"${t.announce ? ' checked' : ''}>顯示在公告</label>
      <button data-del="${i}">✕</button></div>`).join('');
  };
  el.innerHTML = `<p class="sub">每天都會出現的打卡任務。學生每完成一項 +1 金幣、班級山林 +1。（刪除任務不會影響已得到的金幣）</p>
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

const DEFAULT_BACKUP = { auto: false, freq: 'daily', weekdays: [5], time: '15:00', lastAt: '', lastName: '', lastError: '', folderName: '' };
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
  return `班級儀表板_${state.settings.className || '班級'}_${tag}_${dateKey()}.json`;
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
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
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

function canPickFolder() { return typeof window.showDirectoryPicker === 'function'; }
async function pickBackupFolder() {
  if (!canPickFolder()) {
    toast('這個瀏覽器不能指定資料夾，請改用 Chrome 或 Edge');
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({ id: 'jl-backup', mode: 'readwrite', startIn: 'documents' });
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { toast('沒有寫入這個資料夾的權限'); return null; }
    await idbSet('backupDir', handle);
    state.backup = { ...backupCfg(), folderName: handle.name };
    save();
    return handle;
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    if ((e && e.name === 'SecurityError') || inIframe()) {
      showBackupBanner('embedded');
      toast('目前是嵌在別的網頁裡，無法選擇資料夾。請用「開新分頁」打開儀表板再設定。');
      return null;
    }
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
  if (kind === 'embedded') {
    msg.textContent = '自動備份要在獨立分頁才能指定資料夾。請先用新分頁打開儀表板。';
    go.style.display = 'none';
  } else if (kind === 'nofolder') {
    msg.textContent = '自動備份已開啟，但還沒指定資料夾。';
    go.textContent = '選擇資料夾並備份';
    go.style.display = '';
  } else {
    msg.textContent = '今日的自動備份需要你按一下，授權寫入備份資料夾。';
    go.textContent = '授權並備份';
    go.style.display = '';
  }
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
  try {
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
    if (fromUser) toast('❌ 寫入資料夾失敗，請重新選擇資料夾，或改用手動備份');
    return false;
  } finally { _backupBusy = false; }
}

function backupStatusText(cfg) {
  const last = cfg.lastAt ? fmtWhen(new Date(cfg.lastAt)) : '尚未備份';
  const next = cfg.auto ? fmtWhen(nextBackupAt(cfg)) : '（未啟用）';
  const folder = cfg.folderName ? `資料夾「${cfg.folderName}」` : '還沒指定資料夾';
  const freq = (cfg.freq || 'daily') === 'weekly'
    ? `每週星期${(backupDays(cfg)).map(d => WEEK[d]).join('、')} ${cfg.time || '15:00'}`
    : `每日 ${cfg.time || '15:00'}`;
  return { last, next, folder, freq };
}
function ctData(el) {
  const cfg = backupCfg();
  const st = backupStatusText(cfg);
  const wdBtns = [1, 2, 3, 4, 5, 6, 0].map(d =>
    `<button type="button" class="btn wd${(cfg.weekdays || []).includes(d) ? ' active' : ''}" data-wd="${d}">${WEEK[d]}</button>`
  ).join('');
  el.innerHTML = `
    <h4 style="margin:0 0 8px">手動備份</h4>
    <p class="sub">立刻下載一份 JSON 備份檔到電腦（通常在「下載」資料夾）。換電腦、換瀏覽器或清除紀錄前，請先做一次。也可以隨時用來還原。「我的音樂」只會備份清單（曲名、網址），不含音檔本身。</p>
    <div class="btn-row" style="justify-content:flex-start">
      <button class="btn" id="dExport">⬇️ 手動備份（下載檔案）</button>
      <label class="btn" style="cursor:pointer">⬆️ 還原備份檔<input type="file" id="dImport" accept=".json,application/json" hidden></label>
    </div>

    <h4 style="margin:22px 0 8px">自動備份</h4>
    <p class="sub">啟用後，到了指定時間會把備份寫進你選的資料夾。網頁要開著才會當場寫入；如果那時沒開，下次打開儀表板時會補做一次。請使用 Chrome 或 Edge。瀏覽器只會記住資料夾本身，不會顯示完整路徑（例如 C:\…），這是瀏覽器的安全限制。</p>
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
      <div class="field"><span>備份資料夾</span>
        <div class="btn-row" style="justify-content:flex-start;align-items:center;flex-wrap:wrap">
          <button type="button" class="btn" id="bkPick">📁 ${cfg.folderName ? '更改資料夾' : '選擇資料夾'}</button>
          <span class="sub" id="bkFolder" style="margin:0">${esc(st.folder)}</span>
        </div>
      </div>
      <p class="sub" id="bkStatus">上次備份：${esc(st.last)}　下次：${esc(st.next)}　${esc(st.freq)}</p>
      <button type="button" class="btn" id="bkNow">⬇️ 立刻備份到這個資料夾</button>
    </div>

    <h4 style="margin:22px 0 8px">變更密碼</h4>
    <div class="row3">
      <input class="mini-input" id="dOld" type="password" placeholder="目前密碼">
      <input class="mini-input" id="dNew" type="password" placeholder="新密碼（至少 4 碼）">
      <button class="btn" id="dPw">變更密碼</button>
    </div>
    <div class="danger-zone">
      <h4>🎓 新學年／換班級</h4>
      <p class="sub">會先自動下載一份備份，然後清空：學生金幣與物種、任務打卡紀錄、聯絡簿、加扣分紀錄、班級山林等級、學生名單。<br>保留：學校名稱、作息表、每日任務、倒數日、我的音樂、密碼。接著會帶你設定新班級。</p>
      <button class="btn danger" id="dNewYear">開始新學年</button>
      <h4 style="margin-top:18px">完全重設</h4>
      <p class="sub">清除所有資料（包含密碼），回到第一次使用的狀態。</p>
      <button class="btn danger" id="dWipe">完全重設</button>
    </div>
    <div class="modal-actions"><button class="btn" id="dLogout">🔓 登出教師模式</button></div>`;

  const refreshStatus = () => {
    const c = backupCfg();
    const s = backupStatusText(c);
    const stEl = $('#bkStatus'); if (stEl) stEl.textContent = `上次備份：${s.last}　下次：${s.next}　${s.freq}`;
    const fo = $('#bkFolder'); if (fo) fo.textContent = s.folder;
  };
  const saveBk = (patch, { reopen } = {}) => {
    state.backup = { ...backupCfg(), ...patch };
    if (!state.backup.time) state.backup.time = '15:00';
    save();
    if (reopen) openConsole('data');
    else refreshStatus();
  };
  $('#dExport').onclick = () => exportData();
  $('#dImport').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.settings || !d.students) throw new Error('格式不符');
        askConfirm(`要用備份檔「${f.name}」取代目前全部資料嗎？`, '還原').then(ok => {
          if (!ok) return;
          state = { ...defaults(), ...d, settings: { ...defaults().settings, ...d.settings } };
          if (!Array.isArray(state.homework)) state.homework = [];
          if (!state.ttOverrides || typeof state.ttOverrides !== 'object') state.ttOverrides = {};
          state.backup = { ...DEFAULT_BACKUP, ...(d.backup || {}) };
          state.music = normalizeMusic(d.music);
          migrateTaskAnnounce(state);
          migrateHomework(state);
          setAuth();
          stopMusic(); musicMissing.clear();
          save(); renderAll(); renderMusic(); loadWeather();
          const nFile = state.music.tracks.filter(t => t.kind === 'file').length;
          if (nFile) {
            toast(`✅ 已還原備份。備份只含音樂清單，不含音檔本身；有 ${nFile} 首本機音樂若顯示「請重新指定」，請重新選擇檔案`, 6000);
            refreshMusicAvail();
          } else toast('✅ 已還原備份');
          openConsole('data');
        });
      } catch (err) { toast('❌ 這不是正確的備份檔'); }
    };
    r.readAsText(f);
  };
  $('#bkAuto').onchange = async () => {
    if ($('#bkAuto').checked) {
      if (!backupCfg().folderName) {
        const handle = await pickBackupFolder();
        if (!handle) { $('#bkAuto').checked = false; return; }
      }
      saveBk({ auto: true }, { reopen: true });
      toast('✅ 已啟用自動備份（' + backupStatusText(backupCfg()).freq + '）');
      maybeAutoBackup(true);
    } else {
      saveBk({ auto: false }, { reopen: true });
      hideBackupBanner();
      toast('已關閉自動備份，手動備份仍可使用');
    }
  };
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
  });
  $('#bkNow') && ($('#bkNow').onclick = async () => {
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
    askConfirm('確定要開始新學年？目前班級的學生資料會被清空（會先下載備份）。', '開始新學年').then(ok => {
      if (!ok) return;
      exportData('學年結束備份');
      Object.assign(state, { students: {}, done: {}, contact: {}, homework: [], log: [], forest: { level: 1, points: 0 }, ttOverrides: {} });
      Object.assign(state.settings, { names: {}, vacant: [], schoolYear: '', semester: '' });
      save(); renderAll();
      toast('✅ 已清空，請設定新班級資料', 3000);
      openConsole('basic');
    });
  };
  $('#dWipe').onclick = () => {
    askConfirm('確定要清除「全部」資料嗎？此動作無法復原。', '下一步').then(ok => {
      if (!ok) return;
      const t = prompt('請輸入「確定重設」四個字');
      if (t !== '確定重設') return;
      stopMusic();
      localStorage.removeItem(KEY); sessionStorage.removeItem('jl-auth');
      state.music = normalizeMusic(null);
      idbDelPrefix('music').finally(() => location.reload());
    });
  };
  $('#dLogout').onclick = () => { lockNow(); closeModal(); toast('🔒 已上鎖'); };
}
function exportData(tag = '手動備份') {
  const blob = new Blob([backupPayload()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = backupFileName(tag);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('✅ 已下載「' + backupFileName(tag) + '」');
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
    if (isZoomMode()) { setZoomMode(false); return; }
    if (!$('#modal').classList.contains('hidden') && !celebrateQueue.running) closeModal();
  }
});

// 測試用：iframe／全螢幕可用性判斷
if (typeof globalThis !== 'undefined') {
  globalThis.__jlFs = { inIframe, fsEnabled, fsElement, setZoomMode, isZoomMode, openFullscreenNewTab, updateFsButtons };
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
  renderHeader(); renderSchedule(); renderContact(); renderCountdowns(); renderTaskWidget(); renderCritters();
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
tick();
setInterval(tick, 1000);
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
const APP_VERSION = '1.7.0';
const APP_UPDATED = '2026-11-13';
(function showVersion() {
  const el = document.getElementById('appVer');
  if (el) { el.textContent = `v${APP_VERSION}`; el.title = `班級儀表板 v${APP_VERSION}（更新於 ${APP_UPDATED}）`; }
  console.info(`班級儀表板 v${APP_VERSION}（${APP_UPDATED}）`);
})();
// 測試用 hook（正式畫面不依賴）
if (typeof globalThis !== 'undefined') {
  globalThis.__jlTest = {
    goto, renderWeekPlanner, renderTasksPage, weekdaysOf, weekRangeLabel, ensureWeekDraft, copyWeekLines, applyWeekPlan, applyTheme, THEMES,
    getWeekDraft: () => weekDraft,
    VoiceFilter: window.VoiceFilter,
    Fs: globalThis.__jlFs,
    
    APP_VERSION, askConfirm, buildAnnParts, buildHwAnnParts, markHwAllDone, markTaskAllDone, withClassName, buildCountdownParts, migrateTaskAnnounce, migrateHomework,
    todaySchedule, regularSchedule, applyDayOverride, clearDayOverride, getOverride, periodChanged, subjectOnDate, dateOfWeekday,
    normalizeMusic, parseMusicUrl, nameFromUrl, musicNextIndex, nextLoopMode, addUrlTrack, addFileTrackMeta, removeTrack, setMusicLoop, cycleMusicLoop,
    musicStepId, musicAfterEndId, playTrack, stopMusic, pauseMusic, playAmbient, renderMusic, renderAmbient, refreshMusicAvail, idbGet, idbSet, idbDel, idbDelPrefix,
    getAmbCur: () => ambCur, getMusicPlayingId: () => musicPlayingId, getMusicMissing: () => [...musicMissing], musicMem,
    isBackupDue, lastDueSlot, nextBackupAt, backupDays, backupCfg, backupFileName, backupPayload, DEFAULT_BACKUP, maybeAutoBackup,
    syncContactToHomework, openHomework, doneHomework, hwIsComplete, hwCounts, hwStatusOf,
    setHwStatus, cycleHwSeat, addManualHomework, HW_CYCLE, pad, dateKey,
    getState: () => state, setState: (s) => { state = s; }
  };
}
})();
