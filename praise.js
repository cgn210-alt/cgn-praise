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
  // 감사 카드(시작 · 복귀 감사) 아이콘
  var LETTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/></svg>';
  // 배지의 뜻 (guide.html 과 같은 내용. 성경 본문은 디자인 영감이며 직접 인용하지 않음)
  var MEANING = {
    1: ['씨앗의 자람', '마가복음 4:26-29 · 시편 1:3', '작은 씨앗이 자라 나무가 되듯, 이른 아침 꾸준히 이어 온 섬김을 기억합니다.'],
    2: ['공동체를 밝히는 빛', '마태복음 5:14-16', '각자의 자리에서 예배를 밝혀 준 섬김을 기억합니다.'],
    3: ['주님 안에 거함과 열매', '요한복음 15:5', '주님 안에 머물며 함께 맺어 가는 열매를 기억합니다.'],
    4: ['함께 거두는 수고', '시편 126:5-6', '함께 뿌리고 함께 거두어 온 한 해의 수고를 기억합니다.']
  };
  var TIER_DESC = {
    BEGIN: '동행 · 약속한 일정의 70% 이상을 함께했습니다.',
    GROW: '자람 · 약속한 일정의 85% 이상을 함께했습니다.',
    BLOOM: '결실 · 약속한 일정의 95% 이상을 함께했습니다.',
    CARD: '감사 카드 · 약속한 일정이 13회보다 적은 분기에, 시작하거나 다시 돌아와 함께한 걸음에 감사를 전합니다.'
  };
  // 사진이 없을 때 보이는 사람 모양 (이름 글자와 겹치지 않게)
  var PERSON = '<svg class="ph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4.2"/><path d="M3.5 22c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8z"/></svg>';
  var R = 'praise/';
  // 관리자(지기) 단계: 총괄지기는 firebase-config.js 의 MASTER_EMAIL, 나머지는 총괄지기가 관리 탭에서 지정
  var ROLES = {
    master: ['총괄지기', '최고 관리자', '모든 권한, 배지 수여, 지기 지정'],
    ops: ['운영지기', '총무', '명단 · 사진, 감사 인사, 문서 · 인쇄, 기준 · 자료, 예배 담당 · 출석 · 공지'],
    team: ['팀지기', '운영자', '예배 담당 · 출석 체크 · 공지']
  };
  function roleLabel(r) { return ROLES[r] ? ROLES[r][0] + '(' + ROLES[r][1] + ')' : ''; }

  // EM1 배지 (guide.html 과 같은 기준). 분기 참여율 = 실제 수행 A / 약속한 일정 D
  var TIERS = [['BLOOM', '결실', 95], ['GROW', '자람', 85], ['BEGIN', '동행', 70]];
  var TIER_LABEL = { BEGIN: '동행', GROW: '자람', BLOOM: '결실', CARD: '감사 카드' };
  var QBADGE = {
    1: { BEGIN: ['EM1-Q1-BEGIN-seed.png', '씨앗'], GROW: ['EM1-Q1-GROW-sprout.png', '새싹'], BLOOM: ['EM1-Q1-BLOOM-tree.png', '나무'] },
    2: { BEGIN: ['EM1-Q2-BEGIN-lamp.png', '작은 등불'], GROW: ['EM1-Q2-GROW-lamp.png', '풍성한 등불'], BLOOM: ['EM1-Q2-BLOOM-light.png', '빛을 퍼뜨리는 등불'] },
    3: { BEGIN: ['EM1-Q3-BEGIN-leaf.png', '포도잎'], GROW: ['EM1-Q3-GROW-vine.png', '포도 가지'], BLOOM: ['EM1-Q3-BLOOM-grapes.png', '포도송이'] },
    4: { BEGIN: ['EM1-Q4-BEGIN-wheat.png', '한 이삭'], GROW: ['EM1-Q4-GROW-sheaf.png', '곡식 단'], BLOOM: ['EM1-Q4-BLOOM-harvest.png', '추수 화환'] }
  };
  var MILES = [['M030', 30, 'EM1-MILESTONE-030.png'], ['M060', 60, 'EM1-MILESTONE-060.png'], ['M100', 100, 'EM1-MILESTONE-100.png']];
  var MIN_SAMPLE = 13;   // D 가 이보다 적으면 정규 배지 대신 시작·복귀 감사 카드
  var YEAR_RATE = 85;    // 연말 완주: 네 분기 배지 + 연간 85% 이상 + 모든 분기 70% 이상
  // 인쇄 양식 (print.html) 과 문서함 (docs 폴더)
  var FORMS = { appreciation: '감사장', letter: '감사 손편지', commendation: '감사표창장' };
  var DOCS = [
    ['EM1-01-appreciation.pdf', '감사장', 'A4 세로 · 손글씨용'],
    ['EM1-02-personal-letter.pdf', '감사 손편지', 'A4 세로 · 손글씨 네 줄'],
    ['EM1-03-commendation.pdf', '감사표창장', 'A4 세로 · 연말 완주'],
    ['EM1-print-set-A4.pdf', '감사 인쇄물 세 장 묶음', '감사장 · 손편지 · 표창장'],
    ['EM1-reflection-award-forms-A4.pdf', '분기 동행 돌아봄 · 연말 수여 양식', 'A4 가로 2쪽'],
    ['EM1-detailed-infographic-A4.pdf', '상세 안내 인포그래픽', 'A4 가로 8쪽'],
    ['EM1-overview-poster-A3.pdf', '요약 포스터', 'A3 세로']
  ];

  var S = {
    user: null, admin: false, master: false,
    members: {}, events: {}, photos: {}, settings: {}, awards: {}, notice: '', users: {}, admins: {},
    badges: {}, cheers: {}, issues: {},
    tab: 'sched', month: '', statMode: 'month', statYear: '', statMonth: '', statQ: 1, showRetired: false, q: '', bYear: ''
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
    return '<span class="av" style="' + st + '">' + PERSON + '</span>';
  }
  function photoBox(id) {
    var m = S.members[id], ph = S.photos[id];
    if (ph) return '<div class="photo"><img src="' + ph + '" alt="' + esc(m && m.name) + '"></div>';
    return '<div class="photo">' + PERSON + '</div>';
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
    if ((ev.absent && ev.absent[id]) || (ev.excused && ev.excused[id])) return null;
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

  // ---------- 배지: 분기 돌아보기 ----------
  function quarterRange(y, q) { return { from: y + '-' + pad(q * 3 - 2) + '-01', to: y + '-' + pad(q * 3) + '-31' }; }
  function suggestTier(o) {
    if (!o.d) return '';
    if (o.d < MIN_SAMPLE) return 'CARD';
    var p = o.a / o.d * 100;   // 반올림 전 비율로 판정
    for (var i = 0; i < TIERS.length; i++) if (p >= TIERS[i][2]) return TIERS[i][0];
    return '';
  }
  // 분기 사람별: 배정 / 승인 제외 / 불참 / 실제 수행 A / 약속한 일정 D (오늘까지 지난 예배)
  function evalQuarter(y, q) {
    var r = quarterRange(y, q), out = {};
    pastEvents(r.from, r.to).forEach(function (ev) {
      slotIds(ev).forEach(function (id) {
        var o = out[id] || (out[id] = { assigned: 0, excused: 0, absent: 0, a: 0 });
        o.assigned++;
        if (ev.excused && ev.excused[id]) o.excused++;
        else if (ev.absent && ev.absent[id]) o.absent++;
        else o.a++;
      });
    });
    Object.keys(out).forEach(function (id) {
      var o = out[id];
      o.d = o.assigned - o.excused;
      o.rate = o.d ? o.a / o.d : 0;
      o.tier = suggestTier(o);
    });
    return out;
  }
  // 연간: 실제 섬김 수(누적 배지), 연간 참여율, 분기별 참여율
  function evalYear(y) {
    var out = {};
    [1, 2, 3, 4].forEach(function (q) {
      var e = evalQuarter(y, q);
      Object.keys(e).forEach(function (id) {
        var o = out[id] || (out[id] = { a: 0, d: 0, q: {} });
        o.a += e[id].a; o.d += e[id].d; o.q[q] = e[id];
      });
    });
    Object.keys(out).forEach(function (id) { var o = out[id]; o.rate = o.d ? o.a / o.d : 0; });
    return out;
  }
  function pct(v) { return (Math.floor(v * 1000) / 10).toFixed(1) + '%'; }
  // 배지 기록 하나의 그림과 이름 (key 예: 2027-Q1, 2027-M030, 2027-YEAR)
  function badgeInfo(key, rec) {
    var y = key.slice(0, 4), part = key.slice(5), code = rec && rec.code;
    if (part.charAt(0) === 'Q') {
      var q = +part.slice(1);
      if (code === 'CARD') return { img: '', title: y + '년 ' + q + '분기 감사 카드', sub: '시작 · 복귀 감사' };
      var b = QBADGE[q] && QBADGE[q][code];
      return { img: b ? 'badges/' + b[0] : '', title: y + '년 ' + q + '분기 ' + (TIER_LABEL[code] || ''), sub: b ? b[1] : '' };
    }
    for (var i = 0; i < MILES.length; i++) if (MILES[i][0] === part) return { img: 'badges/' + MILES[i][2], title: y + '년 누적 ' + MILES[i][1] + '회 기념', sub: '실제 섬김 ' + MILES[i][1] + '회' };
    if (part === 'YEAR') return { img: 'badges/EM1-YEAR-TOGETHER.png', title: y + '년 한 해 함께 완주', sub: '네 분기 배지 · 연간 ' + YEAR_RATE + '% 이상' };
    return { img: '', title: key, sub: '' };
  }
  function badgeImg(key, rec, size) {
    var bi = badgeInfo(key, rec), st = 'width:' + size + 'px;height:' + size + 'px';
    if (!bi.img) return '<span class="bimg card" style="' + st + '" title="' + esc(bi.title) + '">' + LETTER.replace('<svg ', '<svg style="width:' + Math.round(size * 0.6) + 'px;height:' + Math.round(size * 0.6) + 'px" ') + '</span>';
    return '<img class="bimg" src="' + bi.img + '" style="' + st + '" alt="' + esc(bi.title) + '" title="' + esc(bi.title + (bi.sub ? ' · ' + bi.sub : '')) + '">';
  }
  // 다른 사람에게 보여도 되는 배지 (본인이 원하지 않으면 관리자가 '배지 비공개'로 바꿉니다)
  function visibleBadges(id) {
    var m = S.members[id];
    if (m && m.hideBadges && !S.ops && id !== myId()) return {};
    return S.badges[id] || {};
  }
  function yearsOf(bs) {
    var ys = {};
    Object.keys(bs).forEach(function (k) { ys[k.slice(0, 4)] = 1; });
    return Object.keys(ys).sort();
  }
  // 한 해의 배지 수집판: 분기 4칸 + 누적 3칸 + 연말 1칸
  function collection(id, y, size) {
    // 배지를 누르면 관리자는 수정 · 취소, 팀원은 배지의 뜻. 빈칸은 관리자만 눌러 수여
    var bs = visibleBadges(id), h = '<div class="coll">';
    function wrap(k, inner) { return '<span class="bhit" data-act="badge" data-id="' + id + '|' + k + '">' + inner + '</span>'; }
    [1, 2, 3, 4].forEach(function (q) {
      var k = y + '-Q' + q, slot = '<span class="slot" style="width:' + size + 'px;height:' + size + 'px">' + q + '분기</span>';
      h += bs[k] ? wrap(k, badgeImg(k, bs[k], size)) : S.master ? '<span class="bhit" data-act="slot" data-id="' + id + '|' + k + '" title="배지 주기">' + slot + '</span>' : slot;
    });
    h += '<span class="sep"></span>';
    MILES.concat([['YEAR']]).forEach(function (mi) {
      var k = y + '-' + mi[0];
      if (bs[k]) h += wrap(k, badgeImg(k, bs[k], Math.round(size * 0.8)));
    });
    return h + '</div>';
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
    $('who').innerHTML = esc(u.displayName || email) + ' <span class="role" id="who-role"></span><br><button id="logout">로그아웃</button>';
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

    S.bYear = t.slice(0, 4);
    ['members', 'events', 'photos', 'awards', 'users', 'admins', 'settings', 'badges', 'cheers', 'issues'].forEach(function (k) {
      db.ref(R + k).on('value', function (snap) {
        S[k] = snap.val() || {};
        if (k === 'admins') {
          var a = S.admins[u.uid];
          S.role = S.master ? 'master' : a ? (a.role === 'team' ? 'team' : 'ops') : null;
          S.admin = !!S.role;                        // 예배 담당 · 출석 · 공지
          S.ops = S.role === 'master' || S.role === 'ops';   // 관리 탭과 그 밖의 편집
          $('who-role').textContent = S.role ? ROLES[S.role][0] : '';
        }
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
    if (!force && (S.tab === 'admin' || S.tab === 'badges') && act && main.contains(act) && /INPUT|SELECT|TEXTAREA/.test(act.tagName)) return;
    if (S.tab === 'admin' && !S.ops) S.tab = 'sched';
    $('tab-admin').classList.toggle('hidden', !S.ops);
    $('tabs').querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    var focusId = act && act.id, sel = focusId === 'q' ? act.selectionStart : null;
    var view = { sched: renderSched, roster: renderRoster, stats: renderStats, badges: renderBadges, mine: renderMine, admin: renderAdmin }[S.tab] || renderSched;
    main.innerHTML = view();
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
      // 최근 날짜가 위로
      .sort(function (a, b) { return a.date > b.date ? -1 : a.date < b.date ? 1 : (a.id < b.id ? -1 : 1); });
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
        ids.map(function (id) { return chip(id, me, (e.absent && e.absent[id]) || (e.excused && e.excused[id])); }).join('') + '</div>';
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
      '<span class="grow"></span>' + (S.ops ? '<button class="btn pri" data-act="mem-new">+ 인원 추가</button>' : '') + '</div></div>';
    PARTS.forEach(function (p) {
      var ms = list.filter(function (m) { return partOf(m.part).key === p.key; });
      if (!ms.length) return;
      h += '<h3 class="part">' + p.label + ' <span class="cnt">' + ms.length + '명</span></h3><div class="grid">' + ms.map(memCard).join('') + '</div>';
    });
    if (!list.length) h += '<div class="card muted">' + (all.length ? '찾는 이름이 없습니다.' : '명단이 비어 있습니다.' + (S.ops ? ' 관리 탭에서 기초자료를 불러오거나 인원을 추가해 주세요.' : '')) + '</div>';
    return h;
  }
  function memCard(m) {
    var st = m.status || 'active';
    var extra = Object.keys(m.roles || {}).filter(function (k) { return m.roles[k]; }).map(slotLabel).join('·');
    // 배지가 있는 가장 최근 해의 배지를 이름 아래 작게 표시
    var bs = visibleBadges(m.id), ys = yearsOf(bs), ly = ys[ys.length - 1];
    var icons = ly ? Object.keys(bs).filter(function (k) { return k.slice(0, 4) === ly; }).sort()
      .map(function (k) { return badgeImg(k, bs[k], 20); }).join('') : '';
    return '<div class="mem' + (st !== 'active' && st !== 'guest' ? ' off' : '') + '" data-act="mem" data-id="' + m.id + '">' + photoBox(m.id) +
      '<div class="nm">' + esc(m.name) + '</div><div class="meta">' +
      (m.title ? '<span class="badge title">' + esc(m.title) + '</span> ' : '') +
      (st !== 'active' ? '<span class="badge ' + st + '">' + STATUS[st] + '</span> ' : '') + (extra ? '+' + esc(extra) : '') + '</div>' +
      (icons ? '<div class="mini-b" title="' + ly + '년 배지">' + icons + '</div>' : '') + '</div>';
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
  function records(t) {
    var rows = Object.keys(t).map(function (id) {
      var r = t[id];
      return { id: id, serve: r.serve, attend: r.attend, total: r.serve + r.attend, minutes: r.minutes, points: r.points };
    });
    // 순위를 매기지 않고 가나다순으로 (guide.html: 순위표는 쓰지 않습니다)
    rows.sort(function (a, b) { return nameOf(a.id).localeCompare(nameOf(b.id), 'ko'); });
    return rows;
  }
  function renderStats() {
    var p = periodRange(), c = cfg(), t = tally(p.from, p.to), evs = pastEvents(p.from, p.to);
    var usePoints = p.to >= c.pointStart;
    var rows = records(t);
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

    h += '<div class="card"><b>' + p.label + ' 함께한 기록</b> <span class="small muted">가나다순</span>';
    if (!rows.length) h += '<p class="muted small">기록이 없습니다.</p>';
    else {
      h += '<div class="tbl-wrap"><table class="rank"><thead><tr><th class="l">이름</th><th class="l">파트</th><th>섬김</th><th>출석</th><th>시간</th>' + (usePoints ? '<th>포인트</th>' : '') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          var m = S.members[r.id] || {};
          return '<tr><td class="l"><span class="row" style="gap:6px;flex-wrap:nowrap">' + avatar(r.id, 24) + esc(nameOf(r.id)) + '</span></td>' +
            '<td class="l muted">' + partOf(m.part).label + '</td><td>' + r.serve + '</td><td>' + r.attend + '</td><td>' + hm(r.minutes) + '</td>' +
            (usePoints ? '<td><b>' + r.points + '</b></td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += '</div>';

    var past = Object.keys(S.awards).sort().reverse().filter(function (k) { return k !== p.key; });
    if (past.length) {
      h += '<div class="card"><b>지난 감사 인사</b>' + past.map(function (k) {
        var a = S.awards[k];
        return '<div class="small" style="margin-top:6px"><b>' + esc(a.label || k) + '</b> · ' + Object.keys(a.winners || {}).map(nameOf).map(esc).join(', ') + '</div>';
      }).join('') + '</div>';
    }
    return h;
  }
  function tile(k, v, unit) { return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v + ' <small>' + unit + '</small></div></div>'; }
  function awardCard(p, rows) {
    var a = S.awards[p.key];
    if (!a && !S.ops) return '';
    var h = '<div class="card award"><div class="row"><b>' + p.label + ' 감사 인사</b><span class="grow"></span>' +
      (S.ops ? '<button class="btn sm gold" data-act="award">' + (a ? '수정' : '감사 전하기') + '</button>' : '') + '</div>';
    if (!a) return h + '<p class="small muted" style="margin:6px 0 0">특별히 고마웠던 분께 감사를 전하는 자리입니다. 상이나 순위가 아니라 고마움을 나누는 인사입니다.</p></div>';
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
    // 내 배지: 올해 수집판과 이번 분기 진행 (압박이 아니라 돌아보기용)
    var cq = Math.ceil(+mo / 3), eq = evalQuarter(y, cq)[id], myB = S.badges[id] || {};
    h += '<div class="card mybadge"><div class="row"><b>' + y + '년 내 배지</b><span class="grow"></span><a class="small" href="guide.html">배지 안내</a></div>' + collection(id, y, 48) +
      '<div class="small" style="margin-top:8px">' + (eq ? cq + '분기 지금까지 담당 ' + eq.assigned + '회 중 ' + eq.a + '회 섬김' + (eq.excused ? ' · 승인 제외 ' + eq.excused + '회' : '') +
        (eq.d ? ' · 참여율 ' + pct(eq.rate) : '') : cq + '분기 담당 기록이 아직 없습니다.') + '</div>' +
      '<div class="small muted">분기가 끝나면 담당자 확인을 거쳐 배지가 수여됩니다. 기록이 다르면 7일 안에 관리자에게 알려 주세요.' + (m.hideBadges ? ' 지금은 배지 비공개로 되어 있습니다.' : '') + '</div></div>';
    var bkeys = Object.keys(myB).sort().reverse();
    if (bkeys.length) {
      h += '<div class="card"><b>받은 배지와 축하</b>' + bkeys.map(function (k) {
        var bi = badgeInfo(k, myB[k]);
        return '<div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:10px;margin-top:12px"><span class="bhit" data-act="meaning" data-id="' + id + '|' + k + '">' + badgeImg(k, myB[k], 44) + '</span>' +
          '<div class="grow" style="min-width:0"><b>' + esc(bi.title) + '</b> <span class="small muted">' + esc(bi.sub) + '</span>' +
          (myB[k].note ? '<div class="msg small">' + esc(myB[k].note) + '</div>' : '') + cheerBlock(id, k) + '</div></div>';
      }).join('') + '</div>';
    }
    h += '<div class="tiles">' + box(+mo + '월', y + '-' + mo + '-01', y + '-' + mo + '-31') +
      box(q + '분기', y + '-' + pad(q * 3 - 2) + '-01', y + '-' + pad(q * 3) + '-31') +
      box(y + '년', y + '-01-01', y + '-12-31') + box('누적', '0000-00-00', '9999-12-31') + '</div>';

    var all = Object.keys(S.events).map(function (k) { return Object.assign({ id: k }, S.events[k]); }).filter(function (e) { return e.date; });
    var up = all.filter(function (e) { return e.date >= t && rolesIn(e, id).length; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    h += '<div class="card"><b>앞으로 맡은 예배</b>' + (up.length ? up.map(function (e) {
      return '<div class="row small" style="margin-top:6px"><b class="dt">' + fullDate(e.date) + '</b><span class="grow">' + esc(e.title || TYPES[e.type]) + '</span><span class="badge type">' + rolesIn(e, id).join('·') + '</span></div>';
    }).join('') : '<p class="small muted" style="margin:6px 0 0">등록된 담당이 없습니다.</p>') + '</div>';

    var aw = Object.keys(S.awards).filter(function (k) { return S.awards[k].winners && S.awards[k].winners[id]; }).sort().reverse();
    if (aw.length) h += '<div class="card award"><b>받은 감사 인사</b>' + aw.map(function (k) { return '<div class="small" style="margin-top:4px">' + esc(S.awards[k].label || k) + '</div>'; }).join('') + '</div>';

    var hist = all.filter(function (e) { return e.date < t || e.date === t; })
      .filter(function (e) { return involvement(e, id); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<div class="card"><b>지난 섬김 기록</b> <span class="small muted">' + hist.length + '건</span>' + hist.slice(0, 40).map(function (e) {
      var kind = involvement(e, id);
      return '<div class="row small" style="margin-top:6px"><span class="dt">' + fullDate(e.date) + '</span><span class="grow">' + esc(e.title || TYPES[e.type]) + '</span><span class="muted">' + (kind === 'serve' ? rolesIn(e, id).join('·') : '출석') + '</span></div>';
    }).join('') + (hist.length > 40 ? '<p class="small muted">최근 40건만 보입니다.</p>' : '') + '</div>';
    return h;
  }

  // ----- 배지 -----
  function dateKeyOf(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function badgeFeed(limit) {
    var list = [];
    Object.keys(S.badges).forEach(function (id) {
      var bs = visibleBadges(id);
      Object.keys(bs).forEach(function (k) { list.push({ id: id, key: k, rec: bs[k] }); });
    });
    return list.sort(function (a, b) { return (b.rec.at || 0) - (a.rec.at || 0); }).slice(0, limit);
  }
  function cheerKey(id, key) { return id + '_' + key; }
  function myName() { var me = myId(); return me ? S.members[me].name : (S.user.displayName || S.user.email.split('@')[0]); }
  // 배지마다 팀원이 남기는 축하 · 응원 한 줄 (받은 사람은 읽기만)
  function cheerBlock(id, key) {
    var ck = cheerKey(id, key), cs = S.cheers[ck] || {}, uid = S.user.uid;
    var list = Object.keys(cs).map(function (u) { return Object.assign({ uid: u }, cs[u]); })
      .sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    var h = '<div class="cheers">';
    list.forEach(function (c) {
      h += '<div class="cheer"><b>' + esc(c.name || '팀원') + '</b> ' + esc(c.text) +
        (c.uid === uid || S.admin ? ' <x data-act="cheer-del" data-id="' + ck + '|' + c.uid + '" title="지우기">✕</x>' : '') + '</div>';
    });
    if (id !== myId()) {
      h += '<div class="cheer-in">' + ['축하해요', '수고 많으셨어요', '함께해서 감사해요'].map(function (t) {
        return '<button class="btn sm" data-act="cheer-quick" data-id="' + ck + '" data-text="' + t + '">' + t + '</button>';
      }).join('') + '<span class="cheer-own"><input type="text" maxlength="100" placeholder="직접 쓰기" data-cheer="' + ck + '">' +
        '<button class="btn sm pri" data-act="cheer-send" data-id="' + ck + '">남기기</button></span></div>';
    }
    return h + '</div>';
  }
  function sendCheer(ck, text) {
    text = (text || '').trim();
    if (!text) { toast('한 줄을 적어 주세요.'); return; }
    db.ref(R + 'cheers/' + ck + '/' + S.user.uid).set({ name: myName(), text: text.slice(0, 100), at: Date.now() })
      .then(function () { toast('축하를 남겼습니다.'); }).catch(fail);
  }
  function renderBadges() {
    var y = S.bYear, years = {}, me = myId();
    years[todayKey().slice(0, 4)] = 1; years[cfg().pointStart.slice(0, 4)] = 1; years[y] = 1;
    Object.keys(S.badges).forEach(function (id) { yearsOf(S.badges[id]).forEach(function (yy) { years[yy] = 1; }); });
    var h = '<div class="card hero"><div class="row" style="flex-wrap:nowrap;gap:14px"><img src="em1-logo.png" alt="EM1" class="hero-logo">' +
      '<div class="grow"><b>함께 자라는 예배자</b><div class="small muted">약속한 섬김의 꾸준함을 함께 기억하고 축하합니다. 배지는 신앙의 수준을 판정하는 표지가 아닙니다.</div></div></div>' +
      '<div class="row" style="margin-top:10px"><select id="b-year" style="width:auto">' + Object.keys(years).sort().map(function (yy) {
        return '<option' + (yy === y ? ' selected' : '') + '>' + yy + '</option>';
      }).join('') + '</select><a class="btn sm" href="guide.html">배지 안내 보기</a><span class="grow"></span>' +
      (S.master ? '<button class="btn sm gold" data-act="eval-q">분기 돌아보기 · 배지 수여</button><button class="btn sm" data-act="eval-y">누적 · 연말 배지</button>' : '') + '</div></div>';

    var feed = badgeFeed(15);
    h += '<h2 class="sec">수여 소식</h2>';
    if (!feed.length) h += '<div class="card muted small">아직 수여된 배지가 없습니다. 분기를 함께 돌아본 뒤 이곳에서 축하합니다.</div>';
    feed.forEach(function (f) {
      var bi = badgeInfo(f.key, f.rec);
      h += '<div class="card feed"><div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:12px"><span class="bhit" data-act="meaning" data-id="' + f.id + '|' + f.key + '" title="배지의 뜻 보기">' + badgeImg(f.key, f.rec, 64) + '</span>' +
        '<div class="grow" style="min-width:0"><div><b>' + esc(nameOf(f.id)) + '</b> 님 · ' + esc(bi.title) + '</div>' +
        '<div class="small muted">' + esc(bi.sub) + (f.rec.at ? ' · ' + fullDate(dateKeyOf(f.rec.at)) : '') + '</div>' +
        (f.rec.note ? '<div class="msg small">' + esc(f.rec.note) + '</div>' : '') + cheerBlock(f.id, f.key) + '</div></div></div>';
    });

    h += '<h2 class="sec">' + y + '년 배지 수집판 <span class="small muted" style="font-weight:500">파트 순서</span></h2><div class="board">';
    sortedMembers().forEach(function (m) {
      var mine = Object.keys(visibleBadges(m.id)).filter(function (k) { return k.slice(0, 4) === y; });
      if (!mine.length && (m.status || 'active') !== 'active') return;
      if (m.hideBadges && !S.ops && m.id !== me) return;
      h += '<div class="bcard' + (m.id === me ? ' me' : '') + '" data-act="mem" data-id="' + m.id + '"><div class="row" style="flex-wrap:nowrap;gap:8px">' + avatar(m.id, 30) +
        '<b class="grow">' + esc(m.name) + '</b>' + (m.hideBadges ? '<span class="badge retired">비공개</span>' : '') + '</div>' + collection(m.id, y, 34) + '</div>';
    });
    return h + '</div>';
  }

  // 관리자: 분기 돌아보기와 배지 수여
  function lastQuarter() {
    var t = todayKey(), cq = Math.ceil(+t.slice(5, 7) / 3), y = +t.slice(0, 4);
    return cq === 1 ? [String(y - 1), 4] : [String(y), cq - 1];
  }
  function yearChoices(y) {
    var ys = [];
    for (var yy = +cfg().pointStart.slice(0, 4) - 1; yy <= +todayKey().slice(0, 4) + 1; yy++) ys.push(String(yy));
    if (ys.indexOf(y) < 0) ys.push(y);
    return ys.sort();
  }
  function evalQuarterModal(y, q) {
    if (!y) { var lq = lastQuarter(); y = lq[0]; q = lq[1]; }
    var key = y + '-Q' + q, ev = evalQuarter(y, q), rg = quarterRange(y, q), ended = rg.to < todayKey();
    var ids = Object.keys(ev);
    Object.keys(S.badges).forEach(function (id) { if (S.badges[id][key] && ids.indexOf(id) < 0) ids.push(id); });
    var order = sortedMembers().map(function (m) { return m.id; });
    ids.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    modal('<h3>분기 돌아보기 · 배지 수여</h3>' +
      '<div class="row"><select id="eq-y" style="width:auto">' + yearChoices(y).map(function (v) { return '<option' + (v === y ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
      '<select id="eq-q" style="width:auto">' + [1, 2, 3, 4].map(function (v) { return '<option value="' + v + '"' + (v === +q ? ' selected' : '') + '>' + v + '분기</option>'; }).join('') + '</select></div>' +
      '<p class="small muted">참여율 = 실제 수행 A ÷ 약속한 일정 D(배정 − 승인 제외). 동행 ' + TIERS[2][2] + '% · 자람 ' + TIERS[1][2] + '% · 결실 ' + TIERS[0][2] + '% 이상, D가 ' + MIN_SAMPLE + '회 미만이면 감사 카드를 제안합니다(미리 고르지는 않습니다). 제안은 참고이며 수여는 관리자가 정합니다.' +
      (ended ? '' : '<br><b style="color:var(--bad)">아직 분기가 끝나지 않았습니다. 오늘까지의 기록으로 계산합니다.</b>') + '</p>' +
      (ids.length ? '<div class="tbl-wrap"><table class="rank"><thead><tr><th class="l">이름</th><th>배정</th><th>제외</th><th>D</th><th>A</th><th>참여율</th><th class="l">수여</th></tr></thead><tbody>' +
        ids.map(function (id) {
          var o = ev[id] || { assigned: 0, excused: 0, d: 0, a: 0, rate: 0, tier: '' }, cur = S.badges[id] && S.badges[id][key], val = cur ? cur.code : (o.tier === 'CARD' ? '' : o.tier);
          return '<tr><td class="l">' + esc(nameOf(id)) + (cur ? ' <span class="badge title">수여됨</span>' : '') + '</td><td>' + o.assigned + '</td><td>' + o.excused + '</td><td>' + o.d + '</td><td>' + o.a + '</td>' +
            '<td>' + (o.d ? pct(o.rate) : '-') + '</td><td class="l"><select data-tier="' + id + '" style="width:auto;padding:3px 6px">' +
            [['', '수여 안 함'], ['CARD', '감사 카드'], ['BEGIN', '동행'], ['GROW', '자람'], ['BLOOM', '결실']].map(function (op) {
              return '<option value="' + op[0] + '"' + (op[0] === val ? ' selected' : '') + '>' + op[1] + (op[0] && op[0] === o.tier ? ' (제안)' : '') + '</option>';
            }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted small">이 분기에 배정 기록이 없습니다.</p>') +
      '<label class="f">격려의 말 <span style="font-weight:500">(이번에 새로 수여하는 사람의 소식에 함께 보입니다)</span></label>' +
      '<textarea id="eq-note" placeholder="예: 이른 아침 자리를 꾸준히 지켜 주셔서 감사합니다."></textarea>' +
      '<div class="foot"><button class="btn" id="eq-close">닫기</button><button class="btn gold" id="eq-save">수여 저장</button></div>');
    $('eq-y').onchange = $('eq-q').onchange = function () { evalQuarterModal($('eq-y').value, +$('eq-q').value); };
    $('eq-close').onclick = function () { closeModal(); };
    $('eq-save').onclick = function () {
      var up = {}, add = 0, del = 0, note = $('eq-note').value.trim(), by = myName();
      document.querySelectorAll('#modal [data-tier]').forEach(function (x) {
        var id = x.getAttribute('data-tier'), cur = S.badges[id] && S.badges[id][key], o = ev[id] || {};
        if (!x.value && cur) { up['badges/' + id + '/' + key] = null; del++; }
        else if (x.value && (!cur || cur.code !== x.value)) {
          var rec = { code: x.value, a: o.a || 0, d: o.d || 0, at: Date.now(), by: by };
          if (note) rec.note = note;
          up['badges/' + id + '/' + key] = rec; add++;
        }
      });
      if (!add && !del) { toast('바뀐 것이 없습니다.'); return; }
      if (!confirm(y + '년 ' + q + '분기: 새로 수여 ' + add + '명' + (del ? ', 수여 취소 ' + del + '명' : '') + '\n저장할까요?')) return;
      db.ref(R.slice(0, -1)).update(up).then(function () { closeModal(); showBoard(y); }).catch(fail);
    };
  }

  // 수여한 해의 배지 수집판으로 이동
  function showBoard(y) {
    S.tab = 'badges'; S.bYear = String(y);
    try { localStorage.setItem('praise-tab', S.tab); } catch (e) {}
    render(true);
    var b = document.querySelector('#main .board');
    if (b) b.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(y + '년 배지 수집판에 표시했습니다.');
  }

  // 관리자: 한 사람에게 배지 하나 주기 (명단에서 사람을 눌러 '배지 주기')
  function grantOneModal(id, y, kind) {
    y = y || lastQuarter()[0];
    kind = kind || 'Q' + (y === lastQuarter()[0] ? lastQuarter()[1] : 1);
    var key = y + '-' + kind, cur = (S.badges[id] || {})[key], isQ = kind.charAt(0) === 'Q';
    var o = isQ ? (evalQuarter(y, +kind.slice(1))[id] || { assigned: 0, excused: 0, a: 0, d: 0, tier: '' }) : null;
    var yr = !isQ ? (evalYear(y)[id] || { a: 0 }) : null;
    var kinds = [['Q1', '1분기'], ['Q2', '2분기'], ['Q3', '3분기'], ['Q4', '4분기']].concat(MILES.map(function (mi) { return [mi[0], '누적 ' + mi[1] + '회 기념']; }), [['YEAR', '한 해 함께 완주']]);
    var tierVal = cur ? cur.code : (o && o.tier) || 'BEGIN';
    modal('<h3>' + esc(nameOf(id)) + ' 님 배지 주기</h3>' +
      '<div class="row"><select id="g1-y" style="width:auto">' + yearChoices(y).map(function (v) { return '<option' + (v === y ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
      '<select id="g1-k" style="width:auto">' + kinds.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === kind ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select>' +
      (isQ ? '<select id="g1-t" style="width:auto">' + [['BEGIN', '동행'], ['GROW', '자람'], ['BLOOM', '결실'], ['CARD', '감사 카드']].map(function (op) {
        return '<option value="' + op[0] + '"' + (op[0] === tierVal ? ' selected' : '') + '>' + op[1] + (o && op[0] === o.tier ? ' (제안)' : '') + '</option>';
      }).join('') + '</select>' : '') + '</div>' +
      '<div class="row" style="margin-top:10px;gap:12px;flex-wrap:nowrap"><span id="g1-prev"></span><div class="small">' +
      (isQ ? '배정 ' + o.assigned + '회 · 승인 제외 ' + o.excused + '회 · 약속한 일정 D ' + o.d + '회 · 실제 수행 A ' + o.a + '회' + (o.d ? ' · 참여율 ' + pct(o.a / o.d) : '') +
        (o.d && o.d < MIN_SAMPLE ? '<br>D가 ' + MIN_SAMPLE + '회 미만이라 운영안은 감사 카드를 권합니다.' : '')
        : y + '년 실제 섬김 ' + yr.a + '회') +
      (cur ? '<br><b style="color:var(--gold-d)">이미 수여됨: ' + esc(badgeInfo(key, cur).title) + '</b>' : '') + '</div></div>' +
      '<label class="f">격려의 말 (수여 소식에 함께 보입니다)</label><textarea id="g1-note">' + esc(cur && cur.note || '') + '</textarea>' +
      '<div class="foot">' + (cur ? '<button class="btn bad" id="g1-del">수여 취소</button><span class="grow"></span>' : '') +
      '<button class="btn" id="g1-close">닫기</button><button class="btn gold" id="g1-save">' + (cur ? '바꾸기' : '배지 주기') + '</button></div>');
    function code() { return isQ ? $('g1-t').value : kind; }
    function preview() { $('g1-prev').innerHTML = badgeImg(key, { code: code() }, 64); }
    preview();
    if (isQ) $('g1-t').onchange = preview;
    $('g1-y').onchange = function () { grantOneModal(id, $('g1-y').value, $('g1-k').value); };
    $('g1-k').onchange = function () { grantOneModal(id, $('g1-y').value, $('g1-k').value); };
    $('g1-close').onclick = function () { closeModal(); };
    $('g1-save').onclick = function () {
      var rec = { code: code(), a: isQ ? o.a : yr.a, at: Date.now(), by: myName() };
      if (isQ) rec.d = o.d;
      if ($('g1-note').value.trim()) rec.note = $('g1-note').value.trim();
      db.ref(R + 'badges/' + id + '/' + key).set(rec).then(function () { closeModal(); showBoard(y); }).catch(fail);
    };
    if (cur) $('g1-del').onclick = function () {
      if (!confirm(nameOf(id) + ' 님의 ' + badgeInfo(key, cur).title + ' 수여를 취소할까요?')) return;
      db.ref(R + 'badges/' + id + '/' + key).remove().then(function () { closeModal(); toast('수여를 취소했습니다.'); }).catch(fail);
    };
  }

  function badgeClick(act, id) {
    var p = id.split('|'), mid = p[0], key = p[1], y = key.slice(0, 4), kind = key.slice(5);
    // 배지 수여 · 수정 · 취소는 총괄지기만
    if (act === 'slot') { if (S.master) grantOneModal(mid, y, kind); return; }
    if (act === 'badge' && S.master) { grantOneModal(mid, y, kind); return; }
    badgeMeaning(mid, key);
  }
  function badgeMeaning(mid, key) {
    var rec = (visibleBadges(mid) || {})[key];
    if (!rec) return;
    var bi = badgeInfo(key, rec), kind = key.slice(5), h = '';
    if (kind.charAt(0) === 'Q') {
      var mq = MEANING[+kind.slice(1)];
      if (rec.code !== 'CARD' && mq) h += '<p><b>' + mq[0] + '</b> <span class="muted small">' + mq[1] + '</span><br>' + mq[2] + '</p>';
      h += '<p>' + (TIER_DESC[rec.code] || '') + '</p>';
    } else if (kind === 'YEAR') {
      h += '<p>네 분기 배지를 모두 받고 한 해 동안 약속한 일정의 ' + YEAR_RATE + '% 이상을 함께했습니다.</p><p class="small muted">고린도전서 9:25에서 디자인 영감을 얻었습니다. 교회의 감사 표시를 성경이 말하는 상급과 같게 여기지 않습니다.</p>';
    } else {
      h += '<p>그해 실제로 섬긴 예배가 ' + kind.slice(1).replace(/^0+/, '') + '회가 되었습니다.</p><p class="small muted">숫자는 마가복음 4:8의 30배 · 60배 · 100배 결실에서 영감을 얻었습니다. 섬김 횟수에 대한 명령은 아닙니다.</p>';
    }
    modal('<div class="meaning"><span class="mbig">' + badgeImg(key, rec, 120) + '</span><h3>' + esc(bi.title) + '</h3><div class="muted">' + esc(bi.sub) + '</div></div>' + h +
      '<p class="small"><b>' + esc(nameOf(mid)) + '</b> 님' + (rec.at ? ' · ' + fullDate(dateKeyOf(rec.at)) + ' 수여' : '') + '</p>' +
      (rec.note ? '<div class="msg small">' + esc(rec.note) + '</div>' : '') +
      '<p class="small muted" style="margin-top:12px">배지는 신앙의 수준을 판정하는 표지가 아니라, 함께한 걸음을 기억하고 감사하는 표시입니다. <a href="guide.html#badges">배지 안내 보기</a></p>' +
      '<div class="foot">' + (S.master ? '<button class="btn" id="bm-edit">수정 · 취소</button>' : '') + '<button class="btn pri" id="bm-close">닫기</button></div>');
    $('bm-close').onclick = function () { closeModal(); };
    if (S.master) $('bm-edit').onclick = function () { grantOneModal(mid, key.slice(0, 4), kind); };
  }

  // 관리자: 누적 30·60·100회와 연말 완주 배지
  function evalYearModal(y) {
    y = y || todayKey().slice(0, 4);
    var ev = evalYear(y), ids = Object.keys(ev);
    MILES.concat([['YEAR']]).forEach(function (mi) {
      Object.keys(S.badges).forEach(function (id) { if (S.badges[id][y + '-' + mi[0]] && ids.indexOf(id) < 0) ids.push(id); });
    });
    var order = sortedMembers().map(function (m) { return m.id; });
    ids.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    function yearOk(id) {
      var o = ev[id], bs = S.badges[id] || {};
      if (!o || !o.d) return false;
      for (var q = 1; q <= 4; q++) {
        var b = bs[y + '-Q' + q], oq = o.q[q];
        if (!b || b.code === 'CARD' || !oq || !oq.d || oq.a / oq.d < 0.7) return false;
      }
      return o.rate * 100 >= YEAR_RATE;
    }
    modal('<h3>누적 · 연말 배지</h3>' +
      '<div class="row"><select id="ey-y" style="width:auto">' + yearChoices(y).map(function (v) { return '<option' + (v === y ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
      '<p class="small muted">누적 배지는 그해 실제 섬김(승인 제외 미포함) 30 · 60 · 100회, 연말 완주는 네 분기 배지와 연간 참여율 ' + YEAR_RATE + '% 이상, 모든 분기 70% 이상입니다. 기준을 채운 칸은 금색으로 표시합니다.</p>' +
      (ids.length ? '<div class="tbl-wrap"><table class="rank"><thead><tr><th class="l">이름</th><th>실제 섬김</th><th>연간</th><th>30</th><th>60</th><th>100</th><th>완주</th></tr></thead><tbody>' +
        ids.map(function (id) {
          var o = ev[id] || { a: 0, d: 0, rate: 0 }, bs = S.badges[id] || {};
          function box(code, ok) {
            return '<td class="' + (ok ? 'ok-cell' : '') + '"><input type="checkbox" data-ms="' + id + '|' + code + '"' + (bs[y + '-' + code] ? ' checked' : '') + '></td>';
          }
          return '<tr><td class="l">' + esc(nameOf(id)) + '</td><td>' + o.a + '</td><td>' + (o.d ? pct(o.rate) : '-') + '</td>' +
            MILES.map(function (mi) { return box(mi[0], o.a >= mi[1]); }).join('') + box('YEAR', yearOk(id)) + '</tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted small">이 해에 섬김 기록이 없습니다.</p>') +
      '<label class="f">격려의 말</label><textarea id="ey-note" placeholder="예: 한 해 동안 함께 걸어 주셔서 감사합니다."></textarea>' +
      '<div class="foot"><button class="btn" id="ey-close">닫기</button><button class="btn gold" id="ey-save">저장</button></div>');
    $('ey-y').onchange = function () { evalYearModal($('ey-y').value); };
    $('ey-close').onclick = function () { closeModal(); };
    $('ey-save').onclick = function () {
      var up = {}, n = 0, note = $('ey-note').value.trim(), by = myName();
      document.querySelectorAll('#modal [data-ms]').forEach(function (x) {
        var p = x.getAttribute('data-ms').split('|'), k = y + '-' + p[1], has = S.badges[p[0]] && S.badges[p[0]][k];
        if (x.checked && !has) {
          var rec = { code: p[1], a: (ev[p[0]] || {}).a || 0, at: Date.now(), by: by };
          if (note) rec.note = note;
          up['badges/' + p[0] + '/' + k] = rec; n++;
        }
        if (!x.checked && has) { up['badges/' + p[0] + '/' + k] = null; n++; }
      });
      if (!n) { toast('바뀐 것이 없습니다.'); return; }
      db.ref(R.slice(0, -1)).update(up).then(function () { closeModal(); showBoard(y); }).catch(fail);
    };
  }

  // 관리자: 감사장 · 손편지 · 표창장 맞춤 인쇄 (print.html 에서 열림)
  function koDate(key) { return key.slice(0, 4) + '년 ' + (+key.slice(5, 7)) + '월 ' + (+key.slice(8)) + '일'; }
  function printPanel() {
    var s = S.settings || {}, list = sortedMembers().filter(function (m) { return m.status !== 'retired'; });
    return '<div class="card"><b>맞춤 인쇄</b><p class="small muted" style="margin:4px 0 0">이름 · 역할 · 날짜를 채운 양식을 새 창에 엽니다. 새 창에서 글자를 눌러 더 고친 뒤 인쇄하면 됩니다(A4 세로, 배율 100%, 여백 없음, 머리글 · 바닥글 끄기).</p>' +
      '<div class="row"><div class="grow"><label class="f">양식</label><select id="pr-type">' + Object.keys(FORMS).map(function (k) { return '<option value="' + k + '">' + FORMS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="grow"><label class="f">받는 사람</label><select id="pr-mem"><option value="">(빈칸으로)</option>' + list.map(function (m) {
        return '<option value="' + m.id + '">' + esc(m.name) + ' · ' + partOf(m.part).label + '</option>';
      }).join('') + '</select></div></div>' +
      '<div class="row"><div class="grow"><label class="f">섬김 부서 / 역할</label><input type="text" id="pr-role" placeholder="받는 사람을 고르면 파트가 들어갑니다"></div>' +
      '<div class="grow"><label class="f">표창 부문 (표창장)</label><input type="text" id="pr-award" value="함께 완주상"></div></div>' +
      '<div class="row"><div class="grow"><label class="f">날짜</label><input type="date" id="pr-date" value="' + todayKey() + '"></div>' +
      '<div class="grow"><label class="f">수여기관</label><input type="text" id="pr-org" value="' + esc(s.printOrg || '') + '"></div>' +
      '<div class="grow"><label class="f">대표 / 담당자</label><input type="text" id="pr-signer" value="' + esc(s.printSigner || '') + '"></div></div>' +
      '<label class="small" style="display:block;margin-top:8px"><input type="checkbox" id="pr-log" checked> 지급 기록에 남기기</label>' +
      '<div class="foot" style="justify-content:flex-start"><button class="btn pri" data-act="print-open">인쇄 화면 열기</button></div></div>';
  }
  function openPrint() {
    var mid = $('pr-mem').value, m = S.members[mid], type = $('pr-type').value, date = $('pr-date').value || todayKey();
    var data = { type: type, name: m ? m.name : '', role: $('pr-role').value.trim(), award: $('pr-award').value.trim(), date: koDate(date), org: $('pr-org').value.trim(), signer: $('pr-signer').value.trim() };
    try { localStorage.setItem('em1-print', JSON.stringify(data)); } catch (e) {}
    window.open('print.html', '_blank');
    var ss = S.settings || {};
    if ((ss.printOrg || '') !== data.org || (ss.printSigner || '') !== data.signer) db.ref(R + 'settings').update({ printOrg: data.org || null, printSigner: data.signer || null }).catch(function () {});
    if ($('pr-log').checked && m) {
      var rec = { memberId: mid, doc: type, date: date, at: Date.now(), by: myName() };
      if (type === 'commendation' && data.award) rec.award = data.award;
      db.ref(R + 'issues').push(rec).then(function () { toast('지급 기록에 남겼습니다.'); }).catch(fail);
    }
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

    h += '<div class="card"><b>문서함</b><p class="small muted" style="margin:4px 0 8px">손글씨로 채우는 고정 양식과 안내 자료입니다. 열어서 A4 · 실제 크기(100%)로 인쇄하세요. 감사장 · 표창장은 160~200g, 손편지는 100~120g 용지를 권합니다.</p>' +
      DOCS.map(function (d) {
        return '<div class="row small doc"><span class="grow"><b>' + d[1] + '</b> <span class="muted">' + d[2] + '</span></span>' +
          '<a class="btn sm" href="docs/' + d[0] + '" target="_blank" rel="noopener">열기</a><a class="btn sm" href="docs/' + d[0] + '" download>내려받기</a></div>';
      }).join('') + '</div>';
    h += printPanel();
    var iss = Object.keys(S.issues).map(function (k) { return Object.assign({ k: k }, S.issues[k]); }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    h += '<div class="card"><b>지급 기록</b> <span class="small muted">' + iss.length + '건</span>' + (iss.length ? iss.slice(0, 60).map(function (r) {
      return '<div class="row small doc"><span class="dt">' + fullDate(r.date || dateKeyOf(r.at)) + '</span><span class="grow"><b>' + esc(nameOf(r.memberId)) + '</b> · ' + (FORMS[r.doc] || r.doc) +
        (r.award ? ' (' + esc(r.award) + ')' : '') + ' <span class="muted">' + esc(r.by || '') + '</span></span><button class="btn sm bad" data-act="issue-del" data-id="' + r.k + '">지우기</button></div>';
    }).join('') : '<p class="small muted" style="margin:6px 0 0">아직 기록이 없습니다. 맞춤 인쇄에서 "지급 기록에 남기기"를 켜면 쌓입니다.</p>') + '</div>';

    h += '<div class="card"><b>지기 (관리자)</b><div class="roles">' + ['master', 'ops', 'team'].map(function (r) {
        return '<div class="small"><span class="badge title">' + roleLabel(r) + '</span> ' + ROLES[r][2] + '</div>';
      }).join('') + '</div>' +
      '<p class="small muted" style="margin:8px 0">' + (S.master ? '지기 지정은 총괄지기만 할 수 있습니다. 앱에 한 번 로그인한 사람만 목록에 나옵니다.' : '지기 지정은 총괄지기(' + esc(MASTER_NAME) + ')만 할 수 있습니다.') + '</p>';
    h += '<div class="row small doc"><span class="grow"><b>' + esc(MASTER_NAME) + '</b> <span class="muted">' + esc(MASTER_EMAIL) + '</span></span><span class="badge title">' + roleLabel('master') + '</span></div>';
    var users = Object.keys(S.users).map(function (k) { return Object.assign({ uid: k }, S.users[k]); })
      .filter(function (u) { return (u.email || '') !== MASTER_EMAIL.toLowerCase(); })
      .sort(function (a, b) { return (a.name || a.email || '').localeCompare(b.name || b.email || '', 'ko'); });
    users.forEach(function (u) {
      var a = S.admins[u.uid], r = a ? (a.role === 'team' ? 'team' : 'ops') : '';
      if (!S.master && !r) return;
      h += '<div class="row small doc"><span class="grow"><b>' + esc(u.name || '-') + '</b> <span class="muted">' + esc(u.email) + '</span></span>' +
        (S.master ? '<select data-role-of="' + u.uid + '" style="width:auto;padding:3px 8px">' + [['', '지기 아님'], ['ops', roleLabel('ops')], ['team', roleLabel('team')]].map(function (op) {
          return '<option value="' + op[0] + '"' + (op[0] === r ? ' selected' : '') + '>' + op[1] + '</option>';
        }).join('') + '</select>' : '<span class="badge title">' + roleLabel(r) + '</span>') + '</div>';
    });
    h += '</div>';

    h += '<div class="card"><b>자료</b><p class="small muted" style="margin:4px 0 8px">명단 변경 파일(찬양팀_명단변경_날짜.json)을 고르면 바뀐 내용을 먼저 보여 주고, 적용하면 그 사람들의 파트 · 상태 · 메모 · 순서만 바뀝니다. ' +
      '기초자료 파일(찬양팀_기초자료_2026.json)은 명단과 예배 기록 전체를 바꾸므로 처음 한 번만 씁니다. 사진 · 배지 · 감사 인사 · 기준은 어느 쪽이든 그대로 둡니다.</p>' +
      '<div class="row"><label class="btn">파일 불러오기<input type="file" id="imp" accept=".json,application/json" class="hidden"></label>' +
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
      if (src && src.excused) obj.excused = src.excused;
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
    var e = S.events[id], attend = Object.assign({}, e.attend || {}), absent = Object.assign({}, e.absent || {}), excused = Object.assign({}, e.excused || {});
    var served = slotIds(e);
    var others = sortedMembers().filter(function (m) { return served.indexOf(m.id) < 0 && (m.status !== 'retired' || attend[m.id]); });
    function cb(kind, mid, on) {
      return '<label><input type="checkbox" data-' + kind + '="' + mid + '"' + (on ? ' checked' : '') + '> ' + esc(nameOf(mid)) + '</label>';
    }
    modal('<h3>출석 체크</h3><p class="small muted">' + shortDate(e.date) + ' ' + esc(e.title || '') +
      '<br>담당자는 섬김으로 자동 기록됩니다. 오지 못했으면 "불참", 병가·돌봄·공식 사역처럼 미리 또는 나중에 승인된 사유면 "승인 제외"를 고릅니다. 승인 제외는 배지의 약속한 일정(D)에서 빠지고, 사유는 기록하지 않습니다.</p>' +
      (served.length ? '<label class="f">담당자</label><div class="att-list">' + served.map(function (mid) {
        var v = excused[mid] ? 'ex' : absent[mid] ? 'ab' : '';
        return '<div class="row small"><span class="grow">' + esc(nameOf(mid)) + ' <span class="muted">' + rolesIn(e, mid).join('·') + '</span></span>' +
          '<select data-st="' + mid + '" style="width:auto;padding:4px 8px">' +
          '<option value=""' + (v === '' ? ' selected' : '') + '>섬김</option><option value="ab"' + (v === 'ab' ? ' selected' : '') + '>불참</option>' +
          '<option value="ex"' + (v === 'ex' ? ' selected' : '') + '>승인 제외</option></select></div>';
      }).join('') + '</div>' : '') +
      '<p class="small muted" style="margin:6px 0 0">담당 없이 출석한 기록은 결산 횟수에는 들어가지만 배지의 실제 수행에는 들어가지 않습니다.</p>' +
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
      var at = {}, ab = {}, ex = {};
      document.querySelectorAll('#modal [data-at]').forEach(function (x) { if (x.checked) at[x.getAttribute('data-at')] = true; });
      document.querySelectorAll('#modal [data-st]').forEach(function (x) {
        if (x.value === 'ab') ab[x.getAttribute('data-st')] = true;
        if (x.value === 'ex') ex[x.getAttribute('data-st')] = true;
      });
      db.ref(R + 'events/' + id).update({ attend: Object.keys(at).length ? at : null, absent: Object.keys(ab).length ? ab : null, excused: Object.keys(ex).length ? ex : null })
        .then(function () { closeModal(); toast('출석을 저장했습니다.'); }).catch(fail);
    };
  }

  function memberBadges(id) {
    var bs = visibleBadges(id), ys = yearsOf(bs);
    if (!ys.length) return '';
    return '<div class="mb-badges">' + ys.reverse().map(function (y) {
      return '<div class="small muted" style="margin-top:8px">' + y + '년</div>' + collection(id, y, 40);
    }).join('') + '</div>';
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
      '</div></div>' + memberBadges(id) +
      '<div class="tiles" style="margin-top:14px">' +
      '<div class="tile"><div class="k">' + y + '년</div><div class="v">' + (ty.serve + ty.attend) + ' <small>회</small></div><div class="small muted">' + hm(ty.minutes) + (y + '-12-31' >= c.pointStart ? ' · ' + ty.points + '점' : '') + '</div></div>' +
      '<div class="tile"><div class="k">누적</div><div class="v">' + (al.serve + al.attend) + ' <small>회</small></div><div class="small muted">' + hm(al.minutes) + '</div></div></div>' +
      '<div class="foot">' + (S.master ? '<button class="btn gold" id="m-badge">배지 주기</button>' : '') + (S.ops ? '<button class="btn" id="m-edit">편집</button>' : '') + '<button class="btn pri" id="m-close">닫기</button></div>');
    $('m-close').onclick = function () { closeModal(); };
    if (S.ops) $('m-edit').onclick = function () { editMember(id); };
    if (S.master) $('m-badge').onclick = function () { grantOneModal(id); };
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
      '<label class="small" style="display:block;margin-top:10px"><input type="checkbox" id="p-hide"' + (m.hideBadges ? ' checked' : '') + '> 배지 비공개 (본인이 원할 때. 본인과 관리자만 봅니다)</label>' +
      '<div class="foot">' + (id ? '<button class="btn bad" id="p-remove">삭제</button><span class="grow"></span>' : '') +
      '<button class="btn" id="p-close">닫기</button><button class="btn pri" id="p-save">저장</button></div>');
    function drawPhoto() {
      $('p-box').innerHTML = photo ? '<div class="photo"><img src="' + photo + '" alt=""></div>' : '<div class="photo">' + PERSON + '</div>';
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
      if ($('p-hide').checked) obj.hideBadges = true;
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
    modal('<h3>' + p.label + ' 감사 인사</h3><p class="small muted">가나다순으로 보입니다. 이 기간에 특별히 고마웠던 분을 고르고 감사의 말을 남겨 주세요. 팀 모두에게 보입니다.</p>' +
      '<div style="max-height:300px;overflow-y:auto">' + ids.map(function (id) {
        var r = byId[id];
        return '<label class="row small" style="margin:4px 0;flex-wrap:nowrap"><input type="checkbox" data-win="' + id + '"' + (win[id] ? ' checked' : '') + '>' +
          avatar(id, 24) + '<b>' + esc(nameOf(id)) + '</b><span class="muted">' + (r ? r.total + '회' + (p.to >= cfg().pointStart ? ' · ' + r.points + '점' : '') : '') + '</span></label>';
      }).join('') + '</div>' +
      '<label class="f">감사의 말</label><textarea id="w-msg" placeholder="예: 한 해 동안 이른 아침 자리를 지켜 주셔서 감사합니다.">' + esc(a.message || '') + '</textarea>' +
      '<div class="foot">' + (S.awards[p.key] ? '<button class="btn bad" id="w-del">감사 인사 지우기</button><span class="grow"></span>' : '') +
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
      if (!confirm(p.label + ' 감사 인사를 지울까요?')) return;
      db.ref(R + 'awards/' + p.key).remove().then(function () { closeModal(); }).catch(fail);
    };
  }

  // ---------- 동작 연결 ----------
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (/^(badge|slot|meaning)$/.test(act)) { badgeClick(act, id); return; }
    if (!$('main').contains(b)) return;
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
    else if (act === 'award') { var p = periodRange(); editAward(p, records(tally(p.from, p.to))); }
    else if (act === 's-save') saveSettings();
    else if (act === 'eval-q' && S.master) evalQuarterModal();
    else if (act === 'eval-y' && S.master) evalYearModal();
    else if (act === 'cheer-quick') sendCheer(id, b.getAttribute('data-text'));
    else if (act === 'cheer-send') { var inp = document.querySelector('[data-cheer="' + id + '"]'); sendCheer(id, inp && inp.value); }
    else if (act === 'cheer-del') {
      var cp = id.split('|');
      if (confirm('이 축하 글을 지울까요?')) db.ref(R + 'cheers/' + cp[0] + '/' + cp[1]).remove().catch(fail);
    }
    else if (act === 'print-open') openPrint();
    else if (act === 'issue-del') { if (confirm('이 지급 기록을 지울까요?')) db.ref(R + 'issues/' + id).remove().catch(fail); }
    else if (act === 'backup') backup();
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'q') { S.q = ev.target.value; render(true); }
  });
  document.addEventListener('keydown', function (ev) {
    var ck = ev.target.getAttribute && ev.target.getAttribute('data-cheer');
    if (ck && ev.key === 'Enter') sendCheer(ck, ev.target.value);
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!$('main').contains(t)) return;
    if (t.id === 'show-retired') { S.showRetired = t.checked; render(true); }
    else if (t.id === 'st-year') { S.statYear = t.value; render(true); }
    else if (t.id === 'st-sub') { if (S.statMode === 'month') S.statMonth = t.value; else S.statQ = +t.value; render(true); }
    else if (t.id === 'imp') importFile(t.files[0]);
    else if (t.id === 'b-year') { S.bYear = t.value; render(true); }
    else if (t.id === 'pr-mem') {
      var pm = S.members[t.value];
      if (pm) $('pr-role').value = (pm.title ? pm.title + ' · ' : '') + partOf(pm.part).label;
    }
    else if (t.hasAttribute('data-role-of')) setRole(t.getAttribute('data-role-of'), t.value);
  });

  function statsCsv() {
    var p = periodRange(), usePoints = p.to >= cfg().pointStart, rows = records(tally(p.from, p.to));
    var lines = [['이름', '파트', '상태', '섬김', '출석', '합계', '시간(분)'].concat(usePoints ? ['포인트'] : []).join(',')];
    rows.forEach(function (r) {
      var m = S.members[r.id] || {};
      lines.push([nameOf(r.id), partOf(m.part).label, STATUS[m.status || 'active'] || '', r.serve, r.attend, r.total, r.minutes].concat(usePoints ? [r.points] : [])
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
    });
    download('찬양팀_섬김_' + p.key + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function saveSettings() {
    var minutes = {};
    document.querySelectorAll('#main [data-min]').forEach(function (x) { minutes[x.getAttribute('data-min')] = Math.max(0, +x.value || 0); });
    var start = $('s-start').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { toast('포인트 계산 시작일을 골라 주세요.'); return; }
    db.ref(R + 'settings').update({ pointStart: start, servePoint: +$('s-serve').value || 0, attendPoint: +$('s-attend').value || 0, minutes: minutes })
      .then(function () { toast('기준을 저장했습니다.'); render(true); }).catch(fail);
  }

  function setRole(uid, role) {
    var u = S.users[uid] || {};
    db.ref(R + 'admins/' + uid).set(role ? { email: u.email || '', name: u.name || '', role: role } : null)
      .then(function () { toast((u.name || u.email) + ' 님: ' + (role ? roleLabel(role) + '로 지정했습니다.' : '지기에서 뺐습니다.')); }).catch(fail);
  }

  function importFile(f) {
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var data;
      try { data = JSON.parse(rd.result); } catch (e) { toast('파일을 읽지 못했습니다.'); return; }
      if (Array.isArray(data.changes)) { rosterChanges(data); return; }
      if (!data.members || !data.events) { toast('기초자료 파일 형식이 아닙니다.'); return; }
      var nm = Object.keys(data.members).length, ne = Object.keys(data.events).length;
      var has = Object.keys(S.members).length || Object.keys(S.events).length;
      if (!confirm('명단 ' + nm + '명, 예배 ' + ne + '건을 불러옵니다.' + (has ? '\n지금 있는 명단과 예배 기록은 이 파일 내용으로 바뀝니다.' : '') + '\n계속할까요?')) return;
      db.ref(R.slice(0, -1)).update({ members: data.members, events: data.events })
        .then(function () { toast('불러왔습니다.'); }).catch(fail);
    };
    rd.readAsText(f, 'utf-8');
  }

  // 명단 변경 파일: 이름으로 찾아 파트 · 상태 · 메모 · 순서 · 메일(파일에 있을 때만)을 바꾸고, 없는 이름은 새로 추가합니다.
  // 사진 · 직임 · 예배 기록은 건드리지 않습니다.
  function rosterChanges(data) {
    var byName = {}, up = {}, lines = [], orders = 0;
    Object.keys(S.members).forEach(function (k) { byName[S.members[k].name] = k; });
    function show(f, v) {
      if (f === 'part') return partOf(v).label;
      if (f === 'status') return STATUS[v || 'active'];
      return v ? '"' + v + '"' : '(없음)';
    }
    data.changes.forEach(function (c) {
      var id = byName[c.name];
      if (!id) {
        if (!c.add) { lines.push(c.name + ': 명단에 없어 건너뜀'); return; }
        var obj = { name: c.name, part: c.part || '', status: c.status || 'active', order: c.order || 0 };
        if (c.note) obj.note = c.note;
        if (c.email) obj.email = String(c.email).toLowerCase();
        up['members/' + db.ref(R + 'members').push().key] = obj;
        lines.push('새로 추가: ' + c.name + ' (' + partOf(c.part).label + ')');
        return;
      }
      var m = S.members[id], diffs = [];
      ['part', 'status', 'note', 'order', 'email'].forEach(function (f) {
        if (!(f in c)) return;
        var nv = c[f] == null || c[f] === '' ? null : c[f], ov = m[f] == null || m[f] === '' ? null : m[f];
        if (f === 'status' && !ov) ov = 'active';
        if (nv === ov) return;
        up['members/' + id + '/' + f] = nv;
        if (f === 'order') orders++;
        else diffs.push((f === 'note' ? '메모 ' : f === 'email' ? '메일 ' : '') + show(f, ov) + ' → ' + show(f, nv));
      });
      if (diffs.length) lines.push(c.name + ': ' + diffs.join(', '));
    });
    if (!Object.keys(up).length) { toast('이미 이 명단과 같습니다.'); return; }
    modal('<h3>명단 변경 적용</h3><p class="small muted">' + esc(data.source || '') + (data.date ? ' · ' + esc(data.date) : '') +
      '<br>아래 내용만 바뀝니다. 사진 · 직임 · 예배 기록은 그대로입니다.</p>' +
      '<div class="att-list">' + lines.map(function (l) { return '<div class="row small">' + esc(l) + '</div>'; }).join('') + '</div>' +
      (orders ? '<p class="small muted">카드 순서 ' + orders + '명도 최종 명단 순서로 맞춥니다.</p>' : '') +
      '<div class="foot"><button class="btn" id="rc-close">닫기</button><button class="btn pri" id="rc-ok">적용</button></div>');
    $('rc-close').onclick = function () { closeModal(); };
    $('rc-ok').onclick = function () {
      db.ref(R.slice(0, -1)).update(up).then(function () { closeModal(); toast('명단을 바꿨습니다.'); }).catch(fail);
    };
  }

  function backup() {
    var data = { members: S.members, events: S.events, photos: S.photos, awards: S.awards, badges: S.badges, cheers: S.cheers, issues: S.issues, settings: S.settings, notice: S.notice, savedAt: new Date().toISOString() };
    download('찬양팀_백업_' + todayKey() + '.json', JSON.stringify(data, null, 1), 'application/json');
  }

  start();
})();
