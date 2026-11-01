
(() => {
  'use strict';
  const STORAGE_KEY = 'habitpulse.data.v7.0'; // Keep existing key to preserve V7.x local data without migration.
  const PREVIOUS_STORAGE_KEY = 'habitpulse.data.v5.7';
  const SECOND_PREVIOUS_V57_KEY = 'habitpulse.data.v5.7';
  const SECOND_PREVIOUS_V55_KEY = 'habitpulse.data.v5.5';
  const SECOND_PREVIOUS_V54_KEY = 'habitpulse.data.v5.4';
  const SECOND_PREVIOUS_STORAGE_KEY = 'habitpulse.data.v5.3';
  const THIRD_PREVIOUS_STORAGE_KEY = 'habitpulse.data.v5.2';
  const FOURTH_PREVIOUS_STORAGE_KEY = 'habitpulse.data.v3';
  const OLDER_STORAGE_KEY = 'habitpulse.data.v2';
  const OLDEST_STORAGE_KEY = 'habitpulse.data.v1';
  const LAST_GOOD_KEY = 'habitpulse.data.lastgood';
  const LEGACY_STORAGE_KEY = 'habitflow.data.v1';
  const SCHEMA_VERSION = 21;
  const $ = (id) => document.getElementById(id);
  const HOME_MARKUP = $('mainContent').innerHTML;
  const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const isValidDateKey = (key) => { if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false; const [y,m,d]=key.split('-').map(Number); const date=new Date(y,m-1,d,12); return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d; };
  const parseDate = (key) => { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d,12); };
  const dayIndex = (key) => parseDate(key).getDay();
  const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : `h${Date.now()}${Math.random().toString(36).slice(2,8)}`;
  const defaultState = () => ({ schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), habits: [], logs: {}, settings: { dailySummary: false, lastSummaryDate: null }, reviews: {}, reminderFired: {}, customCategories: [], routines: [] });
  let state = loadState();
  let activeView = 'home';
  let activeRoutineId = null;
  let toastTimer;

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Backup is not a valid object.');
    const s = defaultState();
    s.createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : s.createdAt;
    s.habits = Array.isArray(raw.habits) ? raw.habits.filter(h => h && typeof h.id === 'string' && typeof h.name === 'string').map(h => ({
      id: h.id, name: h.name.slice(0,70), description: typeof h.description==='string'?h.description.slice(0,120):'', isCore: Boolean(h.isCore), category: typeof h.category === 'string' ? h.category : 'Custom',
      trackingType: ['check','numeric','atMost','weekly'].includes(h.trackingType) ? h.trackingType : 'check',
      numericTarget: Number.isFinite(Number(h.numericTarget)) && Number(h.numericTarget)>0 ? Number(h.numericTarget) : 1,
      numericUnit: typeof h.numericUnit === 'string' ? h.numericUnit.slice(0,20) : '',
      weeklyTarget: Number.isInteger(Number(h.weeklyTarget)) && Number(h.weeklyTarget)>=1 && Number(h.weeklyTarget)<=7 ? Number(h.weeklyTarget) : 3,
      schedule: ['daily','weekdays','weekends','custom','interval','monthly'].includes(h.schedule) ? h.schedule : 'daily',
      intervalDays: Number.isInteger(Number(h.intervalDays)) && Number(h.intervalDays)>=2 && Number(h.intervalDays)<=365 ? Number(h.intervalDays) : 2,
      monthlyDay: Number.isInteger(Number(h.monthlyDay)) && Number(h.monthlyDay)>=1 && Number(h.monthlyDay)<=31 ? Number(h.monthlyDay) : 1,
      scheduleStartDate: isValidDateKey(h.scheduleStartDate) ? h.scheduleStartDate : '',
      scheduleEndDate: isValidDateKey(h.scheduleEndDate) ? h.scheduleEndDate : '',
      scheduleAnchor: /^\d{4}-\d{2}-\d{2}$/.test(h.scheduleAnchor||'') ? h.scheduleAnchor : (typeof h.createdAt==='string'?h.createdAt.slice(0,10):todayKey()),
      customDays: Array.isArray(h.customDays) ? h.customDays.map(Number).filter(n => Number.isInteger(n)&&n>=0&&n<=6) : [],
      reminders: [...new Set((Array.isArray(h.reminders) ? h.reminders : (h.reminder ? [h.reminder] : [])).filter(t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].slice(0,5),
      createdAt: typeof h.createdAt === 'string' ? h.createdAt : s.createdAt,
      archived: Boolean(h.archived), archivedAt: h.archivedAt || null, paused: Boolean(h.paused), notes: typeof h.notes === 'string' ? h.notes.slice(0,500) : ''
    })) : [];
    s.logs = raw.logs && typeof raw.logs === 'object' && !Array.isArray(raw.logs) ? raw.logs : {};
    Object.keys(s.logs).forEach(date => {
      if (!isValidDateKey(date) || !s.logs[date] || typeof s.logs[date] !== 'object') delete s.logs[date];
      else Object.keys(s.logs[date]).forEach(id => { if (!s.habits.some(h=>h.id===id) || !s.logs[date][id] || typeof s.logs[date][id] !== 'object') delete s.logs[date][id]; else s.logs[date][id] = { done: Boolean(s.logs[date][id].done), skipped: Boolean(s.logs[date][id].skipped), failed: Boolean(s.logs[date][id].failed), value: typeof s.logs[date][id].value === 'number' && Number.isFinite(s.logs[date][id].value) ? s.logs[date][id].value : null, updatedAt: s.logs[date][id].updatedAt || null, note: typeof s.logs[date][id].note==='string'?s.logs[date][id].note.slice(0,300):'' }; });
    });
    if (raw.settings && typeof raw.settings === 'object') s.settings = { ...s.settings, dailySummary: Boolean(raw.settings.dailySummary), lastSummaryDate: raw.settings.lastSummaryDate || null, theme: raw.settings.theme === 'dark' ? 'dark' : 'light' };
    else s.settings.theme = 'light';
    s.reviews = raw.reviews && typeof raw.reviews === 'object' && !Array.isArray(raw.reviews) ? raw.reviews : {};
    s.customCategories = Array.isArray(raw.customCategories) ? [...new Set(raw.customCategories.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,30)).filter(Boolean))] : [];
    const validHabitIds = new Set(s.habits.map(h=>h.id));
    s.routines = Array.isArray(raw.routines) ? raw.routines.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&r.name.trim()).map(r=>({
      id:r.id, name:r.name.trim().slice(0,50), description:typeof r.description==='string'?r.description.slice(0,120):'',
      habitIds:[...new Set((Array.isArray(r.habitIds)?r.habitIds:[]).filter(id=>typeof id==='string'&&validHabitIds.has(id)))],
      createdAt:typeof r.createdAt==='string'?r.createdAt:new Date().toISOString()
    })) : [];
    s.reminderFired = raw.reminderFired && typeof raw.reminderFired === 'object' ? raw.reminderFired : {};
    s.schemaVersion = SCHEMA_VERSION;
    return s;
  }
  function loadState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || localStorage.getItem(SECOND_PREVIOUS_V55_KEY) || localStorage.getItem(SECOND_PREVIOUS_V54_KEY) || localStorage.getItem(SECOND_PREVIOUS_STORAGE_KEY) || localStorage.getItem(THIRD_PREVIOUS_STORAGE_KEY) || localStorage.getItem(FOURTH_PREVIOUS_STORAGE_KEY) || localStorage.getItem(OLDER_STORAGE_KEY) || localStorage.getItem(OLDEST_STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) { raw = legacy; localStorage.setItem(STORAGE_KEY, legacy); }
      }
      if (!raw) return defaultState();
      const migrated = normalizeState(JSON.parse(raw));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (err) { console.error('HabitPulse recovery:', err); try { const backup=localStorage.getItem(LAST_GOOD_KEY); if(backup){ const recovered=normalizeState(JSON.parse(backup)); localStorage.setItem(STORAGE_KEY,JSON.stringify(recovered)); return recovered; } } catch(recoveryError){ console.error('Last-good recovery failed:',recoveryError); } return defaultState(); }
  }
  function saveState() { try { state.schemaVersion = SCHEMA_VERSION; const serialized=JSON.stringify(state); localStorage.setItem(STORAGE_KEY, serialized); try{localStorage.setItem(LAST_GOOD_KEY,serialized);}catch(snapshotError){console.warn('Last-good snapshot could not be updated:',snapshotError);} return true; } catch (e) { showToast('Could not save. Storage may be full. Export a backup and free device storage.'); return false; } }
  function showToast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  function isScheduled(h, dateKey=todayKey()) {
    // A habit cannot be due before it was created. Compare date-only values to avoid timezone drift.
    const createdDate=typeof h.createdAt==='string'?h.createdAt.slice(0,10):'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(createdDate) && dateKey<createdDate) return false;
    if(/^\d{4}-\d{2}-\d{2}$/.test(h.scheduleStartDate||'') && dateKey<h.scheduleStartDate) return false;
    if(/^\d{4}-\d{2}-\d{2}$/.test(h.scheduleEndDate||'') && dateKey>h.scheduleEndDate) return false;
    const day=dayIndex(dateKey);
    if(h.schedule==='daily')return true;
    if(h.schedule==='weekdays')return day>=1&&day<=5;
    if(h.schedule==='weekends')return day===0||day===6;
    if(h.schedule==='custom')return (h.customDays||[]).includes(day);
    if(h.schedule==='monthly')return parseDate(dateKey).getDate()===Number(h.monthlyDay||1);
    if(h.schedule==='interval'){
      const anchor=h.scheduleAnchor||String(h.createdAt||todayKey()).slice(0,10);
      const [ay,am,ad]=anchor.split('-').map(Number);const [y,m,d]=dateKey.split('-').map(Number);
      const delta=Math.round((Date.UTC(y,m-1,d)-Date.UTC(ay,am-1,ad))/86400000);
      const every=Math.max(2,Math.min(365,Number(h.intervalDays)||2));
      return delta>=0 && delta%every===0;
    }
    return true;
  }
  function activeHabits() { return state.habits.filter(h=>!h.archived&&!h.paused); }
  function todayHabits() { const k=todayKey(); return activeHabits().filter(h=>isScheduled(h,k)); }
  function isDone(habitId, dateKey=todayKey()) { return Boolean(state.logs[dateKey] && state.logs[dateKey][habitId] && state.logs[dateKey][habitId].done); }
  function isSkipped(habitId,dateKey=todayKey()){return Boolean(state.logs[dateKey]&&state.logs[dateKey][habitId]&&state.logs[dateKey][habitId].skipped);}
  function skipToday(id){const k=todayKey();if(!state.logs[k])state.logs[k]={};state.logs[k][id]={...(state.logs[k][id]||{}),done:false,skipped:true,updatedAt:new Date().toISOString()};saveState();render();showToast('Today marked as skipped; it will not count as completed.');}
  function scheduleText(h) { if(h.schedule==='daily')return 'Every day'; if(h.schedule==='weekdays')return 'Mon–Fri'; if(h.schedule==='weekends')return 'Weekends'; if(h.schedule==='interval')return `Every ${h.intervalDays||2} days`; if(h.schedule==='monthly')return `Monthly · day ${h.monthlyDay||1}`; const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return h.customDays.length ? h.customDays.slice().sort((a,b)=>a-b).map(n=>names[n]).join(', ') : 'Choose days'; }
  function formatDate(d=new Date()) { return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'}).format(d); }
  function render() {
    if (activeView === 'home') { renderDashboard(); updateNav(); return; }
    if (activeView === 'today') { renderTrackingGrid(); updateNav(); return; }
    if (activeView === 'habits') { renderAllHabits(); updateNav(); return; }
    if (activeView === 'stats') { renderStats(); updateNav(); return; }
    if (activeView === 'review') { renderReview(); updateNav(); return; }
    if (activeView === 'planning') { renderPlanning(); updateNav(); return; }
    if (activeView === 'routineInsights') { renderRoutineInsights(); updateNav(); return; }
    if (activeView === 'more') { renderMore(); updateNav(); return; }
    if (activeView === 'routines') { renderRoutines(); updateNav(); return; }
    if (activeView === 'routineRun') { renderRoutineRun(); updateNav(); return; }
  }
  function renderDashboard(){
    const main=$('mainContent'), today=todayKey(), due=todayHabits().filter(h=>h.trackingType!=='weekly');
    const weeklyGoals=activeHabits().filter(h=>h.trackingType==='weekly');
    const done=due.filter(h=>isDone(h.id,today)).length, pct=due.length?Math.round(done/due.length*100):0;
    const pending=due.filter(h=>!isDone(h.id,today));
    const core=due.filter(h=>h.isCore), week=periodHabitRate('week');
    const hour=new Date().getHours(), greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
    const routines=(state.routines||[]).map(r=>{const hs=activeHabits().filter(h=>(r.habitIds||[]).includes(h.id)&&h.trackingType!=='weekly'&&isScheduled(h,today));const n=hs.filter(h=>isDone(h.id,today)).length;return {...r,due:hs.length,done:n,pct:hs.length?Math.round(n/hs.length*100):0};});
    const routineMarkup=routines.length?routines.map(r=>`<article class="dashboard-routine"><div class="dashboard-routine-top"><span>${escapeHTML(r.name)}</span><small>${r.due?`${r.done}/${r.due} · ${r.pct}%`:'No habits due today'}</small></div><div class="dashboard-routine-track"><i style="width:${r.pct}%"></i></div><button class="dashboard-routine-launch" type="button" data-dash-start-routine="${escapeHTML(r.id)}">${r.due?'▶ Continue routine':'Open routine'} <span>→</span></button></article>`).join(''):'<div class="dashboard-empty card"><p>Group your existing habits into Morning, Evening or custom routines to see your day in a clearer flow.</p><button class="secondary-btn" id="dashCreateRoutine">＋ Create a routine</button></div>';
    const next=pending.slice(0,5).map(h=>`<article class="dashboard-next-row"><button class="dashboard-next-name" type="button" data-dash-habit="${escapeHTML(h.id)}"><strong>${escapeHTML(h.name)}</strong><small>${escapeHTML(h.category||'Habit')}${h.isCore?' · Core':''}</small></button>${['numeric','atMost'].includes(h.trackingType)?`<button class="dashboard-quick-action" type="button" data-dash-numeric="${escapeHTML(h.id)}" aria-label="Record ${escapeHTML(h.name)}">＋</button>`:`<button class="dashboard-quick-action" type="button" data-dash-complete="${escapeHTML(h.id)}" aria-label="Complete ${escapeHTML(h.name)}">✓</button>`}</article>`).join('');
    const completed=due.filter(h=>isDone(h.id,today));
    main.innerHTML=`<section class="dashboard-greeting"><p class="eyebrow">${formatDate().toUpperCase()}</p><h2>${greeting}. Keep it steady.</h2><p>One step at a time is still progress.</p></section>
      <section class="dashboard-progress card"><div><p class="eyebrow">TODAY'S MOMENTUM</p><h3>${!due.length?'A lighter day today.':done===due.length?'All planned habits complete.':`${pending.length} ${pending.length===1?'habit':'habits'} left today`}</h3><p>${done} of ${due.length} daily habits completed · ${week.rate}% this week</p><div class="dashboard-progress-track"><i style="width:${pct}%"></i></div><small>${due.length?`${due.length-done} remaining · ${done} completed`:'No daily habits due today'}</small></div><div class="dashboard-ring" style="--progress:${pct*3.6}deg"><strong>${pct}%</strong></div></section>
      <section class="dashboard-shortcuts"><button class="dashboard-shortcut" id="dashToday"><b>✓</b><span>Track today</span></button><button class="dashboard-shortcut" id="dashAdd"><b>＋</b><span>New habit</span></button><button class="dashboard-shortcut" id="dashInsights"><b>↗</b><span>Insights</span></button></section>
      ${weeklyGoals.length?`<section class="dashboard-section"><div class="dashboard-section-head"><h3>Weekly goals</h3><button id="dashWeeklyTrack">Track →</button></div>${weeklyGoals.map(h=>{const n=weeklyProgress(h),p=Math.min(100,Math.round(n/Math.max(1,h.weeklyTarget)*100));return `<article class="dashboard-routine"><div class="dashboard-routine-top"><span>${escapeHTML(h.name)}</span><small>${n}/${h.weeklyTarget} this week</small></div><div class="dashboard-routine-track"><i style="width:${p}%"></i></div></article>`;}).join('')}</section>`:''}
      <section class="dashboard-section"><div class="dashboard-section-head"><h3>Your routines</h3><button id="dashAllRoutines">Manage →</button></div>${routineMarkup}</section>
      <section class="dashboard-section"><div class="dashboard-section-head"><h3>${pending.length?'Up next':'Today at a glance'}</h3><button id="dashAllHabits">All habits →</button></div>${next||'<div class="dashboard-empty card"><p>You are all caught up. Take a moment to appreciate what you completed.</p></div>'}</section>
      ${completed.length?`<section class="dashboard-section dashboard-completed"><div class="dashboard-section-head"><h3>Completed today</h3><span>${completed.length}</span></div><div class="dashboard-completed-list">${completed.slice(0,4).map(h=>`<span>✓ ${escapeHTML(h.name)}</span>`).join('')}</div></section>`:''}
      <section class="mini-stats"><article class="mini-stat card"><span class="stat-icon">✦</span><div><strong>${activeHabits().length}</strong><span>Active habits</span></div></article><article class="mini-stat card"><span class="stat-icon">◎</span><div><strong>${core.length}</strong><span>Core due today</span></div></article></section>
      <p class="privacy-note">🔒 Your data stays on this device unless you export a backup.</p>`;
    $('dashWeeklyTrack')?.addEventListener('click',()=>goView('today'));$('dashToday').onclick=()=>goView('today');$('dashAdd').onclick=()=>openHabitModal();$('dashInsights').onclick=()=>goView('stats');$('dashAllRoutines').onclick=()=>goView('routines');$('dashAllHabits').onclick=()=>goView('habits');$('dashCreateRoutine')?.addEventListener('click',()=>goView('routines'));
    main.querySelectorAll('[data-dash-habit]').forEach(btn=>btn.onclick=()=>openHabitDetails(btn.dataset.dashHabit));
    main.querySelectorAll('[data-dash-numeric]').forEach(btn=>btn.onclick=()=>openQuickEntry(btn.dataset.dashNumeric,today));
    main.querySelectorAll('[data-dash-complete]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.dashComplete;if(!state.logs[today])state.logs[today]={};const old=state.logs[today][id]||{};state.logs[today][id]={...old,done:true,skipped:false,failed:false,updatedAt:new Date().toISOString()};if(saveState())renderDashboard();});
    main.querySelectorAll('[data-dash-start-routine]').forEach(btn=>btn.onclick=()=>{activeRoutineId=btn.dataset.dashStartRoutine;goView('routineRun');});
  }
  function renderTrackingGrid(){
    const main=$('mainContent');
    const active=activeHabits();
    const today=todayKey();
    const days=Array.from({length:7},(_,i)=>{const d=parseDate(today);d.setDate(d.getDate()-(6-i));return todayKey(d);});
    const dailyActive=active.filter(h=>h.trackingType!=='weekly');
    const doneToday=dailyActive.filter(h=>isDone(h.id,today)).length;
    const dueToday=dailyActive.filter(h=>isScheduled(h,today)).length;
    const pct=dueToday?Math.round(doneToday/dueToday*100):0;
    const dayHead=days.map(k=>{const d=parseDate(k);return `<div class="track-day-head ${k===today?'is-today':''}"><b>${d.toLocaleDateString(undefined,{weekday:'short'}).slice(0,3)}</b><small>${d.getDate()}</small></div>`;}).join('');
    const groups=new Map();
    active.forEach(h=>{const group=h.isCore?'Core habits':(h.category||'Other');if(!groups.has(group))groups.set(group,[]);groups.get(group).push(h);});
    let rows='';
    groups.forEach((items,group)=>{
      rows+=`<div class="track-group-title">${escapeHTML(group)} <small>${items.length}</small></div>`;
      items.forEach(h=>{
        const cells=days.map(k=>{
          const log=((state.logs[k]||{})[h.id])||{};const scheduled=isScheduled(h,k);let cls='not-due',symbol='·',sub='';
          if(log.skipped){cls='skipped';symbol='−';}
          else if(log.failed){cls='failed';symbol='×';}
          else if(log.done){cls='done';symbol='✓';}
          else if((h.trackingType==='numeric'||h.trackingType==='atMost')&&log.value!=null){cls='partial';symbol=String(log.value);sub=h.numericUnit||'';}
          else if(scheduled){cls='pending';symbol='○';}
          return `<button type="button" class="track-cell ${cls}" data-quick-habit="${h.id}" data-quick-date="${k}" aria-label="${escapeHTML(h.name)} ${k}: ${cls}" title="${k}"><b>${symbol}</b>${sub?`<small>${escapeHTML(sub)}</small>`:''}</button>`;
        }).join('');
        rows+=`<div class="track-row"><div class="track-habit-name"><span class="track-habit-title">${escapeHTML(h.name)}</span><small>${escapeHTML(h.category)}${h.trackingType==='weekly'?` · Weekly goal ${weeklyProgress(h)}/${h.weeklyTarget}`:''}</small><button type="button" class="track-detail-link" data-track-detail="${h.id}" aria-label="Statistics for ${escapeHTML(h.name)}">▥</button></div>${cells}</div>`;
      });
    });
    main.innerHTML=`<section class="track-toolbar"><div><h2>Habits</h2><p>${formatDate()} · ${doneToday}/${dueToday} completed · ${pct}%</p></div><div class="track-toolbar-actions"><button class="icon-btn" id="trackAdd" aria-label="Add habit" title="Add habit">＋</button><button class="icon-btn" id="trackManage" aria-label="Manage habits" title="Manage habits">☷</button><button class="icon-btn" id="trackFilter" aria-label="Filter habits" title="Filter">≡</button></div></section>
      <div class="track-legend"><span><i class="legend-dot done"></i>Done</span><span><i class="legend-dot skipped"></i>Skipped</span><span><i class="legend-dot failed"></i>Missed</span><span><i class="legend-dot pending"></i>Pending</span></div>
      ${active.length?`<div class="track-grid-scroll"><div class="track-grid"><div class="track-grid-head"><div class="track-name-head">Habit</div>${dayHead}</div>${rows}</div></div>`:`<div class="empty-state card"><div class="empty-icon">✦</div><h3>A fresh start</h3><p>Add your first habit. Keep it small enough to repeat.</p><button class="primary-btn" id="trackEmptyAdd">＋ Create a habit</button></div>`}
      <p class="track-footnote">Tap any day to record or edit its status and note. Swipe horizontally to view all seven days.</p>`;
    const add=()=>openHabitModal();$('trackAdd')?.addEventListener('click',add);$('trackEmptyAdd')?.addEventListener('click',add);$('trackManage')?.addEventListener('click',()=>goView('habits'));
    $('trackFilter')?.addEventListener('click',()=>{const choices=['All habits','Core habits only','Today scheduled only'];const choice=prompt('Show: 1 All habits, 2 Core habits only, 3 Today scheduled only','1');if(choice===null)return;state.settings.trackFilter=['1','2','3'].includes(choice)?choice:'1';saveState();render();});
    if(state.settings.trackFilter==='2'||state.settings.trackFilter==='3'){
      const filter=state.settings.trackFilter;main.querySelectorAll('.track-row').forEach(row=>{const id=row.querySelector('[data-track-detail]')?.dataset.trackDetail;const h=active.find(x=>x.id===id);if(h&&((filter==='2'&&!h.isCore)||(filter==='3'&&!isScheduled(h,today))))row.remove();});
      main.querySelectorAll('.track-group-title').forEach(g=>{if(!g.nextElementSibling||!g.nextElementSibling.classList.contains('track-row'))g.remove();});
    }
    main.querySelectorAll('[data-quick-habit]').forEach(b=>b.addEventListener('click',()=>openQuickEntry(b.dataset.quickHabit,b.dataset.quickDate)));
    main.querySelectorAll('[data-track-detail]').forEach(b=>b.addEventListener('click',()=>openHabitDetails(b.dataset.trackDetail)));
  }
  function openQuickEntry(habitId,dateKey){
    const h=state.habits.find(x=>x.id===habitId);if(!h)return;const log=((state.logs[dateKey]||{})[habitId])||{};
    $('quickEntryTitle').textContent=h.name;$('quickEntryDate').textContent=formatDate(parseDate(dateKey));$('quickEntryNote').value=log.note||'';
    $('quickNumericWrap').classList.toggle('hidden',!['numeric','atMost'].includes(h.trackingType));$('quickNumericValue').value=log.value??'';$('quickNumericValue').placeholder=`Target ${h.numericTarget} ${h.numericUnit||''}`;
    $('quickEntryBackdrop').classList.remove('hidden');
    $('quickEntryClose').onclick=()=>closeModal('quickEntryBackdrop');
    $('quickEntryBackdrop').onclick=e=>{if(e.target===$('quickEntryBackdrop'))closeModal('quickEntryBackdrop');};
    $('quickEntryBackdrop').querySelectorAll('[data-quick-status]').forEach(btn=>btn.onclick=()=>{
      const status=btn.dataset.quickStatus;let next={...(log||{}),updatedAt:new Date().toISOString(),note:$('quickEntryNote').value.trim().slice(0,300)};
      if(status==='clear'){if(state.logs[dateKey]){delete state.logs[dateKey][habitId];if(!Object.keys(state.logs[dateKey]).length)delete state.logs[dateKey];}}
      else if(status==='done'||status==='failed'||status==='skipped'){
        next.done=status==='done';next.failed=status==='failed';next.skipped=status==='skipped';
        if(['numeric','atMost'].includes(h.trackingType)&&$('quickNumericValue').value!==''){
          const n=Number($('quickNumericValue').value);if(!Number.isFinite(n)||n<0){showToast('Enter a valid non-negative number.');return;}next.value=n;if(status==='done')next.done=h.trackingType==='atMost'?n<=h.numericTarget:n>=h.numericTarget;
        }
        if(!state.logs[dateKey])state.logs[dateKey]={};state.logs[dateKey][habitId]=next;
      }
      saveState();closeModal('quickEntryBackdrop');render();showToast(status==='clear'?'Entry cleared.':'Entry saved.');
    });
  }
  function createHabitCard(h) {
    const done=isDone(h.id); const skipped=isSkipped(h.id); const card=document.createElement('article'); card.className=`habit-card${done?' done':''}${h.trackingType==='numeric'||h.trackingType==='atMost'?' numeric-habit':''}`;
    const check=document.createElement('button'); check.className='check-btn'; check.textContent=done?'✓':''; check.setAttribute('aria-label',done?'Mark incomplete':`Complete ${h.name}`); if(h.trackingType==='numeric'||h.trackingType==='atMost'){check.disabled=true;check.style.visibility='hidden';}else check.addEventListener('click',()=>toggleHabit(h.id));
    const main=document.createElement('div'); main.className='habit-main';
    const title=document.createElement('div'); title.className='habit-title'; title.textContent=h.name+(skipped?' · Skipped':'');
    const meta=document.createElement('div'); meta.className='habit-meta';
    const cat=document.createElement('span'); cat.className='category-pill'; cat.textContent=h.category;
    const sched=document.createElement('span'); const rangeLabel=h.scheduleStartDate||h.scheduleEndDate?` · ${h.scheduleStartDate?`from ${h.scheduleStartDate}`:'from habit start'}${h.scheduleEndDate?` to ${h.scheduleEndDate}`:''}`:''; sched.textContent=scheduleText(h)+rangeLabel+((h.reminders|| (h.reminder?[h.reminder]:[])).length?` · ${(h.reminders||[h.reminder]).join(', ')}`:'');
    meta.append(cat,sched); if(h.notes){const note=document.createElement('div');note.className='habit-meta';note.textContent=h.notes;main.append(note);} if(h.isCore){const core=document.createElement('span');core.className='core-badge';core.textContent='CORE';meta.append(core);} main.append(title,meta); if(h.trackingType==='numeric'||h.trackingType==='atMost'){const entry=document.createElement('div');entry.className='numeric-entry';const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.inputMode='decimal';input.placeholder='Value';input.title=`Target ${h.numericTarget} ${h.numericUnit}`;input.value=(state.logs[todayKey()]&&state.logs[todayKey()][h.id]&&state.logs[todayKey()][h.id].value!=null)?state.logs[todayKey()][h.id].value:'';input.setAttribute('aria-label',`Today's ${h.name} amount`);const save=document.createElement('button');save.className='tiny-btn';save.textContent='✓';save.title='Save value';save.setAttribute('aria-label',`Save ${h.name} value`);save.onclick=()=>saveNumericValue(h.id,input.value);entry.append(input,save);meta.append(entry);} else if(h.trackingType==='weekly'){const progress=document.createElement('div');progress.className='habit-meta';progress.textContent=`This week: ${weeklyProgress(h)}/${h.weeklyTarget} days`;main.append(progress);}
    const actions=document.createElement('div'); actions.className='habit-actions';
    const details=document.createElement('button'); details.className='icon-action'; details.textContent='▥'; details.title='Habit statistics'; details.setAttribute('aria-label',`Statistics for ${h.name}`); details.addEventListener('click',()=>openHabitDetails(h.id));
    const edit=document.createElement('button'); edit.className='icon-action'; edit.textContent='✎'; edit.title='Edit habit'; edit.setAttribute('aria-label',`Edit ${h.name}`); edit.addEventListener('click',()=>openHabitModal(h.id));
    const more=document.createElement('button'); more.className='icon-action'; more.textContent='⋯'; more.title='More options'; more.setAttribute('aria-label',`More options for ${h.name}`); more.addEventListener('click',()=>showHabitActions(h));
    actions.append(details,edit,more); card.append(check,main,actions); return card;
  }
  function openHabitDetails(id){
    const h=state.habits.find(x=>x.id===id); if(!h)return;
    const root=$('habitDetailContent');
    const today=new Date();today.setHours(12,0,0,0);
    const created=new Date(String(h.createdAt||todayKey()).slice(0,10)+'T12:00:00');
    const totalLogs=Object.values(state.logs).reduce((n,day)=>n+(day&&day[h.id]&&day[h.id].done?1:0),0);
    const score=habitScore(h),current=streakFor(h),best=bestStreakFor(h);
    const monthStart=new Date(today.getFullYear(),today.getMonth(),1,12);
    const monthDays=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
    let cal='<span class="detail-weekday">S</span><span class="detail-weekday">M</span><span class="detail-weekday">T</span><span class="detail-weekday">W</span><span class="detail-weekday">T</span><span class="detail-weekday">F</span><span class="detail-weekday">S</span>';
    for(let i=0;i<monthStart.getDay();i++)cal+='<span class="detail-day blank"></span>';
    let doneMonth=0,skipMonth=0;
    for(let n=1;n<=monthDays;n++){const d=new Date(today.getFullYear(),today.getMonth(),n,12);const k=todayKey(d);const log=(state.logs[k]||{})[h.id]||{};const scheduled=h.trackingType==='weekly'?false:isScheduled(h,k);const partial=(h.trackingType==='numeric'&&Number(log.value||0)>0&&!log.done);const cls=log.skipped?'skipped':log.done?'complete':partial?'partial':scheduled?'missed':'not-due';if(log.done)doneMonth++;if(log.skipped)skipMonth++;cal+=`<button type="button" class="detail-day ${cls}" data-edit-date="${k}" title="Edit ${k}">${n}</button>`;}
    const scorePoints=[];for(let i=11;i>=0;i--){const end=new Date(today);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);let due=0,earned=0;for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){if(d<created||d>today)continue;const k=todayKey(d),log=(state.logs[k]||{})[h.id]||{};if(h.trackingType==='weekly'){continue;}if(!isScheduled(h,k)||log.skipped)continue;due++;earned+=h.trackingType==='numeric'?Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1))):(h.trackingType==='atMost'?(log.value!=null&&Number(log.value)<=Number(h.numericTarget||1)?1:0):(log.done?1:0));}scorePoints.push({label:end.toLocaleDateString(undefined,{month:'short',day:'numeric'}),value:due?Math.round(earned/due*100):null});}
    if(h.trackingType==='weekly'){scorePoints.forEach((p,i)=>{const end=new Date(today);end.setDate(end.getDate()-(11-i)*7);const ws=new Date(end);ws.setDate(ws.getDate()-((ws.getDay()+6)%7));let c=0;for(let j=0;j<7;j++){const d=new Date(ws);d.setDate(d.getDate()+j);if(d<=today&&d>=created&&isDone(h.id,todayKey(d)))c++;}p.value=Math.min(100,Math.round(c/Math.max(1,h.weeklyTarget)*100));});}
    const pts=scorePoints.filter(p=>p.value!==null);let line='';if(pts.length){const w=320,hgt=118;line=pts.map((p,i)=>`${i?'L':'M'} ${(i/(Math.max(1,pts.length-1)))*w} ${hgt-(p.value/100)*hgt}`).join(' ');}
    const hist=[];for(let i=11;i>=0;i--){const end=new Date(today);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);let count=0;for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){if(d<created||d>today)continue;if(isDone(h.id,todayKey(d)))count++;}hist.push({label:end.toLocaleDateString(undefined,{month:'short',day:'numeric'}),count});}
    const streaks=[];if(h.trackingType==='weekly'){const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};let runStart=null,run=0;const first=monday(created),last=monday(today);for(let ws=new Date(first);ws<=last;ws.setDate(ws.getDate()+7)){let count=0;for(let j=0;j<7;j++){const d=new Date(ws);d.setDate(d.getDate()+j);if(d>=created&&d<=today&&isDone(h.id,todayKey(d)))count++;}const met=count>=Math.max(1,Number(h.weeklyTarget)||1);if(met){if(!run)runStart=new Date(ws);run++;}else{if(run>=2){const end=new Date(ws);end.setDate(end.getDate()-1);streaks.push({start:new Date(runStart),end,days:run});}run=0;}}if(run>=2)streaks.push({start:new Date(runStart),end:new Date(last),days:run});}else{let runStart=null,run=0;for(let d=new Date(created);d<=today;d.setDate(d.getDate()+1)){const k=todayKey(d);if(isScheduled(h,k)){if(isDone(h.id,k)){if(!run)runStart=new Date(d);run++;}else{if(run>=2)streaks.push({start:new Date(runStart),end:new Date(d.getTime()-86400000),days:run});run=0;}}}if(run>=2)streaks.push({start:new Date(runStart),end:new Date(today),days:run});}streaks.sort((a,b)=>b.days-a.days);const topStreaks=streaks.slice(0,8),maxStreak=Math.max(1,...topStreaks.map(x=>x.days));
    const weekdayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];const freq=weekdayNames.map((name,day)=>{let due=0,done=0;for(let d=new Date(created);d<=today;d.setDate(d.getDate()+1)){if(d.getDay()!==day)continue;const k=todayKey(d);if(isScheduled(h,k)){due++;if(isDone(h.id,k))done++;}}return {name,due,done,rate:due?Math.round(done/due*100):0};});
    const recovery=recoveryMetrics(h);
    const recoveryRate=recovery.rate===null?'—':`${recovery.rate}%`;
    const lastDoneLabel=recovery.lastDone?formatDate(parseDate(recovery.lastDone)):'No completion yet';
    const overview=`<div class="detail-overview"><div><strong>${score}%</strong><span>Score · 90 days</span></div><div><strong>${current}</strong><span>Current streak</span></div><div><strong>${best}</strong><span>Best streak</span></div><div><strong>${totalLogs}</strong><span>Total done</span></div></div><div class="recovery-panel"><div class="recovery-head"><strong>Getting back on track</strong><span>Recovery insight</span></div><div class="recovery-grid"><div><strong>${recoveryRate}</strong><span>Next-opportunity recovery</span></div><div><strong>${recovery.recovered}/${recovery.misses}</strong><span>Recovered after a miss</span></div><div><strong>${lastDoneLabel}</strong><span>Last completed</span></div></div><p class="detail-help">This shows how often the next scheduled opportunity was completed after a missed one. Skipped days are excluded. It is an insight, not a grade.</p></div>`;
    root.innerHTML=`<div class="detail-top"><button class="icon-btn" id="detailBack" aria-label="Back">‹</button><h2 id="detailTitle">${escapeHTML(h.name)}</h2><button class="icon-btn" id="detailEditTop" aria-label="Edit habit">✎</button></div>
      <nav class="detail-jump" aria-label="Statistics sections">${['Overview','Score','History','Calendar','Best streaks','Frequency'].map((x,i)=>`<button type="button" data-jump="detail-sec-${i}">${x}</button>`).join('')}</nav>
      <section class="detail-section" id="detail-sec-0"><div class="detail-section-head"><h3>Overview</h3><span class="field-help">${doneMonth} done this month · ${skipMonth} skipped</span></div>${overview}</section>
      <section class="detail-section" id="detail-sec-1"><div class="detail-section-head"><h3>Score</h3><button class="detail-collapse" aria-label="Collapse Score" aria-expanded="true">⌃</button></div><div class="detail-section-body"><svg class="detail-chart" viewBox="0 0 320 145" role="img" aria-label="Weekly habit score trend"><line class="gridline" x1="0" y1="24" x2="320" y2="24"/><line class="gridline" x1="0" y1="70" x2="320" y2="70"/><line class="gridline" x1="0" y1="116" x2="320" y2="116"/><text x="2" y="18">100%</text><text x="2" y="64">50%</text><text x="2" y="110">0%</text>${line?`<path class="series" d="${line}" transform="translate(0,0)"/>`:''}${pts.map((p,i)=>`<circle class="point" cx="${(i/(Math.max(1,pts.length-1)))*320}" cy="${118-(p.value/100)*118}" r="3.5"><title>${p.label}: ${p.value}%</title></circle>`).join('')}</svg><p class="detail-help">Weekly score trend over the last 12 weeks. Numerical habits receive proportional credit; skipped and unscheduled days are excluded.</p></div></section>
      <section class="detail-section" id="detail-sec-2"><div class="detail-section-head"><h3>History</h3><button class="detail-collapse" aria-label="Collapse History" aria-expanded="true">⌃</button></div><div class="detail-section-body"><div class="detail-bars">${hist.map(x=>`<div class="detail-bar-col" title="${x.label}: ${x.count} completed"><span style="height:${Math.max(2,x.count/Math.max(1,...hist.map(y=>y.count))*100)}%"></span><small>${x.label.split(' ')[0]}</small></div>`).join('')}</div><p class="detail-help">Number of completions in each of the last 12 weeks. Weekly-target habits count completed days toward their weekly target.</p></div></section>
      <section class="detail-section" id="detail-sec-3"><div class="detail-section-head"><h3>Calendar · ${monthStart.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button class="detail-collapse" aria-label="Collapse Calendar" aria-expanded="true">⌃</button></div><div class="detail-section-body"><div class="detail-calendar">${cal}</div><p class="detail-help">Green: completed · Amber: partial · Grey: scheduled but missed · Striped: skipped. Tap a date to edit its history.</p></div></section>
      <section class="detail-section" id="detail-sec-4"><div class="detail-section-head"><h3>Best streaks</h3><button class="detail-collapse" aria-label="Collapse Best streaks" aria-expanded="true">⌃</button></div><div class="detail-section-body"><div class="streak-list">${topStreaks.length?topStreaks.map(x=>`<div class="streak-row"><span>${x.start.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span><i style="opacity:${.35+.65*x.days/maxStreak};width:${Math.max(10,x.days/maxStreak*100)}%"></i><strong>${x.days} days</strong></div>`).join(''):'<p class="detail-help">Complete a habit on consecutive scheduled days to build a streak.</p>'}</div></div></section>
      <section class="detail-section" id="detail-sec-5"><div class="detail-section-head"><h3>Frequency</h3><button class="detail-collapse" aria-label="Collapse Frequency" aria-expanded="true">⌃</button></div><div class="detail-section-body"><div class="frequency-grid">${freq.map(x=>`<div class="frequency-row"><span>${x.name}</span><div class="frequency-track"><div class="frequency-fill" style="width:${x.rate}%"></div></div><strong>${x.rate}%</strong></div>`).join('')}</div><p class="detail-help">Completion rate by weekday across this habit's scheduled history.</p></div></section>
      <div class="detail-edit"><button class="primary-btn full-btn" id="detailEditBtn">Edit habit</button></div>`;
    $('detailBack').onclick=()=>closeModal('habitDetailBackdrop');const edit=()=>{closeModal('habitDetailBackdrop');openHabitModal(h.id);};$('detailEditBtn').onclick=edit;$('detailEditTop').onclick=edit;
    root.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>$(b.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'}));
    root.querySelectorAll('.detail-collapse').forEach(b=>b.onclick=()=>{const section=b.closest('.detail-section');const collapsed=section.classList.toggle('collapsed');b.textContent=collapsed?'⌄':'⌃';b.setAttribute('aria-expanded',String(!collapsed));});
    root.querySelectorAll('[data-edit-date]').forEach(btn=>btn.addEventListener('click',()=>editHistoricalLog(h.id,btn.dataset.editDate)));
    $('habitDetailBackdrop').classList.remove('hidden');const modal=$('habitDetailBackdrop').querySelector('.detail-modal');modal.scrollTop=0;
  }
  function showHabitActions(h) { const action=prompt(`Habit: ${h.name}\nE = edit · S = skip today · P = ${h.paused?'resume':'pause'} · A = archive · D = delete · C = duplicate · U = move up · W = move down`,'E'); if(!action)return; if(action.toUpperCase()==='E')openHabitModal(h.id); else if(action.toUpperCase()==='S')skipToday(h.id); else if(action.toUpperCase()==='P'){h.paused=!h.paused;saveState();render();showToast(h.paused?'Habit paused.':'Habit resumed.');} else if(action.toUpperCase()==='A'){ if(confirm(`Archive “${h.name}”? Its history will be kept.`)){h.archived=true;h.archivedAt=new Date().toISOString();saveState();render();showToast('Habit archived; history kept.');}} else if(action.toUpperCase()==='C'){const copy={...h,id:uid(),name:(h.name+' (copy)').slice(0,70),createdAt:new Date().toISOString(),archived:false,archivedAt:null,paused:false};state.habits.push(copy);saveState();render();showToast('Habit duplicated; history starts fresh.');} else if(action.toUpperCase()==='U'||action.toUpperCase()==='W'){const i=state.habits.findIndex(x=>x.id===h.id),j=action.toUpperCase()==='U'?i-1:i+1;if(j>=0&&j<state.habits.length){[state.habits[i],state.habits[j]]=[state.habits[j],state.habits[i]];saveState();render();showToast('Habit order updated.');}} else if(action.toUpperCase()==='D'){ if(confirm(`Permanently delete “${h.name}” and its history? Export a backup first if needed.`)){state.habits=state.habits.filter(x=>x.id!==h.id);Object.keys(state.logs).forEach(k=>{if(state.logs[k])delete state.logs[k][h.id]});saveState();render();showToast('Habit deleted.');}} }
  function toggleHabit(id) { const k=todayKey(); if(!state.logs[k])state.logs[k]={}; const old=state.logs[k][id]; state.logs[k][id]={...(old||{}),done:!Boolean(old&&old.done),updatedAt:new Date().toISOString()}; saveState();render(); }
  function saveNumericValue(id, value) { const h=state.habits.find(x=>x.id===id); if(!h)return; const n=Number(value); if(!Number.isFinite(n)||n<0){showToast('Enter a valid non-negative number.');return;} const k=todayKey(); if(!state.logs[k])state.logs[k]={}; const old=state.logs[k][id]||{}; state.logs[k][id]={...old,value:n,done:h.trackingType==='atMost'?n<=h.numericTarget:n>=h.numericTarget,updatedAt:new Date().toISOString()}; saveState();render(); }
  function weeklyProgress(h, endDate=new Date()) {
    const end=new Date(endDate);end.setHours(12,0,0,0);
    const start=new Date(end);start.setDate(start.getDate()-((start.getDay()+6)%7));
    let count=0;
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      const k=todayKey(d);if(isScheduled(h,k)&&isDone(h.id,k))count++;
    }
    return count;
  }
  function weeklyStreakFor(h, best=false){
    const created=String(h.createdAt||todayKey()).slice(0,10);
    const today=new Date();today.setHours(12,0,0,0);
    const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
    const first=monday(new Date(created+'T12:00:00'));
    const current=monday(today);
    const target=Math.max(1,Number(h.weeklyTarget)||1);
    const met=ws=>{let count=0;for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);const k=todayKey(d);if(k>=created&&d<=today&&isDone(h.id,k))count++;}return count>=target;};
    let bestRun=0,run=0,last=monday(current);
    // Current week contributes only after its target has been reached; otherwise streak is based on completed prior weeks.
    if(!met(current))last.setDate(last.getDate()-7);
    for(let ws=new Date(first);ws<=last;ws.setDate(ws.getDate()+7)){
      if(met(ws)){run++;bestRun=Math.max(bestRun,run);}else run=0;
    }
    if(best)return bestRun;
    let streak=0;for(let ws=new Date(last);ws>=first;ws.setDate(ws.getDate()-7)){if(!met(ws))break;streak++;}
    return streak;
  }
  function streakFor(h) {
    if(h.trackingType==='weekly')return weeklyStreakFor(h,false);
    let streak=0;const d=new Date();d.setHours(12,0,0,0);
    const today=todayKey(d);
    if(isScheduled(h,today)&&!isDone(h.id,today)&&!isSkipped(h.id,today))d.setDate(d.getDate()-1);
    const created=String(h.createdAt||'').slice(0,10);
    for(let i=0;i<3660;i++){
      const k=todayKey(d);if(created&&k<created)break;
      if(isScheduled(h,k)){
        if(isSkipped(h.id,k))break;
        if(isDone(h.id,k))streak++;else break;
      }
      d.setDate(d.getDate()-1);
    }
    return streak;
  }
  function bestStreakFor(h){
    if(h.trackingType==='weekly')return weeklyStreakFor(h,true);
    let best=0,run=0;const start=new Date(String(h.createdAt||todayKey()).slice(0,10)+'T12:00:00');
    const d=new Date(start);const end=new Date();end.setHours(12,0,0,0);
    for(;d<=end;d.setDate(d.getDate()+1)){
      const k=todayKey(d);if(!isScheduled(h,k))continue;
      if(isSkipped(h.id,k)){run=0;continue;}
      if(isDone(h.id,k)){run++;best=Math.max(best,run);}else run=0;
    }
    return best;
  }
  function habitScore(h){
    const end=new Date();end.setHours(12,0,0,0);const start=new Date(end);start.setDate(start.getDate()-89);
    if(h.trackingType==='weekly'){
      let weeks=0,earned=0;const cursor=new Date(start);cursor.setDate(cursor.getDate()-((cursor.getDay()+6)%7));
      while(cursor<=end){let completed=0;for(let i=0;i<7;i++){const d=new Date(cursor);d.setDate(d.getDate()+i);if(d<start||d>end||todayKey(d)<String(h.createdAt||'').slice(0,10))continue;const k=todayKey(d);if(isDone(h.id,k))completed++;}const weekEnd=new Date(cursor);weekEnd.setDate(weekEnd.getDate()+6);if(weekEnd<=end){weeks++;earned+=Math.min(1,completed/Math.max(1,h.weeklyTarget||1));}cursor.setDate(cursor.getDate()+7);}
      return weeks?Math.round(earned/weeks*100):0;
    }
    let possible=0,earned=0;for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const k=todayKey(d);if(!isScheduled(h,k)||isSkipped(h.id,k))continue;possible++;const log=(state.logs[k]||{})[h.id]||{};if(h.trackingType==='numeric'){earned+=Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1)));}else if(h.trackingType==='atMost'){earned+=(log.value!=null&&Number(log.value)<=Number(h.numericTarget||1))?1:0;}else if(log.done)earned+=1;}
    return possible?Math.round(earned/possible*100):0;
  }
  // Recovery insight: measures whether the next eligible opportunity is completed after a miss.
  // It is descriptive only and never changes the user's score, streak, or saved history.
  function recoveryMetrics(h){
    const created=String(h.createdAt||todayKey()).slice(0,10);
    const today=new Date();today.setHours(12,0,0,0);
    let misses=0,recovered=0,lastDone=null;
    if(h.trackingType==='weekly'){
      const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
      const createdDate=new Date(created+'T12:00:00');
      const first=monday(createdDate);
      if(first<createdDate)first.setDate(first.getDate()+7); // Ignore a partial first week: the full target was not available.
      const current=monday(today);
      const weeks=[];
      for(let ws=new Date(first);ws<current;ws.setDate(ws.getDate()+7)){
        let count=0;for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d<new Date(created+'T12:00:00')||d>today)continue;if(isDone(h.id,todayKey(d)))count++;}
        weeks.push(count>=Math.max(1,Number(h.weeklyTarget)||1));
      }
      for(let i=0;i<weeks.length-1;i++){if(!weeks[i]&&weeks[i+1]!==undefined){misses++;if(weeks[i+1])recovered++;}}
    }else{
      const opportunities=[];
      const start=new Date(created+'T12:00:00');
      for(let d=new Date(start);d<today;d.setDate(d.getDate()+1)){
        const k=todayKey(d);if(!isScheduled(h,k))continue;
        const log=(state.logs[k]||{})[h.id]||{};
        if(log.skipped)continue;
        opportunities.push(Boolean(log.done));
      }
      for(let i=0;i<opportunities.length-1;i++){if(!opportunities[i]){misses++;if(opportunities[i+1])recovered++;}}
    }
    Object.keys(state.logs).sort().forEach(k=>{const log=(state.logs[k]||{})[h.id];if(log&&log.done&&(!lastDone||k>lastDone))lastDone=k;});
    return {misses,recovered,rate:misses?Math.round(recovered/misses*100):null,lastDone};
  }

  function periodHabitRate(type){
    const now=new Date();now.setHours(12,0,0,0);
    let start=new Date(now),end=new Date(now);
    if(type==='week'){start.setDate(start.getDate()-((start.getDay()+6)%7));end.setDate(start.getDate()+6);}
    else if(type==='month'){start.setDate(1);end=new Date(start.getFullYear(),start.getMonth()+1,0,12);}
    else{start=new Date(now.getFullYear(),0,1,12);end=new Date(now.getFullYear(),11,31,12);}
    const cutoff=end<now?end:now;let due=0,earned=0;
    activeHabits().forEach(h=>{
      if(h.trackingType==='weekly'){
        let weekStart=new Date(start);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
        for(let ws=new Date(weekStart);ws<=cutoff;ws.setDate(ws.getDate()+7)){
          const we=new Date(ws);we.setDate(we.getDate()+6);
          let completed=0,hasEligibleDay=false;
          for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d<start||d>cutoff)continue;const k=todayKey(d);if(d>=new Date(String(h.createdAt||'0001-01-01').slice(0,10)+'T12:00:00'))hasEligibleDay=true;if(isDone(h.id,k))completed++;}
          if(hasEligibleDay){due++;earned+=Math.min(1,completed/Math.max(1,Number(h.weeklyTarget)||1));}
        }
        return;
      }
      for(let d=new Date(start);d<=cutoff;d.setDate(d.getDate()+1)){
        const k=todayKey(d);if(!isScheduled(h,k)||isSkipped(h.id,k))continue;
        due++;const log=(state.logs[k]||{})[h.id]||{};
        earned+=h.trackingType==='numeric'?Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1))):h.trackingType==='atMost'?(log.done?1:0):(log.done?1:0);
      }
    });
    return {due,earned:Math.round(earned*10)/10,rate:due?Math.round(earned/due*100):0};
  }
  function editHistoricalLog(habitId,dateKey){const h=state.habits.find(x=>x.id===habitId);if(!h)return;const existing=((state.logs[dateKey]||{})[habitId])||{};let promptText=(h.trackingType==='numeric'||h.trackingType==='atMost')?`Edit ${h.name} for ${dateKey}. Enter a number, or type skip / clear.`:`Edit ${h.name} for ${dateKey}. Type done, skip, failed, or clear.`;const answer=prompt(promptText,h.trackingType==='numeric'?(existing.value??(existing.skipped?'skip':'')):(existing.skipped?'skip':existing.done?'done':''));if(answer===null)return;const value=answer.trim().toLowerCase();if(!state.logs[dateKey])state.logs[dateKey]={};if(value==='clear'||value===''){delete state.logs[dateKey][habitId];if(!Object.keys(state.logs[dateKey]).length)delete state.logs[dateKey];}else if(value==='skip'){state.logs[dateKey][habitId]={done:false,skipped:true,failed:false,value:null,updatedAt:new Date().toISOString()};}else if(value==='failed'||value==='missed'){state.logs[dateKey][habitId]={done:false,skipped:false,failed:true,value:null,updatedAt:new Date().toISOString()};}else if(h.trackingType==='numeric'||h.trackingType==='atMost'){const n=Number(value);if(!Number.isFinite(n)||n<0){showToast('Enter a non-negative number, skip, or clear.');return;}state.logs[dateKey][habitId]={done:h.trackingType==='atMost'?n<=Number(h.numericTarget||1):n>=Number(h.numericTarget||1),skipped:false,value:n,updatedAt:new Date().toISOString()};}else if(value==='done'){state.logs[dateKey][habitId]={...(existing||{}),done:true,skipped:false,updatedAt:new Date().toISOString()};}else{showToast('Use done, skip, failed, or clear.');return;}if(saveState()){render();openHabitDetails(habitId);showToast('Historical entry updated.');if(state.logs[dateKey]&&state.logs[dateKey][habitId]){const note=prompt('Optional note for this day:',state.logs[dateKey][habitId].note||'');if(note!==null){state.logs[dateKey][habitId].note=note.trim().slice(0,300);saveState();}}}}

  function openHabitModal(id=null) { $('habitForm').reset(); const catSelect=$('habitCategory');[...catSelect.options].filter(o=>!BUILTIN_CATEGORIES.includes(o.value)).forEach(o=>o.remove());state.customCategories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;catSelect.append(o);}); $('habitId').value=''; $('habitModalTitle').textContent=id?'Edit habit':'Create a habit'; if(id){const h=state.habits.find(x=>x.id===id);if(!h)return;$('habitId').value=h.id;$('habitName').value=h.name;$('habitDescription').value=h.description||'';$('habitNotes').value=h.notes||'';$('habitCategory').value=h.category;ensureCategoryOption(h.category);$('habitCore').checked=Boolean(h.isCore);$('trackingType').value=h.trackingType||'check';$('numericTarget').value=h.numericTarget||1;$('numericUnit').value=h.numericUnit||'';$('weeklyTarget').value=h.weeklyTarget||3;$('habitSchedule').value=h.schedule;$('intervalDays').value=h.intervalDays||2;$('monthlyDay').value=h.monthlyDay||1;$('scheduleStartDate').value=h.scheduleStartDate||'';$('scheduleEndDate').value=h.scheduleEndDate||'';$('habitReminder').value=(h.reminders|| (h.reminder?[h.reminder]:[])).join(', ');document.querySelectorAll('#customDays input').forEach(c=>c.checked=h.customDays.includes(Number(c.value)));} $('customDays').classList.toggle('hidden',$('habitSchedule').value!=='custom'); $('intervalFields').classList.toggle('hidden',$('habitSchedule').value!=='interval'); $('monthlyFields').classList.toggle('hidden',$('habitSchedule').value!=='monthly'); updateTrackingFields(); $('habitModalBackdrop').classList.remove('hidden'); setTimeout(()=>$('habitName').focus(),100); }
  function closeModal(id) { $(id).classList.add('hidden'); }
  function saveHabit(e) { e.preventDefault(); const name=$('habitName').value.trim(); if(!name){showToast('Enter a habit name.');return;} const schedule=$('habitSchedule').value; const customDays=[...document.querySelectorAll('#customDays input:checked')].map(c=>Number(c.value)); if($('trackingType').value!=='weekly'&&schedule==='custom'&&!customDays.length){showToast('Choose at least one day.');return;} const intervalDays=Number($('intervalDays').value||2),monthlyDay=Number($('monthlyDay').value||1); if(schedule==='interval'&&(!Number.isInteger(intervalDays)||intervalDays<2||intervalDays>365)){showToast('Repeat interval must be 2–365 days.');return;} if(schedule==='monthly'&&(!Number.isInteger(monthlyDay)||monthlyDay<1||monthlyDay>31)){showToast('Choose a day from 1 to 31.');return;} const scheduleStartDate=$('scheduleStartDate').value; const scheduleEndDate=$('scheduleEndDate').value; if(scheduleStartDate&&scheduleEndDate&&scheduleEndDate<scheduleStartDate){showToast('End date must be on or after the start date.');return;} const id=$('habitId').value; const existing=id?state.habits.find(h=>h.id===id):null; const trackingType=$('trackingType').value; const effectiveSchedule=trackingType==='weekly'?'daily':schedule; const numericTarget=Number($('numericTarget').value||1); const weeklyTarget=Number($('weeklyTarget').value||3); if((trackingType==='numeric'||trackingType==='atMost')&&(!Number.isFinite(numericTarget)||numericTarget<=0)){showToast('Enter a target greater than zero.');return;} if(trackingType==='weekly'&&(!Number.isInteger(weeklyTarget)||weeklyTarget<1||weeklyTarget>7)){showToast('Weekly target must be 1–7 days.');return;} const reminderTimes=$('habitReminder').value.split(',').map(t=>t.trim()).filter(Boolean); if(reminderTimes.length>5||reminderTimes.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))){showToast('Use up to 5 valid times, e.g. 07:00, 20:30.');return;} const h={id:id||uid(),name,description:$('habitDescription').value.trim(),notes:$('habitNotes').value.trim(),isCore:$('habitCore').checked,category:$('habitCategory').value,trackingType,numericTarget,numericUnit:$('numericUnit').value.trim(),weeklyTarget,schedule:effectiveSchedule,customDays,intervalDays,monthlyDay,scheduleStartDate,scheduleEndDate,scheduleAnchor:existing&&existing.schedule===effectiveSchedule&&Number(existing.intervalDays||2)===intervalDays? (existing.scheduleAnchor||String(existing.createdAt).slice(0,10)):todayKey(),reminders:[...new Set($('habitReminder').value.split(',').map(t=>t.trim()).filter(Boolean))],createdAt:existing?existing.createdAt:new Date().toISOString(),archived:false,archivedAt:null,paused:existing?Boolean(existing.paused):false}; if(existing)Object.assign(existing,h);else state.habits.push(h); saveState();closeModal('habitModalBackdrop');render();showToast(existing?'Habit updated.':'Habit added.'); }
  function weeklyRate() { const result=periodHabitRate('week'); return result.due?`${result.rate}%`:'—'; }
  function renderAllHabits() { const main=$('mainContent'); main.innerHTML=`<section class="section-head"><div><h2>All habits</h2><p>Manage your habits and schedules</p></div><button class="primary-btn" id="viewAddHabit">＋ Add</button></section><section class="view-panel card"><h3>Quick-start templates</h3><p>Start with a suggested habit, then customise its schedule and target.</p><div class="template-grid"><button class="secondary-btn" data-template="quran">📖 Qur'an reading</button><button class="secondary-btn" data-template="adhkar">☀ Morning adhkar</button><button class="secondary-btn" data-template="exercise">🏃 Exercise</button><button class="secondary-btn" data-template="study">📚 Islamic learning</button><button class="secondary-btn" data-template="reading">📘 General reading</button></div></section><div id="allHabitList" class="habit-list"></div><section class="view-panel card"><h3>Archived habits</h3><div id="archivedList"></div></section>`; $('viewAddHabit').onclick=()=>openHabitModal(); main.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>addTemplate(b.dataset.template)); const list=$('allHabitList'); const act=activeHabits(); const paused=state.habits.filter(h=>h.paused&&!h.archived); if(!act.length){list.innerHTML='<div class="empty-state card"><p>No active habits yet.</p></div>';} act.forEach(h=>list.appendChild(createHabitCard(h))); paused.forEach(h=>{const row=document.createElement('div');row.className='history-row';const name=document.createElement('span');name.textContent=h.name+' · Paused';const btn=document.createElement('button');btn.className='text-btn';btn.textContent='Resume';btn.onclick=()=>{h.paused=false;saveState();render();};row.append(name,btn);list.append(row);}); const archived=state.habits.filter(h=>h.archived); const a=$('archivedList'); if(!archived.length)a.innerHTML='<p>No archived habits.</p>'; archived.forEach(h=>{const row=document.createElement('div');row.className='history-row';const name=document.createElement('span');name.textContent=h.name;const btn=document.createElement('button');btn.className='text-btn';btn.textContent='Restore';btn.onclick=()=>{h.archived=false;h.archivedAt=null;saveState();render();showToast('Habit restored.');};row.append(name,btn);a.append(row);}); }
  // Period analytics use the same scheduled-opportunity rules as the main score.
  function rangeHabitProgress(h,start,end){
    if(h.trackingType==='weekly')return {due:0,earned:0,rate:null};
    const created=String(h.createdAt||'').slice(0,10);let due=0,earned=0;
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      const k=todayKey(d);if(created&&k<created)continue;if(!isScheduled(h,k)||isSkipped(h.id,k))continue;
      due++;const log=(state.logs[k]||{})[h.id]||{};
      if(h.trackingType==='numeric')earned+=Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1)));
      else if(h.trackingType==='atMost')earned+=log.value!=null?(Number(log.value)<=Number(h.numericTarget||1)?1:0):(log.done?1:0);
      else if(log.done)earned++;
    }
    return {due,earned,rate:due?Math.round(earned/due*100):null};
  }
  function rangeHabitProgressAll(start,end){
    let due=0,earned=0;activeHabits().forEach(h=>{const r=rangeHabitProgress(h,start,end);due+=r.due;earned+=r.earned;});
    return {due,earned,rate:due?Math.round(earned/due*100):null};
  }
  function renderStats(){
    const main=$('mainContent');const week=periodHabitRate('week'),month=periodHabitRate('month'),year=periodHabitRate('year');
    let rows='';for(let i=29;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const k=todayKey(d);let due=0,earned=0;activeHabits().forEach(h=>{if(h.trackingType==='weekly'||!isScheduled(h,k)||isSkipped(h.id,k))return;due++;const log=(state.logs[k]||{})[h.id]||{};earned+=h.trackingType==='numeric'?Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1))):h.trackingType==='atMost'?(log.done?1:0):(log.done?1:0);});const rate=due?Math.round(earned/due*100):null;rows+=`<div class="history-row"><span>${formatDate(d)}</span><strong>${rate===null?'—':`${rate}%`}</strong></div>`;}
    let yearGrid='';{const today=new Date();today.setHours(12,0,0,0);const start=new Date(today);start.setDate(start.getDate()-((start.getDay()+6)%7)-77);let cells='<div class="consistency-weekday">M</div><div class="consistency-weekday">T</div><div class="consistency-weekday">W</div><div class="consistency-weekday">T</div><div class="consistency-weekday">F</div><div class="consistency-weekday">S</div><div class="consistency-weekday">S</div>';let dayTotals=Array.from({length:7},()=>({due:0,earned:0}));for(let i=0;i<84;i++){const d=new Date(start);d.setDate(d.getDate()+i);const k=todayKey(d);let due=0,earned=0;if(d<=today)activeHabits().forEach(h=>{if(h.trackingType==='weekly'||!isScheduled(h,k)||isSkipped(h.id,k))return;const log=(state.logs[k]||{})[h.id]||{};due++;earned+=h.trackingType==='numeric'?Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1))):h.trackingType==='atMost'?(log.value!=null?(Number(log.value)<=Number(h.numericTarget||1)?1:0):(log.done?1:0)):(log.done?1:0);});const pct=due?Math.round(earned/due*100):null;const level=pct===null?0:pct===0?0:pct<25?1:pct<50?2:pct<80?3:4;const future=d>today;cells+=`<span class="consistency-day" data-level="${future?0:level}" title="${k}: ${future?'Future':pct===null?'No scheduled habits':pct+'%'}" aria-label="${k}: ${future?'Future':pct===null?'No scheduled habits':pct+'%'}">${d.getDate()}</span>`;if(!future&&due){const idx=(d.getDay()+6)%7;dayTotals[idx].due+=due;dayTotals[idx].earned+=earned;}}const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];const rankedDays=dayTotals.map((x,i)=>({...x,day:weekdays[i],rate:x.due?Math.round(x.earned/x.due*100):null})).filter(x=>x.due>=3).sort((a,b)=>b.rate-a.rate);const dayInsight=rankedDays.length?`<div class="history-row"><span>Strongest day pattern</span><strong>${rankedDays[0].day} · ${rankedDays[0].rate}%</strong></div><p class="field-help">Based on ${rankedDays[0].due} scheduled opportunities over the last 12 weeks; it describes past patterns, not a recommendation to avoid other days.</p>`:'<p class="field-help">More scheduled entries are needed to identify a reliable weekday pattern.</p>';yearGrid=`<section class="view-panel card"><h3>Consistency calendar · last 12 weeks</h3><div class="consistency-grid">${cells}</div><div class="consistency-legend"><span>Less</span><i></i><i></i><i></i><i></i><i></i><span>More</span></div>${dayInsight}<p class="field-help">Each square is a date. Colour represents completion across scheduled daily habits, including proportional progress for numeric targets. Skipped and unscheduled entries are excluded; weekly-target habits are shown separately.</p></section>`;}
    let habitRows='';activeHabits().forEach(h=>{const streak=streakFor(h),best=bestStreakFor(h),score=habitScore(h);const suffix=h.trackingType==='weekly'?` · ${weeklyProgress(h)}/${h.weeklyTarget} this week`:'';habitRows+=`<div class="history-row"><span>${escapeHTML(h.name)}${suffix}</span><strong>${score}% score · ${streak} current · ${best} best</strong></div>`;});
    const monthBars=[];for(let m=0;m<12;m++){const a=new Date(new Date().getFullYear(),m,1,12);if(a>new Date())break;let due=0,earned=0;const last=new Date(a.getFullYear(),a.getMonth()+1,0,12);for(let d=new Date(a);d<=last&&d<=new Date();d.setDate(d.getDate()+1)){const k=todayKey(d);activeHabits().forEach(h=>{if(h.trackingType==='weekly'||!isScheduled(h,k)||isSkipped(h.id,k))return;due++;const log=(state.logs[k]||{})[h.id]||{};earned+=h.trackingType==='numeric'?Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1))):h.trackingType==='atMost'?(log.done?1:0):(log.done?1:0);});}const pct=due?Math.round(earned/due*100):0;monthBars.push(`<div class="trend-column" title="${a.toLocaleDateString(undefined,{month:'long'})}: ${pct}%"><div class="trend-bar-wrap"><span class="trend-bar" style="height:${pct}%;"></span></div><small>${a.toLocaleDateString(undefined,{month:'short'}).slice(0,1)}</small></div>`);}
    let dailyBars='';for(let i=13;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const k=todayKey(d);const due=activeHabits().filter(h=>h.trackingType!=='weekly'&&isScheduled(h,k)&&!isSkipped(h.id,k));let earned=0;due.forEach(h=>{const log=(state.logs[k]||{})[h.id]||{};earned+=h.trackingType==='numeric'?Math.min(1,Math.max(0,Number(log.value||0))/Math.max(1,Number(h.numericTarget||1))):h.trackingType==='atMost'?(log.done?1:0):(log.done?1:0);});const pct=due.length?Math.round(earned/due.length*100):0;dailyBars+=`<div class="trend-column" title="${k}: ${pct}%"><div class="trend-bar-wrap"><span class="trend-bar" style="height:${pct}%;"></span></div><small>${d.toLocaleDateString(undefined,{weekday:'short'}).slice(0,1)}</small></div>`;}
    const today=new Date();today.setHours(12,0,0,0);
    const current30Start=new Date(today);current30Start.setDate(current30Start.getDate()-29);
    const previous30End=new Date(current30Start);previous30End.setDate(previous30End.getDate()-1);
    const previous30Start=new Date(previous30End);previous30Start.setDate(previous30Start.getDate()-29);
    const current30=rangeHabitProgressAll(current30Start,today),previous30=rangeHabitProgressAll(previous30Start,previous30End);
    const delta=current30.rate===null||previous30.rate===null?null:current30.rate-previous30.rate;
    const ranked=activeHabits().map(h=>({h,score:habitScore(h),opps:rangeHabitProgress(h,current30Start,today).due}));
    const eligible=ranked.filter(x=>x.opps>=5).sort((a,b)=>b.score-a.score);
    const best=eligible.slice(0,Math.min(3,Math.ceil(eligible.length/2))),needs=eligible.slice(Math.max(best.length,eligible.length-3)).reverse();
    const report=ranked.sort((a,b)=>b.score-a.score).map(({h,score})=>{
      const now=rangeHabitProgress(h,current30Start,today),before=rangeHabitProgress(h,previous30Start,previous30End);
      const trend=now.rate===null?'Weekly target':before.rate===null?'—':`${now.rate-before.rate>0?'+':''}${now.rate-before.rate} pts`;
      const value=now.rate===null?`${score}% · ${h.weeklyTarget||3}/week target`:`${now.rate}% · ${now.due} due · ${trend}`;
      return `<div class="history-row"><span>${escapeHTML(h.name)}</span><strong>${value}</strong></div>`;
    }).join('');
    const changeText=delta===null?'Not enough scheduled data':`${delta>0?'+':''}${delta} percentage points`;
    const changeClass=delta===null?'neutral':delta>0?'positive':delta<0?'negative':'neutral';
    const bestRows=best.map(x=>`<div class="history-row"><span>${escapeHTML(x.h.name)}</span><strong>${x.score}%</strong></div>`).join('')||'<p>No habit has at least five scheduled opportunities in the last 30 days yet.</p>';
    const needsRows=needs.map(x=>`<div class="history-row"><span>${escapeHTML(x.h.name)}</span><strong>${x.score}%</strong></div>`).join('')||'<p>More tracking data is needed before highlighting habits that need attention.</p>';
    main.innerHTML=`<section class="section-head"><div><h2>Insights</h2><p>Understand patterns across weeks, months and the year</p></div><button class="secondary-btn" id="insightsReview">Life review</button></section><div class="mini-stats"><div class="mini-stat card"><div><strong>${week.rate}%</strong><span>This week</span></div></div><div class="mini-stat card"><div><strong>${month.rate}%</strong><span>This month</span></div></div><div class="mini-stat card"><div><strong>${year.rate}%</strong><span>This year</span></div></div><div class="mini-stat card"><div><strong>${activeHabits().length}</strong><span>Active habits</span></div></div></div><section class="view-panel card"><h3>Last 30 days vs previous 30</h3><div class="comparison-metric"><strong>${current30.rate===null?'—':current30.rate+'%'}</strong><span class="${changeClass}">${changeText}</span></div><p class="field-help">${current30.due} scheduled opportunities compared with ${previous30.due} in the previous period. Weekly-target habits are shown separately in the habit report.</p></section><div class="insight-pair"><section class="view-panel card"><h3>Top performing</h3>${bestRows}</section><section class="view-panel card"><h3>Needs attention</h3>${needsRows}</section></div><section class="view-panel card"><h3>Habit progress report · 30 days</h3>${report||'<p>Add a habit to start building your report.</p>'}<p class="field-help">Trend compares the latest 30 days with the 30 days before that. Scores are descriptive and do not alter streaks or history.</p></section><section class="view-panel card"><h3>14-day consistency</h3><div class="trend-chart">${dailyBars}</div><p class="field-help">Daily score includes partial numerical progress. Skipped and unscheduled habits are excluded.</p></section><section class="view-panel card"><h3>${new Date().getFullYear()} monthly trend</h3><div class="trend-chart">${monthBars.join('')}</div><p class="field-help">Each bar represents the monthly average progress of scheduled daily habits.</p></section>${yearGrid}<section class="view-panel card"><h3>How scores work</h3><p>Scores represent weighted progress across scheduled opportunities in the last 90 days. Numerical targets receive proportional credit; at-most habits earn credit when the recorded value is within the limit. Skipped entries are excluded.</p></section><section class="view-panel card"><h3>Last 30 days</h3>${rows}</section><section class="view-panel card"><h3>Habit performance</h3>${habitRows||'<p>No active habits yet.</p>'}</section><section class="view-panel card"><h3>Score explained</h3><p>Scores are based on the last 90 days. Numerical habits receive proportional credit up to their target. Skipped and unscheduled days are excluded. Weekly-target habits are scored against their weekly target.</p></section>`; $('insightsReview').onclick=()=>goView('review');
  }

  function escapeHTML(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function periodStart(type, date=new Date()) { const d=new Date(date); d.setHours(12,0,0,0); if(type==='week'){d.setDate(d.getDate()-((d.getDay()+6)%7));} else if(type==='month'){d.setDate(1);} return d; }
  function periodKey(type,date=new Date()) { const d=periodStart(type,date); return type==='day'?todayKey(d):type==='week'?`week:${todayKey(d)}`:`month:${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function reviewMetrics(type) { const start=periodStart(type), days=type==='day'?1:type==='week'?7:new Date(start.getFullYear(),start.getMonth()+1,0).getDate(); let due=0,done=0; for(let i=0;i<days;i++){const d=new Date(start);d.setDate(d.getDate()+i);if(d>new Date())continue;const k=todayKey(d);activeHabits().forEach(h=>{if(h.trackingType==='weekly')return;if(isScheduled(h,k)){due++;if(isDone(h.id,k))done++;}});} return {due,done,rate:due?Math.round(done/due*100):0}; }
  // V8.5: evidence-based weekly review suggestions from existing logs only.
  function weeklyReviewInsights(){
    const now=new Date();now.setHours(12,0,0,0);
    const start=periodStart('week',now);
    const elapsed=Math.max(1,Math.floor((now-start)/86400000)+1);
    const currentEnd=new Date(start);currentEnd.setDate(currentEnd.getDate()+elapsed-1);
    const previousStart=new Date(start);previousStart.setDate(previousStart.getDate()-7);
    const previousEnd=new Date(previousStart);previousEnd.setDate(previousEnd.getDate()+elapsed-1);
    const current=rangeHabitProgressAll(start,currentEnd),previous=rangeHabitProgressAll(previousStart,previousEnd);
    const delta=current.rate===null||previous.rate===null?null:current.rate-previous.rate;
    const rows=activeHabits().map(h=>({h,now:rangeHabitProgress(h,start,currentEnd),before:rangeHabitProgress(h,previousStart,previousEnd)})).filter(x=>x.now.due>=2&&x.now.rate!==null);
    const improved=rows.filter(x=>x.before.rate!==null&&x.now.rate>x.before.rate).sort((a,b)=>(b.now.rate-b.before.rate)-(a.now.rate-a.before.rate));
    const slipped=rows.filter(x=>x.before.rate!==null&&x.now.rate<x.before.rate).sort((a,b)=>(a.now.rate-a.before.rate)-(b.now.rate-b.before.rate));
    const best=rows.slice().sort((a,b)=>b.now.rate-a.now.rate).slice(0,2);
    const list=arr=>arr.length?arr.map(x=>`<div class="history-row"><span>${escapeHTML(x.h.name)}</span><strong>${x.now.rate}%</strong></div>`).join(''):'<p class="field-help">আরও কিছু tracking data জমলে এখানে pattern দেখা যাবে।</p>';
    const change=delta===null?'তুলনার জন্য পর্যাপ্ত data নেই':delta>0?`আগের সপ্তাহের একই সময়ের তুলনায় ${delta} percentage points উন্নতি` :delta<0?`আগের সপ্তাহের একই সময়ের তুলনায় ${Math.abs(delta)} percentage points কম`:'আগের সপ্তাহের একই সময়ের সমান';
    let suggestion='আগামী সপ্তাহে একটি ছোট, নির্দিষ্ট লক্ষ্য বেছে নাও—সব অভ্যাস একসঙ্গে বদলানোর প্রয়োজন নেই।';
    if(slipped.length)suggestion=`“${slipped[0].h.name}” অভ্যাসটির schedule বা reminder বাস্তবসম্মত কি না দেখে নিতে পারো।`;
    else if(improved.length)suggestion=`“${improved[0].h.name}” অভ্যাসে যে পদ্ধতিটি কাজ করেছে, সেটি ধরে রাখার চেষ্টা করো।`;
    return `<section class="view-panel card"><p class="eyebrow">SMART WEEKLY REVIEW</p><h3>এই সপ্তাহের সংক্ষিপ্ত বিশ্লেষণ</h3><div class="comparison-metric"><strong>${current.rate===null?'—':current.rate+'%'}</strong><span>${change}</span></div><p class="field-help">এই সপ্তাহের ${elapsed} দিনের scheduled opportunities: ${current.due}. তুলনা করা হয়েছে আগের সপ্তাহের একই সংখ্যক দিনের সঙ্গে (${previous.due}). Partial numeric progress অন্তর্ভুক্ত; skipped ও unscheduled entries বাদ।</p><div class="insight-pair"><div><h4>ভালো চলছে</h4>${list(best)}</div><div><h4>মনোযোগ দিতে পারো</h4>${list(slipped)}</div></div><div class="review-suggestion"><strong>পরের সপ্তাহের ছোট পরামর্শ</strong><p>${suggestion}</p></div><p class="field-help">এগুলো log-ভিত্তিক pattern, কারণের নিশ্চিত ব্যাখ্যা নয়। Weekly-target habits এই daily comparison-এ অন্তর্ভুক্ত নয়।</p></section>`;
  }
  function renderReview(type='day') { const main=$('mainContent'); const labels={day:'Daily',week:'Weekly',month:'Monthly'}; const key=periodKey(type); const metric=reviewMetrics(type); const saved=state.reviews[key]||{}; const start=periodStart(type); const range=type==='day'?formatDate(start):type==='week'?`${formatDate(start)} – ${formatDate(new Date(start.getFullYear(),start.getMonth(),start.getDate()+6))}`:new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(start); const core=activeHabits().filter(h=>h.isCore).length; main.innerHTML=`<section class="section-head"><div><h2>Life review</h2><p>Reflect gently; progress is more than a score.</p></div></section><div class="review-tabs"><button class="secondary-btn ${type==='day'?'active':''}" data-review="day">Daily</button><button class="secondary-btn ${type==='week'?'active':''}" data-review="week">Weekly</button><button class="secondary-btn ${type==='month'?'active':''}" data-review="month">Monthly</button></div><section class="view-panel card"><p class="eyebrow">${labels[type].toUpperCase()} REVIEW</p><h3>${range}</h3><div class="review-grid"><div class="review-stat"><strong>${metric.rate}%</strong><span>Completion</span></div><div class="review-stat"><strong>${metric.done}/${metric.due}</strong><span>Completed / scheduled</span></div><div class="review-stat"><strong>${core}</strong><span>Core habits</span></div><div class="review-stat"><strong>${activeHabits().length}</strong><span>Active habits</span></div></div><p class="field-help">Weekly-target habits are tracked separately from daily completion. Unscheduled days are not counted as missed.</p></section>${type==='week'?weeklyReviewInsights():''}<section class="view-panel card"><h3>Reflection</h3><label>What went well?<textarea id="reviewGood" class="review-note" placeholder="A small win from this ${type}…">${escapeHTML(saved.good||'')}</textarea></label><label style="display:block;margin-top:12px">What could improve?<textarea id="reviewImprove" class="review-note" placeholder="One gentle adjustment…">${escapeHTML(saved.improve||'')}</textarea></label><label style="display:block;margin-top:12px">Focus for next period<textarea id="reviewFocus" class="review-note" placeholder="One realistic focus…">${escapeHTML(saved.focus||'')}</textarea></label><button class="primary-btn full-btn" id="saveReview">Save ${labels[type].toLowerCase()} review</button><p class="field-help">Reviews are optional and stored only on this device. Saving a review does not change habit history.</p></section>`; main.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>renderReview(b.dataset.review)); $('saveReview').onclick=()=>{state.reviews[key]={good:$('reviewGood').value.trim(),improve:$('reviewImprove').value.trim(),focus:$('reviewFocus').value.trim(),updatedAt:new Date().toISOString()};saveState();showToast(`${labels[type]} review saved.`);}; }
  const BUILTIN_CATEGORIES=['Core','Salah',"Qur'an",'Dhikr','Health','Sleep','Exercise','Family','Learning','Work','Personal growth','Islamic learning','Finance','Custom'];
  function ensureCategoryOption(value){const select=$('habitCategory');if(!select)return;if(![...select.options].some(o=>o.value===value)){const opt=document.createElement('option');opt.value=value;opt.textContent=value;select.append(opt);}select.value=value;}
  function renderCustomCategories(){const box=$('customCategoryList');if(!box)return;box.innerHTML='';if(!state.customCategories.length){box.innerHTML='<p class="field-help">No custom categories yet.</p>';return;}state.customCategories.forEach(cat=>{const row=document.createElement('div');row.className='history-row';const name=document.createElement('span');name.textContent=cat;const del=document.createElement('button');del.className='text-btn';del.textContent='Remove';del.onclick=()=>{if(state.habits.some(h=>h.category===cat)&&!confirm(`“${cat}” is used by existing habits. Remove it from the category list? Existing habits will keep their category.`))return;state.customCategories=state.customCategories.filter(x=>x!==cat);saveState();renderCustomCategories();showToast('Category removed from your list.');};row.append(name,del);box.append(row);});}
  function addCategory(){const name=prompt('New category name (up to 30 characters):');if(!name)return;const clean=name.trim().slice(0,30);if(!clean)return;if(BUILTIN_CATEGORIES.some(x=>x.toLowerCase()===clean.toLowerCase())||state.customCategories.some(x=>x.toLowerCase()===clean.toLowerCase())){showToast('That category already exists.');return;}state.customCategories.push(clean);saveState();renderCustomCategories();showToast('Category added.');}
  function addTemplate(type){const templates={quran:{name:"Qur'an reading",category:"Qur'an",trackingType:'numeric',numericTarget:2,numericUnit:'pages',schedule:'daily',isCore:false},adhkar:{name:'Morning adhkar',category:'Dhikr',trackingType:'check',schedule:'daily',isCore:false},exercise:{name:'Exercise',category:'Exercise',trackingType:'weekly',weeklyTarget:3,schedule:'daily',isCore:false},study:{name:'Islamic learning',category:'Islamic learning',trackingType:'weekly',weeklyTarget:2,schedule:'daily',isCore:false},reading:{name:'General reading',category:'Learning',trackingType:'numeric',numericTarget:10,numericUnit:'pages',schedule:'daily',isCore:false}};const t=templates[type];if(!t)return;if(state.habits.some(h=>!h.archived&&h.name.toLowerCase()===t.name.toLowerCase())){showToast('A habit with that name already exists.');return;}state.habits.push({id:uid(),...t,description:'',customDays:[],reminders:[],createdAt:new Date().toISOString(),archived:false,archivedAt:null});saveState();render();showToast('Template added. You can edit its target and schedule.');}
  function renderPlanning(){
    const main=$('mainContent');
    const start=new Date();start.setDate(start.getDate()+((8-start.getDay())%7||7));start.setHours(12,0,0,0);
    const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
    const scheduledByDay=days.map(d=>{const k=todayKey(d);return {date:d,key:k,habits:activeHabits().filter(h=>h.trackingType!=='weekly'&&isScheduled(h,k))};});
    const weekly=activeHabits().filter(h=>h.trackingType==='weekly');
    const counts=scheduledByDay.map(x=>x.habits.length), max=Math.max(1,...counts), avg=counts.length?Math.round(counts.reduce((a,b)=>a+b,0)/7*10)/10:0;
    const busiest=Math.max(...counts), lightest=Math.min(...counts);
    const focusCandidates=activeHabits().map(h=>{let due=0,done=0;for(let i=0;i<14;i++){const d=new Date();d.setDate(d.getDate()-i);const k=todayKey(d);if(h.trackingType==='weekly')continue;if(isScheduled(h,k)&&!isSkipped(h.id,k)){due++;if(isDone(h.id,k))done++;}}return {...h,due,rate:due?Math.round(done/due*100):null};}).filter(h=>h.due>=3&&h.rate!==null).sort((a,b)=>a.rate-b.rate);
    const focus=focusCandidates[0];
    main.innerHTML=`<section class="section-head"><div><h2>Smart habit planning</h2><p>Preview next week before it begins. Nothing changes automatically.</p></div></section>
      <section class="view-panel card"><p class="eyebrow">NEXT 7 DAYS</p><h3>${formatDate(days[0])} – ${formatDate(days[6])}</h3><div class="review-grid"><div class="review-stat"><strong>${avg}</strong><span>Average scheduled habits / day</span></div><div class="review-stat"><strong>${busiest}</strong><span>Most scheduled on one day</span></div><div class="review-stat"><strong>${activeHabits().length}</strong><span>Active habits</span></div><div class="review-stat"><strong>${weekly.length}</strong><span>Weekly-target habits</span></div></div><p class="field-help">This is a schedule preview, not a workload judgement. Weekly-target habits are shown separately because they can be completed on any eligible day.</p></section>
      <section class="view-panel card"><h3>Daily workload preview</h3>${scheduledByDay.map(x=>`<div class="history-row"><span>${new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(x.date)} · ${x.habits.length} ${x.habits.length===1?'habit':'habits'}<br><small style="color:var(--muted)">${x.habits.map(h=>escapeHTML(h.name)).join(' · ')||'No scheduled habits'}</small></span><strong>${Math.round(x.habits.length/max*100)}%</strong></div>`).join('')}</section>
      <section class="view-panel card"><h3>Suggested gentle focus</h3>${focus?`<p><strong>${escapeHTML(focus.name)}</strong> has a ${focus.rate}% completion rate across ${focus.due} scheduled opportunities in the last 14 days. Consider making its next step smaller or choosing a more convenient time.</p><button class="secondary-btn full-btn" id="editFocusHabit">Review this habit’s schedule & target</button>`:'<p>There is not enough recent scheduled data to recommend a focus habit yet. Keep recording naturally; no judgement is made from limited data.</p>'}${weekly.length?`<p class="field-help">Weekly targets: ${weekly.map(h=>`${escapeHTML(h.name)} (${Number(h.weeklyTarget)||3}/week)`).join(' · ')}. Spread these across lighter days if that suits your routine.</p>`:''}</section>
      <section class="view-panel card"><h3>Planning principles</h3><p>• Keep core habits realistic and protect room for prayer, rest, family and clinic/work commitments.<br>• Prefer a small repeatable action over an ambitious target that is hard to sustain.<br>• Move or edit a schedule only when it genuinely fits your routine. Past records are never changed by this planner.</p></section>`;
    const edit=$('editFocusHabit');if(edit)edit.onclick=()=>openHabitModal(focus.id);
  }
  function renderRoutineInsights(){
    const main=$('mainContent'), routines=state.routines||[], end=todayKey(), startDate=new Date();startDate.setDate(startDate.getDate()-29);startDate.setHours(12,0,0,0);const start=todayKey(startDate);
    const rows=routines.map(r=>{
      const members=activeHabits().filter(h=>(r.habitIds||[]).includes(h.id)&&h.trackingType!=='weekly');let due=0,done=0,skipped=0;
      for(let i=0;i<30;i++){const d=new Date(startDate);d.setDate(d.getDate()+i);const k=todayKey(d);members.forEach(h=>{if(!isScheduled(h,k))return;const log=state.logs[k]?.[h.id];if(log?.skipped){skipped++;return;}due++;if(log?.done)done++;});}
      return {...r,members:members.length,due,done,skipped,rate:due?Math.round(done/due*100):null};
    }).sort((a,b)=>(b.rate??-1)-(a.rate??-1));
    const eligible=rows.filter(r=>r.due>=5&&r.rate!==null),best=eligible[0];
    const cards=rows.map(r=>`<div class="history-row"><span><strong>${escapeHTML(r.name)}</strong><br><small style="color:var(--muted)">${r.members} daily habits · ${r.due} scheduled opportunities · ${r.skipped} skipped</small></span><strong>${r.rate===null?'Not enough data':r.rate+'%'}</strong></div>`).join('');
    const empty='<p>No routines yet. Create a Morning, Evening or custom routine and add your existing habits; this report will then calculate its progress.</p><button class="secondary-btn full-btn" id="insightCreateRoutine">＋ Create a routine</button>';
    main.innerHTML=`<section class="section-head"><div><h2>Routine insights</h2><p>See how your grouped habits are progressing.</p></div></section>
      <section class="view-panel card"><p class="eyebrow">LAST 30 DAYS</p><h3>Routine consistency</h3>${routines.length?`<div class="review-grid"><div class="review-stat"><strong>${routines.length}</strong><span>Routines</span></div><div class="review-stat"><strong>${eligible.length}</strong><span>With enough data</span></div><div class="review-stat"><strong>${best?best.rate+'%':'—'}</strong><span>Highest routine rate</span></div><div class="review-stat"><strong>${rows.reduce((n,r)=>n+r.members,0)}</strong><span>Routine memberships</span></div></div>`:empty}</section>
      ${routines.length?`<section class="view-panel card"><h3>Routine-by-routine progress</h3>${cards}</section><section class="view-panel card"><h3>What the pattern means</h3><p>${best?`“${escapeHTML(best.name)}” has the highest observed completion rate (${best.rate}%) among routines with at least five scheduled opportunities.`:'There is not enough scheduled activity yet to identify a leading routine. Keep tracking naturally.'}</p><p class="field-help">Calculation uses scheduled daily-habit opportunities over the last 30 calendar days. Skipped entries are excluded. Weekly-target habits are not included because they are tracked separately. This is descriptive, not a judgement or proof that the routine order caused the result.</p><button class="secondary-btn full-btn" id="insightOpenRoutines">Manage routines</button></section>`:''}`;
    $('insightCreateRoutine')?.addEventListener('click',()=>goView('routines'));$('insightOpenRoutines')?.addEventListener('click',()=>goView('routines'));
  }
  function renderMore() { const main=$('mainContent');main.innerHTML=`<section class="section-head"><div><h2>More</h2><p>Manage your system and personal settings</p></div></section><button class="manage-link" id="moreManageHabits"><span>☷ Habit library<br><small>Create, edit, pause and archive habits</small></span><span>›</span></button><button class="manage-link" id="morePlanning"><span>🧭 Smart habit planning<br><small>Preview next week’s workload and choose a gentle focus</small></span><span>›</span></button><button class="manage-link" id="moreRoutineInsights"><span>▦ Routine insights<br><small>Compare routine consistency over the last 30 days</small></span><span>›</span></button><button class="manage-link" id="moreReview"><span>✎ Life review<br><small>Daily, weekly and monthly reflection</small></span><span>›</span></button><button class="manage-link" id="moreSettings"><span>⚙ Settings & backup<br><small>Theme, notifications and data safety</small></span><span>›</span></button><section class="view-panel card"><h3>Habit categories</h3><p>Organise habits with built-in or custom categories.</p><div id="customCategoryList"></div><button class="secondary-btn full-btn" id="addCategoryBtn">＋ Add custom category</button></section><section class="view-panel card"><h3>Install HabitPulse</h3><p>Add HabitPulse to your Android home screen from your browser menu. A native live widget is not part of this PWA.</p><button class="secondary-btn full-btn" id="installHelpBtn">How to add to home screen</button></section><section class="view-panel card"><h3>Designed for sustainable progress</h3><p>Missed days are information, not failure. Adjust your plan when life changes; your history remains yours.</p></section>`;$('moreManageHabits').onclick=()=>goView('habits');$('moreReview').onclick=()=>goView('review');$('morePlanning').onclick=()=>goView('planning');$('moreRoutineInsights').onclick=()=>goView('routineInsights');$('moreSettings').onclick=()=>$('settingsModalBackdrop').classList.remove('hidden');renderCustomCategories();$('addCategoryBtn').onclick=addCategory;const ih=$('installHelpBtn');if(ih)ih.onclick=()=>alert('In Chrome on Android: open the browser menu (⋮), then choose Install app or Add to Home screen. The exact wording depends on your browser.'); }

  function openRoutineModal(id=null, preset=null){
    const form=$('routineForm');form.reset();$('routineId').value='';$('routineModalTitle').textContent=id?'Edit routine':'Create a routine';
    if(id){const r=state.routines.find(x=>x.id===id);if(!r)return;$('routineId').value=r.id;$('routineName').value=r.name;$('routineDescription').value=r.description||'';}
    else if(preset){$('routineName').value=preset.name;$('routineDescription').value=preset.description||'';}
    $('routineModalBackdrop').classList.remove('hidden');setTimeout(()=>$('routineName').focus(),80);
  }
  function saveRoutine(e){
    e.preventDefault();const name=$('routineName').value.trim(),description=$('routineDescription').value.trim().slice(0,120),id=$('routineId').value;
    if(!name){showToast('Enter a routine name.');return;}
    if(state.routines.some(r=>r.id!==id&&r.name.toLowerCase()===name.toLowerCase())){showToast('A routine with that name already exists.');return;}
    if(id){const r=state.routines.find(x=>x.id===id);if(!r)return;r.name=name.slice(0,50);r.description=description;}
    else state.routines.push({id:uid(),name:name.slice(0,50),description,habitIds:[],createdAt:new Date().toISOString()});
    if(saveState()){closeModal('routineModalBackdrop');render();showToast(id?'Routine updated.':'Routine created. Add your existing habits below.');}
  }
  function renderRoutineRun(){
    const main=$('mainContent'), routine=(state.routines||[]).find(r=>r.id===activeRoutineId);
    if(!routine){activeView='routines';renderRoutines();updateNav();return;}
    const members=(routine.habitIds||[]).map(id=>state.habits.find(h=>h.id===id)).filter(h=>h&&!h.archived&&!h.paused&&h.trackingType!=='weekly'&&isScheduled(h,todayKey()));
    const completed=members.filter(h=>isDone(h.id)).length, pending=members.filter(h=>!isDone(h.id));
    const current=pending[0]||null, pct=members.length?Math.round(completed/members.length*100):0;
    const rows=members.map((h,i)=>{const done=isDone(h.id);const numeric=['numeric','atMost'].includes(h.trackingType);const log=((state.logs[todayKey()]||{})[h.id])||{};
      return `<article class="run-habit ${done?'is-done':''}"><div class="run-step">${done?'✓':i+1}</div><div class="run-habit-copy"><strong>${escapeHTML(h.name)}</strong><small>${escapeHTML(h.category||'Habit')}${numeric?` · Target ${h.numericTarget} ${escapeHTML(h.numericUnit||'')}`:''}</small>${numeric&&log.value!=null?`<small>Today: ${log.value} ${escapeHTML(h.numericUnit||'')}</small>`:''}</div><div class="run-actions">${done?'<span class="run-done-label">Done</span>':numeric?`<button class="secondary-btn" data-run-numeric="${escapeHTML(h.id)}">Record</button>`:`<button class="primary-btn" data-run-done="${escapeHTML(h.id)}">Complete</button>`}</div></article>`;
    }).join('');
    main.innerHTML=`<section class="section-head"><div><button class="text-back" id="runBack">‹ Routines</button><h2>${escapeHTML(routine.name)}</h2><p>${formatDate()} · Your routine, at your pace</p></div></section>
      <section class="view-panel card run-progress-card"><div class="routine-progress-label"><strong>${completed} of ${members.length} completed</strong><span>${pct}%</span></div><div class="routine-progress-track"><i style="width:${pct}%"></i></div><p class="field-help">Only habits scheduled for today are included. Weekly goals and paused habits remain in their usual tracking areas.</p></section>
      ${members.length?`<section class="run-list">${rows}</section>`:'<section class="view-panel card"><h3>No habits due in this routine today</h3><p>There may be no scheduled habits today, or this routine has no active daily habits.</p></section>'}
      <section class="view-panel card run-next-card">${current?`<p class="eyebrow">UP NEXT</p><h3>${escapeHTML(current.name)}</h3><p>Take this one step at a time. You can complete habits in any order.</p>`:members.length?'<h3>Routine complete ✓</h3><p>All habits scheduled for today are recorded. Alhamdulillah—well done.</p>':'<h3>Ready when you are</h3>'}<div class="run-footer-actions"><button class="secondary-btn" id="runBackBottom">Back to routines</button><button class="secondary-btn" id="runToday">Open all habits</button></div></section>`;
    $('runBack').onclick=()=>goView('routines');$('runBackBottom').onclick=()=>goView('routines');$('runToday').onclick=()=>goView('today');
    main.querySelectorAll('[data-run-done]').forEach(b=>b.onclick=()=>{const id=b.dataset.runDone,k=todayKey();if(!state.logs[k])state.logs[k]={};const old=state.logs[k][id]||{};state.logs[k][id]={...old,done:true,skipped:false,updatedAt:new Date().toISOString()};if(saveState())renderRoutineRun();});
    main.querySelectorAll('[data-run-numeric]').forEach(b=>b.onclick=()=>openQuickEntry(b.dataset.runNumeric,todayKey()));
  }
  function renderRoutines(){
    const main=$('mainContent'),routines=state.routines||[],available=state.habits.filter(h=>!h.archived);
    const expanded=new Set([...main.querySelectorAll('[data-routine-id] details[open]')].map(d=>d.closest('[data-routine-id]')?.dataset.routineId).filter(Boolean));
    const cards=routines.map(r=>{
      const orderedIds=Array.isArray(r.habitIds)?r.habitIds:[];
      const members=orderedIds.map(id=>available.find(h=>h.id===id)).filter(Boolean);
      const due=members.filter(h=>!h.paused&&h.trackingType!=='weekly'&&isScheduled(h,todayKey()));
      const done=due.filter(h=>isDone(h.id,todayKey())).length,pct=due.length?Math.round(done/due.length*100):0;
      const checks=available.length?available.map(h=>`<label class="routine-habit-option"><input type="checkbox" data-routine-habit="${escapeHTML(r.id)}" value="${escapeHTML(h.id)}" ${(orderedIds).includes(h.id)?'checked':''}><span>${escapeHTML(h.name)}</span><small>${escapeHTML(h.paused?'Paused':h.category||'')}</small></label>`).join(''):'<div class="routine-empty-note">Create a habit first, then add it to this routine. Your habit history will stay in one place.</div>';
      const sequence=members.length?`<div class="routine-sequence"><div class="routine-sequence-title">Daily flow order <small>Use arrows to arrange your own sequence</small></div>${members.map((h,i)=>`<div class="routine-sequence-row"><span class="routine-sequence-number">${i+1}</span><span class="routine-sequence-name">${escapeHTML(h.name)}</span><span class="routine-sequence-actions"><button type="button" class="tiny-btn" data-sequence-move="up" data-routine="${escapeHTML(r.id)}" data-habit="${escapeHTML(h.id)}" aria-label="Move ${escapeHTML(h.name)} earlier" ${i===0?'disabled':''}>↑</button><button type="button" class="tiny-btn" data-sequence-move="down" data-routine="${escapeHTML(r.id)}" data-habit="${escapeHTML(h.id)}" aria-label="Move ${escapeHTML(h.name)} later" ${i===members.length-1?'disabled':''}>↓</button></span></div>`).join('')}</div>`:'<div class="routine-empty-note">Add habits below to build your daily flow.</div>';
      return `<article class="routine-card card" data-routine-id="${escapeHTML(r.id)}"><div class="routine-card-head"><div><h3>${escapeHTML(r.name)}</h3><p>${escapeHTML(r.description||'A flexible group of habits')}</p></div><div class="routine-actions"><button class="tiny-btn" data-routine-edit="${escapeHTML(r.id)}" type="button">Edit</button><button class="tiny-btn routine-delete" data-routine-delete="${escapeHTML(r.id)}" type="button">Delete</button></div></div><div class="routine-progress"><div class="routine-progress-label"><strong>${done}/${due.length} due today</strong><span>${pct}%</span></div><div class="routine-progress-track"><i style="width:${pct}%"></i></div></div><button type="button" class="primary-btn full-btn routine-start-btn" data-routine-start="${escapeHTML(r.id)}">▶ Start routine</button><details class="routine-members"><summary>Daily flow & habits <span>${members.length}</span></summary>${sequence}<div class="routine-habit-list">${checks}</div></details></article>`;
    }).join('');
    const empty=routines.length?'':`<div class="empty-state card"><div class="empty-icon">▦</div><h3>Build a routine around your day</h3><p>Start with a simple group such as Morning or Evening. Add existing habits; nothing gets duplicated.</p><div class="routine-presets"><button type="button" data-routine-preset="Morning routine">☀ Morning</button><button type="button" data-routine-preset="Evening routine">☾ Evening</button><button type="button" data-routine-preset="Work routine">▣ Work</button></div><button class="primary-btn" id="createFirstRoutine">＋ Create custom routine</button></div>`;
    main.innerHTML=`<section class="section-head"><div><h2>Routines</h2><p>Organise existing habits into a natural daily flow.</p></div><button class="primary-btn" id="createRoutine">＋ Add</button></section><div class="routine-note">Routines group existing daily habits; weekly-target habits keep their own weekly progress on Home. A habit can belong to more than one routine, and its history remains shared.</div>${cards||empty}`;
    $('createRoutine').onclick=()=>openRoutineModal();$('createFirstRoutine')?.addEventListener('click',()=>openRoutineModal());
    main.querySelectorAll('[data-routine-preset]').forEach(b=>b.onclick=()=>openRoutineModal(null,{name:b.dataset.routinePreset,description:'A simple flow for this part of the day.'}));
    main.querySelectorAll('[data-routine-habit]').forEach(input=>input.addEventListener('change',()=>{
      const r=state.routines.find(x=>x.id===input.dataset.routineHabit);if(!r)return;const id=input.value;r.habitIds=Array.isArray(r.habitIds)?r.habitIds:[];
      if(input.checked&&!r.habitIds.includes(id))r.habitIds.push(id);if(!input.checked)r.habitIds=r.habitIds.filter(x=>x!==id);
      const card=input.closest('[data-routine-id]'),wasOpen=card?.querySelector('details')?.open;
      if(saveState()){renderRoutines();const refreshed=main.querySelector(`[data-routine-id="${CSS.escape(r.id)}"] details`);if(refreshed&&wasOpen)refreshed.open=true;showToast('Routine updated.');}
    }));
    main.querySelectorAll('[data-sequence-move]').forEach(btn=>btn.onclick=()=>{
      const r=state.routines.find(x=>x.id===btn.dataset.routine);if(!r)return;
      const ids=Array.isArray(r.habitIds)?r.habitIds:[],from=ids.indexOf(btn.dataset.habit),to=from+(btn.dataset.sequenceMove==='up'?-1:1);
      if(from<0||to<0||to>=ids.length)return;
      [ids[from],ids[to]]=[ids[to],ids[from]];r.habitIds=ids;
      if(saveState()){renderRoutines();const d=main.querySelector(`[data-routine-id="${CSS.escape(r.id)}"] details`);if(d)d.open=true;showToast('Daily flow order updated.');}
    });
    main.querySelectorAll('[data-routine-start]').forEach(btn=>btn.onclick=()=>{activeRoutineId=btn.dataset.routineStart;goView('routineRun');});
    main.querySelectorAll('[data-routine-edit]').forEach(btn=>btn.onclick=()=>openRoutineModal(btn.dataset.routineEdit));
    main.querySelectorAll('[data-routine-delete]').forEach(btn=>btn.onclick=()=>{
      const r=state.routines.find(x=>x.id===btn.dataset.routineDelete);if(!r)return;
      if(!confirm(`Delete “${r.name}”? Its habits and tracking history will remain unchanged.`))return;
      state.routines=state.routines.filter(x=>x.id!==r.id);if(saveState()){renderRoutines();showToast('Routine deleted. Habits were kept.');}
    });
    expanded.forEach(id=>{const d=main.querySelector(`[data-routine-id="${CSS.escape(id)}"] details`);if(d)d.open=true;});
  }
  function updateNav(){const navView=['habits','review'].includes(activeView)?'more':activeView;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===navView));}
  function goView(view){activeView=view;render();window.scrollTo({top:0,behavior:'smooth'});}
  function downloadBlob(blob, filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function exportBackup(){
    const payload={app:'HabitPulse',formatVersion:1,schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),data:state};
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`habitpulse-backup-${todayKey()}.json`);
    showToast('JSON backup exported. Keep it somewhere safe.');
  }
  function csvCell(value){const text=String(value??'');return `"${text.replace(/"/g,'""')}"`;}
  function exportCSV(){
    const rows=[['date','habit_id','habit_name','category','tracking_type','scheduled','completed','skipped','value','unit','target','archived','daily_note']];
    const habitMap=new Map(state.habits.map(h=>[h.id,h]));
    Object.keys(state.logs).sort().forEach(date=>Object.keys(state.logs[date]||{}).forEach(id=>{const h=habitMap.get(id);if(!h)return;const log=state.logs[date][id]||{};rows.push([date,id,h.name,h.category,h.trackingType,isScheduled(h,date),Boolean(log.done),Boolean(log.skipped),log.value??'',h.numericUnit||'',(h.trackingType==='numeric'||h.trackingType==='atMost')?h.numericTarget:(h.trackingType==='weekly'?h.weeklyTarget:''),Boolean(h.archived),log.note||'']);}));
    const csv='\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`habitpulse-logs-${todayKey()}.csv`);
    showToast('Habit history exported as CSV.');
  }
  function validateBackupObject(parsed){
    const raw=parsed&&parsed.app==='HabitPulse'&&parsed.data&&typeof parsed.data==='object'?parsed.data:parsed;
    if(parsed&&parsed.app==='HabitPulse'&&Number(parsed.formatVersion||1)>1)throw new Error('This backup was created by a newer unsupported format. Update HabitPulse first.');if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('This file is not a HabitPulse backup.');
    if(!Array.isArray(raw.habits)||!raw.logs||typeof raw.logs!=='object'||Array.isArray(raw.logs))throw new Error('Backup is missing its habits or logs data.');
    if(raw.habits.length>2000)throw new Error('Backup contains too many habits.');
    const ids=new Set();
    for(const h of raw.habits){
      if(!h||typeof h.id!=='string'||!h.id||typeof h.name!=='string'||!h.name.trim())throw new Error('A habit entry is invalid.');
      if(ids.has(h.id))throw new Error('Duplicate habit IDs were found.'); ids.add(h.id);
      if(h.scheduleStartDate&&!isValidDateKey(h.scheduleStartDate))throw new Error(`Habit “${h.name}” has an invalid schedule start date.`);
      if(h.scheduleEndDate&&!isValidDateKey(h.scheduleEndDate))throw new Error(`Habit “${h.name}” has an invalid schedule end date.`);
      if(h.scheduleStartDate&&h.scheduleEndDate&&h.scheduleEndDate<h.scheduleStartDate)throw new Error(`Habit “${h.name}” ends before its schedule starts.`);
    }
    const logDates=Object.entries(raw.logs);
    if(logDates.length>100000)throw new Error('Backup contains too many dated log groups.');
    for(const [date,day] of logDates){
      if(!isValidDateKey(date)||!day||typeof day!=='object'||Array.isArray(day))throw new Error('A dated habit log is invalid.');
      for(const [id,entry] of Object.entries(day)){if(!ids.has(id)||!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('A habit log refers to an unknown or invalid habit.');if(entry.note!==undefined&&typeof entry.note!=='string')throw new Error('A daily note is invalid.');if(entry.value!==null&&entry.value!==undefined&&(!Number.isFinite(Number(entry.value))||Number(entry.value)<0))throw new Error('A numerical log contains an invalid value.');}
    }
    return normalizeState(raw);
  }
  function importBackup(file){
    if(!file)return;
    if(file.size>15*1024*1024){showToast('Backup is larger than the 15 MB safety limit.');return;}
    const reader=new FileReader();
    reader.onload=()=>{try{
      const incoming=validateBackupObject(JSON.parse(reader.result));
      if(!confirm(`Validated backup: ${incoming.habits.length} habits and ${Object.keys(incoming.logs).length} dated log groups. Current data will be backed up automatically, then replaced. Continue?`))return;
      // Safety download of current data before replacing it.
      const current={app:'HabitPulse',formatVersion:1,schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),data:state};
      downloadBlob(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}),`habitpulse-pre-restore-${todayKey()}.json`);
      const previous=state;state=incoming;
      if(!saveState()){state=previous;return;}
      closeModal('settingsModalBackdrop');goView('home');showToast('Backup validated and restored. A safety backup was downloaded.');
    }catch(e){showToast(`Restore rejected: ${e.message||'Invalid backup.'}`);}}
    reader.onerror=()=>showToast('Could not read that file.');reader.readAsText(file);
  }
  async function enableNotifications(){if(!('Notification'in window)){ $('notificationStatus').textContent='This browser does not support browser notifications.';return;}try{const permission=await Notification.requestPermission();$('notificationStatus').textContent=permission==='granted'?'Notifications enabled. Reminders are checked while the app is open.':`Notification permission: ${permission}.`;showToast(permission==='granted'?'Notifications enabled.':'Notifications not enabled.');}catch(e){$('notificationStatus').textContent='Could not enable notifications in this browser.';}}
  function maybeDailySummary(){const k=todayKey();if(!state.settings.dailySummary||state.settings.lastSummaryDate===k)return;state.settings.lastSummaryDate=k;saveState();const due=todayHabits();const done=due.filter(h=>isDone(h.id,k)).length;showToast(`Today's summary: ${done} of ${due.length} habits completed.`);}
  function checkReminders(){if(!('Notification'in window)||Notification.permission!=='granted'||document.visibilityState!=='visible')return;const now=new Date();const minuteKey=m=>`${String(m.getHours()).padStart(2,'0')}:${String(m.getMinutes()).padStart(2,'0')}`;const slots=[minuteKey(now)];const previous=new Date(now.getTime()-60000);slots.push(minuteKey(previous));const k=todayKey();activeHabits().filter(h=>(h.reminders||(h.reminder?[h.reminder]:[])).some(t=>slots.includes(t))&&isScheduled(h,k)&&!isDone(h.id,k)).forEach(h=>{const firedTime=(h.reminders||(h.reminder?[h.reminder]:[])).find(t=>slots.includes(t));const key=`${k}:${h.id}:${firedTime}`;if(state.reminderFired[key])return;state.reminderFired[key]=true;saveState();try{new Notification(`HabitPulse · ${h.name}`,{body:'A gentle reminder for your habit. Open HabitPulse to record it.',icon:'icon-192.png',tag:key});}catch(e){console.warn('Notification failed',e);}});}
  function bindHomeButtons(){ if($('addHabitBtn'))$('addHabitBtn').onclick=()=>openHabitModal(); if($('emptyAddBtn'))$('emptyAddBtn').onclick=()=>openHabitModal(); if($('historyBtn'))$('historyBtn').onclick=()=>goView('stats'); }
  function updateTrackingFields(){const t=$('trackingType').value;const sc=$('habitSchedule').value;$('numericFields').classList.toggle('hidden',t!=='numeric'&&t!=='atMost');$('weeklyFields').classList.toggle('hidden',t!=='weekly');$('scheduleLabel').classList.toggle('hidden',t==='weekly');$('customDays').classList.toggle('hidden',sc!=='custom'||t==='weekly');$('intervalFields').classList.toggle('hidden',sc!=='interval'||t==='weekly');$('monthlyFields').classList.toggle('hidden',sc!=='monthly'||t==='weekly');$('dateWindowFields').classList.toggle('hidden',t==='weekly');}
  function applyTheme(theme, persist=true){
    const selected = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = selected;
    document.documentElement.style.colorScheme = selected;
    const meta = $('appThemeColor'); if(meta) meta.content = selected === 'dark' ? '#101714' : '#f5f7fb';
    const picker = $('themeSelect'); if(picker && picker.value !== selected) picker.value = selected;
    if(persist && state && state.settings){ state.settings.theme = selected; saveState(); }
  }
  function bind(){ bindHomeButtons(); $('settingsBtn').onclick=()=>$('settingsModalBackdrop').classList.remove('hidden');$('habitForm').addEventListener('submit',saveHabit);$('routineForm').addEventListener('submit',saveRoutine);$('habitSchedule').addEventListener('change',updateTrackingFields);$('trackingType').addEventListener('change',updateTrackingFields);document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));document.querySelectorAll('.modal-backdrop').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)b.classList.add('hidden');}));document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));$('themeSelect').value=state.settings.theme==='dark'?'dark':'light';$('themeSelect').onchange=()=>{applyTheme($('themeSelect').value);showToast($('themeSelect').value==='dark'?'Vibrant dark theme enabled.':'Light theme enabled.');};applyTheme(state.settings.theme||'light',false);$('dailySummaryToggle').checked=state.settings.dailySummary;$('dailySummaryToggle').onchange=()=>{state.settings.dailySummary=$('dailySummaryToggle').checked;saveState();showToast('Notification preference saved.');};$('enableNotificationsBtn').onclick=enableNotifications;$('exportBtn').onclick=exportBackup;$('csvBtn').onclick=exportCSV;$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=e=>{importBackup(e.target.files&&e.target.files[0]);e.target.value='';};$('resetBtn').onclick=()=>{if(confirm('Reset ALL HabitPulse data on this device? This cannot be undone. Export a backup first if you may need it.')){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LAST_GOOD_KEY);localStorage.removeItem(LEGACY_STORAGE_KEY);state=defaultState();saveState();closeModal('settingsModalBackdrop');goView('home');showToast('App data reset.');}}; }
  function registerSW(){if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Service worker registration failed',e));}
  window.addEventListener('pageshow',()=>{state=loadState();render();});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){state=loadState();render();}});window.addEventListener('error',e=>{console.error('HabitPulse runtime error',e.error||e.message);});
  bind();updateTrackingFields();render();registerSW();maybeDailySummary();checkReminders();setInterval(checkReminders,20000);
})();

  