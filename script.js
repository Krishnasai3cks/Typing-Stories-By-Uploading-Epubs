document.addEventListener('DOMContentLoaded', loadDefaultStories);

async function loadDefaultStories() {
    const container = document.getElementById('story-selector');

    try {
        const response = await fetch('./stories.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stories = await response.json();
        
        // Clear the "Loading library..." text
        container.innerHTML = '';
        
        // Generate a button for each story
        stories.forEach(story => {
            const button = document.createElement('button');
            button.textContent = `${story.title} (${story.type.toUpperCase()})`;
            button.addEventListener('click', () => openStory(story.filename, story.type));
            container.appendChild(button);
        });

    } catch (error) {
        console.error("Error loading default stories list:", error);
        container.innerHTML = `<p style="color: red;">Error loading stories library. Did you create stories.json?</p>`;
    }
}

async function openStory(filepath, filetype) {
    const viewer = document.getElementById('viewer-content');
    viewer.innerHTML = '<p class="placeholder-text">Loading story...</p>';
    
    try {
        if (filetype === 'txt') {
            // Fetch and render standard text files directly
            const response = await fetch(filepath);
            if (!response.ok) throw new Error('File not found');
            const text = await response.text();
            
            viewer.innerHTML = `<div class="text-content">${text}</div>`;
            
        } else if (filetype === 'pdf') {
            // Let the browser's native PDF viewer handle it via iframe
            viewer.innerHTML = `<iframe src="${filepath}" class="document-frame"></iframe>`;
            
        } else if (filetype === 'epub') {
            // Browsers cannot natively render EPUB files. 
            // This provides a download link unless you add a library like epub.js later.
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
        viewer.innerHTML = `<p style="color: red;">Failed to open the file. Make sure the file exists in the directory.</p>`;
    }
}