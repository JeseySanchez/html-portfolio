/* Kiko — a science-backed, task-by-task language learning app. */
(() => {
  "use strict";

  const STORE_KEY = "kiko-v1";
  const DAY = 24 * 60 * 60 * 1000;
  const app = document.getElementById("app");
  const hud = document.getElementById("hud");

  // ---------- State ----------
  const blank = () => ({ lang: null, xp: 0, streak: { count: 0, last: null }, progress: {} });
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
    if (state.streak.last === t) return;
    const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    state.streak.count = state.streak.last === y ? state.streak.count + 1 : 1;
    state.streak.last = t;
  }
  function addXp(n) { state.xp += n; bumpStreak(); save(); }

  // ---------- Helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n) => shuffle(a).slice(0, n);
  const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const clean = (s) => s.toLowerCase().replace(/[¿?¡!.,;:«»„“"—–]/g, " ").replace(/\s+/g, " ").trim();
  const $ = (sel, root = app) => root.querySelector(sel);
  const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];

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

  const CHEERS = ["Nice one!", "You got it!", "Brilliant!", "Hop hop, correct!", "Your brain just got stronger!", "Yes!"];
  const NUDGES = ["Almost! Mistakes help you remember.", "Good try. You'll see this one again.", "Getting it wrong first makes it stick better!"];

  function kikoSays(text, mood = "") {
    const k = $(".coach");
    if (!k) return;
    $(".bubble", k).innerHTML = text;
    const img = $("img", k);
    img.classList.remove("hop", "wobble");
    void img.offsetWidth;
    if (mood) img.classList.add(mood);
  }
  const coach = (text) => `<div class="coach"><img src="assets/kiko-192.png" alt="Kiko"><div class="bubble">${text}</div></div>`;

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
      <span class="hud-chip" title="Day streak">🔥 ${state.streak.count}</span>
      <span class="hud-chip" title="Experience points">⭐ ${state.xp}</span>
      <div class="hud-bar" title="${done} of ${TASKS.length} tasks"><span style="width:${(done / TASKS.length) * 100}%"></span></div>`;
  }
  hud.addEventListener("click", (e) => { if (e.target.closest("[data-act=lang]")) showWelcome(); });
  document.getElementById("logo").addEventListener("click", () => state.lang ? showHome() : showWelcome());

  function screen(html) {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // ---------- Welcome ----------
  function showWelcome() {
    screen(`
      <section class="welcome">
        <img class="hero-kiko" src="assets/kiko.png" alt="Kiko the bunny with a green backpack">
        <h1>Hi, I'm <span class="brand">Kiko</span>!</h1>
        <p class="lead">I'll teach you a new language using <b>methods backed by learning science</b>, one small task at a time.</p>
        <h2>What do you want to learn?</h2>
        <div class="lang-grid">
          ${Object.entries(LANGUAGES).map(([code, l]) => `
            <button class="lang-btn ${state.lang === code ? "selected" : ""}" data-lang="${code}">
              <span class="flag">${l.flag}</span><span>${l.name}</span>
              ${state.progress[code] ? `<small>${state.progress[code].done.length}/${TASKS.length} tasks</small>` : ""}
            </button>`).join("")}
        </div>
      </section>`);
    $$("[data-lang]").forEach((b) => b.addEventListener("click", () => {
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
      <div class="daily card">
        <div>
          <h3>Daily review</h3>
          <p>${due ? `<b>${due}</b> word${due === 1 ? "" : "s"} ready to review` : "All caught up. Kiko will remind you when words are due."}</p>
          <p class="muted">${total} words in your deck${p.plan ? ` · ${esc(p.plan)}` : ""}</p>
        </div>
        <button class="btn ${due ? "" : "ghost"}" data-act="review" ${due ? "" : "disabled"}>Review</button>
      </div>` : ""}
      <ol class="path">
        ${TASKS.map((t, i) => {
          const s = taskState(i);
          return `<li class="node ${s} ${i === next ? "current" : ""}" style="--x:${[0, 1, 2, 1][i % 4]}">
            <button data-task="${i}" ${s === "locked" ? "disabled" : ""} aria-label="${esc(t.title)}">
              <span class="node-icon">${s === "done" ? "✓" : s === "locked" ? "🔒" : t.icon}</span>
            </button>
            <div class="node-label"><b>${i + 1}. ${esc(t.title)}</b><small>${esc(t.technique)}</small></div>
          </li>`;
        }).join("")}
      </ol>
      ${p.done.length === TASKS.length ? `<div class="center"><button class="btn ghost" data-act="practice">Mixed practice</button></div>` : ""}
    `);
    $$("[data-task]").forEach((b) => b.addEventListener("click", () => showIntro(+b.dataset.task)));
    $("[data-act=review]")?.addEventListener("click", () => runReview(null, true));
    $("[data-act=practice]")?.addEventListener("click", () => runQuiz({ batches: [0, 1, 2], mixed: true }, null));
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
    $("[data-act=start]").addEventListener("click", () => startTask(i));
  }

  function startTask(i) {
    const t = TASKS[i];
    const runners = { plan: runPlan, learn: runLearn, quiz: runQuiz, review: runReview, shadow: runShadow, story: runStory, build: runBuild, finish: runFinish };
    runners[t.type](t, i);
  }

  function completeTask(i, extra = "") {
    const t = TASKS[i];
    const p = prog();
    const first = !p.done.includes(t.id);
    if (first) p.done.push(t.id);
    addXp(first ? 20 : 5);
    screen(`
      <section class="done-screen">
        <img class="hero-kiko hop" src="assets/kiko.png" alt="Kiko celebrating">
        <h1>Task complete!</h1>
        <p class="lead">+${first ? 20 : 5} XP · 🔥 ${state.streak.count}-day streak</p>
        ${extra}
        <div class="science card small"><span class="chip">🔬 You just used</span><p><b>${esc(t.technique)}</b></p></div>
        <button class="btn big" data-act="home">Continue</button>
      </section>`);
    $("[data-act=home]").addEventListener("click", showHome);
  }

  // Progress header used inside activities
  const stepBar = (n, total) => `
    <div class="step">
      <button class="back" data-act="quit" aria-label="Quit">✕</button>
      <div class="hud-bar wide"><span style="width:${(n / total) * 100}%"></span></div>
    </div>`;
  const bindQuit = () => $("[data-act=quit]")?.addEventListener("click", showHome);

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
    const upd = () => { $("#preview").innerHTML = `<p class="muted">My plan</p><p class="plan-text">${esc(text())}</p>`; };
    cueEl.addEventListener("change", () => { other.classList.toggle("hidden", cueEl.value !== "__"); upd(); });
    other.addEventListener("input", upd);
    $$("#mins button").forEach((b) => b.addEventListener("click", () => {
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
          <div class="flash card" id="flash">
            <div class="target">${esc(w)}</div>
            <button class="icon-btn" data-act="say" aria-label="Listen">🔊</button>
            <div class="meaning hidden">${esc(m)}</div>
            <p class="muted hint">Guess the meaning, then tap to check</p>
          </div>
          <button class="btn big" data-act="next" disabled>Next</button>
        </section>
        ${coach("Listen, then <b>say it out loud</b> before revealing the meaning.")}`);
      bindQuit();
      speak(w);
      $("[data-act=say]").addEventListener("click", (e) => { e.stopPropagation(); speak(w); });
      $("#flash").addEventListener("click", () => {
        $(".meaning").classList.remove("hidden"); $(".hint").classList.add("hidden");
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
        const [ph, pm] = pick(L().phrases, 1)[0];
        qs.push({ kind, prompt: ph, say: ph, answer: pm, options: shuffle([pm, ...pick(L().phrases.filter((x) => x[0] !== ph), 3).map((x) => x[1])]) });
      }
    });
    return t.mixed ? shuffle(qs) : qs;
  }

  function runQuiz(t, i) {
    const qs = makeQuestions(t);
    const total = qs.length;
    let n = 0, correct = 0, firstTry = 0;
    const retried = new Set();

    const show = () => {
      const q = qs[n];
      const label = { toEn: "What does this mean?", toTarget: `How do you say this in ${L().name}?`, listen: "What did you hear?", type: `Type it in ${L().name}`, phrase: "What does this phrase mean?" }[q.kind];
      screen(`
        ${stepBar(Math.min(correct, total), total)}
        <section class="activity">
          <p class="eyebrow">${label}</p>
          <div class="prompt card">
            ${q.kind === "listen" ? `<button class="icon-btn huge" data-act="say" aria-label="Play again">🔊</button>` : `<div class="target">${esc(q.prompt)}</div>`}
            ${q.say && q.kind !== "listen" ? `<button class="icon-btn" data-act="say" aria-label="Listen">🔊</button>` : ""}
          </div>
          ${q.options
            ? `<div class="options">${q.options.map((o) => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>`
            : `<form id="typed"><input class="input big" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer"><button class="btn big">Check</button></form>`}
          <div class="feedback" id="fb"></div>
        </section>
        ${coach(retried.has(q) ? "This one again. Try to recall it!" : "Try to answer <b>before</b> you look at the options.")}`);
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
          grade(exact || close, null, close && !exact ? "Watch the accents!" : "");
        });
      }
    };

    const grade = (ok, btn, note = "") => {
      const q = qs[n];
      $$(".opt").forEach((b) => { b.disabled = true; if (b.dataset.o === q.answer) b.classList.add("right"); });
      if (btn && !ok) btn.classList.add("wrong");
      const inp = $("#ans"); if (inp) { inp.disabled = true; inp.classList.add(ok ? "right" : "wrong"); }
      $("#typed button")?.remove();
      if (ok) { correct++; if (!retried.has(q)) firstTry++; state.xp += 2; save(); }
      else if (!retried.has(q)) { retried.add(q); qs.push(q); }
      const reveal = q.kind === "toEn" || q.kind === "phrase" ? `${q.prompt} = ${q.answer}` : `${q.answer}${q.kind === "listen" ? ` = ${meaningOf(q.answer)}` : q.prompt ? ` = ${q.prompt}` : ""}`;
      $("#fb").innerHTML = `
        <div class="fb ${ok ? "ok" : "no"}">
          <b>${ok ? "Correct!" : "Not quite"}</b> ${note ? `<span>${note}</span>` : ""}
          <p>${esc(reveal)}</p>
          <button class="btn" data-act="next">Continue</button>
        </div>`;
      kikoSays(ok ? pick(CHEERS, 1)[0] : pick(NUDGES, 1)[0], ok ? "hop" : "wobble");
      if (!ok || q.kind === "type" || q.kind === "toTarget") speak(q.kind === "toEn" || q.kind === "phrase" ? q.prompt : q.answer);
      $("[data-act=next]").focus();
      $("[data-act=next]").addEventListener("click", () => {
        if (++n < qs.length) show();
        else {
          const summary = `<p class="lead">${firstTry}/${total} right on the first try</p><p class="muted">Missed ones came back at the end. That second retrieval is where the learning happens.</p>`;
          if (i === null) { addXp(5); screen(`<section class="done-screen"><img class="hero-kiko hop" src="assets/kiko.png" alt="Kiko"><h1>Practice done!</h1>${summary}<button class="btn big" data-act="home">Back to path</button></section>`); $("[data-act=home]").addEventListener("click", showHome); }
          else completeTask(i, summary);
        }
      });
    };
    show();
  }

  // ---------- Task / daily: spaced repetition review ----------
  function runReview(t, i) {
    const daily = i === true;
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
          <div class="flash card">
            <div class="target">${esc(w)}</div>
            <button class="icon-btn" data-act="say" aria-label="Listen">🔊</button>
            <div class="meaning hidden">${esc(meaningOf(w))}</div>
          </div>
          <button class="btn big" data-act="show">Show answer</button>
          <div class="grades hidden">
            ${["Again", "Hard", "Good", "Easy"].map((g, k) => `<button class="grade g${k}" data-g="${k}"><b>${g}</b><small>${previewInterval(card, k)}</small></button>`).join("")}
          </div>
        </section>
        ${coach("Recall the meaning in your head first, <b>then</b> check.")}`);
      bindQuit();
      speak(w);
      $("[data-act=say]").addEventListener("click", () => speak(w));
      $("[data-act=show]").addEventListener("click", () => {
        $(".meaning").classList.remove("hidden");
        $("[data-act=show]").classList.add("hidden");
        $(".grades").classList.remove("hidden");
        kikoSays("How well did you remember it? Your answer sets the next review date.");
      });
      $$("[data-g]").forEach((b) => b.addEventListener("click", () => {
        const g = +b.dataset.g;
        schedule(card, g);
        queue.shift();
        if (g === 0) queue.splice(Math.min(3, queue.length), 0, w); // see it again soon
        else doneCount++;
        save();
        if (queue.length) show();
        else finish();
      }));
    };

    const finish = () => {
      const next = Object.values(prog().cards).map((c) => c.due).filter((d) => d > Date.now()).sort((a, b) => a - b)[0];
      const when = next ? `Your next review is in about <b>${Math.max(1, Math.round((next - Date.now()) / DAY))} day(s)</b>.` : "";
      const msg = `<p class="lead">${total} cards reviewed</p><p class="muted">${when} Every successful review makes the gap longer.</p>`;
      if (daily) { addXp(10); screen(`<section class="done-screen"><img class="hero-kiko hop" src="assets/kiko.png" alt="Kiko"><h1>Review done!</h1>${msg}<button class="btn big" data-act="home">Back to path</button></section>`); $("[data-act=home]").addEventListener("click", showHome); }
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
          <div class="feedback" id="fb"></div>
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
      mic.textContent = "👂 Listening…"; mic.disabled = true;
      rec.onresult = (e) => {
        const said = e.results[0][0].transcript;
        const score = similarity(said, target);
        const ok = score >= 0.6;
        $("#fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><b>${ok ? "Sounds great!" : "Let's try once more"}</b><p>Kiko heard: “${esc(said)}”</p></div>`;
        kikoSays(ok ? pick(CHEERS, 1)[0] : "Listen again on 🐢 slow, then copy it.", ok ? "hop" : "wobble");
        if (ok) { state.xp += 2; save(); const nb = $("[data-act=next]"); nb.textContent = "Next"; nb.classList.remove("ghost"); }
      };
      rec.onerror = () => { $("#fb").innerHTML = `<div class="fb no"><p>Kiko couldn't hear you. Check microphone permission, or just say it out loud and tap Skip.</p></div>`; };
      rec.onend = () => { mic.textContent = "🎤 Tap and say it"; mic.disabled = false; };
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
            <p class="sent">
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
    $$(".w").forEach((w) => w.addEventListener("click", (e) => {
      const r = w.getBoundingClientRect();
      tip.textContent = w.dataset.g;
      tip.style.left = `${r.left + r.width / 2 + window.scrollX}px`;
      tip.style.top = `${r.top + window.scrollY - 8}px`;
      tip.classList.remove("hidden");
      e.stopPropagation();
    }));
    app.addEventListener("click", () => tip.classList.add("hidden"));
    $$("[data-say]").forEach((b) => b.addEventListener("click", () => speak(s.sentences[+b.dataset.say][0], 0.85)));
    $$("[data-tr]").forEach((b) => b.addEventListener("click", () => $(`#en${b.dataset.tr}`).classList.toggle("hidden")));
    $("[data-act=all]").addEventListener("click", () => speak(s.sentences.map((x) => x[0]).join(" "), 0.85));
    $("[data-act=qs]").addEventListener("click", () => questions());

    const questions = () => {
      let n = 0, right = 0;
      const show = () => {
        const [q, opts, a] = s.questions[n];
        const order = shuffle(opts.map((o, k) => [o, k]));
        screen(`
          ${stepBar(1, 2)}
          <section class="activity">
            <p class="eyebrow">Did you understand? (${n + 1}/${s.questions.length})</p>
            <div class="prompt card"><div class="target sm">${esc(q)}</div></div>
            <div class="options">${order.map(([o, k]) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}</div>
            <div class="feedback" id="fb"></div>
          </section>
          ${coach("Understanding the message is what matters most.")}`);
        bindQuit();
        $$(".opt").forEach((b) => b.addEventListener("click", () => {
          const ok = +b.dataset.k === a;
          if (ok) right++;
          $$(".opt").forEach((x) => { x.disabled = true; if (+x.dataset.k === a) x.classList.add("right"); });
          if (!ok) b.classList.add("wrong");
          kikoSays(ok ? pick(CHEERS, 1)[0] : pick(NUDGES, 1)[0], ok ? "hop" : "wobble");
          $("#fb").innerHTML = `<button class="btn" data-act="next">Continue</button>`;
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
      const extra = pick(L().words.map((w) => w[0]).filter((w) => !tokens.map(fold).includes(fold(w)) && !w.includes(" ")), 2);
      const tiles = shuffle([...tokens, ...extra]);
      const chosen = [];
      screen(`
        ${stepBar(n, items.length)}
        <section class="activity">
          <p class="eyebrow">Build this sentence in ${L().name}</p>
          <div class="prompt card"><div class="target sm">${esc(en)}</div></div>
          <div class="answer-line" id="line"></div>
          <div class="tiles" id="tiles">${tiles.map((w, k) => `<button class="tile" data-k="${k}">${esc(w)}</button>`).join("")}</div>
          <button class="btn big" data-act="check" disabled>Check</button>
          <div class="feedback" id="fb"></div>
        </section>
        ${coach("Two of the tiles are decoys. Think about word order!")}`);
      bindQuit();
      const line = $("#line"), check = $("[data-act=check]");
      const redraw = () => {
        line.innerHTML = chosen.map((k) => `<button class="tile" data-c="${k}">${esc(tiles[k])}</button>`).join("");
        $$(".tile[data-k]").forEach((b) => b.classList.toggle("used", chosen.includes(+b.dataset.k)));
        $$("[data-c]", line).forEach((b) => b.addEventListener("click", () => { chosen.splice(chosen.indexOf(+b.dataset.c), 1); redraw(); }));
        check.disabled = !chosen.length;
      };
      $$(".tile[data-k]").forEach((b) => b.addEventListener("click", () => { if (!chosen.includes(+b.dataset.k)) { chosen.push(+b.dataset.k); redraw(); } }));
      check.addEventListener("click", () => {
        const built = chosen.map((k) => tiles[k]).join(" ");
        const ok = clean(built) === clean(target);
        if (ok) { right++; state.xp += 3; save(); }
        $$(".tile").forEach((b) => (b.disabled = true));
        check.remove();
        $("#fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><b>${ok ? "Perfect sentence!" : "Close! The answer is:"}</b><p>${esc(target)}</p><button class="btn" data-act="next">Continue</button></div>`;
        kikoSays(ok ? "Now read it out loud! 🗣️" : "Look at where each word goes. Word order is the tricky part.", ok ? "hop" : "wobble");
        speak(target);
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
        <ol class="loop">${loop.map(([ic, a, b]) => `<li class="card"><span class="loop-ic">${ic}</span><div><b>${a}</b><small>${b}</small></div></li>`).join("")}</ol>
        ${p.plan ? `<div class="card plan-preview"><p class="muted">Your plan</p><p class="plan-text">${esc(p.plan)}</p></div>` : ""}
        <label class="check"><input type="checkbox" id="commit"> I'll show up tomorrow, even if it's only for 2 minutes.</label>
        <button class="btn big" data-act="done" disabled>Finish the path</button>
      </section>
      ${coach("Consistency beats intensity. See you tomorrow! 🐰")}`);
    bindQuit();
    $("#commit").addEventListener("change", (e) => ($("[data-act=done]").disabled = !e.target.checked));
    $("[data-act=done]").addEventListener("click", () => completeTask(i, `<p class="lead">🏅 You finished Kiko's science path in ${L().name}!</p><p class="muted">Your ${Object.keys(p.cards).length} words will come back for review at just the right time.</p>`));
  }

  // ---------- Boot ----------
  renderHud();
  state.lang ? showHome() : showWelcome();
})();
