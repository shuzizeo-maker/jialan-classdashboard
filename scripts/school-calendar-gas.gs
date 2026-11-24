/**
 * 嘉蘭班級儀表板：📅 學校行事曆橋接（Google Apps Script 網頁應用程式）
 *
 * 用途：用「您自己的 Google 帳號」讀學校的 Google 日曆，回傳 JSON 給儀表板。
 *       日曆不用公開，也沒有 CORS 問題（儀表板直接 fetch 這個網址）。
 *
 * 3 分鐘設定：
 *   1. 用看得到學校日曆的 Google 帳號打開 https://script.google.com →「新專案」。
 *   2. 把這整個檔案貼進 Code.gs（取代原本的內容），按 💾 儲存。
 *      （日曆 ID 不同時，改下面的 CALENDAR_ID。）
 *   3. 右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」：
 *        執行身分：我（您的帳號）
 *        誰可以存取：所有人
 *      按「部署」→ 第一次會要求授權（選帳號 →「進階」→「前往（不安全）」→「允許」）。
 *   4. 複製「網頁應用程式網址」（https://script.google.com/macros/s/……/exec），
 *      貼到儀表板「教師控制台 → 📅 學校行事曆」，按「🔄 立即更新」。
 *   之後改了程式要「部署 → 管理部署作業 → ✏️ → 版本：新版本」，網址才會用到新程式。
 *
 * 網址參數：?days=N   今天起 N 天（含今天，預設 7，限制 1～30）
 * 回傳：{ ok: true, calendarName, updatedAt, days, events: [ { id, title, start, end, allDay, location } ] }
 *   start／end：全天活動是 YYYY-MM-DD（end＝最後一天，含當天）；有時間的是 YYYY-MM-DDTHH:mm；都是台灣時間。
 *   id：活動 ID＋'_'＋開始日期（重複活動每一次都可以分別勾選）。
 * 錯誤：{ ok: false, error: '說明' }
 * 只回傳標題、時間、地點，不回傳活動說明和參加者。
 */
var CALENDAR_ID = 'c_e5107a5c48d5f34dfbe44359b98e0fa6fe034002f45eae1e60cb8e8a7449e521@group.calendar.google.com';
var TZ = 'Asia/Taipei';
var DAY_MS = 24 * 60 * 60 * 1000;
var MAX_EVENTS = 300;

function doGet(e) {
  try {
    var days = parseDays_(e && e.parameter ? e.parameter.days : '');
    var cal = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!cal) {
      return json_({ ok: false, error: '找不到日曆：請確認 CALENDAR_ID，以及部署這個程式的帳號看得到這個日曆' });
    }
    // 台灣時間「今天 00:00:00」到「今天＋days−1 的 23:59:59」（台灣沒有日光節約時間）
    var todayKey = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    var start = new Date(todayKey + 'T00:00:00+08:00');
    var end = new Date(start.getTime() + days * DAY_MS - 1000);
    var list = cal.getEvents(start, end);
    var events = [];
    for (var i = 0; i < list.length && events.length < MAX_EVENTS; i++) {
      events.push(eventJson_(list[i]));
    }
    events.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    return json_({
      ok: true,
      calendarName: cal.getName(),
      updatedAt: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      days: days,
      events: events
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function parseDays_(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) n = 7;
  return Math.max(1, Math.min(30, n));
}

function eventJson_(ev) {
  var allDay = ev.isAllDayEvent();
  var start, end;
  if (allDay) {
    // 全天活動的日期以日曆的時區為準；結束日是「隔天 0 點」，減 1 毫秒變成最後一天
    var ctz = Session.getScriptTimeZone();
    var s = ev.getAllDayStartDate(), x = ev.getAllDayEndDate();
    start = Utilities.formatDate(s, ctz, 'yyyy-MM-dd');
    end = Utilities.formatDate(new Date(x.getTime() - 1), ctz, 'yyyy-MM-dd');
    if (end < start) end = start;
  } else {
    start = Utilities.formatDate(ev.getStartTime(), TZ, "yyyy-MM-dd'T'HH:mm");
    end = Utilities.formatDate(ev.getEndTime(), TZ, "yyyy-MM-dd'T'HH:mm");
  }
  return {
    id: ev.getId() + '_' + start.slice(0, 10),
    title: String(ev.getTitle() || '').trim(),
    start: start,
    end: end,
    allDay: allDay,
    location: String(ev.getLocation() || '').trim()
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
