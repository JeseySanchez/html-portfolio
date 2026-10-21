/* Kiko — a science-backed, task-by-task language learning app. */
(() => {
  "use strict";

  // Bump together with version.json and the ?v= links in index.html.
  const APP_VERSION = "11";
  const STORE_KEY = "kiko-v1";

  // GitHub Pages lets browsers cache index.html too, so a returning visitor
  // can be stuck on old code. version.json is fetched uncached; if it's newer,
  // reload at a fresh URL, which bypasses the stale cached page.
  fetch(`version.json?t=${Date.now()}`, { cache: "no-store" })
    .then((r) => r.json())
    .then(({ v }) => {
      if (v && v !== APP_VERSION && new URLSearchParams(location.search).get("v") !== v) {
        location.replace(`${location.pathname}?v=${v}`);
      }
    })
    .catch(() => {});
  const DAY = 24 * 60 * 60 * 1000;
  const app = document.getElementById("app");
  const hud = document.getElementById("hud");
  // Feedback sheets live outside #app so screen animations never move them.
  const sheetRoot = document.getElementById("sheet");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- State ----------
  const blank = () => ({ lang: null, xp: 0, muted: false, streak: { count: 0, last: null }, progress: {} });
  let state = load();

  function load() {
    try {
      return Object.assign(blank(), JSON.parse(localStorage.getItem(STORE_KEY)) || {});
    } catch {
      return blank();
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
    renderHud();
  }
  function prog() {
    if (!state.progress[state.lang]) state.progress[state.lang] = { done: [], cards: {}, plan: null };
    return state.progress[state.lang];
  }
  const L = () => LANGUAGES[state.lang];

  // ---------- Streak ----------
  // Days are local calendar dates ("YYYY-MM-DD"), so the streak rolls over at
  // the learner's midnight, not UTC's.
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => dayKey();
  const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / DAY);
  const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
  const MAX_FREEZES = 2;
  function streak() {
    const s = state.streak;
    s.longest ??= s.count;
    s.freezes ??= 0;
    s.days ??= s.last ? [s.last] : [];
    s.frozen ??= [];
    return s;
  }
  // A streak survives missed days as long as there are freezes to cover them.
  function currentStreak() {
    const s = streak();
    if (!s.last) return 0;
    const gap = daysBetween(s.last, today());
    return gap <= 1 || gap - 1 <= s.freezes ? s.count : 0;
  }
  const practisedToday = () => streak().last === today();
  // Record today's practice. Returns what changed (for the celebration), or
  // null if today was already counted.
  function bumpStreak() {
    const s = streak(), t = today();
    if (s.last === t) return null;
    const gap = s.last ? daysBetween(s.last, t) : Infinity;
    const news = { usedFreezes: 0, earnedFreeze: false, milestone: null };
    if (gap === 1) s.count += 1;
    else if (gap - 1 <= s.freezes) {
      news.usedFreezes = gap - 1;
      s.freezes -= gap - 1;
      for (let k = 1; k < gap; k++) s.frozen.push(dayKey(new Date(Date.now() - k * DAY)));
      s.count += 1;
    } else s.count = 1;
    s.last = t;
    s.days = [...s.days, t].slice(-120);
    s.frozen = s.frozen.slice(-30);
    s.longest = Math.max(s.longest, s.count);
    if (s.count % 7 === 0 && s.freezes < MAX_FREEZES) { s.freezes += 1; news.earnedFreeze = true; }
    if (MILESTONES.includes(s.count)) news.milestone = s.count;
    news.count = s.count;
    return news;
  }
  // The last seven days, oldest first, for the streak calendar.
  function weekRow() {
    const s = streak();
    const cells = [];
    for (let k = 6; k >= 0; k--) {
      const d = new Date(Date.now() - k * DAY), key = dayKey(d);
      const status = s.days.includes(key) ? "done" : s.frozen.includes(key) ? "frozen" : k === 0 ? "today" : "missed";
      const mark = { done: "🔥", frozen: "❄️", today: "", missed: "" }[status];
      cells.push(`<div class="day ${status}"><span>${mark}</span><small>${d.toLocaleDateString(undefined, { weekday: "narrow" })}</small></div>`);
    }
    return `<div class="week">${cells.join("")}</div>`;
  }

  // Award XP, update the streak, and animate the HUD. The first practice of
  // the day extends the streak; that news is shown on the next celebration.
  let streakNews = null;
  function gain(n, quiet = false) {
    state.xp += n;
    const news = bumpStreak();
    save();
    bump("[data-xp]", `+${n} XP`);
    if (news) {
      streakNews = news;
      bump("[data-streak]", "🔥");
      if (!quiet) toast(`🔥 ${news.count}-day streak!`);
    }
  }

  // ---------- Helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n) => shuffle(a).slice(0, n);
  const one = (a) => a[Math.floor(Math.random() * a.length)];
  const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const clean = (s) => s.toLowerCase().replace(/[¿?¡!.,;:«»„“"—–]/g, " ").replace(/\s+/g, " ").trim();
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const later = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

  function speak(text, rate = 0.95) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = L().tts;
    u.rate = rate;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(L().tts.slice(0, 2)));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }
  if ("speechSynthesis" in window) speechSynthesis.getVoices();

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Listen once in the course language; resolves with everything the
  // recogniser thinks it heard (best guess first).
  function listen() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const rec = new Recognition();
      rec.lang = L().tts;
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.onresult = (e) => { settled = true; resolve([...e.results[0]].map((a) => a.transcript)); };
      rec.onerror = (e) => { settled = true; reject(e.error || "error"); };
      rec.onend = () => { if (!settled) reject("no-speech"); };
      try { rec.start(); } catch { reject("start"); }
      setTimeout(() => { if (!settled) try { rec.stop(); } catch {} }, 7000);
    });
  }
  const MIC_ERRORS = {
    "not-allowed": "Kiko needs your microphone. Allow the mic for this site in your browser settings, or tap \"Can't speak now\".",
    "service-not-allowed": "Speech recognition is turned off on this device. Tap \"Can't speak now\" to practise without it.",
    "audio-capture": "Kiko couldn't find a microphone.",
    network: "Speech recognition needs an internet connection.",
    "no-speech": "Kiko didn't hear anything. Tap the mic and try again.",
  };
  const micError = (code) => MIC_ERRORS[code] || "Something went wrong with the mic. Try again.";

  const norm = (s) => fold(clean(s)).replace(/[^\p{L}\p{N}' ]/gu, "").trim();
  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // Did the learner say `target`? Accepts it inside a short phrase ("el amigo")
  // and small recognition slips on longer words; short words must match exactly.
  function heard(alternatives, target) {
    const t = norm(target);
    const slack = t.length <= 3 ? 0 : Math.max(1, Math.floor(t.length / 4));
    return alternatives.some((alt) => {
      const a = norm(alt);
      if (a === t || ` ${a} `.includes(` ${t} `)) return true;
      return [a, ...a.split(" ")].some((w) => editDistance(w, t) <= slack);
    });
  }

  // Similarity between what was said and the target, 0..1 (word-level).
  function similarity(said, target) {
    const a = fold(clean(said)).split(" "), b = fold(clean(target)).split(" ");
    const hits = b.filter((w) => a.includes(w)).length;
    return b.length ? hits / b.length : 0;
  }

  // ---------- Sound effects (synthesised, no files) ----------
  let actx;
  function tone(notes) {
    if (state.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      notes.forEach(([freq, start, dur, type = "sine", vol = 0.12]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + start);
        g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        o.connect(g).connect(actx.destination);
        o.start(t0 + start);
        o.stop(t0 + start + dur + 0.05);
      });
    } catch {}
  }
  const sfx = {
    right: () => tone([[660, 0, 0.12], [990, 0.09, 0.22]]),
    wrong: () => tone([[240, 0, 0.14, "triangle", 0.1], [190, 0.12, 0.24, "triangle", 0.1]]),
    flip: () => tone([[420, 0, 0.05, "sine", 0.05], [620, 0.04, 0.07, "sine", 0.05]]),
    tap: () => tone([[560, 0, 0.05, "sine", 0.05]]),
    win: () => tone([[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]]),
  };

  // ---------- Effects ----------
  function confetti(n = 26, origin) {
    if (reduced) return;
    const { x, y } = origin || { x: innerWidth / 2, y: innerHeight * 0.35 };
    const layer = document.createElement("div");
    layer.className = "confetti";
    const colors = ["#3f9a46", "#f6a59c", "#f2b84b", "#7cc5f2", "#c99be8"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 150;
      p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 90}px;--r:${Math.random() * 900 - 450}deg;animation-delay:${Math.random() * 90}ms`;
      if (i % 3 === 0) p.style.borderRadius = "50%";
      layer.append(p);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 1600);
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  // Brief message that drops in at the top of the screen.
  function toast(text) {
    const t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = text;
    document.body.append(t);
    setTimeout(() => t.classList.add("out"), 2400);
    setTimeout(() => t.remove(), 2800);
  }

  // Pop a HUD chip and float a label out of it.
  function bump(sel, label) {
    const chip = hud.querySelector(sel);
    if (!chip) return;
    chip.classList.remove("bump");
    void chip.offsetWidth;
    chip.classList.add("bump");
    if (reduced || !label) return;
    const { x } = centerOf(chip);
    const f = document.createElement("div");
    f.className = "xp-float";
    f.textContent = label;
    f.style.left = `${x}px`;
    f.style.top = `${chip.getBoundingClientRect().bottom}px`;
    document.body.append(f);
    setTimeout(() => f.remove(), 1100);
  }

  // Animate an element from a previous screen rect to where it is now (FLIP).
  function flyFrom(el, rect) {
    if (reduced || !el || !el.animate) return;
    const r = el.getBoundingClientRect();
    el.animate(
      [{ transform: `translate(${rect.left - r.left}px, ${rect.top - r.top}px)` }, { transform: "none" }],
      { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  function countUp(el, to) {
    if (reduced) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 800);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const CHEERS = ["Nice one!", "You got it!", "Brilliant!", "Hop hop, correct!", "Your brain just got stronger!", "Yes!"];
  const NUDGES = ["Almost! Mistakes help you remember.", "Good try. You'll see this one again.", "Getting it wrong first makes it stick better!"];

  // mood: "correct" or "wrong" plays that reaction, then Kiko settles back down.
  function kikoSays(text, mood = "") {
    const k = $(".coach");
    if (!k) return;
    const bubble = $(".bubble", k);
    bubble.innerHTML = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    if (mood) play($(".kiko", k), mood);
  }

  // ---------- Kiko the puppet ----------
  // Kiko is assembled from the layered kit (kiko-rig.js): nested full-frame
  // groups that rotate around measured pivots, so the head carries the face
  // and ears, and arms, legs, ears and tail move on their own. Moods are CSS
  // animations on those parts (.m-* in styles.css); blinking and expressions
  // swap the eye and mouth layers.
  const MOVABLE = new Set(["tail", "leg_left", "leg_right", "arm_left", "arm_right", "ear_left", "ear_right"]);
  const rigSrc = (id) => `assets/rig/${id}.webp?v=${APP_VERSION}`;
  const PUPPET = (() => {
    const R = KIKO_RIG;
    const part = (id, pivot, inner) =>
      `<div class="kp kp-${id}" style="transform-origin:${pivot[0]}% ${pivot[1]}%">${inner}</div>`;
    const img = (l) =>
      `<img class="kl kl-${l.id}" src="${rigSrc(l.id)}" alt="" style="left:${l.box[0]}%;top:${l.box[1]}%;width:${l.box[2]}%;height:${l.box[3]}%">`;
    const minZ = (g) => Math.min(...R.layers.filter((l) => l.parent === g).map((l) => l.z), ...Object.values(R.groups).filter((c) => c.parent === g).map((c) => minZ(c.id)));
    const build = (g) => [
      ...R.layers.filter((l) => l.parent === g).map((l) => ({ z: l.z, html: MOVABLE.has(l.id) ? part(l.id, l.pivot, img(l)) : img(l) })),
      ...Object.values(R.groups).filter((c) => c.parent === g).map((c) => ({ z: minZ(c.id), html: part(c.id, c.pivot, build(c.id)) })),
    ].sort((a, b) => a.z - b.z).map((x) => x.html).join("");
    return part("root", R.groups.root.pivot, build("root"));
  })();
  // Show Kiko only once every layer has loaded, so he never appears in pieces.
  Promise.all(KIKO_RIG.layers.map((l) => { const im = new Image(); im.src = rigSrc(l.id); return im.decode().catch(() => {}); }))
    .then(() => document.documentElement.classList.add("rig-ready"));

  // Each pose sets the body animation and the mouth.
  const MOUTH = { idle: "smile", welcome: "smile", thinking: "neutral", correct: "smile", oops: "surprised", wrong: "neutral", encourage: "smile", celebrate: "smile" };
  // One-off moods: [pose, how long to hold it (ms)]; then Kiko settles down.
  const SEQUENCES = {
    welcome: [["welcome", 2600]],
    correct: [["correct", 1300]],
    wrong: [["oops", 380], ["wrong", 1000], ["encourage", 1400]],
  };
  const kiko = (mood, cls = "") =>
    `<span class="kiko ${cls}" data-mood="${mood}" role="img" aria-label="Kiko">${PUPPET}<span class="kiko-think" aria-hidden="true">?</span></span>`;
  const coach = (text, mood = "idle") => `<div class="coach">${kiko(mood)}<div class="bubble">${text}</div></div>`;

  function showPose(el, pose) {
    el.className = el.className.replace(/\b(m|mouth)-\S+/g, "").trim() + ` m-${pose} mouth-${MOUTH[pose]}`;
  }

  // Set Kiko's mood. Reactions play their poses, then Kiko settles down
  // (back to dancing on the celebration screen, otherwise to idle).
  function play(el, mood) {
    if (!el) return;
    clearTimeout(el._timer);
    const rest = el.dataset.mood;
    const steps = SEQUENCES[mood] || [[mood, 0]];
    let i = 0;
    const next = () => {
      if (!el.isConnected) return;
      if (i >= steps.length) { showPose(el, rest === "celebrate" ? rest : "idle"); return; }
      const [pose, hold] = steps[i++];
      showPose(el, pose);
      if (hold) el._timer = setTimeout(next, hold);
    };
    next();
  }

  // Blink every few seconds (not mid-surprise).
  (function blinkLoop() {
    $$(".kiko:not(.mouth-surprised)").forEach((el) => {
      if (Math.random() < 0.6) {
        el.classList.add("blinking");
        setTimeout(() => el.classList.remove("blinking"), 140);
      }
    });
    setTimeout(blinkLoop, 2400 + Math.random() * 2600);
  })();

  // Feedback sheet that slides up from the bottom of the screen, with Kiko
  // reacting in it (the sheet covers the coach on small screens).
  function showSheet(html) {
    sheetRoot.innerHTML = html;
    app.classList.add("has-sheet"); // the sheet's Kiko reacts; the coach's steps aside
    $$(".kiko[data-mood]", sheetRoot).forEach((el) => play(el, el.dataset.mood));
  }
  const sheet = (ok, title, body = "", btn = "Continue") => `
    <div class="fb sheet ${ok ? "ok" : "no"}" role="status">
      <div class="sheet-inner">
        <div class="sheet-head">
          ${kiko(ok ? "correct" : "wrong", "sheet-kiko")}
          <div class="sheet-text"><b>${ok ? "✓" : "✕"} ${title}</b>${body ? `<p>${body}</p>` : ""}</div>
        </div>
        <button class="btn" data-act="next">${btn}</button>
      </div>
    </div>`;

  // ---------- Spaced repetition (simplified SM-2) ----------
  function wordsInBatches(batches) {
    return batches.flatMap((b) => L().words.slice(b * 10, b * 10 + 10));
  }
  function addCards(words) {
    const cards = prog().cards;
    words.forEach(([w]) => { if (!cards[w]) cards[w] = { ease: 2.5, interval: 0, reps: 0, due: Date.now() }; });
    save();
  }
  function schedule(card, grade) {
    // grade: 0 again, 1 hard, 2 good, 3 easy
    if (grade === 0) { card.reps = 0; card.interval = 0; card.ease = Math.max(1.3, card.ease - 0.2); card.due = Date.now() + 60 * 1000; return; }
    card.reps += 1;
    if (card.reps === 1) card.interval = grade === 3 ? 3 : 1;
    else if (card.reps === 2) card.interval = grade === 1 ? 2 : grade === 3 ? 8 : 4;
    else card.interval = Math.round(card.interval * (grade === 1 ? 1.2 : grade === 3 ? card.ease * 1.3 : card.ease));
    card.ease = Math.max(1.3, card.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
    card.due = Date.now() + card.interval * DAY;
  }
  function previewInterval(card, grade) {
    const c = { ...card };
    schedule(c, grade);
    return grade === 0 ? "1 min" : c.interval === 1 ? "1 day" : `${c.interval} days`;
  }
  function dueCards() {
    const now = Date.now();
    return Object.entries(prog().cards).filter(([, c]) => c.due <= now).map(([w]) => w);
  }
  const meaningOf = (w) => (L().words.find(([t]) => t === w) || [w, "?"])[1];

  // ---------- HUD ----------
  function renderHud() {
    if (!state.lang) { hud.innerHTML = ""; return; }
    const done = prog().done.length;
    hud.innerHTML = `
      <button class="hud-chip" data-act="lang" title="Change language">${L().flag}</button>
      <button class="hud-chip ${practisedToday() ? "" : "cold"}" data-streak data-act="streak" title="Your streak">🔥 ${currentStreak()}</button>
      <span class="hud-chip" data-xp title="Experience points">⭐ ${state.xp}</span>
      <button class="hud-chip icon" data-act="mute" title="${state.muted ? "Turn sounds on" : "Turn sounds off"}" aria-label="${state.muted ? "Unmute" : "Mute"}">${state.muted ? "🔇" : "🔈"}</button>
      <div class="hud-bar" title="${done} of ${TASKS.length} tasks"><span style="width:${(done / TASKS.length) * 100}%"></span></div>`;
  }
  hud.addEventListener("click", (e) => {
    if (e.target.closest("[data-act=lang]")) showWelcome();
    if (e.target.closest("[data-act=mute]")) { state.muted = !state.muted; save(); sfx.tap(); }
  });
  // Buttons that can appear on any screen (celebrations, home, the plan task).
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-act=streak]")) showStreakPanel();
    if (e.target.closest("[data-act=calendar]")) downloadReminder();
  });

  // ---------- Streak panel ----------
  function showStreakPanel() {
    sfx.tap();
    const s = streak(), n = currentStreak();
    const next = MILESTONES.find((m) => m > n) || n + 1;
    const prev = [...MILESTONES].reverse().find((m) => m <= n) || 0;
    const status = practisedToday()
      ? "You've practised today. See you tomorrow! 🐰"
      : n ? "Practise today to keep your streak going." : "Finish any task to start a streak.";
    const r = reminder();
    const notifyState = !("Notification" in window) ? "unsupported" : Notification.permission;
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Your streak">
        <button class="modal-close" data-close aria-label="Close">✕</button>
        <div class="streak-hero">
          <span class="flame ${practisedToday() ? "lit" : ""}">🔥</span>
          <div><b>${n}</b><small>day streak</small></div>
        </div>
        <p class="center">${status}</p>
        ${weekRow()}
        <div class="streak-stats">
          <div><b>${s.longest}</b><small>longest streak</small></div>
          <div><b>❄️ ${s.freezes}/${MAX_FREEZES}</b><small>streak freezes</small></div>
        </div>
        <div class="milestone">
          <div class="milestone-label"><span>Next milestone</span><b>${next} days</b></div>
          <div class="hud-bar wide"><span style="width:${((n - prev) / (next - prev)) * 100}%"></span></div>
          <small class="muted">${next - n} more day${next - n === 1 ? "" : "s"} to go</small>
        </div>
        <p class="muted small">You earn a streak freeze for every 7 days in a row (up to ${MAX_FREEZES}). If you miss a day, one is used automatically so your streak survives.</p>
        <h3>⏰ Daily reminder</h3>
        <label class="field inline">Remind me at <input type="time" id="remTime" class="input" value="${r.time}"></label>
        <button class="btn big" data-act="calendar">📅 Add to my calendar</button>
        <p class="muted small">Creates a repeating daily event with an alert. This is the most reliable reminder, especially on iPhone.</p>
        ${notifyState === "unsupported" ? "" : `
        <label class="check"><input type="checkbox" id="remNotify" ${r.notify && notifyState === "granted" ? "checked" : ""} ${notifyState === "denied" ? "disabled" : ""}>
          Also notify me in this browser</label>
        <p class="muted small">${notifyState === "denied" ? "Notifications are blocked for this site in your browser settings." : "Browser reminders only arrive while Kiko is open in a tab."}</p>`}
      </div>`;
    document.body.append(modal);
    const close = () => { modal.classList.add("closing"); setTimeout(() => modal.remove(), 200); };
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
    $("#remTime", modal).addEventListener("change", (e) => { reminder().time = e.target.value || "19:00"; save(); });
    $("#remNotify", modal)?.addEventListener("change", async (e) => {
      if (e.target.checked && Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") e.target.checked = false;
      }
      reminder().notify = e.target.checked;
      save();
    });
    $(".modal-close", modal).focus();
  }

  // ---------- Daily reminder ----------
  function reminder() {
    state.reminder ??= { time: "19:00", notify: false, lastNotified: null };
    return state.reminder;
  }
  const reminderPassed = () => {
    const [h, m] = reminder().time.split(":").map(Number);
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  };
  const formatTime = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };
  // A repeating calendar event is the one reminder that works even when the
  // app is closed (websites can't schedule notifications on their own).
  function downloadReminder() {
    const [h, m] = reminder().time.split(":");
    const url = location.origin + location.pathname;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kiko//Daily practice//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:kiko-daily-${Date.now()}@kiko`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${today().replace(/-/g, "")}T${h}${m}00`,
      "DURATION:PT10M",
      "RRULE:FREQ=DAILY",
      `SUMMARY:Practise ${state.lang ? L().name : "languages"} with Kiko 🐰`,
      `DESCRIPTION:A few minutes a day keeps your streak alive. ${url}`,
      `URL:${url}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Time to practise with Kiko!", "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "kiko-daily-reminder.ics";
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("📅 Open the file to add the reminder to your calendar");
  }
  // While Kiko is open, nudge with a notification once the reminder time passes.
  function checkReminder() {
    const r = reminder();
    if (!r.notify || !("Notification" in window) || Notification.permission !== "granted") return;
    if (practisedToday() || !reminderPassed() || r.lastNotified === today()) return;
    try {
      const n = currentStreak();
      new Notification("Time to practise with Kiko 🐰", {
        body: n ? `Keep your ${n}-day streak going with a quick task.` : "A few minutes today makes a big difference.",
        icon: "assets/kiko-192.png",
      });
      r.lastNotified = today();
      save();
    } catch {} // some mobile browsers only allow notifications from a service worker
  }
  setInterval(checkReminder, 60 * 1000);
  document.getElementById("logo").addEventListener("click", () => state.lang ? showHome() : showWelcome());

  // Progress bars animate from where the previous screen left them.
  let barFrom = 0;
  function screen(html) {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    app.innerHTML = html;
    sheetRoot.innerHTML = "";
    app.classList.remove("has-sheet");
    $$(".kiko[data-mood]", app).forEach((el) => play(el, el.dataset.mood));
    app.classList.remove("enter");
    void app.offsetWidth;
    app.classList.add("enter");
    window.scrollTo(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => $$("[data-to]").forEach((el) => (el.style.width = `${el.dataset.to}%`))));
  }

  // ---------- Welcome ----------
  function showWelcome() {
    screen(`
      <section class="welcome">
        <div class="hero-wrap">${kiko("welcome", "hero-sprite")}</div>
        <h1>Hi, I'm <span class="brand">Kiko</span>!</h1>
        <p class="lead">I'll teach you a new language using <b>methods backed by learning science</b>, one small task at a time.</p>
        <h2>What do you want to learn?</h2>
        <div class="lang-grid">
          ${Object.entries(LANGUAGES).map(([code, l], i) => `
            <button class="lang-btn ${state.lang === code ? "selected" : ""}" data-lang="${code}" style="--i:${i}">
              <span class="flag">${l.flag}</span><span>${l.name}</span>
              ${state.progress[code] ? `<small>${state.progress[code].done.length}/${TASKS.length} tasks</small>` : ""}
            </button>`).join("")}
        </div>
      </section>`);
    $$("[data-lang]").forEach((b) => b.addEventListener("click", () => {
      sfx.tap();
      state.lang = b.dataset.lang; prog(); save(); showHome();
    }));
  }

  // ---------- Home / learning path ----------
  function taskState(i) {
    const done = prog().done;
    if (done.includes(TASKS[i].id)) return "done";
    if (i === 0 || done.includes(TASKS[i - 1].id)) return "open";
    return "locked";
  }

  function showHome() {
    barFrom = 0;
    const p = prog();
    const due = dueCards().length;
    const total = Object.keys(p.cards).length;
    const next = TASKS.findIndex((_, i) => taskState(i) === "open");
    const greeting = next === -1
      ? "You finished all three units! Come back every day for your reviews. 🌙"
      : p.done.length === 0
        ? `Let's start learning ${L().name}! Tap the first task.`
        : `Next up: <b>${TASKS[next].title}</b>.`;

    // Nudge to protect the streak, more urgently once the reminder time passes.
    const n = currentStreak();
    const nudge = practisedToday() || !p.done.length ? "" : `
      <button class="nudge card ${reminderPassed() ? "urgent" : ""}" data-act="streak">
        <span class="flame">🔥</span>
        <span>${reminderPassed()
          ? `It's past your ${formatTime(reminder().time)} practice time. ${n ? `Do one task to keep your <b>${n}-day streak</b>!` : "A few minutes will start a new streak!"}`
          : n ? `Practise today to keep your <b>${n}-day streak</b> going.` : "Practise today to start a new streak."}</span>
      </button>`;

    screen(`
      ${coach(greeting)}
      ${nudge}
      ${total ? `
      <div class="daily card ${due ? "due" : ""}">
        <div>
          <h3>Daily review ${due ? `<span class="badge">${due}</span>` : ""}</h3>
          <p>${due ? `<b>${due}</b> word${due === 1 ? "" : "s"} ready to review` : "All caught up. Kiko will remind you when words are due."}</p>
          <p class="muted">${total} words in your deck${p.plan ? ` · ${esc(p.plan)}` : ""}</p>
        </div>
        <button class="btn ${due ? "" : "ghost"}" data-act="review" ${due ? "" : "disabled"}>Review</button>
      </div>` : ""}
      <ol class="path">
        ${TASKS.map((t, i) => {
          const s = taskState(i), u = t.unit || 1;
          const head = i === 0 || (TASKS[i - 1].unit || 1) !== u
            ? `<li class="unit-head" style="--i:${i}"><span>${UNITS[u].icon}</span><div><small>Unit ${u}</small><b>${UNITS[u].title}</b></div></li>`
            : "";
          return `${head}<li class="node ${s} ${i === next ? "current" : ""}" style="--x:${[0, 1, 2, 1][i % 4]};--i:${i}">
            <button data-task="${i}" ${s === "locked" ? "disabled" : ""} aria-label="${esc(t.title)}">
              <span class="node-icon">${s === "done" ? "✓" : s === "locked" ? "🔒" : t.icon}</span>
            </button>
            ${i === next ? kiko("idle", "node-kiko") : ""}
            <div class="node-label"><b>${i + 1}. ${esc(t.title)}</b><small>${esc(t.technique)}</small></div>
          </li>`;
        }).join("")}
      </ol>
      ${p.done.length === TASKS.length ? `<div class="center"><button class="btn ghost" data-act="practice">Mixed practice</button></div>` : ""}
    `);
    $$("[data-task]").forEach((b) => b.addEventListener("click", () => { sfx.tap(); showIntro(+b.dataset.task); }));
    $("[data-act=review]")?.addEventListener("click", () => runReview(null, true));
    $("[data-act=practice]")?.addEventListener("click", () => runQuiz({ batches: [0, 1, 2, 3, 4, 5, 6, 7], mixed: true }, null));
    // Keep the current task in view on long paths.
    $(".node.current")?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }

  // ---------- Task intro (the science card) ----------
  function showIntro(i) {
    const t = TASKS[i];
    screen(`
      <section class="intro">
        <button class="back" data-act="home">← Path</button>
        <div class="intro-icon">${t.icon}</div>
        <p class="eyebrow">Task ${i + 1} of ${TASKS.length}</p>
        <h1>${esc(t.title)}</h1>
        <div class="science card">
          <span class="chip">🔬 ${esc(t.technique)}</span>
          <p>${t.science}</p>
          <p class="cite">${esc(t.cite)}</p>
        </div>
        ${coach(`<b>Kiko's tip:</b> ${esc(t.tip)}`)}
        <button class="btn big" data-act="start">Start task</button>
      </section>`);
    $("[data-act=home]").addEventListener("click", showHome);
    $("[data-act=start]").addEventListener("click", () => { barFrom = 0; startTask(i); });
  }

  function startTask(i) {
    const t = TASKS[i];
    const runners = { plan: runPlan, learn: runLearn, quiz: runQuiz, review: runReview, shadow: runShadow, speak: runSpeak, story: runStory, build: runBuild, finish: runFinish };
    runners[t.type](t, i);
  }

  // Shared celebration screen. `i` is a task index, or null for free practice.
  function celebrate(title, xp, extra, i = null) {
    const t = i === null ? null : TASKS[i];
    gain(xp, true);
    const news = streakNews;
    streakNews = null;
    const streakCard = news ? `
        <button class="streak-card card" data-act="streak">
          <span class="flame lit">🔥</span>
          <span><b>${news.milestone ? `${news.count}-day milestone! 🎉` : news.count === 1 ? "Streak started!" : `${news.count}-day streak!`}</b>
          <small>${news.usedFreezes ? `A streak freeze saved your streak ❄️` : news.earnedFreeze ? "You earned a streak freeze ❄️" : "Come back tomorrow to keep it going."}</small></span>
        </button>
        ${weekRow()}` : "";
    screen(`
      <section class="done-screen">
        <div class="hero-wrap">${kiko("celebrate", "hero-sprite")}</div>
        <h1>${title}</h1>
        <div class="stats">
          <div class="stat"><b class="count" data-n="${xp}">0</b><small>XP earned</small></div>
          <div class="stat"><b>🔥 ${currentStreak()}</b><small>day streak</small></div>
        </div>
        ${streakCard}
        ${extra}
        ${t ? `<div class="science card small"><span class="chip">🔬 You just used</span><p><b>${esc(t.technique)}</b></p></div>` : ""}
        <button class="btn big" data-act="home">Continue</button>
      </section>`);
    countUp($(".count"), xp);
    sfx.win();
    setTimeout(() => confetti(news?.milestone ? 120 : 60), 150);
    $("[data-act=home]").addEventListener("click", showHome);
  }

  function completeTask(i, extra = "") {
    const p = prog();
    const first = !p.done.includes(TASKS[i].id);
    if (first) p.done.push(TASKS[i].id);
    celebrate("Task complete!", first ? 20 : 5, extra, i);
  }

  // Progress header used inside activities
  function stepBar(n, total) {
    const pct = (n / total) * 100;
    const html = `
    <div class="step">
      <button class="back" data-act="quit" aria-label="Quit">✕</button>
      <div class="hud-bar wide"><span data-to="${pct}" style="width:${barFrom}%"></span></div>
    </div>`;
    barFrom = pct;
    return html;
  }
  const bindQuit = () => $("[data-act=quit]")?.addEventListener("click", showHome);

  // Flashcard that flips in 3D. Front shows the word, back shows its meaning.
  const flipCard = (word, meaning, hint = "") => `
    <div class="flip" id="flash" tabindex="0" role="button" aria-label="Flip card">
      <div class="flip-inner">
        <div class="face front card">
          <div class="target">${esc(word)}</div>
          <button class="icon-btn" data-act="say" aria-label="Listen">🔊</button>
          ${hint ? `<p class="muted hint">${hint}</p>` : ""}
        </div>
        <div class="face back card">
          <div class="target sm">${esc(word)}</div>
          <div class="meaning">${esc(meaning)}</div>
          <button class="icon-btn" data-act="say" aria-label="Listen">🔊</button>
        </div>
      </div>
    </div>`;

  // ---------- Task: plan ----------
  function runPlan(t, i) {
    const cues = ["I finish breakfast", "I sit on the bus or train", "I make my morning coffee", "I finish lunch", "I get into bed", "I brush my teeth at night"];
    screen(`
      ${stepBar(0, 1)}
      <section class="activity">
        <h2>Make your if-then plan</h2>
        <label class="field">When…
          <select id="cue">${cues.map((c) => `<option>${c}</option>`).join("")}<option value="__">Something else…</option></select>
        </label>
        <input id="cueOther" class="input hidden" placeholder="e.g. I walk the dog">
        <label class="field">…I will practise ${L().name} with Kiko for
          <div class="seg" id="mins">${[5, 10, 15, 20].map((m) => `<button data-m="${m}" class="${m === 10 ? "on" : ""}">${m} min</button>`).join("")}</div>
        </label>
        <label class="field inline">Remind me at <input type="time" id="planTime" class="input" value="${reminder().time}"></label>
        <div class="plan-preview card" id="preview"></div>
        <button class="btn big" data-act="save">Commit to my plan</button>
      </section>
      ${coach("Short and daily beats long and rare. 10 minutes is a great start!")}`);
    bindQuit();
    let mins = 10;
    const cueEl = $("#cue"), other = $("#cueOther");
    const text = () => `When ${cueEl.value === "__" ? other.value.trim() || "…" : cueEl.value}, I will practise for ${mins} minutes.`;
    const upd = () => {
      const pv = $("#preview");
      pv.innerHTML = `<p class="muted">My plan</p><p class="plan-text">${esc(text())}</p>`;
      pv.classList.remove("pop"); void pv.offsetWidth; pv.classList.add("pop");
    };
    cueEl.addEventListener("change", () => { other.classList.toggle("hidden", cueEl.value !== "__"); upd(); });
    other.addEventListener("input", upd);
    $$("#mins button").forEach((b) => b.addEventListener("click", () => {
      sfx.tap();
      mins = +b.dataset.m; $$("#mins button").forEach((x) => x.classList.toggle("on", x === b)); upd();
    }));
    upd();
    $("[data-act=save]").addEventListener("click", () => {
      prog().plan = text();
      reminder().time = $("#planTime").value || "19:00";
      save();
      completeTask(i, `
        <div class="card plan-preview"><p class="plan-text">${esc(text())}</p></div>
        <button class="btn ghost big" data-act="calendar">📅 Add a ${formatTime(reminder().time)} reminder to my calendar</button>`);
    });
  }

  // ---------- Task: learn new words ----------
  function runLearn(t, i) {
    const words = L().words.slice(t.batch * 10, t.batch * 10 + 10);
    let n = 0;
    const show = () => {
      const [w, m] = words[n];
      screen(`
        ${stepBar(n, words.length)}
        <section class="activity">
          <p class="eyebrow">New word ${n + 1} of ${words.length}</p>
          ${flipCard(w, m, "Guess the meaning, then tap to flip")}
          ${Recognition ? `<button class="btn ghost big hidden" data-act="mic">🎤 Check my pronunciation</button><div id="micfb"></div>` : ""}
          <button class="btn big" data-act="next" disabled>Next</button>
          <p class="kbd-hint">Space to flip · Enter for next</p>
        </section>
        ${coach("Listen, then <b>say it out loud</b> before flipping the card.")}`);
      bindQuit();
      speak(w);
      $$("[data-act=say]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); speak(w); }));
      $("#flash").addEventListener("click", () => {
        const f = $("#flash");
        if (f.classList.contains("flipped")) return;
        f.classList.add("flipped");
        sfx.flip();
        $("[data-act=next]").disabled = false;
        $("[data-act=mic]")?.classList.remove("hidden");
      });
      $("[data-act=mic]")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget, fb = $("#micfb");
        btn.disabled = true;
        btn.classList.add("listening");
        btn.textContent = "👂 Listening…";
        try {
          const alts = await listen();
          const ok = heard(alts, w);
          fb.innerHTML = `<div class="fb inline ${ok ? "ok" : "no"}"><b>${ok ? "Sounds right!" : "Not quite yet"}</b><p>Kiko heard: “${esc(alts[0])}”</p></div>`;
          ok ? (sfx.right(), gain(1)) : (sfx.wrong(), speak(w, 0.8));
          kikoSays(ok ? one(CHEERS) : "Listen once more, then try again.", ok ? "correct" : "wrong");
        } catch (err) {
          fb.innerHTML = `<div class="fb inline no"><p>${micError(err)}</p></div>`;
        }
        if (btn.isConnected) { btn.disabled = false; btn.classList.remove("listening"); btn.textContent = "🎤 Try again"; }
      });
      $("[data-act=next]").addEventListener("click", () => {
        if (++n < words.length) show();
        else { addCards(words); completeTask(i, `<p>🎒 ${words.length} words packed into your review deck.</p>`); }
      });
    };
    show();
  }

  // ---------- Task: speak the words from memory ----------
  function runSpeak(t, i) {
    const items = pick(wordsInBatches(t.batches), 8);
    const total = items.length;
    const queue = items.slice();
    const retried = new Set();
    let n = 0, firstTry = 0, selfCheck = !Recognition;

    const show = () => {
      const [w, m] = queue[n];
      let attempts = 0, hinted = false;
      screen(`
        ${stepBar(n, queue.length)}
        <section class="activity">
          <p class="eyebrow">Say it in ${L().name}${retried.has(queue[n]) ? " · one more try" : ""}</p>
          <div class="prompt card">
            <div class="target">${esc(m)}</div>
            <p class="answer hidden" id="answer">${esc(w)}</p>
          </div>
          ${selfCheck
            ? `<p class="mic-hint">Say the word out loud, then check yourself.</p>
               <button class="btn big" data-act="reveal">Show me the answer</button>`
            : `<div class="mic-wrap"><button class="mic-btn" data-act="mic" aria-label="Tap and say the word">🎤</button></div>
               <p class="mic-hint" id="micHint">Tap the mic and say the word</p>`}
          <div id="micfb"></div>
          <div class="row center">
            <button class="btn ghost" data-act="hint">🔊 Hear it</button>
            ${selfCheck ? "" : `<button class="btn ghost" data-act="nomic">Can't speak now</button>`}
          </div>
        </section>
        ${coach("Say the word <b>from memory</b>. Only tap 🔊 if you're stuck.", "thinking")}`);
      bindQuit();

      const reveal = () => { $("#answer").classList.remove("hidden"); speak(w, 0.85); };
      $("[data-act=hint]").addEventListener("click", () => { hinted = true; reveal(); kikoSays("Now you say it! 🎤"); });
      $("[data-act=nomic]")?.addEventListener("click", () => { selfCheck = true; show(); });

      const finish = (ok, said = "") => {
        if (ok && !hinted && attempts <= 1 && !retried.has(queue[n])) firstTry++;
        if (ok) { gain(3); sfx.right(); confetti(18, centerOf($(".prompt"))); }
        else { sfx.wrong(); if (!retried.has(queue[n])) { retried.add(queue[n]); queue.push(queue[n]); } }
        reveal();
        $$("[data-act]:not([data-act=quit])", app).forEach((b) => (b.disabled = true));
        showSheet(sheet(ok, ok ? one(["Perfect!", "You said it!", "Great pronunciation!"]) : "Here's the word",
          `${esc(m)} = ${esc(w)}${said ? ` · Kiko heard “${esc(said)}”` : ""}`));
        kikoSays(ok ? one(CHEERS) : one(NUDGES), ok ? "correct" : "wrong");
        $("[data-act=next]").focus();
        $("[data-act=next]").addEventListener("click", () => {
          if (++n < queue.length) show();
          else completeTask(i, `<p class="lead">${firstTry}/${total} words said right on the first try</p><p class="muted">Saying words out loud makes them easier to remember.</p>`);
        });
      };

      $("[data-act=reveal]")?.addEventListener("click", (e) => {
        reveal();
        e.currentTarget.replaceWith(Object.assign(document.createElement("div"), {
          className: "row center",
          innerHTML: `<button class="btn" data-act="gotit">✓ I said it right</button><button class="btn ghost" data-act="missed">✕ I missed it</button>`,
        }));
        $("[data-act=gotit]").addEventListener("click", () => finish(true));
        $("[data-act=missed]").addEventListener("click", () => finish(false));
      });

      $("[data-act=mic]")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget, hint = $("#micHint"), fb = $("#micfb");
        btn.disabled = true;
        btn.classList.add("listening");
        hint.textContent = "Listening…";
        fb.innerHTML = "";
        try {
          const alts = await listen();
          attempts++;
          if (heard(alts, w)) return finish(true, alts[0]);
          if (attempts >= 2) return finish(false, alts[0]);
          fb.innerHTML = `<div class="fb inline no"><b>Not quite</b><p>Kiko heard “${esc(alts[0])}”. Try once more!</p></div>`;
          sfx.wrong();
          kikoSays("So close! Try once more, or tap 🔊 to hear it.", "wrong");
        } catch (err) {
          fb.innerHTML = `<div class="fb inline no"><p>${micError(err)}</p></div>`;
          if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") { selfCheck = true; setTimeout(show, 2500); }
        }
        if (btn.isConnected) { btn.disabled = false; btn.classList.remove("listening"); hint.textContent = "Tap the mic and say the word"; }
      });
    };
    show();
  }

  // ---------- Task: quiz (retrieval / interleaving) ----------
  function makeQuestions(t) {
    const pool = wordsInBatches(t.batches);
    const all = L().words;
    const qs = [];
    const items = pick(pool, t.mixed ? 10 : 8);
    items.forEach(([w, m], k) => {
      const kinds = t.mixed ? ["toEn", "toTarget", "listen", "type", "phrase"] : ["toEn", "toTarget", "type"];
      const kind = kinds[k % kinds.length];
      const distract = (key) => pick(all.filter(([x]) => x !== w), 3).map((d) => d[key]);
      if (kind === "toEn") qs.push({ kind, prompt: w, say: w, answer: m, options: shuffle([m, ...distract(1)]) });
      else if (kind === "toTarget") qs.push({ kind, prompt: m, answer: w, options: shuffle([w, ...distract(0)]) });
      else if (kind === "listen") qs.push({ kind, say: w, answer: w, options: shuffle([w, ...distract(0)]) });
      else if (kind === "type") qs.push({ kind, prompt: m, answer: w });
      else {
        const [ph, pm] = one(L().phrases);
        qs.push({ kind, prompt: ph, say: ph, answer: pm, options: shuffle([pm, ...pick(L().phrases.filter((x) => x[0] !== ph), 3).map((x) => x[1])]) });
      }
    });
    return t.mixed ? shuffle(qs) : qs;
  }

  function runQuiz(t, i) {
    const qs = makeQuestions(t);
    const total = qs.length;
    let n = 0, correct = 0, firstTry = 0, combo = 0;
    const retried = new Set();

    const show = () => {
      const q = qs[n];
      const label = { toEn: "What does this mean?", toTarget: `How do you say this in ${L().name}?`, listen: "What did you hear?", type: `Type it in ${L().name}`, phrase: "What does this phrase mean?" }[q.kind];
      screen(`
        ${stepBar(Math.min(correct, total), total)}
        <section class="activity">
          <p class="eyebrow">${label}</p>
          <div class="prompt card">
            ${q.kind === "listen" ? `<button class="icon-btn huge pulse" data-act="say" aria-label="Play again">🔊</button>` : `<div class="target">${esc(q.prompt)}</div>`}
            ${q.say && q.kind !== "listen" ? `<button class="icon-btn" data-act="say" aria-label="Listen">🔊</button>` : ""}
          </div>
          ${q.options
            ? `<div class="options">${q.options.map((o, k) => `<button class="opt" data-o="${esc(o)}" style="--i:${k}"><kbd>${k + 1}</kbd>${esc(o)}</button>`).join("")}</div>`
            : `<form id="typed"><input class="input big" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer"><button class="btn big">Check</button></form>`}
          <div id="fb"></div>
        </section>
        ${coach(retried.has(q) ? "This one again. Try to recall it!" : "Try to answer <b>before</b> you look at the options.", "thinking")}`);
      bindQuit();
      if (q.say) { speak(q.say); $$("[data-act=say]").forEach((b) => b.addEventListener("click", () => speak(q.say))); }
      if (q.options) $$(".opt").forEach((b) => b.addEventListener("click", () => grade(b.dataset.o === q.answer, b)));
      else {
        $("#ans").focus();
        $("#typed").addEventListener("submit", (e) => {
          e.preventDefault();
          const v = $("#ans").value.trim();
          if (!v) return;
          const exact = clean(v) === clean(q.answer);
          const close = fold(clean(v)) === fold(clean(q.answer));
          grade(exact || close, $("#ans"), close && !exact ? "Watch the accents!" : "");
        });
      }
    };

    const grade = (ok, el, note = "") => {
      const q = qs[n];
      $$(".opt").forEach((b) => { b.disabled = true; if (b.dataset.o === q.answer) b.classList.add("right"); });
      if (el && !ok) el.classList.add("wrong");
      const inp = $("#ans"); if (inp) { inp.disabled = true; inp.classList.add(ok ? "right" : "wrong"); }
      $("#typed button")?.remove();
      if (ok) {
        correct++; combo++;
        if (!retried.has(q)) firstTry++;
        gain(2);
        sfx.right();
        confetti(18, centerOf(el || $(".opt.right")));
      } else {
        combo = 0;
        sfx.wrong();
        if (!retried.has(q)) { retried.add(q); qs.push(q); }
      }
      const reveal = q.kind === "toEn" || q.kind === "phrase" ? `${q.prompt} = ${q.answer}` : `${q.answer}${q.kind === "listen" ? ` = ${meaningOf(q.answer)}` : q.prompt ? ` = ${q.prompt}` : ""}`;
      const title = ok ? (combo >= 3 ? `${combo} in a row!` : one(["Correct!", "Nice!", "Great!"])) : "Not quite";
      showSheet(sheet(ok, title, `${note ? `${note} ` : ""}${esc(reveal)}`));
      kikoSays(ok ? one(CHEERS) : one(NUDGES), ok ? "correct" : "wrong");
      if (!ok || q.kind === "type" || q.kind === "toTarget") speak(q.kind === "toEn" || q.kind === "phrase" ? q.prompt : q.answer);
      $("[data-act=next]").focus();
      $("[data-act=next]").addEventListener("click", () => {
        if (++n < qs.length) show();
        else {
          const summary = `<p class="lead">${firstTry}/${total} right on the first try</p><p class="muted">Missed ones came back at the end. That second retrieval is where the learning happens.</p>`;
          if (i === null) celebrate("Practice done!", 5, summary);
          else completeTask(i, summary);
        }
      });
    };
    show();
  }

  // ---------- Task / daily: spaced repetition review ----------
  function runReview(t, i) {
    const daily = i === true;
    if (daily) barFrom = 0;
    let queue = dueCards();
    if (!daily && queue.length < 10) queue = Object.keys(prog().cards); // first time: review everything learned
    queue = shuffle(queue).slice(0, 20); // keep sessions short as the deck grows
    if (!queue.length) { showHome(); return; }
    const total = queue.length;
    let doneCount = 0;

    const show = () => {
      const w = queue[0];
      const card = prog().cards[w];
      screen(`
        ${stepBar(doneCount, total)}
        <section class="activity">
          <p class="eyebrow">${queue.length} card${queue.length === 1 ? "" : "s"} left</p>
          ${flipCard(w, meaningOf(w))}
          <button class="btn big" data-act="show">Show answer</button>
          <div class="grades hidden">
            ${["Again", "Hard", "Good", "Easy"].map((g, k) => `<button class="grade g${k}" data-g="${k}" style="--i:${k}"><b>${g}</b><small>${previewInterval(card, k)}</small></button>`).join("")}
          </div>
          <p class="kbd-hint">Space to flip · 1–4 to rate</p>
        </section>
        ${coach("Recall the meaning in your head first, <b>then</b> check.")}`);
      bindQuit();
      speak(w);
      $$("[data-act=say]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); speak(w); }));
      const reveal = () => {
        if ($("#flash").classList.contains("flipped")) return;
        $("#flash").classList.add("flipped");
        sfx.flip();
        $("[data-act=show]").classList.add("hidden");
        $(".grades").classList.remove("hidden");
        kikoSays("How well did you remember it? Your answer sets the next review date.");
      };
      $("#flash").addEventListener("click", reveal);
      $("[data-act=show]").addEventListener("click", reveal);
      $$("[data-g]").forEach((b) => b.addEventListener("click", async () => {
        const g = +b.dataset.g;
        $$("[data-g]").forEach((x) => (x.disabled = true));
        schedule(card, g);
        queue.shift();
        if (g === 0) queue.splice(Math.min(3, queue.length), 0, w); // see it again soon
        else doneCount++;
        save();
        g === 0 ? sfx.wrong() : sfx.right();
        $("#flash").classList.add(g === 0 ? "fly-left" : "fly-right");
        await later(320);
        if (queue.length) show();
        else finish();
      }));
    };

    const finish = () => {
      const next = Object.values(prog().cards).map((c) => c.due).filter((d) => d > Date.now()).sort((a, b) => a - b)[0];
      const when = next ? `Your next review is in about <b>${Math.max(1, Math.round((next - Date.now()) / DAY))} day(s)</b>.` : "";
      const msg = `<p class="lead">${total} cards reviewed</p><p class="muted">${when} Every successful review makes the gap longer.</p>`;
      if (daily) celebrate("Review done!", 10, msg);
      else completeTask(i, msg);
    };
    show();
  }

  // ---------- Task: shadowing ----------
  function runShadow(t, i) {
    const phrases = L().phrases.slice(...(t.phrases || [0, 8]));
    let n = 0;
    const show = () => {
      const [ph, m] = phrases[n];
      screen(`
        ${stepBar(n, phrases.length)}
        <section class="activity">
          <p class="eyebrow">Phrase ${n + 1} of ${phrases.length}: listen, then repeat right away</p>
          <div class="prompt card">
            <div class="target">${esc(ph)}</div>
            <p class="muted">${esc(m)}</p>
            <div class="row">
              <button class="btn ghost" data-act="say">🔊 Normal</button>
              <button class="btn ghost" data-act="slow">🐢 Slow</button>
            </div>
          </div>
          ${Recognition ? `<button class="btn big mic" data-act="mic">🎤 Tap and say it</button>` : ""}
          <div id="fb"></div>
          <button class="btn big ${Recognition ? "ghost" : ""}" data-act="next">${Recognition ? "Skip" : "I said it out loud ✓"}</button>
        </section>
        ${coach("Copy the <b>rhythm and melody</b>, like you're singing along.")}`);
      bindQuit();
      speak(ph);
      $("[data-act=say]").addEventListener("click", () => speak(ph));
      $("[data-act=slow]").addEventListener("click", () => speak(ph, 0.6));
      $("[data-act=next]").addEventListener("click", next);
      $("[data-act=mic]")?.addEventListener("click", () => listen(ph));
    };
    const listen = (target) => {
      const rec = new Recognition();
      rec.lang = L().tts;
      rec.interimResults = false;
      const mic = $("[data-act=mic]");
      mic.textContent = "👂 Listening…"; mic.disabled = true; mic.classList.add("listening");
      rec.onresult = (e) => {
        const said = e.results[0][0].transcript;
        const ok = similarity(said, target) >= 0.6;
        $("#fb").innerHTML = `<div class="fb inline ${ok ? "ok" : "no"}"><b>${ok ? "Sounds great!" : "Let's try once more"}</b><p>Kiko heard: “${esc(said)}”</p></div>`;
        kikoSays(ok ? one(CHEERS) : "Listen again on 🐢 slow, then copy it.", ok ? "correct" : "wrong");
        if (ok) {
          gain(2); sfx.right(); confetti(18, centerOf(mic));
          const nb = $("[data-act=next]"); nb.textContent = "Next"; nb.classList.remove("ghost");
        } else sfx.wrong();
      };
      rec.onerror = () => { $("#fb").innerHTML = `<div class="fb inline no"><p>Kiko couldn't hear you. Check microphone permission, or just say it out loud and tap Skip.</p></div>`; };
      rec.onend = () => { mic.textContent = "🎤 Tap and say it"; mic.disabled = false; mic.classList.remove("listening"); };
      rec.start();
    };
    const next = () => { if (++n < phrases.length) show(); else completeTask(i, `<p>🗣️ You shadowed ${phrases.length} everyday phrases.</p>`); };
    show();
  }

  // ---------- Task: graded reading ----------
  function runStory(t, i) {
    const s = L().stories[t.story || 0];
    const gloss = (word) => s.glossary[word.toLowerCase().replace(/^[«„“"¡¿—]+|[»“"!?.,:;—]+$/g, "")];
    screen(`
      ${stepBar(0, 2)}
      <section class="activity">
        <h2 class="story-title">${esc(s.title)}</h2>
        <div class="story card">
          ${s.sentences.map(([text, en], k) => `
            <p class="sent" style="--i:${k}">
              <button class="icon-btn sm" data-say="${k}" aria-label="Listen">🔊</button>
              <span>${text.split(" ").map((w) => gloss(w) ? `<span class="w" data-g="${esc(gloss(w))}">${esc(w)}</span>` : esc(w)).join(" ")}</span>
              <button class="tr" data-tr="${k}">EN</button>
              <span class="en hidden" id="en${k}">${esc(en)}</span>
            </p>`).join("")}
        </div>
        <div class="row center">
          <button class="btn ghost" data-act="all">🔊 Read it to me</button>
          <button class="btn" data-act="qs">I'm done reading</button>
        </div>
      </section>
      <div class="tooltip hidden" id="tip"></div>
      ${coach("Try to get the gist first. Only tap words you really need.")}`);
    bindQuit();
    const tip = $("#tip");
    $$(".w").forEach((w) => w.addEventListener("click", () => {
      const r = w.getBoundingClientRect();
      $$(".w.on").forEach((x) => x.classList.remove("on"));
      w.classList.add("on");
      tip.textContent = w.dataset.g;
      tip.style.left = `${r.left + r.width / 2 + window.scrollX}px`;
      tip.style.top = `${r.top + window.scrollY - 8}px`;
      tip.classList.remove("hidden", "pop"); void tip.offsetWidth; tip.classList.add("pop");
      sfx.tap();
    }));
    $$("[data-say]").forEach((b) => b.addEventListener("click", () => speak(s.sentences[+b.dataset.say][0], 0.85)));
    $$("[data-tr]").forEach((b) => b.addEventListener("click", () => { b.classList.toggle("on"); $(`#en${b.dataset.tr}`).classList.toggle("hidden"); }));
    $("[data-act=all]").addEventListener("click", () => speak(s.sentences.map((x) => x[0]).join(" "), 0.85));
    $("[data-act=qs]").addEventListener("click", () => questions());

    const questions = () => {
      let n = 0, right = 0;
      const show = () => {
        const [q, opts, a] = s.questions[n];
        const order = shuffle(opts.map((o, k) => [o, k]));
        screen(`
          ${stepBar(1 + n / s.questions.length, 2)}
          <section class="activity">
            <p class="eyebrow">Did you understand? (${n + 1}/${s.questions.length})</p>
            <div class="prompt card"><div class="target sm">${esc(q)}</div></div>
            <div class="options">${order.map(([o, k], j) => `<button class="opt" data-k="${k}" style="--i:${j}"><kbd>${j + 1}</kbd>${esc(o)}</button>`).join("")}</div>
            <div id="fb"></div>
          </section>
          ${coach("Understanding the message is what matters most.", "thinking")}`);
        bindQuit();
        $$(".opt").forEach((b) => b.addEventListener("click", () => {
          const ok = +b.dataset.k === a;
          $$(".opt").forEach((x) => { x.disabled = true; if (+x.dataset.k === a) x.classList.add("right"); });
          if (ok) { right++; gain(2); sfx.right(); confetti(18, centerOf(b)); }
          else { b.classList.add("wrong"); sfx.wrong(); }
          kikoSays(ok ? one(CHEERS) : one(NUDGES), ok ? "correct" : "wrong");
          showSheet(sheet(ok, ok ? "Correct!" : "Not quite", ok ? "" : `Answer: ${esc(opts[a])}`));
          $("[data-act=next]").focus();
          $("[data-act=next]").addEventListener("click", () => {
            if (++n < s.questions.length) show();
            else completeTask(i, `<p class="lead">${right}/${s.questions.length} comprehension questions right</p><p class="muted">You just read a whole story in ${L().name}! 📖</p>`);
          });
        }));
      };
      show();
    };
  }

  // ---------- Task: sentence building ----------
  function runBuild(t, i) {
    const items = L().builds.slice(...(t.builds || [0, 4]));
    let n = 0, right = 0;
    const show = () => {
      const [en, target] = items[n];
      const tokens = target.split(" ");
      // Lower-case the first tile so its capital letter doesn't give the order away.
      tokens[0] = tokens[0].charAt(0).toLowerCase() + tokens[0].slice(1);
      const extra = pick(L().words.map((w) => w[0]).filter((w) => !tokens.map(fold).includes(fold(w)) && !w.includes(" ")), 2);
      const tiles = shuffle([...tokens, ...extra]);
      const chosen = [];
      screen(`
        ${stepBar(n, items.length)}
        <section class="activity">
          <p class="eyebrow">Build this sentence in ${L().name}</p>
          <div class="prompt card"><div class="target sm">${esc(en)}</div></div>
          <div class="answer-line" id="line"></div>
          <div class="tiles" id="tiles">${tiles.map((w, k) => `<button class="tile" data-k="${k}" style="--i:${k}">${esc(w)}</button>`).join("")}</div>
          <button class="btn big" data-act="check" disabled>Check</button>
          <div id="fb"></div>
        </section>
        ${coach("Two of the tiles are decoys. Think about word order!", "thinking")}`);
      bindQuit();
      const line = $("#line"), check = $("[data-act=check]");
      const redraw = () => {
        line.innerHTML = chosen.map((k) => `<button class="tile" data-c="${k}">${esc(tiles[k])}</button>`).join("");
        $$(".tile[data-k]").forEach((b) => b.classList.toggle("used", chosen.includes(+b.dataset.k)));
        $$("[data-c]", line).forEach((b) => b.addEventListener("click", () => {
          const k = +b.dataset.c, from = b.getBoundingClientRect();
          chosen.splice(chosen.indexOf(k), 1);
          redraw();
          sfx.tap();
          flyFrom($(`.tile[data-k="${k}"]`), from);
        }));
        check.disabled = !chosen.length;
      };
      $$(".tile[data-k]").forEach((b) => b.addEventListener("click", () => {
        const k = +b.dataset.k;
        if (chosen.includes(k) || b.disabled) return;
        const from = b.getBoundingClientRect();
        chosen.push(k);
        redraw();
        sfx.tap();
        flyFrom(line.lastElementChild, from);
      }));
      check.addEventListener("click", () => {
        const built = chosen.map((k) => tiles[k]).join(" ");
        const ok = clean(built) === clean(target);
        $$(".tile").forEach((b) => (b.disabled = true));
        check.remove();
        if (ok) {
          right++; gain(3); sfx.right();
          line.classList.add("win");
          confetti(24, centerOf(line));
        } else {
          sfx.wrong();
          line.classList.add("shake");
        }
        showSheet(sheet(ok, ok ? "Perfect sentence!" : "Close! The answer is:", esc(target)));
        kikoSays(ok ? "Now read it out loud! 🗣️" : "Look at where each word goes. Word order is the tricky part.", ok ? "correct" : "wrong");
        speak(target);
        $("[data-act=next]").focus();
        $("[data-act=next]").addEventListener("click", () => {
          if (++n < items.length) show();
          else completeTask(i, `<p class="lead">${right}/${items.length} sentences built correctly</p>`);
        });
      });
    };
    show();
  }

  // ---------- Task: finish — habit & recap ----------
  function runFinish(t, i) {
    const p = prog();
    const loop = [
      ["📅", "Review due cards", "Spaced repetition: a few minutes a day"],
      ["➕", "Learn 5–10 new words", "Frequency first, small batches"],
      ["📖", "Read or listen to something easy", "Comprehensible input you mostly understand"],
      ["🗣️", "Say or write 3 sentences", "Output shows you what you're missing"],
      ["🌙", "Quick review before bed", "Sleep locks in what you learned"],
    ];
    screen(`
      ${stepBar(0, 1)}
      <section class="activity">
        <h2>Your daily Kiko loop</h2>
        <p class="muted">Every task you did is one part of a routine that works. Here it is in one place:</p>
        <ol class="loop">${loop.map(([ic, a, b], k) => `<li class="card" style="--i:${k}"><span class="loop-ic">${ic}</span><div><b>${a}</b><small>${b}</small></div></li>`).join("")}</ol>
        ${p.plan ? `<div class="card plan-preview"><p class="muted">Your plan</p><p class="plan-text">${esc(p.plan)}</p></div>` : ""}
        <label class="check"><input type="checkbox" id="commit"> I'll show up tomorrow, even if it's only for 2 minutes.</label>
        <button class="btn big" data-act="done" disabled>Finish Unit 1</button>
      </section>
      ${coach("Consistency beats intensity. See you tomorrow! 🐰")}`);
    bindQuit();
    $("#commit").addEventListener("change", (e) => { $("[data-act=done]").disabled = !e.target.checked; if (e.target.checked) sfx.tap(); });
    $("[data-act=done]").addEventListener("click", () => completeTask(i, `<p class="lead">🏅 You finished Unit 1 in ${L().name}!</p><p class="muted">Units 2 and 3 are open. Your ${Object.keys(p.cards).length} words will come back for review at just the right time.</p>`));
  }

  // ---------- Global listeners ----------
  // Hide the story tooltip when tapping anywhere except a word.
  document.addEventListener("click", (e) => {
    if (e.target.closest(".w")) return;
    document.getElementById("tip")?.classList.add("hidden");
    $$(".w.on").forEach((x) => x.classList.remove("on"));
  });

  // Keyboard shortcuts: 1–4 pick options or ratings, Space flips, Enter continues.
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target.matches("input, select, textarea");
    const onButton = e.target.matches("button");
    if (/^[1-9]$/.test(e.key) && !typing) {
      const choices = $$(".grades:not(.hidden) .grade:not([disabled])").length
        ? $$(".grades .grade:not([disabled])")
        : $$(".opt:not([disabled])");
      choices[+e.key - 1]?.click();
    } else if (e.key === " " && !typing && !onButton) {
      const f = $("#flash:not(.flipped)");
      if (f) { e.preventDefault(); f.click(); }
    } else if (e.key === "Enter" && !typing && !onButton) {
      const target = $("[data-act=next]:not([disabled])") || $("[data-act=check]:not([disabled])") || $("[data-act=show]:not(.hidden)") || $("[data-act=start]");
      if (target) { e.preventDefault(); target.click(); }
    }
  });

  // ---------- Boot ----------
  renderHud();
  state.lang ? showHome() : showWelcome();
})();
