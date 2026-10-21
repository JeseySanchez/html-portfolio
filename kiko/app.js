/* Kiko — a science-backed, task-by-task language learning app. */
(() => {
  "use strict";

  const STORE_KEY = "kiko-v1";
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

  const today = () => new Date().toISOString().slice(0, 10);
  function bumpStreak() {
    const t = today();
    if (state.streak.last === t) return false;
    const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    state.streak.count = state.streak.last === y ? state.streak.count + 1 : 1;
    state.streak.last = t;
    return true;
  }
  // Award XP, update the streak, and animate the HUD.
  function gain(n) {
    state.xp += n;
    const lit = bumpStreak();
    save();
    bump("[data-xp]", `+${n} XP`);
    if (lit) bump("[data-streak]", "🔥");
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

  // ---------- Kiko sprite animations ----------
  // Each mood is a horizontal strip of frames. Large strips exist for the
  // moods shown on hero screens, small ones for the coach and the path.
  const ANIMS = {
    idle: { n: 18, fps: 6, loop: true },
    welcome: { n: 21, fps: 9, then: "idle" },
    thinking: { n: 26, fps: 7, loop: true },
    correct: { n: 24, fps: 14, then: "idle" },
    wrong: { n: 24, fps: 10, then: "idle" },
    celebrate: { n: 22, fps: 10, loop: true },
  };
  const spriteSrc = (anim, big) => `assets/kiko-${anim}${big ? "" : "-sm"}.webp`;
  const kiko = (anim, cls = "", big = false) =>
    `<span class="kiko ${cls}" data-anim="${anim}" ${big ? "data-big" : ""} role="img" aria-label="Kiko"><img alt=""></span>`;
  const coach = (text, anim = "idle") => `<div class="coach">${kiko(anim)}<div class="bubble">${text}</div></div>`;

  // Step through a strip's frames; one-off moods hand back to `then` when done.
  function play(el, anim) {
    if (!el) return;
    const a = ANIMS[anim], img = $("img", el);
    el._anim?.cancel();
    img.src = spriteSrc(anim, el.hasAttribute("data-big"));
    img.style.width = `${a.n * 100}%`;
    el._anim = img.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(-${((a.n - 1) / a.n) * 100}%)` }],
      { duration: (a.n / a.fps) * 1000, iterations: a.loop ? Infinity : 1, easing: `steps(${a.n}, jump-none)`, fill: "forwards" }
    );
    if (a.then) el._anim.onfinish = () => el.isConnected && play(el, a.then);
  }
  // Warm the cache so switching moods never flashes an empty frame.
  window.addEventListener("load", () => {
    ["idle", "thinking", "correct", "wrong"].forEach((m) => (new Image().src = spriteSrc(m, false)));
    ["idle", "celebrate"].forEach((m) => (new Image().src = spriteSrc(m, true)));
  });

  // Feedback sheet that slides up from the bottom of the screen, with Kiko
  // reacting in it (the sheet covers the coach on small screens).
  function showSheet(html) {
    sheetRoot.innerHTML = html;
    $$(".kiko[data-anim]", sheetRoot).forEach((el) => play(el, el.dataset.anim));
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
      <span class="hud-chip" data-streak title="Day streak">🔥 ${state.streak.count}</span>
      <span class="hud-chip" data-xp title="Experience points">⭐ ${state.xp}</span>
      <button class="hud-chip icon" data-act="mute" title="${state.muted ? "Turn sounds on" : "Turn sounds off"}" aria-label="${state.muted ? "Unmute" : "Mute"}">${state.muted ? "🔇" : "🔈"}</button>
      <div class="hud-bar" title="${done} of ${TASKS.length} tasks"><span style="width:${(done / TASKS.length) * 100}%"></span></div>`;
  }
  hud.addEventListener("click", (e) => {
    if (e.target.closest("[data-act=lang]")) showWelcome();
    if (e.target.closest("[data-act=mute]")) { state.muted = !state.muted; save(); sfx.tap(); }
  });
  document.getElementById("logo").addEventListener("click", () => state.lang ? showHome() : showWelcome());

  // Progress bars animate from where the previous screen left them.
  let barFrom = 0;
  function screen(html) {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    app.innerHTML = html;
    sheetRoot.innerHTML = "";
    $$(".kiko[data-anim]", app).forEach((el) => play(el, el.dataset.anim));
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
        <div class="hero-wrap">${kiko("welcome", "hero-sprite float", true)}</div>
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
      ? "You finished the whole path! Come back every day for your reviews. 🌙"
      : p.done.length === 0
        ? `Let's start learning ${L().name}! Tap the first task.`
        : `Next up: <b>${TASKS[next].title}</b>.`;

    screen(`
      ${coach(greeting)}
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
          const s = taskState(i);
          return `<li class="node ${s} ${i === next ? "current" : ""}" style="--x:${[0, 1, 2, 1][i % 4]};--i:${i}">
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
    $("[data-act=practice]")?.addEventListener("click", () => runQuiz({ batches: [0, 1, 2], mixed: true }, null));
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
    const runners = { plan: runPlan, learn: runLearn, quiz: runQuiz, review: runReview, shadow: runShadow, story: runStory, build: runBuild, finish: runFinish };
    runners[t.type](t, i);
  }

  // Shared celebration screen. `i` is a task index, or null for free practice.
  function celebrate(title, xp, extra, i = null) {
    const t = i === null ? null : TASKS[i];
    gain(xp);
    screen(`
      <section class="done-screen">
        <div class="hero-wrap">${kiko("celebrate", "hero-sprite", true)}</div>
        <h1>${title}</h1>
        <div class="stats">
          <div class="stat"><b class="count" data-n="${xp}">0</b><small>XP earned</small></div>
          <div class="stat"><b>🔥 ${state.streak.count}</b><small>day streak</small></div>
        </div>
        ${extra}
        ${t ? `<div class="science card small"><span class="chip">🔬 You just used</span><p><b>${esc(t.technique)}</b></p></div>` : ""}
        <button class="btn big" data-act="home">Continue</button>
      </section>`);
    countUp($(".count"), xp);
    sfx.win();
    setTimeout(() => confetti(60), 150);
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
      prog().plan = text(); save();
      completeTask(i, `<div class="card plan-preview"><p class="plan-text">${esc(text())}</p></div>`);
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
      });
      $("[data-act=next]").addEventListener("click", () => {
        if (++n < words.length) show();
        else { addCards(words); completeTask(i, `<p>🎒 ${words.length} words packed into your review deck.</p>`); }
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
    queue = shuffle(queue);
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
    const phrases = L().phrases;
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
    const s = L().story;
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
    const items = L().builds;
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
        <button class="btn big" data-act="done" disabled>Finish the path</button>
      </section>
      ${coach("Consistency beats intensity. See you tomorrow! 🐰")}`);
    bindQuit();
    $("#commit").addEventListener("change", (e) => { $("[data-act=done]").disabled = !e.target.checked; if (e.target.checked) sfx.tap(); });
    $("[data-act=done]").addEventListener("click", () => completeTask(i, `<p class="lead">🏅 You finished Kiko's science path in ${L().name}!</p><p class="muted">Your ${Object.keys(p.cards).length} words will come back for review at just the right time.</p>`));
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
