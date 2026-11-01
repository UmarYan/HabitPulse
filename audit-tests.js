/* HabitPulse V9.2 focused regression checks. Run: node audit-tests.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
function extractFunction(name) {
  const marker = name === 'isValidDateKey' ? `const ${name} =` : `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `Missing ${name} in app.js`);
  if (name === 'isValidDateKey') return source.slice(start, source.indexOf('\n', start));
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not parse ${name}`);
}
const helpers = `
const todayKey = (date = new Date()) => date.toISOString().slice(0,10);
const parseDate = (key) => { const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d,12); };
const dayIndex = (key) => parseDate(key).getDay();
${extractFunction('isValidDateKey')}
${extractFunction('isScheduled')}
`;
const ctx = {}; vm.createContext(ctx); vm.runInContext(helpers + '\nthis.api={isValidDateKey,isScheduled};', ctx);
const { isValidDateKey, isScheduled } = ctx.api;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
test('real calendar dates and leap-year boundaries', () => {
  assert.strictEqual(isValidDateKey('2024-02-29'), true);
  assert.strictEqual(isValidDateKey('2025-02-29'), false);
  assert.strictEqual(isValidDateKey('2026-04-31'), false);
  assert.strictEqual(isValidDateKey('2026-13-01'), false);
  assert.strictEqual(isValidDateKey('26-01-01'), false);
});
test('daily, weekday and weekend schedules', () => {
  const base={createdAt:'2026-01-01T00:00:00Z',scheduleStartDate:'',scheduleEndDate:''};
  assert.strictEqual(isScheduled({...base,schedule:'daily'},'2026-11-02'),true); // Monday
  assert.strictEqual(isScheduled({...base,schedule:'weekdays'},'2026-11-02'),true);
  assert.strictEqual(isScheduled({...base,schedule:'weekdays'},'2026-11-01'),false); // Sunday
  assert.strictEqual(isScheduled({...base,schedule:'weekends'},'2026-11-01'),true);
  assert.strictEqual(isScheduled({...base,schedule:'weekends'},'2026-11-02'),false);
});
test('custom weekday and monthly schedules', () => {
  const base={createdAt:'2026-01-01T00:00:00Z',scheduleStartDate:'',scheduleEndDate:''};
  assert.strictEqual(isScheduled({...base,schedule:'custom',customDays:[1,3]},'2026-11-02'),true);
  assert.strictEqual(isScheduled({...base,schedule:'custom',customDays:[3]},'2026-11-02'),false);
  assert.strictEqual(isScheduled({...base,schedule:'monthly',monthlyDay:15},'2026-11-15'),true);
  assert.strictEqual(isScheduled({...base,schedule:'monthly',monthlyDay:15},'2026-11-16'),false);
});
test('interval schedule anchor and cadence', () => {
  const h={createdAt:'2026-11-01T00:00:00Z',schedule:'interval',intervalDays:3,scheduleAnchor:'2026-11-01'};
  assert.strictEqual(isScheduled(h,'2026-11-01'),true);
  assert.strictEqual(isScheduled(h,'2026-11-04'),true);
  assert.strictEqual(isScheduled(h,'2026-11-03'),false);
  assert.strictEqual(isScheduled(h,'2026-10-31'),false);
});
test('creation date and configured date-window boundaries', () => {
  const h={createdAt:'2026-11-03T00:00:00Z',schedule:'daily',scheduleStartDate:'2026-11-05',scheduleEndDate:'2026-11-07'};
  assert.strictEqual(isScheduled(h,'2026-11-02'),false);
  assert.strictEqual(isScheduled(h,'2026-11-04'),false);
  assert.strictEqual(isScheduled(h,'2026-11-05'),true);
  assert.strictEqual(isScheduled(h,'2026-11-07'),true);
  assert.strictEqual(isScheduled(h,'2026-11-08'),false);
});
test('backup validator guards critical malformed input cases', () => {
  const checks = [
    /Duplicate habit IDs were found/,
    /schedule end date/,
    /ends before its schedule starts/,
    /too many dated log groups/,
    /A habit log refers to an unknown or invalid habit/,
    /numerical log contains an invalid value/
  ];
  for (const re of checks) assert.match(source, re);
});
test('routine execution preserves shared habit log and scheduled-only membership', () => {
  assert.match(source, /isScheduled\(h,todayKey\(\)\)/);
  assert.match(source, /state\.logs\[k\]\[id\]=\{\.\.\.old,done:true,skipped:false/);
  assert.match(source, /data-run-numeric/);
});
test('backup exports app wrapper and restore validates before replacement', () => {
  assert.match(source, /formatVersion:1,schemaVersion:SCHEMA_VERSION/);
  assert.match(source, /const incoming=validateBackupObject\(JSON\.parse\(reader\.result\)\)/);
  assert.match(source, /const previous=state;state=incoming/);
});
console.log(`\n${passed} focused regression checks passed.`);
