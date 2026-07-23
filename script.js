document.addEventListener('DOMContentLoaded', () => {
    loadDefaultStories();
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);
    document.getElementById('typing-input').addEventListener('input', handleTyping);
    
    document.getElementById('prev-chapter').addEventListener('click', () => loadEpubChapter(currentEpubSpineIndex - 1));
    document.getElementById('next-chapter').addEventListener('click', () => loadEpubChapter(currentEpubSpineIndex + 1));
});

// --- State Variables ---
let wordsArray = [];
let currentWordIndex = 0;
let startTime = null;
let keystrokes = 0;
let wpmInterval = null;

// EPUB specific variables
let currentEpubBook = null;
let currentEpubSpineIndex = 0;

// --- Loading Files ---
async function loadDefaultStories() {
    const container = document.getElementById('story-selector');
    try {
        const response = await fetch(`stories.json?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error();
        const stories = await response.json();
        container.innerHTML = ''; 
        
        stories.forEach(story => {
            // PDF is excluded because PDFs cannot be parsed cleanly for text typing
            if (story.type === 'pdf') return; 
            
            const button = document.createElement('button');
            button.textContent = `${story.title} (${story.type.toUpperCase()})`;
            button.addEventListener('click', () => openStory(story.filename, story.type));
            container.appendChild(button);
        });
    } catch (error) {
        container.innerHTML = `<p style="color: red;">Error loading library.</p>`;
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    if (filename.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => startTypingEngine(e.target.result);
        reader.readAsText(file);
    } else if (filename.endsWith('.epub')) {
        openEpub(file);
    } else {
        alert("Please upload a .txt or .epub file.");
    }
}

async function openStory(filepath, filetype) {
    document.getElementById('viewer-content').innerHTML = '<p class="placeholder-text">Loading...</p>';
    if (filetype === 'txt') {
        try {
            const response = await fetch(filepath);
            const text = await response.text();
            startTypingEngine(text);
        } catch (e) {
            alert("Error loading TXT.");
        }
    } else if (filetype === 'epub') {
        openEpub(filepath);
    }
}

// --- EPUB Handling ---
function openEpub(source) {
    document.getElementById('chapter-controls').style.display = 'flex';
    currentEpubBook = ePub(source);
    
    currentEpubBook.loaded.spine.then(spine => {
        // Start at the first meaningful chapter (index 0 is usually cover/metadata)
        loadEpubChapter(0);
    });
}

async function loadEpubChapter(index) {
    const spine = await currentEpubBook.loaded.spine;
    if (index < 0 || index >= spine.length) return;
    
    currentEpubSpineIndex = index;
    const item = spine.get(index);
    const doc = await item.load(currentEpubBook.load.bind(currentEpubBook));
    
    // Extract raw text from the chapter's HTML body
    const text = doc.body.textContent || doc.body.innerText;
    
    if (text.trim().length === 0) {
        // If chapter is empty (e.g., just an image), auto-skip to next
        loadEpubChapter(index + 1);
        return;
    }
    
    startTypingEngine(text);
}

// --- Typing Engine ---
function startTypingEngine(rawText) {
    clearInterval(wpmInterval);
    document.getElementById('wpm-display').innerText = "WPM: 0";
    
    // Clean up text: remove extra spaces, treat hyphens and em dashes as word boundaries if needed
    // We'll split simply by spaces for a standard Typeracer feel
    const cleanText = rawText.replace(/\s+/g, ' ').trim();
    wordsArray = cleanText.split(' ');
    currentWordIndex = 0;
    startTime = null;
    keystrokes = 0;

    const viewer = document.getElementById('viewer-content');
    viewer.innerHTML = '';
    
    wordsArray.forEach((word, index) => {
        const wordSpan = document.createElement('span');
        wordSpan.innerText = word + " "; // Add space back for formatting
        wordSpan.className = 'word';
        wordSpan.id = `word-${index}`;
        viewer.appendChild(wordSpan);
    });

    const inputArea = document.getElementById('typing-input');
    inputArea.disabled = false;
    inputArea.value = '';
    inputArea.focus();
    
    updateWordHighlight();
}

function handleTyping(e) {
    if (!startTime) {
        startTime = new Date();
        wpmInterval = setInterval(calculateWPM, 1000);
    }

    const inputArea = e.target;
    const typedValue = inputArea.value;
    const currentWord = wordsArray[currentWordIndex];
    const currentWordSpan = document.getElementById(`word-${currentWordIndex}`);

    // Check if the user pressed Space at the end of the correct word
    if (typedValue.endsWith(' ')) {
        const typedWord = typedValue.trim();
        if (typedWord === currentWord) {
            // Word correct! Advance to next word.
            keystrokes += typedWord.length + 1; // +1 for the space
            currentWordSpan.className = 'word correct';
            currentWordIndex++;
            inputArea.value = '';
            
            if (currentWordIndex >= wordsArray.length) {
                finishTyping();
            } else {
                updateWordHighlight();
            }
        }
        return;
    }

    // Live validation
    if (currentWord.startsWith(typedValue)) {
        currentWordSpan.className = 'word active';
        inputArea.classList.remove('input-error');
    } else {
        currentWordSpan.className = 'word error';
        inputArea.classList.add('input-error');
    }
}

function updateWordHighlight() {
    if (currentWordIndex < wordsArray.length) {
        const nextWord = document.getElementById(`word-${currentWordIndex}`);
        nextWord.className = 'word active';
        
        // Auto-scroll the text area to keep the active word in view
        nextWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function calculateWPM() {
    if (!startTime || keystrokes === 0) return;
    const now = new Date();
    const minutes = (now - startTime) / 60000;
    // Standard WPM calculation: (characters / 5) / minutes
    const wpm = Math.round((keystrokes / 5) / minutes);
    document.getElementById('wpm-display').innerText = `WPM: ${wpm}`;
}

function finishTyping() {
    clearInterval(wpmInterval);
    document.getElementById('typing-input').disabled = true;
    document.getElementById('typing-input').value = 'Chapter Complete!';
}