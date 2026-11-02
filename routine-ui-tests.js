/* HabitPulse V9.4 routine-launch source guards. Run: node routine-ui-tests.js */
const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
assert(html.includes("$('mainContent').addEventListener('click',e=>{const launch=e.target.closest('[data-dash-start-routine]')"),'delegated dashboard routine listener missing');
assert(html.includes("const routine=(state.routines||[]).find(r=>String(r.id)===String(id))"),'routine id validation missing');
assert(html.includes("activeRoutineId=routine.id;goView('routineRun')"),'routine navigation target missing');
assert(html.includes('Start routine')&&html.includes('Continue routine')&&html.includes('Review routine'),'routine CTA states missing');
assert(!html.includes("main.querySelectorAll('[data-dash-start-routine]').forEach(btn=>btn.onclick"),'legacy direct listener still present');
console.log('Routine UI source guards: 5/5 passed');
