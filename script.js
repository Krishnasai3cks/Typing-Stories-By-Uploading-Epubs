document.addEventListener('DOMContentLoaded', () => {
    loadDefaultStories();
    
    const fileInput = document.getElementById('file-upload');
    if(fileInput) fileInput.addEventListener('change', handleFileUpload);
    
    const typingInput = document.getElementById('typing-input');
    typingInput.addEventListener('input', handleInput);
    typingInput.addEventListener('keydown', handleKeyDown);
    
    document.getElementById('prev-chapter').addEventListener('click', () => loadEpubChapter(currentEpubSpineIndex - 1));
    document.getElementById('next-chapter').addEventListener('click', () => loadEpubChapter(currentEpubSpineIndex + 1));
});

// --- State Variables ---
let wordsArray = [];
let currentWordIndex = 0;
let startTime = null;
let correctKeystrokes = 0;
let wpmInterval = null;

let currentEpubBook = null;
let currentEpubSpineIndex = 0;

// --- Load Files ---
async function loadDefaultStories() {
    const container = document.getElementById('story-selector');
    try {
        const response = await fetch(`stories.json?t=${Date.now()}`);
        if (!response.ok) throw new Error();
        const stories = await response.json();
        container.innerHTML = ''; 
        
        stories.forEach(story => {
            if (story.type === 'pdf') return; 
            const btn = document.createElement('button');
            btn.textContent = story.title;
            btn.addEventListener('click', () => openStory(story.filename, story.type));
            container.appendChild(btn);
        });
    } catch (e) {
        container.innerHTML = `<p style="color: red;">Failed to load library.</p>`;
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
    document.getElementById('viewer-content').innerHTML = '<p class="placeholder-text">Parsing file...</p>';
    if (filetype === 'txt') {
        try {
            const response = await fetch(`${filepath}?t=${Date.now()}`);
            const text = await response.text();
            startTypingEngine(text);
        } catch (e) {
            alert("Error loading text file.");
        }
    } else if (filetype === 'epub') {
        openEpub(filepath);
    }
}

// --- EPUB Logic ---
function openEpub(source) {
    document.getElementById('chapter-controls').style.display = 'flex';
    currentEpubBook = ePub(source);
    
    currentEpubBook.loaded.spine.then(spine => {
        loadEpubChapter(0);
    });
}

async function loadEpubChapter(index) {
    const spine = await currentEpubBook.loaded.spine;
    if (index < 0 || index >= spine.length) return;
    
    document.getElementById('viewer-content').innerHTML = '<p class="placeholder-text">Extracting Chapter Text...</p>';
    currentEpubSpineIndex = index;
    document.getElementById('chapter-indicator').innerText = `Chapter ${index}`;
    
    const item = spine.get(index);
    const doc = await item.load(currentEpubBook.load.bind(currentEpubBook));
    
    const rawText = doc.body.textContent || doc.body.innerText;
    const cleanText = rawText.replace(/\s+/g, ' ').trim();
    
    if (cleanText.length < 15) {
        loadEpubChapter(index + 1);
        return;
    }
    
    startTypingEngine(cleanText);
}

// --- Typing Engine (Typeracer Logic) ---
function startTypingEngine(rawText) {
    clearInterval(wpmInterval);
    document.getElementById('wpm-display').innerText = "WPM: 0";
    
    wordsArray = rawText.trim().split(' ').filter(w => w.length > 0);
    currentWordIndex = 0;
    startTime = null;
    correctKeystrokes = 0;

    const viewer = document.getElementById('viewer-content');
    viewer.innerHTML = '';
    
    wordsArray.forEach((word, index) => {
        const span = document.createElement('span');
        span.id = `word-${index}`;
        span.className = 'word pending';
        span.innerText = word;
        viewer.appendChild(span);
    });

    const inputArea = document.getElementById('typing-input');
    inputArea.disabled = false;
    inputArea.value = '';
    inputArea.classList.remove('error-shake');
    inputArea.focus();
    
    renderCurrentWord();
}

function handleInput(e) {
    if (!startTime) {
        startTime = new Date();
        wpmInterval = setInterval(calculateWPM, 1000);
    }
    renderCurrentWord();
}

function handleKeyDown(e) {
    const inputArea = e.target;
    const currentWord = wordsArray[currentWordIndex];

    if (e.key === ' ' || e.code === 'Space') {
        if (inputArea.value !== currentWord) {
            e.preventDefault();
            inputArea.classList.add('error-shake');
            setTimeout(() => inputArea.classList.remove('error-shake'), 200);
            return;
        }

        e.preventDefault(); 
        correctKeystrokes += currentWord.length + 1;
        
        const wordSpan = document.getElementById(`word-${currentWordIndex}`);
        wordSpan.className = 'word completed';
        wordSpan.innerHTML = currentWord;
        
        currentWordIndex++;
        inputArea.value = '';
        
        if (currentWordIndex >= wordsArray.length) {
            finishTyping();
        } else {
            renderCurrentWord();
        }
    }
}

function renderCurrentWord() {
    if (currentWordIndex >= wordsArray.length) return;

    const currentWordSpan = document.getElementById(`word-${currentWordIndex}`);
    const currentWord = wordsArray[currentWordIndex];
    const typed = document.getElementById('typing-input').value;

    let html = '';
    const maxLength = Math.max(currentWord.length, typed.length);

    for (let i = 0; i < maxLength; i++) {
        if (i < typed.length) {
            if (i < currentWord.length && typed[i] === currentWord[i]) {
                html += `<span class="correct">${currentWord[i]}</span>`;
            } else {
                let charToShow = i < currentWord.length ? currentWord[i] : typed[i];
                html += `<span class="incorrect">${charToShow}</span>`;
            }
        } else {
            html += `<span class="pending">${currentWord[i]}</span>`;
        }
    }

    currentWordSpan.innerHTML = html;
    currentWordSpan.className = 'word active';

    currentWordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function calculateWPM() {
    if (!startTime || correctKeystrokes === 0) return;
    const now = new Date();
    const minutes = (now - startTime) / 60000;
    
    const wpm = Math.round((correctKeystrokes / 5) / minutes);
    document.getElementById('wpm-display').innerText = `WPM: ${wpm}`;
}

function finishTyping() {
    clearInterval(wpmInterval);
    const inputArea = document.getElementById('typing-input');
    inputArea.disabled = true;
    inputArea.value = 'Chapter Complete!';
}