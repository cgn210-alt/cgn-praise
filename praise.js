// CGN 찬양팀 앱 — 명단 · 월별 예배 담당 · 섬김 기록 · 결산
(function () {
  // 명단 파트 (slot = 예배 담당표에서 들어가는 자리)
  var PARTS = [
    { key: 'lead', label: '인도자', slot: 'lead' },
    { key: 'keys', label: '피아노', slot: 'keys' },
    { key: 'bass', label: '베이스', slot: 'bass' },
    { key: 'drum', label: '드럼', slot: 'drum' },
    { key: 'mvocal', label: '남자싱어', slot: 'vocal' },
    { key: 'fvocal', label: '여자싱어', slot: 'vocal' },
    { key: 'vocal', label: '싱어', slot: 'vocal' },
    { key: 'sound', label: '음향', slot: 'sound' },
    { key: 'tech', label: '기술', slot: 'tech' },
    { key: 'caption', label: '자막', slot: 'caption' },
    { key: '', label: '파트 미지정', slot: '' }
  ];
  // 예배 담당표 자리 (엑셀 스케줄의 행 순서)
  var SLOTS = [['lead', '인도'], ['keys', '건반'], ['bass', '베이스'], ['drum', '드럼'], ['vocal', '싱어'], ['caption', '자막'], ['tech', '기술'], ['sound', '음향']];
  var STATUS = { active: '활동', guest: '객원', parental: '육아휴직', leave: '휴직', retired: '섬김종료' };
  var TYPES = { staff: '직원예배', prayer: '기도회', praise: '찬양예배', lecture: '특강', team: '팀 모임', etc: '기타' };
  var DEFAULTS = { pointStart: '2027-01-01', servePoint: 1, attendPoint: 1, minutes: { staff: 60, prayer: 60, praise: 60, lecture: 60, team: 60, etc: 60 } };
  // 직임 입력 칸에서 고를 수 있는 이름 (직접 적어도 됩니다)
  var TITLES = ['총괄', '총무', '보컬 파트장', '남성 보컬 파트장', '여성 보컬 파트장', '건반 파트장', '리듬 파트장', '음향 감독', '영상기술 파트장', '자막 파트장'];
  var DOW = '일월화수목금토';
  var R = 'praise/';

  var S = {
    user: null, admin: false, master: false,
    members: {}, events: {}, photos: {}, settings: {}, awards: {}, notice: '', users: {}, admins: {},
    tab: 'sched', month: '', statMode: 'month', statYear: '', statMonth: '', statQ: 1, showRetired: false, q: ''
  };
  var db, auth;

  // ---------- 도우미 ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dowOf(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  function shortDate(key) { return (+key.slice(5, 7)) + '/' + (+key.slice(8)) + '(' + DOW.charAt(dowOf(key)) + ')'; }
  // 26.11.17(화) — 자릿수를 맞춰 세로로 가지런히
  function fullDate(key) { return key.slice(2, 4) + '.' + key.slice(5, 7) + '.' + key.slice(8) + '(' + DOW.charAt(dowOf(key)) + ')'; }
  function addMonth(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function arr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
  }
  function hm(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + '시간' + (m ? ' ' + m + '분' : '') : m + '분';
  }
  function toast(t) {
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = t;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2400);
  }
  function fail(e) { toast('저장하지 못했습니다: ' + (e && e.message || e)); }
  function cfg() {
    var s = S.settings || {};
    return {
      pointStart: s.pointStart || DEFAULTS.pointStart,
      servePoint: s.servePoint != null ? +s.servePoint : DEFAULTS.servePoint,
      attendPoint: s.attendPoint != null ? +s.attendPoint : DEFAULTS.attendPoint,
      minutes: Object.assign({}, DEFAULTS.minutes, s.minutes || {})
    };
  }
  function partOf(key) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].key === (key || '')) return PARTS[i];
    return PARTS[PARTS.length - 1];
  }
  function slotLabel(k) { for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i][0] === k) return SLOTS[i][1]; return k; }
  function nameOf(id) { return S.members[id] ? S.members[id].name : '(삭제된 인원)'; }
  function sortedMembers() {
    var order = {}; PARTS.forEach(function (p, i) { order[p.key] = i; });
    return Object.keys(S.members).map(function (k) { return Object.assign({ id: k }, S.members[k]); })
      .sort(function (a, b) {
        return (order[partOf(a.part).key] - order[partOf(b.part).key]) || ((b.title ? 1 : 0) - (a.title ? 1 : 0)) ||
          ((a.order || 0) - (b.order || 0)) || (a.name < b.name ? -1 : 1);
      });
  }
  function myId() {
    var email = (S.user && S.user.email || '').toLowerCase();
    for (var k in S.members) if ((S.members[k].email || '').toLowerCase() === email) return k;
    return null;
  }
  function avatar(id, size) {
    var m = S.members[id], ph = S.photos[id], st = 'width:' + size + 'px;height:' + size + 'px';
    if (ph) return '<span class="av" style="' + st + '"><img src="' + ph + '" alt=""></span>';
    return '<span class="av" style="' + st + '">' + esc(m ? m.name.slice(-2) : '?') + '</span>';
  }
  function photoBox(id) {
    var m = S.members[id], ph = S.photos[id];
    if (ph) return '<div class="photo"><img src="' + ph + '" alt="' + esc(m && m.name) + '"></div>';
    return '<div class="photo">' + esc(m ? m.name.slice(-2) : '?') + '</div>';
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- 섬김 집계 ----------
  function slotIds(ev) {
    var ids = [];
    SLOTS.forEach(function (s) {
      arr(ev.slots && ev.slots[s[0]]).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    });
    return ids;
  }
  function rolesIn(ev, id) {
    return SLOTS.filter(function (s) { return arr(ev.slots && ev.slots[s[0]]).indexOf(id) >= 0; })
      .map(function (s) { return s[1]; });
  }
  // 'serve' = 담당으로 섬김, 'attend' = 담당 없이 출석, null = 참여 기록 없음(불참 포함)
  function involvement(ev, id) {
    if (ev.absent && ev.absent[id]) return null;
    if (rolesIn(ev, id).length) return 'serve';
    if (ev.attend && ev.attend[id]) return 'attend';
    return null;
  }
  function eventMinutes(ev) { return +ev.minutes || +cfg().minutes[ev.type] || 60; }
  function pastEvents(from, to) {
    var today = todayKey();
    return Object.keys(S.events).map(function (k) { return Object.assign({ id: k }, S.events[k]); })
      .filter(function (e) { return e.date && e.date >= from && e.date <= to && e.date <= today; });
  }
  // 기간 안(오늘까지)의 사람별 섬김·출석·시간·포인트
  function tally(from, to) {
    var c = cfg(), t = {};
    pastEvents(from, to).forEach(function (ev) {
      var ids = slotIds(ev).concat(Object.keys(ev.attend || {}));
      var seen = {};
      ids.forEach(function (id) {
        if (seen[id]) return; seen[id] = 1;
        var kind = involvement(ev, id);
        if (!kind) return;
        var r = t[id] || (t[id] = { serve: 0, attend: 0, minutes: 0, points: 0 });
        r[kind]++;
        r.minutes += eventMinutes(ev);
        if (ev.date >= c.pointStart) r.points += kind === 'serve' ? c.servePoint : c.attendPoint;
      });
    });
    return t;
  }

  // ---------- 로그인 ----------
  function start() {
    if (!window.FIREBASE_CONFIG || /여기에/.test(FIREBASE_CONFIG.apiKey)) {
      $('main').innerHTML = '<div class="card">Firebase 설정 전입니다. README 의 "처음 설정"을 따라 firebase-config.js 를 채워 주세요.</div>';
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.database();
    auth.onAuthStateChanged(function (u) {
      S.user = u;
      if (!u) return showLogin('login');
      if (!u.emailVerified) return showVerify();
      boot();
    });
  }

  function hideApp() {
    $('tabs').classList.add('hidden');
    $('who').classList.add('hidden');
  }

  function authError(e) {
    var c = e && e.code || '';
    if (/wrong-password|user-not-found|invalid-credential|invalid-login/.test(c)) return '메일 또는 비밀번호가 맞지 않습니다.';
    if (/email-already-in-use/.test(c)) return '이미 가입된 메일입니다. 로그인해 주세요.';
    if (/weak-password/.test(c)) return '비밀번호는 6자 이상이어야 합니다.';
    if (/invalid-email/.test(c)) return '메일 주소 형식이 맞지 않습니다.';
    if (/too-many-requests/.test(c)) return '시도가 많아 잠시 막혔습니다. 조금 뒤에 다시 해 주세요.';
    return (e && e.message) || '오류가 났습니다.';
  }

  function showLogin(mode) {
    hideApp();
    var title = mode === 'signup' ? '처음 가입' : mode === 'reset' ? '비밀번호 다시 설정' : '로그인';
    var go = mode === 'signup' ? '가입하고 인증 메일 받기' : mode === 'reset' ? '재설정 메일 보내기' : '로그인';
    $('main').innerHTML =
      '<div class="auth"><div class="card">' +
      '<h2 style="margin:0 0 4px">' + title + '</h2>' +
      '<p class="muted small" style="margin:0 0 6px">회사 메일(' + ALLOWED_EMAIL_DOMAIN + ')로 로그인한 팀원만 볼 수 있습니다.</p>' +
      (mode === 'signup' ? '<label class="f">이름</label><input type="text" id="a-name">' : '') +
      '<label class="f">회사 메일</label><input type="email" id="a-email" placeholder="아이디' + ALLOWED_EMAIL_DOMAIN + '" autocomplete="username">' +
      (mode !== 'reset' ? '<label class="f">비밀번호</label><input type="password" id="a-pw" placeholder="6자 이상" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '">' : '') +
      '<div class="msg-err" id="a-err"></div>' +
      '<button class="btn pri" id="a-go" style="width:100%;margin-top:4px">' + go + '</button>' +
      '<div class="row small" style="justify-content:space-between;margin-top:14px">' +
      (mode === 'login'
        ? '<a href="#" data-mode="signup">처음이면 가입하기</a><a href="#" data-mode="reset">비밀번호를 잊었어요</a>'
        : '<a href="#" data-mode="login">로그인으로 돌아가기</a>') +
      '</div></div></div>';
    $('main').querySelectorAll('[data-mode]').forEach(function (a) {
      a.onclick = function (ev) { ev.preventDefault(); showLogin(a.getAttribute('data-mode')); };
    });
    $('a-go').onclick = function () {
      var email = $('a-email').value.trim().toLowerCase(), pw = $('a-pw') ? $('a-pw').value : '', err = $('a-err');
      err.textContent = '';
      if (email.slice(-ALLOWED_EMAIL_DOMAIN.length) !== ALLOWED_EMAIL_DOMAIN) { err.textContent = '회사 메일(' + ALLOWED_EMAIL_DOMAIN + ')만 쓸 수 있습니다.'; return; }
      if (mode === 'reset') {
        auth.sendPasswordResetEmail(email).then(function () { err.style.color = 'var(--ok)'; err.textContent = '재설정 메일을 보냈습니다. 메일함을 확인해 주세요.'; })
          .catch(function (e) { err.textContent = authError(e); });
      } else if (mode === 'signup') {
        var name = $('a-name').value.trim();
        if (!name) { err.textContent = '이름을 적어 주세요.'; return; }
        auth.createUserWithEmailAndPassword(email, pw).then(function (cr) {
          return cr.user.updateProfile({ displayName: name }).then(function () { return cr.user.sendEmailVerification(); });
        }).then(showVerify).catch(function (e) { err.textContent = authError(e); });
      } else {
        auth.signInWithEmailAndPassword(email, pw).catch(function (e) { err.textContent = authError(e); });
      }
    };
  }

  function showVerify() {
    hideApp();
    var u = auth.currentUser;
    $('main').innerHTML =
      '<div class="auth"><div class="card">' +
      '<h2 style="margin:0 0 6px">메일 인증이 필요합니다</h2>' +
      '<p class="small">' + esc(u && u.email) + ' 로 보낸 인증 메일의 링크를 누른 뒤 아래 "인증 완료"를 눌러 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>' +
      '<div class="msg-err" id="v-err"></div>' +
      '<div class="row"><button class="btn pri" id="v-done">인증 완료</button><button class="btn" id="v-again">인증 메일 다시 보내기</button><span class="grow"></span><button class="btn" id="v-out">로그아웃</button></div>' +
      '</div></div>';
    $('v-done').onclick = function () {
      u.reload().then(function () {
        if (!auth.currentUser.emailVerified) { $('v-err').textContent = '아직 인증되지 않았습니다.'; return; }
        return auth.currentUser.getIdToken(true).then(function () { S.user = auth.currentUser; boot(); });
      });
    };
    $('v-again').onclick = function () {
      u.sendEmailVerification().then(function () { toast('인증 메일을 다시 보냈습니다.'); }).catch(function (e) { $('v-err').textContent = authError(e); });
    };
    $('v-out').onclick = function () { auth.signOut(); };
  }

  // ---------- 시작 ----------
  var booted = false;
  function boot() {
    var u = S.user, email = (u.email || '').toLowerCase();
    if (email.slice(-ALLOWED_EMAIL_DOMAIN.length) !== ALLOWED_EMAIL_DOMAIN) {
      $('main').innerHTML = '<div class="card">회사 메일 계정만 쓸 수 있습니다. <button class="btn sm" id="x-out">로그아웃</button></div>';
      $('x-out').onclick = function () { auth.signOut(); };
      return;
    }
    S.master = email === MASTER_EMAIL.toLowerCase();
    db.ref(R + 'users/' + u.uid).set({ email: email, name: u.displayName || '', at: Date.now() }).catch(function () {});
    $('who').innerHTML = esc(u.displayName || email) + '<br><button id="logout">로그아웃</button>';
    $('who').classList.remove('hidden');
    $('logout').onclick = function () { auth.signOut(); location.reload(); };
    $('tabs').classList.remove('hidden');
    if (booted) return;
    booted = true;

    var t = todayKey();
    S.month = t.slice(0, 7);
    S.statYear = t.slice(0, 4);
    S.statMonth = t.slice(5, 7);
    S.statQ = Math.ceil(+t.slice(5, 7) / 3);
    try { S.tab = localStorage.getItem('praise-tab') || 'sched'; } catch (e) {}

    $('tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tab]');
      if (!b) return;
      S.tab = b.getAttribute('data-tab');
      try { localStorage.setItem('praise-tab', S.tab); } catch (e) {}
      render(true);
    });

    ['members', 'events', 'photos', 'awards', 'users', 'admins', 'settings'].forEach(function (k) {
      db.ref(R + k).on('value', function (snap) {
        S[k] = snap.val() || {};
        if (k === 'admins') S.admin = S.master || !!S.admins[u.uid];
        later();
      }, denied);
    });
    db.ref(R + 'notice').on('value', function (snap) { S.notice = snap.val() || ''; later(); }, denied);
  }
  function denied(e) {
    $('main').innerHTML = '<div class="card">자료를 읽을 수 없습니다. (' + esc(e && e.message) + ')<br>로그아웃 후 다시 로그인해 보시고, 계속되면 관리자에게 알려 주세요.</div>';
  }

  var timer;
  function later() { clearTimeout(timer); timer = setTimeout(function () { render(false); }, 40); }

  // ---------- 화면 그리기 ----------
  function render(force) {
    var main = $('main'), act = document.activeElement;
    // 관리 탭에서 입력 중이면 다른 사람 변경으로 입력값이 지워지지 않게 기다립니다
    if (!force && S.tab === 'admin' && act && main.contains(act) && /INPUT|SELECT|TEXTAREA/.test(act.tagName)) return;
    if (S.tab === 'admin' && !S.admin) S.tab = 'sched';
    $('tab-admin').classList.toggle('hidden', !S.admin);
    $('tabs').querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    var focusId = act && act.id, sel = focusId === 'q' ? act.selectionStart : null;
    main.innerHTML = ({ sched: renderSched, roster: renderRoster, stats: renderStats, mine: renderMine, admin: renderAdmin })[S.tab]();
    if (focusId === 'q' && $('q')) { $('q').focus(); $('q').setSelectionRange(sel, sel); }
  }

  // ----- 예배 담당 -----
  function chip(id, me, absent) {
    return '<span class="chip' + (id === me ? ' me' : '') + (absent ? ' absent' : '') + '">' + avatar(id, 22) + esc(nameOf(id)) + '</span>';
  }
  function renderSched() {
    var me = myId(), today = todayKey(), ym = S.month;
    var list = Object.keys(S.events).map(function (k) { return Object.assign({ id: k }, S.events[k]); })
      .filter(function (e) { return e.date && e.date.slice(0, 7) === ym; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1); });
    var h = '';
    if (S.notice || S.admin) {
      h += '<div class="notice">' + (S.notice ? esc(S.notice) : '<span class="muted">공지가 없습니다.</span>') +
        (S.admin ? ' <button class="btn sm" data-act="notice">공지 수정</button>' : '') + '</div>';
    }
    h += '<div class="monthbar"><button class="nav" data-act="m-prev">‹</button><div class="ym">' + ym.slice(0, 4) + '년 ' + (+ym.slice(5)) + '월</div>' +
      '<button class="nav" data-act="m-next">›</button>' +
      (ym !== today.slice(0, 7) ? '<button class="btn sm" data-act="m-now">이번 달</button>' : '') +
      '<span class="grow"></span>' + (S.admin ? '<button class="btn pri" data-act="ev-new">+ 예배 추가</button>' : '') + '</div>';
    if (!list.length) h += '<div class="card muted">이 달에 등록된 예배가 없습니다.</div>';
    list.forEach(function (e) { h += eventCard(e, me, today); });
    return h;
  }
  function eventCard(e, me, today) {
    var d = dowOf(e.date), rows = '';
    SLOTS.forEach(function (s) {
      var ids = arr(e.slots && e.slots[s[0]]);
      if (!ids.length) return;
      rows += '<div class="lb">' + s[1] + '</div><div class="chips">' +
        ids.map(function (id) { return chip(id, me, e.absent && e.absent[id]); }).join('') + '</div>';
    });
    var att = Object.keys(e.attend || {}).filter(function (id) { return e.attend[id] && !rolesIn(e, id).length; });
    if (att.length) rows += '<div class="lb">출석</div><div class="chips">' + att.map(function (id) { return chip(id, me); }).join('') + '</div>';
    return '<div class="card ev' + (e.date < today ? ' past' : '') + (e.date === today ? ' today' : '') + '">' +
      '<div class="date' + (d === 6 ? ' sat' : '') + '"><b>' + (+e.date.slice(8)) + '</b><span>' + DOW.charAt(d) + '요일</span></div>' +
      '<div class="body"><div class="row"><span class="title">' + esc(e.title || TYPES[e.type] || '예배') + '</span>' +
      (e.title && e.title !== TYPES[e.type] ? '<span class="badge type">' + (TYPES[e.type] || '기타') + '</span>' : '') + '<span class="grow"></span>' +
      (S.admin ? '<button class="btn sm" data-act="ev-att" data-id="' + e.id + '">출석 체크</button><button class="btn sm" data-act="ev-edit" data-id="' + e.id + '">편집</button>' : '') +
      '</div>' + (e.note ? '<div class="small muted">' + esc(e.note) + '</div>' : '') +
      (rows ? '<div class="slots">' + rows + '</div>' : '<div class="small muted" style="margin-top:4px">담당자 미정</div>') +
      '</div></div>';
  }

  // ----- 명단 -----
  function renderRoster() {
    var all = sortedMembers(), cnt = { active: 0, guest: 0, parental: 0, leave: 0, retired: 0 };
    all.forEach(function (m) { cnt[m.status || 'active'] = (cnt[m.status || 'active'] || 0) + 1; });
    var q = S.q.trim();
    var list = all.filter(function (m) { return (S.showRetired || m.status !== 'retired') && (!q || m.name.indexOf(q) >= 0); });
    var h = '<div class="card"><div class="row"><b>전체 ' + (all.length - cnt.retired) + '명</b>' +
      '<span class="muted small">활동 ' + cnt.active + ' · 객원 ' + cnt.guest + ' · 육아휴직 ' + cnt.parental + ' · 휴직 ' + cnt.leave + (cnt.retired ? ' · 섬김종료 ' + cnt.retired : '') + '</span></div>' +
      '<div class="row" style="margin-top:8px"><input type="text" id="q" placeholder="이름 찾기" value="' + esc(S.q) + '" style="max-width:200px">' +
      '<label class="small"><input type="checkbox" id="show-retired"' + (S.showRetired ? ' checked' : '') + '> 섬김종료 포함</label>' +
      '<span class="grow"></span>' + (S.admin ? '<button class="btn pri" data-act="mem-new">+ 인원 추가</button>' : '') + '</div></div>';
    PARTS.forEach(function (p) {
      var ms = list.filter(function (m) { return partOf(m.part).key === p.key; });
      if (!ms.length) return;
      h += '<h3 class="part">' + p.label + ' <span class="cnt">' + ms.length + '명</span></h3><div class="grid">' + ms.map(memCard).join('') + '</div>';
    });
    if (!list.length) h += '<div class="card muted">' + (all.length ? '찾는 이름이 없습니다.' : '명단이 비어 있습니다.' + (S.admin ? ' 관리 탭에서 기초자료를 불러오거나 인원을 추가해 주세요.' : '')) + '</div>';
    return h;
  }
  function memCard(m) {
    var st = m.status || 'active';
    var extra = Object.keys(m.roles || {}).filter(function (k) { return m.roles[k]; }).map(slotLabel).join('·');
    return '<div class="mem' + (st !== 'active' && st !== 'guest' ? ' off' : '') + '" data-act="mem" data-id="' + m.id + '">' + photoBox(m.id) +
      '<div class="nm">' + esc(m.name) + '</div><div class="meta">' +
      (m.title ? '<span class="badge title">' + esc(m.title) + '</span> ' : '') +
      (st !== 'active' ? '<span class="badge ' + st + '">' + STATUS[st] + '</span> ' : '') + (extra ? '+' + esc(extra) : '') + '</div></div>';
  }

  // ----- 통계 · 결산 -----
  function periodRange() {
    var y = S.statYear;
    if (S.statMode === 'year') return { key: y, label: y + '년', from: y + '-01-01', to: y + '-12-31' };
    if (S.statMode === 'quarter') {
      var q = +S.statQ;
      return { key: y + '-Q' + q, label: y + '년 ' + q + '분기', from: y + '-' + pad(q * 3 - 2) + '-01', to: y + '-' + pad(q * 3) + '-31' };
    }
    return { key: y + '-' + S.statMonth, label: y + '년 ' + (+S.statMonth) + '월', from: y + '-' + S.statMonth + '-01', to: y + '-' + S.statMonth + '-31' };
  }
  function ranking(t, usePoints) {
    var rows = Object.keys(t).map(function (id) {
      var r = t[id];
      return { id: id, serve: r.serve, attend: r.attend, total: r.serve + r.attend, minutes: r.minutes, points: r.points };
    });
    rows.sort(function (a, b) {
      return (usePoints ? b.points - a.points : 0) || (b.total - a.total) || (b.minutes - a.minutes) || (nameOf(a.id) < nameOf(b.id) ? -1 : 1);
    });
    rows.forEach(function (r, i) {
      var p = rows[i - 1];
      r.rank = p && (usePoints ? p.points === r.points : true) && p.total === r.total ? p.rank : i + 1;
    });
    return rows;
  }
  function renderStats() {
    var p = periodRange(), c = cfg(), t = tally(p.from, p.to), evs = pastEvents(p.from, p.to);
    var usePoints = p.to >= c.pointStart;
    var rows = ranking(t, usePoints);
    var years = {}; years[todayKey().slice(0, 4)] = 1; years[c.pointStart.slice(0, 4)] = 1;
    Object.keys(S.events).forEach(function (k) { if (S.events[k].date) years[S.events[k].date.slice(0, 4)] = 1; });
    var h = '<div class="card"><div class="row">' +
      '<div class="seg">' + [['month', '월별'], ['quarter', '분기'], ['year', '연간']].map(function (x) {
        return '<button data-act="st-mode" data-id="' + x[0] + '" class="' + (S.statMode === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      '<select id="st-year" style="width:auto">' + Object.keys(years).sort().map(function (y) { return '<option' + (y === S.statYear ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>';
    if (S.statMode === 'month') {
      h += '<select id="st-sub" style="width:auto">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (m) { return '<option value="' + pad(m) + '"' + (pad(m) === S.statMonth ? ' selected' : '') + '>' + m + '월</option>'; }).join('') + '</select>';
    } else if (S.statMode === 'quarter') {
      h += '<select id="st-sub" style="width:auto">' + [1, 2, 3, 4].map(function (q) { return '<option value="' + q + '"' + (q === +S.statQ ? ' selected' : '') + '>' + q + '분기</option>'; }).join('') + '</select>';
    }
    h += '<span class="grow"></span><button class="btn sm" data-act="st-csv">엑셀(CSV) 내려받기</button></div>';
    h += '<p class="small muted" style="margin:8px 0 0">' + (usePoints
      ? '포인트: 담당으로 섬김 ' + c.servePoint + '점, 담당 없이 출석 ' + c.attendPoint + '점 (' + c.pointStart + '부터). 오늘까지 지난 예배만 집계합니다.'
      : '포인트는 ' + c.pointStart + '부터 계산합니다. 이 기간은 횟수와 시간만 집계합니다.') + '</p></div>';

    var sumServe = 0, sumAtt = 0, sumMin = 0;
    rows.forEach(function (r) { sumServe += r.serve; sumAtt += r.attend; sumMin += r.minutes; });
    h += '<div class="tiles">' +
      tile('예배', evs.length, '번') + tile('함께한 사람', rows.length, '명') +
      tile('섬김 · 출석', sumServe + sumAtt, '회') + tile('섬김 시간 합계', Math.round(sumMin / 60), '시간') + '</div>';

    if (S.statMode === 'year') {
      var per = [], max = 1;
      for (var m = 1; m <= 12; m++) {
        var mt = tally(S.statYear + '-' + pad(m) + '-01', S.statYear + '-' + pad(m) + '-31'), n = 0;
        Object.keys(mt).forEach(function (id) { n += mt[id].serve + mt[id].attend; });
        per.push(n); if (n > max) max = n;
      }
      h += '<div class="card"><b>월별 섬김 · 출석 횟수</b><div class="bars">' + per.map(function (n, i) {
        return '<div class="b"><em>' + (n || '') + '</em><i style="height:' + Math.round(n / max * 100) + '%"></i>' + (i + 1) + '월</div>';
      }).join('') + '</div></div>';
    }

    h += awardCard(p, rows);

    h += '<div class="card"><b>' + p.label + ' 섬김 순위</b>';
    if (!rows.length) h += '<p class="muted small">기록이 없습니다.</p>';
    else {
      h += '<div class="tbl-wrap"><table class="rank"><thead><tr><th>순위</th><th class="l">이름</th><th class="l">파트</th><th>섬김</th><th>출석</th><th>시간</th>' + (usePoints ? '<th>포인트</th>' : '') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          var m = S.members[r.id] || {};
          return '<tr class="' + (r.rank <= 3 ? 'top' : '') + '"><td>' + r.rank + '</td><td class="l"><span class="row" style="gap:6px;flex-wrap:nowrap">' + avatar(r.id, 24) + esc(nameOf(r.id)) + '</span></td>' +
            '<td class="l muted">' + partOf(m.part).label + '</td><td>' + r.serve + '</td><td>' + r.attend + '</td><td>' + hm(r.minutes) + '</td>' +
            (usePoints ? '<td><b>' + r.points + '</b></td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += '</div>';

    var past = Object.keys(S.awards).sort().reverse().filter(function (k) { return k !== p.key; });
    if (past.length) {
      h += '<div class="card"><b>지난 포상 기록</b>' + past.map(function (k) {
        var a = S.awards[k];
        return '<div class="small" style="margin-top:6px"><b>' + esc(a.label || k) + '</b> · ' + Object.keys(a.winners || {}).map(nameOf).map(esc).join(', ') + '</div>';
      }).join('') + '</div>';
    }
    return h;
  }
  function tile(k, v, unit) { return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v + ' <small>' + unit + '</small></div></div>'; }
  function awardCard(p, rows) {
    var a = S.awards[p.key];
    if (!a && !S.admin) return '';
    var h = '<div class="card award"><div class="row"><b>' + p.label + ' 우수 스텝</b><span class="grow"></span>' +
      (S.admin ? '<button class="btn sm gold" data-act="award">' + (a ? '수정' : '선정하기') + '</button>' : '') + '</div>';
    if (!a) return h + '<p class="small muted" style="margin:6px 0 0">아직 선정하지 않았습니다. 아래 순위를 참고해 선정할 수 있습니다.</p></div>';
    h += '<div class="who">' + Object.keys(a.winners || {}).map(function (id) {
      return '<div>' + photoBox(id) + esc(nameOf(id)) + '</div>';
    }).join('') + '</div>';
    if (a.message) h += '<div class="msg">' + esc(a.message) + '</div>';
    return h + '</div>';
  }

  // ----- 내 기록 -----
  function renderMine() {
    var id = myId();
    if (!id) {
      return '<div class="card">명단에 내 회사 메일(' + esc(S.user.email) + ')이 등록되어 있지 않아 기록을 찾지 못했습니다. 관리자에게 명단의 메일 주소 등록을 요청해 주세요.</div>';
    }
    var m = S.members[id], t = todayKey(), y = t.slice(0, 4), mo = t.slice(5, 7), q = Math.ceil(+mo / 3), c = cfg();
    function box(label, from, to) {
      var r = tally(from, to)[id] || { serve: 0, attend: 0, minutes: 0, points: 0 };
      return '<div class="tile"><div class="k">' + label + '</div><div class="v">' + (r.serve + r.attend) + ' <small>회</small></div>' +
        '<div class="small muted">섬김 ' + r.serve + ' · 출석 ' + r.attend + ' · ' + hm(r.minutes) + (to >= c.pointStart ? ' · <b style="color:var(--gold-d)">' + r.points + '점</b>' : '') + '</div></div>';
    }
    var yr = tally(y + '-01-01', y + '-12-31')[id];
    var h = '<div class="card"><div class="row" style="align-items:flex-start;gap:14px"><div style="width:90px">' + photoBox(id) + '</div><div class="grow">' +
      '<h2 style="margin:0">' + esc(m.name) + '</h2><div class="muted">' + (m.title ? esc(m.title) + ' · ' : '') + partOf(m.part).label + ' · ' + STATUS[m.status || 'active'] + '</div>' +
      (yr ? '<p class="small" style="margin:8px 0 0">올해 ' + (yr.serve + yr.attend) + '번 예배의 자리를 함께 지켜 주셨습니다. 수고에 감사드립니다.</p>' : '') +
      '</div></div></div>';
    h += '<div class="tiles">' + box(+mo + '월', y + '-' + mo + '-01', y + '-' + mo + '-31') +
      box(q + '분기', y + '-' + pad(q * 3 - 2) + '-01', y + '-' + pad(q * 3) + '-31') +
      box(y + '년', y + '-01-01', y + '-12-31') + box('누적', '0000-00-00', '9999-12-31') + '</div>';

    var all = Object.keys(S.events).map(function (k) { return Object.assign({ id: k }, S.events[k]); }).filter(function (e) { return e.date; });
    var up = all.filter(function (e) { return e.date >= t && rolesIn(e, id).length; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    h += '<div class="card"><b>앞으로 맡은 예배</b>' + (up.length ? up.map(function (e) {
      return '<div class="row small" style="margin-top:6px"><b class="dt">' + fullDate(e.date) + '</b><span class="grow">' + esc(e.title || TYPES[e.type]) + '</span><span class="badge type">' + rolesIn(e, id).join('·') + '</span></div>';
    }).join('') : '<p class="small muted" style="margin:6px 0 0">등록된 담당이 없습니다.</p>') + '</div>';

    var aw = Object.keys(S.awards).filter(function (k) { return S.awards[k].winners && S.awards[k].winners[id]; }).sort().reverse();
    if (aw.length) h += '<div class="card award"><b>우수 스텝 선정</b>' + aw.map(function (k) { return '<div class="small" style="margin-top:4px">' + esc(S.awards[k].label || k) + '</div>'; }).join('') + '</div>';

    var hist = all.filter(function (e) { return e.date < t || e.date === t; })
      .filter(function (e) { return involvement(e, id); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<div class="card"><b>지난 섬김 기록</b> <span class="small muted">' + hist.length + '건</span>' + hist.slice(0, 40).map(function (e) {
      var kind = involvement(e, id);
      return '<div class="row small" style="margin-top:6px"><span class="dt">' + fullDate(e.date) + '</span><span class="grow">' + esc(e.title || TYPES[e.type]) + '</span><span class="muted">' + (kind === 'serve' ? rolesIn(e, id).join('·') : '출석') + '</span></div>';
    }).join('') + (hist.length > 40 ? '<p class="small muted">최근 40건만 보입니다.</p>' : '') + '</div>';
    return h;
  }

  // ----- 관리 -----
  function renderAdmin() {
    var c = cfg();
    var h = '<div class="card"><b>포인트 · 시간 기준</b>' +
      '<p class="small muted" style="margin:4px 0 0">바꾸면 지난 기록까지 새 기준으로 다시 계산됩니다. 섬김 시간은 예배마다 따로 적을 수도 있고, 비워 두면 아래 종류별 기본값을 씁니다.</p>' +
      '<div class="row"><div class="grow"><label class="f">포인트 계산 시작일</label><input type="date" id="s-start" value="' + c.pointStart + '"></div>' +
      '<div class="grow"><label class="f">담당 섬김 1회</label><input type="number" id="s-serve" min="0" step="0.5" value="' + c.servePoint + '"></div>' +
      '<div class="grow"><label class="f">출석 1회</label><input type="number" id="s-attend" min="0" step="0.5" value="' + c.attendPoint + '"></div></div>' +
      '<label class="f">종류별 기본 섬김 시간(분)</label><div class="row">' + Object.keys(TYPES).map(function (k) {
        return '<div style="width:110px"><span class="small muted">' + TYPES[k] + '</span><input type="number" min="0" data-min="' + k + '" value="' + c.minutes[k] + '"></div>';
      }).join('') + '</div>' +
      '<div class="foot" style="justify-content:flex-start"><button class="btn pri" data-act="s-save">기준 저장</button></div></div>';

    h += '<div class="card"><b>관리자</b><p class="small muted" style="margin:4px 0 8px">관리자는 명단 · 사진 · 예배 담당 · 출석 · 포상 · 공지를 모두 고칠 수 있습니다. ' +
      (S.master ? '앱에 한 번 로그인한 사람만 목록에 나옵니다.' : '관리자 지정은 마스터(' + esc(MASTER_NAME) + ')만 할 수 있습니다.') + '</p>';
    h += '<div class="row small" style="margin-bottom:4px"><b>' + esc(MASTER_NAME) + '</b><span class="muted">' + esc(MASTER_EMAIL) + ' · 마스터</span></div>';
    var users = Object.keys(S.users).map(function (k) { return Object.assign({ uid: k }, S.users[k]); })
      .filter(function (u) { return (u.email || '') !== MASTER_EMAIL.toLowerCase(); })
      .sort(function (a, b) { return (a.email || '') < (b.email || '') ? -1 : 1; });
    users.forEach(function (u) {
      var on = !!S.admins[u.uid];
      if (!S.master && !on) return;
      h += '<div class="row small" style="margin-top:4px">' +
        (S.master ? '<label><input type="checkbox" data-admin="' + u.uid + '"' + (on ? ' checked' : '') + '> ' : '<span>') + '<b>' + esc(u.name || '-') + '</b> <span class="muted">' + esc(u.email) + '</span>' + (S.master ? '</label>' : '</span>') + '</div>';
    });
    h += '</div>';

    h += '<div class="card"><b>자료</b><p class="small muted" style="margin:4px 0 8px">기초자료 파일(찬양팀_기초자료_2026.json)을 불러오면 명단과 예배 기록이 그 내용으로 바뀝니다. 사진 · 포상 · 기준은 그대로 둡니다.</p>' +
      '<div class="row"><label class="btn">기초자료 불러오기<input type="file" id="imp" accept=".json,application/json" class="hidden"></label>' +
      '<button class="btn" data-act="backup">전체 백업 내려받기</button></div></div>';
    return h;
  }

  // ---------- 모달 ----------
  function modal(html, id) {
    id = id || 'modal';
    closeModal(id);
    var bg = document.createElement('div');
    bg.className = 'modal-bg'; bg.id = id;
    if (id === 'modal2') bg.style.zIndex = 60;
    bg.innerHTML = '<div class="modal">' + html + '</div>';
    document.body.appendChild(bg);
    return bg.firstChild;
  }
  function closeModal(id) { var m = $(id || 'modal'); if (m) m.remove(); }

  function editNotice() {
    modal('<h3>공지 수정</h3><p class="small muted">예배 담당 화면 맨 위에 보입니다. 비우면 감춰집니다.</p><textarea id="n-text" style="min-height:120px">' + esc(S.notice) + '</textarea>' +
      '<div class="foot"><button class="btn" id="n-close">닫기</button><button class="btn pri" id="n-save">저장</button></div>');
    $('n-close').onclick = function () { closeModal(); };
    $('n-save').onclick = function () {
      db.ref(R + 'notice').set($('n-text').value.trim() || null).then(function () { closeModal(); toast('공지를 저장했습니다.'); }).catch(fail);
    };
  }

  function candidateOptions(slot, chosen) {
    var list = sortedMembers().filter(function (m) { return m.status !== 'retired' && chosen.indexOf(m.id) < 0; });
    var main = list.filter(function (m) { return partOf(m.part).slot === slot || (m.roles && m.roles[slot]); });
    var rest = list.filter(function (m) { return main.indexOf(m) < 0; });
    function opt(m) { return '<option value="' + m.id + '">' + esc(m.name) + (m.status && m.status !== 'active' ? ' (' + STATUS[m.status] + ')' : '') + '</option>'; }
    return '<option value="">+ 추가</option>' +
      (main.length ? '<optgroup label="' + slotLabel(slot) + ' 파트">' + main.map(opt).join('') + '</optgroup>' : '') +
      (rest.length ? '<optgroup label="그 밖의 인원">' + rest.map(opt).join('') + '</optgroup>' : '');
  }

  function editEvent(id) {
    var src = id ? S.events[id] : null, today = todayKey(), c = cfg();
    var e = src ? JSON.parse(JSON.stringify(src)) : { date: S.month === today.slice(0, 7) ? today : S.month + '-01', title: '직원예배', type: 'staff' };
    var slots = {};
    SLOTS.forEach(function (s) { slots[s[0]] = arr(e.slots && e.slots[s[0]]); });
    modal('<h3>' + (id ? '예배 편집' : '예배 추가') + '</h3>' +
      '<div class="row"><div class="grow"><label class="f">날짜</label><input type="date" id="e-date" value="' + e.date + '"></div>' +
      '<div class="grow"><label class="f">종류</label><select id="e-type">' + Object.keys(TYPES).map(function (k) {
        return '<option value="' + k + '"' + (k === e.type ? ' selected' : '') + '>' + TYPES[k] + '</option>';
      }).join('') + '</select></div></div>' +
      '<label class="f">예배 이름</label><input type="text" id="e-title" value="' + esc(e.title || '') + '" placeholder="예: 직원예배, 기도회(○○○ 목사)">' +
      '<label class="f">섬김 시간(분) <span id="e-min-hint" style="font-weight:500"></span></label><input type="number" id="e-min" min="0" value="' + (e.minutes || '') + '">' +
      '<div id="e-slots"></div>' +
      '<label class="f">메모</label><input type="text" id="e-note" value="' + esc(e.note || '') + '">' +
      '<div class="foot">' + (id ? '<button class="btn bad" id="e-del">삭제</button><span class="grow"></span>' : '') +
      '<button class="btn" id="e-close">닫기</button><button class="btn pri" id="e-save">저장</button></div>');
    function hint() { $('e-min-hint').textContent = '비우면 ' + TYPES[$('e-type').value] + ' 기본 ' + c.minutes[$('e-type').value] + '분'; }
    function draw() {
      $('e-slots').innerHTML = SLOTS.map(function (s) {
        return '<label class="f">' + s[1] + '</label><div class="chips">' + slots[s[0]].map(function (mid) {
          return '<span class="chip">' + avatar(mid, 22) + esc(nameOf(mid)) + ' <x data-rm="' + s[0] + '|' + mid + '">✕</x></span>';
        }).join('') + '<select data-add="' + s[0] + '" style="width:auto;padding:3px 8px;font-size:13px">' + candidateOptions(s[0], slots[s[0]]) + '</select></div>';
      }).join('');
    }
    hint(); draw();
    $('e-slots').addEventListener('click', function (ev) {
      var r = ev.target.getAttribute('data-rm');
      if (!r) return;
      var p = r.split('|');
      slots[p[0]] = slots[p[0]].filter(function (x) { return x !== p[1]; });
      draw();
    });
    $('e-slots').addEventListener('change', function (ev) {
      var s = ev.target.getAttribute('data-add');
      if (!s || !ev.target.value) return;
      slots[s].push(ev.target.value);
      draw();
    });
    $('e-type').onchange = function () {
      var tl = $('e-title').value.trim(), isLabel = !tl || Object.keys(TYPES).some(function (k) { return TYPES[k] === tl; });
      if (isLabel) $('e-title').value = TYPES[this.value];
      hint();
    };
    $('e-close').onclick = function () { closeModal(); };
    $('e-save').onclick = function () {
      var date = $('e-date').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('날짜를 골라 주세요.'); return; }
      var obj = { date: date, type: $('e-type').value, title: $('e-title').value.trim() || TYPES[$('e-type').value] };
      var ss = {};
      SLOTS.forEach(function (s) { if (slots[s[0]].length) ss[s[0]] = slots[s[0]]; });
      if (Object.keys(ss).length) obj.slots = ss;
      if (+$('e-min').value > 0) obj.minutes = +$('e-min').value;
      if ($('e-note').value.trim()) obj.note = $('e-note').value.trim();
      if (src && src.attend) obj.attend = src.attend;
      if (src && src.absent) obj.absent = src.absent;
      var key = id || date + '_' + Date.now().toString(36);
      db.ref(R + 'events/' + key).set(obj).then(function () {
        closeModal(); toast('저장했습니다.');
        if (date.slice(0, 7) !== S.month) { S.month = date.slice(0, 7); render(true); }
      }).catch(fail);
    };
    if (id) $('e-del').onclick = function () {
      if (!confirm(shortDate(e.date) + ' ' + (e.title || '') + ' 예배를 지울까요? 이 예배의 섬김 기록도 함께 지워집니다.')) return;
      db.ref(R + 'events/' + id).remove().then(function () { closeModal(); toast('지웠습니다.'); }).catch(fail);
    };
  }

  function editAttend(id) {
    var e = S.events[id], attend = Object.assign({}, e.attend || {}), absent = Object.assign({}, e.absent || {});
    var served = slotIds(e);
    var others = sortedMembers().filter(function (m) { return served.indexOf(m.id) < 0 && (m.status !== 'retired' || attend[m.id]); });
    function cb(kind, mid, on) {
      return '<label><input type="checkbox" data-' + kind + '="' + mid + '"' + (on ? ' checked' : '') + '> ' + esc(nameOf(mid)) + '</label>';
    }
    modal('<h3>출석 체크</h3><p class="small muted">' + shortDate(e.date) + ' ' + esc(e.title || '') +
      '<br>담당자는 섬김으로 자동 기록됩니다. 오지 못한 담당자는 "불참"에, 담당이 아니지만 함께한 팀원은 "출석"에 체크해 주세요.</p>' +
      (served.length ? '<label class="f">담당자 불참</label><div class="checks">' + served.map(function (mid) { return cb('ab', mid, absent[mid]); }).join('') + '</div>' : '') +
      '<label class="f">출석 <a href="#" id="a-all" class="small" style="font-weight:500">활동 인원 모두 체크</a></label><div class="checks">' + others.map(function (m) { return cb('at', m.id, attend[m.id]); }).join('') + '</div>' +
      '<div class="foot"><button class="btn" id="a-close">닫기</button><button class="btn pri" id="a-save">저장</button></div>');
    $('a-all').onclick = function (ev) {
      ev.preventDefault();
      document.querySelectorAll('#modal [data-at]').forEach(function (x) {
        var m = S.members[x.getAttribute('data-at')];
        if (m && (m.status || 'active') === 'active') x.checked = true;
      });
    };
    $('a-close').onclick = function () { closeModal(); };
    $('a-save').onclick = function () {
      var at = {}, ab = {};
      document.querySelectorAll('#modal [data-at]').forEach(function (x) { if (x.checked) at[x.getAttribute('data-at')] = true; });
      document.querySelectorAll('#modal [data-ab]').forEach(function (x) { if (x.checked) ab[x.getAttribute('data-ab')] = true; });
      db.ref(R + 'events/' + id).update({ attend: Object.keys(at).length ? at : null, absent: Object.keys(ab).length ? ab : null })
        .then(function () { closeModal(); toast('출석을 저장했습니다.'); }).catch(fail);
    };
  }

  function showMember(id) {
    var m = S.members[id], c = cfg(), y = todayKey().slice(0, 4);
    var ty = tally(y + '-01-01', y + '-12-31')[id] || { serve: 0, attend: 0, minutes: 0, points: 0 };
    var al = tally('0000-00-00', '9999-12-31')[id] || { serve: 0, attend: 0, minutes: 0, points: 0 };
    var extra = Object.keys(m.roles || {}).filter(function (k) { return m.roles[k]; }).map(slotLabel).join(', ');
    modal('<div class="row" style="align-items:flex-start;gap:14px;flex-wrap:nowrap"><div style="width:120px;flex:none">' + photoBox(id) + '</div><div class="grow">' +
      '<h3 style="margin:0">' + esc(m.name) + '</h3>' +
      '<div style="margin-top:2px">' + (m.title ? '<b>' + esc(m.title) + '</b> · ' : '') + partOf(m.part).label + ' <span class="badge ' + (m.status || 'active') + '">' + STATUS[m.status || 'active'] + '</span></div>' +
      (extra ? '<div class="small" style="margin-top:4px">함께 맡는 자리: ' + esc(extra) + '</div>' : '') +
      (m.email ? '<div class="small muted" style="margin-top:4px">' + esc(m.email) + '</div>' : '') +
      (m.note ? '<div class="small" style="margin-top:6px;white-space:pre-wrap">' + esc(m.note) + '</div>' : '') +
      '</div></div>' +
      '<div class="tiles" style="margin-top:14px">' +
      '<div class="tile"><div class="k">' + y + '년</div><div class="v">' + (ty.serve + ty.attend) + ' <small>회</small></div><div class="small muted">' + hm(ty.minutes) + (y + '-12-31' >= c.pointStart ? ' · ' + ty.points + '점' : '') + '</div></div>' +
      '<div class="tile"><div class="k">누적</div><div class="v">' + (al.serve + al.attend) + ' <small>회</small></div><div class="small muted">' + hm(al.minutes) + '</div></div></div>' +
      '<div class="foot">' + (S.admin ? '<button class="btn" id="m-edit">편집</button>' : '') + '<button class="btn pri" id="m-close">닫기</button></div>');
    $('m-close').onclick = function () { closeModal(); };
    if (S.admin) $('m-edit').onclick = function () { editMember(id); };
  }

  function editMember(id) {
    var maxOrder = 0;
    Object.keys(S.members).forEach(function (k) { maxOrder = Math.max(maxOrder, +S.members[k].order || 0); });
    var m = id ? JSON.parse(JSON.stringify(S.members[id])) : { name: '', part: '', status: 'active', order: maxOrder + 1 };
    var roles = m.roles || {}, photo = id ? S.photos[id] || '' : '', photoChanged = false;
    modal('<h3>' + (id ? '인원 편집' : '인원 추가') + '</h3>' +
      '<div class="row" style="align-items:flex-end;gap:12px"><div style="width:96px" id="p-box"></div><div>' +
      '<label class="btn sm">사진 올리기<input type="file" id="p-file" accept="image/*" class="hidden"></label> ' +
      '<button class="btn sm" id="p-del">사진 빼기</button><div class="small muted" style="margin-top:4px">증명사진 비율(3:4)로 맞춰 저장합니다.</div></div></div>' +
      '<label class="f">이름</label><input type="text" id="p-name" value="' + esc(m.name) + '">' +
      '<label class="f">직임 <span style="font-weight:500">(비우면 표시 안 함)</span></label><input type="text" id="p-title" list="p-titles" value="' + esc(m.title || '') + '" placeholder="예: 총괄, 총무, 보컬 파트장">' +
      '<datalist id="p-titles">' + TITLES.map(function (t) { return '<option value="' + t + '">'; }).join('') + '</datalist>' +
      '<label class="f">회사 메일 <span style="font-weight:500">(내 기록과 연결)</span></label><input type="email" id="p-email" value="' + esc(m.email || '') + '" placeholder="아이디' + ALLOWED_EMAIL_DOMAIN + '">' +
      '<div class="row"><div class="grow"><label class="f">파트</label><select id="p-part">' + PARTS.map(function (p) {
        return '<option value="' + p.key + '"' + (p.key === (m.part || '') ? ' selected' : '') + '>' + p.label + '</option>';
      }).join('') + '</select></div>' +
      '<div class="grow"><label class="f">상태</label><select id="p-status">' + Object.keys(STATUS).map(function (k) {
        return '<option value="' + k + '"' + (k === (m.status || 'active') ? ' selected' : '') + '>' + STATUS[k] + '</option>';
      }).join('') + '</select></div>' +
      '<div style="width:80px"><label class="f">순서</label><input type="number" id="p-order" value="' + (m.order || 0) + '"></div></div>' +
      '<label class="f">함께 맡을 수 있는 자리 <span style="font-weight:500">(예배 담당 고를 때 먼저 보입니다)</span></label><div class="checks">' + SLOTS.map(function (s) {
        return '<label><input type="checkbox" data-role="' + s[0] + '"' + (roles[s[0]] ? ' checked' : '') + '> ' + s[1] + '</label>';
      }).join('') + '</div>' +
      '<label class="f">메모 (휴직 기간, 특이사항 등)</label><textarea id="p-note">' + esc(m.note || '') + '</textarea>' +
      '<div class="foot">' + (id ? '<button class="btn bad" id="p-remove">삭제</button><span class="grow"></span>' : '') +
      '<button class="btn" id="p-close">닫기</button><button class="btn pri" id="p-save">저장</button></div>');
    function drawPhoto() {
      $('p-box').innerHTML = photo ? '<div class="photo"><img src="' + photo + '" alt=""></div>' : '<div class="photo">' + esc(($('p-name').value || '?').slice(-2)) + '</div>';
      $('p-del').disabled = !photo;
    }
    drawPhoto();
    $('p-file').onchange = function () {
      var f = this.files[0];
      this.value = '';
      if (f) openCrop(f, function (url) { photo = url; photoChanged = true; drawPhoto(); });
    };
    $('p-del').onclick = function () { photo = ''; photoChanged = true; drawPhoto(); };
    $('p-close').onclick = function () { closeModal(); };
    $('p-save').onclick = function () {
      var name = $('p-name').value.trim();
      if (!name) { toast('이름을 적어 주세요.'); return; }
      var obj = { name: name, part: $('p-part').value, status: $('p-status').value, order: +$('p-order').value || 0 };
      var email = $('p-email').value.trim().toLowerCase();
      if (email) obj.email = email;
      if ($('p-title').value.trim()) obj.title = $('p-title').value.trim();
      if ($('p-note').value.trim()) obj.note = $('p-note').value.trim();
      var rs = {};
      document.querySelectorAll('#modal [data-role]').forEach(function (x) { if (x.checked) rs[x.getAttribute('data-role')] = true; });
      if (Object.keys(rs).length) obj.roles = rs;
      var key = id || db.ref(R + 'members').push().key;
      var jobs = [db.ref(R + 'members/' + key).set(obj)];
      if (photoChanged) jobs.push(db.ref(R + 'photos/' + key).set(photo || null));
      Promise.all(jobs).then(function () { closeModal(); toast('저장했습니다.'); }).catch(fail);
    };
    if (id) $('p-remove').onclick = function () {
      if (!confirm(m.name + ' 님을 명단에서 지울까요?\n지나간 예배 기록에는 "삭제된 인원"으로 남습니다. 섬김을 마친 경우에는 지우지 말고 상태를 "섬김종료"로 바꾸는 것을 권합니다.')) return;
      Promise.all([db.ref(R + 'members/' + id).remove(), db.ref(R + 'photos/' + id).remove()])
        .then(function () { closeModal(); toast('지웠습니다.'); }).catch(fail);
    };
  }

  // 증명사진 3:4 로 자르기 (끌어서 위치, 막대로 확대) → 300x400 JPEG
  function openCrop(file, done) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var W = 240, H = 320, base = Math.max(W / img.width, H / img.height), sc = base;
        var x = (W - img.width * sc) / 2, y = (H - img.height * sc) / 2;
        modal('<h3>사진 맞추기</h3><p class="small muted">끌어서 위치를 맞추고 아래 막대로 확대합니다. 얼굴이 가운데 오도록 맞춰 주세요.</p>' +
          '<div class="crop" id="cr-box"><img id="cr-img" alt=""></div>' +
          '<input type="range" id="cr-zoom" min="1" max="4" step="0.01" value="1" style="width:100%">' +
          '<div class="foot"><button class="btn" id="cr-cancel">취소</button><button class="btn pri" id="cr-ok">이 사진 쓰기</button></div>', 'modal2');
        var el = $('cr-img'), box = $('cr-box'), drag = null;
        el.src = rd.result;
        el.style.width = img.width + 'px';
        el.style.height = img.height + 'px';
        function draw() {
          x = Math.min(0, Math.max(W - img.width * sc, x));
          y = Math.min(0, Math.max(H - img.height * sc, y));
          el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
        }
        draw();
        box.addEventListener('pointerdown', function (ev) { drag = { px: ev.clientX, py: ev.clientY, x: x, y: y }; box.setPointerCapture(ev.pointerId); });
        box.addEventListener('pointermove', function (ev) { if (!drag) return; x = drag.x + ev.clientX - drag.px; y = drag.y + ev.clientY - drag.py; draw(); });
        box.addEventListener('pointerup', function () { drag = null; });
        $('cr-zoom').addEventListener('input', function () {
          var ns = base * +this.value;
          x = W / 2 - (W / 2 - x) * ns / sc;
          y = H / 2 - (H / 2 - y) * ns / sc;
          sc = ns; draw();
        });
        $('cr-cancel').onclick = function () { closeModal('modal2'); };
        $('cr-ok').onclick = function () {
          var cv = document.createElement('canvas'), k = 300 / W, g;
          cv.width = 300; cv.height = 400;
          g = cv.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 400);
          g.drawImage(img, x * k, y * k, img.width * sc * k, img.height * sc * k);
          closeModal('modal2');
          done(cv.toDataURL('image/jpeg', 0.85));
        };
      };
      img.onerror = function () { toast('이 사진 파일은 열 수 없습니다. JPG 또는 PNG로 올려 주세요.'); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  function editAward(p, rows) {
    var a = S.awards[p.key] || {}, win = a.winners || {};
    var ids = rows.map(function (r) { return r.id; });
    Object.keys(win).forEach(function (k) { if (ids.indexOf(k) < 0) ids.push(k); });
    var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
    modal('<h3>' + p.label + ' 우수 스텝</h3><p class="small muted">순위가 높은 사람부터 보입니다. 포상할 사람을 고르고 격려의 말을 남겨 주세요.</p>' +
      '<div style="max-height:300px;overflow-y:auto">' + ids.map(function (id) {
        var r = byId[id];
        return '<label class="row small" style="margin:4px 0;flex-wrap:nowrap"><input type="checkbox" data-win="' + id + '"' + (win[id] ? ' checked' : '') + '>' +
          avatar(id, 24) + '<b>' + esc(nameOf(id)) + '</b><span class="muted">' + (r ? r.rank + '위 · ' + r.total + '회' + (p.to >= cfg().pointStart ? ' · ' + r.points + '점' : '') : '') + '</span></label>';
      }).join('') + '</div>' +
      '<label class="f">격려의 말</label><textarea id="w-msg" placeholder="예: 한 해 동안 이른 아침 자리를 지켜 주셔서 감사합니다.">' + esc(a.message || '') + '</textarea>' +
      '<div class="foot">' + (S.awards[p.key] ? '<button class="btn bad" id="w-del">선정 취소</button><span class="grow"></span>' : '') +
      '<button class="btn" id="w-close">닫기</button><button class="btn gold" id="w-save">저장</button></div>');
    $('w-close').onclick = function () { closeModal(); };
    $('w-save').onclick = function () {
      var w = {};
      document.querySelectorAll('#modal [data-win]').forEach(function (x) { if (x.checked) w[x.getAttribute('data-win')] = true; });
      if (!Object.keys(w).length) { toast('한 명 이상 골라 주세요.'); return; }
      db.ref(R + 'awards/' + p.key).set({ label: p.label, winners: w, message: $('w-msg').value.trim() || null, at: Date.now(), by: S.user.displayName || S.user.email })
        .then(function () { closeModal(); toast('저장했습니다.'); }).catch(fail);
    };
    if (S.awards[p.key]) $('w-del').onclick = function () {
      if (!confirm(p.label + ' 우수 스텝 선정을 취소할까요?')) return;
      db.ref(R + 'awards/' + p.key).remove().then(function () { closeModal(); }).catch(fail);
    };
  }

  // ---------- 동작 연결 ----------
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]');
    if (!b || !$('main').contains(b)) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'm-prev') { S.month = addMonth(S.month, -1); render(true); }
    else if (act === 'm-next') { S.month = addMonth(S.month, 1); render(true); }
    else if (act === 'm-now') { S.month = todayKey().slice(0, 7); render(true); }
    else if (act === 'notice') editNotice();
    else if (act === 'ev-new') editEvent(null);
    else if (act === 'ev-edit') editEvent(id);
    else if (act === 'ev-att') editAttend(id);
    else if (act === 'mem') showMember(id);
    else if (act === 'mem-new') editMember(null);
    else if (act === 'st-mode') { S.statMode = id; render(true); }
    else if (act === 'st-csv') statsCsv();
    else if (act === 'award') { var p = periodRange(); editAward(p, ranking(tally(p.from, p.to), p.to >= cfg().pointStart)); }
    else if (act === 's-save') saveSettings();
    else if (act === 'backup') backup();
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'q') { S.q = ev.target.value; render(true); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!$('main').contains(t)) return;
    if (t.id === 'show-retired') { S.showRetired = t.checked; render(true); }
    else if (t.id === 'st-year') { S.statYear = t.value; render(true); }
    else if (t.id === 'st-sub') { if (S.statMode === 'month') S.statMonth = t.value; else S.statQ = +t.value; render(true); }
    else if (t.id === 'imp') importFile(t.files[0]);
    else if (t.hasAttribute('data-admin')) setAdmin(t.getAttribute('data-admin'), t.checked);
  });

  function statsCsv() {
    var p = periodRange(), usePoints = p.to >= cfg().pointStart, rows = ranking(tally(p.from, p.to), usePoints);
    var lines = [['순위', '이름', '파트', '상태', '섬김', '출석', '합계', '시간(분)'].concat(usePoints ? ['포인트'] : []).join(',')];
    rows.forEach(function (r) {
      var m = S.members[r.id] || {};
      lines.push([r.rank, nameOf(r.id), partOf(m.part).label, STATUS[m.status || 'active'] || '', r.serve, r.attend, r.total, r.minutes].concat(usePoints ? [r.points] : [])
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
    });
    download('찬양팀_섬김_' + p.key + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function saveSettings() {
    var minutes = {};
    document.querySelectorAll('#main [data-min]').forEach(function (x) { minutes[x.getAttribute('data-min')] = Math.max(0, +x.value || 0); });
    var start = $('s-start').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { toast('포인트 계산 시작일을 골라 주세요.'); return; }
    db.ref(R + 'settings').set({ pointStart: start, servePoint: +$('s-serve').value || 0, attendPoint: +$('s-attend').value || 0, minutes: minutes })
      .then(function () { toast('기준을 저장했습니다.'); render(true); }).catch(fail);
  }

  function setAdmin(uid, on) {
    var u = S.users[uid] || {};
    db.ref(R + 'admins/' + uid).set(on ? { email: u.email || '', name: u.name || '' } : null)
      .then(function () { toast(on ? '관리자로 지정했습니다.' : '관리자에서 뺐습니다.'); }).catch(fail);
  }

  function importFile(f) {
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var data;
      try { data = JSON.parse(rd.result); } catch (e) { toast('파일을 읽지 못했습니다.'); return; }
      if (!data.members || !data.events) { toast('기초자료 파일 형식이 아닙니다.'); return; }
      var nm = Object.keys(data.members).length, ne = Object.keys(data.events).length;
      var has = Object.keys(S.members).length || Object.keys(S.events).length;
      if (!confirm('명단 ' + nm + '명, 예배 ' + ne + '건을 불러옵니다.' + (has ? '\n지금 있는 명단과 예배 기록은 이 파일 내용으로 바뀝니다.' : '') + '\n계속할까요?')) return;
      db.ref(R.slice(0, -1)).update({ members: data.members, events: data.events })
        .then(function () { toast('불러왔습니다.'); }).catch(fail);
    };
    rd.readAsText(f, 'utf-8');
  }

  function backup() {
    var data = { members: S.members, events: S.events, photos: S.photos, awards: S.awards, settings: S.settings, notice: S.notice, savedAt: new Date().toISOString() };
    download('찬양팀_백업_' + todayKey() + '.json', JSON.stringify(data, null, 1), 'application/json');
  }

  start();
})();
