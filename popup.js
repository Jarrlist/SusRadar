let siteInfoProvider = null;
let currentUrl = '';
let currentSiteInfo = null;

function initializeProvider() {
    siteInfoProvider = new LocalStorageProvider();
}

async function getCurrentTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs[0]);
        });
    });
}

function showSiteInfo(siteInfo) {
    document.getElementById('companyName').textContent = siteInfo.company_name;
    
    // Show rating section
    const ratingSection = document.getElementById('ratingSection');
    const ratingFill = document.getElementById('ratingFill');
    const ratingDial = document.getElementById('ratingDial');
    
    ratingSection.style.display = 'block';
    ratingFill.style.width = `${(siteInfo.sus_rating / 5) * 100}%`;
    ratingDial.style.left = `${(siteInfo.sus_rating / 5) * 100}%`;
    
    // Show description
    const descriptionEl = document.getElementById('description');
    descriptionEl.innerHTML = siteInfo.description;
    descriptionEl.style.display = 'block';
    
    // Show alternatives
    const alternativesEl = document.getElementById('alternatives');
    const alternativesList = document.getElementById('alternativesList');
    
    if (siteInfo.alternative_links && siteInfo.alternative_links.length > 0) {
        alternativesList.innerHTML = '';
        siteInfo.alternative_links.forEach(link => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${link}" target="_blank">${link}</a>`;
            alternativesList.appendChild(li);
        });
        alternativesEl.style.display = 'block';
    } else {
        alternativesEl.style.display = 'none';
    }
    
    // Hide not tracked message
    document.getElementById('notTrackedMessage').style.display = 'none';
    
    // Show edit/remove buttons
    document.getElementById('editBtn').style.display = 'block';
    document.getElementById('removeBtn').style.display = 'block';
    document.getElementById('addBtn').style.display = 'none';
}

function showNotTracked() {
    const tab = document.getElementById('companyName');
    try {
        const url = new URL(currentUrl);
        tab.textContent = url.hostname;
    } catch (e) {
        tab.textContent = 'Current Site';
    }
    
    // Hide all site info sections
    document.getElementById('ratingSection').style.display = 'none';
    document.getElementById('description').style.display = 'none';
    document.getElementById('alternatives').style.display = 'none';
    
    // Show not tracked message
    document.getElementById('notTrackedMessage').style.display = 'block';
    
    // Show add button, hide edit/remove
    document.getElementById('addBtn').style.display = 'block';
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('removeBtn').style.display = 'none';
}

async function loadCurrentSiteInfo() {
    const tab = await getCurrentTab();
    currentUrl = tab.url;
    
    currentSiteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
    
    if (currentSiteInfo) {
        showSiteInfo(currentSiteInfo);
    } else {
        showNotTracked();
    }
}

function showAddSiteForm() {
    document.getElementById('siteContent').style.display = 'none';
    document.getElementById('addSiteForm').style.display = 'block';
    
    // If editing, fill form with current data
    if (currentSiteInfo) {
        document.getElementById('companyNameInput').value = currentSiteInfo.company_name;
        document.getElementById('susRating').value = currentSiteInfo.sus_rating;
        document.getElementById('descriptionInput').value = currentSiteInfo.description;
        document.getElementById('alternativeLinks').value = currentSiteInfo.alternative_links.join('\n');
        updateRatingDisplay();
    }
}

function hideAddSiteForm() {
    document.getElementById('siteContent').style.display = 'block';
    document.getElementById('addSiteForm').style.display = 'none';
    document.getElementById('allSitesView').style.display = 'none';
    
    // Reset form
    document.getElementById('siteForm').reset();
    document.getElementById('ratingDisplay').textContent = '3';
}

function updateRatingDisplay() {
    const rating = document.getElementById('susRating').value;
    document.getElementById('ratingDisplay').textContent = rating;
}

function generateCompanyId(companyName) {
    return companyName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const companyName = document.getElementById('companyNameInput').value;
    const susRating = parseInt(document.getElementById('susRating').value);
    const description = document.getElementById('descriptionInput').value;
    const alternativeLinks = document.getElementById('alternativeLinks').value
        .split('\n')
        .map(link => link.trim())
        .filter(link => link.length > 0);
    const additionalUrls = document.getElementById('additionalUrls').value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    const companyId = generateCompanyId(companyName);
    
    const siteInfo = {
        company_name: companyName,
        sus_rating: susRating,
        description: description,
        alternative_links: alternativeLinks,
        date_added: new Date().toISOString(),
        user_added: true
    };
    
    try {
        await siteInfoProvider.addSiteInfo(currentUrl, companyId, siteInfo);
        
        // Add additional URLs
        for (const url of additionalUrls) {
            await siteInfoProvider.addSiteInfo(url, companyId, siteInfo);
        }
        
        hideAddSiteForm();
        await loadCurrentSiteInfo();
        
        // Reload the current tab to update content script
        chrome.tabs.reload();
        
    } catch (error) {
        console.error('Error saving site info:', error);
        alert('Error saving site information. Please try again.');
    }
}

async function handleRemoveSite() {
    if (!currentSiteInfo) return;
    
    if (confirm(`Remove ${currentSiteInfo.company_name} from radar?`)) {
        try {
            const companyId = generateCompanyId(currentSiteInfo.company_name);
            await siteInfoProvider.deleteSiteInfo(companyId);
            
            await loadCurrentSiteInfo();
            chrome.tabs.reload();
            
        } catch (error) {
            console.error('Error removing site:', error);
            alert('Error removing site. Please try again.');
        }
    }
}

async function showAllSites() {
    const data = await siteInfoProvider.getAllSites();
    const companiesObj = data.companies;
    const mappingsObj = data.mappings;
    
    const listEl = document.getElementById('allSitesList');
    listEl.innerHTML = '';
    
    if (Object.keys(companiesObj).length === 0) {
        listEl.innerHTML = '<p>No sites tracked yet.</p>';
    } else {
        Object.entries(companiesObj).forEach(([companyId, company]) => {
            const urls = Object.keys(mappingsObj).filter(url => mappingsObj[url] === companyId);
            
            const entryEl = document.createElement('div');
            entryEl.className = 'site-entry';
            entryEl.innerHTML = `
                <h4>${company.company_name}</h4>
                <div class="rating rating-${company.sus_rating}">Sus Rating: ${company.sus_rating}/5</div>
                <div class="urls">URLs: ${urls.join(', ')}</div>
                <div class="description">${company.description}</div>
            `;
            listEl.appendChild(entryEl);
        });
    }
    
    document.getElementById('siteContent').style.display = 'none';
    document.getElementById('allSitesView').style.display = 'block';
}

async function initializeData() {
    const data = await siteInfoProvider.getAllSites();
    if (Object.keys(data.companies).length === 0) {
        for (const [url, companyId] of Object.entries(INITIAL_DATA.url_mappings)) {
            await siteInfoProvider.addSiteInfo(url, companyId, INITIAL_DATA.company_data[companyId]);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initializeProvider();
    await initializeData();
    await loadCurrentSiteInfo();
    
    // Button event listeners
    document.getElementById('addBtn').addEventListener('click', showAddSiteForm);
    document.getElementById('editBtn').addEventListener('click', showAddSiteForm);
    document.getElementById('removeBtn').addEventListener('click', handleRemoveSite);
    document.getElementById('viewAllBtn').addEventListener('click', showAllSites);
    
    // Form event listeners
    document.getElementById('cancelForm').addEventListener('click', hideAddSiteForm);
    document.getElementById('backToMain').addEventListener('click', hideAddSiteForm);
    document.getElementById('siteForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('susRating').addEventListener('input', updateRatingDisplay);
    
    updateRatingDisplay();
});