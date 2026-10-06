// Runs backend/Code.gs + backend/core.js against a tiny fake of the Apps Script services.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeSpreadsheet() {
  const sheets = {};
  function makeSheet(name) {
    const grid = [];
    const sh = {
      name,
      grid,
      getLastColumn: () => grid.reduce((m, r) => Math.max(m, r.length), 0),
      getLastRow: () => grid.length,
      getMaxRows: () => Math.max(grid.length, 1000),
      getDataRange: () => ({ getValues: () => (grid.length ? grid.map((r) => r.slice()) : [['']]) }),
      setFrozenRows: () => sh,
      deleteRow: (i) => { grid.splice(i - 1, 1); },
      getRange: (row, col, nr = 1, nc = 1) => {
        const rng = {
          setNumberFormat: () => rng,
          setFontWeight: () => rng,
          getValue: () => (grid[row - 1] || [])[col - 1] ?? '',
          setValue: (v) => { while (grid.length < row) grid.push([]); grid[row - 1][col - 1] = v; return rng; },
          setValues: (vals) => {
            vals.forEach((r, i) => {
              while (grid.length < row + i) grid.push([]);
              r.forEach((v, j) => { grid[row - 1 + i][col - 1 + j] = v; });
            });
            return rng;
          },
          getValues: () => {
            const out = [];
            for (let i = 0; i < nr; i++) {
              const r = [];
              for (let j = 0; j < nc; j++) r.push((grid[row - 1 + i] || [])[col - 1 + j] ?? '');
              out.push(r);
            }
            return out;
          }
        };
        return rng;
      }
    };
    return sh;
  }
  return {
    sheets,
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
    getSheets: () => Object.values(sheets),
    deleteSheet: (s) => { delete sheets[s.name]; }
  };
}

function loadGas() {
  const ss = fakeSpreadsheet();
  const props = {};
  const cache = {};
  const mail = [];
  const triggers = [];
  const logs = [];
  let uuid = 0;
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Session: { getScriptTimeZone: () => 'America/Los_Angeles', getEffectiveUser: () => ({ getEmail: () => 'nidhi@sheto.org' }) },
    Utilities: {
      formatDate: () => '2026-10-05',
      getUuid: () => { uuid++; return ('0000000' + uuid).slice(-8) + '-aaaa-4bbb-8ccc-dddddddddddd'; }
    },
    MailApp: { sendEmail: (o) => mail.push(o), getRemainingDailyQuota: () => 100 },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger: (fn) => { const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => triggers.push({ getHandlerFunction: () => fn }) }; return b; }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ body: s, setMimeType() { return this; } }) },
    Logger: { log: (s) => logs.push(s) },
    console
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'backend');
  vm.runInContext(fs.readFileSync(path.join(dir, 'core.js'), 'utf8'), ctx, { filename: 'Core.gs' });
  vm.runInContext(fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).body);
  return { ctx, ss, props, mail, triggers, logs, post, cache };
}

test('setup creates tabs, owner, trigger and prints the host link; idempotent', () => {
  const g = loadGas();
  g.ss.insertSheet('Sheet1');
  g.ctx.setup();
  assert.deepStrictEqual(Object.keys(g.ss.sheets).sort(), ['Events', 'Guests', 'Hosts', 'Log']);
  assert.strictEqual(g.ss.sheets.Hosts.grid.length, 2);
  assert.strictEqual(g.triggers.length, 1);
  assert.strictEqual(g.props.SITE_URL, 'https://nidhihgupta.github.io/invitations');
  assert.ok(g.logs.some((l) => /host\.html#k=[0-9a-f]{32}$/.test(l)), g.logs.join('\n'));
  g.ctx.setup();
  assert.strictEqual(g.ss.sheets.Hosts.grid.length, 2, 'no second owner');
  assert.strictEqual(g.triggers.length, 1, 'no second trigger');
});

test('full round trip through doPost and the Sheet', () => {
  const g = loadGas();
  g.ctx.setup();
  const key = g.ss.sheets.Hosts.grid[1][0];
  const data = { theme: 'diwali', text: { title: 'A Diwali Evening', hostNames: 'Nidhi' }, date: '2026-11-07', startTime: '19:00', settings: {}, email: {} };
  const ev = g.post({ action: 'host.saveEvent', k: key, event: { data } });
  assert.ok(ev.ok, ev.message);
  const guest = g.post({ action: 'host.saveGuest', k: key, e: ev.id, guest: { name: 'Priya', email: 'p@x.co', mobile: '+1 408 555 0142' } });
  assert.ok(guest.ok, guest.message);
  assert.strictEqual(g.ss.sheets.Guests.grid[1][4], '+1 408 555 0142', 'mobile stored as text');

  const inv = g.post({ action: 'invite.get', e: ev.id, g: guest.guest.id });
  assert.strictEqual(inv.event.text.title, 'A Diwali Evening');
  const rep = g.post({ action: 'invite.reply', e: ev.id, g: guest.guest.id, attending: 'yes', name: 'Priya', adults: 2, kids: 2 });
  assert.ok(rep.ok, rep.message);
  assert.strictEqual(g.mail.length, 1, 'host notified');
  assert.strictEqual(g.mail[0].to, 'nidhi@sheto.org');

  const open = g.post({ action: 'invite.reply', e: ev.id, attending: 'no', name: 'Walk-in', contact: 'w@x.co' });
  assert.ok(open.ok);
  const sum = g.post({ action: 'host.event', k: key, e: ev.id });
  assert.deepStrictEqual([sum.counts.yes, sum.counts.no, sum.counts.total], [1, 1, 4]);

  const del = g.post({ action: 'host.removeGuest', k: key, e: ev.id, g: open.guestId });
  assert.ok(del.ok);
  assert.strictEqual(g.ss.sheets.Guests.grid.length, 2);
  assert.strictEqual(g.post('not json').ok, false);
});

test('reads use the cache, writes read the Sheet and refresh it', () => {
  const g = loadGas();
  g.ctx.setup();
  const key = g.ss.sheets.Hosts.grid[1][0];
  const data = { theme: 'diwali', text: { title: 'Party' }, date: '2026-11-07', settings: {}, email: {} };
  const ev = g.post({ action: 'host.saveEvent', k: key, event: { data } });
  const guest = g.post({ action: 'host.saveGuest', k: key, e: ev.id, guest: { name: 'Priya', email: 'p@x.co' } }).guest;
  // A view fills the cache; a hand edit in the Sheet is not seen by views until the cache expires...
  g.post({ action: 'invite.get', e: ev.id, g: guest.id }); // first view records "opened" (a write)
  g.post({ action: 'invite.get', e: ev.id, g: guest.id });
  assert.ok(g.cache['tbl:Guests'], 'guests tab cached after a read');
  assert.ok(g.ss.sheets.Guests.grid[1][14], 'opened time written to its cell');
  g.ss.sheets.Guests.grid[1][2] = 'Priya Edited';
  assert.strictEqual(g.post({ action: 'invite.get', e: ev.id, g: guest.id }).guest.name, 'Priya', 'served from cache');
  // ...but a write always reads the Sheet, so it never writes old data back.
  const rep = g.post({ action: 'invite.reply', e: ev.id, g: guest.id, attending: 'yes', name: 'Priya S', adults: 1 });
  assert.ok(rep.ok, rep.message);
  assert.strictEqual(g.post({ action: 'invite.get', e: ev.id, g: guest.id }).guest.status, 'yes', 'cache cleared after write');
  const row = g.ss.sheets.Guests.grid[1];
  assert.strictEqual(row[2], 'Priya S');
  assert.strictEqual(row[6], 'yes');
});

test('host.me reports both backend file versions', () => {
  const g = loadGas();
  g.ctx.setup();
  const me = g.post({ action: 'host.me', k: g.ss.sheets.Hosts.grid[1][0] });
  const Core = require('../backend/core.js');
  assert.strictEqual(me.version, Core.VERSION);
  assert.strictEqual(me.codeVersion, Core.CODE_VERSION, 'Code.gs and core.js versions agree');
});
