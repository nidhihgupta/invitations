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

  /* ---------- festive motifs (Saffron Arch, Marigold Carnival, Plum Lights) ---------- */

  var uidN = 0;
  function uid(p) { uidN += 1; return p + uidN; }
  function c(x, y, r, fill, extra) {
    var f = fill.indexOf('var(') === 0 ? ' style="fill:' + fill + '"' : ' fill="' + fill + '"';
    return '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r + '"' + f + (extra || '') + '/>';
  }
  function g(transform, inner, extra) { return '<g transform="' + transform + '"' + (extra || '') + '>' + inner + '</g>'; }
  function ring(n, start, fn) { var o = ''; for (var i = 0; i < n; i++) o += fn(start + i * 360 / n, i); return o; }

  // Two-row marigold garland across the top edge, with hanging strands.
  function garland() {
    var o = '', k, i;
    for (k = 0; k < 7; k++) for (i = 0; i <= 10; i++) o += c(k * 100 + i * 10, 8 + 10 * Math.sin(Math.PI * i / 10), 7, i % 2 ? '#DCC55A' : '#F2D774');
    for (k = 0; k < 7; k++) for (i = 0; i <= 10; i++) o += c(k * 100 + i * 10, 16 + 24 * Math.sin(Math.PI * i / 10), 9.5, i % 2 ? '#F4D06A' : '#E8642C', ' stroke="#B8481A" stroke-width="0.6"');
    for (k = 0; k <= 7; k++) o += '<path transform="translate(' + (k * 100) + ' 18) scale(0.8)" d="' + LEAF + '" fill="#3E7B3A"/>';
    [[120, 6], [275, 5], [425, 5], [580, 6]].forEach(function (s) {
      for (var j = 0; j < s[1]; j++) o += c(s[0], 40 + j * 15, 7.5, j % 2 ? '#F4D06A' : '#E8642C', ' stroke="#B8481A" stroke-width="0.6"');
      var y = 40 + s[1] * 15;
      o += '<path transform="translate(' + (s[0] - 3) + ' ' + (y - 6) + ') rotate(18) scale(0.75)" d="' + LEAF + '" fill="#3E7B3A"/>' +
        '<path transform="translate(' + (s[0] + 3) + ' ' + (y - 6) + ') rotate(-18) scale(0.75)" d="' + LEAF + '" fill="#2F6630"/>';
    });
    return o;
  }

  // A gold chain with a hanging lamp at its end.
  function hangingLamp(x, len, s) {
    var o = '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + len + '" stroke="#C9963A" stroke-width="1.2"/>';
    for (var y = 30; y < len - 30; y += 46) o += '<path d="M' + x + ' ' + (y - 6) + ' L' + (x + 5) + ' ' + y + ' L' + x + ' ' + (y + 6) + ' L' + (x - 5) + ' ' + y + ' Z" fill="#E0A040"/>';
    o += '<path d="M' + x + ' ' + len + ' L' + (x - 34 * s) + ' ' + (len + 46 * s) + ' M' + x + ' ' + len + ' L' + (x + 34 * s) + ' ' + (len + 46 * s) + '" stroke="#C9963A" stroke-width="1"/>';
    return o + diya(x, len + 38 * s, s * 0.62);
  }

  // The large ornate clay diya of "Saffron Arch". Local origin = bottom centre.
  function grandDiya() {
    var o = c(0, -250, 95, '#FFD27A', ' fill-opacity="0.16"') + c(0, -240, 58, '#FFD27A', ' fill-opacity="0.22"') +
      '<path d="M0 -335 C 40 -262 44 -206 0 -170 C -44 -206 -40 -262 0 -335 Z" fill="#F6C453"/>' +
      '<path d="M0 -300 C 27 -250 29 -210 0 -182 C -29 -210 -27 -250 0 -300 Z" fill="#FFE7A3"/>' +
      '<path d="M0 -262 C 13 -235 14 -206 0 -190 C -14 -206 -13 -235 0 -262 Z" fill="#FFFBEA"/>' +
      '<path d="M-70 -32 L70 -32 L106 2 L-106 2 Z" fill="#3B1E14" stroke="#C9852F" stroke-width="2"/>' +
      '<path d="M-192 -168 C -186 -70 -100 -26 0 -26 C 100 -26 186 -70 192 -168 Z" fill="#3B1E14" stroke="#C9852F" stroke-width="2"/>';
    for (var t = 0.12; t < 0.9; t += 0.045) o += c(160 * Math.cos(Math.PI * t), -150 + 98 * Math.sin(Math.PI * t), 3.4, '#E0A040');
    o += ring(12, 0, function (a) {
      return '<path transform="translate(0 -96) rotate(' + a + ')" d="M0 -38 C 11 -28 11 -14 0 -8 C -11 -14 -11 -28 0 -38 Z" fill="none" stroke="#E0A040" stroke-width="2"/>';
    }) + ring(8, 22.5, function (a) {
      return '<path transform="translate(0 -96) rotate(' + a + ')" d="M0 -24 C 7 -18 7 -10 0 -6 C -7 -10 -7 -18 0 -24 Z" fill="#C2531B"/>';
    }) + c(0, -96, 8, '#E0A040') + ring(20, 0, function (a) {
      var r = a * Math.PI / 180;
      return c(52 * Math.sin(r), -96 - 52 * Math.cos(r), 2.4, '#E0A040');
    });
    [-1, 1].forEach(function (sgn) {
      o += c(sgn * 122, -112, 15, 'none', ' stroke="#E0A040" stroke-width="2"') + c(sgn * 122, -112, 5, '#C2531B');
    });
    o += '<ellipse cx="0" cy="-170" rx="202" ry="30" fill="#6B2A12" stroke="#E0A040" stroke-width="2.5"/>' +
      '<ellipse cx="0" cy="-172" rx="168" ry="19" fill="#B8481A"/><ellipse cx="0" cy="-173" rx="118" ry="11" fill="#F08A2E"/>' +
      '<line x1="0" y1="-190" x2="0" y2="-172" stroke="#3B1E14" stroke-width="3" stroke-linecap="round"/>';
    for (var u = 0.04; u < 0.97; u += 0.04) o += c(206 * Math.cos(Math.PI * u), -168 + 32 * Math.sin(Math.PI * u), 7.5, '#D99A3E', ' stroke="#3B1E14" stroke-width="1"');
    return o;
  }

  var ARCH = 'M90 980 V382 C90 332 122 312 170 312 V262 H240 C256 200 300 160 350 160 C400 160 444 200 460 262 H530 V312 C578 312 610 332 610 382 V980 Z';

  function lotus(s, fillBack, fillMid, fillFront) {
    var P = function (len, w) { return 'M0 0 C ' + w + ' -' + (len * 0.3) + ' ' + w + ' -' + (len * 0.75) + ' 0 -' + len + ' C -' + w + ' -' + (len * 0.75) + ' -' + w + ' -' + (len * 0.3) + ' 0 0 Z'; };
    var st = ' stroke="#9A3E14" stroke-width="1.2"';
    var o = '';
    [-62, 62].forEach(function (a) { o += '<path transform="rotate(' + a + ') scale(' + s + ')" d="' + P(120, 38) + '" fill="' + fillBack + '"' + st + '/>'; });
    [-34, 34].forEach(function (a) { o += '<path transform="rotate(' + a + ') scale(' + s + ')" d="' + P(140, 40) + '" fill="' + fillMid + '"' + st + '/>'; });
    o += '<path transform="scale(' + s + ')" d="' + P(158, 44) + '" fill="' + fillFront + '"' + st + '/>';
    [-16, 16].forEach(function (a) { o += '<path transform="rotate(' + a + ') scale(' + s + ')" d="' + P(96, 28) + '" fill="#F9DD7A"' + st + '/>'; });
    o += '<path transform="scale(' + s + ')" d="M0 -8 L0 -120" stroke="#F9DD7A" stroke-width="1.5" stroke-opacity="0.7"/>';
    return o;
  }

  function cornerMandala(cx, cy) {
    var petal = function (r0, r1, w) { return 'M0 -' + r1 + ' C ' + w + ' -' + (r1 - (r1 - r0) * 0.3) + ' ' + w + ' -' + (r0 + (r1 - r0) * 0.25) + ' 0 -' + r0 + ' C -' + w + ' -' + (r0 + (r1 - r0) * 0.25) + ' -' + w + ' -' + (r1 - (r1 - r0) * 0.3) + ' 0 -' + r1 + ' Z'; };
    var o = ring(20, 0, function (a) { return '<path transform="rotate(' + a + ')" d="' + petal(78, 160, 24) + '" fill="#F2B33D" stroke="#7A2E12" stroke-width="1.5"/>'; }) +
      ring(20, 9, function (a) { return '<path transform="rotate(' + a + ')" d="' + petal(60, 128, 22) + '" fill="#D9632A" stroke="#7A2E12" stroke-width="1.2"/>'; }) +
      ring(14, 0, function (a) { return '<path transform="rotate(' + a + ')" d="' + petal(44, 88, 16) + '" fill="#F6D35B" stroke="#7A2E12" stroke-width="1"/>'; }) +
      c(0, 0, 46, '#4A2C6E', ' stroke="#F2B33D" stroke-width="2"') +
      ring(16, 0, function (a) { var r = a * Math.PI / 180; return c(36 * Math.sin(r), -36 * Math.cos(r), 3, '#F6D35B'); }) +
      c(0, 0, 20, '#F2B33D') + c(0, 0, 8, '#7A2E12');
    return g('translate(' + cx + ' ' + cy + ')', o);
  }

  function medallion(x, y, s, outline) {
    var col = outline ? 'none' : '#F2C14E', st = outline ? ' stroke="#F2C14E" stroke-width="1.6"' : ' stroke="#8A3A12" stroke-width="1"';
    var o = ring(12, 0, function (a) { var r = a * Math.PI / 180; return c(23 * Math.sin(r), -23 * Math.cos(r), 8, col, st); }) +
      c(0, 0, 19, outline ? 'none' : '#F6D35B', st) +
      '<path d="M-11 2 C -9 11 9 11 11 2 Z" fill="' + (outline ? 'none' : '#5A1A12') + '"' + (outline ? ' stroke="#F2C14E" stroke-width="1.4"' : '') + '/>' +
      '<path d="M0 -12 C 4 -7 4 -2 0 0 C -4 -2 -4 -7 0 -12 Z" fill="' + (outline ? '#F2C14E' : '#8A3A12') + '"/>';
    return g('translate(' + x + ' ' + y + ') scale(' + s + ')', o);
  }

  function beadChain(x, y0, y1) {
    var o = '<line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + y1 + '" stroke="#F2C14E" stroke-width="1.4"/>';
    for (var y = y0 + 14; y < y1 - 6; y += 18) o += (Math.round((y - y0) / 18) % 2 ? c(x, y, 3, '#F2C14E') : '<path d="M' + x + ' ' + (y - 5) + ' L' + (x + 4) + ' ' + y + ' L' + x + ' ' + (y + 5) + ' L' + (x - 4) + ' ' + y + ' Z" fill="#F2C14E"/>');
    return o;
  }

  function leafFan(x, y, flip) {
    var L = function (a, len, fill) { return '<path transform="rotate(' + a + ')" d="M0 0 C 18 -' + (len * 0.35) + ' 22 -' + (len * 0.8) + ' 6 -' + len + ' C -12 -' + (len * 0.7) + ' -14 -' + (len * 0.3) + ' 0 0 Z" fill="' + fill + '" stroke="#9A3E14" stroke-width="1"/><path transform="rotate(' + a + ')" d="M0 -6 C 6 -' + (len * 0.4) + ' 7 -' + (len * 0.7) + ' 5 -' + (len * 0.95) + '" stroke="#F9DD7A" stroke-width="1" fill="none"/>'; };
    return g('translate(' + x + ' ' + y + ') scale(' + (flip ? -1 : 1) + ' 1)', L(-50, 110, '#E07A2E') + L(-22, 150, '#F2B33D') + L(8, 125, '#F6D35B') + L(34, 95, '#E8642C'));
  }

  function goldDiya(cx, cy, s) {
    return g('translate(' + cx + ' ' + cy + ') scale(' + s + ')',
      c(0, -40, 62, '#FFD27A', ' fill-opacity="0.18"') + c(0, -36, 34, '#FFE7A3', ' fill-opacity="0.22"') +
      '<path d="M0 -78 C 16 -52 18 -26 0 -10 C -18 -26 -16 -52 0 -78 Z" fill="#FFF4D6"/>' +
      '<path d="M0 -58 C 8 -42 9 -26 0 -16 C -9 -26 -8 -42 0 -58 Z" fill="#F6C453" fill-opacity="0.6"/>' +
      '<path d="M-76 0 C -64 46 64 46 76 0 Z" fill="#D99A3E" stroke="#9A5A1A" stroke-width="1.5"/>' +
      '<ellipse cx="0" cy="0" rx="76" ry="11" fill="#F2C879"/><ellipse cx="0" cy="-1" rx="60" ry="6" fill="#FFE7A3"/>');
  }

  function patternBand(y) {
    var o = '<rect x="0" y="' + y + '" width="700" height="' + (980 - y) + '" fill="#3E1010"/>';
    for (var x = 8; x < 700; x += 16) o += '<path d="M' + x + ' ' + (y + 5) + ' L' + (x + 4) + ' ' + (y + 9) + ' L' + x + ' ' + (y + 13) + ' L' + (x - 4) + ' ' + (y + 9) + ' Z" fill="#E0A040"/>';
    return o;
  }

  function rosette(x, y, s) {
    return g('translate(' + x + ' ' + y + ') scale(' + s + ')',
      c(0, 0, 17, 'none', ' stroke="currentColor" stroke-width="1.4"') +
      ring(8, 0, function (a) { return '<path transform="rotate(' + a + ')" d="M0 -17 C 5 -22 5 -27 0 -30 C -5 -27 -5 -22 0 -17 Z" fill="none" stroke="currentColor" stroke-width="1.2"/>'; }) +
      '<path d="M-9 1 C -7 9 7 9 9 1 Z" fill="currentColor"/><path d="M0 -9 C 3 -5 3 -2 0 0 C -3 -2 -3 -5 0 -9 Z" fill="currentColor"/>');
  }

  function plumChain(x, len, rosettes) {
    var o = '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + len + '" stroke="currentColor" stroke-width="1"/>';
    for (var y = 14; y < len; y += 22) o += '<path d="M' + x + ' ' + (y - 4) + ' L' + (x + 3) + ' ' + y + ' L' + x + ' ' + (y + 4) + ' L' + (x - 3) + ' ' + y + ' Z" fill="currentColor"/>';
    rosettes.forEach(function (ry) { o += rosette(x, ry, 1); });
    return o + '<path d="M' + (x - 5) + ' ' + (len + 2) + ' L' + (x + 5) + ' ' + (len + 2) + ' L' + x + ' ' + (len + 16) + ' Z" fill="currentColor"/>';
  }

  function ornateHalfMandala(cx, cy) {
    var petal = function (r0, r1, w) { return 'M0 -' + r1 + ' C ' + w + ' -' + (r1 - 4) + ' ' + w + ' -' + (r0 + 6) + ' 0 -' + r0 + ' C -' + w + ' -' + (r0 + 6) + ' -' + w + ' -' + (r1 - 4) + ' 0 -' + r1 + ' Z'; };
    var o = ring(24, 0, function (a) {
      return '<path transform="rotate(' + a + ')" d="' + petal(196, 262, 34) + '" style="fill:var(--ground)" stroke="currentColor" stroke-width="2"/>' +
        '<path transform="rotate(' + a + ')" d="' + petal(208, 246, 18) + '" fill="none" stroke="currentColor" stroke-width="1"/>' +
        '<circle transform="rotate(' + a + ')" cx="0" cy="-226" r="4" fill="currentColor"/>';
    }) + c(0, 0, 196, 'var(--ground)', ' stroke="currentColor" stroke-width="2"') +
      ring(16, 11.25, function (a) {
        return '<path transform="rotate(' + a + ')" d="' + petal(132, 192, 30) + '" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
          '<path transform="rotate(' + a + ')" d="' + petal(146, 178, 14) + '" fill="currentColor" fill-opacity="0.25"/>';
      }) + c(0, 0, 128, 'none', ' stroke="currentColor" stroke-width="2"') +
      ring(36, 0, function (a) { var r = a * Math.PI / 180; return c(112 * Math.sin(r), -112 * Math.cos(r), 6.5, 'none', ' stroke="currentColor" stroke-width="1.2"'); }) +
      ring(12, 0, function (a) { return '<path transform="rotate(' + a + ')" d="' + petal(52, 98, 20) + '" fill="currentColor" fill-opacity="0.85"/>'; }) +
      c(0, 0, 48, 'var(--ground)', ' stroke="currentColor" stroke-width="2"') +
      ring(8, 0, function (a) { return '<path transform="rotate(' + a + ')" d="' + petal(10, 40, 12) + '" fill="none" stroke="currentColor" stroke-width="1.4"/>'; }) +
      c(0, 0, 8, 'currentColor');
    return g('translate(' + cx + ' ' + cy + ')', o);
  }

  function flame(x, y, h, glowId) {
    return c(x, y - h * 0.55, h * 1.6, 'url(#' + glowId + ')') +
      '<path d="M' + x + ' ' + (y - h) + ' C ' + (x + h * 0.28) + ' ' + (y - h * 0.6) + ' ' + (x + h * 0.3) + ' ' + (y - h * 0.25) + ' ' + x + ' ' + (y - 2) +
      ' C ' + (x - h * 0.3) + ' ' + (y - h * 0.25) + ' ' + (x - h * 0.28) + ' ' + (y - h * 0.6) + ' ' + x + ' ' + (y - h) + ' Z" fill="#FFF6DA"/>' +
      '<path d="M' + x + ' ' + (y - h * 0.55) + ' C ' + (x + h * 0.12) + ' ' + (y - h * 0.35) + ' ' + (x + h * 0.12) + ' ' + (y - h * 0.15) + ' ' + x + ' ' + (y - 3) +
      ' C ' + (x - h * 0.12) + ' ' + (y - h * 0.15) + ' ' + (x - h * 0.12) + ' ' + (y - h * 0.35) + ' ' + x + ' ' + (y - h * 0.55) + ' Z" fill="#F6C453" fill-opacity="0.7"/>';
  }

  function plumCandles() {
    var gold = uid('pg'), glow = uid('pw');
    return '<defs><linearGradient id="' + gold + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#B8862F"/><stop offset="0.45" stop-color="#F7E2A6"/><stop offset="1" stop-color="#B8862F"/></linearGradient>' +
      '<radialGradient id="' + glow + '"><stop offset="0" stop-color="#FFF3C4" stop-opacity="0.75"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient></defs>' +
      '<rect x="150" y="790" width="140" height="120" fill="url(#' + gold + ')"/><ellipse cx="220" cy="790" rx="70" ry="12" fill="#F9E9BC"/>' +
      '<line x1="220" y1="790" x2="220" y2="778" stroke="#3B1E14" stroke-width="2"/>' + flame(220, 780, 64, glow) +
      '<path d="M-30 880 H380 C370 950 300 995 170 1000 H-30 Z" fill="url(#' + gold + ')"/>' +
      '<ellipse cx="175" cy="880" rx="205" ry="22" fill="#F6DFA0"/><ellipse cx="175" cy="881" rx="180" ry="14" fill="#FCEFC4"/>' +
      flame(95, 874, 92, glow) +
      '<path d="M262 935 C 272 990 438 992 450 935 Z" fill="url(#' + gold + ')"/>' +
      '<ellipse cx="356" cy="935" rx="94" ry="12" fill="#F6DFA0"/><ellipse cx="356" cy="936" rx="78" ry="7" fill="#FCEFC4"/>' +
      flame(356, 930, 46, glow);
  }

  function flourish() {
    return '<svg class="flourish" viewBox="0 0 220 18" aria-hidden="true"><path d="M0 9H84 M136 9H220" stroke="currentColor" stroke-width="1"/>' +
      '<path d="M86 9 C 92 1 102 1 106 9 C 110 17 120 17 126 9 C 120 3 113 4 110 9 C 107 14 100 15 94 9" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '<circle cx="0" cy="9" r="1.6" fill="currentColor"/><circle cx="220" cy="9" r="1.6" fill="currentColor"/></svg>';
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
    arch: {
      name: 'Saffron Arch',
      note: 'Bright and warm: ivory card, saffron arch, marigold garlands and a grand diya.',
      cardArt: function () {
        return '<path d="' + ARCH + '" fill="currentColor"/>' + garland() +
          hangingLamp(40, 250, 1.1) + hangingLamp(96, 150, 0.9) + hangingLamp(660, 250, 1.1) + hangingLamp(604, 150, 0.9) +
          '<path d="M0 905 C 120 885 240 910 350 900 C 460 890 580 910 700 895 V980 H0 Z" fill="#8A2E12"/>' +
          diya(108, 935, 1.5) + diya(592, 935, 1.5) + g('translate(350 992) scale(0.8)', grandDiya());
      },
      cardTop: '27%',
      body: 'centered'
    },
    carnival: {
      name: 'Marigold Carnival',
      note: 'Bold and festive: deep plum-to-rust, lotuses, corner mandalas and a big date.',
      cardArt: function () {
        var id = uid('cg');
        return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ground)"/>' +
          '<stop offset="1" style="stop-color:var(--ground-2)"/></linearGradient></defs>' +
          '<rect width="700" height="980" fill="url(#' + id + ')"/>' +
          cornerMandala(20, 30) + cornerMandala(680, 30) +
          beadChain(112, 170, 300) + medallion(112, 330, 1.05, false) + beadChain(62, 175, 430) + medallion(62, 460, 0.9, true) +
          beadChain(588, 170, 300) + medallion(588, 330, 1.05, false) + beadChain(638, 175, 430) + medallion(638, 460, 0.9, true) +
          medallion(0, 600, 0.9, true) + medallion(700, 600, 0.9, true) +
          g('translate(350 -8) rotate(180)', lotus(1.05, '#D9632A', '#F2A93B', '#F6C94A')) +
          leafFan(60, 945, false) + leafFan(640, 945, true) +
          g('translate(350 972)', lotus(1.2, '#D9632A', '#F2A93B', '#F6C94A')) +
          goldDiya(178, 930, 1) + goldDiya(522, 930, 1) + patternBand(962);
      },
      cardTop: '25.5%',
      body: 'carnival'
    },
    plum: {
      name: 'Plum Lights',
      note: 'Glowing and elegant: script title, ornate mandala and golden candles.',
      cardArt: function () {
        var bokeh = [[520, 120, 60, 0.10], [190, 330, 42, 0.07], [640, 430, 46, 0.08], [430, 560, 30, 0.08], [300, 130, 24, 0.10], [660, 780, 54, 0.07], [520, 900, 36, 0.06]]
          .map(function (b) { return c(b[0], b[1], b[2], '#D0602A', ' fill-opacity="' + b[3] + '"'); }).join('');
        return bokeh + g('translate(0 0)', mandala(640, 190, 1.3), ' opacity="0.18"') +
          plumChain(62, 250, [118, 236]) + plumChain(112, 150, [86]) + plumChain(158, 200, [190]) +
          ornateHalfMandala(-18, 700) + plumCandles();
      },
      cardTop: '14%',
      body: 'plum'
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

  function tplId(ev) { return TEMPLATES[ev && ev.template] ? ev.template : 'classic'; }
  function tpl(ev) { return TEMPLATES[tplId(ev)]; }

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

  // Long titles get a smaller size so they still fit the design.
  function titleSize(title) {
    var n = String(title || '').length;
    return n <= 8 ? 'tl-l' : n <= 14 ? 'tl-m' : 'tl-s';
  }

  function parts(ev, t) {
    return {
      when: [fmt.dateNoYear(ev.date), fmt.timeRange(ev.startTime, ev.endTime)].filter(Boolean).join('  ·  '),
      where: [ev.venue, ev.address].filter(Boolean).join(' · '),
      fine: [t.dressCode, ev.rsvpBy ? 'RSVP by ' + fmt.monthDay(ev.rsvpBy) : ''].filter(Boolean).join('  ·  '),
      title: t.title ? '<h1 class="' + titleSize(t.title) + '">' + esc(t.title) + '</h1>' : '',
      host: t.hostNames ? 'Hosted by ' + esc(t.hostNames) : ''
    };
  }

  function bodyCentered(ev, t) {
    var p = parts(ev, t);
    return line('deva', esc(t.greeting), ' lang="hi"') + line('kick', esc(t.kicker)) + p.title + line('sub', esc(t.subtitle)) +
      '<div class="rule"></div>' +
      (p.when || p.where ? '<div class="when">' + line('', esc(p.when)) + line('where', esc(p.where)) + '</div>' : '') +
      line('host', p.host) + line('fine', esc(p.fine));
  }

  function bodyCarnival(ev, t) {
    var p = parts(ev, t), d = InviteCore.parseYmd(ev.date);
    var date = '';
    if (d) {
      var dayName = fmt.date(ev.date).split(',')[0], month = fmt.monthDay(ev.date).split(' ')[0];
      var time = fmt.timeRange(ev.startTime, ev.endTime);
      date = '<div class="dateblock"><div class="month">' + esc(month) + '</div><div class="drow">' +
        '<span class="side">' + esc(dayName) + '</span><span class="day">' + d.d + '</span>' +
        '<span class="side">' + (time ? 'at ' + esc(time) : esc(String(d.y))) + '</span></div></div>';
    }
    return line('deva', esc(t.greeting), ' lang="hi"') + line('kick', esc(t.kicker)) + p.title + line('sub', esc(t.subtitle)) +
      date + line('where', esc(p.where)) + line('host', p.host) + line('fine', esc(p.fine));
  }

  function bodyPlum(ev, t) {
    var p = parts(ev, t);
    var rows = [fmt.date(ev.date), fmt.timeRange(ev.startTime, ev.endTime), ev.venue, ev.address].filter(Boolean)
      .map(function (r) { return '<div>' + esc(r) + '</div>'; }).join('');
    return line('deva', esc(t.greeting), ' lang="hi"') + line('kick', esc(t.kicker)) + p.title + line('sub', esc(t.subtitle)) +
      (rows ? flourish() + '<div class="when">' + rows + '</div>' + flourish() : '') +
      line('host', p.host) + line('fine', esc(p.fine));
  }

  var BODIES = { centered: bodyCentered, carnival: bodyCarnival, plum: bodyPlum };

  function card(ev) {
    var t = Themes.text(theme, ev), T = tpl(ev);
    var body = (BODIES[T.body] || bodyCentered)(ev, t);
    return '<article class="card card-' + tplId(ev) + '"><svg class="art" viewBox="0 0 700 980" aria-hidden="true">' + T.cardArt() + '</svg>' +
      '<div class="txt" style="top:' + T.cardTop + '">' + body + '</div></article>';
  }

  // Phone view. Designs with their own phone artwork show it above large text;
  // the others show the whole card at full width (like a printed card).
  function hero(ev) {
    var t = Themes.text(theme, ev), T = tpl(ev);
    if (!T.heroArt) return '<div class="card-phone">' + card(ev) + '</div>';
    return '<div class="hero"><svg viewBox="' + T.heroBox + '" aria-hidden="true">' + T.heroArt() + '</svg></div>' +
      '<div class="txt">' +
      line('deva', esc(t.greeting), ' lang="hi"') +
      line('kick', esc(t.kicker)) +
      (t.title ? '<h1>' + esc(t.title) + '</h1>' : '') +
      line('sub', esc(t.subtitle)) +
      line('host', t.hostNames ? 'Hosted by ' + esc(t.hostNames) : '') +
      '</div>';
  }

  /* ---------- palettes (shared with the backend in backend/core.js) ---------- */

  function palette(template) { return InviteCore.paletteOf('diwali', template || 'classic').p; }
  function pick(list, v) { return list.filter(function (x) { return x.value === v; })[0] || list[0]; }

  function swatchesFor(template) {
    var p = palette(template);
    return { ground: p.grounds, accent: p.accents };
  }

  function vars(ev) {
    var p = palette(tplId(ev)), cl = (ev && ev.colors) || {};
    var gr = pick(p.grounds, cl.ground), ac = pick(p.accents, cl.accent);
    return '--ground:' + gr.value + ';--ground-2:' + (gr.value2 || gr.value) + ';--gold:' + ac.value;
  }

  function classes(ev) { return 't-diwali tpl-' + tplId(ev); }

  /* ---------- envelope front: stamp + postmark (email) and link preview (rendered by tools/render-images.js) ---------- */

  function pal(ev) { return InviteCore.paletteOf('diwali', tplId(ev)).p; }
  function envColor(ev) { return pal(ev).env || 'var(--ground)'; }

  // Postmark, cancellation lines and a perforated stamp with a diya. 440 x 240, transparent.
  function stampArt(ev) {
    var m = uid('pf'), ink = pal(ev).envInk;
    var holes = '';
    for (var x = 284; x <= 420; x += 12) holes += '<circle cx="' + x + '" cy="26" r="4.5" fill="#000"/><circle cx="' + x + '" cy="214" r="4.5" fill="#000"/>';
    for (var y = 38; y <= 202; y += 12) holes += '<circle cx="276" cy="' + y + '" r="4.5" fill="#000"/><circle cx="428" cy="' + y + '" r="4.5" fill="#000"/>';
    var waves = '';
    for (var i = 0; i < 5; i++) {
      var yy = 92 + i * 14;
      waves += '<path d="M150 ' + yy + ' q 12 -7 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0" fill="none" stroke="' + ink + '" stroke-width="2" stroke-opacity="0.55"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 240" width="440" height="240">' +
      '<defs><mask id="' + m + '"><rect x="276" y="26" width="152" height="188" fill="#fff"/>' + holes + '</mask></defs>' +
      '<g transform="rotate(-8 90 120)">' +
      c(90, 120, 66, 'none', ' stroke="' + ink + '" stroke-width="2.5" stroke-opacity="0.6"') +
      c(90, 120, 54, 'none', ' stroke="' + ink + '" stroke-width="1.2" stroke-opacity="0.6"') +
      '<text x="90" y="112" text-anchor="middle" font-family="Jost, Helvetica, Arial, sans-serif" font-size="15" letter-spacing="3" fill="' + ink + '" fill-opacity="0.65">SHUBH</text>' +
      '<text x="90" y="134" text-anchor="middle" font-family="Jost, Helvetica, Arial, sans-serif" font-size="13" letter-spacing="2" fill="' + ink + '" fill-opacity="0.65">DEEPAVALI</text>' +
      c(90, 150, 2.5, ink, ' fill-opacity="0.8"') + '</g>' +
      waves +
      '<g mask="url(#' + m + ')" filter="drop-shadow(0 2px 2px rgba(0,0,0,.25))"><rect x="276" y="26" width="152" height="188" fill="#FBF6EA"/>' +
      '<rect x="290" y="40" width="124" height="160" style="fill:var(--ground)"/>' +
      '<rect x="294" y="44" width="116" height="152" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      g('translate(352 108) scale(0.62)', mandala(0, 0, 0.62)) + diya(352, 110, 0.62) +
      '<text x="352" y="186" text-anchor="middle" font-family="Jost, Helvetica, Arial, sans-serif" font-size="12" letter-spacing="3" fill="currentColor">DIWALI</text></g>' +
      '</svg>';
  }

  // Front of the envelope for the link preview in WhatsApp / iMessage. 1200 x 630.
  function previewArt(ev) {
    var sh = uid('ps'), P = pal(ev);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">' +
      '<defs><filter id="' + sh + '" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#3a2a1a" flood-opacity="0.35"/></filter></defs>' +
      '<rect width="1200" height="630" fill="#EFE4CF"/>' +
      '<g filter="url(#' + sh + ')"><rect x="170" y="55" width="860" height="520" rx="6" style="fill:' + envColor(ev) + '"/></g>' +
      '<rect x="170" y="55" width="860" height="520" rx="6" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<svg x="700" y="80" width="308" height="168" viewBox="0 0 440 240">' + stampArt(ev).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</svg>' +
      '<text x="600" y="380" text-anchor="middle" font-family="\'Cormorant Garamond\', Georgia, serif" font-style="italic" font-size="72" fill="' + P.envInk + '">You’re invited</text>' +
      '<line x1="420" y1="420" x2="780" y2="420" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.8"/>' +
      '</svg>';
  }

  var theme = {
    id: 'diwali',
    name: 'Diwali',
    fontsUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400;1,500' +
      '&family=Jost:wght@300;400;500&family=Tiro+Devanagari+Hindi&family=DM+Serif+Display' +
      '&family=Playfair+Display:wght@700;800&family=Lobster+Two:ital,wght@1,700&display=swap',
    swatches: swatchesFor('classic'),
    swatchesFor: swatchesFor,
    vars: vars,
    classes: classes,
    defaults: {
      greeting: 'शुभ दीपावली',
      kicker: 'You are warmly invited to',
      title: 'A Diwali Evening',
      subtitle: 'of lights, sweets & good company',
      hostNames: '',
      dressCode: 'Festive attire encouraged',
      replyHeading: 'Kindly reply',
      acceptLabel: 'Joyfully accepts',
      maybeLabel: 'Hopes to attend',
      declineLabel: 'Regretfully declines',
      sendLabel: 'Send reply',
      acceptTitle: 'We will save you a diya',
      acceptBody: 'Your reply is in. See you under the lights.',
      declineTitle: 'You will be missed',
      maybeTitle: 'We hope you can make it',
      maybeBody: 'Thank you for letting us know. Change your reply anytime once your plans are set.',
      declineBody: 'Thank you for letting us know. Wishing you a bright Diwali.'
    },
    templates: Object.keys(TEMPLATES).map(function (k) { return { id: k, name: TEMPLATES[k].name, note: TEMPLATES[k].note }; }),
    envelope: envelope,
    stampArt: stampArt,
    previewArt: previewArt,
    card: card,
    hero: hero
  };

  Themes.register(theme);
})();
