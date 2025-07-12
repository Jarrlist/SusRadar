// SusRadar All Entries Management
// Uses shared modules: common.js and ui-components.js

// Global variables
let siteInfoProvider = null;
let allEntries = [];
let filteredEntries = [];
let focusedCompanyId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize provider
    await initializeProvider();
    
    // Check for focus parameter
    const urlParams = new URLSearchParams(window.location.search);
    focusedCompanyId = urlParams.get('focus');
    
    await loadAllEntries();
    setupSearch();
    setupBackupRestore();
    
    // Scroll to focused entry if specified (called after render is complete)
    if (focusedCompanyId) {
        highlightFocusedEntry();
    }
});

async function initializeProvider() {
    try {
        const settings = await chrome.storage.local.get(['susradar_token', 'susradar_server_url']);
        
        if (settings.susradar_token && settings.susradar_server_url) {
            console.log('All Entries: Using server provider');
            siteInfoProvider = new ServerProvider(settings.susradar_server_url);
        } else {
            console.log('All Entries: Using local storage provider');
            siteInfoProvider = new LocalStorageProvider();
        }
    } catch (error) {
        console.warn('All Entries: Error checking server settings, falling back to local storage:', error);
        siteInfoProvider = new LocalStorageProvider();
    }
}

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
                
                ${SusRadarUI.createDescriptionContainer(company, {
                  tabClass: 'entry-desc-tab',
                  contentClass: 'entry-desc-content',
                  idPrefix: entry.id,
                  maxLength: null,
                  containerClass: 'entry-description-container',
                  tabsContainerClass: 'entry-description-tabs'
                })}
                
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
                
                ${SusRadarUI.createAlternativesSection(company, Infinity).replace('Better Companies:', 'Better Alternatives:').replace('susradar-alternatives', 'alternatives').replace(/<ul>/, '<div class="alternatives-list">').replace(/<\/ul>/, '</div>').replace(/<li><a/g, '<a').replace(/<\/a><\/li>/g, '</a>').replace(/class="more-alternatives"[^>]*>.*?<\/li>/g, '').replace(/class="alternative-link"/g, 'class="alternative-link"')}
            </div>
        `;
    }).join('');
    
    // Attach event listeners to action buttons
    attachActionListeners();
    
    // Attach event listeners to description tabs
    attachDescriptionTabListeners();
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

function attachDescriptionTabListeners() {
    document.querySelectorAll('.entry-desc-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!tab.disabled && !tab.classList.contains('disabled')) {
                const category = tab.getAttribute('data-category');
                const companyId = tab.getAttribute('data-company-id');
                switchEntryDescriptionTab(category, companyId);
            }
        });
    });
}

function switchEntryDescriptionTab(category, companyId) {
    SusRadarUI.switchEntryDescriptionTab(category, companyId);
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
    document.getElementById('editDefaultDesc').value = company.default_description || 'usability';
    document.getElementById('editUsabilityDesc').value = company.descriptions.usability;
    document.getElementById('editCustomerDesc').value = company.descriptions.customer;
    document.getElementById('editPoliticalDesc').value = company.descriptions.political;
    document.getElementById('editAlternatives').value = company.alternative_links.join('\n');
    
    // Update field origins and reset buttons
    updateFieldOrigins(company);
    
    // Update rating display
    updateEditRatingDisplay();
    
    // Show the modal
    document.getElementById('editModal').style.display = 'flex';
    
    // Auto-resize textareas on open
    setTimeout(() => {
        autoResize({ target: document.getElementById('editUsabilityDesc') });
        autoResize({ target: document.getElementById('editCustomerDesc') });
        autoResize({ target: document.getElementById('editPoliticalDesc') });
        autoResize({ target: document.getElementById('editAlternatives') });
        document.getElementById('editCompanyName').focus();
    }, 100);
}

function updateFieldOrigins(company) {
    const hasOriginal = company.origin === 'susradar' && company.original_data;
    
    // Update origin badges and reset buttons
    updateFieldOrigin('nameOrigin', 'resetName', company.origin, hasOriginal, 'name');
    updateFieldOrigin('ratingOrigin', 'resetRating', company.origin, hasOriginal, 'rating');
    updateFieldOrigin('defaultDescOrigin', 'resetDefaultDesc', company.origin, hasOriginal, 'defaultDesc');
    updateFieldOrigin('usabilityOrigin', 'resetUsability', company.origin, hasOriginal, 'usability');
    updateFieldOrigin('customerOrigin', 'resetCustomer', company.origin, hasOriginal, 'customer');
    updateFieldOrigin('politicalOrigin', 'resetPolitical', company.origin, hasOriginal, 'political');
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
        case 'defaultDesc':
            return current.default_description !== (originalCompanyData.default_description || 'usability');
        case 'usability':
            return current.descriptions.usability !== (originalCompanyData.descriptions ? originalCompanyData.descriptions.usability : originalCompanyData.description || '');
        case 'customer':
            return current.descriptions.customer !== (originalCompanyData.descriptions ? originalCompanyData.descriptions.customer : '');
        case 'political':
            return current.descriptions.political !== (originalCompanyData.descriptions ? originalCompanyData.descriptions.political : '');
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
        case 'defaultDesc':
            const currentDefaultDesc = document.getElementById('editDefaultDesc').value;
            return currentDefaultDesc !== (originalCompanyData.default_description || 'usability');
        case 'usability':
            const currentUsability = document.getElementById('editUsabilityDesc').value.trim();
            return currentUsability !== (originalCompanyData.descriptions ? originalCompanyData.descriptions.usability : originalCompanyData.description || '');
        case 'customer':
            const currentCustomer = document.getElementById('editCustomerDesc').value.trim();
            return currentCustomer !== (originalCompanyData.descriptions ? originalCompanyData.descriptions.customer : '');
        case 'political':
            const currentPolitical = document.getElementById('editPoliticalDesc').value.trim();
            return currentPolitical !== (originalCompanyData.descriptions ? originalCompanyData.descriptions.political : '');
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
        updateFieldIndicator('defaultDescOrigin', 'resetDefaultDesc', 'defaultDesc');
        updateFieldIndicator('usabilityOrigin', 'resetUsability', 'usability');
        updateFieldIndicator('customerOrigin', 'resetCustomer', 'customer');
        updateFieldIndicator('politicalOrigin', 'resetPolitical', 'political');
        updateFieldIndicator('altOrigin', 'resetAlt', 'alternatives');
        
        // Update reset all button
        const anyFieldModified = ['name', 'rating', 'defaultDesc', 'usability', 'customer', 'political', 'alternatives'].some(field => 
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
        case 'defaultDesc':
            document.getElementById('editDefaultDesc').value = originalCompanyData.default_description || 'usability';
            break;
        case 'usability':
            document.getElementById('editUsabilityDesc').value = originalCompanyData.descriptions ? originalCompanyData.descriptions.usability : originalCompanyData.description || '';
            autoResize({ target: document.getElementById('editUsabilityDesc') });
            break;
        case 'customer':
            document.getElementById('editCustomerDesc').value = originalCompanyData.descriptions ? originalCompanyData.descriptions.customer : '';
            autoResize({ target: document.getElementById('editCustomerDesc') });
            break;
        case 'political':
            document.getElementById('editPoliticalDesc').value = originalCompanyData.descriptions ? originalCompanyData.descriptions.political : '';
            autoResize({ target: document.getElementById('editPoliticalDesc') });
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
        document.getElementById('editDefaultDesc').value = originalCompanyData.default_description || 'usability';
        document.getElementById('editUsabilityDesc').value = originalCompanyData.descriptions ? originalCompanyData.descriptions.usability : originalCompanyData.description || '';
        document.getElementById('editCustomerDesc').value = originalCompanyData.descriptions ? originalCompanyData.descriptions.customer : '';
        document.getElementById('editPoliticalDesc').value = originalCompanyData.descriptions ? originalCompanyData.descriptions.political : '';
        document.getElementById('editAlternatives').value = originalCompanyData.alternative_links.join('\n');
        updateEditRatingDisplay();
        
        // Auto-resize textareas after reset
        autoResize({ target: document.getElementById('editUsabilityDesc') });
        autoResize({ target: document.getElementById('editCustomerDesc') });
        autoResize({ target: document.getElementById('editPoliticalDesc') });
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
    SusRadarUI.updateRatingDisplay(document);
}

function autoResize(event) {
    SusRadarUI.autoResize(event);
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
    document.getElementById('resetDefaultDesc').addEventListener('click', () => resetField('defaultDesc'));
    document.getElementById('resetUsability').addEventListener('click', () => resetField('usability'));
    document.getElementById('resetCustomer').addEventListener('click', () => resetField('customer'));
    document.getElementById('resetPolitical').addEventListener('click', () => resetField('political'));
    document.getElementById('resetAlt').addEventListener('click', () => resetField('alternatives'));
    document.getElementById('resetAllBtn').addEventListener('click', resetAllFields);
    
    // Auto-resize textareas
    document.getElementById('editUsabilityDesc').addEventListener('input', autoResize);
    document.getElementById('editCustomerDesc').addEventListener('input', autoResize);
    document.getElementById('editPoliticalDesc').addEventListener('input', autoResize);
    document.getElementById('editAlternatives').addEventListener('input', autoResize);
    
    // Real-time field modification detection
    document.getElementById('editCompanyName').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editSusRating').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editDefaultDesc').addEventListener('change', () => updateFieldIndicators());
    document.getElementById('editUsabilityDesc').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editCustomerDesc').addEventListener('input', () => updateFieldIndicators());
    document.getElementById('editPoliticalDesc').addEventListener('input', () => updateFieldIndicators());
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
    const newDefaultDesc = document.getElementById('editDefaultDesc').value;
    const newUsabilityDesc = document.getElementById('editUsabilityDesc').value.trim();
    const newCustomerDesc = document.getElementById('editCustomerDesc').value.trim();
    const newPoliticalDesc = document.getElementById('editPoliticalDesc').value.trim();
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
                descriptions: {
                    usability: company.descriptions.usability,
                    customer: company.descriptions.customer,
                    political: company.descriptions.political
                },
                description: company.description,
                alternative_links: company.alternative_links
            };
        }
        
        // Check if new values differ from original values
        if (originalData) {
            const originalUsability = originalData.descriptions ? originalData.descriptions.usability : originalData.description || '';
            const originalCustomer = originalData.descriptions ? originalData.descriptions.customer : '';
            const originalPolitical = originalData.descriptions ? originalData.descriptions.political : '';
            
            isCurrentlyModified = (
                newName !== originalData.company_name ||
                newRating !== originalData.sus_rating ||
                newDefaultDesc !== (originalData.default_description || 'usability') ||
                newUsabilityDesc !== originalUsability ||
                newCustomerDesc !== originalCustomer ||
                newPoliticalDesc !== originalPolitical ||
                JSON.stringify(newAlternatives) !== JSON.stringify(originalData.alternative_links)
            );
        }
    }
    
    const updatedInfo = {
        company_name: newName,
        sus_rating: newRating,
        descriptions: {
            usability: newUsabilityDesc,
            customer: newCustomerDesc,
            political: newPoliticalDesc
        },
        default_description: newDefaultDesc,
        description: newUsabilityDesc, // Keep for backward compatibility
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
        descriptions: originalData.descriptions || {
            usability: originalData.description || '',
            customer: '',
            political: ''
        },
        description: originalData.description || '',
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

// Backup and Restore Functionality
function setupBackupRestore() {
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const restoreFileInput = document.getElementById('restoreFileInput');

    // Backup functionality
    backupBtn.addEventListener('click', async () => {
        await exportEntries();
    });

    // Restore functionality
    restoreBtn.addEventListener('click', () => {
        restoreFileInput.click();
    });

    restoreFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            await importEntries(file);
            // Reset the input so the same file can be selected again
            event.target.value = '';
        }
    });
}

async function exportEntries() {
    try {
        console.log('SusRadar: Starting backup export...');
        
        // Get all current data
        const data = await siteInfoProvider.getAllSites();
        
        // Create backup object with metadata
        const backup = {
            metadata: {
                exportedAt: new Date().toISOString(),
                version: "1.0",
                extensionName: "SusRadar",
                totalCompanies: Object.keys(data.companies).length,
                totalUrls: Object.keys(data.mappings).length
            },
            data: {
                url_mappings: data.mappings,
                company_data: data.companies
            }
        };

        // Create filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const filename = `susradar-backup-${timestamp}.json`;

        // Convert to JSON with nice formatting
        const jsonString = JSON.stringify(backup, null, 2);
        
        // Create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`SusRadar: Backup exported successfully as ${filename}`);
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.innerHTML = `
            <strong>✅ Backup Created!</strong><br>
            <small>Exported ${backup.metadata.totalCompanies} companies and ${backup.metadata.totalUrls} URLs</small>
        `;
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => {
            successMsg.remove();
        }, 4000);
        
    } catch (error) {
        console.error('SusRadar: Backup export failed:', error);
        alert('Failed to export backup. Please try again.');
    }
}

async function importEntries(file) {
    try {
        console.log('SusRadar: Starting backup import...');
        
        // Read file
        const text = await file.text();
        const backup = JSON.parse(text);
        
        // Validate backup structure
        if (!backup.data || !backup.data.company_data || !backup.data.url_mappings) {
            throw new Error('Invalid backup file format');
        }
        
        // Show confirmation dialog with backup info
        const metadata = backup.metadata || {};
        const companyCount = Object.keys(backup.data.company_data).length;
        const urlCount = Object.keys(backup.data.url_mappings).length;
        const exportDate = metadata.exportedAt ? new Date(metadata.exportedAt).toLocaleString() : 'Unknown';
        
        const confirmMessage = `Import SusRadar backup?

📊 Backup Info:
• ${companyCount} companies
• ${urlCount} URLs  
• Exported: ${exportDate}

⚠️ Warning: This will REPLACE all current entries!
Your existing data will be permanently lost.

Do you want to continue?`;

        if (!confirm(confirmMessage)) {
            console.log('SusRadar: Import cancelled by user');
            return;
        }
        
        // Import the data
        await siteInfoProvider._saveData(backup.data);
        
        console.log(`SusRadar: Import completed - ${companyCount} companies, ${urlCount} URLs`);
        
        // Reload the page to show imported data
        await loadAllEntries();
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.innerHTML = `
            <strong>✅ Backup Restored!</strong><br>
            <small>Imported ${companyCount} companies and ${urlCount} URLs</small>
        `;
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => {
            successMsg.remove();
        }, 4000);
        
    } catch (error) {
        console.error('SusRadar: Import failed:', error);
        
        let errorMessage = 'Failed to import backup.';
        if (error.message.includes('JSON')) {
            errorMessage = 'Invalid JSON file. Please select a valid SusRadar backup file.';
        } else if (error.message.includes('Invalid backup')) {
            errorMessage = 'Invalid backup file format. Please select a valid SusRadar backup file.';
        }
        
        alert(errorMessage + '\n\nPlease try again with a valid backup file.');
    }
}