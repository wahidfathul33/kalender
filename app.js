const API_URL = 'https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.min.json';

const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];
const DAY_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const DAY_LONG  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

let holidays = {};
let currentYear = 2026;
let currentMonth = new Date().getMonth();
let currentView = 'month'; // 'year' | 'month'

const today = new Date();
today.setHours(0, 0, 0, 0);

// ── Dark mode ───────────────────────────────────────────
function applyDark(dark) {
  document.documentElement.classList.toggle('dark', dark);
  document.getElementById('dmIcon').className = dark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.setAttribute('content', dark ? '#0f172a' : '#f1f5f9');
  });
}
function toggleDark() {
  const dark = !document.documentElement.classList.contains('dark');
  localStorage.setItem('darkMode', dark ? '1' : '');
  applyDark(dark);
}
// init from saved preference or system preference
const savedDark = localStorage.getItem('darkMode');
if (savedDark === '1' || (savedDark === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  applyDark(true);
}

// ── Collapsible holiday toggle ───────────────────────────────
function toggleHl(btn) {
  const extras = btn.closest('.month-holidays').querySelectorAll('.mhl-extra');
  const expanded = btn.dataset.expanded === '1';
  extras.forEach(el => el.style.display = expanded ? '' : 'flex');
  btn.dataset.expanded = expanded ? '' : '1';
  btn.textContent = expanded ? btn.dataset.label : 'Sembunyikan';
}

// ── Fetch ──────────────────────────────────────────────
const CACHE_KEY = 'holiday_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchHolidays() {
  // Try localStorage cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        holidays = data;
        return;
      }
    }
  } catch (_) {}

  // Fetch with 8-second timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    delete raw.info;
    holidays = raw;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: holidays }));
    } catch (_) {}
  } catch (e) {
    console.warn('Gagal memuat data hari libur:', e.message);
    holidays = {};
  }
}

// ── Helpers ────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

// ── Build one month card ───────────────────────────────
function buildMonth(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Day-header row
  let headerHtml = DAY_SHORT.map((d, i) =>
    `<div class="dh${i===0?' sun':i===6?' sat':''}">${d}</div>`
  ).join('');

  // Leading cells — prev month dates
  const prevTotalDays = new Date(year, month, 0).getDate();
  let cells = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push(`<div class="dc muted">${prevTotalDays - i}</div>`);
  }
  const monthHolidays = [];

  for (let d = 1; d <= totalDays; d++) {
    const key = dateKey(year, month, d);
    const dow = new Date(year, month, d).getDay();
    const info = holidays[key];
    const isToday = (year === today.getFullYear() && month === today.getMonth() && d === today.getDate());

    let cls = 'dc';
    if (isToday) cls += ' is-today';
    else if (!info && dow === 0) cls += ' sun';
    else if (!info && dow === 6) cls += ' sat';

    if (info) {
      if (info.holiday) cls += ' is-holiday';
      else cls += ' is-event';
      monthHolidays.push({ d, info });
    }

    cells.push(`<div class="${cls}">${d}</div>`);
  }

  // Trailing cells — next month dates
  const trailingCount = (7 - ((firstDow + totalDays) % 7)) % 7;
  for (let i = 1; i <= trailingCount; i++) {
    cells.push(`<div class="dc muted">${i}</div>`);
  }

  // Inline holiday list — visible count based on number of weeks in month
  const numWeeks = Math.ceil((firstDow + totalDays) / 7);
  let visibleCount, threshold;
  if (numWeeks <= 4)       { visibleCount = 3; threshold = 4; }
  else if (numWeeks === 5) { visibleCount = 2; threshold = 3; }
  else                     { visibleCount = 0; threshold = 1; }

  let hlHtml = '';
  if (monthHolidays.length > 0) {
    const needToggle = monthHolidays.length > threshold;
    const showCount = needToggle ? visibleCount : monthHolidays.length;
    const allItems = monthHolidays.map(({ d, info }, idx) => {
      const type = info.holiday ? 'hol' : 'evt';
      const extraCls = idx >= showCount ? ' mhl-extra' : '';
      return `<div class="mhl-item${extraCls}">
        <span class="mhl-day ${type}">${d}</span>
        <span class="mhl-text">${info.summary[0]}</span>
      </div>`;
    }).join('');
    const toggleId = `tog-${year}-${month}`;
    const hiddenItems = monthHolidays.slice(showCount);
    const hiddenHol = hiddenItems.filter(x => x.info.holiday).length;
    const hiddenEvt = hiddenItems.filter(x => !x.info.holiday).length;
    const parts = [];
    if (hiddenHol > 0) parts.push(`${hiddenHol} hari libur`);
    if (hiddenEvt > 0) parts.push(`${hiddenEvt} perayaan`);
    const toggleLabel = `+ ${parts.join(', ')}`;
    const toggleBtn = needToggle
      ? `<button class="mhl-toggle" id="${toggleId}" onclick="toggleHl(this)" data-label="${toggleLabel}">${toggleLabel}</button>`
      : '';
    hlHtml = `<div class="month-holidays">${allItems}${toggleBtn}</div>`;
  }

  const col = document.createElement('div');
  col.className = 'col-12 col-md-4 col-lg-3';
  col.innerHTML = `
    <div class="month-card">
      <div class="month-name">${MONTH_NAMES[month]} ${year}</div>
      <div class="month-body">
        <div class="day-grid">
          ${headerHtml}
          ${cells.join('')}
        </div>
      </div>
      ${hlHtml}
    </div>`;
  return col;
}

// ── Build full calendar (year view) ────────────────────
function buildCalendar(year) {
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    grid.appendChild(buildMonth(year, m));
  }
}

// ── Build single month (month view) ────────────────────
function buildSingleMonth(year, month) {
  const firstDow  = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const headerHtml = DAY_SHORT.map((d, i) =>
    `<div class="dh-lg${i===0?' sun':i===6?' sat':''}">${d}</div>`
  ).join('');

  // Leading cells — prev month dates
  const prevTotalDaysLg = new Date(year, month, 0).getDate();
  let cells = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push(`<div class="dc-lg muted">${prevTotalDaysLg - i}</div>`);
  }
  const monthHolidays = [];

  for (let d = 1; d <= totalDays; d++) {
    const key = dateKey(year, month, d);
    const dow = new Date(year, month, d).getDay();
    const info = holidays[key];
    const isToday = (year === today.getFullYear() && month === today.getMonth() && d === today.getDate());

    let cls = 'dc-lg';
    if (isToday) cls += ' is-today';
    else if (!info && dow === 0) cls += ' sun';
    else if (!info && dow === 6) cls += ' sat';

    if (info) {
      cls += info.holiday ? ' is-holiday' : ' is-event';
      monthHolidays.push({ d, info });
    }

    cells.push(`<div class="${cls}">${d}</div>`);
  }

  // Trailing cells — next month dates
  const trailingCountLg = (7 - ((firstDow + totalDays) % 7)) % 7;
  for (let i = 1; i <= trailingCountLg; i++) {
    cells.push(`<div class="dc-lg muted">${i}</div>`);
  }

  let hlHtml = '';
  if (monthHolidays.length > 0) {
    const items = monthHolidays.map(({ d, info }) => {
      const type = info.holiday ? 'hol' : 'evt';
      return `<div class="mhl-lg-item">
        <span class="mhl-lg-day ${type}">${d}</span>
        <span class="mhl-lg-text">${info.summary[0]}</span>
      </div>`;
    }).join('');
    hlHtml = `<div class="month-big-holidays">${items}</div>`;
  }

  document.getElementById('calMonth').innerHTML = `
    <div class="month-big-card">
      <div class="month-big-header">${MONTH_NAMES[month]} ${year}</div>
      <div class="month-big-body">
        <div class="day-grid-lg">
          ${headerHtml}
          ${cells.join('')}
        </div>
      </div>
      ${hlHtml}
    </div>`;
}

// ── Tab switch ──────────────────────────────────────────
function switchTab(view) {
  currentView = view;
  document.getElementById('tabYear').classList.toggle('active', view === 'year');
  document.getElementById('tabMonth').classList.toggle('active', view === 'month');
  document.getElementById('viewYear').style.display  = view === 'year'  ? '' : 'none';
  document.getElementById('viewMonth').style.display = view === 'month' ? '' : 'none';
  updateHeader();
  if (view === 'month') buildSingleMonth(currentYear, currentMonth);
}

// ── Header title ────────────────────────────────────────
function updateHeader() {
  if (currentView === 'year') {
    document.getElementById('yearTitle').textContent = currentYear;
  } else {
    document.getElementById('yearTitle').textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  }
}

// ── Year / month navigation ─────────────────────────────
function setYear(year) {
  currentYear = year;
  updateHeader();
  buildCalendar(year);
}

document.getElementById('btnPrev').addEventListener('click', () => {
  if (currentView === 'year') {
    setYear(currentYear - 1);
  } else {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateHeader();
    buildSingleMonth(currentYear, currentMonth);
  }
});

document.getElementById('btnNext').addEventListener('click', () => {
  if (currentView === 'year') {
    setYear(currentYear + 1);
  } else {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateHeader();
    buildSingleMonth(currentYear, currentMonth);
  }
});

// ── Init ───────────────────────────────────────────────
(async () => {
  await fetchHolidays();
  document.getElementById('loadingOverlay').style.display = 'none';
  currentMonth = today.getMonth();
  setYear(currentYear);
  buildSingleMonth(currentYear, currentMonth);
  updateHeader();
})();

// ── Swipe gesture (mobile) ─────────────────────────────
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) document.getElementById('btnNext').click();
    else        document.getElementById('btnPrev').click();
  }
}, { passive: true });

// ── Service Worker ─────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
