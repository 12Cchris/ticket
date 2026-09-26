(function(){
  "use strict";

  /* =========================================================
   * 입장권 편집기 (영화 입장권 / 테마파크 입장권 전환)
   * - 상단의 [영화] [테마파크] 버튼으로 입장권 종류를 바꾼다.
   *   종류마다 입력값을 따로 기억하므로, 왔다갔다 해도 서로 값이 섞이거나 사라지지 않는다.
   * - 왼쪽 폼(els.*)의 값을 읽어 오른쪽 티켓(out.*)에 그대로 반영한다.
   * - 테마파크는 이용 항목(에셋)을 체크해서 고르면 분류별로 묶어 티켓에 표시한다.
   * - 티켓 위 텍스트는 직접 드래그해서 고칠 수도 있는데(overrides),
   *   그 경우 폼 값보다 우선 표시되다가 관련 폼 값이 바뀌면 해제된다.
   * - 입력 내용은 매 변경마다 localStorage에 자동 저장되어,
   *   새로고침하거나 다시 열어도 이어서 편집할 수 있다.
   * ========================================================= */

  var STORAGE_KEY = "ticketEditor:v2";
  // 이전 버전(영화 전용 v3.x.x / 테마파크 전용 v4.1.1)이 남긴 저장값 — 처음 열 때 한 번 이어받는다.
  var LEGACY_MOVIE_KEY = "boxOfficeTicketEditor:v1";
  var LEGACY_PARK_KEY = "themeParkTicketEditor:v1";

  // 지금 배포된 버전. 새 버전을 낼 때마다 이 값만 올려주면,
  // 기존에 쓰던 사람(=저장된 편집 내용이 있는 사람)이 다시 열었을 때
  // 영화/테마파크 두 종류 모두, 사용자가 직접 고친 적 없는 항목만 새 기본값으로 자동 반영되고
  // (이미 고친 항목은 그대로 유지), 위쪽에 안내 배너가 잠깐 떴다 사라진다.
  // (새로 처음 여는 사람에게는 아무 일도 일어나지 않는다.)
  // ※ 이 기능이 생기기 전에 저장된 값은 "아무것도 안 고친 것"으로 간주되어,
  //    다음 업데이트 한 번에 한해 전체가 새 기본값으로 바뀔 수 있다. 그 이후로는 정확히 추적된다.
  var APP_VERSION = "3.6.1";
  var VERSION_SEEN_KEY = "ticketEditor:seenVersion";

  var MODE_LABELS = { movie: "영화", park: "테마파크", receipt: "영수증" };
  // 확인창 등 문장 속에 자연스럽게 넣기 위한 표현 ("영수증 입장권"처럼 어색해지는 걸 피함)
  var MODE_ITEM_LABELS = { movie: "영화 입장권", park: "테마파크 입장권", receipt: "영수증" };

  // 이용 항목의 분류 (티켓에는 이 순서대로 묶여서 표시된다)
  var ASSET_CATS = ["어트랙션", "공연·체험", "부가옵션"];

  var DEFAULT_SEATS = ["H열 12번", "H열 13번"];

  var DEFAULT_ASSETS = [
    { name: "롤러코스터", cat: "어트랙션", on: true },
    { name: "자이로드롭", cat: "어트랙션", on: true },
    { name: "바이킹", cat: "어트랙션", on: true },
    { name: "회전목마", cat: "어트랙션", on: false },
    { name: "범퍼카", cat: "어트랙션", on: false },
    { name: "후룸라이드", cat: "어트랙션", on: false },
    { name: "퍼레이드", cat: "공연·체험", on: true },
    { name: "야간 불꽃놀이", cat: "공연·체험", on: false },
    { name: "4D 체험관", cat: "공연·체험", on: false },
    { name: "퀵패스", cat: "부가옵션", on: false },
    { name: "사물함 이용권", cat: "부가옵션", on: false }
  ];

  // 마트/편의점 영수증의 기본 상품 목록
  var DEFAULT_ITEMS = [
    { name: "삼각김밥(참치마요)", qty: "2", price: "1700" },
    { name: "컵라면", qty: "1", price: "1500" },
    { name: "생수 500ml", qty: "1", price: "900" },
    { name: "초코우유", qty: "1", price: "1400" }
  ];

  // 종류별로 다른 기본 문구. (발권일시·날짜 등 "지금" 기준 값은 factoryFor에서 채운다)
  var TEXT_DEFAULTS = {
    movie: {
      heading: "영화입장권",
      issueLabel: "[전체 발권]",
      format: "2D",
      rating: "12세 이상 관람가",
      title: "집가고싶다",
      original: "I want to go home",
      screen: "7관",
      notes: [
        "티켓 미 지참 시 교환 및 환불 불가",
        "결제수단 변경 및 교환, 환불은 시작 전 구매처에서 가능",
        "본인 연령에 맞지 않는 영화 관람 시, 강제 퇴장 조치되실 수 있습니다."
      ]
    },
    park: {
      heading: "테마파크 입장권",
      issueLabel: "[현장 발권]",
      format: "1DAY 종일권",
      rating: "선택 어트랙션 이용",
      title: "유쾌! 테마파크",
      original: "Fun! Theme Park",
      start: "09:30",
      end: "22:00",
      screen: "정문 A게이트",
      notes: [
        "티켓 분실 시 재발급 및 재입장 불가",
        "일부 어트랙션은 키·연령·건강 상태에 따라 이용이 제한될 수 있습니다.",
        "우천, 안전 점검, 천재지변 등으로 일부 운영이 중단될 수 있으나, 환불 불가합니다."
      ]
    },
    receipt: {
      heading: "행복마트 강남점",
      issueLabel: "R-0142",
      storeInfo: "서울 강남구 테헤란로 123 · 02-1234-5678",
      paymentMethod: "신용카드",
      notes: [
        "본 영수증은 교환/환불 시 반드시 지참해 주세요.",
        "구매 후 7일 이내, 미개봉 상품에 한해 교환/환불이 가능합니다.",
        "상품 관련 문의는 매장으로 연락해 주세요."
      ]
    }
  };

  /* ---------- DOM 참조 ---------- */
  var els = {
    heading: document.getElementById("f-heading"),
    issued: document.getElementById("f-issued"),
    issueLabel: document.getElementById("f-issueLabel"),
    format: document.getElementById("f-format"),
    rating: document.getElementById("f-rating"),
    title: document.getElementById("f-title"),
    original: document.getElementById("f-original"),
    date: document.getElementById("f-date"),
    session: document.getElementById("f-session"),
    start: document.getElementById("f-start"),
    end: document.getElementById("f-end"),
    screen: document.getElementById("f-screen"),
    adult: document.getElementById("f-adult"),
    child: document.getElementById("f-child"),
    senior: document.getElementById("f-senior"),
    people: document.getElementById("f-people"),
    seatList: document.getElementById("seatList"),
    addSeat: document.getElementById("addSeat"),
    sortSeats: document.getElementById("sortSeats"),
    assetList: document.getElementById("assetList"),
    assetSummary: document.getElementById("assetSummary"),
    selectAllAssets: document.getElementById("selectAllAssets"),
    clearAllAssets: document.getElementById("clearAllAssets"),
    addAsset: document.getElementById("addAsset"),
    noteList: document.getElementById("noteList"),
    addNote: document.getElementById("addNote"),
    storeInfo: document.getElementById("f-storeInfo"),
    itemList: document.getElementById("itemList"),
    addItem: document.getElementById("addItem"),
    paymentMethod: document.getElementById("f-paymentMethod"),
    tendered: document.getElementById("f-tendered"),
    cBg: document.getElementById("c-bg"),
    cText: document.getElementById("c-text"),
    cLine: document.getElementById("c-line"),
    ticket: document.getElementById("ticket"),
    btnPng: document.getElementById("btnPng"),
    btnPrint: document.getElementById("btnPrint"),
    btnExport: document.getElementById("btnExport"),
    btnImport: document.getElementById("btnImport"),
    fileImport: document.getElementById("fileImport"),
    btnReset: document.getElementById("btnReset")
  };

  var out = {
    heading: document.getElementById("out-heading"),
    issued: document.getElementById("out-issued"),
    issueLabel: document.getElementById("out-issueLabel"),
    rating: document.getElementById("out-rating"),
    title: document.getElementById("out-title"),
    original: document.getElementById("out-original"),
    showtime: document.getElementById("out-showtime"),
    place: document.getElementById("out-place"),
    assetsTitle: document.getElementById("out-assetsTitle"),
    assets: document.getElementById("out-assets"),
    people: document.getElementById("out-people"),
    notes: document.getElementById("out-notes"),
    storeInfo: document.getElementById("out-storeInfo"),
    items: document.getElementById("out-items"),
    totals: document.getElementById("out-totals")
  };

  /* ---------- 상태 ---------- */
  var mode = "movie";                 // 지금 보고 있는 입장권 종류: "movie" | "park" | "receipt"
  var data = { movie: null, park: null, receipt: null }; // 종류별로 저장되는 입력값 (init에서 채운다)
  var runtime = { movie: newRuntime(), park: newRuntime(), receipt: newRuntime() }; // 종류별 티켓 위 직접 편집값(저장되지 않음)

  // 사용자가 실제로 손댄 필드만 기록해 둔다 (종류별로 따로). data와 함께 저장/복원된다.
  // 새 버전이 나왔을 때, 여기 표시가 안 된(=한 번도 안 고친) 필드만 새 기본값으로 자동 반영하고
  // 표시가 된(=이미 고친) 필드는 그대로 둔다.
  var TRACKED_TEXT_KEYS = [
    "heading", "issueLabel", "format", "rating", "title", "original",
    "screen", "session", "adult", "child", "senior", "people",
    "storeInfo", "paymentMethod", "tendered"
  ];
  function emptyTouched(){
    return {
      heading: false, issueLabel: false, format: false, rating: false,
      title: false, original: false, screen: false, session: false,
      adult: false, child: false, senior: false, people: false,
      storeInfo: false, paymentMethod: false, tendered: false,
      seats: false, assets: false, notes: false, colors: false, items: false
    };
  }
  function normalizeTouched(t){
    var base = emptyTouched();
    var s = t && typeof t === "object" ? t : {};
    Object.keys(base).forEach(function(k){ base[k] = !!s[k]; });
    return base;
  }
  var touched = { movie: emptyTouched(), park: emptyTouched(), receipt: emptyTouched() };

  var seats = DEFAULT_SEATS.slice();
  var assets = cloneAssets(DEFAULT_ASSETS);
  var items = cloneItems(DEFAULT_ITEMS);
  var notes = [];

  // 티켓 위에서 직접 고친 값(override)은 폼 값보다 우선 표시된다.
  // 관련 폼 값이 다시 바뀌면 해당 override는 null로 풀려서 폼 계산값으로 돌아간다.
  var overrides = newOverrides();
  var assetsOverride = null; // 선택 항목 줄들: [{ head: bool, text: string }]
  var notesOverride = null;

  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function newOverrides(){
    return { issued: null, rating: null, showtime: null, place: null, assetsTitle: null };
  }
  function newRuntime(){
    return { overrides: newOverrides(), assetsOverride: null, notesOverride: null };
  }

  /* ---------- 공통 유틸 ---------- */
  function pad(n){ return n < 10 ? "0" + n : "" + n; }

  // 빈 문자열(공백만 있는 것 포함)을 걸러낸 배열
  function nonEmpty(list){
    return list.filter(function(s){ return s.trim() !== ""; });
  }

  // 비어 있지 않은 값들만 구분자로 이어 붙인다 (값이 하나 비어도 구분자가 남지 않게)
  function joinNonEmpty(list, sep){
    return nonEmpty(list.map(function(s){ return String(s == null ? "" : s); }))
      .map(function(s){ return s.trim(); })
      .join(sep);
  }

  function pick(value, fallback){ return value == null ? fallback : value; }

  function toCount(value){
    var n = parseInt(value, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  // 영수증 금액 계산용 - 콤마가 섞여 들어와도 숫자로 읽는다.
  function toNumber(value){
    var n = parseFloat(String(value == null ? "" : value).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  }
  function formatWon(n){
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  // input 타입 number라도 "-5" 같은 직접 타이핑은 브라우저가 막아주지 않으므로, 음수면 0으로 되돌린다.
  // 지우는 중인 빈 값("")은 입력을 방해하지 않게 그대로 둔다.
  function clampNonNegative(inputEl){
    var raw = inputEl.value;
    if(raw !== "" && toNumber(raw) < 0){
      inputEl.value = "0";
    }
  }

  function nowDateValue(){
    var now = new Date();
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  }
  function nowTimeValue(){
    var now = new Date();
    return pad(now.getHours()) + ":" + pad(now.getMinutes());
  }

  // 이용 항목 목록을 복사하면서 값 형태를 정리한다 (저장값이 깨져 있어도 안전하게).
  function cloneAssets(list){
    return list.map(function(a){
      return {
        name: String(a && a.name != null ? a.name : ""),
        cat: ASSET_CATS.indexOf(a && a.cat) >= 0 ? a.cat : ASSET_CATS[0],
        on: !!(a && a.on)
      };
    });
  }

  function cloneItems(list){
    return (Array.isArray(list) ? list : []).map(function(it){
      return {
        name: String(it && it.name != null ? it.name : ""),
        qty: String(it && it.qty != null ? it.qty : "1"),
        price: String(it && it.price != null ? it.price : "0")
      };
    });
  }

  function setColors(colors){
    els.cBg.value = colors.bg;
    els.cText.value = colors.text;
    els.cLine.value = colors.line;
    document.getElementById("c-bg-code").textContent = colors.bg;
    document.getElementById("c-text-code").textContent = colors.text;
    document.getElementById("c-line-code").textContent = colors.line;
    els.ticket.style.setProperty("--ticket-bg", colors.bg);
    els.ticket.style.setProperty("--ticket-text", colors.text);
    els.ticket.style.setProperty("--ticket-line", colors.line);
  }

  /* =========================================================
   * 종류별 기본값 / 정리 / 폼 ↔ 데이터 변환
   * ========================================================= */

  // 종류(m)의 공장 초기값. 발권일시·날짜(영화는 시작/종료 시각도)는 "지금"을 기준으로 새로 채운다.
  function factoryFor(m){
    var today = nowDateValue();
    var now = nowTimeValue();
    var d = {
      issued: today + "T" + now,
      date: today,
      session: "1",
      start: now,
      end: now,
      people: "",
      adult: "2",
      child: "1",
      senior: "0",
      seats: DEFAULT_SEATS.slice(),
      assets: cloneAssets(DEFAULT_ASSETS),
      items: cloneItems(DEFAULT_ITEMS),
      storeInfo: "",
      paymentMethod: "",
      tendered: "",
      colors: { bg: "#ffffff", text: "#111111", line: "#111111" }
    };
    var text = TEXT_DEFAULTS[m];
    Object.keys(text).forEach(function(k){
      d[k] = Array.isArray(text[k]) ? text[k].slice() : text[k];
    });
    return d;
  }

  // 저장돼 있던 값(state)을 종류(m)의 기본값 위에 얹어 항상 온전한 모양으로 만든다.
  // (예전 버전 저장값처럼 일부 항목이 없어도 빈 곳은 기본값으로 채워진다.)
  function normalize(m, state){
    var base = factoryFor(m);
    var s = state && typeof state === "object" ? state : {};
    var res = {};
    Object.keys(base).forEach(function(k){
      if(k === "seats" || k === "notes" || k === "assets" || k === "items" || k === "colors") return;
      res[k] = String(pick(s[k], base[k]));
    });
    res.seats = Array.isArray(s.seats) && s.seats.length ? s.seats.map(String) : base.seats;
    res.notes = Array.isArray(s.notes) && s.notes.length ? s.notes.map(String) : base.notes;
    res.assets = cloneAssets(Array.isArray(s.assets) ? s.assets : base.assets);
    res.items = cloneItems(Array.isArray(s.items) && s.items.length ? s.items : base.items);
    var c = s.colors || {};
    res.colors = {
      bg: pick(c.bg, base.colors.bg),
      text: pick(c.text, base.colors.text),
      line: pick(c.line, base.colors.line)
    };
    return res;
  }

  // 지금 폼에 입력된 값을 그대로 모아 담는다.
  function collectForm(){
    return {
      heading: els.heading.value,
      issued: els.issued.value,
      issueLabel: els.issueLabel.value,
      format: els.format.value,
      rating: els.rating.value,
      title: els.title.value,
      original: els.original.value,
      date: els.date.value,
      session: els.session.value,
      start: els.start.value,
      end: els.end.value,
      screen: els.screen.value,
      adult: els.adult.value,
      child: els.child.value,
      senior: els.senior.value,
      people: els.people.value,
      seats: seats.slice(),
      assets: cloneAssets(assets),
      items: cloneItems(items),
      storeInfo: els.storeInfo.value,
      paymentMethod: els.paymentMethod.value,
      tendered: els.tendered.value,
      notes: notes.slice(),
      colors: { bg: els.cBg.value, text: els.cText.value, line: els.cLine.value }
    };
  }

  // 저장된 값 또는 기본값을 폼/상태에 그대로 채워 넣는다 (렌더링은 호출부에서 별도로 수행).
  function fillForm(d){
    els.heading.value = d.heading || "";
    els.issued.value = d.issued;
    els.issueLabel.value = d.issueLabel || "";
    els.format.value = d.format || "";
    els.rating.value = d.rating || "";
    els.title.value = d.title || "";
    els.original.value = d.original || "";
    els.date.value = d.date;
    els.session.value = d.session;
    els.start.value = d.start;
    els.end.value = d.end;
    els.screen.value = d.screen || "";
    els.adult.value = d.adult;
    els.child.value = d.child;
    els.senior.value = d.senior;
    els.people.value = d.people;
    els.storeInfo.value = d.storeInfo || "";
    els.paymentMethod.value = d.paymentMethod || "";
    els.tendered.value = d.tendered || "";
    seats = d.seats.slice();
    assets = cloneAssets(d.assets);
    items = cloneItems(d.items);
    notes = d.notes.slice();
    setColors(d.colors);
  }

  /* =========================================================
   * 자동 저장 / 불러오기
   * ========================================================= */

  // 글자 하나 칠 때마다 바로 localStorage에 쓰면(직렬화 + 동기 저장) 타이핑이 잦을 때 불필요한 부하가 쌓이므로,
  // 실제 쓰기는 짧게 모아서(디바운스) 한 번만 하고, 창을 닫거나 새로고침할 때는 즉시 flush한다.
  var saveTimer = null;
  var SAVE_DEBOUNCE_MS = 250;

  // 시크릿 모드나 저장공간 부족으로 자동 저장이 안 될 때, 최소 한 번은 화면에 알린다.
  // (계속 조용히 실패하면 사용자는 작업이 날아가는 줄도 모르게 된다)
  var storageWriteFailed = false;
  function warnStorageFailure(){
    if(storageWriteFailed) return; // 이미 띄웠으면 매번 다시 띄우지 않는다
    storageWriteFailed = true;
    var banner = document.getElementById("storageWarning");
    if(banner) banner.classList.remove("hidden");
  }

  function persistNow(){
    saveTimer = null;
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: mode, data: data, touched: touched }));
    } catch(e){
      // 저장 공간이 없거나 접근이 막힌 경우 - 조용히 넘어가지 않고 배너로 알린다
      warnStorageFailure();
    }
  }

  function saveState(){
    data[mode] = collectForm(); // 폼 값 자체는 항상 즉시 반영 — 지연되는 건 localStorage 쓰기뿐
    if(saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, SAVE_DEBOUNCE_MS);
  }

  // 디바운스 중 페이지를 벗어나면(닫기/새로고침/모드 전환 등) 쌓인 변경분을 즉시 저장한다.
  window.addEventListener("beforeunload", function(){
    if(saveTimer){ clearTimeout(saveTimer); persistNow(); }
  });
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "hidden" && saveTimer){ clearTimeout(saveTimer); persistNow(); }
  });

  function readJson(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }

  // 저장된 값을 불러와 mode / data를 채운다. 저장값이 없으면 공장 초기값을 쓴다.
  function loadAll(){
    var today = nowDateValue();
    var now = nowTimeValue();

    // 불러온 데이터의 시간 관련 필드(발권일시·날짜·시작·종료)는 모드와 상관없이
    // 항상 현재 시각으로 갱신한다. (테마파크의 "22:00" 등 고정 기본값은 처음 만들어질 때만 쓰이고,
    // 그 뒤로 저장값을 다시 불러올 때는 다른 시간 필드와 똑같이 현재 시각으로 맞춘다.)
    function refreshTime(d){
      d.issued = today + "T" + now;
      d.date = today;
      d.start = now;
      d.end = now;
      return d;
    }

    var saved = readJson(STORAGE_KEY);
    if(saved && saved.data){
      mode = saved.mode === "park" ? "park" : (saved.mode === "receipt" ? "receipt" : "movie");
      data.movie = refreshTime(normalize("movie", saved.data.movie));
      data.park = refreshTime(normalize("park", saved.data.park));
      data.receipt = refreshTime(normalize("receipt", saved.data.receipt));
      // 예전 저장값(touched 기록이 생기기 전)은 "아무것도 안 고친 것"으로 간주한다.
      // → 이번 한 번은 새 기본값으로 자동 반영될 수 있지만, 이후로는 정확히 추적된다.
      touched.movie = normalizeTouched(saved.touched && saved.touched.movie);
      touched.park = normalizeTouched(saved.touched && saved.touched.park);
      touched.receipt = normalizeTouched(saved.touched && saved.touched.receipt);
      return;
    }
    // 처음 열었다면, 이전 버전에서 편집하던 내용이 있을 경우 이어받는다.
    var oldMovie = readJson(LEGACY_MOVIE_KEY);
    var oldPark = readJson(LEGACY_PARK_KEY);
    data.movie = oldMovie ? refreshTime(normalize("movie", oldMovie)) : factoryFor("movie");
    data.park = oldPark ? refreshTime(normalize("park", oldPark)) : factoryFor("park");
    data.receipt = factoryFor("receipt"); // 영수증은 이전 버전이 없으므로 항상 기본값에서 시작
    touched.movie = emptyTouched();
    touched.park = emptyTouched();
    touched.receipt = emptyTouched();
    mode = oldPark && !oldMovie ? "park" : "movie";
  }

  /* =========================================================
   * 입장권 종류 전환 / 초기화
   * ========================================================= */

  // 종류에 맞게 화면 표시(보이는 섹션, 입력칸 안내 문구, 전환 버튼, 창 제목)를 바꾼다.
  function applyModeUI(){
    var isPark = mode === "park";
    document.body.classList.toggle("mode-movie", mode === "movie");
    document.body.classList.toggle("mode-park", isPark);
    document.body.classList.toggle("mode-receipt", mode === "receipt");

    Array.prototype.forEach.call(document.querySelectorAll(".mode-btn"), function(btn){
      var active = btn.getAttribute("data-mode") === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-ph-movie]"), function(input){
      input.placeholder = input.getAttribute(isPark ? "data-ph-park" : "data-ph-movie");
    });

    document.title = "입장권 편집기 — " + MODE_ITEM_LABELS[mode];
  }

  function renderAllLists(){
    renderSeatList();
    renderAssetList();
    renderItemList();
    renderNoteList();
  }

  function switchMode(next){
    if(next === mode || !data[next]) return;

    // 지금 종류의 값과 티켓 위 직접 편집값을 보관한 뒤, 새 종류의 것을 꺼내 폼에 채운다.
    data[mode] = collectForm();
    runtime[mode] = { overrides: overrides, assetsOverride: assetsOverride, notesOverride: notesOverride };

    mode = next;

    overrides = runtime[mode].overrides;
    assetsOverride = runtime[mode].assetsOverride;
    notesOverride = runtime[mode].notesOverride;
    fillForm(data[mode]);

    applyModeUI();
    renderAllLists();
    render();
  }

  Array.prototype.forEach.call(document.querySelectorAll(".mode-btn"), function(btn){
    btn.addEventListener("click", function(){ switchMode(btn.getAttribute("data-mode")); });
  });

  // 종류(m)를 기본값으로 "완전히" 되돌린다 (고쳤다는 표시까지 전부 지운다).
  // "기본값으로 초기화" 버튼(확인창 있음)에서만 쓰인다.
  function resetModeToDefaultsFully(m){
    data[m] = factoryFor(m);
    touched[m] = emptyTouched();
    if(m === mode){
      overrides = newOverrides();
      assetsOverride = null;
      notesOverride = null;
      fillForm(data[m]);
      renderAllLists();
      render();
    } else {
      runtime[m] = newRuntime();
      saveState();
    }
  }

  // 종류(m)에서 사용자가 아직 한 번도 안 고친 값만 새 기본값으로 바꾼다. 이미 고친 값은 그대로 둔다.
  // (버전이 바뀌었을 때 자동으로 한 번 실행된다. 확인창 없음 — 사용자 값은 건드리지 않으므로.)
  function applyUntouchedDefaults(m){
    var fresh = factoryFor(m);
    var t = touched[m];
    TRACKED_TEXT_KEYS.forEach(function(key){
      if(!t[key]) data[m][key] = fresh[key];
    });
    if(!t.seats) data[m].seats = fresh.seats.slice();
    if(!t.assets) data[m].assets = cloneAssets(fresh.assets);
    if(!t.items) data[m].items = cloneItems(fresh.items);
    if(!t.notes) data[m].notes = fresh.notes.slice();
    if(!t.colors) data[m].colors = fresh.colors;

    if(m === mode){
      fillForm(data[m]);
      renderAllLists();
      render();
    } else {
      saveState();
    }
  }

  /* ---------- 백업 내보내기 / 가져오기 (JSON) ----------
   * localStorage에만 있던 데이터를 파일로 빼내고 다시 넣을 수 있게 한다.
   * 브라우저 캐시 삭제나 PC 교체로 데이터가 사라지는 걸 막기 위한 이동 수단.
   * 내보내는 내용은 실제로 저장되는 값(mode/data/touched)과 동일하게 맞춘다 —
   * 티켓 위 직접 편집(overrides)은 원래도 새로고침 시 저장되지 않는 값이라 백업에도 포함하지 않는다. */
  function exportBackup(){
    data[mode] = collectForm(); // 지금 보고 있는 종류의 최신 입력값까지 포함시킨다.
    var payload = {
      app: "ticket-editor-backup",
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      mode: mode,
      data: data,
      touched: touched
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var stamp = new Date();
    function pad(n){ return String(n).padStart(2, "0"); }
    var name = "입장권-백업-" + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate())
      + "-" + pad(stamp.getHours()) + pad(stamp.getMinutes()) + ".json";
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  function importBackup(file){
    var reader = new FileReader();
    reader.onload = function(){
      var parsed;
      try{
        parsed = JSON.parse(String(reader.result));
      } catch(e){
        window.alert("이 파일은 올바른 백업 파일(JSON)이 아니에요.");
        return;
      }
      if(!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object"){
        window.alert("이 파일은 입장권 편집기 백업 파일이 아니에요.");
        return;
      }
      var ok = window.confirm(
        "백업 파일을 불러올까요?\n지금 화면(영화/테마파크/영수증)에 입력돼 있는 모든 내용이 백업 내용으로 바뀝니다."
      );
      if(!ok) return;

      var today = nowDateValue();
      var now = nowTimeValue();
      function refreshTime(d){
        d.issued = today + "T" + now;
        d.date = today;
        d.start = now;
        d.end = now;
        return d;
      }

      data.movie = refreshTime(normalize("movie", parsed.data.movie));
      data.park = refreshTime(normalize("park", parsed.data.park));
      data.receipt = refreshTime(normalize("receipt", parsed.data.receipt));
      touched.movie = normalizeTouched(parsed.touched && parsed.touched.movie);
      touched.park = normalizeTouched(parsed.touched && parsed.touched.park);
      touched.receipt = normalizeTouched(parsed.touched && parsed.touched.receipt);

      mode = parsed.mode === "park" ? "park" : (parsed.mode === "receipt" ? "receipt" : "movie");
      overrides = newOverrides();
      assetsOverride = null;
      notesOverride = null;
      runtime.movie = newRuntime();
      runtime.park = newRuntime();
      runtime.receipt = newRuntime();

      fillForm(data[mode]);
      applyModeUI();
      renderAllLists();
      render();
      persistNow();
      window.alert("백업을 불러왔어요.");
    };
    reader.onerror = function(){
      window.alert("파일을 읽는 중 문제가 생겼어요. 다시 시도해 주세요.");
    };
    reader.readAsText(file);
  }

  els.btnExport.addEventListener("click", exportBackup);
  els.btnImport.addEventListener("click", function(){ els.fileImport.click(); });
  els.fileImport.addEventListener("change", function(){
    var file = els.fileImport.files && els.fileImport.files[0];
    els.fileImport.value = ""; // 같은 파일을 연달아 골라도 change가 다시 일어나도록 초기화
    if(file) importBackup(file);
  });

  // "기본값으로 초기화" 버튼은 지금 보고 있는 종류만, 완전히 되돌린다. (다른 종류의 값은 그대로 둔다)
  els.btnReset.addEventListener("click", function(){
    var ok = window.confirm(
      "지금 보고 있는 " + MODE_ITEM_LABELS[mode] + "의 모든 값을 기본값으로 되돌릴까요?\n" +
      "저장된 편집 내용도 함께 지워집니다. (다른 종류는 그대로 유지됩니다.)"
    );
    if(!ok) return;
    resetModeToDefaultsFully(mode);
  });

  /* ---------- 티켓 위 텍스트 직접 편집(contenteditable) ---------- */
  // Enter로 줄바꿈되지 않게 막고, 붙여넣기는 서식 없이 텍스트만 들어가게 한다.
  function makeInlineEditable(el, onChange){
    el.addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); el.blur(); }
    });
    el.addEventListener("paste", function(e){
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
    });
    el.addEventListener("input", onChange);
  }

  // 조합값(발권일시/등급/이용시간/장소·좌석/선택항목 제목)은 override로 저장 — 폼과 별도로 값을 기억해야 하므로.
  makeInlineEditable(out.issued, function(){ overrides.issued = out.issued.textContent; saveState(); });
  makeInlineEditable(out.rating, function(){ overrides.rating = out.rating.textContent; saveState(); });
  makeInlineEditable(out.showtime, function(){ overrides.showtime = out.showtime.textContent; saveState(); });
  makeInlineEditable(out.place, function(){ overrides.place = out.place.textContent; saveState(); });
  makeInlineEditable(out.assetsTitle, function(){ overrides.assetsTitle = out.assetsTitle.textContent; saveState(); });

  // 1:1로 대응되는 값(제목/부제/발권 라벨/인원)은 override 없이 폼 입력값 자체를 갱신한다.
  makeInlineEditable(out.heading, function(){ touched[mode].heading = true; els.heading.value = out.heading.textContent; saveState(); });
  makeInlineEditable(out.title, function(){ touched[mode].title = true; els.title.value = out.title.textContent; saveState(); });
  makeInlineEditable(out.original, function(){ touched[mode].original = true; els.original.value = out.original.textContent; saveState(); });
  makeInlineEditable(out.issueLabel, function(){ touched[mode].issueLabel = true; els.issueLabel.value = out.issueLabel.textContent; saveState(); });
  makeInlineEditable(out.people, function(){ touched[mode].people = true; els.people.value = out.people.textContent; saveState(); });
  makeInlineEditable(out.storeInfo, function(){ touched[mode].storeInfo = true; els.storeInfo.value = out.storeInfo.textContent; saveState(); });

  /* ---------- "추가·삭제 가능한 목록" 공용 렌더러 (좌석 · 유의사항) ---------- */
  function renderEditableList(items, container, onItemChange, onItemRemove){
    container.innerHTML = "";
    items.forEach(function(value, idx){
      var row = document.createElement("div");
      row.className = "edit-row";

      var num = document.createElement("div");
      num.className = "edit-number";
      num.textContent = idx + 1;

      var input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.addEventListener("input", function(e){
        items[idx] = e.target.value;
        onItemChange();
      });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "edit-remove";
      del.title = "삭제";
      del.textContent = "×";
      del.addEventListener("click", function(){
        if(items.length <= 1) return; // 최소 1개는 남긴다
        items.splice(idx, 1);
        onItemRemove();
      });

      row.appendChild(num);
      row.appendChild(input);
      row.appendChild(del);
      container.appendChild(row);
    });
  }

  function focusLastInput(container){
    var inputs = container.querySelectorAll('input[type="text"]');
    if(inputs.length) inputs[inputs.length - 1].focus();
  }

  /* ---------- 좌석 목록 (영화) ---------- */
  function renderSeatList(){
    renderEditableList(
      seats, els.seatList,
      function(){ touched[mode].seats = true; overrides.place = null; render(); },
      function(){ touched[mode].seats = true; overrides.place = null; renderSeatList(); render(); }
    );
  }

  els.addSeat.addEventListener("click", function(){
    touched[mode].seats = true;
    seats.push("");
    overrides.place = null;
    renderSeatList();
    render();
    focusLastInput(els.seatList);
  });

  // 자연스러운 순서(숫자를 진짜 크기로 비교)로 정렬 + 완전히 같은 좌석 표기는 하나만 남긴다.
  els.sortSeats.addEventListener("click", function(){
    touched[mode].seats = true;
    var deduped = [];
    seats.forEach(function(seat){
      var trimmed = seat.trim();
      if(trimmed !== "" && deduped.indexOf(trimmed) === -1) deduped.push(trimmed);
    });
    deduped.sort(function(a, b){
      return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
    });
    seats = deduped.length ? deduped : [""];
    overrides.place = null;
    renderSeatList();
    render();
  });

  /* ---------- 유의사항 목록 ---------- */
  function renderNoteList(){
    renderEditableList(
      notes, els.noteList,
      function(){ touched[mode].notes = true; notesOverride = null; render(); },
      function(){ touched[mode].notes = true; notesOverride = null; renderNoteList(); render(); }
    );
  }

  els.addNote.addEventListener("click", function(){
    touched[mode].notes = true;
    notes.push("");
    notesOverride = null;
    renderNoteList();
    render();
    focusLastInput(els.noteList);
  });

  /* ---------- 이용 항목(에셋) 선택 목록 (테마파크) ---------- */
  // 항목이 바뀌면 티켓 위에서 직접 고친 항목 줄/제목은 풀고 폼 값 기준으로 다시 그린다.
  function assetsChanged(){
    touched[mode].assets = true;
    assetsOverride = null;
    overrides.assetsTitle = null;
    render();
  }

  function renderAssetList(){
    els.assetList.innerHTML = "";
    assets.forEach(function(asset, idx){
      var row = document.createElement("div");
      row.className = "asset-row" + (asset.on ? "" : " off");

      var check = document.createElement("input");
      check.type = "checkbox";
      check.checked = asset.on;
      check.title = "티켓에 포함";
      check.addEventListener("change", function(){
        asset.on = check.checked;
        row.classList.toggle("off", !asset.on);
        assetsChanged();
      });

      var name = document.createElement("input");
      name.type = "text";
      name.value = asset.name;
      name.placeholder = "항목 이름";
      name.addEventListener("input", function(){
        asset.name = name.value;
        assetsChanged();
      });

      var cat = document.createElement("select");
      ASSET_CATS.forEach(function(c){
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        if(c === asset.cat) opt.selected = true;
        cat.appendChild(opt);
      });
      cat.addEventListener("change", function(){
        asset.cat = cat.value;
        assetsChanged();
      });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "edit-remove";
      del.title = "삭제";
      del.textContent = "×";
      del.addEventListener("click", function(){
        assets.splice(idx, 1);
        renderAssetList();
        assetsChanged();
      });

      row.appendChild(check);
      row.appendChild(name);
      row.appendChild(cat);
      row.appendChild(del);
      els.assetList.appendChild(row);
    });
  }

  els.selectAllAssets.addEventListener("click", function(){
    assets.forEach(function(a){ a.on = true; });
    renderAssetList();
    assetsChanged();
  });

  els.clearAllAssets.addEventListener("click", function(){
    assets.forEach(function(a){ a.on = false; });
    renderAssetList();
    assetsChanged();
  });

  els.addAsset.addEventListener("click", function(){
    var lastCat = assets.length ? assets[assets.length - 1].cat : ASSET_CATS[0];
    assets.push({ name: "", cat: lastCat, on: true });
    renderAssetList();
    assetsChanged();
    focusLastInput(els.assetList);
  });

  // 티켓에 표시되는 항목만(체크됨 + 이름 있음)
  function pickedAssets(){
    return assets.filter(function(a){ return a.on && a.name.trim() !== ""; });
  }

  // 분류 제목 줄 + 항목 줄로 펼친 목록
  function buildAssetLines(){
    var lines = [];
    var picked = pickedAssets();
    ASSET_CATS.forEach(function(cat){
      var group = picked.filter(function(a){ return a.cat === cat; });
      if(!group.length) return;
      lines.push({ head: true, text: "[" + cat + "]" });
      group.forEach(function(a){ lines.push({ head: false, text: a.name.trim() }); });
    });
    return lines;
  }

  /* ---------- 상품 목록 (마트/편의점 영수증) ---------- */
  function renderItemList(){
    els.itemList.innerHTML = "";
    items.forEach(function(item, idx){
      var row = document.createElement("div");
      row.className = "item-row";

      var name = document.createElement("input");
      name.type = "text";
      name.value = item.name;
      name.placeholder = "상품명";
      name.addEventListener("input", function(){
        item.name = name.value;
        itemsChanged();
      });

      var qty = document.createElement("input");
      qty.type = "number";
      qty.min = "0";
      qty.step = "1";
      qty.title = "수량";
      qty.value = item.qty;
      qty.addEventListener("input", function(){
        clampNonNegative(qty); // min="0"은 스피너 버튼에만 적용되고 직접 타이핑한 음수는 못 막아서 여기서 한 번 더 막는다
        item.qty = qty.value;
        itemsChanged();
      });

      var price = document.createElement("input");
      price.type = "number";
      price.min = "0";
      price.step = "1";
      price.title = "단가";
      price.value = item.price;
      price.addEventListener("input", function(){
        clampNonNegative(price);
        item.price = price.value;
        itemsChanged();
      });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "edit-remove";
      del.title = "삭제";
      del.textContent = "×";
      del.addEventListener("click", function(){
        if(items.length <= 1) return; // 최소 1개는 남긴다
        items.splice(idx, 1);
        renderItemList();
        itemsChanged();
      });

      row.appendChild(name);
      row.appendChild(qty);
      row.appendChild(price);
      row.appendChild(del);
      els.itemList.appendChild(row);
    });
  }

  els.addItem.addEventListener("click", function(){
    items.push({ name: "", qty: "1", price: "0" });
    renderItemList();
    itemsChanged();
    focusLastInput(els.itemList);
  });

  function itemsChanged(){
    touched[mode].items = true;
    render();
  }

  function itemLineTotal(it){ return toNumber(it.qty) * toNumber(it.price); }
  function itemsSubtotal(){
    return items.reduce(function(sum, it){ return sum + itemLineTotal(it); }, 0);
  }

  /* ---------- 왼쪽 패널 값이 바뀌면 관련된 직접-편집(override)은 해제 ---------- */
  // (아래 render 연결보다 먼저 등록되어야, 해제 → 다시 그리기 순서가 지켜진다)
  [
    { el: els.issued, key: "issued" },
    { el: els.format, key: "rating" },
    { el: els.rating, key: "rating" },
    { el: els.date, key: "showtime" },
    { el: els.session, key: "showtime" },
    { el: els.start, key: "showtime" },
    { el: els.end, key: "showtime" },
    { el: els.screen, key: "place" }
  ].forEach(function(binding){
    binding.el.addEventListener("input", function(){ overrides[binding.key] = null; });
  });

  // (테마파크) 인원수를 바꾸면 직접 적어 둔 인원 표기는 비우고 자동 표기로 돌아간다.
  [els.adult, els.child, els.senior].forEach(function(el){
    el.addEventListener("input", function(){ els.people.value = ""; });
  });

  /* ---------- 색상 ---------- */
  function bindColor(input, code, cssVar){
    input.addEventListener("input", function(){
      touched[mode].colors = true;
      code.textContent = input.value;
      els.ticket.style.setProperty(cssVar, input.value);
      saveState();
    });
  }
  bindColor(els.cBg, document.getElementById("c-bg-code"), "--ticket-bg");
  bindColor(els.cText, document.getElementById("c-text-code"), "--ticket-text");
  bindColor(els.cLine, document.getElementById("c-line-code"), "--ticket-line");

  /* ---------- 날짜 포맷 ---------- */
  // datetime-local 값 "YYYY-MM-DDTHH:MM" -> "YYYY-MM-DD HH:MM"
  function formatIssued(value){
    if(!value) return "";
    var d = new Date(value);
    if(isNaN(d.getTime())) return value;
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // date 값 "YYYY-MM-DD" -> "YYYY.MM.DD(요일)"
  function formatShowDate(value){
    if(!value) return "";
    var parts = value.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return parts[0] + "." + parts[1] + "." + parts[2] + "(" + DAYS[d.getDay()] + ")";
  }

  // (테마파크) 인원수 칸 값으로 만드는 자동 인원 표기 (예: "대인 2명 · 소인 1명 (총 3명)")
  function autoParkPeopleText(){
    var adult = toCount(els.adult.value);
    var child = toCount(els.child.value);
    var senior = toCount(els.senior.value);
    var parts = [];
    if(adult) parts.push("대인 " + adult + "명");
    if(child) parts.push("소인 " + child + "명");
    if(senior) parts.push("우대 " + senior + "명");
    var total = adult + child + senior;
    return parts.length ? parts.join(" · ") + " (총 " + total + "명)" : "총 인원 0명";
  }

  /* ---------- 렌더 ---------- */
  function render(){
    var isPark = mode === "park";

    out.heading.textContent = els.heading.value;

    out.issued.textContent = overrides.issued !== null
      ? overrides.issued
      : formatIssued(els.issued.value);

    out.issueLabel.textContent = els.issueLabel.value;

    out.rating.textContent = overrides.rating !== null
      ? overrides.rating
      : joinNonEmpty([els.format.value, els.rating.value], ", ");

    out.title.textContent = els.title.value;
    out.original.textContent = els.original.value;

    // 이용 시간: 영화는 "날짜 N회 시작-종료", 테마파크는 "날짜 시작-종료"
    var range = joinNonEmpty([els.start.value, els.end.value], "-");
    var showParts = [formatShowDate(els.date.value)];
    if(!isPark) showParts.push((els.session.value || "1") + "회");
    showParts.push(range);
    out.showtime.textContent = overrides.showtime !== null
      ? overrides.showtime
      : joinNonEmpty(showParts, " ");

    // 장소 줄: 영화는 "장소 좌석1, 좌석2", 테마파크는 입장 게이트만
    var activeSeats = nonEmpty(seats);
    var screenText = els.screen.value.trim();
    var placeText = isPark
      ? screenText
      : (screenText ? screenText + " " : "") + activeSeats.join(", ");
    out.place.textContent = overrides.place !== null ? overrides.place : placeText;

    var pickedCount = pickedAssets().length;
    out.assetsTitle.textContent = overrides.assetsTitle !== null
      ? overrides.assetsTitle
      : "선택 이용 항목 (" + pickedCount + ")";
    renderAssetLines();
    els.assetSummary.textContent = "체크한 항목만 티켓에 표시됩니다. (선택 " + pickedCount + " / 전체 " + assets.length + ")";

    var autoPeople = isPark ? autoParkPeopleText() : "총 인원 " + activeSeats.length + "명";
    out.people.textContent = els.people.value.trim() || autoPeople;

    out.storeInfo.textContent = els.storeInfo.value;
    renderItemLines();
    renderTotals();

    renderNotes();
    saveState();
  }

  // 상품 목록: 이름이 비어 있는 줄은 건너뛴다 (수량 입력 중인 빈 줄 등).
  function renderItemLines(){
    out.items.innerHTML = "";
    var shown = items.filter(function(it){ return it.name.trim() !== ""; });

    if(!shown.length){
      var empty = document.createElement("div");
      empty.className = "items-empty";
      empty.textContent = "왼쪽에서 상품을 추가해 주세요.";
      out.items.appendChild(empty);
      return;
    }

    shown.forEach(function(it){
      var row = document.createElement("div");
      row.className = "item-line";

      var left = document.createElement("div");
      var name = document.createElement("div");
      name.className = "item-name";
      name.textContent = it.name.trim();
      var sub = document.createElement("div");
      sub.className = "item-sub";
      sub.textContent = toNumber(it.qty) + "개 × " + formatWon(toNumber(it.price));
      left.appendChild(name);
      left.appendChild(sub);

      var price = document.createElement("div");
      price.className = "item-price";
      price.textContent = formatWon(itemLineTotal(it));

      row.appendChild(left);
      row.appendChild(price);
      out.items.appendChild(row);
    });
  }

  // 합계 / 결제수단 / 받은 금액·거스름돈 (받은 금액을 입력했을 때만 표시)
  function renderTotals(){
    out.totals.innerHTML = "";
    var subtotal = itemsSubtotal();

    function addRow(label, value, grand){
      var row = document.createElement("div");
      row.className = "totals-row" + (grand ? " grand" : "");
      var l = document.createElement("span");
      l.textContent = label;
      var v = document.createElement("span");
      v.textContent = value;
      row.appendChild(l);
      row.appendChild(v);
      out.totals.appendChild(row);
    }

    var method = els.paymentMethod.value.trim();
    if(method) addRow("결제수단", method);
    addRow("합계", formatWon(subtotal), true);

    var tenderedRaw = els.tendered.value;
    if(String(tenderedRaw).trim() !== ""){
      var tendered = toNumber(tenderedRaw);
      addRow("받은 금액", formatWon(tendered));
      addRow("거스름돈", formatWon(Math.max(0, tendered - subtotal)));
    }
  }

  // 선택 항목도 여러 줄이라 별도 함수로 분리 — 각 줄도 티켓에서 바로 편집 가능해야 한다.
  function renderAssetLines(){
    out.assets.innerHTML = "";
    var lines = assetsOverride !== null ? assetsOverride : buildAssetLines();

    lines.forEach(function(line){
      var div = document.createElement("div");
      div.className = (line.head ? "asset-head" : "asset-line") + " editable";
      div.setAttribute("contenteditable", "true");
      div.dataset.head = line.head ? "1" : "";
      div.textContent = line.text;
      makeInlineEditable(div, function(){
        assetsOverride = Array.prototype.map.call(
          out.assets.querySelectorAll(".editable"),
          function(n){ return { head: n.dataset.head === "1", text: n.textContent }; }
        );
        saveState();
      });
      out.assets.appendChild(div);
    });
  }

  // 유의사항은 여러 줄이라 별도 함수로 분리 — 각 줄도 티켓에서 바로 편집 가능해야 한다.
  function renderNotes(){
    out.notes.innerHTML = "";
    var lines = notesOverride !== null ? notesOverride : nonEmpty(notes.map(function(l){ return l.trim(); }));

    lines.forEach(function(line){
      var div = document.createElement("div");
      div.className = "note editable";
      div.setAttribute("contenteditable", "true");
      div.textContent = line;
      makeInlineEditable(div, function(){
        notesOverride = Array.prototype.map.call(
          out.notes.querySelectorAll(".note"),
          function(n){ return n.textContent; }
        );
        saveState();
      });
      out.notes.appendChild(div);
    });
  }

  // 폼 값이 바뀔 때마다 전체 다시 그리기 (+ render() 안에서 자동 저장까지 수행)
  // key가 있는 필드는 사용자가 실제로 고친 것으로 표시해 둔다(touched).
  // (발권일시·날짜·시작·종료는 어차피 열 때마다 현재 시각으로 다시 채워지므로 표시하지 않는다.)
  [
    { el: els.heading, key: "heading" },
    { el: els.issued, key: null },
    { el: els.issueLabel, key: "issueLabel" },
    { el: els.format, key: "format" },
    { el: els.rating, key: "rating" },
    { el: els.title, key: "title" },
    { el: els.original, key: "original" },
    { el: els.date, key: null },
    { el: els.session, key: "session" },
    { el: els.start, key: null },
    { el: els.end, key: null },
    { el: els.screen, key: "screen" },
    { el: els.adult, key: "adult" },
    { el: els.child, key: "child" },
    { el: els.senior, key: "senior" },
    { el: els.people, key: "people" },
    { el: els.storeInfo, key: "storeInfo" },
    { el: els.paymentMethod, key: "paymentMethod" },
    { el: els.tendered, key: "tendered" }
  ].forEach(function(binding){
    binding.el.addEventListener("input", function(){
      if(binding.key) touched[mode][binding.key] = true;
      render();
    });
  });

  /* ---------- 내보내기 (인쇄 / PNG 저장) ---------- */
  els.btnPrint.addEventListener("click", function(){ window.print(); });

  els.btnPng.addEventListener("click", function(){
    if(typeof html2canvas === "undefined"){
      alert("이미지 저장 기능을 불러오지 못했습니다. 인쇄 기능을 이용해 주세요.");
      return;
    }
    els.btnPng.disabled = true;
    els.btnPng.textContent = "저장 중…";

    // Galmuri14 같은 웹폰트가 아직 다운로드 중일 때 캡처하면 기본 폰트로 찍힐 수 있어서,
    // document.fonts.ready(요청된 폰트들이 전부 로드/실패 처리될 때까지)를 먼저 기다린다.
    // fonts API를 지원하지 않는 아주 오래된 브라우저에서는 그냥 바로 진행한다.
    var fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();

    fontsReady
      .then(function(){
        return html2canvas(els.ticket, { backgroundColor: null, scale: 2 });
      })
      .then(function(canvas){
        var link = document.createElement("a");
        link.download = (els.title.value || (mode === "park" ? "theme-park-ticket" : "movie-ticket")) + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch(function(){
        alert("이미지 저장 중 문제가 발생했습니다.");
      })
      .finally(function(){
        els.btnPng.disabled = false;
        els.btnPng.textContent = "이미지로 저장";
      });
  });

  /* ---------- 업데이트 알림 배너 ---------- */
  // 기존에 편집하던 내용(저장값)이 있던 사람이 새 버전을 다시 열었을 때,
  // 물어보지 않고 세 종류(영화/테마파크/영수증) 모두, 안 고친 값만 새 기본값으로 반영한 뒤 짧게 안내만 띄운다.
  // (처음 여는 사람에게는 "업데이트"라는 게 의미가 없으므로 아무 것도 하지 않는다.)
  var UPDATE_BANNER_AUTO_HIDE_MS = 6000;

  function checkForUpdate(){
    var hadSavedData = !!(readJson(STORAGE_KEY) || readJson(LEGACY_MOVIE_KEY) || readJson(LEGACY_PARK_KEY));
    var seenVersion = null;
    try{ seenVersion = localStorage.getItem(VERSION_SEEN_KEY); } catch(e){}

    if(hadSavedData && seenVersion !== APP_VERSION){
      applyUntouchedDefaults("movie");
      applyUntouchedDefaults("park");
      applyUntouchedDefaults("receipt");
      var banner = document.getElementById("updateBanner");
      banner.classList.remove("hidden");
      setTimeout(function(){ banner.classList.add("hidden"); }, UPDATE_BANNER_AUTO_HIDE_MS);
    }
    try{ localStorage.setItem(VERSION_SEEN_KEY, APP_VERSION); } catch(e){}
  }

  document.getElementById("updateBannerVersion").textContent = APP_VERSION;
  document.getElementById("footerVersion").textContent = APP_VERSION;

  document.getElementById("updateBannerClose").addEventListener("click", function(){
    document.getElementById("updateBanner").classList.add("hidden");
  });

  document.getElementById("storageWarningClose").addEventListener("click", function(){
    document.getElementById("storageWarning").classList.add("hidden");
  });

  // 시크릿 모드 등으로 저장 자체가 아예 막혀 있으면, 첫 타이핑을 기다리지 않고 시작 시점에 바로 알린다.
  (function testStorageAvailability(){
    try{
      var probeKey = STORAGE_KEY + ":__probe__";
      localStorage.setItem(probeKey, "1");
      localStorage.removeItem(probeKey);
    } catch(e){
      warnStorageFailure();
    }
  })();

  /* ---------- 시작: 저장된 값이 있으면 불러오고, 없으면 현재 시각 기준 기본값 사용 ---------- */
  loadAll();
  fillForm(data[mode]);
  applyModeUI();
  renderAllLists();
  render();
  checkForUpdate();

})();
