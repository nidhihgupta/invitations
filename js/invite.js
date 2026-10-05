/* Guest page: envelope -> card -> reply. URL: <theme>.html?e=<event id>[&g=<guest token>] */
(function () {
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var eid = params.get('e') || '';
  var gid = params.get('g') || '';
  var saveKey = 'invitations-reply-' + eid;
  var fromStorage = false;
  if (!gid && eid) {
    try { gid = localStorage.getItem(saveKey) || ''; fromStorage = !!gid; } catch (e) { /* storage blocked */ }
  }
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var S = { ev: null, guest: null, who: null, theme: null, t: null, editing: false, revealAddress: false, opened: false, wantOpen: false };

  function start() {
    if (!eid) return notFound();
    var pre = document.body.getAttribute('data-theme');
    if (pre) {
      Themes.load(pre).then(function (theme) { if (!S.ev) showEnvelope(theme, null); }).catch(function () {});
    }
    fetchInvite().then(function (res) {
      S.ev = res.event; S.guest = res.guest; S.who = res.attendees;
      return Themes.load(S.ev.theme).then(function (theme) {
        S.theme = theme;
        S.t = Themes.text(theme, S.ev);
        document.title = S.t.title ? 'You’re invited: ' + S.t.title : 'You’re invited';
        showEnvelope(theme, S.ev);
        if (S.wantOpen) openEnvelope();
      });
    }).catch(function (err) {
      if (err && err.code === 'not_found') return notFound();
      errorScreen(err);
    });
  }

  function fetchInvite() {
    return Api.call('invite.get', { e: eid, g: gid }).catch(function (err) {
      if (err.code === 'not_found' && fromStorage) {
        try { localStorage.removeItem(saveKey); } catch (e) { /* ignore */ }
        gid = ''; fromStorage = false;
        return Api.call('invite.get', { e: eid });
      }
      throw err;
    });
  }

  function applyTheme(theme, ev) {
    document.body.className = 'guest ' + Themes.classes(ev || { theme: theme.id });
    document.body.setAttribute('style', Themes.vars(ev));
  }

  /* ----- stage 1: envelope ----- */

  function showEnvelope(theme, ev) {
    applyTheme(theme, ev);
    var name = ev ? (S.guest ? S.guest.name : 'you') : '';
    var stage = app.querySelector('.env-stage');
    if (stage && stage.getAttribute('data-theme') === theme.id) {
      stage.querySelector('.to span').textContent = name;
      return;
    }
    app.innerHTML = '<div class="env-stage" data-theme="' + theme.id + '">' + theme.envelope(ev, name) +
      '<div class="hint" aria-hidden="true">Tap to open</div></div>';
    app.querySelector('.envelope').addEventListener('click', openEnvelope);
  }

  function openEnvelope() {
    if (S.opened) return;
    var stage = app.querySelector('.env-stage');
    if (!S.ev) {
      S.wantOpen = true;
      if (stage) stage.querySelector('.hint').textContent = 'Opening…';
      return;
    }
    S.opened = true;
    if (reduced || !stage) return renderMain(false);
    stage.querySelector('.envelope').classList.add('open');
    setTimeout(function () { stage.classList.add('leaving'); }, 750);
    setTimeout(function () { renderMain(true); }, 1150);
  }

  /* ----- stage 2: card + reply ----- */

  function renderMain(animate) {
    var ev = S.ev, theme = S.theme;
    app.innerHTML = '<div class="main' + (animate ? ' rise' : '') + '">' +
      '<div class="wide">' + theme.card(ev) + '</div>' +
      '<div class="narrow">' + theme.hero(ev) + '</div>' +
      '<div class="below"></div></div>';
    renderBelow();
    window.scrollTo(0, 0);
  }

  function renderBelow() {
    var below = app.querySelector('.below');
    below.innerHTML = Render.details(S.ev, S.t) + Render.who(S.who) + '<div id="reply"></div>';
    renderReply();
  }

  function replied() { return S.guest && (S.guest.status === 'yes' || S.guest.status === 'no'); }

  function renderReply(focus) {
    var box = document.getElementById('reply');
    if (S.ev.closed) {
      box.innerHTML = Render.closed(S.ev, S.t, S.guest);
    } else if (replied() && !S.editing) {
      box.innerHTML = Render.thanks(S.ev, S.t, S.guest, { canChange: true, revealAddress: S.revealAddress });
      box.querySelector('[data-act="change"]').addEventListener('click', function () {
        S.editing = true;
        renderReply();
        var first = box.querySelector('.choice button[aria-pressed="true"]') || box.querySelector('.choice button');
        if (first) first.focus();
      });
      var ics = box.querySelector('[data-act="ics"]');
      if (ics) ics.addEventListener('click', function () { Render.downloadIcs(S.ev, S.t); });
      if (focus) box.querySelector('h2').focus();
    } else {
      box.innerHTML = Render.form(S.ev, S.t, S.guest);
      bindForm(box.querySelector('form'));
    }
  }

  function bindForm(form) {
    var pressed = form.querySelector('.choice [aria-pressed="true"]');
    var att = pressed ? pressed.getAttribute('data-att') : '';
    var party = form.querySelector('.party');
    var errBox = form.querySelector('.form-error');

    form.querySelectorAll('[data-att]').forEach(function (b) {
      b.addEventListener('click', function () {
        att = b.getAttribute('data-att');
        form.querySelectorAll('[data-att]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        party.hidden = att !== 'yes';
        errBox.hidden = true;
      });
    });

    function val(name) { return +form.querySelector('[data-stepper="' + name + '"] output').textContent; }
    function syncSteppers() {
      var total = val('adults') + val('kids');
      form.querySelectorAll('[data-stepper]').forEach(function (st) {
        var out = st.querySelector('output'), v = +out.textContent, min = +out.getAttribute('data-min');
        st.querySelector('[data-step="-1"]').disabled = v <= min;
        st.querySelector('[data-step="1"]').disabled = total >= InviteCore.MAX_PARTY;
      });
    }
    form.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var out = b.closest('[data-stepper]').querySelector('output');
        var v = +out.textContent + +b.getAttribute('data-step');
        if (v < +out.getAttribute('data-min')) return;
        if (+b.getAttribute('data-step') > 0 && val('adults') + val('kids') >= InviteCore.MAX_PARTY) return;
        out.textContent = v;
        syncSteppers();
      });
    });
    syncSteppers();

    function fieldError(name, msg) {
      var input = form.querySelector('[name="' + name + '"]'), box = form.querySelector('#e-' + name);
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (box) box.textContent = msg || '';
      return !msg;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.hidden = true;
      var name = form.name.value.trim();
      var contactInput = form.querySelector('[name="contact"]');
      var contact = contactInput ? contactInput.value.trim() : '';
      var ok = true;
      if (!att) { errBox.textContent = 'Please choose whether you can attend.'; errBox.hidden = false; ok = false; }
      ok = fieldError('name', name ? '' : 'Please enter your name.') && ok;
      if (contactInput) {
        var good = InviteCore.isEmail(contact) || InviteCore.isPhone(contact);
        ok = fieldError('contact', contact ? (good ? '' : 'Please enter a valid email or mobile number.') : 'Please enter an email or mobile number so the hosts can reach you.') && ok;
      }
      if (!ok) {
        var bad = form.querySelector('[aria-invalid="true"]');
        if (bad) bad.focus(); else form.querySelector('.choice button').focus();
        return;
      }
      var btn = form.querySelector('.send'), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      var answer = form.querySelector('[name="answer"]');
      Api.call('invite.reply', {
        e: eid, g: S.guest ? S.guest.id : '', attending: att, name: name, contact: contact,
        adults: val('adults'), kids: val('kids'), answer: answer ? answer.value : '', note: form.note.value,
        hp: form.website.value
      }).then(function (res) {
        if (!res.guest) { document.getElementById('reply').innerHTML = '<div class="thanks"><h2>Thank you</h2></div>'; return; }
        var wasHidden = S.ev.addressHidden;
        S.guest = res.guest; S.ev = res.event; S.who = res.attendees; S.editing = false;
        S.revealAddress = wasHidden && !S.ev.addressHidden;
        rememberGuest(res.guestId);
        renderBelow();
        renderReply(true);
        document.getElementById('reply').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = label;
        errBox.textContent = err.code === 'network' ?
          'We couldn’t send your reply. Please check your connection and try again — your answers are still here.' :
          err.message;
        errBox.hidden = false;
        if (err.code === 'closed') { S.ev.closed = 'closed'; }
      });
    });
  }

  function rememberGuest(id) {
    if (!id) return;
    try { localStorage.setItem(saveKey, id); } catch (e) { /* ignore */ }
    if (params.get('g') !== id) {
      params.set('g', id);
      history.replaceState(null, '', location.pathname + '?' + params.toString());
    }
  }

  /* ----- fallbacks ----- */

  function notFound() {
    document.body.className = 'guest neutral';
    document.body.removeAttribute('style');
    document.title = 'Invitation not found';
    app.innerHTML = '<div class="notice"><h1>This invitation could not be found</h1>' +
      '<p>The link may be incomplete, or the invitation may no longer be available. Please check with whoever sent it to you.</p></div>';
  }

  function errorScreen(err) {
    document.body.className = 'guest neutral';
    document.body.removeAttribute('style');
    app.innerHTML = '<div class="notice"><h1>We couldn’t open your invitation</h1><p>' +
      InviteCore.fmt.esc(err && err.code === 'network' ? 'Please check your connection and try again.' : (err && err.message) || 'Something went wrong.') +
      '</p><button type="button">Try again</button></div>';
    app.querySelector('button').addEventListener('click', function () { location.reload(); });
  }

  start();
})();
