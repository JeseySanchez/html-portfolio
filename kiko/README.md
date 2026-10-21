# Kiko 🐰

Kiko is a language-learning web app that teaches you **how** to learn a language as well as the language itself. The course is a path of 11 tasks. Each one starts with a short card explaining a research-backed technique, and then you use that technique straight away.

| # | Task | Technique | Key research |
|---|------|-----------|--------------|
| 1 | Set your plan | Implementation intentions | Gollwitzer & Sheeran, 2006 |
| 2 | Learn your first 10 words | High-frequency vocabulary | Nation, 2006 |
| 3 | Test yourself | Retrieval practice | Roediger & Karpicke, 2006 |
| 4 | Add 10 more words | Dual coding | Paivio, 1991; Mayer, 2009 |
| 5 | Space it out | Spaced repetition | Ebbinghaus, 1885; Cepeda et al., 2006 |
| 6 | Listen & shadow | Shadowing & output | Swain, 1985; Hamada, 2016 |
| 7 | Grow to 30 words | Small daily doses | Cowan, 2001; Sweller, 1988 |
| 8 | Read a story | Comprehensible input | Krashen, 1982; Hu & Nation, 2000 |
| 9 | Mixed practice | Interleaving | Rohrer & Taylor, 2007 |
| 10 | Build sentences | Pushed output / noticing | Swain, 1995; Schmidt, 1990 |
| 11 | Sleep on it & keep going | Consolidation & habit | Walker & Stickgold, 2004; Lally et al., 2010 |

## Features
- **Spanish, French and German.** Each has 30 high-frequency words, 8 everyday phrases, a graded story and sentence-building exercises.
- **Spaced-repetition deck.** Uses a simplified SM-2 scheduler with Again / Hard / Good / Easy grading. A **Daily review** card on the home screen shows how many words are due.
- **Retrieval quizzes.** Questions are multiple-choice, typed recall and listening. Any question you miss comes back at the end of the quiz.
- **Audio.** Words and phrases are read aloud with the browser's built-in speech. Where the browser supports it (Chrome, Edge, Safari), you can also speak into the microphone to check your shadowing.
- **Tap-to-translate story.** Tap any word for its meaning, or show the English for a whole sentence.
- **Progress.** XP, a day streak and progress through the path are saved in your browser's `localStorage`.

## Run it
It's plain HTML, CSS and JavaScript with no build step. Open `kiko/index.html` in a browser, or serve the folder:

```sh
cd kiko && python3 -m http.server 8000
# then visit http://localhost:8000
```

## Add a language
Copy one of the blocks in `data.js` (for example `es`), give it a new language code and translate the words, phrases, story and sentences. The app picks it up automatically.
