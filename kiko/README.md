# Kiko 🐰

Kiko is a language-learning web app that teaches you **how** to learn a language as well as the language itself. The course is a path of 28 tasks in three units. Each task starts with a short card explaining a research-backed technique, and then you use that technique straight away.

**Unit 1 · The science of learning**

| # | Task | Technique | Key research |
|---|------|-----------|--------------|
| 1 | Set your plan | Implementation intentions | Gollwitzer & Sheeran, 2006 |
| 2 | Learn your first 10 words | High-frequency vocabulary | Nation, 2006 |
| 3 | Test yourself | Retrieval practice | Roediger & Karpicke, 2006 |
| 4 | Add 10 more words | Dual coding | Paivio, 1991; Mayer, 2009 |
| 5 | Space it out | Spaced repetition | Ebbinghaus, 1885; Cepeda et al., 2006 |
| 6 | Listen & shadow | Shadowing & output | Swain, 1985; Hamada, 2016 |
| 7 | Grow to 30 words | Small daily doses | Cowan, 2001; Sweller, 1988 |
| 8 | Say the words | Production effect | MacLeod et al., 2010 |
| 9 | Read a story | Comprehensible input | Krashen, 1982; Hu & Nation, 2000 |
| 10 | Mixed practice | Interleaving | Rohrer & Taylor, 2007 |
| 11 | Build sentences | Pushed output / noticing | Swain, 1995; Schmidt, 1990 |
| 12 | Sleep on it & keep going | Consolidation & habit | Walker & Stickgold, 2004; Lally et al., 2010 |

**Unit 2 · Family & food**: self-reference effect, thematic grouping, pronunciation feedback, successive relearning, formulaic chunks, narrow reading, the generation effect and desirable difficulties.

**Unit 3 · Out and about**: enactment, elaboration, the method of loci, retrieval through speaking, extensive reading, corrective feedback, testing with feedback and spacing over weeks.

## Features
- **Spanish, French and German.** Each has 80 high-frequency words, 16 everyday phrases, 3 graded stories and 12 sentence-building exercises.
- **Speaking practice.** "Say the words" tasks show you the English and you say the word into the microphone. Kiko checks what he heard, gives you a second try, and lets you hear the word if you're stuck. New-word flashcards also have a 🎤 button to check your pronunciation. Without speech recognition (or a mic), you say the word aloud and mark yourself.
- **Streaks.** Tap 🔥 to see your current and longest streak, the last seven days, and your next milestone (3, 7, 14, 30… days). Every 7 days in a row earns a **streak freeze** (up to 2), which is used automatically if you miss a day. Days follow your local midnight.
- **Daily reminders.** Pick a time in your plan or the streak panel. **Add to my calendar** downloads a repeating daily event with an alert, which works even when Kiko is closed. While Kiko is open you can also get a browser notification, and the home screen nudges you once your practice time has passed.
- **Spaced-repetition deck.** Uses a simplified SM-2 scheduler with Again / Hard / Good / Easy grading. A **Daily review** card on the home screen shows how many words are due.
- **Retrieval quizzes.** Questions are multiple-choice, typed recall and listening. Any question you miss comes back at the end of the quiz.
- **Audio.** Words and phrases are read aloud with the browser's built-in speech. Speech recognition works in Chrome, Edge and Safari.
- **Tap-to-translate story.** Tap any word for its meaning, or show the English for a whole sentence.
- **Progress.** XP, your streak and progress through the path are saved in your browser's `localStorage`.
- **Kiko the puppet.** Kiko is assembled from 20 separate art layers (body, head, ears, arms, legs, tail, backpack, open/closed eyes and three mouths). Each part rotates around its own joint, so he moves smoothly instead of swapping pictures:
  - 👋 **Welcome**: bounces in and waves.
  - 🐰 **Idle**: breathes, sways his head, drifts his ears and tail, and blinks.
  - 🤔 **Thinking**: tilts his head and perks an ear, with a "?" beside him.
  - 🎉 **Correct**: a springy hop with ears and legs following through.
  - 🥺 **Wrong**: a startled "oh!", ears droop, then he perks up smiling.
  - 🏆 **Celebration**: a happy dance when you finish a task.

  The layers come from the Phase 1 layer kit; `tools/build_rig.py` turns the kit into `assets/rig/*.webp` and `kiko-rig.js`.
- **Animations.** Flashcards flip in 3D, review cards fly off once rated, confetti bursts for right answers, wrong answers shake, sentence tiles glide into place, and units pop in along the path. If your device is set to reduce motion, these are switched off.
- **Sound effects.** Short tones are generated in the browser, so there are no audio files. Tap 🔈 to mute.
- **Keyboard shortcuts** (on computers): `1`–`4` pick an answer or a rating, `Space` flips a card, and `Enter` continues.

## Run it
It's plain HTML, CSS and JavaScript with no build step. Open `kiko/index.html` in a browser, or serve the folder:

```sh
cd kiko && python3 -m http.server 8000
# then visit http://localhost:8000
```

## Add a language
Copy one of the blocks in `data.js` (for example `es`), give it a new language code and translate the words, phrases, stories and sentences. The app picks it up automatically.
