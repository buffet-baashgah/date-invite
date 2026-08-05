'use strict';

/* ==========================================================================
   1) تبدیل تقویم میلادی <-> شمسی (الگوریتم استاندارد نجومی/تقویمی)
   ========================================================================== */
const CalendarMath = (() => {
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  const BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
    1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
  ];

  function jalCal(jy) {
    const bl = BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = BREAKS[0];
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی خارج از محدوده است: ' + jy);
    let jump = 0;
    let jm = jp;
    for (let i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;
    let jm, jd;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy, jm, jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }

  function toJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function isLeapJalaliYear(jy) { return jalCal(jy).leap === 0; }
  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaliYear(jy) ? 30 : 29;
  }

  return { toJalali, toGregorian, isLeapJalaliYear, monthLength };
})();

/* ==========================================================================
   2) ثابت‌ها
   ========================================================================== */
const PERSIAN_WEEK = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const PERSIAN_WEEK_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const MINUTE_STEPS = [0, 15, 30, 45];

function toPersianDigits(input) {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[+d]);
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function getPersianWeekdayIndex(date) { return (date.getDay() + 1) % 7; }

/* ==========================================================================
   3) وضعیت برنامه
   ========================================================================== */
const state = {
  screen: 1,
  viewJY: null,
  viewJM: null,
  todayJY: null,
  todayJM: null,
  todayJD: null,
  todayHour: null,
  todayMinute: null,
  selectedJY: null,
  selectedJM: null,
  selectedJD: null,
  selectedHour: null,
  selectedMinute: null,
  selectedPlace: null,
};

function refreshToday() {
  const now = new Date();
  const j = CalendarMath.toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  state.todayJY = j.jy;
  state.todayJM = j.jm;
  state.todayJD = j.jd;
  state.todayHour = now.getHours();
  state.todayMinute = now.getMinutes();
}

/* ==========================================================================
   4) عناصر DOM
   ========================================================================== */
const els = {
  loader: document.getElementById('loader'),
  progress: document.getElementById('progress'),
  screens: Array.from(document.querySelectorAll('.screen')),
  heroArea: document.getElementById('heroArea'),
  yesBtn: document.getElementById('yesBtn'),
  noBtn: document.getElementById('noBtn'),
  weekdaysRow: document.getElementById('weekdaysRow'),
  daysGrid: document.getElementById('daysGrid'),
  monthLabel: document.getElementById('monthLabel'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
  hourScroll: document.getElementById('hourScroll'),
  minuteScroll: document.getElementById('minuteScroll'),
  timeHint: document.getElementById('timeHint'),
  selectedDateSummary: document.getElementById('selectedDateSummary'),
  toStep3: document.getElementById('toStep3'),
  placeGrid: document.getElementById('placeGrid'),
  customPlaceWrap: document.getElementById('customPlaceWrap'),
  customPlaceInput: document.getElementById('customPlaceInput'),
  toStep4: document.getElementById('toStep4'),
  finalDate: document.getElementById('finalDate'),
  finalTime: document.getElementById('finalTime'),
  finalPlace: document.getElementById('finalPlace'),
  finishBtn: document.getElementById('finishBtn'),
  floatingHearts: document.getElementById('floatingHearts'),
  confettiCanvas: document.getElementById('confettiCanvas'),
};

/* ==========================================================================
   5) پیمایش بین صفحات
   ========================================================================== */
function goToScreen(n) {
  const current = els.screens.find((s) => s.classList.contains('active'));
  const next = els.screens.find((s) => +s.dataset.screen === n);
  if (!next || next === current) return;

  if (current) {
    current.classList.add('leaving');
    current.classList.remove('active');
    setTimeout(() => current.classList.remove('leaving'), 650);
  }
  requestAnimationFrame(() => next.classList.add('active'));

  state.screen = n;
  els.progress.querySelectorAll('.progress__dot').forEach((dot) => {
    const d = +dot.dataset.dot;
    dot.classList.toggle('is-active', d === n);
    dot.classList.toggle('is-done', d < n);
  });

  if (n === 4) {
    renderSummary();
    burstConfetti();
  }
}

/* ==========================================================================
   6) صفحه ۱ — تقویم و دکمه فرارکننده «نه»
   ========================================================================== */
function initHero() {
  els.yesBtn.addEventListener('click', (e) => {
    const ripple = els.yesBtn.querySelector('.btn__ripple');
    const rect = els.yesBtn.getBoundingClientRect();
    const x = (e.clientX || rect.width / 2) - rect.left;
    const y = (e.clientY || rect.height / 2) - rect.top;
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
    ripple.classList.remove('is-active');
    void ripple.offsetWidth;
    ripple.classList.add('is-active');
    setTimeout(() => goToScreen(2), 260);
  });

  armNoButton();
}

function armNoButton() {
  const bounds = els.heroArea;
  const btn = els.noBtn;
  let armed = false;
  let lastPointer = { x: -9999, y: -9999 };

  function boundsRect() { return bounds.getBoundingClientRect(); }

  function initialPlacement() {
    // اندازه‌گیری موقعیت اولیه‌ی طبیعی دکمه پیش از تبدیل به absolute
    const bRect = boundsRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - bRect.left;
    const top = btnRect.top - bRect.top;
    btn.style.left = left + 'px';
    btn.style.top = top + 'px';
    btn.classList.add('is-armed');
    armed = true;
  }

  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

  function randomSafeSpot(avoidX, avoidY) {
    const bRect = boundsRect();
    const btnW = btn.offsetWidth || 120;
    const btnH = btn.offsetHeight || 52;
    const pad = 18;
    const maxLeft = Math.max(pad, bRect.width - btnW - pad);
    const maxTop = Math.max(pad, bRect.height - btnH - pad);

    let best = null;
    let bestDist = -1;
    for (let i = 0; i < 12; i += 1) {
      const candLeft = pad + Math.random() * (maxLeft - pad);
      const candTop = pad + Math.random() * (maxTop - pad);
      const cx = candLeft + btnW / 2;
      const cy = candTop + btnH / 2;
      const dist = Math.hypot(cx - avoidX, cy - avoidY);
      if (dist > bestDist) { bestDist = dist; best = { left: candLeft, top: candTop }; }
      if (dist > 220) break;
    }
    return best || { left: clamp(Math.random() * maxLeft, pad, maxLeft), top: clamp(Math.random() * maxTop, pad, maxTop) };
  }

  function dodge() {
    if (!armed || state.screen !== 1) return;
    const bRect = boundsRect();
    const avoidX = lastPointer.x - bRect.left;
    const avoidY = lastPointer.y - bRect.top;
    const spot = randomSafeSpot(avoidX, avoidY);
    btn.style.left = spot.left + 'px';
    btn.style.top = spot.top + 'px';
    btn.classList.remove('is-dodging');
    void btn.offsetWidth;
    btn.classList.add('is-dodging');
  }

  function proximityCheck(clientX, clientY) {
    if (!armed || state.screen !== 1) return;
    lastPointer = { x: clientX, y: clientY };
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(clientX - cx, clientY - cy);
    const threshold = Math.max(90, r.width * 0.9);
    if (dist < threshold) dodge();
  }

  window.addEventListener('pointermove', (e) => proximityCheck(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => proximityCheck(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) proximityCheck(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dodge();
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('resize', () => {
    if (!armed) return;
    const bRect = boundsRect();
    const btnW = btn.offsetWidth;
    const btnH = btn.offsetHeight;
    const maxLeft = Math.max(10, bRect.width - btnW - 10);
    const maxTop = Math.max(10, bRect.height - btnH - 10);
    const curLeft = parseFloat(btn.style.left) || 0;
    const curTop = parseFloat(btn.style.top) || 0;
    btn.style.left = clamp(curLeft, 10, maxLeft) + 'px';
    btn.style.top = clamp(curTop, 10, maxTop) + 'px';
  });

  // مهلت کوتاه تا لایه‌بندی صفحه تثبیت شود
  setTimeout(initialPlacement, 260);
}

/* ==========================================================================
   7) صفحه ۲ — تقویم شمسی
   ========================================================================== */
function renderWeekdaysHeader() {
  els.weekdaysRow.innerHTML = PERSIAN_WEEK_SHORT
    .map((w) => `<span>${w}</span>`)
    .join('');
}

function isBeforeToday(jy, jm, jd) {
  if (jy !== state.todayJY) return jy < state.todayJY;
  if (jm !== state.todayJM) return jm < state.todayJM;
  return jd < state.todayJD;
}

function renderCalendar() {
  const jy = state.viewJY;
  const jm = state.viewJM;
  els.monthLabel.textContent = `${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;

  const g = CalendarMath.toGregorian(jy, jm, 1);
  const firstDate = new Date(g.gy, g.gm - 1, g.gd);
  const offset = getPersianWeekdayIndex(firstDate);
  const length = CalendarMath.monthLength(jy, jm);

  const isCurrentMonth = jy === state.todayJY && jm === state.todayJM;
  els.prevMonth.disabled = isCurrentMonth;
  els.prevMonth.style.visibility = isCurrentMonth ? 'hidden' : 'visible';

  let html = '';
  for (let i = 0; i < offset; i += 1) {
    html += `<span class="day-cell day-cell--empty"></span>`;
  }
  for (let d = 1; d <= length; d += 1) {
    const disabled = isBeforeToday(jy, jm, d);
    const isToday = isCurrentMonth && d === state.todayJD;
    const isSelected = jy === state.selectedJY && jm === state.selectedJM && d === state.selectedJD;
    const classes = ['day-cell'];
    if (isToday) classes.push('day-cell--today');
    if (isSelected) classes.push('day-cell--selected');
    html += `<button type="button" class="${classes.join(' ')}" data-day="${d}" ${disabled ? 'disabled' : ''}>${toPersianDigits(d)}</button>`;
  }
  els.daysGrid.innerHTML = html;

  els.daysGrid.querySelectorAll('.day-cell:not(.day-cell--empty):not(:disabled)').forEach((cell) => {
    cell.addEventListener('click', () => {
      state.selectedJY = jy;
      state.selectedJM = jm;
      state.selectedJD = +cell.dataset.day;
      renderCalendar();
      renderHourList();
      updateStep2Summary();
      updateStep2ButtonState();
    });
  });
}

function changeMonth(delta) {
  let jm = state.viewJM + delta;
  let jy = state.viewJY;
  if (jm > 12) { jm = 1; jy += 1; }
  if (jm < 1) { jm = 12; jy -= 1; }
  if (jy < state.todayJY || (jy === state.todayJY && jm < state.todayJM)) {
    jy = state.todayJY; jm = state.todayJM;
  }
  state.viewJY = jy;
  state.viewJM = jm;
  renderCalendar();
}

/* ---- انتخاب‌گر ساعت و دقیقه ---- */
function isSelectedDateToday() {
  return state.selectedJY === state.todayJY
    && state.selectedJM === state.todayJM
    && state.selectedJD === state.todayJD;
}

function renderHourList() {
  const today = isSelectedDateToday();
  let html = '';
  for (let h = 0; h < 24; h += 1) {
    let disabled = false;
    if (today) {
      if (h < state.todayHour) disabled = true;
      else if (h === state.todayHour && state.todayMinute > MINUTE_STEPS[MINUTE_STEPS.length - 1]) disabled = true;
    }
    const selected = state.selectedHour === h;
    html += `<button type="button" class="time-option ${selected ? 'is-selected' : ''}" data-hour="${h}" ${disabled ? 'disabled' : ''}>${toPersianDigits(pad2(h))}</button>`;
  }
  els.hourScroll.innerHTML = html;

  els.hourScroll.querySelectorAll('.time-option:not(:disabled)').forEach((opt) => {
    opt.addEventListener('click', () => {
      state.selectedHour = +opt.dataset.hour;
      if (state.selectedMinute === null) state.selectedMinute = undefined;
      renderHourList();
      renderMinuteList();
      scrollOptionIntoView(opt, els.hourScroll);
      updateStep2Summary();
      updateStep2ButtonState();
    });
  });

  if (state.selectedHour !== null && state.selectedHour !== undefined) {
    const sel = els.hourScroll.querySelector('.is-selected');
    if (sel) scrollOptionIntoView(sel, els.hourScroll, true);
  }

  renderMinuteList();
}

function renderMinuteList() {
  const today = isSelectedDateToday();
  const hour = state.selectedHour;
  let html = '';
  MINUTE_STEPS.forEach((m) => {
    let disabled = false;
    if (today && hour !== null && hour !== undefined && hour === state.todayHour && m < state.todayMinute) {
      disabled = true;
    }
    if (hour === null || hour === undefined) disabled = true;
    const selected = state.selectedMinute === m;
    html += `<button type="button" class="time-option ${selected ? 'is-selected' : ''}" data-minute="${m}" ${disabled ? 'disabled' : ''}>${toPersianDigits(pad2(m))}</button>`;
  });
  els.minuteScroll.innerHTML = html;

  if (state.selectedMinute !== null && state.selectedMinute !== undefined) {
    const stillValid = !els.minuteScroll.querySelector(`[data-minute="${state.selectedMinute}"]:disabled`);
    if (!stillValid) state.selectedMinute = null;
  }

  els.minuteScroll.querySelectorAll('.time-option:not(:disabled)').forEach((opt) => {
    opt.addEventListener('click', () => {
      state.selectedMinute = +opt.dataset.minute;
      renderMinuteList();
      scrollOptionIntoView(opt, els.minuteScroll);
      updateStep2Summary();
      updateStep2ButtonState();
    });
  });

  const sel = els.minuteScroll.querySelector('.is-selected');
  if (sel) scrollOptionIntoView(sel, els.minuteScroll, true);

  els.timeHint.textContent = (hour === null || hour === undefined)
    ? 'اول یک روز رو از تقویم انتخاب کن، بعد ساعت رو مشخص کن'
    : '';
}

function scrollOptionIntoView(opt, container, instant) {
  const target = opt.offsetTop - container.clientHeight / 2 + opt.clientHeight / 2;
  container.scrollTo({ top: target, behavior: instant ? 'auto' : 'smooth' });
}

function updateStep2Summary() {
  if (state.selectedJD === null) {
    els.selectedDateSummary.textContent = 'هنوز چیزی انتخاب نشده';
    return;
  }
  const weekday = PERSIAN_WEEK[getPersianWeekdayIndex(
    new Date(
      CalendarMath.toGregorian(state.selectedJY, state.selectedJM, state.selectedJD).gy,
      CalendarMath.toGregorian(state.selectedJY, state.selectedJM, state.selectedJD).gm - 1,
      CalendarMath.toGregorian(state.selectedJY, state.selectedJM, state.selectedJD).gd
    )
  )];
  let text = `${weekday} ${toPersianDigits(state.selectedJD)} ${PERSIAN_MONTHS[state.selectedJM - 1]}`;
  if (state.selectedHour !== null && state.selectedHour !== undefined && state.selectedMinute !== null && state.selectedMinute !== undefined) {
    text += ` — ساعت ${toPersianDigits(pad2(state.selectedHour))}:${toPersianDigits(pad2(state.selectedMinute))}`;
  }
  els.selectedDateSummary.textContent = text;
}

function updateStep2ButtonState() {
  const ready = state.selectedJD !== null
    && state.selectedHour !== null && state.selectedHour !== undefined
    && state.selectedMinute !== null && state.selectedMinute !== undefined;
  els.toStep3.disabled = !ready;
}

/* ==========================================================================
   8) صفحه ۳ — انتخاب محل
   ========================================================================== */
function initPlaces() {
  els.placeGrid.querySelectorAll('.place-card').forEach((card) => {
    card.addEventListener('click', () => {
      els.placeGrid.querySelectorAll('.place-card').forEach((c) => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      const value = card.dataset.place;
      if (value === 'custom') {
        els.customPlaceWrap.hidden = false;
        els.customPlaceInput.focus();
        state.selectedPlace = els.customPlaceInput.value.trim() || null;
      } else {
        els.customPlaceWrap.hidden = true;
        state.selectedPlace = value;
      }
      updateStep3ButtonState();
    });
  });

  els.customPlaceInput.addEventListener('input', () => {
    state.selectedPlace = els.customPlaceInput.value.trim() || null;
    updateStep3ButtonState();
  });
}

function updateStep3ButtonState() {
  els.toStep4.disabled = !state.selectedPlace;
}

/* ==========================================================================
   9) صفحه ۴ — خلاصه
   ========================================================================== */
function renderSummary() {
  const weekday = PERSIAN_WEEK[getPersianWeekdayIndex(
    new Date(
      CalendarMath.toGregorian(state.selectedJY, state.selectedJM, state.selectedJD).gy,
      CalendarMath.toGregorian(state.selectedJY, state.selectedJM, state.selectedJD).gm - 1,
      CalendarMath.toGregorian(state.selectedJY, state.selectedJM, state.selectedJD).gd
    )
  )];
  els.finalDate.textContent = `${weekday} ${toPersianDigits(state.selectedJD)} ${PERSIAN_MONTHS[state.selectedJM - 1]} ${toPersianDigits(state.selectedJY)}`;
  els.finalTime.textContent = `ساعت ${toPersianDigits(pad2(state.selectedHour))}:${toPersianDigits(pad2(state.selectedMinute))}`;
  els.finalPlace.textContent = state.selectedPlace;
}

function resetFlow() {
  state.selectedJY = null;
  state.selectedJM = null;
  state.selectedJD = null;
  state.selectedHour = null;
  state.selectedMinute = null;
  state.selectedPlace = null;
  state.viewJY = state.todayJY;
  state.viewJM = state.todayJM;
  els.customPlaceWrap.hidden = true;
  els.customPlaceInput.value = '';
  els.placeGrid.querySelectorAll('.place-card').forEach((c) => c.classList.remove('is-selected'));
  renderCalendar();
  renderHourList();
  updateStep2Summary();
  updateStep2ButtonState();
  updateStep3ButtonState();
  goToScreen(1);
}

/* ==========================================================================
   10) قلب‌های شناور پس‌زمینه
   ========================================================================== */
function startFloatingHearts() {
  const MAX_HEARTS = 22;
  setInterval(() => {
    if (els.floatingHearts.childElementCount >= MAX_HEARTS) return;
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = Math.random() > 0.5 ? '❤️' : '💗';
    const left = Math.random() * 100;
    const size = 0.7 + Math.random() * 1.1;
    const duration = 9 + Math.random() * 8;
    const drift = (Math.random() - 0.5) * 140;
    heart.style.left = left + '%';
    heart.style.fontSize = size + 'rem';
    heart.style.animationDuration = duration + 's';
    heart.style.setProperty('--drift', drift + 'px');
    heart.addEventListener('animationend', () => heart.remove());
    els.floatingHearts.appendChild(heart);
  }, 1600);
}

/* ==========================================================================
   11) کانفتی صفحه پایانی
   ========================================================================== */
function burstConfetti() {
  const canvas = els.confettiCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['#f6b6c9', '#e7b7a6', '#ece1f7', '#fbc6da', '#c9967f', '#ffffff'];
  const count = 130;
  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.5,
    size: 5 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 1.6,
    vy: 2 + Math.random() * 2.6,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    life: 0,
  }));

  const duration = 4200;
  const start = performance.now();
  let rafId;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.012;
      p.rotation += p.rotationSpeed;
      const fade = elapsed > duration - 900 ? Math.max(0, 1 - (elapsed - (duration - 900)) / 900) : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    if (elapsed < duration) {
      rafId = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, w, h);
      cancelAnimationFrame(rafId);
    }
  }
  rafId = requestAnimationFrame(frame);
}

/* ==========================================================================
   12) رویدادهای عمومی و راه‌اندازی
   ========================================================================== */
function initNavigation() {
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => goToScreen(state.screen - 1));
  });
  els.prevMonth.addEventListener('click', () => changeMonth(-1));
  els.nextMonth.addEventListener('click', () => changeMonth(1));
  els.toStep3.addEventListener('click', () => goToScreen(3));
  els.toStep4.addEventListener('click', () => goToScreen(4));
  els.finishBtn.addEventListener('click', resetFlow);
}

function init() {
  refreshToday();
  state.viewJY = state.todayJY;
  state.viewJM = state.todayJM;

  renderWeekdaysHeader();
  renderCalendar();
  renderHourList();
  updateStep2Summary();
  updateStep2ButtonState();

  initHero();
  initPlaces();
  initNavigation();
  startFloatingHearts();

  window.addEventListener('resize', () => {
    // بازه‌های ساعت/تاریخ ممکن است با گذر زمان واقعی تغییر کنند
    refreshToday();
  });

  setTimeout(() => {
    refreshToday();
    if (state.viewJY === state.todayJY && state.viewJM === state.todayJM) renderCalendar();
  }, 5000);

  window.addEventListener('load', () => {
    setTimeout(() => els.loader.classList.add('is-hidden'), 500);
  });
  setTimeout(() => els.loader.classList.add('is-hidden'), 1800);
}

document.addEventListener('DOMContentLoaded', init);
