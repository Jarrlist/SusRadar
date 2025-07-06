let susRadarDropdown = null;
let siteInfoProvider = null;
let isInitialized = false;

// SusRadar Content Script
// Uses shared modules: common.js and ui-components.js (loaded via manifest.json)

function initializeProviders() {
  console.log('SusRadar: Initializing providers...');
  siteInfoProvider = new LocalStorageProvider();
  isInitialized = true;
  console.log('SusRadar: Providers initialized successfully');
  // Check site after initialization
  setTimeout(checkCurrentSite, 500);
}

async function checkCurrentSite() {
  if (!siteInfoProvider || !isInitialized) {
    console.log('SusRadar: Provider not initialized yet');
    return;
  }
  
  const currentUrl = window.location.href;
  console.log('SusRadar: Checking site:', currentUrl);
  
  try {
    // Debug the URL cleaning process
    const urlObj = new URL(currentUrl);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    console.log('SusRadar: Cleaned hostname:', hostname);
    
    const siteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
    console.log('SusRadar: Site info result:', siteInfo);
    
    if (siteInfo) {
      console.log('SusRadar: Showing dropdown for:', siteInfo.company_name);
      showSusRadarDropdown(siteInfo);
    } else {
      console.log('SusRadar: No info found for site');
      hideSusRadarDropdown();
    }
  } catch (error) {
    console.error('SusRadar: Error checking site:', error);
  }
}

// Unified Dropdown Component
class SusRadarDropdown {
  constructor(container, isPopup = false) {
    this.container = container;
    this.isPopup = isPopup;
    this.currentSiteInfo = null;
  }

  createHTML(siteInfo) {
    const isTracked = !!siteInfo;
    
    return `
      <div class="susradar-header">
        <h3 class="susradar-company-name">${isTracked ? siteInfo.company_name : SusRadarUtils.getHostname()}</h3>
        ${SusRadarUI.createControlButtons(isTracked, { showAllEntries: true })}
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
  }

  showAddForm() {
    this.container.querySelector('.site-content').style.display = 'none';
    this.container.querySelector('#addSiteForm').style.display = 'block';
  }

  async openManagePage() {
    const companyId = SusRadarUtils.generateCompanyId(this.currentSiteInfo.company_name);
    SusRadarUI.openAllEntries(companyId);
  }

  async showAllSites() {
    SusRadarUI.openAllEntries();
  }

  hideForm() {
    this.container.querySelector('.site-content').style.display = 'block';
    this.container.querySelector('#addSiteForm').style.display = 'none';
    
    const form = this.container.querySelector('#siteForm');
    if (form) form.reset();
    SusRadarUI.updateRatingDisplay(this.container);
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const companyName = this.container.querySelector('#companyNameInput').value;
    const susRating = parseInt(this.container.querySelector('#susRating').value);
    
    // Get multi-category descriptions
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
    const currentUrl = window.location.href;
    
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
      
      SusRadarUI.showSuccessMessage('Site added to radar!');
      
    } catch (error) {
      console.error('Error saving site info:', error);
      alert('Error saving site information. Please try again.');
    }
  }

  close() {
    hideSusRadarDropdown();
  }
}

function showSusRadarDropdown(siteInfo) {
  // Remove any existing dropdown
  hideSusRadarDropdown();
  
  // Create dropdown container
  const dropdown = document.createElement('div');
  dropdown.id = 'susradar-dropdown';
  dropdown.className = 'susradar-dropdown';
  
  // Create a unique z-index that's higher than most website elements
  const zIndex = Math.max(
    ...Array.from(document.querySelectorAll('*'))
      .map(el => parseInt(window.getComputedStyle(el).zIndex) || 0)
      .filter(z => !isNaN(z))
  ) + 1000;
  
  // Apply CSS with high specificity - start with initial animation state
  dropdown.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: ${zIndex} !important;
    width: 350px !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border-radius: 15px !important;
    border: 2px solid rgba(255, 255, 255, 0.2) !important;
    color: white !important;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(102, 126, 234, 0.4) !important;
    backdrop-filter: blur(10px) !important;
    transform: translateX(100%) !important;
    opacity: 0 !important;
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    pointer-events: auto !important;
    max-height: 80vh !important;
    overflow-y: auto !important;
    padding: 20px !important;
    display: block !important;
    visibility: visible !important;
  `;
  
  // Inject additional CSS to ensure description tabs work properly
  if (!document.getElementById('susradar-dynamic-styles')) {
    const style = document.createElement('style');
    style.id = 'susradar-dynamic-styles';
    style.textContent = `
      #susradar-dropdown .description-tabs {
        display: flex !important;
        gap: 5px !important;
        margin-bottom: 10px !important;
        justify-content: center !important;
      }
      #susradar-dropdown .desc-tab {
        background: rgba(255, 255, 255, 0.1) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        color: white !important;
        width: 35px !important;
        height: 35px !important;
        border-radius: 8px !important;
        font-size: 16px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #susradar-dropdown .desc-tab:hover {
        background: rgba(255, 255, 255, 0.2) !important;
        transform: scale(1.05) !important;
      }
      #susradar-dropdown .desc-tab.active {
        background: rgba(255, 193, 7, 0.3) !important;
        border-color: #FFC107 !important;
        box-shadow: 0 0 8px rgba(255, 193, 7, 0.4) !important;
      }
      #susradar-dropdown .desc-tab.disabled {
        background: rgba(255, 255, 255, 0.05) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
        color: rgba(255, 255, 255, 0.3) !important;
        cursor: not-allowed !important;
        opacity: 0.5 !important;
      }
      #susradar-dropdown .desc-tab.disabled:hover {
        background: rgba(255, 255, 255, 0.05) !important;
        transform: none !important;
      }
      #susradar-dropdown .description-content {
        position: relative !important;
        min-height: 60px !important;
      }
      #susradar-dropdown .desc-content {
        display: none !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        background: rgba(255, 255, 255, 0.1) !important;
        padding: 10px !important;
        border-radius: 8px !important;
        border-left: 4px solid #FFC107 !important;
      }
      #susradar-dropdown .desc-content.active {
        display: block !important;
      }
      #susradar-dropdown .control-buttons {
        display: flex !important;
        gap: 5px !important;
        margin-left: 10px !important;
        flex-wrap: wrap !important;
        align-items: center !important;
      }
      #susradar-dropdown .control-btn {
        background: rgba(255, 255, 255, 0.2) !important;
        border: none !important;
        color: white !important;
        width: 25px !important;
        height: 25px !important;
        border-radius: 50% !important;
        font-size: 12px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #susradar-dropdown .control-btn:hover {
        background: rgba(255, 255, 255, 0.3) !important;
        transform: scale(1.1) !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(dropdown);
  
  // Initialize dropdown component
  susRadarDropdown = new SusRadarDropdown(dropdown, false);
  susRadarDropdown.render(siteInfo);
  
  // Force a reflow to ensure the initial state is applied, then trigger animation
  dropdown.offsetHeight; // Force reflow
  
  // Use a small timeout to ensure the element is fully in the DOM
  setTimeout(() => {
    dropdown.style.setProperty('transform', 'translateX(0)', 'important');
    dropdown.style.setProperty('opacity', '1', 'important');
    console.log('SusRadar: Swooping animation triggered');
    
    // Add click-outside-to-close functionality
    addClickOutsideListener();
  }, 50);
}

function hideSusRadarDropdown() {
  const existingDropdown = document.getElementById('susradar-dropdown');
  if (existingDropdown) {
    existingDropdown.style.setProperty('transform', 'translateX(100%)', 'important');
    existingDropdown.style.setProperty('opacity', '0', 'important');
    setTimeout(() => {
      existingDropdown.remove();
    }, 400); // Match the animation duration
  }
  
  // Remove click-outside listener
  removeClickOutsideListener();
  susRadarDropdown = null;
}

// Click-outside-to-close functionality
let clickOutsideHandler = null;

function addClickOutsideListener() {
  // Remove any existing listener first
  removeClickOutsideListener();
  
  clickOutsideHandler = function(event) {
    const dropdown = document.getElementById('susradar-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
      console.log('SusRadar: Clicked outside dropdown, hiding...');
      hideSusRadarDropdown();
    }
  };
  
  // Use capture phase to ensure we catch the event before it's handled by other scripts
  document.addEventListener('click', clickOutsideHandler, true);
}

function removeClickOutsideListener() {
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler, true);
    clickOutsideHandler = null;
  }
}

async function initializeData() {
  const data = await siteInfoProvider.getAllSites();
  console.log('SusRadar: Current data:', data);
  if (Object.keys(data.companies).length === 0) {
    console.log('SusRadar: Loading initial data...');
    await SusRadarUtils.initializeDefaultData(siteInfoProvider);
    const newData = await siteInfoProvider.getAllSites();
    console.log('SusRadar: Data after initialization:', newData);
  } else {
    console.log('SusRadar: Data already exists, companies:', Object.keys(data.companies));
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    initializeProviders();
    await initializeData();
  });
} else {
  // DOM already loaded
  setTimeout(async () => {
    initializeProviders();
    await initializeData();
  }, 100);
}

// Monitor for URL changes (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(checkCurrentSite, 1000);
  }
}).observe(document, { subtree: true, childList: true });