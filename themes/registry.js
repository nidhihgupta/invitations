/*
 * Theme registry. Each theme lives in themes/<id>/ with theme.js + theme.css and
 * calls Themes.register({...}) when its script loads.
 *
 * A theme provides:
 *   id, name, fontsUrl, swatches {ground:[{name,value}], accent:[...]},
 *   defaults (wording), templates [{id, name, note}],
 *   envelope(ev, name) -> HTML, card(ev) -> HTML, hero(ev) -> HTML
 */
window.Themes = (function () {
  var list = [{ id: 'diwali', name: 'Diwali — Midnight & Marigold' }];
  var loaded = {}, pending = {};
  var root = (document.currentScript && document.currentScript.src || '').replace(/themes\/registry\.js.*$/, '');

  function addCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }

  function load(id) {
    if (!list.some(function (t) { return t.id === id; })) id = list[0].id;
    if (loaded[id]) return Promise.resolve(loaded[id]);
    if (pending[id]) return pending[id];
    pending[id] = new Promise(function (resolve, reject) {
      addCss(root + 'themes/' + id + '/theme.css');
      var s = document.createElement('script');
      s.src = root + 'themes/' + id + '/theme.js';
      s.onload = function () {
        var t = loaded[id];
        if (!t) return reject(new Error('Theme did not register: ' + id));
        if (t.fontsUrl) addCss(t.fontsUrl);
        resolve(t);
      };
      s.onerror = function () { reject(new Error('Could not load theme: ' + id)); };
      document.head.appendChild(s);
    });
    return pending[id];
  }

  // Event wording: a key the host never set falls back to the theme default;
  // a key set to "" stays blank so that line is hidden (Q9).
  function text(theme, ev) {
    var t = (ev && ev.text) || {}, out = {};
    Object.keys(theme.defaults).forEach(function (k) {
      out[k] = Object.prototype.hasOwnProperty.call(t, k) ? t[k] : theme.defaults[k];
    });
    Object.keys(t).forEach(function (k) { if (!(k in out)) out[k] = t[k]; });
    return out;
  }

  function vars(ev) {
    var c = (ev && ev.colors) || {};
    return '--ground:' + (c.ground || '#1A1230') + ';--gold:' + (c.accent || '#D4AF5F');
  }

  return {
    list: list,
    load: load,
    register: function (t) { loaded[t.id] = t; },
    text: text,
    vars: vars
  };
})();
