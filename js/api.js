/*
 * API client. Talks to the Apps Script web app, or, in demo mode, runs the very same
 * backend core (backend/core.js) in the browser against localStorage.
 */
window.Api = (function () {
  var DEMO_KEY = 'invitations-demo-db';
  var demo = !window.Config.API_URL || /[?&]demo=1\b/.test(location.search);

  // Requests that only read data. Google's web app occasionally answers with a transient
  // 404/5xx (often for a few minutes after a redeploy), so these are retried quietly.
  // Requests that change data are never retried, since a retry could apply them twice.
  var READS = { 'invite.get': 1, 'host.me': 1, 'host.event': 1, 'host.hosts': 1, 'host.previewEmail': 1 };

  function send(req) {
    return fetch(window.Config.API_URL, {
      method: 'POST',
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req),
      redirect: 'follow'
    }).then(function (r) {
      if (!r.ok) throw Object.assign(new Error('The server returned ' + r.status + '.'), { code: 'network', status: r.status });
      return r.json();
    }, function () {
      throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { code: 'network' });
    });
  }

  function sendWithRetry(req, attempt) {
    return send(req).catch(function (err) {
      var transient = err.code === 'network' && (!err.status || err.status === 404 || err.status >= 500);
      if (!READS[req.action] || !transient || attempt >= 3) throw err;
      return new Promise(function (resolve) { setTimeout(resolve, attempt * 700); }).then(function () {
        return sendWithRetry(req, attempt + 1);
      });
    });
  }

  function call(action, payload) {
    var req = Object.assign({ action: action }, payload || {});
    var p = demo ? demoCall(req) : sendWithRetry(req, 1);
    return p.then(function (res) {
      if (!res || !res.ok) {
        throw Object.assign(new Error(res && res.message || 'Something went wrong.'), { code: res && res.error || 'server' });
      }
      return res;
    });
  }

  /* ---------- demo mode ---------- */

  var core = null;

  function loadDb() {
    try { var d = JSON.parse(localStorage.getItem(DEMO_KEY)); if (d && d.Events) return d; } catch (e) { /* fall through */ }
    var db = seed();
    saveDb(db);
    return db;
  }
  function saveDb(db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { /* private mode */ } }

  function localStore() {
    function tbl(db, t) { return db[t] || (db[t] = []); }
    return {
      all: function (t) { return JSON.parse(JSON.stringify(tbl(loadDb(), t))); },
      insert: function (t, o) { var db = loadDb(); tbl(db, t).push(JSON.parse(JSON.stringify(o))); saveDb(db); return o; },
      update: function (t, f, id, patch) {
        var db = loadDb(), row = tbl(db, t).filter(function (r) { return r[f] === id; })[0];
        if (!row) return null;
        Object.keys(patch).forEach(function (k) { row[k] = patch[k] == null ? '' : String(patch[k]); });
        saveDb(db); return row;
      },
      remove: function (t, f, id) {
        var db = loadDb(); db[t] = tbl(db, t).filter(function (r) { return r[f] !== id; }); saveDb(db); return true;
      }
    };
  }

  function rand(n) {
    var abc = 'abcdefghijklmnopqrstuvwxyz0123456789', a = new Uint8Array(n), s = '';
    crypto.getRandomValues(a);
    for (var i = 0; i < n; i++) s += abc[a[i] % abc.length];
    return s;
  }
  function localToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function siteUrl() { return location.origin + location.pathname.replace(/\/[^/]*$/, ''); }

  function demoCall(req) {
    if (!core) {
      core = InviteCore.create(localStore(), {
        siteUrl: siteUrl(),
        now: function () { return new Date().toISOString(); },
        today: localToday,
        random: rand,
        emailQuota: function () { return 100; },
        rateOk: function () { return true; },
        sendEmail: function (m) {
          var db = loadDb();
          (db.Outbox = db.Outbox || []).unshift({ ts: new Date().toISOString(), to: m.to, subject: m.subject, html: m.html, text: m.text });
          db.Outbox = db.Outbox.slice(0, 50);
          saveDb(db);
        }
      });
    }
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(JSON.parse(JSON.stringify(core.handle(req)))); }, 350);
    });
  }

  function seed() {
    var now = new Date().toISOString(), today = localToday();
    var date = InviteCore.addDays(today, 33), rsvp = InviteCore.addDays(today, 26);
    var data = {
      theme: 'diwali', template: 'classic', colors: { ground: '#1A1230', accent: '#D4AF5F' },
      text: { title: 'A Diwali Evening', hostNames: 'Nidhi & family' },
      date: date, startTime: '19:00', endTime: '23:00', venue: 'Our home', address: '123 Lantern Lane, Fremont, CA',
      rsvpBy: rsvp,
      settings: { openLink: true, showGuestList: true, addressVisibility: 'all', notifyHosts: true, cohostEmails: '',
        customQuestion: 'Any dietary needs we should know about?', autoRemindDays: 3, dayBeforeEmail: true },
      email: {}
    };
    function g(id, name, email, mobile, status, a, k, answer, note, invited, via) {
      return { id: id, eventId: 'diwali-demo', name: name, email: email, mobile: mobile, source: 'list', status: status,
        adults: a, kids: k, answer: answer, note: note, repliedAt: status === 'pending' ? '' : now,
        invitedAt: invited ? now : '', inviteVia: invited ? via : '', openedAt: status === 'pending' ? '' : now,
        remindedAt: '', sends: '', createdAt: now };
    }
    return {
      Hosts: [
        { key: 'demo', name: 'Nidhi', email: 'nidhi@example.com', role: 'owner', createdAt: now },
        { key: 'demo-family', name: 'Mom', email: 'mom@example.com', role: 'host', createdAt: now }
      ],
      Events: [{ id: 'diwali-demo', title: data.text.title, date: date, theme: 'diwali', status: 'open', hostKeys: 'demo,demo-family',
        data: JSON.stringify(data), createdAt: now, updatedAt: now }],
      Guests: [
        g('priya-demo', 'Priya Sharma', 'priya@example.com', '', 'yes', '2', '1', 'Vegetarian', 'Can’t wait!', true, 'email'),
        g('arjun-demo', 'Arjun Mehta', 'arjun@example.com', '', 'no', '0', '0', '', 'Traveling that week, so sorry!', true, 'email'),
        g('ananya-demo', 'Ananya Rao', '', '+1 408 555 0142', 'pending', '', '', '', '', true, 'text'),
        g('rohan-demo', 'Rohan & Meera Kapoor', 'rohan@example.com', '', 'pending', '', '', '', '', true, 'email'),
        g('kavya-demo', 'Kavya Iyer', 'kavya@example.com', '+1 650 555 0199', 'pending', '', '', '', '', false, '')
      ],
      Log: [],
      Outbox: []
    };
  }

  return {
    call: call,
    demo: demo,
    outbox: function () { return demo ? (loadDb().Outbox || []) : []; },
    resetDemo: function () { localStorage.removeItem(DEMO_KEY); core = null; }
  };
})();
