/*
 * Invitations core: all data rules, validation and email building.
 *
 * Runs unchanged in two places:
 *   - Google Apps Script (paste this file as "Core.gs"; Code.gs supplies the Sheet store + Gmail)
 *   - the browser demo mode (js/api.js supplies a localStorage store + a fake outbox)
 *
 * store: { all(table), insert(table, obj), update(table, idField, id, patch), remove(table, idField, id) }
 * svc:   { now(), today(), random(n), sendEmail(msg), emailQuota(), siteUrl, rateOk(key) }
 */
var InviteCore = (function () {
  'use strict';

  var TABLES = {
    Hosts: ['key', 'name', 'email', 'role', 'createdAt'],
    Events: ['id', 'title', 'date', 'theme', 'status', 'hostKeys', 'data', 'createdAt', 'updatedAt'],
    Guests: ['id', 'eventId', 'name', 'email', 'mobile', 'source', 'status', 'adults', 'kids', 'answer', 'note',
      'repliedAt', 'invitedAt', 'inviteVia', 'openedAt', 'remindedAt', 'sends', 'createdAt'],
    Log: ['ts', 'eventId', 'guestId', 'kind', 'detail']
  };

  // What the backend needs to know about each theme (the artwork lives in themes/<id>/).
  // Each card design (template) uses one palette: its swatches, plus the colors emails need.
  function sw(name, value, value2) { var o = { name: name, value: value }; if (value2) o.value2 = value2; return o; }
  var THEMES = {
    diwali: {
      name: 'Diwali',
      page: 'diwali.html',
      display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
      body: "Jost, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      templates: { classic: 'night', mandala: 'night', toran: 'night', arch: 'arch', carnival: 'carnival', plum: 'plum' },
      palettes: {
        night: {
          grounds: [sw('Midnight', '#1A1230'), sw('Deep maroon', '#3A0F1E'), sw('Emerald', '#0E2A26'), sw('Indigo', '#14213D')],
          accents: [sw('Classic gold', '#D4AF5F'), sw('Pale gold', '#E6C77E'), sw('Antique gold', '#C9A24A')],
          text: '#F4E9D3', muted: '#CDBFA3', envInk: '#F4E9D3'
        },
        arch: {
          grounds: [sw('Ivory', '#FFF6E3'), sw('Blush', '#FCEBE2'), sw('Pistachio', '#EFF2DF')],
          accents: [sw('Saffron', '#F0B04F'), sw('Marigold', '#EC9A3A'), sw('Rose', '#E8A48C')],
          text: '#5A1A0E', muted: '#8A4A2A', label: '#B5651D', button: '#6B1F12', buttonText: '#FFF6E3', env: '#6B1F12', envInk: '#FFF6E3'
        },
        carnival: {
          grounds: [sw('Plum to rust', '#3A0F1E', '#7A3416'), sw('Wine', '#2A0A1C', '#64202E'), sw('Night to plum', '#151033', '#4E1F46')],
          accents: [sw('Marigold gold', '#F2C879'), sw('Bright gold', '#F5B942'), sw('Pale gold', '#F6DFAE')],
          text: '#FFF3E2', muted: '#F0D9BE', envInk: '#FFF3E2'
        },
        plum: {
          grounds: [sw('Plum', '#3A1532'), sw('Aubergine', '#2A0E26'), sw('Midnight', '#1A1230')],
          accents: [sw('Champagne', '#F1D39A'), sw('Classic gold', '#D4AF5F'), sw('Rose gold', '#E8B59A')],
          text: '#F6E9DC', muted: '#D9C3B4', envInk: '#F6E9DC'
        }
      },
      surround: '#EFE4CF'
    }
  };

  function paletteOf(theme, template) {
    var th = THEMES[theme] || THEMES.diwali;
    var key = th.templates[template] || th.templates[Object.keys(th.templates)[0]];
    return { key: key, p: th.palettes[key] };
  }

  function values(list) { return list.map(function (x) { return x.value; }); }

  // Bump whenever this file changes, so the host page can tell when the Apps Script copy is out of date.
  var VERSION = '2026-10-07.2';
  // The Code.gs version this site expects (Code.gs sets CODE_VERSION).
  var CODE_VERSION = '2026-10-07.1';

  var MAX_PARTY = 10;

  /* ---------- formatting (shared with the browser) ---------- */

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1) return null;
    return { y: y, m: mo, d: d, dow: dt.getUTCDay() };
  }

  function addDays(ymd, n) {
    var p = parseYmd(ymd);
    if (!p) return '';
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return dt.toISOString().slice(0, 10);
  }

  var fmt = {
    date: function (s) { var p = parseYmd(s); return p ? DAYS[p.dow] + ', ' + MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y : ''; },
    dateNoYear: function (s) { var p = parseYmd(s); return p ? DAYS[p.dow] + ', ' + MONTHS[p.m - 1] + ' ' + p.d : ''; },
    monthDay: function (s) { var p = parseYmd(s); return p ? MONTHS[p.m - 1] + ' ' + p.d : ''; },
    brief: function (s) { var p = parseYmd(s); return p ? MONTHS[p.m - 1].slice(0, 3) + ' ' + p.d : ''; },
    time: function (t) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
      if (!m) return '';
      var h = +m[1], ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return h + ':' + m[2] + ' ' + ap;
    },
    timeRange: function (a, b) {
      var s = fmt.time(a), e = fmt.time(b);
      if (!s) return '';
      if (!e) return s;
      if (s.slice(-2) === e.slice(-2)) return s.slice(0, -3) + ' – ' + e;
      return s + ' – ' + e;
    },
    mapUrl: function (q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  };

  /* ---------- defaults ---------- */

  var EMAIL_DEFAULTS = {
    inviteSubject: "You're invited: {title}",
    inviteMessage: 'Dear {name},\n\nWe would love for you to join us. Please open your invitation for the details, and kindly reply{replyBy}.\n\nWarmly,\n{hosts}',
    reminderSubject: 'A gentle reminder: {title}',
    reminderMessage: 'Dear {name},\n\nWe hope you can join us for {title} on {date}. When you have a moment, please let us know if you can make it.\n\nWarmly,\n{hosts}',
    daybeforeSubject: 'See you tomorrow: {title}',
    daybeforeMessage: 'Dear {name},\n\nWe are looking forward to seeing you tomorrow. The details are below.\n\nWarmly,\n{hosts}'
  };

  var SETTINGS_DEFAULTS = {
    openLink: true,
    showGuestList: true,
    allowMaybe: true,
    addressVisibility: 'all', // 'all' | 'accepted'
    notifyHosts: true,
    cohostEmails: '',
    customQuestion: '',
    autoRemindDays: 0,
    dayBeforeEmail: false
  };

  /* ---------- helpers ---------- */

  function fail(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function str(v, max) { v = v == null ? '' : String(v).trim(); return max ? v.slice(0, max) : v; }
  function int(v, d) { var n = parseInt(v, 10); return isNaN(n) ? d : n; }
  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  function isPhone(s) { return /^\+?\d{7,15}$/.test(String(s).replace(/[\s\-().]/g, '')); }
  function isHex(s) { return /^#[0-9A-Fa-f]{6}$/.test(s); }
  function isTime(s) { return /^\d{2}:\d{2}$/.test(s); }
  function json(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function normalizeData(d) {
    d = d || {};
    var out = copy(d);
    out.theme = THEMES[out.theme] ? out.theme : 'diwali';
    var th = THEMES[out.theme];
    if (!th.templates[out.template]) out.template = Object.keys(th.templates)[0];
    var pal = paletteOf(out.theme, out.template).p;
    out.colors = out.colors || {};
    // Colors must come from the design's own swatches, so emails always have a matching image.
    if (values(pal.grounds).indexOf(out.colors.ground) < 0) out.colors.ground = pal.grounds[0].value;
    if (values(pal.accents).indexOf(out.colors.accent) < 0) out.colors.accent = pal.accents[0].value;
    out.text = out.text || {};
    out.email = out.email || {};
    var s = out.settings || {};
    out.settings = {};
    Object.keys(SETTINGS_DEFAULTS).forEach(function (k) {
      out.settings[k] = s[k] === undefined ? SETTINGS_DEFAULTS[k] : s[k];
    });
    out.settings.autoRemindDays = Math.max(0, Math.min(30, int(out.settings.autoRemindDays, 0)));
    ['date', 'startTime', 'endTime', 'venue', 'address', 'rsvpBy'].forEach(function (k) {
      out[k] = str(out[k], 500);
    });
    return out;
  }

  function validateData(d) {
    if (!str(d.text.title)) throw fail('invalid', 'The event needs a title.');
    if (!parseYmd(d.date)) throw fail('invalid', 'The event needs a valid date.');
    if (d.startTime && !isTime(d.startTime)) throw fail('invalid', 'Start time is not valid.');
    if (d.endTime && !isTime(d.endTime)) throw fail('invalid', 'End time is not valid.');
    if (d.rsvpBy && !parseYmd(d.rsvpBy)) throw fail('invalid', 'RSVP-by date is not valid.');
    var bad = str(d.settings.cohostEmails).split(/[\s,;]+/).filter(function (e) { return e && !isEmail(e); });
    if (bad.length) throw fail('invalid', 'Co-host email not valid: ' + bad[0]);
    Object.keys(d.text).forEach(function (k) { d.text[k] = str(d.text[k], 600); });
    Object.keys(d.email).forEach(function (k) { d.email[k] = str(d.email[k], 4000); });
    d.settings.customQuestion = str(d.settings.customQuestion, 300);
  }

  /* ---------- the service ---------- */

  function create(store, svc) {

    function events() { return store.all('Events'); }
    function guestsOf(eventId) { return store.all('Guests').filter(function (g) { return g.eventId === eventId; }); }
    function findEvent(id) { return id ? events().filter(function (e) { return e.id === id; })[0] : null; }
    function findGuest(id) { return id ? store.all('Guests').filter(function (g) { return g.id === id; })[0] : null; }
    function findHost(key) { return key ? store.all('Hosts').filter(function (h) { return h.key === key; })[0] : null; }
    function dataOf(ev) { return normalizeData(json(ev.data, {})); }
    function hostKeys(ev) { return str(ev.hostKeys).split(',').filter(Boolean); }
    function log(eventId, guestId, kind, detail) {
      store.insert('Log', { ts: svc.now(), eventId: eventId, guestId: guestId || '', kind: kind, detail: detail || '' });
    }
    function themeOf(d) { return THEMES[d.theme] || THEMES.diwali; }
    function base() { return String(svc.siteUrl || '').replace(/\/+$/, ''); }
    function guestLink(ev, d, g) {
      return base() + '/' + themeOf(d).page + '?e=' + encodeURIComponent(ev.id) + (g ? '&g=' + encodeURIComponent(g.id) : '');
    }
    function hostLink(h) { return base() + '/host.html#k=' + encodeURIComponent(h.key); }

    function closedReason(ev, d) {
      if (ev.status === 'closed') return 'closed';
      if (d.date && d.date < svc.today()) return 'past';
      return '';
    }

    function counts(list) {
      var c = { yes: 0, no: 0, maybe: 0, pending: 0, adults: 0, kids: 0, total: 0, maybeTotal: 0, guests: list.length, invited: 0 };
      list.forEach(function (g) {
        var s = g.status || 'pending';
        c[s] = (c[s] || 0) + 1;
        if (g.invitedAt) c.invited++;
        if (s === 'yes') { c.adults += int(g.adults, 1); c.kids += int(g.kids, 0); }
        if (s === 'maybe') c.maybeTotal += int(g.adults, 1) + int(g.kids, 0);
      });
      c.total = c.adults + c.kids;
      return c;
    }

    function publicEvent(ev, d, guest) {
      var out = {
        id: ev.id, theme: d.theme, template: d.template, colors: d.colors, text: d.text,
        date: d.date, startTime: d.startTime, endTime: d.endTime, venue: d.venue, address: d.address,
        rsvpBy: d.rsvpBy, closed: closedReason(ev, d),
        settings: { showGuestList: !!d.settings.showGuestList, customQuestion: d.settings.customQuestion, openLink: !!d.settings.openLink, allowMaybe: d.settings.allowMaybe !== false },
        addressHidden: false
      };
      if (d.settings.addressVisibility === 'accepted' && !(guest && guest.status === 'yes') && d.address) {
        out.address = '';
        out.addressHidden = true;
      }
      return out;
    }

    function publicGuest(g) {
      return {
        id: g.id, name: g.name, status: g.status || 'pending', adults: int(g.adults, 1), kids: int(g.kids, 0),
        answer: g.answer || '', note: g.note || '', fromList: g.source !== 'open'
      };
    }

    function attendees(eventId) {
      return guestsOf(eventId).filter(function (g) { return g.status === 'yes'; })
        .sort(function (a, b) { return String(a.repliedAt).localeCompare(String(b.repliedAt)); })
        .map(function (g) { return { name: g.name, count: int(g.adults, 1) + int(g.kids, 0) }; });
    }

    function auth(req) {
      var h = findHost(req.k);
      if (!h) throw fail('unauthorized', 'This host link is not valid.');
      return h;
    }
    function isOwner(h) { return h.role === 'owner'; }
    function eventFor(h, id) {
      var ev = findEvent(id);
      if (!ev || !(isOwner(h) || hostKeys(ev).indexOf(h.key) >= 0)) throw fail('not_found', 'Event not found.');
      return ev;
    }

    /* ----- email ----- */

    function fill(tpl, ev, d, g) {
      var vars = {
        name: g ? str(g.name).split(' ')[0] || g.name : '',
        title: d.text.title || '',
        date: fmt.dateNoYear(d.date),
        hosts: d.text.hostNames || '',
        replyBy: d.rsvpBy ? ' by ' + fmt.dateNoYear(d.rsvpBy) : '',
        rsvpBy: d.rsvpBy ? fmt.dateNoYear(d.rsvpBy) : ''
      };
      return String(tpl || '').replace(/\{(\w+)\}/g, function (m, k) { return vars.hasOwnProperty(k) ? vars[k] : m; });
    }

    function stampImage(d) {
      var pal = paletteOf(d.theme, d.template);
      var gi = Math.max(0, values(pal.p.grounds).indexOf(d.colors.ground));
      var ai = Math.max(0, values(pal.p.accents).indexOf(d.colors.accent));
      return base() + '/themes/' + d.theme + '/email/stamp-' + pal.key + '-' + gi + '-' + ai + '.png';
    }

    function calendarUrl(d) {
      var stamp = function (date, time) { return date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : ''); };
      var end;
      if (d.endTime) end = stamp(d.endTime <= d.startTime ? addDays(d.date, 1) : d.date, d.endTime);
      else if (d.startTime) {
        var h = parseInt(d.startTime, 10) + 3, day = d.date;
        if (h >= 24) { h -= 24; day = addDays(d.date, 1); }
        end = stamp(day, (h < 10 ? '0' : '') + h + d.startTime.slice(2));
      } else end = stamp(addDays(d.date, 1));
      return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(d.text.title || '') +
        '&dates=' + stamp(d.date, d.startTime) + '/' + end + '&location=' + encodeURIComponent([d.venue, d.address].filter(Boolean).join(', '));
    }

    // Email layout (like a paper invitation in the mail): context on light paper, then the
    // addressed front of the envelope, the button, and the event details on a dark band.
    function buildEmail(kind, ev, d, g, overrides) {
      overrides = overrides || {};
      var th = themeOf(d), e = fmt.esc;
      var subject = fill(overrides.subject || d.email[kind + 'Subject'] || EMAIL_DEFAULTS[kind + 'Subject'], ev, d, g);
      var message = fill(overrides.message || d.email[kind + 'Message'] || EMAIL_DEFAULTS[kind + 'Message'], ev, d, g);
      var link = guestLink(ev, d, g);
      var P = paletteOf(d.theme, d.template).p;
      var ENV = P.env || d.colors.ground, INK = P.envInk || P.text, A = d.colors.accent;
      var PAPER = '#FBF6EA', DARK = '#2A2433', SOFT = '#6B5E52';
      var D = th.display, S = th.body;
      var hideAddress = d.settings.addressVisibility === 'accepted' && !(g && g.status === 'yes');
      var paras = message.split(/\n{2,}/).map(function (p) {
        return '<p style="margin:0 0 16px">' + e(p).replace(/\n/g, '<br>') + '</p>';
      }).join('');
      var label = function (t) { return '<div style="font-family:' + S + ';font-size:12px;letter-spacing:4px;text-transform:uppercase;color:' + A + ';margin:0 0 6px">' + t + '</div>'; };
      var linkStyle = 'color:' + INK + ';font-family:' + S + ';font-size:12px;letter-spacing:3px;text-transform:uppercase;text-decoration:underline;text-underline-offset:4px';
      var when = [fmt.date(d.date), fmt.timeRange(d.startTime, d.endTime)].filter(Boolean);
      var details = '';
      if (when.length) {
        details += label('When') + '<div style="font-family:' + S + ';font-size:16px;line-height:1.6;color:' + INK + '">' + when.map(e).join('<br>') + '</div>' +
          '<div style="margin:8px 0 22px"><a href="' + e(calendarUrl(d)) + '" style="' + linkStyle + '">Add to calendar</a></div>';
      }
      var place = [d.venue, hideAddress ? '' : d.address].filter(Boolean);
      if (place.length) {
        details += label('Where') + '<div style="font-family:' + S + ';font-size:16px;line-height:1.6;color:' + INK + '">' + place.map(e).join('<br>') + '</div>' +
          (d.address && !hideAddress ? '<div style="margin:8px 0 4px"><a href="' + e(fmt.mapUrl(d.address)) + '" style="' + linkStyle + '">View map</a></div>' :
            hideAddress && d.address ? '<div style="font-family:' + S + ';font-size:13px;color:' + INK + ';opacity:.8;margin-top:6px">The address is shared once you accept.</div>' : '');
      }
      var html =
        '<div style="background:' + th.surround + ';padding:24px 12px">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:' + PAPER + ';border-collapse:collapse">' +
        '<tr><td style="padding:36px 32px 6px;text-align:center;font-family:' + D + ';font-size:32px;line-height:1.2;color:' + DARK + '">' + e(d.text.title || '') + '</td></tr>' +
        '<tr><td align="center" style="padding:6px 0 18px"><div style="width:64px;height:1px;background:' + A + ';line-height:1px;font-size:1px">&nbsp;</div></td></tr>' +
        '<tr><td style="padding:0 40px 8px;font-family:' + D + ';font-size:18px;line-height:1.6;color:' + DARK + '">' + paras + '</td></tr>' +
        // The envelope keeps an envelope's shape (about 3:2) instead of stretching to the email's width.
        '<tr><td align="center" style="padding:4px 12px 26px">' +
        '<a href="' + e(link) + '" style="text-decoration:none;display:block">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="380" height="240" align="center" style="width:380px;max-width:100%;height:240px;background:' + ENV + ';border:1px solid ' + A + ';border-radius:4px;border-collapse:separate">' +
        '<tr><td align="right" valign="top" height="76" style="height:76px;padding:12px 12px 0"><img src="' + e(stampImage(d)) + '" width="140" height="76" alt="" style="display:block;border:0;width:140px;height:auto"></td></tr>' +
        '<tr><td align="center" valign="middle" style="padding:0 20px 30px;font-family:' + D + ';font-style:italic;font-size:23px;line-height:1.25;color:' + INK + '">' + e(g.name) + '</td></tr>' +
        '</table></a></td></tr>' +
        '<tr><td align="center" style="padding:0 24px 34px"><a href="' + e(link) + '" style="display:inline-block;background:' + ENV + ';color:' + INK +
        ';padding:15px 30px;border-radius:6px;text-decoration:none;font-family:' + S + ';font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">Open your invitation</a></td></tr>' +
        (details ? '<tr><td style="background:' + ENV + ';padding:30px 32px 32px;text-align:center">' + details + '</td></tr>' : '') +
        '</table>' +
        '<p style="text-align:center;font-family:' + S + ';font-size:12px;color:' + SOFT + ';margin:16px 0 0">' + e(d.text.title || '') + (d.text.hostNames ? ' · ' + e(d.text.hostNames) : '') + '</p>' +
        '</div>';
      var text = message + '\n\nOpen your invitation: ' + link;
      return { subject: subject, html: html, text: text };
    }

    function hostEmails(ev, d) {
      var keys = hostKeys(ev);
      var list = store.all('Hosts').filter(function (h) { return keys.indexOf(h.key) >= 0 && h.email; })
        .map(function (h) { return h.email; });
      str(d.settings.cohostEmails).split(/[\s,;]+/).forEach(function (x) { if (x && list.indexOf(x) < 0) list.push(x); });
      return list;
    }

    function notifyHosts(ev, d, g, changed) {
      if (!d.settings.notifyHosts) return;
      var to = hostEmails(ev, d);
      if (!to.length) return;
      var c = counts(guestsOf(ev.id));
      var verb = g.status === 'yes' ? 'accepted' : g.status === 'maybe' ? 'said maybe' : 'declined';
      var party = g.status === 'yes' || g.status === 'maybe' ? ' (' + int(g.adults, 1) + ' adult' + (int(g.adults, 1) === 1 ? '' : 's') +
        (int(g.kids, 0) ? ', ' + int(g.kids, 0) + ' kid' + (int(g.kids, 0) === 1 ? '' : 's') : '') + ')' : '';
      var lines = [
        g.name + (changed ? ' changed their reply: ' : ' ') + verb + party + '.',
        g.answer ? (d.settings.customQuestion || 'Answer') + ': ' + g.answer : '',
        g.note ? 'Note: ' + g.note : '',
        '',
        'So far: ' + c.total + ' attending (' + c.adults + ' adults, ' + c.kids + ' kids), ' + c.no + ' declined, ' + (c.maybe ? c.maybe + ' maybe, ' : '') + c.pending + ' awaiting.',
        '',
        'See all replies: ' + base() + '/host.html#/e/' + ev.id
      ].filter(function (l, i) { return l !== '' || i === 3 || i === 5; });
      try {
        svc.sendEmail({
          to: to.join(','), subject: g.name + ' ' + verb + ': ' + (d.text.title || 'your event'),
          text: lines.join('\n'), html: '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' +
            lines.map(function (l) { return fmt.esc(l); }).join('<br>') + '</div>'
        });
      } catch (err) { log(ev.id, g.id, 'notify_failed', String(err && err.message || err)); }
    }

    function sendBatch(ev, d, kind, guests, overrides, resend) {
      var today = svc.today();
      var res = { sent: 0, skipped: 0, skippedIds: [], quota: 0, textOnly: [], errors: [] };
      var replyTo = hostEmails(ev, d)[0] || '';
      guests.forEach(function (g) {
        var sends = json(g.sends, {});
        if (!g.email) {
          res.textOnly.push({ id: g.id, name: g.name, mobile: g.mobile, link: guestLink(ev, d, g) });
          return;
        }
        // Never the same email twice in a day, unless the host explicitly asks to send again.
        if (sends[kind] === today && !resend) { res.skipped++; res.skippedIds.push(g.id); return; }
        if (svc.emailQuota() <= 0) { res.quota++; return; }
        var m = buildEmail(kind, ev, d, g, overrides);
        try {
          svc.sendEmail({ to: g.email, subject: m.subject, html: m.html, text: m.text, name: d.text.hostNames || '', replyTo: replyTo });
        } catch (err) {
          res.errors.push(g.name + ': ' + (err && err.message || err));
          return;
        }
        sends[kind] = today;
        var patch = { sends: JSON.stringify(sends) };
        if (kind === 'invite') { patch.invitedAt = svc.now(); patch.inviteVia = 'email'; }
        if (kind === 'reminder') patch.remindedAt = svc.now();
        store.update('Guests', 'id', g.id, patch);
        log(ev.id, g.id, 'sent_' + kind, g.email);
        res.sent++;
      });
      return res;
    }

    /* ----- guest actions ----- */

    var actions = {};

    actions['invite.get'] = function (req) {
      var ev = findEvent(str(req.e));
      if (!ev) throw fail('not_found');
      var d = dataOf(ev), guest = null;
      if (req.g) {
        guest = findGuest(str(req.g));
        if (!guest || guest.eventId !== ev.id) throw fail('not_found');
        if (!guest.openedAt && !req.preview) store.update('Guests', 'id', guest.id, { openedAt: svc.now() });
      } else if (!d.settings.openLink) {
        throw fail('not_found');
      }
      return {
        event: publicEvent(ev, d, guest),
        guest: guest ? publicGuest(guest) : null,
        attendees: d.settings.showGuestList ? attendees(ev.id) : null
      };
    };

    actions['invite.reply'] = function (req) {
      var ev = findEvent(str(req.e));
      if (!ev) throw fail('not_found');
      var d = dataOf(ev);
      if (req.hp) return { guestId: '', guest: null }; // honeypot: quietly ignore bots
      var why = closedReason(ev, d);
      if (why) throw fail('closed', why === 'past' ? 'This event has already happened.' : 'Replies are closed for this event.');
      var attending = ['yes', 'no', 'maybe'].indexOf(req.attending) >= 0 ? req.attending : '';
      if (attending === 'maybe' && d.settings.allowMaybe === false) attending = '';
      if (!attending) throw fail('invalid', 'Please choose whether you can attend.');
      var name = str(req.name, 100);
      if (!name) throw fail('invalid', 'Please enter your name.');
      var adults = 0, kids = 0;
      if (attending === 'yes' || attending === 'maybe') {
        adults = int(req.adults, 1); kids = int(req.kids, 0);
        if (adults < 1) throw fail('invalid', 'Please count at least one adult.');
        if (kids < 0) kids = 0;
        if (adults + kids > MAX_PARTY) throw fail('invalid', 'Please keep your party to ' + MAX_PARTY + ' people or fewer.');
      }
      var patch = {
        name: name, status: attending, adults: String(adults), kids: String(kids),
        answer: d.settings.customQuestion ? str(req.answer, 1000) : '',
        note: str(req.note, 1000), repliedAt: svc.now()
      };
      var guest, changed = false;
      if (req.g) {
        guest = findGuest(str(req.g));
        if (!guest || guest.eventId !== ev.id) throw fail('not_found');
        changed = ['yes', 'no', 'maybe'].indexOf(guest.status) >= 0;
        store.update('Guests', 'id', guest.id, patch);
      } else {
        if (!d.settings.openLink) throw fail('not_found');
        var contact = str(req.contact, 200);
        var email = '', mobile = '';
        if (isEmail(contact)) email = contact.toLowerCase();
        else if (isPhone(contact)) mobile = contact;
        else throw fail('invalid', 'Please enter a valid email or mobile number.');
        if (svc.rateOk && !svc.rateOk('reply:' + ev.id)) throw fail('busy', 'Too many replies right now. Please try again in a minute.');
        var digits = function (s) { return String(s || '').replace(/\D/g, ''); };
        guest = guestsOf(ev.id).filter(function (g) {
          return (email && String(g.email).toLowerCase() === email) || (mobile && digits(g.mobile) === digits(mobile));
        })[0];
        if (guest) {
          changed = ['yes', 'no', 'maybe'].indexOf(guest.status) >= 0;
          store.update('Guests', 'id', guest.id, patch);
        } else {
          guest = {
            id: svc.random(16), eventId: ev.id, email: email, mobile: mobile, source: 'open',
            invitedAt: '', inviteVia: '', openedAt: svc.now(), remindedAt: '', sends: '', createdAt: svc.now()
          };
          Object.keys(patch).forEach(function (k) { guest[k] = patch[k]; });
          store.insert('Guests', guest);
        }
      }
      guest = findGuest(guest.id);
      log(ev.id, guest.id, changed ? 'reply_changed' : 'reply', attending + ' ' + adults + '+' + kids);
      notifyHosts(ev, d, guest, changed);
      return {
        guestId: guest.id,
        guest: publicGuest(guest),
        event: publicEvent(ev, d, guest),
        attendees: d.settings.showGuestList ? attendees(ev.id) : null
      };
    };

    /* ----- host actions ----- */

    function summary(ev) {
      var d = dataOf(ev);
      return {
        id: ev.id, title: d.text.title, date: d.date, startTime: d.startTime, theme: d.theme, status: ev.status,
        closed: closedReason(ev, d), counts: counts(guestsOf(ev.id))
      };
    }

    actions['host.me'] = function (req) {
      var h = auth(req), today = svc.today();
      var list = events().filter(function (ev) { return isOwner(h) || hostKeys(ev).indexOf(h.key) >= 0; }).map(summary);
      var up = list.filter(function (s) { return s.date >= today; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
      var past = list.filter(function (s) { return s.date < today; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
      return { host: { name: h.name, email: h.email, role: h.role }, upcoming: up, past: past, today: today, version: VERSION,
        codeVersion: typeof CODE_VERSION_GS !== 'undefined' ? CODE_VERSION_GS : '' };
    };

    function hostGuest(ev, d, g) {
      var o = publicGuest(g);
      o.email = g.email || ''; o.mobile = g.mobile || ''; o.source = g.source || 'list';
      o.repliedAt = g.repliedAt || ''; o.invitedAt = g.invitedAt || ''; o.inviteVia = g.inviteVia || '';
      o.openedAt = g.openedAt || ''; o.remindedAt = g.remindedAt || '';
      o.link = guestLink(ev, d, g);
      return o;
    }

    actions['host.event'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), d = dataOf(ev);
      var keys = hostKeys(ev);
      var out = {
        event: { id: ev.id, status: ev.status, closed: closedReason(ev, d), data: d, openLink: d.settings.openLink ? guestLink(ev, d, null) : '' },
        guests: guestsOf(ev.id).map(function (g) { return hostGuest(ev, d, g); }),
        counts: counts(guestsOf(ev.id)),
        hosts: store.all('Hosts').filter(function (x) { return keys.indexOf(x.key) >= 0; }).map(function (x) { return { name: x.name, email: x.email }; })
      };
      if (isOwner(h)) {
        out.allHosts = store.all('Hosts').map(function (x) { return { key: x.key, name: x.name, role: x.role, assigned: keys.indexOf(x.key) >= 0 }; });
      }
      return out;
    };

    actions['host.saveEvent'] = function (req) {
      var h = auth(req), input = req.event || {};
      var d = normalizeData(input.data);
      validateData(d);
      var now = svc.now(), ev;
      if (input.id) {
        ev = eventFor(h, str(input.id));
        var patch = { title: d.text.title, date: d.date, theme: d.theme, data: JSON.stringify(d), updatedAt: now };
        if (isOwner(h) && Array.isArray(input.hostKeys)) patch.hostKeys = cleanKeys(input.hostKeys, h).join(',');
        store.update('Events', 'id', ev.id, patch);
        return { id: ev.id };
      }
      var keys = isOwner(h) && Array.isArray(input.hostKeys) ? cleanKeys(input.hostKeys, h) : [h.key];
      ev = { id: svc.random(8), title: d.text.title, date: d.date, theme: d.theme, status: 'open', hostKeys: keys.join(','), data: JSON.stringify(d), createdAt: now, updatedAt: now };
      store.insert('Events', ev);
      log(ev.id, '', 'event_created', h.name);
      return { id: ev.id };
    };

    function cleanKeys(keys, h) {
      var valid = store.all('Hosts').map(function (x) { return x.key; });
      var out = keys.filter(function (k) { return valid.indexOf(k) >= 0; });
      if (!out.length) out = [h.key];
      return out.filter(function (k, i) { return out.indexOf(k) === i; });
    }

    actions['host.setStatus'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e));
      var status = req.status === 'closed' ? 'closed' : 'open';
      store.update('Events', 'id', ev.id, { status: status, updatedAt: svc.now() });
      return { status: status };
    };

    actions['host.duplicateEvent'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), now = svc.now();
      var d = dataOf(ev);
      var copyEv = { id: svc.random(8), title: d.text.title, date: d.date, theme: d.theme, status: 'open', hostKeys: ev.hostKeys, data: JSON.stringify(d), createdAt: now, updatedAt: now };
      store.insert('Events', copyEv);
      if (req.withGuests) {
        guestsOf(ev.id).filter(function (g) { return g.source !== 'open' || g.status === 'yes'; }).forEach(function (g) {
          store.insert('Guests', blankGuest(copyEv.id, g.name, g.email, g.mobile));
        });
      }
      return { id: copyEv.id };
    };

    actions['host.deleteEvent'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e));
      guestsOf(ev.id).forEach(function (g) { store.remove('Guests', 'id', g.id); });
      store.remove('Events', 'id', ev.id);
      log(ev.id, '', 'event_deleted', h.name);
      return {};
    };

    function blankGuest(eventId, name, email, mobile) {
      return {
        id: svc.random(16), eventId: eventId, name: name, email: email || '', mobile: mobile || '', source: 'list',
        status: 'pending', adults: '', kids: '', answer: '', note: '', repliedAt: '', invitedAt: '', inviteVia: '',
        openedAt: '', remindedAt: '', sends: '', createdAt: svc.now()
      };
    }

    function checkContact(name, email, mobile) {
      if (!name) throw fail('invalid', 'Each guest needs a name.');
      if (!email && !mobile) throw fail('invalid', name + ' needs an email or a mobile number.');
      if (email && !isEmail(email)) throw fail('invalid', 'Email not valid for ' + name + ': ' + email);
      if (mobile && !isPhone(mobile)) throw fail('invalid', 'Mobile number not valid for ' + name + ': ' + mobile);
    }

    actions['host.saveGuest'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), d = dataOf(ev), g = req.guest || {};
      var name = str(g.name, 100), email = str(g.email, 200).toLowerCase(), mobile = str(g.mobile, 40);
      checkContact(name, email, mobile);
      var patch = { name: name, email: email, mobile: mobile };
      if (['yes', 'no', 'maybe', 'pending'].indexOf(g.status) >= 0) {
        patch.status = g.status;
        if (g.status === 'yes' || g.status === 'maybe') {
          var a = Math.max(1, int(g.adults, 1)), k = Math.max(0, int(g.kids, 0));
          if (a + k > MAX_PARTY) throw fail('invalid', 'Party size can be at most ' + MAX_PARTY + '.');
          patch.adults = String(a); patch.kids = String(k);
        }
        if (g.status !== 'pending') patch.repliedAt = svc.now();
      }
      var row;
      if (g.id) {
        row = findGuest(str(g.id));
        if (!row || row.eventId !== ev.id) throw fail('not_found', 'Guest not found.');
        store.update('Guests', 'id', row.id, patch);
      } else {
        row = blankGuest(ev.id, name, email, mobile);
        Object.keys(patch).forEach(function (k2) { row[k2] = patch[k2]; });
        store.insert('Guests', row);
      }
      return { guest: hostGuest(ev, d, findGuest(row.id)) };
    };

    actions['host.addGuests'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e));
      var parsed = parseGuestLines(req.text), added = 0;
      var existing = guestsOf(ev.id), rows = [];
      parsed.guests.forEach(function (g) {
        var dup = existing.filter(function (x) { return (g.email && x.email === g.email) || (g.mobile && x.mobile === g.mobile); })[0];
        if (dup) { parsed.errors.push({ line: g.line, message: g.name + ' is already on the list.' }); return; }
        var row = blankGuest(ev.id, g.name, g.email, g.mobile);
        rows.push(row);
        existing.push(row);
      });
      // One write for the whole list (a Sheet write per guest is slow).
      if (store.insertMany) store.insertMany('Guests', rows);
      else rows.forEach(function (r) { store.insert('Guests', r); });
      added = rows.length;
      return { added: added, errors: parsed.errors };
    };

    actions['host.removeGuest'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), g = findGuest(str(req.g));
      if (!g || g.eventId !== ev.id) throw fail('not_found', 'Guest not found.');
      store.remove('Guests', 'id', g.id);
      return {};
    };

    actions['host.send'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), d = dataOf(ev);
      var kind = ['invite', 'reminder', 'daybefore'].indexOf(req.kind) >= 0 ? req.kind : '';
      if (!kind) throw fail('invalid', 'Unknown message type.');
      var ids = Array.isArray(req.ids) ? req.ids : [];
      if (!ids.length) throw fail('invalid', 'Choose at least one guest.');
      var list = guestsOf(ev.id).filter(function (g) { return ids.indexOf(g.id) >= 0; });
      var res = sendBatch(ev, d, kind, list, { subject: str(req.subject, 300), message: str(req.message, 4000) }, req.resend === true);
      log(ev.id, '', 'batch_' + kind, h.name + ': ' + res.sent + ' sent');
      return res;
    };

    actions['host.markTexted'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), g = findGuest(str(req.g));
      if (!g || g.eventId !== ev.id) throw fail('not_found', 'Guest not found.');
      var patch = req.kind === 'reminder' ? { remindedAt: svc.now() } : { invitedAt: svc.now(), inviteVia: 'text' };
      store.update('Guests', 'id', g.id, patch);
      log(ev.id, g.id, 'texted_' + (req.kind || 'invite'), g.mobile);
      return {};
    };

    actions['host.previewEmail'] = function (req) {
      var h = auth(req), ev = eventFor(h, str(req.e)), d = dataOf(ev);
      var kind = ['invite', 'reminder', 'daybefore'].indexOf(req.kind) >= 0 ? req.kind : 'invite';
      var g = guestsOf(ev.id)[0] || { id: 'preview', name: 'Priya Sharma' };
      return buildEmail(kind, ev, d, g, { subject: str(req.subject, 300), message: str(req.message, 4000) });
    };

    /* ----- hosts (owner only) ----- */

    function owner(req) {
      var h = auth(req);
      if (!isOwner(h)) throw fail('forbidden', 'Only the owner can manage hosts.');
      return h;
    }
    function hostOut(x) { return { key: x.key, name: x.name, email: x.email, role: x.role, link: hostLink(x) }; }

    actions['host.hosts'] = function (req) {
      owner(req);
      return { hosts: store.all('Hosts').map(hostOut) };
    };

    actions['host.saveHost'] = function (req) {
      owner(req);
      var x = req.host || {}, name = str(x.name, 100), email = str(x.email, 200).toLowerCase();
      if (!name) throw fail('invalid', 'The host needs a name.');
      if (email && !isEmail(email)) throw fail('invalid', 'That email is not valid.');
      if (x.key) {
        if (!findHost(x.key)) throw fail('not_found', 'Host not found.');
        store.update('Hosts', 'key', x.key, { name: name, email: email });
        return { host: hostOut(findHost(x.key)) };
      }
      var row = { key: svc.random(32), name: name, email: email, role: 'host', createdAt: svc.now() };
      store.insert('Hosts', row);
      return { host: hostOut(row) };
    };

    actions['host.resetHostKey'] = function (req) {
      var me = owner(req), x = findHost(str(req.key));
      if (!x) throw fail('not_found', 'Host not found.');
      var nk = svc.random(32);
      store.update('Hosts', 'key', x.key, { key: nk });
      events().forEach(function (ev) {
        var ks = hostKeys(ev);
        if (ks.indexOf(x.key) >= 0) store.update('Events', 'id', ev.id, { hostKeys: ks.map(function (k) { return k === x.key ? nk : k; }).join(',') });
      });
      var out = hostOut(findHost(nk));
      out.self = x.key === me.key;
      return { host: out };
    };

    actions['host.removeHost'] = function (req) {
      var me = owner(req), x = findHost(str(req.key));
      if (!x) throw fail('not_found', 'Host not found.');
      if (x.key === me.key || x.role === 'owner') throw fail('invalid', 'The owner cannot be removed.');
      store.remove('Hosts', 'key', x.key);
      events().forEach(function (ev) {
        var ks = hostKeys(ev);
        if (ks.indexOf(x.key) >= 0) store.update('Events', 'id', ev.id, { hostKeys: ks.filter(function (k) { return k !== x.key; }).join(',') || me.key });
      });
      return {};
    };

    /* ----- entry points ----- */

    function handle(req) {
      req = req || {};
      var fn = actions[req.action];
      try {
        if (!fn) throw fail('unknown_action', 'Unknown action.');
        var out = fn(req) || {};
        out.ok = true;
        return out;
      } catch (err) {
        if (err && err.code) return { ok: false, error: err.code, message: err.message };
        return { ok: false, error: 'server', message: String(err && err.message || err) };
      }
    }

    // Run once a day: automatic reminders (S5) and day-before emails (S6).
    function daily() {
      var today = svc.today(), report = [];
      events().forEach(function (ev) {
        if (ev.status !== 'open') return;
        var d = dataOf(ev), gs = guestsOf(ev.id);
        var n = d.settings.autoRemindDays;
        if (n > 0 && d.rsvpBy && addDays(d.rsvpBy, -n) === today) {
          var pend = gs.filter(function (g) { return (g.status || 'pending') === 'pending' && g.invitedAt; });
          report.push({ event: ev.id, kind: 'reminder', result: sendBatch(ev, d, 'reminder', pend) });
        }
        if (d.settings.dayBeforeEmail && addDays(d.date, -1) === today) {
          var yes = gs.filter(function (g) { return g.status === 'yes'; });
          report.push({ event: ev.id, kind: 'daybefore', result: sendBatch(ev, d, 'daybefore', yes) });
        }
      });
      return report;
    }

    return { handle: handle, daily: daily, buildEmail: buildEmail };
  }

  // "Name, email or mobile[, the other]" per line; tabs work too (pasted from a spreadsheet).
  function parseGuestLines(text) {
    var guests = [], errors = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var parts = line.split(/\t|,|;/).map(function (p) { return p.trim(); }).filter(Boolean);
      var name = '', email = '', mobile = '';
      parts.forEach(function (p) {
        if (!email && isEmail(p)) email = p.toLowerCase();
        else if (!mobile && isPhone(p)) mobile = p;
        else if (!name) name = p;
        else name += ' ' + p;
      });
      if (!name) errors.push({ line: i + 1, message: 'Line ' + (i + 1) + ' has no name.' });
      else if (!email && !mobile) errors.push({ line: i + 1, message: name + ' needs an email or a mobile number.' });
      else guests.push({ line: i + 1, name: name, email: email, mobile: mobile });
    });
    return { guests: guests, errors: errors };
  }

  return {
    VERSION: VERSION, CODE_VERSION: CODE_VERSION, TABLES: TABLES, THEMES: THEMES, paletteOf: paletteOf, MAX_PARTY: MAX_PARTY, EMAIL_DEFAULTS: EMAIL_DEFAULTS,
    SETTINGS_DEFAULTS: SETTINGS_DEFAULTS, fmt: fmt, addDays: addDays, parseYmd: parseYmd,
    normalizeData: normalizeData, parseGuestLines: parseGuestLines, isEmail: isEmail, isPhone: isPhone,
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = InviteCore;
