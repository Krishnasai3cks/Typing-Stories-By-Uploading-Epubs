Here is a foundational vanilla JavaScript codebase designed specifically to be hosted on GitHub Pages with zero backend required.

This implementation handles the core "TypeRacer" logic (word-by-word validation, highlighting, WPM calculation), `.txt` file uploads, and includes the CDN libraries you will need for PDF and EPUB parsing.

### 1. `index.html`

This sets up the UI, imports necessary CDNs (`pdf.js` and `epub.js`), and creates the structural elements for the typing interface.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Story Typer</title>
    <link rel="stylesheet" href="style.css">
    <!-- Libraries for client-side file parsing -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <div class="controls">
                <select id="default-stories">
                    <option value="">-- Select a Default Story --</option>
                    <option value="story1">The Consultant's Trick</option>
                    <option value="story2">A Quick Brown Fox</option>
                </select>
                <span>OR</span>
                <input type="file" id="file-upload" accept=".txt,.pdf,.epub">
            </div>
            <div class="stats">
                <span id="wpm">0 WPM</span>
                <span id="timer">0:00</span>
            </div>
        </header>

        <main>
            <div id="text-display" class="text-display">
                <!-- Text spans will be injected here -->
            </div>
            <input type="text" id="typing-input" autocomplete="off" placeholder="Start typing here..." disabled>
            <div id="chapter-controls" class="hidden">
                <button id="next-chapter-btn">Next Chapter (or press Enter)</button>
            </div>
        </main>
    </div>
    <script src="script.js"></script>
</body>
</html>

```

### 2. `style.css`

This handles the TypeRacer-style highlighting. The logic relies on wrapping every word in a `<span>` and applying classes based on the user's progress.

```css
:root {
    --bg-color: #2b2b2b;
    --text-color: #e0e0e0;
    --correct-color: #99cc00;
    --error-bg: #cc0000;
    --current-bg: #444;
}

body {
    font-family: 'Courier New', Courier, monospace; /* Monospace is best for typing apps */
    background-color: var(--bg-color);
    color: var(--text-color);
    display: flex;
    justify-content: center;
    padding-top: 50px;
    margin: 0;
}

.container {
    width: 800px;
    max-width: 90%;
}

.controls {
    display: flex;
    gap: 15px;
    align-items: center;
    margin-bottom: 20px;
}

.stats {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
}

.text-display {
    background-color: #333;
    padding: 20px;
    border-radius: 8px;
    font-size: 1.4rem;
    line-height: 1.8;
    margin-bottom: 20px;
    white-space: pre-wrap; /* Preserves standard line breaks */
}

.text-display span {
    padding: 2px 4px;
    border-radius: 3px;
}

/* Typeracer states */
.correct { color: var(--correct-color); }
.incorrect { background-color: var(--error-bg); color: white; }
.current { background-color: var(--current-bg); text-decoration: underline; }

#typing-input {
    width: 100%;
    padding: 15px;
    font-size: 1.2rem;
    border: 2px solid #555;
    border-radius: 5px;
    background-color: #1e1e1e;
    color: white;
    box-sizing: border-box;
}

#typing-input:focus {
    outline: none;
    border-color: #888;
}

.hidden { display: none !important; }

```

### 3. `script.js`

This script contains the core typing engine, the WPM calculator, and the specific em-dash normalization logic you requested.

```javascript
const defaultStories = {
    story1: "Patrick adjusted his vest, offering Teresa a disarming smile. \"It's all about misdirection,\" he said, revealing the key he had palmed moments before. She just rolled her eyes, already walking toward the crime scene.",
    story2: "The quick brown fox jumps over the lazy dog. It was a perfectly normal day until the rain started."
};

let wordsArray = [];
let currentWordIndex = 0;
let startTime = null;
let timerInterval = null;
let totalCharactersTyped = 0;

const textDisplay = document.getElementById('text-display');
const typingInput = document.getElementById('typing-input');
const wpmDisplay = document.getElementById('wpm');
const fileUpload = document.getElementById('file-upload');
const storySelect = document.getElementById('default-stories');

// --- Initialization ---

function initTyping(text) {
    clearInterval(timerInterval);
    startTime = null;
    currentWordIndex = 0;
    totalCharactersTyped = 0;
    wpmDisplay.innerText = "0 WPM";
    typingInput.value = '';
    typingInput.disabled = false;
    typingInput.focus();

    // Split text by spaces, keeping punctuation attached to words
    wordsArray = text.trim().split(/\s+/);
    
    textDisplay.innerHTML = '';
    wordsArray.forEach((word, index) => {
        const span = document.createElement('span');
        span.innerText = word + " "; // Add space back for display
        if (index === 0) span.classList.add('current');
        textDisplay.appendChild(span);
    });
}

// --- Typing Logic & Em-dash Handling ---

typingInput.addEventListener('input', (e) => {
    if (!startTime) startTimer();

    const currentWordSpan = textDisplay.children[currentWordIndex];
    let targetWord = wordsArray[currentWordIndex];
    let typedValue = typingInput.value;

    // Handle Google Docs style em-dash normalization
    // If the target word contains an em-dash (—), and the user types hyphens (-)
    // we normalize the typed value for comparison so it doesn't throw an immediate error.
    let normalizedTarget = targetWord;
    let normalizedTyped = typedValue;
    
    if (targetWord.includes('—')) {
        normalizedTarget = targetWord.replace(/—/g, '---');
        // If user typed 1 or 2 dashes so far, we let it match the prefix of the '---'
        normalizedTyped = typedValue.replace(/-/g, '-'); 
    }

    // Check if user pressed space (word complete)
    if (typedValue.endsWith(' ')) {
        const typedWord = typedValue.trim();
        // Allow completion if they typed '---' for an em-dash, or typed the word perfectly
        const isMatch = (typedWord === targetWord) || 
                        (targetWord.includes('—') && typedWord === targetWord.replace(/—/g, '---'));

        if (isMatch) {
            currentWordSpan.classList.remove('current', 'incorrect');
            currentWordSpan.classList.add('correct');
            totalCharactersTyped += targetWord.length + 1; // +1 for space
            currentWordIndex++;
            typingInput.value = '';

            // End of text check
            if (currentWordIndex >= wordsArray.length) {
                typingInput.disabled = true;
                clearInterval(timerInterval);
            } else {
                textDisplay.children[currentWordIndex].classList.add('current');
            }
        } else {
            currentWordSpan.classList.add('incorrect');
        }
        return;
    }

    // Prefix validation (while typing the current word)
    if (normalizedTarget.startsWith(normalizedTyped)) {
        currentWordSpan.classList.remove('incorrect');
    } else {
        currentWordSpan.classList.add('incorrect');
    }
});

// --- Timer & WPM ---

function startTimer() {
    startTime = new Date();
    timerInterval = setInterval(() => {
        const timeElapsed = (new Date() - startTime) / 60000; // in minutes
        // Standard WPM calculation: (characters / 5) / minutes
        const wpm = Math.round((totalCharactersTyped / 5) / timeElapsed);
        wpmDisplay.innerText = `${wpm > 0 ? wpm : 0} WPM`;
    }, 1000);
}

// --- File Handling (TXT included, PDF/EPUB structured) ---

storySelect.addEventListener('change', (e) => {
    if (e.target.value) initTyping(defaultStories[e.target.value]);
});

fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'txt') {
        const reader = new FileReader();
        reader.onload = (event) => initTyping(event.target.result);
        reader.readAsText(file);
    } 
    else if (extension === 'pdf') {
        // TODO: Implement PDF.js text extraction loop here.
        // Requires parsing pdf.getPage(), then page.getTextContent(), and joining items.str
        alert("PDF parsing logic goes here using the injected pdf.js CDN.");
    } 
    else if (extension === 'epub') {
        // TODO: Implement epub.js parsing here.
        // Requires initializing ePub(file), extracting the spine, and fetching chapter text.
        alert("EPUB chapter pagination logic goes here using the injected epub.js CDN.");
    }
});

```

### Next Steps & Addressing the Ambiguities

To host this on GitHub Pages, simply create a new repository, push these three files (`index.html`, `style.css`, `script.js`) to the `main` branch, and enable GitHub Pages in the repository settings.

While the `.txt` handling, typing logic, and WPM calculation are fully implemented above, there are significant complexities when dealing with PDFs and EPUBs purely on the front-end that require architectural decisions. Extracting raw text from a PDF often results in shattered sentences, missing spaces, and hardcoded line breaks right in the middle of words.

Given these constraints with client-side parsing, how would you prefer to handle text sanitization for PDFs (e.g., regex stripping out unnatural line breaks) and should we utilize `localStorage` to save a user's exact word index so they don't lose their place in a massive EPUB chapter if they accidentally refresh the page?
