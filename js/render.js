/*
 * Guest-page markup shared by every theme (details, guest list, RSVP form, thank-you).
 * Themes style these classes in their own theme.css. Used by the guest page and the host preview.
 */
window.Render = (function () {
  var fmt = InviteCore.fmt, esc = fmt.esc;

  var ICON = {
    cal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };

  function details(ev, t) {
    var rows = [];
    if (ev.date) rows.push('<div class="row">' + ICON.cal + '<span>' + esc(fmt.date(ev.date)) + '</span></div>');
    if (ev.startTime) {
      var tr = ev.endTime ? fmt.timeRange(ev.startTime, ev.endTime) : fmt.time(ev.startTime) + ' onwards';
      rows.push('<div class="row">' + ICON.clock + '<span>' + esc(tr) + '</span></div>');
    }
    if (ev.venue || ev.address || ev.addressHidden) {
      var place = esc(ev.venue || '');
      if (ev.address) {
        place += (place ? '<br>' : '') + '<a href="' + esc(fmt.mapUrl(ev.address)) + '" target="_blank" rel="noopener">' + esc(ev.address) + '</a>';
      } else if (ev.addressHidden) {
        place += (place ? '<br>' : '') + '<em>The address is shared once you accept.</em>';
      }
      rows.push('<div class="row">' + ICON.pin + '<span>' + place + '</span></div>');
    }
    var fine = [t.dressCode ? t.dressCode.replace(/\.?$/, '.') : '', ev.rsvpBy ? 'RSVP by ' + fmt.monthDay(ev.rsvpBy) + '.' : ''].filter(Boolean).join(' ');
    if (fine) rows.push('<p>' + esc(fine) + '</p>');
    return rows.length ? '<div class="details">' + rows.join('') + '</div>' : '';
  }

  function who(list) {
    if (!list) return '';
    var n = list.reduce(function (s, a) { return s + a.count; }, 0);
    if (!list.length) return '';
    return '<section class="who" aria-label="Who is coming"><h2>Who’s coming</h2><p>' + n + (n === 1 ? ' guest' : ' guests') + ' so far</p><ul>' +
      list.map(function (a) {
        return '<li><span class="n">' + esc(a.name) + '</span><span class="c">' + a.count + (a.count === 1 ? ' guest' : ' guests') + '</span></li>';
      }).join('') + '</ul></section>';
  }

  // Thin gold rule with a small diamond in the middle, between sections.
  function sep() { return '<div class="sep" aria-hidden="true"><span></span><i></i><span></span></div>'; }

  function party(adults, kids) {
    var p = [];
    p.push(adults + (adults === 1 ? ' adult' : ' adults'));
    if (kids) p.push(kids + (kids === 1 ? ' child' : ' children'));
    return p.join(' and ');
  }

  function form(ev, t, guest, opts) {
    opts = opts || {};
    var g = guest || {}, att = opts.attending || (g.status === 'yes' || g.status === 'no' ? g.status : '');
    var adults = g.status === 'yes' ? g.adults : 1, kids = g.status === 'yes' ? g.kids : 0;
    var q = ev.settings && ev.settings.customQuestion;
    var open = !guest;
    return '<form class="rsvp" novalidate' + (opts.inert ? ' inert' : '') + '>' +
      (t.replyHeading ? '<h2>' + esc(t.replyHeading) + '</h2>' : '') +
      '<fieldset class="choice"><legend>Will you attend?</legend>' +
      '<button type="button" data-att="yes" aria-pressed="' + (att === 'yes') + '">' + esc(t.acceptLabel || 'Accepts') + '</button>' +
      '<button type="button" data-att="no" aria-pressed="' + (att === 'no') + '">' + esc(t.declineLabel || 'Declines') + '</button></fieldset>' +
      '<div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" value="' + esc(g.name || '') + '" aria-describedby="e-name"><div class="err" id="e-name"></div></div>' +
      (open ? '<div class="field"><label for="f-contact">Email or mobile number</label><input id="f-contact" name="contact" autocomplete="email" aria-describedby="e-contact"><div class="err" id="e-contact"></div></div>' : '') +
      '<div class="party"' + (att === 'yes' ? '' : ' hidden') + '>' +
      stepper('adults', 'Adults, including you', adults, 1) +
      stepper('kids', 'Children', kids, 0) + '</div>' +
      (q ? '<div class="field"><label for="f-answer">' + esc(q) + '</label><input id="f-answer" name="answer" value="' + esc(g.answer || '') + '"></div>' : '') +
      '<div class="field"><label for="f-note">A note for the hosts (optional)</label><textarea id="f-note" name="note" rows="3">' + esc(g.note || '') + '</textarea></div>' +
      '<div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<p class="form-error" role="alert" hidden></p>' +
      '<button class="send" type="submit">' + esc(t.sendLabel || 'Send reply') + '</button>' +
      '</form>';
  }

  function stepper(name, label, value, min) {
    return '<div class="stepper" data-stepper="' + name + '"><span class="lab" id="l-' + name + '">' + esc(label) + '</span><div>' +
      '<button type="button" data-step="-1" aria-label="Fewer ' + (name === 'kids' ? 'children' : 'adults') + '">−</button>' +
      '<output aria-labelledby="l-' + name + '" aria-live="polite" data-min="' + min + '">' + value + '</output>' +
      '<button type="button" data-step="1" aria-label="More ' + (name === 'kids' ? 'children' : 'adults') + '">+</button></div></div>';
  }

  function thanks(ev, t, guest, opts) {
    opts = opts || {};
    var yes = guest.status === 'yes';
    var summary = yes ? 'Your reply: attending, ' + party(guest.adults, guest.kids) + '.' : 'Your reply: not able to attend.';
    return '<div class="thanks" aria-live="polite">' +
      '<h2 tabindex="-1">' + esc(yes ? t.acceptTitle : t.declineTitle) + '</h2>' +
      '<p>' + esc(yes ? t.acceptBody : t.declineBody) + '</p>' +
      '<p class="summary">' + esc(summary) + '</p>' +
      (yes && opts.revealAddress && ev.address ? '<p class="summary">The address: <a href="' + esc(fmt.mapUrl(ev.address)) + '" target="_blank" rel="noopener" style="color:var(--gold)">' + esc(ev.address) + '</a></p>' : '') +
      '<div class="actions">' +
      (yes ? '<button type="button" class="ghost" data-act="ics">Add to calendar</button>' +
        '<a class="ghost" target="_blank" rel="noopener" href="' + esc(gcalUrl(ev, t)) + '">Google Calendar</a>' : '') +
      (opts.canChange ? '<button type="button" class="ghost" data-act="change">Change my reply</button>' : '') +
      '</div></div>';
  }

  function closed(ev, t, guest) {
    var msg = ev.closed === 'past' ? 'This celebration has passed. Thank you for being part of it.' :
      'Replies are now closed. If your plans have changed, please reach out to the hosts directly.';
    var mine = guest && (guest.status === 'yes' || guest.status === 'no') ?
      '<p class="summary">' + esc(guest.status === 'yes' ? 'Your reply: attending, ' + party(guest.adults, guest.kids) + '.' : 'Your reply: not able to attend.') + '</p>' : '';
    return '<div class="closed"><h2>' + (ev.closed === 'past' ? 'With thanks' : 'Replies are closed') + '</h2><p>' + esc(msg) + '</p>' + mine + '</div>';
  }

  /* ----- calendar ----- */

  function stamp(date, time) { return date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : ''); }
  function endOf(ev) {
    if (ev.endTime) {
      var next = ev.endTime <= ev.startTime ? InviteCore.addDays(ev.date, 1) : ev.date;
      return stamp(next, ev.endTime);
    }
    if (ev.startTime) {
      var h = (parseInt(ev.startTime, 10) + 3), d = ev.date;
      if (h >= 24) { h -= 24; d = InviteCore.addDays(ev.date, 1); }
      return stamp(d, String(h).padStart(2, '0') + ev.startTime.slice(2));
    }
    return stamp(InviteCore.addDays(ev.date, 1));
  }
  function place(ev) { return [ev.venue, ev.address].filter(Boolean).join(', '); }

  function gcalUrl(ev, t) {
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t.title || 'Invitation') +
      '&dates=' + stamp(ev.date, ev.startTime) + '/' + endOf(ev) +
      '&details=' + encodeURIComponent(location.href.split('#')[0]) + '&location=' + encodeURIComponent(place(ev));
  }

  function icsFile(ev, t) {
    function x(s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
    var allDay = !ev.startTime;
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitations//EN', 'BEGIN:VEVENT',
      'UID:' + ev.id + '@invitations', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      (allDay ? 'DTSTART;VALUE=DATE:' : 'DTSTART:') + stamp(ev.date, ev.startTime),
      (allDay ? 'DTEND;VALUE=DATE:' : 'DTEND:') + endOf(ev),
      'SUMMARY:' + x(t.title), 'LOCATION:' + x(place(ev)), 'DESCRIPTION:' + x(location.href.split('#')[0]),
      'END:VEVENT', 'END:VCALENDAR'];
    return lines.join('\r\n');
  }

  function downloadIcs(ev, t) {
    var blob = new Blob([icsFile(ev, t)], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (t.title || 'invitation').replace(/[^\w]+/g, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  return { details: details, who: who, sep: sep, form: form, thanks: thanks, closed: closed, party: party, downloadIcs: downloadIcs, gcalUrl: gcalUrl };
})();
