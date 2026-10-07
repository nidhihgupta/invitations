// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../backend/core.js');

function memStore() {
  const db = {};
  const t = (n) => (db[n] = db[n] || []);
  return {
    db,
    all: (n) => JSON.parse(JSON.stringify(t(n))),
    insert: (n, o) => { t(n).push(JSON.parse(JSON.stringify(o))); return o; },
    update: (n, f, id, p) => { const r = t(n).find((x) => x[f] === id); if (!r) return null; Object.keys(p).forEach((k) => { r[k] = String(p[k]); }); return r; },
    remove: (n, f, id) => { db[n] = t(n).filter((x) => x[f] !== id); return true; }
  };
}

function setup(today = '2026-10-05') {
  const store = memStore();
  const sent = [];
  let n = 0;
  const svc = {
    siteUrl: 'https://example.github.io/invitations/',
    now: () => today + 'T12:00:00.000Z',
    today: () => today,
    random: (len) => ('r' + (++n)).padEnd(len, 'x'),
    emailQuota: () => 100,
    rateOk: () => true,
    sendEmail: (m) => sent.push(m)
  };
  store.insert('Hosts', { key: 'OWNER', name: 'Nidhi', email: 'nidhi@example.com', role: 'owner', createdAt: '' });
  const core = Core.create(store, svc);
  const call = (action, p) => core.handle(Object.assign({ action }, p));
  return { store, sent, svc, core, call };
}

const DATA = {
  theme: 'diwali', template: 'classic', colors: { ground: '#3A0F1E', accent: '#E6C77E' },
  text: { title: 'A Diwali Evening', hostNames: 'Nidhi & family', greeting: '' },
  date: '2026-11-07', startTime: '19:00', endTime: '23:00', venue: 'Home', address: '1 Lantern Ln', rsvpBy: '2026-10-31',
  settings: { customQuestion: 'Dietary needs?' }, email: {}
};

function makeEvent(t, extra) {
  const data = JSON.parse(JSON.stringify(DATA));
  Object.assign(data.settings, extra || {});
  const r = t.call('host.saveEvent', { k: 'OWNER', event: { data } });
  assert.ok(r.ok, r.message);
  return r.id;
}

test('event create, read, and validation', () => {
  const t = setup();
  const id = makeEvent(t);
  const ev = t.call('host.event', { k: 'OWNER', e: id });
  assert.ok(ev.ok);
  assert.strictEqual(ev.event.data.text.greeting, '', 'blank line stays blank');
  assert.strictEqual(ev.event.data.settings.openLink, true, 'open link on by default');
  assert.match(ev.event.openLink, /^https:\/\/example\.github\.io\/invitations\/diwali\.html\?e=/);
  const bad = t.call('host.saveEvent', { k: 'OWNER', event: { data: { text: { title: '' }, date: '2026-11-07' } } });
  assert.strictEqual(bad.error, 'invalid');
  assert.strictEqual(t.call('host.me', { k: 'nope' }).error, 'unauthorized');
});

test('personal link: open, reply, change reply, host notified', () => {
  const t = setup();
  const id = makeEvent(t);
  const g = t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'Priya Sharma', email: 'Priya@Example.com' } }).guest;
  assert.strictEqual(g.email, 'priya@example.com');
  const inv = t.call('invite.get', { e: id, g: g.id });
  assert.ok(inv.ok);
  assert.strictEqual(inv.guest.name, 'Priya Sharma');
  assert.strictEqual(inv.event.address, '1 Lantern Ln');
  assert.ok(t.store.all('Guests')[0].openedAt, 'opened is tracked');

  const r1 = t.call('invite.reply', { e: id, g: g.id, attending: 'yes', name: 'Priya S', adults: 2, kids: 1, answer: 'Veg', note: 'Yay' });
  assert.ok(r1.ok, r1.message);
  assert.strictEqual(r1.guest.status, 'yes');
  assert.deepStrictEqual(r1.attendees, [{ name: 'Priya S', count: 3 }]);
  assert.strictEqual(t.sent.length, 1);
  assert.match(t.sent[0].subject, /Priya S accepted/);
  assert.strictEqual(t.sent[0].to, 'nidhi@example.com');

  const r2 = t.call('invite.reply', { e: id, g: g.id, attending: 'no', name: 'Priya S' });
  assert.ok(r2.ok);
  assert.strictEqual(t.store.all('Guests').length, 1, 'change replaces, never duplicates');
  assert.match(t.sent[1].text, /changed their reply/);
  const c = t.call('host.event', { k: 'OWNER', e: id }).counts;
  assert.deepStrictEqual([c.yes, c.no, c.total], [0, 1, 0]);
});

test('reply validation and party limits', () => {
  const t = setup();
  const id = makeEvent(t);
  assert.strictEqual(t.call('invite.reply', { e: id, attending: 'perhaps', name: 'X', contact: 'x@y.co' }).error, 'invalid');
  assert.strictEqual(t.call('invite.reply', { e: id, attending: 'yes', name: '', contact: 'x@y.co' }).error, 'invalid');
  assert.strictEqual(t.call('invite.reply', { e: id, attending: 'yes', name: 'X', contact: 'nope' }).error, 'invalid');
  assert.strictEqual(t.call('invite.reply', { e: id, attending: 'yes', name: 'X', contact: 'x@y.co', adults: 8, kids: 3 }).error, 'invalid');
  assert.strictEqual(t.call('invite.reply', { e: id, attending: 'yes', name: 'X', contact: 'x@y.co', adults: 0, kids: 3 }).error, 'invalid');
  assert.ok(t.call('invite.reply', { e: id, attending: 'yes', name: 'X', contact: 'x@y.co', adults: 7, kids: 3 }).ok);
});

test('open link: mobile contact, dedupe by contact, honeypot, switch off', () => {
  const t = setup();
  const id = makeEvent(t);
  const a = t.call('invite.reply', { e: id, attending: 'yes', name: 'Ananya', contact: '+1 (408) 555-0142', adults: 1 });
  assert.ok(a.ok, a.message);
  const b = t.call('invite.reply', { e: id, attending: 'no', name: 'Ananya R', contact: '14085550142' });
  assert.strictEqual(b.guestId, a.guestId, 'same mobile updates the same reply');
  assert.strictEqual(t.store.all('Guests').length, 1);
  const bot = t.call('invite.reply', { e: id, attending: 'yes', name: 'Bot', contact: 'b@b.co', hp: 'http://spam' });
  assert.ok(bot.ok);
  assert.strictEqual(t.store.all('Guests').length, 1, 'honeypot reply is dropped');

  const id2 = makeEvent(t, { openLink: false });
  assert.strictEqual(t.call('invite.get', { e: id2 }).error, 'not_found');
  assert.strictEqual(t.call('invite.reply', { e: id2, attending: 'yes', name: 'X', contact: 'x@y.co' }).error, 'not_found');
});

test('address only after accepting; guest list toggle', () => {
  const t = setup();
  const id = makeEvent(t, { addressVisibility: 'accepted', showGuestList: false });
  const g = t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'Rohan', email: 'r@x.co' } }).guest;
  const inv = t.call('invite.get', { e: id, g: g.id });
  assert.strictEqual(inv.event.address, '');
  assert.strictEqual(inv.event.addressHidden, true);
  assert.strictEqual(inv.attendees, null);
  const r = t.call('invite.reply', { e: id, g: g.id, attending: 'yes', name: 'Rohan', adults: 2 });
  assert.strictEqual(r.event.address, '1 Lantern Ln');
});

test('closed and past events reject replies but still show', () => {
  const t = setup();
  const id = makeEvent(t);
  t.call('host.setStatus', { k: 'OWNER', e: id, status: 'closed' });
  assert.strictEqual(t.call('invite.get', { e: id }).event.closed, 'closed');
  assert.strictEqual(t.call('invite.reply', { e: id, attending: 'yes', name: 'X', contact: 'x@y.co' }).error, 'closed');
  const late = setup('2026-11-08');
  const id2 = makeEvent(late);
  assert.strictEqual(late.call('invite.reply', { e: id2, attending: 'yes', name: 'X', contact: 'x@y.co' }).error, 'closed');
  const afterRsvp = setup('2026-11-02');
  const id3 = makeEvent(afterRsvp);
  assert.ok(afterRsvp.call('invite.reply', { e: id3, attending: 'yes', name: 'X', contact: 'x@y.co' }).ok, 'replies after RSVP-by still accepted');
});

test('sending: email vs text-only, once per day, invite tracking', () => {
  const t = setup();
  const id = makeEvent(t);
  t.call('host.addGuests', { k: 'OWNER', e: id, text: 'Priya Sharma, priya@x.co\nAnanya Rao\t+1 408 555 0142\nNo Contact\n, x@y.co' });
  const ev = t.call('host.event', { k: 'OWNER', e: id });
  assert.strictEqual(ev.guests.length, 2);
  const ids = ev.guests.map((g) => g.id);
  const r = t.call('host.send', { k: 'OWNER', e: id, kind: 'invite', ids });
  assert.deepStrictEqual([r.sent, r.textOnly.length], [1, 1]);
  const mail = t.sent[0];
  assert.strictEqual(mail.subject, 'You’re invited: A Diwali Evening'.replace('’', "'"));
  assert.match(mail.html, /stamp-night-1-1\.png/, 'stamp follows the chosen colors');
  assert.match(mail.html, /Priya Sharma<\/td>/, 'the guest name is written on the envelope');
  assert.match(mail.html, /Dear Priya,/);
  assert.match(mail.html, /kindly reply by Saturday, October 31/);
  assert.match(mail.html, /diwali\.html\?e=/);
  const again = t.call('host.send', { k: 'OWNER', e: id, kind: 'invite', ids });
  assert.strictEqual(again.skipped, 1, 'never the same email twice in a day');
  assert.deepStrictEqual(again.skippedIds.length, 1);
  const forced = t.call('host.send', { k: 'OWNER', e: id, kind: 'invite', ids: again.skippedIds, resend: true });
  assert.strictEqual(forced.sent, 1, 'host can explicitly send again');
  const after = t.call('host.event', { k: 'OWNER', e: id }).guests.find((g) => g.email);
  assert.strictEqual(after.inviteVia, 'email');
  assert.ok(after.invitedAt);
});

test('daily job: auto reminder and day-before email', () => {
  const t = setup('2026-10-28');
  const id = makeEvent(t, { autoRemindDays: 3, dayBeforeEmail: true });
  const a = t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'A', email: 'a@x.co' } }).guest;
  t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'B', email: 'b@x.co' } });
  t.call('host.send', { k: 'OWNER', e: id, kind: 'invite', ids: [a.id] });
  t.sent.length = 0;
  const rep = t.core.daily();
  assert.strictEqual(rep[0].kind, 'reminder');
  assert.strictEqual(t.sent.length, 1, 'only invited, unreplied guests are reminded');
  assert.strictEqual(t.sent[0].to, 'a@x.co');

  const t2 = setup('2026-11-06');
  const id2 = makeEvent(t2, { dayBeforeEmail: true });
  const g = t2.call('host.saveGuest', { k: 'OWNER', e: id2, guest: { name: 'Y', email: 'y@x.co' } }).guest;
  t2.call('invite.reply', { e: id2, g: g.id, attending: 'yes', name: 'Y', adults: 1 });
  t2.sent.length = 0;
  t2.core.daily();
  assert.strictEqual(t2.sent.length, 1);
  assert.match(t2.sent[0].subject, /See you tomorrow/);
  assert.match(t2.sent[0].html, /View map/);
});

test('family hosts see only their events; owner manages hosts', () => {
  const t = setup();
  const mine = makeEvent(t);
  const mom = t.call('host.saveHost', { k: 'OWNER', host: { name: 'Mom', email: 'mom@x.co' } }).host;
  assert.match(mom.link, /host\.html#k=/);
  assert.strictEqual(t.call('host.me', { k: mom.key }).upcoming.length, 0);
  assert.strictEqual(t.call('host.event', { k: mom.key, e: mine }).error, 'not_found');
  assert.strictEqual(t.call('host.hosts', { k: mom.key }).error, 'forbidden');

  t.call('host.saveEvent', { k: 'OWNER', event: { id: mine, data: DATA, hostKeys: ['OWNER', mom.key] } });
  assert.strictEqual(t.call('host.me', { k: mom.key }).upcoming.length, 1);
  const theirs = t.call('host.saveEvent', { k: mom.key, event: { data: DATA } });
  assert.ok(theirs.ok);
  assert.strictEqual(t.call('host.me', { k: 'OWNER' }).upcoming.length, 2, 'owner sees everything');

  const reset = t.call('host.resetHostKey', { k: 'OWNER', key: mom.key }).host;
  assert.strictEqual(t.call('host.me', { k: mom.key }).error, 'unauthorized');
  assert.strictEqual(t.call('host.me', { k: reset.key }).upcoming.length, 2, 'new key keeps their events');
});

test('duplicate with guests resets replies', () => {
  const t = setup();
  const id = makeEvent(t);
  const g = t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'P', email: 'p@x.co' } }).guest;
  t.call('invite.reply', { e: id, g: g.id, attending: 'yes', name: 'P', adults: 2 });
  const copy = t.call('host.duplicateEvent', { k: 'OWNER', e: id, withGuests: true });
  const ev = t.call('host.event', { k: 'OWNER', e: copy.id });
  assert.strictEqual(ev.guests.length, 1);
  assert.strictEqual(ev.guests[0].status, 'pending');
  assert.notStrictEqual(ev.guests[0].id, g.id);
});

test('each card design keeps to its own swatches; emails follow the design', () => {
  const t = setup();
  const data = JSON.parse(JSON.stringify(DATA));
  data.template = 'arch';
  const id = t.call('host.saveEvent', { k: 'OWNER', event: { data } }).id;
  const d = t.call('host.event', { k: 'OWNER', e: id }).event.data;
  assert.deepStrictEqual(d.colors, { ground: '#FFF6E3', accent: '#F0B04F' }, 'night colors are replaced by arch defaults');
  data.colors = { ground: '#FCEBE2', accent: '#E8A48C' };
  t.call('host.saveEvent', { k: 'OWNER', event: { id, data } });
  const g = t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'P', email: 'p@x.co' } }).guest;
  t.call('host.send', { k: 'OWNER', e: id, kind: 'invite', ids: [g.id] });
  const html = t.sent[t.sent.length - 1].html;
  assert.match(html, /stamp-arch-1-2\.png/);
  assert.match(html, /background:#6B1F12;color:#FFF6E3/, 'light design uses a dark envelope and button');
  data.template = 'nope';
  t.call('host.saveEvent', { k: 'OWNER', event: { id, data } });
  assert.strictEqual(t.call('host.event', { k: 'OWNER', e: id }).event.data.template, 'classic', 'unknown design falls back');
});

test('formatting helpers', () => {
  assert.strictEqual(Core.fmt.date('2026-11-07'), 'Saturday, November 7, 2026');
  assert.strictEqual(Core.fmt.timeRange('19:00', '23:00'), '7:00 – 11:00 PM');
  assert.strictEqual(Core.fmt.timeRange('11:30', '14:00'), '11:30 AM – 2:00 PM');
  assert.strictEqual(Core.addDays('2026-10-31', -3), '2026-10-28');
  assert.strictEqual(Core.parseYmd('2026-02-30'), null);
});

test('maybe replies: counted separately, switchable per event', () => {
  const t = setup();
  const id = makeEvent(t);
  const a = t.call('host.saveGuest', { k: 'OWNER', e: id, guest: { name: 'Asha', email: 'a@x.co' } }).guest;
  const r = t.call('invite.reply', { e: id, g: a.id, attending: 'maybe', name: 'Asha', adults: 2, kids: 1 });
  assert.ok(r.ok, r.message);
  assert.strictEqual(r.guest.status, 'maybe');
  assert.deepStrictEqual(r.attendees, [], 'maybes are not listed as coming');
  assert.match(t.sent[0].subject, /Asha said maybe/);
  const c = t.call('host.event', { k: 'OWNER', e: id }).counts;
  assert.deepStrictEqual([c.maybe, c.maybeTotal, c.total], [1, 3, 0], 'not in the attending headcount');
  const id2 = makeEvent(t, { allowMaybe: false });
  assert.strictEqual(t.call('invite.get', { e: id2 }).event.settings.allowMaybe, false);
  assert.strictEqual(t.call('invite.reply', { e: id2, attending: 'maybe', name: 'X', contact: 'x@y.co' }).error, 'invalid');
});
