/*
 * Theme registry. Each theme lives in themes/<id>/ with theme.js + theme.css and
 * calls Themes.register({...}) when its script loads.
 *
 * A theme provides:
 *   id, name, fontsUrl, defaults (wording), templates [{id, name, note}],
 *   swatchesFor(template) -> {ground:[{name,value}], accent:[...]}, vars(ev), classes(ev),
 *   envelope(ev, name) -> HTML, card(ev) -> HTML, hero(ev) -> HTML
 * Swatches live in backend/core.js (THEMES) so the backend and the page always agree.
 */
window.Themes = (function () {
  var list = [{ id: 'diwali', name: 'Diwali' }];
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

  function themeFor(ev) { return loaded[(ev && ev.theme) || list[0].id] || loaded[list[0].id]; }

  // CSS variables (colors) for an event; each theme maps its design's swatches.
  function vars(ev) {
    var t = themeFor(ev);
    if (t && t.vars) return t.vars(ev);
    var c = (ev && ev.colors) || {};
    return '--ground:' + (c.ground || '#1A1230') + ';--ground-2:' + (c.ground || '#1A1230') + ';--gold:' + (c.accent || '#D4AF5F');
  }

  // Classes that switch on a theme and its card design: "t-diwali tpl-arch".
  function classes(ev) {
    var t = themeFor(ev);
    return t && t.classes ? t.classes(ev) : 't-' + ((ev && ev.theme) || list[0].id);
  }

  return {
    list: list,
    load: load,
    register: function (t) { loaded[t.id] = t; },
    text: text,
    vars: vars,
    classes: classes
  };
})();
