/*
 * Invitations backend: Google Apps Script web app over one Google Sheet.
 *
 * Paste this file as "Code.gs" and backend/core.js as "Core.gs" into the Sheet's
 * Apps Script project (Extensions > Apps Script). Then run setup() once.
 * Full steps: SETUP.md in the repo.
 */

var DEFAULT_SITE_URL = 'https://nidhihgupta.github.io/invitations';

// Bump with each change to this file; the host page warns when it doesn't match the site.
var CODE_VERSION_GS = '2026-10-07.1';

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, error: 'bad_request', message: 'Request was not valid JSON.' });
  }
  // Viewing an invitation only reads (plus one safe single-cell write), so it skips the lock and
  // never waits behind other requests. Everything that changes data takes the lock.
  if (READ_ONLY[req && req.action]) return respond(core(false).handle(req));
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return respond({ ok: false, error: 'busy', message: 'Busy, please try again.' });
  try {
    return respond(core(true).handle(req));
  } finally {
    lock.releaseLock();
  }
}

var READ_ONLY = { 'invite.get': true, 'host.me': true, 'host.event': true, 'host.hosts': true, 'host.previewEmail': true };

function doGet() {
  return respond({ ok: true, service: 'invitations' });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// fresh = true for requests that change data: they always read the Sheet itself, never the cache.
function core(fresh) {
  return InviteCore.create(new SheetStore(SpreadsheetApp.getActiveSpreadsheet(), fresh), services());
}

function services() {
  var props = PropertiesService.getScriptProperties();
  var tz = Session.getScriptTimeZone();
  return {
    siteUrl: props.getProperty('SITE_URL') || DEFAULT_SITE_URL,
    now: function () { return new Date().toISOString(); },
    today: function () { return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'); },
    random: function (n) {
      var s = '';
      while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
      return s.slice(0, n);
    },
    sendEmail: function (m) {
      var opts = { to: m.to, subject: m.subject, htmlBody: m.html, body: m.text };
      if (m.name) opts.name = m.name;
      if (m.replyTo) opts.replyTo = m.replyTo;
      MailApp.sendEmail(opts);
    },
    emailQuota: function () { return MailApp.getRemainingDailyQuota(); },
    rateOk: function (key) {
      var cache = CacheService.getScriptCache();
      var n = Number(cache.get(key) || 0) + 1;
      cache.put(key, String(n), 60);
      return n <= 30;
    }
  };
}

/* ---------- Sheet-backed store ---------- */

function SheetStore(ss, fresh) {
  this.ss = ss;
  this.fresh = !!fresh;
  this.cache = {};
}

SheetStore.prototype.sheet = function (table) {
  var sh = this.ss.getSheetByName(table);
  if (!sh) sh = ensureSheet(this.ss, table);
  return sh;
};

// Sheet reads are the slowest part of Apps Script, so each tab's values are also kept in the
// script cache for a few minutes. Every write clears that tab's cached copy.
var CACHE_SECONDS = 300;

function tableCache() { return CacheService.getScriptCache(); }

// Each write also changes the tab's "stamp", so a read that overlapped a write never caches old data.
SheetStore.prototype.forget = function (table) {
  try {
    tableCache().remove('tbl:' + table);
    tableCache().put('ver:' + table, Utilities.getUuid(), 21600);
  } catch (e) { /* cache is optional */ }
};

SheetStore.prototype.load = function (table) {
  if (this.cache[table]) return this.cache[table];
  var sh = this.sheet(table);
  var values = null, stamp = null;
  try {
    stamp = tableCache().get('ver:' + table);
    var hit = this.fresh ? null : tableCache().get('tbl:' + table);
    if (hit) values = JSON.parse(hit);
  } catch (e) { values = null; }
  if (!values) {
    values = sh.getDataRange().getValues().map(function (r) {
      return r.map(function (v) { return v instanceof Date ? v.toISOString() : v; });
    });
    try {
      var json = JSON.stringify(values);
      var same = tableCache().get('ver:' + table) === stamp;
      if (json.length < 95000 && (this.fresh || same)) tableCache().put('tbl:' + table, json, CACHE_SECONDS);
    } catch (e) { /* too big or cache unavailable: read the Sheet next time */ }
  }
  var headers = values[0].map(String);
  var rows = values.slice(1).map(function (r) {
    var o = {};
    headers.forEach(function (h, i) {
      var v = r[i];
      o[h] = v instanceof Date ? v.toISOString() : v === null || v === undefined ? '' : String(v);
    });
    return o;
  });
  this.cache[table] = { headers: headers, rows: rows, sheet: sh };
  return this.cache[table];
};

SheetStore.prototype.all = function (table) {
  return this.load(table).rows.map(function (r) { return JSON.parse(JSON.stringify(r)); });
};

SheetStore.prototype.toRow = function (t, obj) {
  return t.headers.map(function (h) { return obj[h] === undefined || obj[h] === null ? '' : String(obj[h]); });
};

SheetStore.prototype.insert = function (table, obj) {
  var t = this.load(table);
  var row = this.toRow(t, obj);
  t.sheet.getRange(t.rows.length + 2, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  this.forget(table);
  var o = {};
  t.headers.forEach(function (h, i) { o[h] = row[i]; });
  t.rows.push(o);
  return o;
};

SheetStore.prototype.insertMany = function (table, objs) {
  if (!objs.length) return [];
  var t = this.load(table), self = this;
  var rows = objs.map(function (o) { return self.toRow(t, o); });
  t.sheet.getRange(t.rows.length + 2, 1, rows.length, t.headers.length).setNumberFormat('@').setValues(rows);
  this.forget(table);
  return rows.map(function (row) {
    var o = {};
    t.headers.forEach(function (h, i) { o[h] = row[i]; });
    t.rows.push(o);
    return o;
  });
};

SheetStore.prototype.update = function (table, idField, id, patch) {
  var t = this.load(table);
  for (var i = 0; i < t.rows.length; i++) {
    if (t.rows[i][idField] === id) {
      var o = t.rows[i];
      var keys = Object.keys(patch).filter(function (k) { return t.headers.indexOf(k) >= 0; });
      keys.forEach(function (k) { o[k] = String(patch[k]); });
      this.forget(table);
      if (keys.length === 1) {
        // A single field (e.g. "opened at", written without the lock): write just that cell,
        // and only if the row still holds the same record.
        var idCol = t.headers.indexOf(idField) + 1;
        if (String(t.sheet.getRange(i + 2, idCol).getValue()) !== String(id)) return o;
        t.sheet.getRange(i + 2, t.headers.indexOf(keys[0]) + 1).setNumberFormat('@').setValue(o[keys[0]]);
        return o;
      }
      var row = this.toRow(t, o);
      t.sheet.getRange(i + 2, 1, 1, row.length).setNumberFormat('@').setValues([row]);
      return o;
    }
  }
  return null;
};

SheetStore.prototype.remove = function (table, idField, id) {
  var t = this.load(table);
  for (var i = 0; i < t.rows.length; i++) {
    if (t.rows[i][idField] === id) {
      t.sheet.deleteRow(i + 2);
      t.rows.splice(i, 1);
      this.forget(table);
      return true;
    }
  }
  return false;
};

function ensureSheet(ss, table) {
  var headers = InviteCore.TABLES[table];
  var sh = ss.getSheetByName(table) || ss.insertSheet(table);
  var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  headers.forEach(function (h) {
    if (have.indexOf(h) < 0) {
      have.push(h);
      sh.getRange(1, have.length).setValue(h);
    }
  });
  sh.getRange(1, 1, 1, have.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, sh.getMaxRows(), have.length).setNumberFormat('@');
  try { CacheService.getScriptCache().remove('tbl:' + table); } catch (e) { /* optional */ }
  return sh;
}

/* ---------- one-time setup + daily job ---------- */

/**
 * Run once from the Apps Script editor. Safe to run again: it never deletes data.
 * Creates the tabs, makes you the owner, sets the site URL, installs the daily job,
 * and prints your private host link in the execution log.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(InviteCore.TABLES).forEach(function (t) { ensureSheet(ss, t); });
  var blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SITE_URL')) props.setProperty('SITE_URL', DEFAULT_SITE_URL);

  var store = new SheetStore(ss, true), svc = services();
  var owner = store.all('Hosts').filter(function (h) { return h.role === 'owner'; })[0];
  if (!owner) {
    var email = Session.getEffectiveUser().getEmail();
    owner = { key: svc.random(32), name: (email.split('@')[0] || 'Owner'), email: email, role: 'owner', createdAt: svc.now() };
    store.insert('Hosts', owner);
  }

  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyJob'; });
  if (!hasTrigger) ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(9).create();

  Logger.log('Setup complete.');
  Logger.log('Your private host link (keep it secret): ' + svc.siteUrl.replace(/\/+$/, '') + '/host.html#k=' + owner.key);
}

/** Runs every morning: automatic reminders and day-before emails. */
function dailyJob() {
  var lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    var report = core(true).daily();
    if (report.length) Logger.log(JSON.stringify(report));
  } finally {
    lock.releaseLock();
  }
}

/** Prints the owner's host link again, in case you lose it. */
function showOwnerLink() {
  var store = new SheetStore(SpreadsheetApp.getActiveSpreadsheet(), true), svc = services();
  store.all('Hosts').filter(function (h) { return h.role === 'owner'; }).forEach(function (h) {
    Logger.log(h.name + ': ' + svc.siteUrl.replace(/\/+$/, '') + '/host.html#k=' + h.key);
  });
}

/** If your owner link leaks: run this, then use the new link it prints. */
function resetOwnerKey() {
  var store = new SheetStore(SpreadsheetApp.getActiveSpreadsheet(), true), svc = services();
  store.all('Hosts').filter(function (h) { return h.role === 'owner'; }).forEach(function (h) {
    var nk = svc.random(32);
    store.update('Hosts', 'key', h.key, { key: nk });
    store.all('Events').forEach(function (ev) {
      var ks = String(ev.hostKeys).split(',');
      if (ks.indexOf(h.key) >= 0) store.update('Events', 'id', ev.id, { hostKeys: ks.map(function (k) { return k === h.key ? nk : k; }).join(',') });
    });
    Logger.log('New link for ' + h.name + ': ' + svc.siteUrl.replace(/\/+$/, '') + '/host.html#k=' + nk);
  });
}
