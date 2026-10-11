if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const loaderContainer = document.getElementById('loaderContainer');
const resultSection = document.getElementById('resultSection');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

let currentOriginalFile = null;
let currentSuggestedName = '';

// Load history on page load
document.addEventListener('DOMContentLoaded', loadHistory);

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

resetBtn.addEventListener('click', () => {
    resultSection.style.display = 'none';
    dropZone.style.display = 'block';
    fileInput.value = '';
    currentOriginalFile = null;
});

// Download button logic
downloadBtn.addEventListener('click', () => {
    if (!currentOriginalFile || !currentSuggestedName) return;

    const url = URL.createObjectURL(currentOriginalFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentSuggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('organizerHistory');
    loadHistory();
});

async function handleFile(file) {
    currentOriginalFile = file;
    dropZone.style.display = 'none';
    loaderContainer.style.display = 'block';

    let extractedText = '';

    try {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                extractedText += textContent.items.map(item => item.str).join(' ') + ' ';
            }
        } else if (file.name.endsWith('.docx') && window.mammoth) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            extractedText = result.value;
        } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.js') || file.name.endsWith('.json')) {
            extractedText = await file.text();
        }
    } catch (readErr) {
        console.warn('Text extraction skipped, organizing by file metadata:', readErr);
    }

    try {
        const response = await fetch('/api/organize-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type || file.name.split('.').pop(),
                fileContent: extractedText.trim()
            })
        });

        const data = await response.json();
        loaderContainer.style.display = 'none';

        if (data.success && data.analysis) {
            currentSuggestedName = data.analysis.suggestedFileName || file.name;
            displayResults(file.name, data.analysis);
            saveToHistory(file.name, data.analysis);
        } else {
            alert(data.error || 'Failed to organize file.');
            dropZone.style.display = 'block';
        }
    } catch (apiErr) {
        loaderContainer.style.display = 'none';
        alert('Server connection error. Please verify server.js is running.');
        dropZone.style.display = 'block';
    }
}

function displayResults(origName, analysis) {
    document.getElementById('originalName').textContent = origName;
    document.getElementById('suggestedName').textContent = analysis.suggestedFileName || origName;
    document.getElementById('categoryResult').textContent = analysis.category || 'General';
    document.getElementById('summaryResult').textContent = analysis.summary || 'No summary available.';
    document.getElementById('priorityBadge').textContent = analysis.priority || 'Medium';

    const tagList = document.getElementById('tagList');
    tagList.innerHTML = '';
    if (analysis.tags && Array.isArray(analysis.tags)) {
        analysis.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag-item';
            span.textContent = `#${tag}`;
            tagList.appendChild(span);
        });
    }

    resultSection.style.display = 'block';
}

function saveToHistory(origName, analysis) {
    let history = JSON.parse(localStorage.getItem('organizerHistory') || '[]');
    history.unshift({
        originalName: origName,
        suggestedName: analysis.suggestedFileName || origName,
        category: analysis.category || 'General',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    // Keep max 10 records
    history = history.slice(0, 10);
    localStorage.setItem('organizerHistory', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('organizerHistory') || '[]');
    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history">No files organized yet.</p>';
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-details">
                <strong>${item.suggestedName}</strong>
                <small>Original: ${item.originalName} • ${item.timestamp}</small>
            </div>
            <span class="history-category">${item.category}</span>
        `;
        historyList.appendChild(div);
    });
}