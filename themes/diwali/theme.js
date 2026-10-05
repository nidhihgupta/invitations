/*
 * Theme 1: Diwali — "Midnight & Marigold".
 * Artwork is rebuilt from the approved design reference (same coordinates and math).
 * Gold follows var(--gold) through currentColor; the background follows var(--ground).
 */
(function () {
  var fmt = InviteCore.fmt, esc = fmt.esc;

  /* ---------- motifs ---------- */

  function lantern(x, len, s) {
    return '<g transform="translate(' + x + ' 0)"><line x1="0" y1="0" x2="0" y2="' + len + '" stroke="currentColor" stroke-width="0.8"/>' +
      '<g transform="translate(0 ' + len + ') scale(' + s + ')">' +
      '<path d="M-6 0 L6 0 L4 4 L-4 4 Z" fill="currentColor"/>' +
      '<path d="M0 4 L14 22 L0 46 L-14 22 Z" fill="#E39B2C" fill-opacity="0.85" stroke="currentColor" stroke-width="1.2"/>' +
      '<path d="M0 4 L0 46 M-14 22 L14 22" stroke="currentColor" stroke-width="0.7"/>' +
      '<line x1="0" y1="46" x2="0" y2="62" stroke="currentColor" stroke-width="1"/>' +
      '<circle cx="0" cy="64" r="2.4" fill="currentColor"/></g></g>';
  }

  var PETAL = 'M0 -128 C 11 -113, 11 -97, 0 -84 C -11 -97, -11 -113, 0 -128 Z';
  var INNER = 'M0 -70 C 15 -57, 15 -43, 0 -34 C -15 -43, -15 -57, 0 -70 Z';

  function r1(n) { return Math.round(n * 100) / 100; }

  function mandala(cx, cy, s) {
    var o = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1(140 * s) + '" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1(133 * s) + '" fill="none" stroke="currentColor" stroke-width="0.6" stroke-dasharray="2 5"/>';
    for (var i = 0; i < 16; i++) {
      var a = i * 22.5;
      o += '<path transform="translate(' + cx + ' ' + cy + ') rotate(' + a + ') scale(' + s + ')" d="' + PETAL + '" fill="none" stroke="currentColor" stroke-width="1"/>';
      o += '<circle transform="translate(' + cx + ' ' + cy + ') rotate(' + (a + 11.25) + ') scale(' + s + ')" cx="0" cy="-118" r="2.2" fill="currentColor"/>';
    }
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1(82 * s) + '" fill="none" stroke="currentColor" stroke-width="0.8"/>';
    for (var k = 0; k < 32; k++) {
      var t = k * Math.PI / 16, r = 76 * s;
      o += '<circle cx="' + r1(cx + r * Math.sin(t)) + '" cy="' + r1(cy - r * Math.cos(t)) + '" r="1.5" fill="currentColor"/>';
    }
    for (var j = 0; j < 8; j++) {
      o += '<path transform="translate(' + cx + ' ' + cy + ') rotate(' + (22.5 + j * 45) + ') scale(' + s + ')" d="' + INNER + '" fill="currentColor" fill-opacity="0.10" stroke="currentColor" stroke-width="1"/>';
    }
    return o;
  }

  // Centered on (cx, cy): at scale 1 the reference places it at translate(cx-60, cy-38).
  function diya(cx, cy, s) {
    return '<g transform="translate(' + r1(cx - 60 * s) + ' ' + r1(cy - 38 * s) + ') scale(' + s + ')">' +
      '<circle cx="60" cy="40" r="34" fill="#F2B544" fill-opacity="0.10"/>' +
      '<circle cx="60" cy="40" r="22" fill="#F2B544" fill-opacity="0.12"/>' +
      '<path d="M60 10 C 72 26, 72 40, 60 50 C 48 40, 48 26, 60 10 Z" fill="#F2B544"/>' +
      '<path d="M60 26 C 65 34, 65 41, 60 47 C 55 41, 55 34, 60 26 Z" fill="#FFE9B0"/>' +
      '<path d="M12 54 C 22 86, 98 86, 108 54 Z" fill="#B8571C" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M104 54 Q 116 50 122 42 L 108 54 Z" fill="#B8571C" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M24 62 C 40 74, 80 74, 96 62" fill="none" stroke="currentColor" stroke-width="0.9" stroke-dasharray="1 4" stroke-linecap="round"/>' +
      '<ellipse cx="60" cy="54" rx="48" ry="5" fill="#7A3412" stroke="currentColor" stroke-width="1.2"/></g>';
  }

  var LEAF = 'M0 0 C 7 10, 7 22, 0 32 C -7 22, -7 10, 0 0 Z';

  // Five swags of marigolds, 632 units wide, with leaf drops at each joint.
  function toran(x, y, s) {
    var w = 126.4, o = '<g transform="translate(' + x + ' ' + y + ')' + (s && s !== 1 ? ' scale(' + s + ')' : '') + '">';
    for (var k = 0; k < 5; k++) {
      for (var i = 0; i < 12; i++) {
        o += '<circle cx="' + r1(k * w + i * w / 11) + '" cy="' + r1(24 * Math.sin(Math.PI * i / 11)) + '" r="7" fill="' + (i % 2 ? '#C8601E' : '#E39B2C') + '"/>';
      }
      o += '<path transform="translate(' + r1(k * w) + ' 0)" d="' + LEAF + '" fill="#3E6B3A" stroke="currentColor" stroke-width="0.8"/>';
    }
    o += '<path transform="translate(632 0)" d="' + LEAF + '" fill="#3E6B3A" stroke="currentColor" stroke-width="0.8"/>';
    return o + '</g>';
  }

  var FRAME = '<rect x="26" y="26" width="648" height="928" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<rect x="34" y="34" width="632" height="912" fill="none" stroke="currentColor" stroke-width="0.6"/>';

  function ornament(cy) {
    return '<g><path d="M230 ' + cy + ' H330 M370 ' + cy + ' H470" stroke="currentColor" stroke-width="0.8"/>' +
      '<path d="M350 ' + (cy - 10) + ' L360 ' + cy + ' L350 ' + (cy + 10) + ' L340 ' + cy + ' Z" fill="none" stroke="currentColor" stroke-width="1"/>' +
      '<circle cx="350" cy="' + cy + '" r="2.4" fill="currentColor"/>' +
      '<circle cx="220" cy="' + cy + '" r="1.6" fill="currentColor"/><circle cx="480" cy="' + cy + '" r="1.6" fill="currentColor"/></g>';
  }

  /* ---------- templates (T6) ---------- */

  var TEMPLATES = {
    classic: {
      name: 'Lanterns & Mandala',
      note: 'The approved design: hanging kandils, rangoli mandala with a diya, marigold toran.',
      cardArt: function () {
        return FRAME + lantern(120, 70, 0.9) + lantern(200, 120, 1) + lantern(500, 120, 1) + lantern(580, 70, 0.9) +
          mandala(350, 330, 0.95) + diya(350, 330, 1) + toran(34, 850);
      },
      cardTop: '49.8%',
      heroBox: '0 0 390 420',
      heroArt: function () {
        return lantern(60, 50, 0.75) + lantern(110, 90, 0.85) + lantern(280, 90, 0.85) + lantern(330, 50, 0.75) +
          mandala(195, 250, 0.92) + diya(195, 250, 1);
      }
    },
    mandala: {
      name: 'Rangoli Moon',
      note: 'Quieter: one large mandala and diya, fine gold ornaments, no garland.',
      cardArt: function () {
        return FRAME + ornament(84) + mandala(350, 300, 1.12) + diya(350, 300, 1.15) + ornament(892);
      },
      cardTop: '51.5%',
      heroBox: '0 0 390 360',
      heroArt: function () { return mandala(195, 190, 1.0) + diya(195, 190, 1.05); }
    },
    toran: {
      name: 'Marigold Toran',
      note: 'Festive: garlands top and bottom with a row of three diyas.',
      cardArt: function () {
        return FRAME + toran(34, 40) + diya(200, 300, 1.0) + diya(350, 282, 1.35) + diya(500, 300, 1.0) +
          '<path d="M140 380 Q350 412 560 380" fill="none" stroke="currentColor" stroke-width="0.6" stroke-dasharray="2 5"/>' +
          toran(34, 850);
      },
      cardTop: '44.5%',
      heroBox: '0 0 390 230',
      heroArt: function () {
        return toran(21, 10, 0.55) + diya(92, 152, 0.7) + diya(195, 140, 0.92) + diya(298, 152, 0.7);
      }
    }
  };

  function tpl(ev) { return TEMPLATES[ev && ev.template] || TEMPLATES.classic; }

  /* ---------- pieces ---------- */

  var ENVELOPE_SVG =
    '<svg viewBox="0 0 700 480" aria-hidden="true">' +
    '<rect x="40" y="40" width="620" height="400" class="g"/>' +
    '<path d="M40 440 L350 250 L660 440" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1"/>' +
    '<g class="flap"><path d="M40 40 L350 262 L660 40 Z" class="g" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M58 48 L350 252 L642 48" fill="none" stroke="currentColor" stroke-width="0.6" stroke-dasharray="2 5"/>' +
    '<circle cx="350" cy="262" r="50" fill="#9E3F17"/>' +
    '<circle cx="350" cy="262" r="50" fill="none" stroke="#7A2E10" stroke-width="4" stroke-opacity="0.6"/>' +
    '<circle cx="350" cy="262" r="40" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 3.5"/>' +
    diya(350, 257, 0.5) + '</g>' +
    '<rect x="40" y="40" width="620" height="400" fill="none" stroke="currentColor" stroke-width="1"/></svg>';

  function line(cls, html, attrs) {
    return html ? '<div class="' + cls + '"' + (attrs || '') + '>' + html + '</div>' : '';
  }

  function envelope(ev, name) {
    return '<button class="envelope" type="button" aria-label="Open invitation">' + ENVELOPE_SVG +
      '<div class="to"><small>For</small><span>' + esc(name || 'you') + '</span></div></button>';
  }

  function card(ev) {
    var t = Themes.text(theme, ev), T = tpl(ev);
    var when = [fmt.dateNoYear(ev.date), fmt.timeRange(ev.startTime, ev.endTime)].filter(Boolean).join('  ·  ');
    var where = [ev.venue, ev.address].filter(Boolean).join(' · ');
    var fine = [t.dressCode, ev.rsvpBy ? 'RSVP by ' + fmt.monthDay(ev.rsvpBy) : ''].filter(Boolean).join('  ·  ');
    return '<article class="card"><svg viewBox="0 0 700 980" aria-hidden="true">' + T.cardArt() + '</svg>' +
      '<div class="txt" style="top:' + T.cardTop + '">' +
      line('deva', esc(t.greeting), ' lang="hi"') +
      line('kick', esc(t.kicker)) +
      (t.title ? '<h1>' + esc(t.title) + '</h1>' : '') +
      line('sub', esc(t.subtitle)) +
      '<div class="rule"></div>' +
      (when || where ? '<div class="when">' + line('', esc(when)) + line('where', esc(where)) + '</div>' : '') +
      line('host', t.hostNames ? 'Hosted by ' + esc(t.hostNames) : '') +
      line('fine', esc(fine)) +
      '</div></article>';
  }

  function hero(ev) {
    var t = Themes.text(theme, ev), T = tpl(ev);
    return '<div class="hero"><svg viewBox="' + T.heroBox + '" aria-hidden="true">' + T.heroArt() + '</svg></div>' +
      '<div class="txt">' +
      line('deva', esc(t.greeting), ' lang="hi"') +
      line('kick', esc(t.kicker)) +
      (t.title ? '<h1>' + esc(t.title) + '</h1>' : '') +
      line('sub', esc(t.subtitle)) +
      line('host', t.hostNames ? 'Hosted by ' + esc(t.hostNames) : '') +
      '</div>';
  }

  var theme = {
    id: 'diwali',
    name: 'Diwali — Midnight & Marigold',
    fontsUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400;1,500&family=Jost:wght@400;500&family=Tiro+Devanagari+Hindi&display=swap',
    swatches: {
      ground: [
        { name: 'Midnight', value: '#1A1230' }, { name: 'Deep maroon', value: '#3A0F1E' },
        { name: 'Emerald', value: '#0E2A26' }, { name: 'Indigo', value: '#14213D' }
      ],
      accent: [
        { name: 'Classic gold', value: '#D4AF5F' }, { name: 'Pale gold', value: '#E6C77E' }, { name: 'Antique gold', value: '#C9A24A' }
      ]
    },
    defaults: {
      greeting: 'शुभ दीपावली',
      kicker: 'You are warmly invited to',
      title: 'A Diwali Evening',
      subtitle: 'of lights, sweets & good company',
      hostNames: '',
      dressCode: 'Festive attire encouraged',
      replyHeading: 'Kindly reply',
      acceptLabel: 'Joyfully accepts',
      declineLabel: 'Regretfully declines',
      sendLabel: 'Send reply',
      acceptTitle: 'We will save you a diya',
      acceptBody: 'Your reply is in. See you under the lights.',
      declineTitle: 'You will be missed',
      declineBody: 'Thank you for letting us know. Wishing you a bright Diwali.'
    },
    templates: Object.keys(TEMPLATES).map(function (k) { return { id: k, name: TEMPLATES[k].name, note: TEMPLATES[k].note }; }),
    envelope: envelope,
    card: card,
    hero: hero
  };

  Themes.register(theme);
})();
