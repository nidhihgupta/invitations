/* Host app: events, replies dashboard, guests, sending, editor with live preview, hosts. */
(function () {
  var fmt = InviteCore.fmt, esc = fmt.esc;
  var KEY_STORE = 'invitations-host-key';
  var app = document.getElementById('app');
  var S = { key: '', me: null, ev: null, evId: '' };

  /* ---------- plumbing ---------- */

  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return S.key; } }
  function setKey(k) {
    S.key = k;
    try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ }
  }

  function api(action, payload) {
    return Api.call(action, Object.assign({ k: S.key }, payload || {})).catch(function (err) {
      if (err.code === 'unauthorized') { setKey(''); S.me = null; viewLogin('That host link is no longer valid. Ask the owner for a new one.'); }
      throw err;
    });
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function copy(text, what) {
    var done = function () { toast((what || 'Link') + ' copied'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
    } else {
      window.prompt('Copy this:', text);
    }
  }

  function showError(err) {
    if (err && err.code === 'unauthorized') return;
    toast(err && err.message || 'Something went wrong.');
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Working…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function on(root, sel, type, fn) {
    root.querySelectorAll(sel).forEach(function (el) { el.addEventListener(type, function (e) { fn(e, el); }); });
  }

  function first(name) { return String(name || '').split(/[\s&]+/)[0] || name; }

  /* ---------- routing ---------- */

  function init() {
    var m = /[#&]k=([^&]+)/.exec(location.hash);
    if (m) {
      setKey(decodeURIComponent(m[1]));
      history.replaceState(null, '', location.pathname + location.search + '#/');
    }
    S.key = getKey();
    window.addEventListener('hashchange', route);
    route();
  }

  function route() {
    if (!S.key) return viewLogin();
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var go = function () {
      if (!parts.length) return viewEvents();
      if (parts[0] === 'new') return viewEditor(null);
      if (parts[0] === 'hosts') return viewHosts();
      if (parts[0] === 'outbox') return viewOutbox();
      if (parts[0] === 'e' && parts[1]) {
        if (parts[2] === 'edit') return viewEditor(decodeURIComponent(parts[1]));
        return viewEvent(decodeURIComponent(parts[1]), parts[2] || 'replies');
      }
      return viewEvents();
    };
    var p = S.me ? Promise.resolve() : api('host.me').then(function (res) { S.me = res; });
    p.then(go).catch(function (err) {
      if (err.code !== 'unauthorized') page('<div class="empty"><h2>Could not load</h2><p>' + esc(err.message) + '</p><button class="btn" onclick="location.reload()">Try again</button></div>');
    });
    window.scrollTo(0, 0);
  }

  /* ---------- layout ---------- */

  function page(inner) {
    var me = S.me && S.me.host;
    var owner = me && me.role === 'owner';
    app.innerHTML =
      '<header class="top"><a class="brand" href="#/">Invitations</a><nav>' +
      '<a href="#/">Events</a>' + (owner ? '<a href="#/hosts">Hosts</a>' : '') + (Api.demo ? '<a href="#/outbox">Outbox</a>' : '') +
      '</nav>' + (me ? '<span class="me">' + esc(me.name) + '</span>' : '') + '</header>' +
      (Api.demo ? '<div class="demo">Demo mode: everything stays in this browser and emails go to the <a href="#/outbox">outbox</a> instead of being sent. ' +
        '<button type="button" class="linkish" data-act="reset-demo">Reset demo data</button></div>' : '') +
      '<main class="page">' + inner + '</main>';
    on(app, '[data-act="reset-demo"]', 'click', function () {
      if (!confirm('Reset the demo? This erases demo events, guests and the outbox in this browser.')) return;
      Api.resetDemo(); S.me = null; S.ev = null; location.hash = '#/'; route();
    });
  }

  function loading() { page('<div class="loading" role="status">Loading…</div>'); }

  function viewLogin(msg) {
    app.innerHTML = '<main class="login"><h1>Invitations</h1>' +
      (msg ? '<p class="warn">' + esc(msg) + '</p>' : '') +
      '<p>This page is for hosts. Open the private host link you were given; it signs you in on this device.</p>' +
      (Api.demo ? '<button class="btn primary" type="button" data-act="demo">Explore the demo</button>' +
        '<p class="muted">Demo mode is on because no backend is connected yet.</p>' : '') +
      '<details><summary>Paste a host link instead</summary><form class="paste"><label for="hl">Host link</label>' +
      '<input id="hl" name="link" placeholder="…/host.html#k=…" autocomplete="off"><button class="btn" type="submit">Sign in</button></form></details></main>';
    on(app, '[data-act="demo"]', 'click', function () { setKey('demo'); location.hash = '#/'; route(); });
    on(app, '.paste', 'submit', function (e, f) {
      e.preventDefault();
      var m = /k=([^&\s]+)/.exec(f.link.value) || [null, f.link.value.trim()];
      if (!m[1]) return;
      setKey(decodeURIComponent(m[1])); S.me = null; location.hash = '#/'; route();
    });
  }

  /* ---------- events list ---------- */

  function countsLine(c) {
    return '<strong>' + c.total + '</strong> attending' + (c.total ? ' (' + c.adults + ' adults, ' + c.kids + ' kids)' : '') +
      ' · ' + c.no + ' declined · ' + c.pending + ' awaiting';
  }

  function pill(status, closed) {
    if (closed === 'past') return '<span class="pill past">Past</span>';
    if (status === 'closed') return '<span class="pill closed">RSVPs closed</span>';
    return '<span class="pill open">Open</span>';
  }

  function viewEvents() {
    loading();
    api('host.me').then(function (res) {
      S.me = res;
      function card(s) {
        var p = InviteCore.parseYmd(s.date) || {};
        return '<a class="ev-card" href="#/e/' + encodeURIComponent(s.id) + '">' +
          '<div class="ev-badge"><span>' + esc(fmt.brief(s.date).split(' ')[0] || '') + '</span><strong>' + (p.d || '') + '</strong></div>' +
          '<div class="ev-body"><h3>' + esc(s.title) + '</h3><p class="muted">' + esc([fmt.date(s.date), fmt.time(s.startTime)].filter(Boolean).join(' · ')) + '</p>' +
          '<p class="counts">' + countsLine(s.counts) + '</p></div>' + pill(s.status, s.closed) + '</a>';
      }
      page('<div class="head"><h1>Your events</h1><a class="btn primary" href="#/new">New event</a></div>' +
        '<section><h2 class="section">Upcoming</h2>' +
        (res.upcoming.length ? res.upcoming.map(card).join('') : '<div class="empty"><p>No upcoming events yet.</p><a class="btn" href="#/new">Create your first invitation</a></div>') +
        '</section>' +
        (res.past.length ? '<section><h2 class="section">Past</h2>' + res.past.map(card).join('') + '</section>' : ''));
    }).catch(showError);
  }

  /* ---------- one event ---------- */

  function loadEvent(id, force) {
    if (!force && S.ev && S.evId === id) return Promise.resolve(S.ev);
    return api('host.event', { e: id }).then(function (res) { S.ev = res; S.evId = id; return res; });
  }

  var STATUS = { yes: 'Attending', no: 'Declined', pending: 'Awaiting' };

  function viewEvent(id, tab) {
    if (!(S.ev && S.evId === id)) loading();
    loadEvent(id, tab === 'replies' || !S.ev || S.evId !== id).then(function (res) {
      var ev = res.event, d = ev.data;
      var tabs = [['replies', 'Replies'], ['guests', 'Guests (' + res.guests.length + ')'], ['send', 'Send']];
      page(
        '<a class="back" href="#/">← All events</a>' +
        '<div class="head"><div><h1>' + esc(d.text.title) + ' ' + pill(ev.status, ev.closed) + '</h1>' +
        '<p class="muted">' + esc([fmt.date(d.date), fmt.timeRange(d.startTime, d.endTime), d.venue].filter(Boolean).join(' · ')) + '</p>' +
        (res.hosts.length ? '<p class="muted small">Hosts: ' + esc(res.hosts.map(function (h) { return h.name; }).join(', ')) + '</p>' : '') +
        '</div><div class="actions">' +
        '<a class="btn primary" href="#/e/' + encodeURIComponent(id) + '/edit">Edit invitation</a>' +
        '<button class="btn" type="button" data-act="status">' + (ev.status === 'closed' ? 'Reopen RSVPs' : 'Close RSVPs') + '</button>' +
        '<button class="btn" type="button" data-act="dup">Duplicate</button>' +
        '<button class="btn danger" type="button" data-act="del">Delete</button></div></div>' +
        (ev.openLink ?
          '<div class="linkrow"><label for="ol">Open link: anyone with it can reply</label><div><input id="ol" readonly value="' + esc(ev.openLink) + '">' +
          '<button class="btn" type="button" data-copy="' + esc(ev.openLink) + '">Copy</button><a class="btn" target="_blank" rel="noopener" href="' + esc(ev.openLink) + '">Open</a></div></div>' :
          '<p class="muted small">The open link is off, so only personal links work. Turn it on in Edit invitation.</p>') +
        '<nav class="tabs" role="tablist">' + tabs.map(function (t) {
          return '<a role="tab" aria-selected="' + (t[0] === tab) + '" href="#/e/' + encodeURIComponent(id) + '/' + t[0] + '">' + t[1] + '</a>';
        }).join('') + '</nav><div id="tab"></div>');

      on(app, '[data-copy]', 'click', function (e, b) { copy(b.getAttribute('data-copy')); });
      on(app, '[data-act="status"]', 'click', function (e, b) {
        busy(b, true);
        api('host.setStatus', { e: id, status: ev.status === 'closed' ? 'open' : 'closed' }).then(function () {
          toast(ev.status === 'closed' ? 'RSVPs reopened' : 'RSVPs closed');
          return loadEvent(id, true);
        }).then(function () { viewEvent(id, tab); }).catch(function (err) { busy(b, false); showError(err); });
      });
      on(app, '[data-act="dup"]', 'click', function () { duplicateDialog(id); });
      on(app, '[data-act="del"]', 'click', function (e, b) {
        if (!confirm('Delete “' + d.text.title + '” and all of its guests and replies? This cannot be undone.')) return;
        busy(b, true, 'Deleting…');
        api('host.deleteEvent', { e: id }).then(function () { S.ev = null; toast('Event deleted'); location.hash = '#/'; })
          .catch(function (err) { busy(b, false); showError(err); });
      });

      var box = document.getElementById('tab');
      if (tab === 'guests') tabGuests(box, res);
      else if (tab === 'send') tabSend(box, res);
      else tabReplies(box, res);
    }).catch(showError);
  }

  function duplicateDialog(id) {
    openDialog('<h2>Duplicate this event</h2><p>Make a copy with the same design and wording, for example for next year. You can change the date next.</p>' +
      '<div class="dlg-actions"><button class="btn primary" type="button" data-with="1">Copy with guest list</button>' +
      '<button class="btn" type="button" data-with="0">Copy without guests</button><button class="btn" type="button" data-close>Cancel</button></div>',
    function (dlg) {
      on(dlg, '[data-with]', 'click', function (e, b) {
        busy(b, true, 'Copying…');
        api('host.duplicateEvent', { e: id, withGuests: b.getAttribute('data-with') === '1' }).then(function (res) {
          dlg.close(); toast('Copy created. Update the date and details.');
          location.hash = '#/e/' + encodeURIComponent(res.id) + '/edit';
        }).catch(function (err) { busy(b, false); showError(err); });
      });
    });
  }

  /* ----- replies tab ----- */

  function tabReplies(box, res) {
    var c = res.counts, q = res.event.data.settings.customQuestion, filter = 'all';
    function rows() {
      return res.guests.filter(function (g) { return filter === 'all' || g.status === filter; })
        .sort(function (a, b) { return String(b.repliedAt).localeCompare(String(a.repliedAt)) || a.name.localeCompare(b.name); });
    }
    function draw() {
      var list = rows();
      box.querySelector('.table-wrap').innerHTML = list.length ? '<table><thead><tr><th>Name</th><th>Reply</th><th class="num">Adults</th><th class="num">Kids</th>' +
        (q ? '<th>' + esc(q) + '</th>' : '') + '<th>Note</th><th>Replied</th></tr></thead><tbody>' +
        list.map(function (g) {
          return '<tr><td><strong>' + esc(g.name) + '</strong><div class="muted small">' + esc(g.email || g.mobile) + (g.source === 'open' ? ' · via open link' : '') + '</div></td>' +
            '<td><span class="st st-' + g.status + '">' + STATUS[g.status] + '</span></td>' +
            '<td class="num">' + (g.status === 'yes' ? g.adults : '') + '</td><td class="num">' + (g.status === 'yes' ? g.kids : '') + '</td>' +
            (q ? '<td>' + esc(g.answer) + '</td>' : '') + '<td>' + esc(g.note) + '</td>' +
            '<td class="muted small">' + (g.repliedAt ? esc(fmt.brief(g.repliedAt.slice(0, 10))) : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="muted">No guests in this view.</p>';
      box.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === filter)); });
    }
    box.innerHTML =
      '<div class="tiles">' +
      '<div class="tile big"><span>Attending</span><strong>' + c.total + '</strong><small>' + c.adults + ' adults · ' + c.kids + ' kids</small></div>' +
      '<div class="tile"><span>Accepted</span><strong>' + c.yes + '</strong><small>' + (c.yes === 1 ? 'reply' : 'replies') + '</small></div>' +
      '<div class="tile"><span>Declined</span><strong>' + c.no + '</strong><small>' + (c.no === 1 ? 'reply' : 'replies') + '</small></div>' +
      '<div class="tile"><span>Awaiting</span><strong>' + c.pending + '</strong><small>of ' + c.guests + ' guests</small></div></div>' +
      '<div class="toolbar"><div class="filters" role="group" aria-label="Filter by reply">' +
      [['all', 'All'], ['yes', 'Attending'], ['no', 'Declined'], ['pending', 'Awaiting']].map(function (f) {
        return '<button type="button" class="chip" data-filter="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div><button class="btn" type="button" data-act="csv">Export CSV</button></div>' +
      '<div class="table-wrap"></div>';
    on(box, '[data-filter]', 'click', function (e, b) { filter = b.getAttribute('data-filter'); draw(); });
    on(box, '[data-act="csv"]', 'click', function () { exportCsv(res); });
    draw();
  }

  function exportCsv(res) {
    var d = res.event.data, q = d.settings.customQuestion;
    var head = ['Name', 'Email', 'Mobile', 'Reply', 'Adults', 'Kids', q || 'Answer', 'Note', 'Replied at', 'Invited at', 'Invited by', 'Opened at', 'Source'];
    var rows = [head].concat(res.guests.map(function (g) {
      return [g.name, g.email, g.mobile, STATUS[g.status], g.status === 'yes' ? g.adults : '', g.status === 'yes' ? g.kids : '', g.answer, g.note,
        g.repliedAt, g.invitedAt, g.inviteVia, g.openedAt, g.source === 'open' ? 'Open link' : 'Guest list'];
    }));
    var csv = '﻿' + rows.map(function (r) {
      return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = (d.text.title || 'event').replace(/[^\w]+/g, '-').toLowerCase() + '-guests.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ----- guests tab ----- */

  function smsBody(kind, d, g) {
    var t = d.text.title, date = fmt.dateNoYear(d.date), n = first(g.name);
    if (kind === 'reminder') return 'Hi ' + n + ', a gentle reminder to reply for ' + t + ' on ' + date + ': ' + g.link;
    if (kind === 'daybefore') return 'Hi ' + n + ', see you tomorrow at ' + t + '! Details: ' + g.link;
    return 'Hi ' + n + '! You’re invited to ' + t + ' on ' + date + '. Here’s your invitation: ' + g.link;
  }
  function smsHref(mobile, body) { return 'sms:' + String(mobile).replace(/[^\d+]/g, '') + '?&body=' + encodeURIComponent(body); }

  function inviteState(g) {
    if (g.source === 'open') return 'Replied via open link';
    var s = g.invitedAt ? (g.inviteVia === 'text' ? 'Texted ' : 'Emailed ') + fmt.brief(g.invitedAt.slice(0, 10)) : 'Not sent';
    if (g.openedAt) s += ' · Opened';
    if (g.remindedAt) s += ' · Reminded';
    return s;
  }

  function tabGuests(box, res) {
    var id = res.event.id, d = res.event.data;
    box.innerHTML =
      '<form class="add-guest" novalidate><div class="grid3">' +
      '<div class="f"><label for="gn">Name</label><input id="gn" name="name" autocomplete="off" placeholder="Priya Sharma"></div>' +
      '<div class="f"><label for="ge">Email</label><input id="ge" name="email" type="email" autocomplete="off" placeholder="priya@example.com"></div>' +
      '<div class="f"><label for="gm">Mobile</label><input id="gm" name="mobile" type="tel" autocomplete="off" placeholder="+1 408 555 0142"></div></div>' +
      '<p class="muted small">Each guest needs an email, a mobile number, or both.</p>' +
      '<button class="btn primary" type="submit">Add guest</button></form>' +
      '<details class="paste-list"><summary>Paste a list</summary><form novalidate><label for="gl">One guest per line: name, then email and/or mobile, separated by commas or tabs.</label>' +
      '<textarea id="gl" name="text" rows="6" placeholder="Priya Sharma, priya@example.com&#10;Ananya Rao, +1 408 555 0142&#10;Rohan Kapoor, rohan@example.com, +1 650 555 0101"></textarea>' +
      '<button class="btn" type="submit">Add all</button><div class="paste-result" role="status"></div></form></details>' +
      '<div class="table-wrap">' + (res.guests.length ? '<table><thead><tr><th>Name</th><th>Contact</th><th>Invitation</th><th>Reply</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
        res.guests.map(function (g) {
          return '<tr><td><strong>' + esc(g.name) + '</strong></td><td class="small">' + esc(g.email) + (g.email && g.mobile ? '<br>' : '') + esc(g.mobile) + '</td>' +
            '<td class="small">' + esc(inviteState(g)) + '</td><td><span class="st st-' + g.status + '">' + STATUS[g.status] + '</span>' +
            (g.status === 'yes' ? ' <span class="small muted">' + g.adults + '+' + g.kids + '</span>' : '') + '</td>' +
            '<td class="row-actions"><button class="btn sm" type="button" data-copy="' + esc(g.link) + '">Copy link</button>' +
            (g.mobile ? '<a class="btn sm" data-text="' + esc(g.id) + '" href="' + esc(smsHref(g.mobile, smsBody('invite', d, g))) + '">Text invite</a>' : '') +
            '<button class="btn sm" type="button" data-edit="' + esc(g.id) + '">Edit</button>' +
            '<button class="btn sm danger" type="button" data-remove="' + esc(g.id) + '">Remove</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="muted">No guests yet. Add them above, or share the open link.</p>') + '</div>';

    function refresh(msg) { if (msg) toast(msg); loadEvent(id, true).then(function () { viewEvent(id, 'guests'); }); }

    on(box, '.add-guest', 'submit', function (e, f) {
      e.preventDefault();
      var b = f.querySelector('button');
      busy(b, true, 'Adding…');
      api('host.saveGuest', { e: id, guest: { name: f.name.value, email: f.email.value, mobile: f.mobile.value } })
        .then(function () { refresh('Guest added'); }).catch(function (err) { busy(b, false); showError(err); });
    });
    on(box, '.paste-list form', 'submit', function (e, f) {
      e.preventDefault();
      var b = f.querySelector('button');
      busy(b, true, 'Adding…');
      api('host.addGuests', { e: id, text: f.text.value }).then(function (r) {
        busy(b, false);
        if (!r.errors.length) return refresh(r.added + ' guests added');
        f.querySelector('.paste-result').innerHTML = '<p>' + r.added + ' added. Not added:</p><ul>' +
          r.errors.map(function (x) { return '<li>' + esc(x.message) + '</li>'; }).join('') + '</ul>';
        if (r.added) loadEvent(id, true);
      }).catch(function (err) { busy(b, false); showError(err); });
    });
    on(box, '[data-copy]', 'click', function (e, b) { copy(b.getAttribute('data-copy')); });
    on(box, '[data-text]', 'click', function (e, a) {
      api('host.markTexted', { e: id, g: a.getAttribute('data-text'), kind: 'invite' }).then(function () { loadEvent(id, true); }).catch(showError);
    });
    on(box, '[data-remove]', 'click', function (e, b) {
      var g = res.guests.filter(function (x) { return x.id === b.getAttribute('data-remove'); })[0];
      if (!confirm('Remove ' + g.name + ' and their reply? Their link will stop working.')) return;
      api('host.removeGuest', { e: id, g: g.id }).then(function () { refresh('Guest removed'); }).catch(showError);
    });
    on(box, '[data-edit]', 'click', function (e, b) {
      var g = res.guests.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0];
      editGuestDialog(id, g, refresh);
    });
  }

  function editGuestDialog(id, g, refresh) {
    openDialog('<h2>Edit guest</h2><form novalidate>' +
      '<div class="f"><label for="eg-n">Name</label><input id="eg-n" name="name" value="' + esc(g.name) + '"></div>' +
      '<div class="f"><label for="eg-e">Email</label><input id="eg-e" name="email" type="email" value="' + esc(g.email) + '"></div>' +
      '<div class="f"><label for="eg-m">Mobile</label><input id="eg-m" name="mobile" type="tel" value="' + esc(g.mobile) + '"></div>' +
      '<fieldset><legend>Reply (if they told you in person)</legend><div class="f"><label for="eg-s">Status</label><select id="eg-s" name="status">' +
      ['pending', 'yes', 'no'].map(function (s) { return '<option value="' + s + '"' + (g.status === s ? ' selected' : '') + '>' + STATUS[s] + '</option>'; }).join('') +
      '</select></div><div class="grid2"><div class="f"><label for="eg-a">Adults</label><input id="eg-a" name="adults" type="number" min="1" max="10" value="' + (g.status === 'yes' ? g.adults : 1) + '"></div>' +
      '<div class="f"><label for="eg-k">Kids</label><input id="eg-k" name="kids" type="number" min="0" max="9" value="' + (g.status === 'yes' ? g.kids : 0) + '"></div></div></fieldset>' +
      '<div class="dlg-actions"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-close>Cancel</button></div></form>',
    function (dlg) {
      on(dlg, 'form', 'submit', function (e, f) {
        e.preventDefault();
        var b = f.querySelector('[type="submit"]');
        busy(b, true, 'Saving…');
        var guest = { id: g.id, name: f.name.value, email: f.email.value, mobile: f.mobile.value };
        if (f.status.value !== g.status || f.status.value === 'yes') { guest.status = f.status.value; guest.adults = f.adults.value; guest.kids = f.kids.value; }
        api('host.saveGuest', { e: id, guest: guest }).then(function () { dlg.close(); refresh('Guest saved'); })
          .catch(function (err) { busy(b, false); showError(err); });
      });
    });
  }

  /* ----- send tab ----- */

  var KINDS = {
    invite: { label: 'Invitation', help: 'The invitation itself, with a button to each guest’s personal link.' },
    reminder: { label: 'Reminder', help: 'A gentle nudge for guests who have not replied yet.' },
    daybefore: { label: 'See you tomorrow', help: 'Details and a map link for guests who are coming.' }
  };

  function tabSend(box, res) {
    var id = res.event.id, d = res.event.data, kind = 'invite';
    var picked = {};

    function preset(k) {
      picked = {};
      res.guests.forEach(function (g) {
        var sel = k === 'invite' ? !g.invitedAt && g.source !== 'open' :
          k === 'reminder' ? g.status === 'pending' && !!g.invitedAt : g.status === 'yes';
        if (sel) picked[g.id] = true;
      });
    }

    function draw() {
      var chosen = res.guests.filter(function (g) { return picked[g.id]; });
      var byEmail = chosen.filter(function (g) { return g.email; });
      var byText = chosen.filter(function (g) { return !g.email && g.mobile; });
      box.innerHTML =
        '<div class="send-grid"><div>' +
        '<fieldset class="kinds"><legend>What to send</legend>' + Object.keys(KINDS).map(function (k) {
          return '<label class="kind"><input type="radio" name="kind" value="' + k + '"' + (k === kind ? ' checked' : '') + '><span><strong>' + KINDS[k].label + '</strong><small>' + KINDS[k].help + '</small></span></label>';
        }).join('') + '</fieldset>' +
        '<div class="f"><label for="sj">Subject</label><input id="sj" name="subject" value="' + esc(d.email[kind + 'Subject'] || InviteCore.EMAIL_DEFAULTS[kind + 'Subject']) + '"></div>' +
        '<div class="f"><label for="sm">Message</label><textarea id="sm" name="message" rows="9">' + esc(d.email[kind + 'Message'] || InviteCore.EMAIL_DEFAULTS[kind + 'Message']) + '</textarea>' +
        '<p class="muted small">{name} becomes each guest’s first name. Also available: {title}, {date}, {replyBy}, {hosts}.</p></div>' +
        '<div class="send-actions"><button class="btn" type="button" data-act="preview">Preview email</button>' +
        '<button class="btn primary" type="button" data-act="send"' + (byEmail.length ? '' : ' disabled') + '>Email ' + byEmail.length + (byEmail.length === 1 ? ' guest' : ' guests') + '</button></div>' +
        '<div class="send-result" role="status"></div>' +
        (byText.length ? '<div class="text-list"><h3>Text from your phone</h3><p class="muted small">These guests have only a mobile number. Each button opens Messages with the text ready; tap send.</p>' +
          byText.map(function (g) {
            return '<div class="text-row"><span>' + esc(g.name) + ' <span class="muted small">' + esc(g.mobile) + '</span></span><a class="btn sm" data-text="' + esc(g.id) + '" href="' + esc(smsHref(g.mobile, smsBody(kind, d, g))) + '">Text ' + esc(first(g.name)) + '</a></div>';
          }).join('') + '</div>' : '') +
        autoNote(d) +
        '</div><div><div class="recip-head"><h3>Recipients <span class="muted">(' + chosen.length + ' of ' + res.guests.length + ')</span></h3>' +
        '<div class="filters">' + [['invite', 'Not invited yet'], ['reminder', 'Awaiting reply'], ['daybefore', 'Attending'], ['all', 'All'], ['none', 'None']].map(function (q) {
          return '<button type="button" class="chip" data-pick="' + q[0] + '">' + q[1] + '</button>';
        }).join('') + '</div></div><ul class="recips">' +
        res.guests.map(function (g) {
          return '<li><label><input type="checkbox" data-g="' + esc(g.id) + '"' + (picked[g.id] ? ' checked' : '') + '><span><strong>' + esc(g.name) + '</strong>' +
            '<small>' + esc(g.email || g.mobile + ' (text only)') + ' · ' + STATUS[g.status] + ' · ' + esc(inviteState(g)) + '</small></span></label></li>';
        }).join('') + '</ul></div></div>';

      on(box, '[name="kind"]', 'change', function (e, r) { kind = r.value; preset(kind); draw(); });
      on(box, '[data-g]', 'change', function (e, c) { picked[c.getAttribute('data-g')] = c.checked; keepText(); });
      on(box, '[data-pick]', 'click', function (e, b) {
        var q = b.getAttribute('data-pick');
        if (q === 'all') res.guests.forEach(function (g) { picked[g.id] = true; });
        else if (q === 'none') picked = {};
        else { var keep = kind; preset(q); kind = keep; }
        keepText();
      });
      on(box, '[data-text]', 'click', function (e, a) {
        api('host.markTexted', { e: id, g: a.getAttribute('data-text'), kind: kind === 'reminder' ? 'reminder' : 'invite' }).catch(showError);
      });
      on(box, '[data-act="preview"]', 'click', function (e, b) {
        busy(b, true, 'Loading…');
        api('host.previewEmail', { e: id, kind: kind, subject: box.querySelector('#sj').value, message: box.querySelector('#sm').value }).then(function (m) {
          busy(b, false);
          openDialog('<h2>Preview</h2><p class="muted small">Subject: ' + esc(m.subject) + '</p><iframe class="email-frame" title="Email preview"></iframe>' +
            '<div class="dlg-actions"><button class="btn" type="button" data-close>Close</button></div>', function (dlg) {
            dlg.querySelector('iframe').srcdoc = m.html;
          }, 'wide');
        }).catch(function (err) { busy(b, false); showError(err); });
      });
      on(box, '[data-act="send"]', 'click', function (e, b) {
        var ids = res.guests.filter(function (g) { return picked[g.id] && g.email; }).map(function (g) { return g.id; });
        if (!confirm('Send this ' + KINDS[kind].label.toLowerCase() + ' to ' + ids.length + (ids.length === 1 ? ' guest' : ' guests') + ' by email?')) return;
        busy(b, true, 'Sending…');
        api('host.send', { e: id, kind: kind, ids: ids, subject: box.querySelector('#sj').value, message: box.querySelector('#sm').value }).then(function (r) {
          var parts = ['Sent to ' + r.sent + (r.sent === 1 ? ' guest' : ' guests') + '.'];
          if (r.skipped) parts.push(r.skipped + ' skipped (already sent today).');
          if (r.quota) parts.push(r.quota + ' not sent: Gmail’s daily limit is reached. Try again tomorrow.');
          if (r.errors.length) parts.push('Problems: ' + r.errors.join('; '));
          return loadEvent(id, true).then(function (fresh) {
            res = fresh; draw();
            box.querySelector('.send-result').textContent = parts.join(' ');
          });
        }).catch(function (err) { busy(b, false); showError(err); });
      });
    }

    // Re-render without losing typed subject/message.
    function keepText() {
      var sj = box.querySelector('#sj').value, sm = box.querySelector('#sm').value;
      draw();
      box.querySelector('#sj').value = sj; box.querySelector('#sm').value = sm;
    }

    preset(kind);
    draw();
  }

  function autoNote(d) {
    var s = d.settings, bits = [];
    bits.push(s.autoRemindDays && d.rsvpBy ? 'An automatic reminder goes to guests who haven’t replied on ' + fmt.dateNoYear(InviteCore.addDays(d.rsvpBy, -s.autoRemindDays)) + '.' : 'Automatic reminders are off.');
    bits.push(s.dayBeforeEmail ? 'A “see you tomorrow” email goes to guests who are coming on ' + fmt.dateNoYear(InviteCore.addDays(d.date, -1)) + '.' : 'The day-before email is off.');
    return '<p class="muted small auto">' + esc(bits.join(' ')) + ' Change these in Edit invitation.</p>';
  }

  /* ---------- editor ---------- */

  var DETAIL_FIELDS = [
    ['text.title', 'Title', 'text', 'Required. The big italic line.'],
    ['date', 'Date', 'date', 'Required.'],
    ['startTime', 'Start time', 'time'],
    ['endTime', 'End time (optional)', 'time'],
    ['venue', 'Venue', 'text', 'For example: The Gupta home'],
    ['address', 'Address', 'text', 'Guests get a map link.'],
    ['rsvpBy', 'RSVP by', 'date'],
    ['text.hostNames', 'Host names', 'text', 'Shown as “Hosted by …”. Also signs the emails.']
  ];
  var WORDING_FIELDS = [
    ['text.greeting', 'Greeting', 'Leave blank to hide.'],
    ['text.kicker', 'Line above the title', 'Leave blank to hide.'],
    ['text.subtitle', 'Line below the title', 'Leave blank to hide.'],
    ['text.dressCode', 'Dress code', 'Leave blank to hide.'],
    ['text.replyHeading', 'Reply heading'],
    ['text.acceptLabel', 'Accept button'],
    ['text.declineLabel', 'Decline button'],
    ['text.sendLabel', 'Send button'],
    ['text.acceptTitle', 'Thank-you title (accepted)'],
    ['text.acceptBody', 'Thank-you message (accepted)'],
    ['text.declineTitle', 'Thank-you title (declined)'],
    ['text.declineBody', 'Thank-you message (declined)']
  ];

  function getPath(o, p) { return p.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    ks.reduce(function (x, k) { return x[k] = x[k] || {}; }, o)[last] = v;
  }

  function viewEditor(id) {
    loading();
    var owner = S.me.host.role === 'owner';
    var loadP = id ? loadEvent(id, true) : Promise.resolve(null);
    var hostsP = owner && !id ? api('host.hosts') : Promise.resolve(null);
    Promise.all([loadP, hostsP]).then(function (r) {
      var res = r[0], hostList = r[1];
      var d0 = res ? res.event.data : null;
      return Themes.load(d0 ? d0.theme : 'diwali').then(function (theme) {
        var draft;
        if (d0) {
          draft = JSON.parse(JSON.stringify(d0));
          draft.text = Themes.text(theme, draft);
        } else {
          draft = {
            theme: theme.id, template: theme.templates[0].id,
            colors: { ground: theme.swatches.ground[0].value, accent: theme.swatches.accent[0].value },
            text: Object.assign({}, theme.defaults, { hostNames: S.me.host.name }),
            date: '', startTime: '19:00', endTime: '', venue: '', address: '', rsvpBy: '',
            settings: JSON.parse(JSON.stringify(InviteCore.SETTINGS_DEFAULTS)), email: {}
          };
        }
        Object.keys(InviteCore.EMAIL_DEFAULTS).forEach(function (k) { if (!draft.email[k]) draft.email[k] = InviteCore.EMAIL_DEFAULTS[k]; });
        var hosts = res ? res.allHosts : hostList && hostList.hosts.map(function (h) { return { key: h.key, name: h.name, role: h.role, assigned: h.key === S.key }; });
        renderEditor(id, theme, draft, owner ? hosts : null);
      });
    }).catch(showError);
  }

  function renderEditor(id, theme, draft, hosts) {
    var title = id ? 'Edit invitation' : 'New invitation';
    function field(p, label, type, help) {
      var v = getPath(draft, p) || '';
      return '<div class="f"><label for="x-' + p + '">' + esc(label) + '</label>' +
        '<input id="x-' + p + '" data-path="' + p + '" type="' + (type || 'text') + '" value="' + esc(v) + '">' +
        (help ? '<small class="muted">' + esc(help) + '</small>' : '') + '</div>';
    }
    function area(p, label, rows, help) {
      return '<div class="f"><label for="x-' + p + '">' + esc(label) + '</label><textarea id="x-' + p + '" data-path="' + p + '" rows="' + (rows || 2) + '">' +
        esc(getPath(draft, p) || '') + '</textarea>' + (help ? '<small class="muted">' + esc(help) + '</small>' : '') + '</div>';
    }
    function check(p, label, help) {
      return '<label class="check"><input type="checkbox" data-path="' + p + '"' + (getPath(draft, p) ? ' checked' : '') + '><span>' + esc(label) +
        (help ? '<small class="muted">' + esc(help) + '</small>' : '') + '</span></label>';
    }
    function swatches(kind) {
      return '<div class="swatches" role="radiogroup" aria-label="' + (kind === 'ground' ? 'Background' : 'Accent') + '">' + theme.swatches[kind].map(function (s) {
        return '<label class="sw" title="' + esc(s.name) + '"><input type="radio" name="sw-' + kind + '" data-path="colors.' + kind + '" value="' + s.value + '"' +
          (draft.colors[kind] === s.value ? ' checked' : '') + '><span style="background:' + s.value + '"></span><em>' + esc(s.name) + '</em></label>';
      }).join('') + '</div>';
    }

    page('<a class="back" href="' + (id ? '#/e/' + encodeURIComponent(id) : '#/') + '">← Back</a>' +
      '<div class="head"><h1>' + title + '</h1></div>' +
      '<div class="editor"><form class="ed-form" novalidate>' +
      '<p class="form-error" role="alert" hidden></p>' +

      '<section><h2>Design</h2>' +
      '<div class="f"><label for="x-theme">Theme</label><select id="x-theme" data-path="theme">' + Themes.list.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === draft.theme ? ' selected' : '') + '>' + esc(t.name) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="f"><span class="lab">Card design</span><div class="tpls" role="radiogroup" aria-label="Card design">' + theme.templates.map(function (t) {
        return '<label class="tpl"><input type="radio" name="tpl" data-path="template" value="' + t.id + '"' + (draft.template === t.id ? ' checked' : '') + '>' +
          '<div class="thumb t-' + theme.id + '" data-thumb="' + t.id + '"></div><strong>' + esc(t.name) + '</strong><small class="muted">' + esc(t.note) + '</small></label>';
      }).join('') + '</div></div>' +
      '<div class="f"><span class="lab">Background</span>' + swatches('ground') + '</div>' +
      '<div class="f"><span class="lab">Accent</span>' + swatches('accent') + '</div></section>' +

      '<section><h2>Details</h2><div class="grid2">' + DETAIL_FIELDS.map(function (f) { return field(f[0], f[1], f[2], f[3]); }).join('') + '</div></section>' +

      '<section><h2>Wording</h2><div class="grid2">' + WORDING_FIELDS.map(function (f) { return field(f[0], f[1], 'text', f[2]); }).join('') + '</div></section>' +

      '<section><h2>Replies</h2>' +
      check('settings.openLink', 'Open link is on', 'Anyone with the event’s open link can reply. Turn off for invite-only parties.') +
      check('settings.showGuestList', 'Show guests who’s coming') +
      '<div class="f"><label for="x-av">Address</label><select id="x-av" data-path="settings.addressVisibility">' +
      '<option value="all"' + (draft.settings.addressVisibility === 'all' ? ' selected' : '') + '>Show to everyone</option>' +
      '<option value="accepted"' + (draft.settings.addressVisibility === 'accepted' ? ' selected' : '') + '>Show only after a guest accepts</option></select></div>' +
      field('settings.customQuestion', 'Extra question (optional)', 'text', 'For example: Any dietary needs we should know about?') +
      '</section>' +

      '<section><h2>Notifications and reminders</h2>' +
      check('settings.notifyHosts', 'Email the hosts when someone replies') +
      field('settings.cohostEmails', 'Also notify (optional)', 'text', 'Extra email addresses, separated by commas.') +
      '<div class="f"><label for="x-ar">Automatic reminder</label><select id="x-ar" data-path="settings.autoRemindDays" data-int>' +
      [0, 1, 2, 3, 5, 7].map(function (n) {
        return '<option value="' + n + '"' + (+draft.settings.autoRemindDays === n ? ' selected' : '') + '>' + (n ? n + (n === 1 ? ' day' : ' days') + ' before the RSVP date' : 'Off') + '</option>';
      }).join('') + '</select><small class="muted">Emails guests who were invited but haven’t replied. Needs an RSVP-by date.</small></div>' +
      check('settings.dayBeforeEmail', 'Send a “see you tomorrow” email the day before', 'Goes to guests who accepted, with details and a map link.') +
      '</section>' +

      '<section><h2>Email wording</h2><p class="muted small">{name} becomes each guest’s first name. Also available: {title}, {date}, {replyBy}, {hosts}.</p>' +
      field('email.inviteSubject', 'Invitation subject') + area('email.inviteMessage', 'Invitation message', 7) +
      field('email.reminderSubject', 'Reminder subject') + area('email.reminderMessage', 'Reminder message', 6) +
      field('email.daybeforeSubject', '“See you tomorrow” subject') + area('email.daybeforeMessage', '“See you tomorrow” message', 5) +
      '</section>' +

      (hosts ? '<section><h2>Hosts</h2><p class="muted small">Hosts can edit this event and see replies. Add family members on the <a href="#/hosts">Hosts</a> page.</p>' +
        hosts.map(function (h) {
          return '<label class="check"><input type="checkbox" data-host="' + esc(h.key) + '"' + (h.assigned ? ' checked' : '') + '><span>' + esc(h.name) + (h.role === 'owner' ? ' <small class="muted">(owner)</small>' : '') + '</span></label>';
        }).join('') + '</section>' : '') +

      '<div class="savebar"><button class="btn primary" type="submit">' + (id ? 'Save changes' : 'Create event') + '</button>' +
      '<a class="btn" href="' + (id ? '#/e/' + encodeURIComponent(id) : '#/') + '">Cancel</a></div>' +
      '</form>' +

      '<aside class="ed-preview" aria-label="Preview"><div class="pv-tabs" role="tablist">' +
      ['envelope', 'card', 'phone'].map(function (k, i) {
        return '<button type="button" role="tab" data-pv="' + k + '" aria-selected="' + (i === 1) + '">' + k[0].toUpperCase() + k.slice(1) + '</button>';
      }).join('') + '</div><div class="pv t-' + theme.id + '"></div></aside></div>');

    var form = app.querySelector('.ed-form'), pv = app.querySelector('.pv'), mode = 'card', timer = null;

    function previewEv() {
      var ev = JSON.parse(JSON.stringify(draft));
      ev.id = id || 'preview'; ev.closed = ''; ev.addressHidden = false;
      return ev;
    }
    function drawPreview() {
      var ev = previewEv(), t = Themes.text(theme, ev);
      pv.setAttribute('style', Themes.vars(ev));
      if (mode === 'envelope') pv.innerHTML = '<div class="pv-env">' + theme.envelope(ev, 'Priya Sharma') + '</div>';
      else if (mode === 'phone') pv.innerHTML = '<div class="pv-phone"><div class="narrow">' + theme.hero(ev) + '</div><div class="below">' + Render.details(ev, t) + Render.form(ev, t, null, { inert: true }) + '</div></div>';
      else pv.innerHTML = theme.card(ev);
      var env = pv.querySelector('.envelope');
      if (env) env.addEventListener('click', function () { env.classList.toggle('open'); });
      app.querySelectorAll('[data-thumb]').forEach(function (th) {
        th.setAttribute('style', Themes.vars(ev));
        th.innerHTML = theme.card(Object.assign({}, ev, { template: th.getAttribute('data-thumb') }));
      });
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(drawPreview, 120); }

    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    function onChange(e) {
      var el = e.target, p = el.getAttribute('data-path');
      if (!p) return;
      var v = el.type === 'checkbox' ? el.checked : el.hasAttribute('data-int') ? parseInt(el.value, 10) || 0 : el.value;
      if (el.type === 'radio' && !el.checked) return;
      setPath(draft, p, v);
      schedule();
    }
    on(app, '[data-pv]', 'click', function (e, b) {
      mode = b.getAttribute('data-pv');
      app.querySelectorAll('[data-pv]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      drawPreview();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = form.querySelector('.form-error'), b = form.querySelector('[type="submit"]');
      err.hidden = true;
      var missing = !draft.text.title ? 'Please add a title.' : !draft.date ? 'Please choose a date.' : '';
      if (missing) { err.textContent = missing; err.hidden = false; err.scrollIntoView({ block: 'center' }); return; }
      var payload = { id: id || '', data: draft };
      if (hosts) payload.hostKeys = Array.prototype.map.call(form.querySelectorAll('[data-host]:checked'), function (c) { return c.getAttribute('data-host'); });
      busy(b, true, 'Saving…');
      api('host.saveEvent', { event: payload }).then(function (r) {
        S.ev = null;
        toast(id ? 'Changes saved' : 'Event created');
        location.hash = '#/e/' + encodeURIComponent(r.id) + (id ? '' : '/guests');
      }).catch(function (x) {
        busy(b, false);
        err.textContent = x.message; err.hidden = false; err.scrollIntoView({ block: 'center' });
      });
    });

    drawPreview();
  }

  /* ---------- hosts (owner) ---------- */

  function viewHosts() {
    if (S.me.host.role !== 'owner') { location.hash = '#/'; return; }
    loading();
    api('host.hosts').then(function (res) {
      page('<div class="head"><div><h1>Hosts</h1><p class="muted">Each host gets a private link that signs them in. Anyone holding a host’s link can manage that host’s events, so share it only with them, and reset it if it leaks.</p></div></div>' +
        '<form class="add-host" novalidate><div class="grid3"><div class="f"><label for="hn">Name</label><input id="hn" name="name" placeholder="Mom"></div>' +
        '<div class="f"><label for="he">Email (for reply notifications)</label><input id="he" name="email" type="email"></div>' +
        '<div class="f f-btn"><button class="btn primary" type="submit">Add host</button></div></div></form>' +
        '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
        res.hosts.map(function (h) {
          return '<tr><td><strong>' + esc(h.name) + '</strong></td><td>' + esc(h.email) + '</td><td>' + (h.role === 'owner' ? 'Owner' : 'Host') + '</td>' +
            '<td class="row-actions"><button class="btn sm" type="button" data-copy="' + esc(h.link) + '">Copy host link</button>' +
            '<button class="btn sm" type="button" data-reset="' + esc(h.key) + '">Reset link</button>' +
            (h.role === 'owner' ? '' : '<button class="btn sm danger" type="button" data-rm="' + esc(h.key) + '">Remove</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted small">To make a family member a host of an event, tick their name under Hosts when editing that event. Events they create are theirs automatically.</p>');
      on(app, '.add-host', 'submit', function (e, f) {
        e.preventDefault();
        api('host.saveHost', { host: { name: f.name.value, email: f.email.value } }).then(function (r) {
          copy(r.host.link, 'Host link for ' + r.host.name);
          viewHosts();
        }).catch(showError);
      });
      on(app, '[data-copy]', 'click', function (e, b) { copy(b.getAttribute('data-copy'), 'Host link'); });
      on(app, '[data-reset]', 'click', function (e, b) {
        if (!confirm('Reset this host link? The old link stops working right away.')) return;
        api('host.resetHostKey', { key: b.getAttribute('data-reset') }).then(function (r) {
          if (r.host.self) setKey(r.host.key);
          copy(r.host.link, 'New host link');
          viewHosts();
        }).catch(showError);
      });
      on(app, '[data-rm]', 'click', function (e, b) {
        if (!confirm('Remove this host? Their link stops working. Their events stay.')) return;
        api('host.removeHost', { key: b.getAttribute('data-rm') }).then(function () { toast('Host removed'); viewHosts(); }).catch(showError);
      });
    }).catch(showError);
  }

  /* ---------- demo outbox ---------- */

  function viewOutbox() {
    var mails = Api.outbox();
    page('<div class="head"><div><h1>Demo outbox</h1><p class="muted">In demo mode, emails land here instead of being sent. With the backend connected, they go out from your Gmail.</p></div></div>' +
      (mails.length ? '<ul class="outbox">' + mails.map(function (m, i) {
        return '<li><button type="button" class="ob" data-i="' + i + '"><strong>' + esc(m.subject) + '</strong><span class="muted small">To ' + esc(m.to) + ' · ' +
          esc(new Date(m.ts).toLocaleString()) + '</span></button></li>';
      }).join('') + '</ul>' : '<div class="empty"><p>No emails yet. Send an invitation from an event’s Send tab, or reply as a guest to trigger a host notification.</p></div>'));
    on(app, '[data-i]', 'click', function (e, b) {
      var m = mails[+b.getAttribute('data-i')];
      openDialog('<h2>' + esc(m.subject) + '</h2><p class="muted small">To ' + esc(m.to) + '</p><iframe class="email-frame" title="Email"></iframe>' +
        '<div class="dlg-actions"><button class="btn" type="button" data-close>Close</button></div>', function (dlg) {
        dlg.querySelector('iframe').srcdoc = m.html;
      }, 'wide');
    });
  }

  /* ---------- dialog ---------- */

  function openDialog(html, bind, size) {
    var dlg = document.getElementById('dlg');
    dlg.className = size || '';
    dlg.innerHTML = html;
    on(dlg, '[data-close]', 'click', function () { dlg.close(); });
    if (bind) bind(dlg);
    dlg.showModal();
    var f = dlg.querySelector('input, select, textarea, button');
    if (f) f.focus();
  }

  init();
})();
