document.addEventListener('DOMContentLoaded', () => {
    loadDefaultStories();
    
    // Listen for custom file uploads
    const fileInput = document.getElementById('file-upload');
    fileInput.addEventListener('change', handleFileUpload);
});

async function loadDefaultStories() {
    const container = document.getElementById('story-selector');

    try {
        // Added cache-busting query parameter to force GitHub Pages to fetch the latest JSON
        const response = await fetch(`stories.json?t=${new Date().getTime()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stories = await response.json();
        container.innerHTML = ''; // Clear loading text
        
        stories.forEach(story => {
            const button = document.createElement('button');
            button.textContent = `${story.title} (${story.type.toUpperCase()})`;
            button.addEventListener('click', () => openStory(story.filename, story.type));
            container.appendChild(button);
        });

    } catch (error) {
        console.error("Error loading default stories list:", error);
        container.innerHTML = `<p style="color: red;">Error loading stories library. Verify stories.json exists and is valid JSON.</p>`;
    }
}

async function openStory(filepath, filetype) {
    const viewer = document.getElementById('viewer-content');
    viewer.innerHTML = '<p class="placeholder-text">Loading story...</p>';
    
    try {
        if (filetype === 'txt') {
            // Append cache-buster to prevent stale text files from GitHub Pages cache
            const response = await fetch(`${filepath}?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error('File not found');
            const text = await response.text();
            viewer.innerHTML = `<div class="text-content">${text}</div>`;
            
        } else if (filetype === 'pdf') {
            viewer.innerHTML = `<iframe src="${filepath}" class="document-frame"></iframe>`;
            
        } else if (filetype === 'epub') {
            const filename = filepath.split('/').pop();
            viewer.innerHTML = `
                <div class="epub-fallback">
                    <h3>EPUB Format Selected</h3>
                    <p>Web browsers require an external reader to display EPUB files natively.</p>
                    <a href="${filepath}" download="${filename}">
                        <button>Download ${filename} to Read</button>
                    </a>
                </div>
            `;
        } else {
            viewer.innerHTML = `<p style="color: red;">Unsupported format.</p>`;
        }
    } catch (error) {
        console.error("Error opening story file:", error);
        viewer.innerHTML = `<p style="color: red;">Failed to open the file. Make sure <strong>${filepath}</strong> exactly matches the file path and casing on GitHub.</p>`;
    }
}

// Handle User Uploaded Files
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const viewer = document.getElementById('viewer-content');
    viewer.innerHTML = '<p class="placeholder-text">Loading uploaded story...</p>';

    const filename = file.name.toLowerCase();
    let filetype = '';
    
    if (filename.endsWith('.txt')) filetype = 'txt';
    else if (filename.endsWith('.pdf')) filetype = 'pdf';
    else if (filename.endsWith('.epub')) filetype = 'epub';
    else {
        viewer.innerHTML = `<p style="color: red;">Unsupported format. Please upload a .txt, .pdf, or .epub file.</p>`;
        return;
    }

    if (filetype === 'txt') {
        const reader = new FileReader();
        reader.onload = function(e) {
            viewer.innerHTML = `<div class="text-content">${e.target.result}</div>`;
        };
        reader.onerror = function() {
            viewer.innerHTML = `<p style="color: red;">Error reading the text file.</p>`;
        }
        reader.readAsText(file);
        
    } else if (filetype === 'pdf') {
        // Create a local blob URL for the PDF so the browser can render it safely
        const fileURL = URL.createObjectURL(file);
        viewer.innerHTML = `<iframe src="${fileURL}" class="document-frame"></iframe>`;
        
    } else if (filetype === 'epub') {
        viewer.innerHTML = `
            <div class="epub-fallback">
                <h3>EPUB Format Selected</h3>
                <p>Web browsers require an external reader to display EPUB files natively.</p>
                <p style="color: #6c757d; font-size: 14px;">(Since you just uploaded this file, you already have it saved on your device to open in an EPUB reader!)</p>
            </div>
        `;
    }
}