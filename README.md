# 🧠 Vocab Drill — Browser-Based Definition Practice

**Vocab Drill** is a lightweight, single-page vocabulary trainer that runs entirely in your browser — no database or server required.

It loads a simple comma-separated `wordlist.txt`, asks you to define each word, sends your definition to an **OpenAI-compatible API**, receives a score (0–5), and saves your progress using **spaced repetition** logic (SM-2).  
All progress is stored locally in your browser (`localStorage`) and can be exported/imported as JSON.

---

## ✨ Features

- 📚 Reads a comma-separated `wordlist.txt`
- 💬 Lets you type your own definition and get a score (0–5)
- 🤖 Uses an OpenAI-compatible API to evaluate and explain
- ⏰ Implements *spaced repetition* (SM-2) scheduling
- 💾 Saves all data locally — no login or database
- 📤 Import/export your progress as JSON
- 🧩 “Reveal canonical definition” button (AI-generated)
- ⮕ Manual “Next word” control
- 🧪 Optional “Fast mode” (for testing intervals in minutes)

---

## 🚀 Quick Start (GitHub Pages)

1. **Clone this repo**  
   ```bash
   git clone https://github.com/yourusername/vocab-drill.git
   cd vocab-drill

	2.	Edit your word list
Open wordlist.txt and add words, separated by commas or newlines:

boy, bat, cow, adverse, summation


	3.	Set up your API key
In app.js, find this section and replace the placeholder if needed:

const PPQ_API_URL = "https://api.ppq.ai/chat/completions";
const PPQ_API_KEY = "sk-your-key-here";

(The API is OpenAI-compatible, so you can also swap in https://api.openai.com/v1/chat/completions and a normal OpenAI key.)

	4.	Push to GitHub and enable Pages
	•	Commit all files (index.html, style.css, app.js, wordlist.txt, README.md)
	•	In your repo settings → Pages, set source to main branch → / (root)
	•	Your app will be live at
https://yourusername.github.io/vocab-drill/

⸻

🧠 How It Works

Step	Description
1	The app picks a due word from wordlist.txt
2	You type a definition and press Enter
3	The app sends your answer and the word to the API
4	The model grades it (0–5) and returns a brief explanation
5	Your local SRS data updates (stored in localStorage)
6	You can reveal the canonical definition or move to the next word

Scoring guide

Score	Meaning
0	Totally wrong or off-topic
1	Very incomplete or misleading
2	Partial, missing key ideas
3	Mostly correct with minor gaps
4	Correct with good phrasing
5	Fully correct, dictionary-grade


⸻

🧩 Spaced Repetition Logic
	•	Based on SM-2 (Anki algorithm)
	•	Each card stores:
	•	reps (repetitions)
	•	ease (how quickly intervals grow)
	•	interval (days or minutes)
	•	dueISO (next review date)
	•	history (past answers + scores)
	•	“Fast mode” uses minutes instead of days (for testing).

⸻

🧰 Local Storage & Files

File	Purpose
index.html	Main HTML structure
style.css	Stylesheet
app.js	Logic, API calls, spaced repetition
wordlist.txt	List of words to review
README.md	This documentation

Import / Export

Use the buttons at the top to export progress to vocab-progress.json or import it back later.

⸻

⚙️ Customizing
	•	Change the model: in app.js, set

model: "gpt-4o-mini" // or "claude-3.5-sonnet", etc.


	•	Add a dictionary source: modify fetchCanonicalDefinition() in app.js
	•	Adjust scoring rubric: edit the grader’s system prompt inside gradeWithPPQ()
	•	Theme colors: tweak the CSS :root variables

⸻

🧱 Tech Stack

Component	Description
HTML/CSS/JS	Static frontend
Fetch API	Direct API calls
LocalStorage	Persistent user data
OpenAI-compatible API	Grading + definitions
GitHub Pages	Free hosting


⸻

🔒 Notes
	•	Your API key is exposed client-side — for a production version, use a proxy (Cloudflare Worker, Netlify Function, etc.).
	•	This proof of concept limits potential loss to a few dollars by keeping a capped balance.
	•	No personal data leaves your browser.

⸻

📜 License

MIT License © 2025 Stainlesssteelsewingneedles
Use freely, modify, and share — attribution appreciated.

⸻

Enjoy building your lightweight personal AI vocabulary trainer!
