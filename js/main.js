// ===================================
//  Schedule Olivia — Main Script
// ===================================

// =====================================================
//  GOOGLE CALENDAR SETUP
//  Replace YOUR_GOOGLE_API_KEY with your actual key.
//  See the setup instructions in index.html (look for
//  "HOW TO CONNECT YOUR GOOGLE CALENDAR").
// =====================================================
var GCAL_API_KEY     = 'AIzaSyAC6VC1693Lhbn9V1RHcFVyPO5WVkqedn8';
var GCAL_CALENDAR_ID = 'oliviareese1013@gmail.com';

// ----- Mobile Navigation -----
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.getElementById('nav-links');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
        const isOpen = navLinks.classList.toggle('open');
        this.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    // Close nav when any link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-label', 'Open menu');
        });
    });

    // Close nav when clicking outside
    document.addEventListener('click', function (e) {
        if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-label', 'Open menu');
        }
    });
}

// ----- Sticky Header Shadow -----
var header = document.getElementById('header');
if (header) {
    window.addEventListener('scroll', function () {
        if (window.scrollY > 10) {
            header.style.boxShadow = '0 2px 16px rgba(0,0,0,0.1)';
        } else {
            header.style.boxShadow = 'none';
        }
    }, { passive: true });
}

// ----- Set minimum booking date to today -----
['dw-date', 'ps-start', 'ps-end', 'bs-date'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
        var today = new Date();
        el.min = today.getFullYear() + '-' +
                 String(today.getMonth() + 1).padStart(2, '0') + '-' +
                 String(today.getDate()).padStart(2, '0');
    }
});

// ----- Booking Form Submission -----
var form       = document.getElementById('booking-form');
var submitBtn  = document.getElementById('submit-btn');
var btnText    = document.getElementById('btn-text');
var btnLoading = document.getElementById('btn-loading');
var msgSuccess = document.getElementById('form-success');
var msgError   = document.getElementById('form-error');

if (form) {

    // Clear error highlight when user starts fixing a field
    form.querySelectorAll('[required]').forEach(function (field) {
        field.addEventListener('input', function () {
            this.classList.remove('error');
        });
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // ---- Guard: remind about Formspree setup ----
        if (form.action.includes('YOUR_FORM_ID')) {
            alert(
                'The booking form is not connected yet!\n\n' +
                'Follow these steps:\n' +
                '1. Go to formspree.io and create a free account\n' +
                '2. Create a new form for oliviareese1013@gmail.com\n' +
                '3. Copy your Form ID and paste it into index.html\n\n' +
                '(Look for "YOUR_FORM_ID" in the HTML file)'
            );
            return;
        }

        // ---- Validate required fields ----
        var valid = true;
        form.querySelectorAll('[required]').forEach(function (field) {
            field.classList.remove('error');
            if (!field.value.trim()) {
                field.classList.add('error');
                valid = false;
            }
        });

        if (!valid) {
            var firstError = form.querySelector('.error');
            if (firstError) {
                firstError.focus();
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // ---- Loading state ----
        btnText.hidden    = true;
        btnLoading.hidden = false;
        submitBtn.disabled = true;
        msgSuccess.hidden  = true;
        msgError.hidden    = true;

        // ---- Submit to Formspree ----
        try {
            var response = await fetch(form.action, {
                method:  'POST',
                body:    new FormData(form),
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                form.reset();
                msgSuccess.hidden = false;
                msgSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                msgError.hidden = false;
                msgError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (err) {
            msgError.hidden = false;
            msgError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } finally {
            btnText.hidden     = false;
            btnLoading.hidden  = true;
            submitBtn.disabled = false;
        }
    });
}

// ===================================
//  Service-Driven Availability Calendar
// ===================================

var MONTHS = ['January','February','March','April','May','June',
              'July','August','September','October','November','December'];
var DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var START_HOUR = 7;
var END_HOUR   = 23;

// ---- Utilities ----
function pad2(n) { return String(n).padStart(2, '0'); }

function fmtDate(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }

function fmtDateStr(dateStr) {
    var p = dateStr.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
}

function fmtTime12(h, m) {
    var p = h < 12 ? 'AM' : 'PM';
    return (h % 12 || 12) + ':' + pad2(m) + ' ' + p;
}

function dateStr(d) {
    return fmtDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
}

// ---- State ----
var cal = {
    service:   null,       // 'Dog Walking' | 'Pet Sitting' | 'Babysitting' | 'Mothers Helper'
    step:      null,       // varies per service
    year:      new Date().getFullYear(),
    month:     new Date().getMonth(),
    busySlots: new Set(),  // 'YYYY-MM-DD HH:MM'
    busyDays:  new Set(),  // 'YYYY-MM-DD' (all-day events)
    // selections
    date:      null,
    startDate: null,
    endDate:   null,
    startTime: null,
    endTime:   null
};

// ---- DOM references ----
var $area      = document.getElementById('cal-area');
var $prompt    = document.getElementById('cal-prompt');
var $monthView = document.getElementById('cal-month-view');
var $timeView  = document.getElementById('cal-time-view');
var $monthTitle= document.getElementById('cal-month-title');
var $days      = document.getElementById('cal-days');
var $timeSlots = document.getElementById('cal-time-slots');
var $dayTitle  = document.getElementById('cal-day-title');
var $selection = document.getElementById('cal-selection');
var $loader    = document.getElementById('cal-loader');
var $setupNote = document.getElementById('cal-setup-note');
var $legend    = document.getElementById('cal-legend');

// ---- Service picker ----
function selectService(svcName) {
    // highlight active picker button
    document.querySelectorAll('.svc-btn').forEach(function (b) { b.classList.remove('active'); });
    var matchBtn = document.querySelector('.svc-btn[data-svc="' + svcName + '"]');
    if (matchBtn) matchBtn.classList.add('active');

    cal.service   = svcName;
    cal.date      = null;
    cal.startDate = null;
    cal.endDate   = null;
    cal.startTime = null;
    cal.endTime   = null;
    cal.year      = new Date().getFullYear();
    cal.month     = new Date().getMonth();

    // auto-select service in the booking form
    var svcSelect = document.getElementById('service');
    if (svcSelect) {
        svcSelect.value = cal.service;
        svcSelect.dispatchEvent(new Event('change'));
    }
    showFormFields(cal.service);

    $area.hidden      = false;
    $selection.hidden = true;
    startFlow();

    // scroll to the availability section
    var avail = document.getElementById('availability');
    if (avail) avail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.svc-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        selectService(this.getAttribute('data-svc'));
    });
});

// "Book Now" buttons on service cards
document.querySelectorAll('.svc-book-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        selectService(this.getAttribute('data-svc'));
    });
});

// ---- Show/hide correct form date/time fields ----
function showFormFields(svc) {
    var fgDw = document.getElementById('fg-dw');
    var fgPs = document.getElementById('fg-ps');
    var fgBs = document.getElementById('fg-bs');
    if (fgDw) fgDw.hidden = true;
    if (fgPs) fgPs.hidden = true;
    if (fgBs) fgBs.hidden = true;
    // disable hidden inputs so they aren't submitted
    [fgDw, fgPs, fgBs].forEach(function (g) {
        if (!g) return;
        g.querySelectorAll('input').forEach(function (inp) {
            inp.required = false;
            inp.value = '';
        });
    });

    var target;
    if (svc === 'Dog Walking')                                  target = fgDw;
    else if (svc === 'Pet Sitting')                             target = fgPs;
    else if (svc === 'Babysitting' || svc === 'Mothers Helper') target = fgBs;
    if (target) {
        target.hidden = false;
        target.querySelectorAll('input').forEach(function (inp) { inp.required = true; });
    }
}

// ---- Flow controller ----
function startFlow() {
    if (cal.service === 'Dog Walking') {
        cal.step = 'pick-date';
        setPrompt('📅 Select a date for dog walking');
    } else if (cal.service === 'Pet Sitting') {
        cal.step = 'pick-start-date';
        setPrompt('📅 Select the start date for pet sitting');
    } else {
        // Babysitting or Mother's Helper
        cal.step = 'pick-date';
        setPrompt('📅 Select a date for ' + (cal.service === 'Babysitting' ? 'babysitting' : "mother's helper"));
    }
    showMonthView();
    fetchEvents();
}

function setPrompt(text) {
    $prompt.textContent = text;
}

// ---- Month view ----
function showMonthView() {
    $monthView.hidden = false;
    $timeView.hidden  = true;
    renderMonth();
}

function renderMonth() {
    $monthTitle.textContent = MONTHS[cal.month] + ' ' + cal.year;
    $days.innerHTML = '';

    var today     = new Date(); today.setHours(0,0,0,0);
    var firstDay  = new Date(cal.year, cal.month, 1);
    var lastDay   = new Date(cal.year, cal.month + 1, 0);

    // blank cells
    for (var b = 0; b < firstDay.getDay(); b++) {
        var blank = document.createElement('div');
        blank.className = 'cal-day cal-day--blank';
        $days.appendChild(blank);
    }

    for (var d = 1; d <= lastDay.getDate(); d++) {
        var cellDate = new Date(cal.year, cal.month, d);
        var ds = fmtDate(cal.year, cal.month + 1, d);

        var isPast  = cellDate < today;
        var isToday = sameDay(cellDate, today);
        var isBusy  = cal.busyDays.has(ds);
        var isAvail = !isPast && !isBusy;

        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cal-day';
        cell.textContent = d;
        cell.disabled = !isAvail;

        if (isPast)  cell.classList.add('cal-day--past');
        if (isToday) cell.classList.add('cal-day--today');
        if (isBusy)  cell.classList.add('cal-day--busy');

        // highlight selected dates
        if (cal.step === 'pick-end-date' && cal.startDate) {
            if (ds === cal.startDate)                                       cell.classList.add('cal-day--selected');
            if (cal.endDate && ds === cal.endDate)                          cell.classList.add('cal-day--selected');
            if (cal.endDate && ds > cal.startDate && ds < cal.endDate)      cell.classList.add('cal-day--range');
            // disable dates before start
            if (ds < cal.startDate) { cell.disabled = true; cell.classList.add('cal-day--past'); }
        }
        if (cal.step === 'done' && cal.service === 'Pet Sitting' && cal.startDate && cal.endDate) {
            if (ds === cal.startDate || ds === cal.endDate)                  cell.classList.add('cal-day--selected');
            if (ds > cal.startDate && ds < cal.endDate)                     cell.classList.add('cal-day--range');
        }
        if ((cal.step === 'pick-date' || cal.step === 'pick-start-date') && cal.date && ds === cal.date) {
            cell.classList.add('cal-day--selected');
        }

        if (isAvail && !cell.disabled) {
            cell.classList.add('cal-day--available');
            cell.setAttribute('data-ds', ds);
            cell.addEventListener('click', (function (dateString) {
                return function () { onDayClick(dateString); };
            })(ds));

            // Hover preview for pet sitting end-date range
            if (cal.step === 'pick-end-date' && cal.startDate) {
                cell.addEventListener('mouseenter', (function (hoverDs) {
                    return function () { previewDateRange(hoverDs); };
                })(ds));
            }
        }

        $days.appendChild(cell);
    }
}

function clearDateRangePreview() {
    document.querySelectorAll('.cal-day--range-preview').forEach(function (el) {
        el.classList.remove('cal-day--range-preview');
    });
}

function previewDateRange(hoverDs) {
    clearDateRangePreview();
    if (!cal.startDate || hoverDs <= cal.startDate) return;
    document.querySelectorAll('.cal-day[data-ds]').forEach(function (cell) {
        var ds = cell.getAttribute('data-ds');
        if (ds > cal.startDate && ds <= hoverDs) {
            cell.classList.add('cal-day--range-preview');
        }
    });
}

function onDayClick(ds) {
    if (cal.service === 'Dog Walking') {
        cal.date = ds;
        cal.step = 'pick-time';
        setPrompt('⏰ Select a 30-minute time slot on ' + fmtDateStr(ds));
        showTimeView(ds, 'single');

    } else if (cal.service === 'Pet Sitting') {
        if (cal.step === 'pick-start-date') {
            cal.startDate = ds;
            cal.endDate   = null;
            cal.step      = 'pick-end-date';
            setPrompt('📅 Now select the end date (can be the same day)');
            renderMonth();
        } else if (cal.step === 'pick-end-date') {
            cal.endDate = ds;
            cal.step = 'done';
            renderMonth();
            finishPetSitting();
        }

    } else {
        // Babysitting / Mother's Helper
        cal.date = ds;
        cal.step = 'pick-start-time';
        setPrompt('⏰ Select the start time on ' + fmtDateStr(ds));
        showTimeView(ds, 'range-start');
    }
}

// ---- Time-slot view ----
function showTimeView(ds, mode) {
    $monthView.hidden = true;
    $timeView.hidden  = false;
    $dayTitle.textContent = fmtDateStr(ds);
    renderTimeSlots(ds, mode);
}

function renderTimeSlots(ds, mode) {
    $timeSlots.innerHTML = '';

    var now = new Date();
    var isToday = ds === dateStr(now);

    // For range-end mode, find the first busy slot after the start time
    // so we can cap the selectable end times before that busy block
    var ceilingKey = null;
    if (mode === 'range-end' && cal.startTime) {
        var startKey = ds + ' ' + pad2(cal.startTime[0]) + ':' + pad2(cal.startTime[1]);
        for (var sh = START_HOUR; sh < END_HOUR; sh++) {
            for (var sm = 0; sm < 60; sm += 30) {
                var sk = ds + ' ' + pad2(sh) + ':' + pad2(sm);
                if (sk > startKey && cal.busySlots.has(sk)) {
                    ceilingKey = sk;
                    break;
                }
            }
            if (ceilingKey) break;
        }
    }

    for (var h = START_HOUR; h < END_HOUR; h++) {
        for (var m = 0; m < 60; m += 30) {
            var slotKey = ds + ' ' + pad2(h) + ':' + pad2(m);
            var isPast  = isToday && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()));
            var isBusy  = cal.busySlots.has(slotKey);

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cal-ts';
            btn.textContent = fmtTime12(h, m);

            if (isPast) { btn.classList.add('cal-ts--past'); btn.disabled = true; }
            else if (isBusy) { btn.classList.add('cal-ts--busy'); btn.disabled = true; }

            // highlight selections for range mode
            if (mode === 'range-end' && cal.startTime) {
                var startKey = ds + ' ' + pad2(cal.startTime[0]) + ':' + pad2(cal.startTime[1]);
                if (slotKey === startKey) btn.classList.add('selected');
                if (cal.endTime) {
                    var endKey = ds + ' ' + pad2(cal.endTime[0]) + ':' + pad2(cal.endTime[1]);
                    if (slotKey === endKey) btn.classList.add('selected');
                    if (slotKey > startKey && slotKey < endKey) btn.classList.add('in-range');
                }
                // disable times before start time
                if (slotKey <= startKey && !btn.disabled) {
                    btn.classList.add('cal-ts--past');
                    btn.disabled = true;
                }
                // disable times at or after the first busy slot past the start time
                if (ceilingKey && slotKey >= ceilingKey && !btn.disabled) {
                    btn.classList.add('cal-ts--past');
                    btn.disabled = true;
                }
            }

            if (!btn.disabled) {
                btn.setAttribute('data-slot', slotKey);
                btn.addEventListener('click', (function (hh, mm) {
                    return function () { onTimeClick(hh, mm, ds, mode); };
                })(h, m));

                // Hover preview for babysitting/mother's helper end-time range
                if (mode === 'range-end' && cal.startTime) {
                    btn.addEventListener('mouseenter', (function (sk) {
                        return function () { previewTimeRange(ds, sk); };
                    })(slotKey));
                }
            }

            $timeSlots.appendChild(btn);
        }
    }
}

function clearTimeRangePreview() {
    document.querySelectorAll('.cal-ts.range-preview').forEach(function (el) {
        el.classList.remove('range-preview');
    });
}

function previewTimeRange(ds, hoverKey) {
    clearTimeRangePreview();
    if (!cal.startTime) return;
    var startKey = ds + ' ' + pad2(cal.startTime[0]) + ':' + pad2(cal.startTime[1]);
    if (hoverKey <= startKey) return;
    document.querySelectorAll('.cal-ts[data-slot]').forEach(function (btn) {
        var sk = btn.getAttribute('data-slot');
        if (sk > startKey && sk <= hoverKey) {
            btn.classList.add('range-preview');
        }
    });
}

function onTimeClick(h, m, ds, mode) {
    if (cal.service === 'Dog Walking') {
        // single time pick
        cal.startTime = [h, m];
        cal.step = 'done';
        finishDogWalking(ds, h, m);

    } else {
        // Babysitting / Mother's Helper — range pick
        if (mode === 'single' || mode === 'range-start') {
            cal.startTime = [h, m];
            cal.endTime   = null;
            cal.step      = 'pick-end-time';
            setPrompt('⏰ Now select the end time');
            renderTimeSlots(ds, 'range-end');
        } else if (mode === 'range-end') {
            cal.endTime = [h, m];
            cal.step = 'done';
            finishBabysitting(ds);
        }
    }
}

// ---- Finish flows: populate form and show summary ----
function finishDogWalking(ds, h, m) {
    var dwDate = document.getElementById('dw-date');
    var dwTime = document.getElementById('dw-time');
    if (dwDate) dwDate.value = ds;
    if (dwTime) dwTime.value = pad2(h) + ':' + pad2(m);

    showSummary('🐕 Dog Walking on ' + fmtDateStr(ds) + ' at ' + fmtTime12(h, m));
    scrollToForm();
}

function finishPetSitting() {
    var psStart = document.getElementById('ps-start');
    var psEnd   = document.getElementById('ps-end');
    if (psStart) psStart.value = cal.startDate;
    if (psEnd)   psEnd.value   = cal.endDate;

    var label = '🐾 Pet Sitting: ' + fmtDateStr(cal.startDate);
    if (cal.endDate !== cal.startDate) label += ' through ' + fmtDateStr(cal.endDate);
    showSummary(label);
    scrollToForm();
}

function finishBabysitting(ds) {
    var bsDate  = document.getElementById('bs-date');
    var bsStart = document.getElementById('bs-start');
    var bsEnd   = document.getElementById('bs-end');
    if (bsDate)  bsDate.value  = ds;
    if (bsStart) bsStart.value = pad2(cal.startTime[0]) + ':' + pad2(cal.startTime[1]);
    if (bsEnd)   bsEnd.value   = pad2(cal.endTime[0])   + ':' + pad2(cal.endTime[1]);

    var icon = cal.service === 'Babysitting' ? '🍼' : '🤝';
    showSummary(icon + ' ' + cal.service + ' on ' + fmtDateStr(ds) +
                ', ' + fmtTime12(cal.startTime[0], cal.startTime[1]) +
                ' – ' + fmtTime12(cal.endTime[0], cal.endTime[1]));
    scrollToForm();
}

function showSummary(text) {
    $selection.textContent = text;
    $selection.hidden = false;
    setPrompt('✅ Selection complete — fill out the form below!');
    unlockForm();
}

function unlockForm() {
    var overlay = document.getElementById('form-lock-overlay');
    var bookingForm = document.getElementById('booking-form');
    if (overlay) overlay.hidden = true;
    if (bookingForm) bookingForm.classList.remove('form-locked');
}

function scrollToForm() {
    var bookSection = document.getElementById('book');
    if (bookSection) {
        setTimeout(function () {
            bookSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

// ---- Back button (time view → month view) ----
document.getElementById('cal-back').addEventListener('click', function () {
    cal.startTime = null;
    cal.endTime   = null;
    $selection.hidden = true;
    if (cal.service === 'Dog Walking') {
        cal.step = 'pick-date';
        setPrompt('📅 Select a date for dog walking');
    } else {
        cal.step = 'pick-date';
        var label = cal.service === 'Babysitting' ? 'babysitting' : "mother's helper";
        setPrompt('📅 Select a date for ' + label);
    }
    showMonthView();
});

// ---- Month nav ----
document.getElementById('cal-prev').addEventListener('click', function () {
    cal.month--;
    if (cal.month < 0) { cal.month = 11; cal.year--; }
    renderMonth();
    fetchEvents();
});

document.getElementById('cal-next').addEventListener('click', function () {
    cal.month++;
    if (cal.month > 11) { cal.month = 0; cal.year++; }
    renderMonth();
    fetchEvents();
});

// ---- Fetch events from Google Calendar ----
async function fetchEvents() {
    if (GCAL_API_KEY === 'YOUR_GOOGLE_API_KEY') {
        if ($setupNote) {
            $setupNote.hidden = false;
            $setupNote.textContent =
                '\uD83D\uDCCB To show live availability, add your Google API key in js/main.js.';
        }
        return;
    }
    if ($setupNote) $setupNote.hidden = true;
    if ($loader)    $loader.hidden    = false;

    var timeMin = new Date(cal.year, cal.month, 1).toISOString();
    var timeMax = new Date(cal.year, cal.month + 1, 0, 23, 59, 59).toISOString();

    var url =
        'https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(GCAL_CALENDAR_ID) +
        '/events?key=' + encodeURIComponent(GCAL_API_KEY) +
        '&timeMin=' + encodeURIComponent(timeMin) +
        '&timeMax=' + encodeURIComponent(timeMax) +
        '&singleEvents=true&orderBy=startTime';

    try {
        var resp = await fetch(url);
        var data = await resp.json();

        // don't clear — merge across months if needed
        cal.busySlots = new Set();
        cal.busyDays  = new Set();

        if (data.items && data.items.length) {
            data.items.forEach(function (ev) {
                if (ev.start.date) {
                    // All-day event
                    var cur = new Date(ev.start.date + 'T00:00:00');
                    var end = new Date(ev.end.date   + 'T00:00:00');
                    end.setDate(end.getDate() - 1);
                    while (cur <= end) {
                        var ds = dateStr(cur);
                        cal.busyDays.add(ds);
                        for (var bh = START_HOUR; bh < END_HOUR; bh++) {
                            cal.busySlots.add(ds + ' ' + pad2(bh) + ':00');
                            cal.busySlots.add(ds + ' ' + pad2(bh) + ':30');
                        }
                        cur.setDate(cur.getDate() + 1);
                    }
                } else {
                    // Timed event
                    var evStart = new Date(ev.start.dateTime);
                    var evEnd   = new Date(ev.end.dateTime);
                    var sc      = new Date(evStart);
                    sc.setMinutes(sc.getMinutes() < 30 ? 0 : 30, 0, 0);
                    while (sc < evEnd) {
                        var sh = sc.getHours(), sm = sc.getMinutes();
                        if (sh >= START_HOUR && sh < END_HOUR) {
                            cal.busySlots.add(dateStr(sc) + ' ' + pad2(sh) + ':' + pad2(sm));
                        }
                        sc.setMinutes(sc.getMinutes() + 30);
                    }
                }
            });
        }
        renderMonth();
    } catch (err) {
        console.warn('Could not load calendar:', err);
        renderMonth();
    } finally {
        if ($loader) $loader.hidden = true;
    }
}

// ---- Also sync service dropdown changes in the form ----
var svcSelect = document.getElementById('service');
if (svcSelect) {
    svcSelect.addEventListener('change', function () {
        showFormFields(this.value);
    });
}


