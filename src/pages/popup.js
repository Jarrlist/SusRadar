// SusRadar Popup Script  
// Uses shared modules: common.js and ui-components.js (loaded via popup.html)

// Popup-specific variables
let siteInfoProvider = null;
let dropdownComponent = null;

async function initializeProvider() {
    try {
        const settings = await chrome.storage.local.get(['susradar_token', 'susradar_server_url']);
        
        if (settings.susradar_token && settings.susradar_server_url) {
            console.log('Popup: Using server provider');
            siteInfoProvider = new ServerProvider(settings.susradar_server_url);
        } else {
            console.log('Popup: Using local storage provider');
            siteInfoProvider = new LocalStorageProvider();
        }
    } catch (error) {
        console.warn('Popup: Error checking server settings, falling back to local storage:', error);
        siteInfoProvider = new LocalStorageProvider();
    }
}

async function getCurrentTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs[0]);
        });
    });
}

async function loadCurrentSiteInfo() {
    try {
        const tab = await getCurrentTab();
        const currentUrl = tab.url;
        
        const currentSiteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
        
        // Use the unified dropdown component
        const container = document.getElementById('popup-dropdown');
        dropdownComponent = new SusRadarDropdown(container, true);
        
        // Set the current hostname for the popup
        try {
            dropdownComponent.currentHostname = new URL(currentUrl).hostname;
        } catch (e) {
            dropdownComponent.currentHostname = 'Current Site';
        }
        
        dropdownComponent.render(currentSiteInfo);
    } catch (error) {
        console.error('SusRadar Popup: Error loading site info:', error);
        // Show fallback content
        const container = document.getElementById('popup-dropdown');
        container.innerHTML = '<p>Error loading SusRadar. Please reload the extension.</p>';
    }
}

async function initializeData() {
    const data = await siteInfoProvider.getAllSites();
    if (Object.keys(data.companies).length === 0) {
        console.log('SusRadar: Loading initial data...');
        await SusRadarUtils.initializeDefaultData(siteInfoProvider);
    }
}

// Enhanced Popup Dropdown Component
class SusRadarDropdown {
  constructor(container, isPopup = false) {
    this.container = container;
    this.isPopup = isPopup;
    this.currentSiteInfo = null;
    this.currentHostname = 'Current Site';
  }

  createHTML(siteInfo) {
    const isTracked = !!siteInfo;
    
    return `
      <div class="susradar-header">
        <h3 class="susradar-company-name">${isTracked ? siteInfo.company_name : this.currentHostname}</h3>
        ${SusRadarUI.createControlButtons(isTracked, { showAllEntries: !isTracked })}
      </div>
      
      <div class="site-content">
        ${isTracked ? this.createTrackedContent(siteInfo) : this.createNotTrackedContent()}
      </div>
      
      <div class="form-container" id="addSiteForm" style="display: none;">
        ${this.createFormHTML()}
      </div>
    `;
  }

  createTrackedContent(siteInfo) {
    return `
      <div class="susradar-origin-info">
        <span class="origin-label">${siteInfo.getOriginLabel()}</span>
      </div>
      
      ${SusRadarUI.createRatingDisplay(siteInfo)}
      
      ${SusRadarUI.createDescriptionContainer(siteInfo, {
        tabClass: 'desc-tab',
        contentClass: 'desc-content',
        maxLength: 120
      })}
      
      ${SusRadarUI.createAlternativesSection(siteInfo, 3)}
      
      <div class="susradar-manage-hint">
        <p>Click ⚙️ to edit or manage this entry</p>
      </div>
    `;
  }

  createNotTrackedContent() {
    return `
      <div class="not-tracked-message">
        <p>🔍 Site not tracked yet</p>
        <p>Click ➕ to add to radar!</p>
      </div>
    `;
  }

  createFormHTML() {
    return `
      <h3>Add Site to Radar</h3>
      <form id="siteForm">
        <div class="form-group">
          <label for="companyNameInput">Company Name:</label>
          <input type="text" id="companyNameInput" required>
        </div>
        
        <div class="form-group">
          <label for="susRating">Sus Rating (1-5):</label>
          ${SusRadarUI.createRatingSlider(3)}
        </div>
        
        <div class="form-group">
          <label>Description Categories:</label>
          ${SusRadarUI.createFormDescriptionTabs()}
          ${SusRadarUI.createFormDescriptionContent()}
        </div>
        
        <div class="form-group">
          <label for="alternativeLinks">Alternative Links (one per line):</label>
          <textarea id="alternativeLinks" rows="2" placeholder="https://better-alternative.com"></textarea>
        </div>
        
        <div class="form-group">
          <label for="additionalUrls">Additional URLs for this company:</label>
          <textarea id="additionalUrls" rows="2" placeholder="https://another-site.com (optional)"></textarea>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" class="cancel-btn btn btn-secondary">Cancel</button>
        </div>
      </form>
    `;
  }

  render(siteInfo) {
    this.currentSiteInfo = siteInfo;
    this.container.innerHTML = this.createHTML(siteInfo);
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Control buttons
    const addBtn = this.container.querySelector('.add-btn');
    const manageBtn = this.container.querySelector('.manage-btn');
    const allEntriesBtn = this.container.querySelector('.all-entries-btn');
    const closeBtn = this.container.querySelector('.susradar-close');

    if (addBtn) addBtn.addEventListener('click', () => this.showAddForm());
    if (manageBtn) manageBtn.addEventListener('click', () => this.openManagePage());
    if (allEntriesBtn) allEntriesBtn.addEventListener('click', () => this.showAllSites());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Form buttons
    const form = this.container.querySelector('#siteForm');
    const cancelBtn = this.container.querySelector('.cancel-btn');
    const ratingSlider = this.container.querySelector('#susRating');

    if (form) form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideForm());
    if (ratingSlider) ratingSlider.addEventListener('input', () => SusRadarUI.updateRatingDisplay(this.container));

    // Description tab switching (both viewing and form tabs)
    SusRadarUI.attachDescriptionTabListeners(this.container);
    SusRadarUI.attachFormDescriptionTabListeners(this.container);

    // Auto-resize textareas
    this.container.querySelectorAll('textarea').forEach(textarea => {
      textarea.addEventListener('input', SusRadarUI.autoResize);
    });

    // Initial rating display
    SusRadarUI.updateRatingDisplay(this.container);
  }

  showAddForm() {
    this.container.querySelector('.site-content').style.display = 'none';
    this.container.querySelector('#addSiteForm').style.display = 'block';
  }

  async openManagePage() {
    // Open the management page (all-entries) with focus on current site
    const currentUrl = await this.getCurrentUrl();
    const companyId = SusRadarUtils.generateCompanyId(this.currentSiteInfo.company_name);
    SusRadarUI.openAllEntries(companyId);
  }

  async showAllSites() {
    // Open the all-entries page in a new tab
    SusRadarUI.openAllEntries();
  }

  hideForm() {
    this.container.querySelector('.site-content').style.display = 'block';
    this.container.querySelector('#addSiteForm').style.display = 'none';
    
    const form = this.container.querySelector('#siteForm');
    if (form) form.reset();
    SusRadarUI.updateRatingDisplay(this.container);
  }

  async getCurrentUrl() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0].url);
      });
    });
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const companyName = this.container.querySelector('#companyNameInput').value;
    const susRating = parseInt(this.container.querySelector('#susRating').value);
    
    // Get multi-category descriptions using shared utility
    const { usabilityDesc, customerDesc, politicalDesc } = SusRadarForms.getDescriptionValues(this.container);
    
    const alternativeLinks = this.container.querySelector('#alternativeLinks').value
      .split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0);
    const additionalUrls = this.container.querySelector('#additionalUrls').value
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    const companyId = SusRadarUtils.generateCompanyId(companyName);
    const currentUrl = await this.getCurrentUrl();
    
    // Check if this is editing an existing SusRadar entry
    const existingSiteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
    
    const formData = {
      companyName,
      susRating,
      usabilityDesc,
      customerDesc,
      politicalDesc,
      alternativeLinks
    };
    
    try {
      SusRadarForms.validateFormData(formData);
      
      const siteInfo = SusRadarForms.createSiteInfoObject(formData, existingSiteInfo);
      
      await siteInfoProvider.addSiteInfo(currentUrl, companyId, siteInfo);
      
      for (const url of additionalUrls) {
        await siteInfoProvider.addSiteInfo(url, companyId, siteInfo);
      }
      
      this.hideForm();
      
      // Refresh the content
      const updatedSiteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
      this.render(updatedSiteInfo);
      
      // Reload current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.reload(tabs[0].id);
      });
      
    } catch (error) {
      console.error('Error saving site info:', error);
      alert('Error saving site information. Please try again.');
    }
  }

  close() {
    window.close();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('SusRadar Popup: Initializing...');
        await initializeProvider();
        await initializeData();
        await loadCurrentSiteInfo();
    } catch (error) {
        console.error('SusRadar Popup: Initialization error:', error);
    }
});