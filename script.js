// APA 7 Citation Generator - Main JavaScript
// Automatic metadata extraction from URLs

// State Management
let currentMetadata = null;
let citationHistory = [];
let metadataExtractor = null;
let selectionMode = false;
let selectedIndices = new Set();
let selectedPdfFile = null;

// DOM Elements
const urlForm = document.getElementById('urlForm');
const urlInput = document.getElementById('urlInput');
const generateBtn = document.getElementById('generateBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const manualEditBtn = document.getElementById('manualEditBtn');

// New PDF & Tab Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const pdfDropzone = document.getElementById('pdfDropzone');
const pdfInput = document.getElementById('pdfInput');
const pdfFileDetails = document.getElementById('pdfFileDetails');
const pdfFileName = document.getElementById('pdfFileName');
const removePdfBtn = document.getElementById('removePdfBtn');
const extractPdfBtn = document.getElementById('extractPdfBtn');
const dropzoneContent = pdfDropzone.querySelector('.dropzone-content');

// Bulk Elements
const bulkUrlInput = document.getElementById('bulkUrlInput');
const processBulkBtn = document.getElementById('processBulkBtn');
const bulkProgress = document.getElementById('bulkProgress');
const bulkProgressBar = document.getElementById('bulkProgressBar');
const bulkStatusText = document.getElementById('bulkStatusText');
const bulkCountText = document.getElementById('bulkCountText');

const metadataPreview = document.getElementById('metadataPreview');
const metadataDisplay = document.getElementById('metadataDisplay');
const editMetadataBtn = document.getElementById('editMetadataBtn');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const modifyBtn = document.getElementById('modifyBtn');

const manualEditForm = document.getElementById('manualEditForm');
const editFormFields = document.getElementById('editFormFields');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const citationOutput = document.getElementById('citationOutput');
const copyBtn = document.getElementById('copyBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const copyAllBtn = document.getElementById('copyAllBtn');
const selectionModeBtn = document.getElementById('selectionModeBtn');
const copySelectedBtn = document.getElementById('copySelectedBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    metadataExtractor = new MetadataExtractor();
    loadHistory();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    urlForm.addEventListener('submit', handleURLSubmit);
    confirmBtn.addEventListener('click', generateCitation);
    cancelBtn.addEventListener('click', resetForm);
    modifyBtn.addEventListener('click', showManualEdit);
    editMetadataBtn.addEventListener('click', showManualEdit);
    manualEditBtn.addEventListener('click', showManualEdit);
    saveEditBtn.addEventListener('click', saveManualEdit);
    cancelEditBtn.addEventListener('click', hideManualEdit);
    copyBtn.addEventListener('click', copyCitation);
    clearHistoryBtn.addEventListener('click', clearHistory);
    copyAllBtn.addEventListener('click', copyAllAlphabetical);
    selectionModeBtn.addEventListener('click', toggleSelectionMode);
    copySelectedBtn.addEventListener('click', copySelectedAlphabetical);

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;
            switchTab(targetId);
        });
    });

    // PDF Upload events
    pdfDropzone.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', handlePdfSelect);
    extractPdfBtn.addEventListener('click', handlePdfExtract);
    removePdfBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPdfInput();
    });

    // Drag and Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        pdfDropzone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        pdfDropzone.addEventListener(eventName, () => pdfDropzone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        pdfDropzone.addEventListener(eventName, () => pdfDropzone.classList.remove('drag-over'), false);
    });

    pdfDropzone.addEventListener('drop', handleDrop, false);

    // Bulk events
    processBulkBtn.addEventListener('click', handleBulkProcess);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Tab Switching
function switchTab(tabId) {
    tabs.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });

    tabContents.forEach(content => {
        if (content.id === `${tabId}Tab`) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });

    // Reset errors when switching
    hideError();
}

// PDF Handlers
function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    validateAndProcessPdf(file);
}

function handlePdfSelect(e) {
    const file = e.target.files[0];
    validateAndProcessPdf(file);
}

function validateAndProcessPdf(file) {
    if (!file || file.type !== 'application/pdf') {
        showToast('Por favor selecciona un archivo PDF válido', 'error');
        return;
    }

    selectedPdfFile = file;
    pdfFileName.textContent = file.name;
    pdfFileDetails.classList.remove('hidden');
    dropzoneContent.classList.add('hidden');
    extractPdfBtn.disabled = false;
}

function resetPdfInput() {
    selectedPdfFile = null;
    pdfInput.value = '';
    pdfFileDetails.classList.add('hidden');
    dropzoneContent.classList.remove('hidden');
    extractPdfBtn.disabled = true;
}

async function handlePdfExtract() {
    if (!selectedPdfFile) return;

    showLoading();
    try {
        currentMetadata = await metadataExtractor.extractMetadata(selectedPdfFile);

        displayMetadataPreview(currentMetadata);
        hideLoading();
        showMetadataPreview();

    } catch (error) {
        console.error('PDF extraction error:', error);
        hideLoading();
        showError(error.message || 'No se pudieron extraer los metadatos del PDF');
    }
}

// Handle URL Form Submission
async function handleURLSubmit(e) {
    e.preventDefault();

    const url = urlInput.value.trim();
    if (!url) return;

    // Show loading state
    showLoading();

    try {
        // Extract metadata
        currentMetadata = await metadataExtractor.extractMetadata(url);

        // Show metadata preview
        displayMetadataPreview(currentMetadata);
        hideLoading();
        showMetadataPreview();

    } catch (error) {
        console.error('Error extracting metadata:', error);
        hideLoading();
        showError(error.message || 'No se pudieron extraer los metadatos del enlace');
    }
}

// Handle Bulk URL / Reference Sorting (Strict Alphabetical Sorter)
async function handleBulkProcess() {
    const content = bulkUrlInput.value.trim();
    if (!content) {
        showToast('Por favor pega tus enlaces o referencias', 'error');
        return;
    }

    // Split by lines, keep original text
    const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

    if (lines.length === 0) return;

    // Strict Alphabetical Sort (A-Z)
    const sortedLines = [...lines].sort((a, b) => {
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    displayBulkResults(sortedLines);
    showToast(`¡Lista ordenada (${sortedLines.length} elementos)!`, 'success');
}

function displayBulkResults(lines) {
    const html = lines.map(line => {
        // Just text, no formatting to avoid "inventing" anything
        return `<div class="citation-text" style="margin-bottom: 0.8rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); word-break: break-all; font-family: monospace; font-size: 0.85rem;">${line}</div>`;
    }).join('');

    const plainTextList = lines.join('\n');

    citationOutput.innerHTML = `
        <div class="bulk-results-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--primary);">
            <span style="color: var(--primary); font-weight: 700;">
                 Detección: ${lines.length} elementos ordenados (A-Z)
            </span>
            <button class="btn-primary btn-sm" id="copyBulkBtn">
                Copiar Lista Exacta
            </button>
        </div>
        <div class="bulk-sorted-list" style="max-height: 400px; overflow-y: auto; padding: 1rem; background: #f8fafc; border-radius: 8px;">
            ${html}
        </div>
    `;
    
    document.getElementById('copyBulkBtn').addEventListener('click', () => {
        // Copy the raw join with single newlines as pasted
        navigator.clipboard.writeText(plainTextList).then(() => {
            showToast('¡Lista copiada al portapapeles!', 'success');
        }).catch(() => {
            showToast('Error al copiar', 'error');
        });
    });
    
    citationOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display Metadata Preview
function displayMetadataPreview(metadata) {
    const items = [];

    // Type
    const typeLabels = {
        'website': 'Sitio Web',
        'youtube': 'Video (YouTube)',
        'video': 'Video',
        'journal': 'Artículo de Revista',
        'article': 'Artículo de Investigación',
        'book': 'Libro / Monografía',
        'doi': 'Publicación Académica',
        'thesis': 'Tesis / Trabajo Académico',
        'report': 'Informe Técnico'
    };
    items.push({ label: 'Tipo', value: typeLabels[metadata.type] || 'Documento Técnico' });

    // Author
    items.push({ label: 'Autor(es)', value: metadata.author || 'Pendiente de identificar' });

    // Date
    items.push({ label: 'Año', value: formatDateDisplay(metadata.date) || 'No especificado' });

    // Title
    items.push({ label: 'Título', value: metadata.title || 'Sin título' });

    // Journal/Source Information
    if (metadata.journalName) {
        items.push({ label: 'Revista', value: metadata.journalName });
    } else if (metadata.siteName) {
        items.push({ label: 'Nombre del sitio', value: metadata.siteName });
    } else if (metadata.publisher) {
        items.push({ label: 'Editorial/Fuente', value: metadata.publisher });
    }

    // Pages
    if (metadata.pages) {
        items.push({ label: 'Páginas', value: metadata.pages });
    }

    // DOI
    if (metadata.doi) {
        items.push({ label: 'DOI', value: metadata.doi });
    }

    // URL (only if not empty)
    if (metadata.url) {
        items.push({ label: 'URL', value: metadata.url });
    }

    // Build HTML
    metadataDisplay.innerHTML = items.map(item => `
        <div class="metadata-item">
            <div class="metadata-label">${item.label}:</div>
            <div class="metadata-value">${item.value}</div>
        </div>
    `).join('');
}

// Format date for display
function formatDateDisplay(date) {
    if (!date || !date.year) return 'No disponible';
    return date.year;
}

// Show Manual Edit Form
function showManualEdit() {
    hideMetadataPreview();
    hideError();

    // Build form based on metadata type
    const fields = buildEditForm(currentMetadata);
    editFormFields.innerHTML = fields;

    manualEditForm.classList.remove('hidden');
}

// Build Edit Form
function buildEditForm(metadata) {
    const type = metadata?.type || 'website';
    let html = '';

    // Common fields
    html += `
        <div class="form-group">
            <label for="edit-author">Autor(es) <span style="color: var(--text-muted);">(Separa múltiples autores con punto y coma)</span></label>
            <input type="text" id="edit-author" value="${metadata?.author || ''}" placeholder="Apellido, I.; Apellido2, I.">
        </div>
        <div class="form-group">
            <label for="edit-year">Año *</label>
            <input type="text" id="edit-year" value="${metadata?.date?.year || ''}" placeholder="2024" required>
        </div>
        <div class="form-group">
            <label for="edit-title">Título *</label>
            <input type="text" id="edit-title" value="${metadata?.title || ''}" placeholder="Título del documento" required>
        </div>
    `;

    // Type-specific fields
    if (type === 'website') {
        html += `
            <div class="form-group">
                <label for="edit-sitename">Nombre del sitio</label>
                <input type="text" id="edit-sitename" value="${metadata?.siteName || ''}" placeholder="Nombre del sitio web">
            </div>
        `;
    }

    if (type === 'video' || type === 'youtube') {
        html += `
            <div class="form-group">
                <label for="edit-platform">Plataforma *</label>
                <input type="text" id="edit-platform" value="${metadata?.platform || 'YouTube'}" placeholder="YouTube" required>
            </div>
        `;
    }

    if (type === 'journal') {
        html += `
            <div class="form-group">
                <label for="edit-journal">Nombre de la revista *</label>
                <input type="text" id="edit-journal" value="${metadata?.journalName || ''}" placeholder="Nombre de la revista" required>
            </div>
            <div class="form-group">
                <label for="edit-volume">Volumen</label>
                <input type="text" id="edit-volume" value="${metadata?.volume || ''}" placeholder="10">
            </div>
            <div class="form-group">
                <label for="edit-issue">Número</label>
                <input type="text" id="edit-issue" value="${metadata?.issue || ''}" placeholder="2">
            </div>
            <div class="form-group">
                <label for="edit-pages">Páginas</label>
                <input type="text" id="edit-pages" value="${metadata?.pages || ''}" placeholder="123-145">
            </div>
            <div class="form-group">
                <label for="edit-doi">DOI</label>
                <input type="text" id="edit-doi" value="${metadata?.doi || ''}" placeholder="https://doi.org/10.xxxx/xxxxx">
            </div>
        `;
    }

    if (type === 'book') {
        html += `
            <div class="form-group">
                <label for="edit-publisher">Editorial *</label>
                <input type="text" id="edit-publisher" value="${metadata?.publisher || ''}" placeholder="Editorial Académica" required>
            </div>
            <div class="form-group">
                <label for="edit-edition">Edición</label>
                <input type="text" id="edit-edition" value="${metadata?.edition || ''}" placeholder="3ª ed.">
            </div>
            <div class="form-group">
                <label for="edit-doi">DOI</label>
                <input type="text" id="edit-doi" value="${metadata?.doi || ''}" placeholder="https://doi.org/10.xxxx/xxxxx">
            </div>
        `;
    }

    // URL (always included)
    html += `
        <div class="form-group">
            <label for="edit-url">URL *</label>
            <input type="url" id="edit-url" value="${metadata?.url || ''}" placeholder="https://ejemplo.com" required>
        </div>
    `;

    return html;
}

// Save Manual Edit
function saveManualEdit() {
    // Get values from form
    const author = document.getElementById('edit-author')?.value.trim() || '';
    const year = document.getElementById('edit-year')?.value.trim() || '';
    const title = document.getElementById('edit-title')?.value.trim() || '';
    const url = document.getElementById('edit-url')?.value.trim() || '';

    if (!year || !title || !url) {
        showToast('Por favor completa los campos requeridos', 'error');
        return;
    }

    // Update metadata
    currentMetadata.author = author;
    currentMetadata.date = { year };
    currentMetadata.title = title;
    currentMetadata.url = url;

    // Type-specific fields
    const type = currentMetadata.type;

    if (type === 'website') {
        currentMetadata.siteName = document.getElementById('edit-sitename')?.value.trim() || '';
    }

    if (type === 'video' || type === 'youtube') {
        currentMetadata.platform = document.getElementById('edit-platform')?.value.trim() || '';
    }

    if (type === 'journal') {
        currentMetadata.journalName = document.getElementById('edit-journal')?.value.trim() || '';
        currentMetadata.volume = document.getElementById('edit-volume')?.value.trim() || '';
        currentMetadata.issue = document.getElementById('edit-issue')?.value.trim() || '';
        currentMetadata.pages = document.getElementById('edit-pages')?.value.trim() || '';
        currentMetadata.doi = document.getElementById('edit-doi')?.value.trim() || '';
    }

    if (type === 'book') {
        currentMetadata.publisher = document.getElementById('edit-publisher')?.value.trim() || '';
        currentMetadata.edition = document.getElementById('edit-edition')?.value.trim() || '';
        currentMetadata.doi = document.getElementById('edit-doi')?.value.trim() || '';
    }

    // Hide edit form and generate citation
    hideManualEdit();
    generateCitation();
}

// Generate Citation from Metadata
function generateCitation() {
    if (!currentMetadata) return;

    let citation = '';

    switch (currentMetadata.type) {
        case 'website':
            citation = generateWebsiteCitation(currentMetadata);
            break;
        case 'youtube':
        case 'video':
            citation = generateVideoCitation(currentMetadata);
            break;
        case 'journal':
            citation = generateJournalCitation(currentMetadata);
            break;
        case 'book':
            citation = generateBookCitation(currentMetadata);
            break;
        default:
            citation = generateWebsiteCitation(currentMetadata);
    }

    if (citation) {
        displayCitation(citation);
        addToHistory(citation);
        hideMetadataPreview();
        showToast('¡Cita generada exitosamente!', 'success');
    }
}

// Generate Website Citation
function generateWebsiteCitation(data) {
    let citation = '';

    // Author
    if (data.author) {
        citation += `${data.author} `;
    }

    // Date
    citation += `(${formatDate(data.date)}). `;

    // Title
    citation += `<em>${toSentenceCase(data.title)}</em>. `;

    // Site name
    if (data.siteName) {
        citation += `${data.siteName}. `;
    }

    // URL
    citation += data.url;

    return citation;
}

// Generate Video Citation
function generateVideoCitation(data) {
    let citation = '';

    // Author/Channel
    if (data.author) {
        citation += `${data.author} `;
    }

    // Date
    citation += `(${formatDate(data.date)}). `;

    // Title
    citation += `<em>${toSentenceCase(data.title)}</em> `;

    // [Video] descriptor
    citation += '[Video]. ';

    // Platform
    if (data.platform) {
        citation += `${data.platform}. `;
    }

    // URL
    citation += data.url;

    return citation;
}

// Generate Journal Citation
function generateJournalCitation(data) {
    let citation = '';

    // Author
    if (data.author) {
        citation += `${data.author} `;
    }

    // Year
    citation += `(${data.date.year}). `;

    // Article title
    citation += `${toSentenceCase(data.title)}. `;

    // Journal name
    if (data.journalName) {
        citation += `<em>${data.journalName}</em>`;
    }

    // Volume
    if (data.volume) {
        citation += `, <em>${data.volume}</em>`;
    }

    // Issue
    if (data.issue) {
        citation += `(${data.issue})`;
    }

    // Pages
    if (data.pages) {
        citation += `, ${data.pages}`;
    }

    citation += '. ';

    // DOI
    if (data.doi) {
        citation += data.doi;
    }

    return citation;
}

// Generate Book Citation
function generateBookCitation(data) {
    let citation = '';

    // Author
    if (data.author) {
        citation += `${data.author} `;
    }

    // Year
    citation += `(${data.date.year}). `;

    // Title
    citation += `<em>${toSentenceCase(data.title)}</em>`;

    // Edition
    if (data.edition) {
        citation += ` (${data.edition})`;
    }

    citation += '. ';

    // Publisher
    if (data.publisher) {
        citation += `${data.publisher}. `;
    }

    // DOI
    if (data.doi) {
        citation += data.doi;
    }

    return citation;
}

// Format Date
function formatDate(date) {
    if (!date) return '';

    // Only return the year
    return date.year || '';
}

// Convert to Sentence Case
// Convert to Sentence Case (APA 7: only first word capitalized)
function toSentenceCase(str) {
    if (!str) return '';
    // If it's mostly uppercase, lowercase it first
    const isMostlyUpper = str.length > 5 && (str.match(/[A-Z]/g) || []).length / str.length > 0.7;
    const text = isMostlyUpper ? str.toLowerCase() : str;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Display Citation
function displayCitation(citation) {
    citationOutput.innerHTML = `
        <div class="citation-text hanging-indent">
            ${citation}
        </div>
    `;
}

// Copy Citation
function copyCitation() {
    const citationText = citationOutput.querySelector('.citation-text');

    if (!citationText) {
        showToast('No hay cita para copiar', 'error');
        return;
    }

    const text = citationText.innerText || citationText.textContent;

    navigator.clipboard.writeText(text).then(() => {
        showToast('¡Cita copiada al portapapeles!', 'success');
    }).catch(() => {
        showToast('Error al copiar la cita', 'error');
    });
}

// History Management
function addToHistory(citation, type = null, shouldRender = true) {
    const historyItem = {
        citation: citation,
        timestamp: new Date().toISOString(),
        type: type || currentMetadata?.type || 'website'
    };

    citationHistory.unshift(historyItem);

    // Limit history, but allow enough for batch processing
    if (citationHistory.length > 50) {
        citationHistory = citationHistory.slice(0, 50);
    }

    saveHistory();
    if (shouldRender) {
        renderHistory();
    }
}

function loadHistory() {
    const saved = localStorage.getItem('citationHistory');
    if (saved) {
        try {
            citationHistory = JSON.parse(saved);
            renderHistory();
        } catch (e) {
            console.error('Error loading history:', e);
            citationHistory = [];
        }
    }
}

function saveHistory() {
    localStorage.setItem('citationHistory', JSON.stringify(citationHistory));
}

function renderHistory() {
    if (citationHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>No hay citas guardadas aún</p>
            </div>
        `;
        copyAllBtn.classList.add('hidden');
        selectionModeBtn.classList.add('hidden');
        return;
    }

    copyAllBtn.classList.remove('hidden');
    selectionModeBtn.classList.remove('hidden');

    historyList.innerHTML = citationHistory.map((item, index) => {
        const isSelected = selectedIndices.has(index);
        return `
            <div class="history-item ${isSelected ? 'selected' : ''}" onclick="handleHistoryItemClick(${index})">
                ${selectionMode ? `
                    <input type="checkbox" class="history-checkbox" ${isSelected ? 'checked' : ''} 
                        onclick="event.stopPropagation(); toggleItemSelection(${index})">
                ` : ''}
                <div class="history-content">
                    ${item.citation}
                </div>
            </div>
        `;
    }).join('');
}

function handleHistoryItemClick(index) {
    if (selectionMode) {
        toggleItemSelection(index);
    } else {
        loadFromHistory(index);
    }
}

function toggleItemSelection(index) {
    if (selectedIndices.has(index)) {
        selectedIndices.delete(index);
    } else {
        selectedIndices.add(index);
    }
    renderHistory();
    updateSelectionUI();
}

function updateSelectionUI() {
    if (selectionMode) {
        copySelectedBtn.classList.remove('hidden');
        copySelectedBtn.textContent = `Copiar seleccionadas (${selectedIndices.size}) (A-Z)`;
        copySelectedBtn.disabled = selectedIndices.size === 0;
    } else {
        copySelectedBtn.classList.add('hidden');
    }
}

function toggleSelectionMode() {
    selectionMode = !selectionMode;
    if (!selectionMode) {
        selectedIndices.clear();
    }
    selectionModeBtn.innerHTML = selectionMode ? `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Cancelar selección
    ` : `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        </svg>
        Seleccionar
    `;
    updateSelectionUI();
    renderHistory();
}

function copyAllAlphabetical() {
    const citations = citationHistory.map(item => item.citation);
    copySortedCitations(citations, '¡Todas las citas copiadas (A-Z)!');
}

function copySelectedAlphabetical() {
    if (selectedIndices.size === 0) return;
    const citations = Array.from(selectedIndices).map(index => citationHistory[index].citation);
    copySortedCitations(citations, `¡${selectedIndices.size} citas copiadas (A-Z)!`);
    toggleSelectionMode(); // Reset selection after copy
}

function copySortedCitations(citations, successMsg) {
    // Sort alphabetically ignoring HTML tags
    const sorted = [...citations].sort((a, b) => {
        const textA = stripHTML(a).toLowerCase();
        const textB = stripHTML(b).toLowerCase();
        return textA.localeCompare(textB);
    });

    const bulkText = sorted.map(c => stripHTML(c)).join('\n\n');

    navigator.clipboard.writeText(bulkText).then(() => {
        showToast(successMsg, 'success');
    }).catch(() => {
        showToast('Error al copiar al portapapeles', 'error');
    });
}

function stripHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

function loadFromHistory(index) {
    const item = citationHistory[index];
    displayCitation(item.citation);
    showToast('Cita cargada desde el historial', 'success');
}

function clearHistory() {
    if (confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
        citationHistory = [];
        saveHistory();
        renderHistory();
        showToast('Historial borrado', 'success');
    }
}

// UI State Management
function showLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    metadataPreview.classList.add('hidden');
}

function hideLoading() {
    loadingState.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
    loadingState.classList.add('hidden');
    metadataPreview.classList.add('hidden');
}

function hideError() {
    errorState.classList.add('hidden');
}

function showMetadataPreview() {
    metadataPreview.classList.remove('hidden');
}

function hideMetadataPreview() {
    metadataPreview.classList.add('hidden');
}

function hideManualEdit() {
    manualEditForm.classList.add('hidden');
}

function resetForm() {
    urlForm.reset();
    currentMetadata = null;
    resetPdfInput();
    hideMetadataPreview();
    hideManualEdit();
    hideError();
    hideLoading();
}

// Toast Notification
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make loadFromHistory globally accessible
window.loadFromHistory = loadFromHistory;
