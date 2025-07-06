// Core classes (same as popup.js)
class SiteInfoProvider {
    async getSiteInfo(url) {
        throw new Error('getSiteInfo must be implemented');
    }
    
    async addSiteInfo(url, companyId, info) {
        throw new Error('addSiteInfo must be implemented');
    }
    
    async updateSiteInfo(companyId, info) {
        throw new Error('updateSiteInfo must be implemented');
    }
    
    async deleteSiteInfo(companyId) {
        throw new Error('deleteSiteInfo must be implemented');
    }
    
    async getAllSites() {
        throw new Error('getAllSites must be implemented');
    }
}

class CompanyData {
    constructor(data = {}) {
        this.company_name = data.company_name || '';
        this.sus_rating = data.sus_rating || 1;
        this.description = data.description || '';
        this.alternative_links = data.alternative_links || [];
        this.date_added = data.date_added || new Date().toISOString();
        this.user_added = data.user_added || false;
        this.origin = data.origin || (data.user_added ? 'user' : 'susradar');
        this.is_modified = data.is_modified || false;
        this.original_data = data.original_data || null;
    }
    
    isValid() {
        return this.company_name.trim() !== '' && 
               this.sus_rating >= 1 && 
               this.sus_rating <= 5;
    }
    
    getOriginLabel() {
        if (this.origin === 'user') return '👤 User Created';
        if (this.is_modified) return '✏️ Modified SusRadar';
        return '🚨 SusRadar Original';
    }
    
    canReset() {
        return this.origin === 'susradar' && this.is_modified && this.original_data;
    }
}

class LocalStorageProvider extends SiteInfoProvider {
    constructor() {
        super();
        this.STORAGE_KEY = 'susradar_data';
    }
    
    async _getData() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([this.STORAGE_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('SusRadar: Storage get error:', chrome.runtime.lastError);
                        resolve({
                            url_mappings: {},
                            company_data: {}
                        });
                        return;
                    }
                    const data = result[this.STORAGE_KEY] || {
                        url_mappings: {},
                        company_data: {}
                    };
                    resolve(data);
                });
            } catch (error) {
                console.error('SusRadar: Storage access error:', error);
                resolve({
                    url_mappings: {},
                    company_data: {}
                });
            }
        });
    }
    
    async _saveData(data) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({[this.STORAGE_KEY]: data}, () => {
                    if (chrome.runtime.lastError) {
                        console.error('SusRadar: Storage set error:', chrome.runtime.lastError);
                    }
                    resolve();
                });
            } catch (error) {
                console.error('SusRadar: Storage save error:', error);
                resolve();
            }
        });
    }
    
    async getAllSites() {
        const data = await this._getData();
        return {
            mappings: data.url_mappings,
            companies: data.company_data
        };
    }
    
    async updateSiteInfo(companyId, info) {
        const data = await this._getData();
        
        if (data.company_data[companyId]) {
            data.company_data[companyId] = new CompanyData(info);
            await this._saveData(data);
            return true;
        }
        return false;
    }
    
    async deleteSiteInfo(companyId) {
        const data = await this._getData();
        
        delete data.company_data[companyId];
        
        Object.keys(data.url_mappings).forEach(url => {
            if (data.url_mappings[url] === companyId) {
                delete data.url_mappings[url];
            }
        });
        
        await this._saveData(data);
        return true;
    }
}

// Global variables
let siteInfoProvider = new LocalStorageProvider();
let allEntries = [];
let filteredEntries = [];
let focusedCompanyId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Check for focus parameter
    const urlParams = new URLSearchParams(window.location.search);
    focusedCompanyId = urlParams.get('focus');
    
    await loadAllEntries();
    setupSearch();
    
    // Scroll to focused entry if specified (called after render is complete)
    if (focusedCompanyId) {
        highlightFocusedEntry();
    }
});

async function loadAllEntries() {
    try {
        const data = await siteInfoProvider.getAllSites();
        allEntries = [];

        Object.entries(data.companies).forEach(([companyId, company]) => {
            const urls = Object.keys(data.mappings).filter(url => data.mappings[url] === companyId);
            allEntries.push({
                id: companyId,
                company: new CompanyData(company),
                urls: urls
            });
        });

        filteredEntries = [...allEntries];
        renderEntries();
        updateStats();
    } catch (error) {
        console.error('Error loading entries:', error);
        document.getElementById('entriesContainer').innerHTML = '<p>Error loading data. Please reload the page.</p>';
    }
}

function renderEntries() {
    const container = document.getElementById('entriesContainer');
    const noEntries = document.getElementById('noEntries');

    if (filteredEntries.length === 0) {
        container.style.display = 'none';
        noEntries.style.display = 'block';
        return;
    }

    container.style.display = 'grid';
    noEntries.style.display = 'none';

    container.innerHTML = filteredEntries.map(entry => {
        const company = entry.company;
        const urls = entry.urls;
        const isFocused = focusedCompanyId === entry.id;

        return `
            <div class="entry-card ${isFocused ? 'focused' : ''}" data-company-id="${entry.id}">
                <div class="entry-header">
                    <div class="header-left">
                        <h3 class="company-name">${company.company_name}</h3>
                        <div class="origin-badge">${company.getOriginLabel()}</div>
                    </div>
                    <div class="header-right">
                        <div class="sus-rating sus-rating-${company.sus_rating}">
                            ${company.sus_rating}/5 Sus
                        </div>
                        <div class="entry-actions">
                            <button class="action-btn edit-btn" data-action="edit" data-company-id="${entry.id}" title="Edit Entry">✏️</button>
                            ${company.canReset() ? `<button class="action-btn reset-btn" data-action="reset" data-company-id="${entry.id}" title="Reset to Original">🔄</button>` : ''}
                            <button class="action-btn add-url-btn" data-action="addurl" data-company-id="${entry.id}" title="Add URL">🔗</button>
                            <button class="action-btn delete-btn" data-action="delete" data-company-id="${entry.id}" title="Delete Entry">🗑️</button>
                        </div>
                    </div>
                </div>
                
                <div class="description">${company.description}</div>
                
                <div class="urls">
                    <h4>📍 Tracked URLs:</h4>
                    <div class="url-list">
                        ${urls.map(url => `
                            <span class="url-tag">
                                ${url}
                                ${urls.length > 1 ? `<button class="url-delete-btn" data-url="${url}" data-company-id="${entry.id}" title="Remove URL">✕</button>` : ''}
                            </span>
                        `).join('')}
                    </div>
                </div>
                
                ${company.alternative_links && company.alternative_links.length > 0 ? `
                    <div class="alternatives">
                        <h4>🌟 Better Alternatives:</h4>
                        <div class="alternatives-list">
                            ${company.alternative_links.map(link => 
                                `<a href="${link}" target="_blank" class="alternative-link">${new URL(link).hostname}</a>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    // Attach event listeners to action buttons
    attachActionListeners();
}

function attachActionListeners() {
    document.querySelectorAll('.action-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.getAttribute('data-action');
            const companyId = button.getAttribute('data-company-id');
            
            switch(action) {
                case 'edit':
                    editEntry(companyId);
                    break;
                case 'reset':
                    resetEntry(companyId);
                    break;
                case 'addurl':
                    addUrlToEntry(companyId);
                    break;
                case 'delete':
                    deleteEntry(companyId);
                    break;
            }
        });
    });
    
    // Add event listeners for URL delete buttons
    document.querySelectorAll('.url-delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const url = button.getAttribute('data-url');
            const companyId = button.getAttribute('data-company-id');
            removeUrlFromEntry(companyId, url);
        });
    });
}

function setupSearch() {
    const searchBox = document.getElementById('searchBox');
    
    searchBox.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            filteredEntries = [...allEntries];
        } else {
            filteredEntries = allEntries.filter(entry => {
                const company = entry.company;
                const urls = entry.urls;
                
                return (
                    company.company_name.toLowerCase().includes(query) ||
                    company.description.toLowerCase().includes(query) ||
                    urls.some(url => url.toLowerCase().includes(query)) ||
                    (company.alternative_links && company.alternative_links.some(link => 
                        link.toLowerCase().includes(query)
                    ))
                );
            });
        }
        
        renderEntries();
        updateStats();
    });
}

function updateStats() {
    const entryCount = document.getElementById('entryCount');
    const filterStatus = document.getElementById('filterStatus');
    
    entryCount.textContent = `${filteredEntries.length} of ${allEntries.length} companies`;
    
    if (filteredEntries.length !== allEntries.length) {
        filterStatus.textContent = `Filtered results`;
        filterStatus.style.color = '#FFC107';
    } else {
        filterStatus.textContent = '';
    }
}

function highlightFocusedEntry() {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
        setTimeout(() => {
            const focusedCard = document.querySelector(`[data-company-id="${focusedCompanyId}"]`);
            if (focusedCard) {
                focusedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add temporary highlight effect
                focusedCard.style.animation = 'highlightPulse 2s ease-in-out';
                setTimeout(() => {
                    focusedCard.style.animation = '';
                }, 2000);
                console.log('SusRadar: Successfully highlighted focused entry:', focusedCompanyId);
            } else {
                console.log('SusRadar: Focus card not found for ID:', focusedCompanyId);
                console.log('SusRadar: Available cards:', Array.from(document.querySelectorAll('[data-company-id]')).map(el => el.getAttribute('data-company-id')));
            }
        }, 100);
    });
}

// Management functions
let currentEditingCompanyId = null;
let originalCompanyData = null;

async function editEntry(companyId) {
    const entry = allEntries.find(e => e.id === companyId);
    if (!entry) return;
    
    currentEditingCompanyId = companyId;
    const company = entry.company;
    originalCompanyData = company.original_data;
    
    // Populate the modal form
    document.getElementById('modalTitle').textContent = `Edit ${company.company_name}`;
    document.getElementById('editCompanyName').value = company.company_name;
    document.getElementById('editSusRating').value = company.sus_rating;
    document.getElementById('editDescription').value = company.description;
    document.getElementById('editAlternatives').value = company.alternative_links.join('\n');
    
    // Update field origins and reset buttons
    updateFieldOrigins(company);
    
    // Update rating display
    updateEditRatingDisplay();
    
    // Show the modal
    document.getElementById('editModal').style.display = 'flex';
    
    // Auto-resize textareas on open
    setTimeout(() => {
        autoResize({ target: document.getElementById('editDescription') });
        autoResize({ target: document.getElementById('editAlternatives') });
        document.getElementById('editCompanyName').focus();
    }, 100);
}

function updateFieldOrigins(company) {
    const hasOriginal = company.origin === 'susradar' && company.original_data;
    
    // Update origin badges and reset buttons
    updateFieldOrigin('nameOrigin', 'resetName', company.origin, hasOriginal, 'name');
    updateFieldOrigin('ratingOrigin', 'resetRating', company.origin, hasOriginal, 'rating');
    updateFieldOrigin('descOrigin', 'resetDesc', company.origin, hasOriginal, 'description');
    updateFieldOrigin('altOrigin', 'resetAlt', company.origin, hasOriginal, 'alternatives');
    
    // Show reset all button if there's original data
    const resetAllBtn = document.getElementById('resetAllBtn');
    if (hasOriginal && company.is_modified) {
        resetAllBtn.style.display = 'block';
    } else {
        resetAllBtn.style.display = 'none';
    }
}

function updateFieldOrigin(originId, resetId, origin, hasOriginal, fieldName) {
    const originEl = document.getElementById(originId);
    const resetEl = document.getElementById(resetId);
    
    if (origin === 'user') {
        originEl.textContent = '👤 User Created';
        originEl.className = 'field-origin user';
        resetEl.style.display = 'none';
    } else if (hasOriginal) {
        // Check if this specific field is actually different from original
        const isFieldModified = checkFieldModified(fieldName);
        if (isFieldModified) {
            originEl.textContent = '✏️ Modified SusRadar';
            originEl.className = 'field-origin modified';
            resetEl.style.display = 'flex';
        } else {
            originEl.textContent = '🚨 SusRadar Original';
            originEl.className = 'field-origin susradar';
            resetEl.style.display = 'none';
        }
    } else {
        originEl.textContent = '🚨 SusRadar Original';
        originEl.className = 'field-origin susradar';
        resetEl.style.display = 'none';
    }
}

function checkFieldModified(fieldName) {
    if (!originalCompanyData) return false;
    
    const currentEntry = allEntries.find(e => e.id === currentEditingCompanyId);
    if (!currentEntry) return false;
    
    const current = currentEntry.company;
    
    switch(fieldName) {
        case 'name':
            return current.company_name !== originalCompanyData.company_name;
        case 'rating':
            return current.sus_rating !== originalCompanyData.sus_rating;
        case 'description':
            return current.description !== originalCompanyData.description;
        case 'alternatives':
            return JSON.stringify(current.alternative_links) !== JSON.stringify(originalCompanyData.alternative_links);
        default:
            return false;
    }
}

function checkCurrentFormFieldModified(fieldName) {
    if (!originalCompanyData) return false;
    
    // Check against current form values instead of stored data
    switch(fieldName) {
        case 'name':
            const currentName = document.getElementById('editCompanyName').value.trim();
            return currentName !== originalCompanyData.company_name;
        case 'rating':
            const currentRating = parseInt(document.getElementById('editSusRating').value);
            return currentRating !== originalCompanyData.sus_rating;
        case 'description':
            const currentDesc = document.getElementById('editDescription').value.trim();
            return currentDesc !== originalCompanyData.description;
        case 'alternatives':
            const currentAlts = document.getElementById('editAlternatives').value
                .split('\n')
                .map(link => link.trim())
                .filter(link => link.length > 0);
            return JSON.stringify(currentAlts) !== JSON.stringify(originalCompanyData.alternative_links);
        default:
            return false;
    }
}

function updateFieldIndicators() {
    if (!originalCompanyData) return;
    
    const entry = allEntries.find(e => e.id === currentEditingCompanyId);
    if (!entry) return;
    
    const hasOriginal = entry.company.origin === 'susradar' && originalCompanyData;
    
    if (hasOriginal) {
        // Update each field indicator based on current form values
        updateFieldIndicator('nameOrigin', 'resetName', 'name');
        updateFieldIndicator('ratingOrigin', 'resetRating', 'rating');
        updateFieldIndicator('descOrigin', 'resetDesc', 'description');
        updateFieldIndicator('altOrigin', 'resetAlt', 'alternatives');
        
        // Update reset all button
        const anyFieldModified = ['name', 'rating', 'description', 'alternatives'].some(field => 
            checkCurrentFormFieldModified(field)
        );
        const resetAllBtn = document.getElementById('resetAllBtn');
        resetAllBtn.style.display = anyFieldModified ? 'block' : 'none';
    }
}

function updateFieldIndicator(originId, resetId, fieldName) {
    const originEl = document.getElementById(originId);
    const resetEl = document.getElementById(resetId);
    
    const isFieldModified = checkCurrentFormFieldModified(fieldName);
    if (isFieldModified) {
        originEl.textContent = '✏️ Modified SusRadar';
        originEl.className = 'field-origin modified';
        resetEl.style.display = 'flex';
    } else {
        originEl.textContent = '🚨 SusRadar Original';
        originEl.className = 'field-origin susradar';
        resetEl.style.display = 'none';
    }
}

function resetField(fieldType) {
    if (!originalCompanyData) return;
    
    switch(fieldType) {
        case 'name':
            document.getElementById('editCompanyName').value = originalCompanyData.company_name;
            break;
        case 'rating':
            document.getElementById('editSusRating').value = originalCompanyData.sus_rating;
            updateEditRatingDisplay();
            break;
        case 'description':
            document.getElementById('editDescription').value = originalCompanyData.description;
            autoResize({ target: document.getElementById('editDescription') });
            break;
        case 'alternatives':
            document.getElementById('editAlternatives').value = originalCompanyData.alternative_links.join('\n');
            autoResize({ target: document.getElementById('editAlternatives') });
            break;
    }
    
    // Update field indicators after reset
    updateFieldIndicators();
}

function resetAllFields() {
    if (!originalCompanyData) return;
    
    if (confirm('Reset all fields to original SusRadar values?')) {
        document.getElementById('editCompanyName').value = originalCompanyData.company_name;
        document.getElementById('editSusRating').value = originalCompanyData.sus_rating;
        document.getElementById('editDescription').value = originalCompanyData.description;
        document.getElementById('editAlternatives').value = originalCompanyData.alternative_links.join('\n');
        updateEditRatingDisplay();
        
        // Auto-resize textareas after reset
        autoResize({ target: document.getElementById('editDescription') });
        autoResize({ target: document.getElementById('editAlternatives') });
        
        // Update all field indicators
        updateFieldIndicators();
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditingCompanyId = null;
    document.getElementById('editForm').reset();
}

function updateEditRatingDisplay() {
    const rating = document.getElementById('editSusRating').value;
    document.getElementById('editRatingDisplay').textContent = rating;
}

function autoResize(event) {
    const textarea = event.target;
    
    // Reset height to auto to get the actual scroll height
    textarea.style.height = 'auto';
    
    // Calculate the required height
    const scrollHeight = textarea.scrollHeight;
    const minHeight = parseInt(getComputedStyle(textarea).minHeight, 10) || 80;
    
    // Set the height to either scroll height or minimum height, whichever is larger
    textarea.style.height = Math.max(scrollHeight + 4, minHeight) + 'px';
}

// Setup form handlers
document.addEventListener('DOMContentLoaded', () => {
    // Rating slider handler
    document.getElementById('editSusRating').addEventListener('input', updateEditRatingDisplay);
    
    // Form submission handler
    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEditForm();
    });
    
    // Cancel button handler
    document.getElementById('cancelBtn').addEventListener('click', closeEditModal);
    
    // Close modal when clicking outside
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeEditModal();
        }
    });
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('editModal').style.display === 'flex') {
            closeEditModal();
        }
    });
    
    // Field reset handlers
    document.getElementById('resetName').addEventListener('click', () => resetField('name'));
    document.getElementById('resetRating').addEventListener('click', () => resetField('rating'));
    document.getElementById('resetDesc').addEventListener('click', () => resetField('description'));
    document.getElementById('resetAlt').addEventListener('click', () => resetField('alternatives'));
    document.getElementById('resetAllBtn').addEventListener('click', resetAllFields);
    
    // Auto-resize textareas
    document.getElementById('editDescription').addEventListener('input', autoResize);
    document.getElementById('editAlternatives').addEventListener('input', autoResize);
    
    // Real-time field modification detection
    document.getElementById('editCompanyName').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editSusRating').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editDescription').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editAlternatives').addEventListener('input', () => updateFieldIndicators());
});

async function saveEditForm() {
    if (!currentEditingCompanyId) return;
    
    const entry = allEntries.find(e => e.id === currentEditingCompanyId);
    if (!entry) return;
    
    const company = entry.company;
    
    // Get form values
    const newName = document.getElementById('editCompanyName').value.trim();
    const newRating = parseInt(document.getElementById('editSusRating').value);
    const newDescription = document.getElementById('editDescription').value.trim();
    const newAlternatives = document.getElementById('editAlternatives').value
        .split('\n')
        .map(link => link.trim())
        .filter(link => link.length > 0);
    
    // Validation
    if (!newName) {
        alert('Company name is required');
        return;
    }
    
    if (isNaN(newRating) || newRating < 1 || newRating > 5) {
        alert('Please enter a valid rating between 1 and 5');
        return;
    }
    
    // Check if this is modifying an original SusRadar entry for the first time
    const isModifyingOriginal = company.origin === 'susradar' && !company.is_modified;
    
    // Determine if the current values differ from original values
    let isCurrentlyModified = false;
    let originalData = company.original_data;
    
    if (company.origin === 'susradar') {
        // If this is the first modification, store the current values as original
        if (isModifyingOriginal) {
            originalData = {
                company_name: company.company_name,
                sus_rating: company.sus_rating,
                description: company.description,
                alternative_links: company.alternative_links
            };
        }
        
        // Check if new values differ from original values
        if (originalData) {
            isCurrentlyModified = (
                newName !== originalData.company_name ||
                newRating !== originalData.sus_rating ||
                newDescription !== originalData.description ||
                JSON.stringify(newAlternatives) !== JSON.stringify(originalData.alternative_links)
            );
        }
    }
    
    const updatedInfo = {
        company_name: newName,
        sus_rating: newRating,
        description: newDescription,
        alternative_links: newAlternatives,
        date_added: company.date_added,
        user_added: company.user_added,
        origin: company.origin,
        is_modified: company.origin === 'susradar' ? isCurrentlyModified : false,
        original_data: company.origin === 'susradar' ? originalData : null
    };
    
    try {
        await siteInfoProvider.updateSiteInfo(currentEditingCompanyId, updatedInfo);
        await loadAllEntries();
        closeEditModal();
        
        // Show success message briefly
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Entry updated successfully!';
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => {
            successMsg.remove();
        }, 3000);
        
    } catch (error) {
        console.error('Error updating entry:', error);
        alert('Error updating entry. Please try again.');
    }
}

async function resetEntry(companyId) {
    const entry = allEntries.find(e => e.id === companyId);
    if (!entry || !entry.company.canReset()) return;
    
    if (!confirm(`Reset "${entry.company.company_name}" to original SusRadar version?`)) return;
    
    const originalData = entry.company.original_data;
    const resetInfo = {
        company_name: originalData.company_name,
        sus_rating: originalData.sus_rating,
        description: originalData.description,
        alternative_links: originalData.alternative_links,
        date_added: entry.company.date_added,
        user_added: false,
        origin: 'susradar',
        is_modified: false,
        original_data: null
    };
    
    try {
        await siteInfoProvider.updateSiteInfo(companyId, resetInfo);
        await loadAllEntries();
        alert('Entry reset to original version!');
    } catch (error) {
        console.error('Error resetting entry:', error);
        alert('Error resetting entry. Please try again.');
    }
}

async function deleteEntry(companyId) {
    const entry = allEntries.find(e => e.id === companyId);
    if (!entry) return;
    
    if (!confirm(`Delete "${entry.company.company_name}" from radar? This will remove all associated URLs.`)) return;
    
    try {
        await siteInfoProvider.deleteSiteInfo(companyId);
        await loadAllEntries();
        alert('Entry deleted successfully!');
    } catch (error) {
        console.error('Error deleting entry:', error);
        alert('Error deleting entry. Please try again.');
    }
}

async function addUrlToEntry(companyId) {
    const entry = allEntries.find(e => e.id === companyId);
    if (!entry) return;
    
    const newUrl = prompt(`Add a new URL to track for "${entry.company.company_name}":\n\nExample: facebook.com or https://www.facebook.com`);
    if (!newUrl || newUrl.trim() === '') return;
    
    const cleanedUrl = newUrl.trim();
    
    try {
        // Check if URL is already tracked
        const data = await siteInfoProvider.getAllSites();
        const existingCompanyId = Object.values(data.mappings).find(id => {
            return Object.keys(data.mappings).some(url => 
                data.mappings[url] === id && url.toLowerCase() === cleanedUrl.toLowerCase()
            );
        });
        
        if (existingCompanyId) {
            const existingCompany = data.companies[existingCompanyId];
            alert(`This URL is already tracked for "${existingCompany.company_name}"`);
            return;
        }
        
        // Add the URL mapping to the existing company
        const currentData = await siteInfoProvider._getData();
        currentData.url_mappings[cleanedUrl] = companyId;
        await siteInfoProvider._saveData(currentData);
        
        // Reload entries to show the new URL
        await loadAllEntries();
        alert(`URL "${cleanedUrl}" has been added to ${entry.company.company_name}`);
        
    } catch (error) {
        console.error('Error adding URL:', error);
        alert('Error adding URL. Please try again.');
    }
}

async function removeUrlFromEntry(companyId, urlToRemove) {
    const entry = allEntries.find(e => e.id === companyId);
    if (!entry) return;
    
    // Check if this is the last URL for this company
    const currentUrls = entry.urls;
    if (currentUrls.length <= 1) {
        alert(`Cannot remove "${urlToRemove}" as it's the only URL for ${entry.company.company_name}. Each company must have at least one URL.`);
        return;
    }
    
    if (!confirm(`Remove "${urlToRemove}" from ${entry.company.company_name}?`)) return;
    
    try {
        // Remove the URL mapping
        const currentData = await siteInfoProvider._getData();
        delete currentData.url_mappings[urlToRemove];
        await siteInfoProvider._saveData(currentData);
        
        // Reload entries to show the updated URL list
        await loadAllEntries();
        alert(`URL "${urlToRemove}" has been removed from ${entry.company.company_name}`);
        
    } catch (error) {
        console.error('Error removing URL:', error);
        alert('Error removing URL. Please try again.');
    }
}