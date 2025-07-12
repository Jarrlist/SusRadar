let susRadarDropdown = null;
let siteInfoProvider = null;
let isInitialized = false;
let searchResultsProcessed = false;

// SusRadar Content Script
// Uses shared modules: common.js and ui-components.js (loaded via manifest.json)

async function initializeProviders() {
  console.log('SusRadar: Initializing providers...');
  
  // Check if server is configured and user is authenticated
  try {
    const settings = await chrome.storage.local.get(['susradar_token', 'susradar_server_url']);
    
    if (settings.susradar_token && settings.susradar_server_url) {
      console.log('SusRadar: Using server provider');
      siteInfoProvider = new ServerProvider(settings.susradar_server_url);
    } else {
      console.log('SusRadar: Using local storage provider');
      siteInfoProvider = new LocalStorageProvider();
    }
  } catch (error) {
    console.warn('SusRadar: Error checking server settings, falling back to local storage:', error);
    siteInfoProvider = new LocalStorageProvider();
  }
  
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

// Search Results Scanning Functionality
const SearchEngines = {
  google: {
    hostname: 'google.com',
    selectors: {
      resultContainers: '.g, .MjjYud',
      primaryLinkSelectors: '.yuRUbf a, h3 a, .LC20lb',
      excludeSelectors: 'a[href*="google.com"], a[href*="accounts.google"], a[href*="support.google"], a[href*="policies.google"], a[href*="webcache.googleusercontent"], a[href^="#"], a[href^="javascript:"], a[href^="mailto:"]'
    }
  },
  bing: {
    hostname: 'bing.com',
    selectors: {
      resultContainers: '.b_algo, .b_ans',
      primaryLinkSelectors: 'h2 a, .b_title a',
      excludeSelectors: 'a[href*="bing.com"], a[href*="microsoft.com"], a[href^="#"], a[href^="javascript:"], a[href^="mailto:"]'
    }
  },
  duckduckgo: {
    hostname: 'duckduckgo.com',
    selectors: {
      resultContainers: 'article[data-testid="result"], .result, .web-result',
      primaryLinkSelectors: 'h2 a, .result__title a, [data-testid="result-title-a"]',
      excludeSelectors: 'a[href*="duckduckgo.com"], a[href^="#"], a[href^="javascript:"], a[href^="mailto:"]'
    }
  }
};

function isSearchResultsPage() {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  
  // Check for Google
  if (hostname.includes('google.') && (pathname.includes('/search') || search.includes('q='))) {
    return SearchEngines.google;
  }
  
  // Check for Bing
  if (hostname.includes('bing.com') && (pathname.includes('/search') || search.includes('q='))) {
    return SearchEngines.bing;
  }
  
  // Check for DuckDuckGo
  if (hostname.includes('duckduckgo.com') && search.includes('q=')) {
    return SearchEngines.duckduckgo;
  }
  
  return null;
}

async function scanSearchResults() {
  if (!siteInfoProvider || !isInitialized) {
    console.log('SusRadar: Provider not initialized for search scanning');
    return;
  }
  
  const searchEngine = isSearchResultsPage();
  if (!searchEngine) {
    console.log('SusRadar: Not a search results page');
    return;
  }
  
  console.log('SusRadar: Scanning search results on', searchEngine.hostname);
  
  const allData = await siteInfoProvider.getAllSites();
  const mappings = allData.mappings || {};
  const companies = allData.companies || {};
  
  if (Object.keys(mappings).length === 0) {
    console.log('SusRadar: No tracked sites to compare against');
    return;
  }
  
  // Get all result containers first
  const resultContainers = document.querySelectorAll(searchEngine.selectors.resultContainers);
  let foundSusLinks = 0;
  
  resultContainers.forEach(container => {
    try {
      // Find the primary link within this result container
      let primaryLink = null;
      
      // Simple and robust approach: find the first significant link in the container
      const allLinks = container.querySelectorAll('a[href*="://"]');
      
      for (const link of allLinks) {
        // Skip internal search engine links first
        if (searchEngine.selectors.excludeSelectors) {
          const excludeRules = searchEngine.selectors.excludeSelectors.split(', ');
          const shouldExclude = excludeRules.some(rule => {
            if (rule.includes('*')) {
              const pattern = rule.replace(/\*/g, '.*');
              return new RegExp(pattern).test(link.href);
            }
            return link.matches(rule);
          });
          
          if (shouldExclude) continue;
        }
        
        // Skip if link has no meaningful text
        if (!link.textContent.trim()) continue;
        
        // For the first link that passes our filters, use it as primary
        primaryLink = link;
        break;
      }
      
      if (!primaryLink || !primaryLink.href) {
        return; // No valid primary link found in this container
      }
      
      // Skip excluded links
      if (searchEngine.selectors.excludeSelectors) {
        const excludeRules = searchEngine.selectors.excludeSelectors.split(', ');
        const shouldExclude = excludeRules.some(rule => {
          if (rule.includes('*')) {
            const pattern = rule.replace(/\*/g, '.*');
            return new RegExp(pattern).test(primaryLink.href);
          }
          return primaryLink.matches(rule);
        });
        
        if (shouldExclude) return;
      }
      
      // Check if this link matches any of our tracked sites
      const linkUrl = primaryLink.href;
      const matcher = new ExactMatcher();
      const companyId = matcher.findMatch(linkUrl, mappings);
      
      if (companyId && companies[companyId]) {
        const siteInfo = new CompanyData(companies[companyId]);
        addWarningIcon(primaryLink, siteInfo);
        foundSusLinks++;
      }
    } catch (error) {
      // Silently skip invalid containers
    }
  });
  
  console.log(`SusRadar: Found ${foundSusLinks} sus links in search results`);
}

function addWarningIcon(linkElement, siteInfo) {
  // Don't add multiple icons to the same link or container
  if (linkElement.querySelector('.susradar-warning-icon') || 
      linkElement.parentElement.querySelector('.susradar-warning-icon')) {
    return;
  }
  
  // Create warning icon
  const warningIcon = document.createElement('span');
  warningIcon.className = 'susradar-warning-icon';
  warningIcon.innerHTML = '🚨';
  warningIcon.title = `SusRadar Warning: ${siteInfo.company_name} (${siteInfo.sus_rating}/5 Sus)`;
  
  // Style the warning icon with better positioning for search results
  warningIcon.style.cssText = `
    display: inline-block !important;
    margin-left: 8px !important;
    font-size: 16px !important;
    cursor: pointer !important;
    opacity: 0.9 !important;
    transition: all 0.2s ease !important;
    position: relative !important;
    z-index: 1000 !important;
    background: rgba(244, 67, 54, 0.15) !important;
    border: 1px solid rgba(244, 67, 54, 0.4) !important;
    border-radius: 50% !important;
    width: 22px !important;
    height: 22px !important;
    text-align: center !important;
    line-height: 20px !important;
    vertical-align: middle !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
  `;
  
  // Add hover effects
  warningIcon.addEventListener('mouseenter', () => {
    warningIcon.style.opacity = '1';
    warningIcon.style.transform = 'scale(1.15)';
    warningIcon.style.background = 'rgba(244, 67, 54, 0.25)';
    warningIcon.style.boxShadow = '0 4px 8px rgba(244, 67, 54, 0.3)';
  });
  
  warningIcon.addEventListener('mouseleave', () => {
    warningIcon.style.opacity = '0.9';
    warningIcon.style.transform = 'scale(1)';
    warningIcon.style.background = 'rgba(244, 67, 54, 0.15)';
    warningIcon.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  });
  
  // Add click event to show popup
  warningIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showSearchResultPopup(warningIcon, siteInfo, linkElement.href);
  });
  
  // Find the best insertion point within the link
  // Look for h3 element (title) or just append to the link
  const titleElement = linkElement.querySelector('h3');
  if (titleElement) {
    titleElement.appendChild(warningIcon);
  } else {
    // If no h3, append directly to the link element
    linkElement.appendChild(warningIcon);
  }
}

function showSearchResultPopup(iconElement, siteInfo, targetUrl) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.susradar-search-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup
  const popup = document.createElement('div');
  popup.className = 'susradar-search-popup';
  
  // Calculate position relative to icon
  const iconRect = iconElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  const zIndex = Math.max(
    ...Array.from(document.querySelectorAll('*'))
      .map(el => parseInt(window.getComputedStyle(el).zIndex) || 0)
      .filter(z => !isNaN(z))
  ) + 2000;
  
  // Style the popup
  popup.style.cssText = `
    position: absolute !important;
    top: ${iconRect.bottom + scrollTop + 10}px !important;
    left: ${iconRect.left + scrollLeft - 150}px !important;
    z-index: ${zIndex} !important;
    width: 320px !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border-radius: 12px !important;
    border: 2px solid rgba(255, 255, 255, 0.2) !important;
    color: white !important;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(102, 126, 234, 0.3) !important;
    backdrop-filter: blur(10px) !important;
    padding: 16px !important;
    display: block !important;
    visibility: visible !important;
    opacity: 0 !important;
    transform: scale(0.9) translateY(-10px) !important;
    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    pointer-events: auto !important;
    max-width: 90vw !important;
  `;
  
  // Add arrow pointing to icon
  const arrow = document.createElement('div');
  arrow.style.cssText = `
    position: absolute !important;
    top: -8px !important;
    left: 145px !important;
    width: 0 !important;
    height: 0 !important;
    border-left: 8px solid transparent !important;
    border-right: 8px solid transparent !important;
    border-bottom: 8px solid rgba(255, 255, 255, 0.2) !important;
  `;
  popup.appendChild(arrow);
  
  // Create popup content using existing dropdown component
  const tempContainer = document.createElement('div');
  const tempDropdown = new SusRadarDropdown(tempContainer, false);
  tempDropdown.currentSiteInfo = siteInfo;
  
  popup.innerHTML = `
    ${arrow.outerHTML}
    <div class="susradar-search-popup-header">
      <h3 style="margin: 0 0 8px 0; color: #FFC107; font-size: 16px;">${siteInfo.company_name}</h3>
      <div style="font-size: 11px; opacity: 0.8;">${new URL(targetUrl).hostname}</div>
      <button class="susradar-search-close" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 12px;">✕</button>
    </div>
    
    <div style="margin: 12px 0;">
      ${SusRadarUI.createRatingDisplay(siteInfo)}
    </div>
    
    ${SusRadarUI.createDescriptionContainer(siteInfo, {
      tabClass: 'search-desc-tab',
      contentClass: 'search-desc-content',
      maxLength: 100,
      containerClass: 'search-description-container',
      tabsContainerClass: 'search-description-tabs'
    })}
    
    ${SusRadarUI.createAlternativesSection(siteInfo, 2)}
    
    <div style="margin-top: 12px; font-size: 11px; opacity: 0.7; text-align: center;">
      Click to avoid visiting this site
    </div>
  `;
  
  // Add popup-specific styles
  if (!document.getElementById('susradar-search-popup-styles')) {
    const style = document.createElement('style');
    style.id = 'susradar-search-popup-styles';
    style.textContent = `
      .susradar-search-popup .search-description-tabs {
        display: flex !important;
        gap: 4px !important;
        margin-bottom: 8px !important;
        justify-content: center !important;
      }
      .susradar-search-popup .search-desc-tab {
        background: rgba(255, 255, 255, 0.1) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        color: white !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .susradar-search-popup .search-desc-tab:hover {
        background: rgba(255, 255, 255, 0.2) !important;
        transform: scale(1.05) !important;
      }
      .susradar-search-popup .search-desc-tab.active {
        background: rgba(255, 193, 7, 0.3) !important;
        border-color: #FFC107 !important;
        box-shadow: 0 0 6px rgba(255, 193, 7, 0.4) !important;
      }
      .susradar-search-popup .search-desc-tab.disabled {
        background: rgba(255, 255, 255, 0.05) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
        color: rgba(255, 255, 255, 0.3) !important;
        cursor: not-allowed !important;
        opacity: 0.5 !important;
      }
      .susradar-search-popup .search-desc-content {
        display: none !important;
        font-size: 12px !important;
        line-height: 1.3 !important;
        background: rgba(255, 255, 255, 0.1) !important;
        padding: 8px !important;
        border-radius: 6px !important;
        border-left: 3px solid #FFC107 !important;
      }
      .susradar-search-popup .search-desc-content.active {
        display: block !important;
      }
      .susradar-search-popup .susradar-rating-container {
        margin: 8px 0 !important;
      }
      .susradar-search-popup .susradar-alternatives {
        margin-top: 10px !important;
      }
      .susradar-search-popup .susradar-alternatives h4 {
        font-size: 12px !important;
        margin: 0 0 6px 0 !important;
      }
      .susradar-search-popup .susradar-alternatives ul {
        list-style: none !important;
        padding: 0 !important;
        margin: 0 !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }
      .susradar-search-popup .susradar-alternatives li {
        margin: 0 !important;
      }
      .susradar-search-popup .susradar-alternatives a {
        background: rgba(76, 175, 80, 0.2) !important;
        padding: 4px 8px !important;
        border-radius: 10px !important;
        color: #B8E6B8 !important;
        text-decoration: none !important;
        font-size: 10px !important;
        transition: all 0.2s ease !important;
        display: block !important;
      }
      .susradar-search-popup .susradar-alternatives a:hover {
        background: rgba(76, 175, 80, 0.4) !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(popup);
  
  // Attach event listeners for the popup
  SusRadarUI.attachDescriptionTabListeners(popup, 'search-desc-tab', 'search-desc-content');
  
  // Close button
  const closeBtn = popup.querySelector('.susradar-search-close');
  closeBtn.addEventListener('click', () => {
    popup.remove();
  });
  
  // Close on click outside
  setTimeout(() => {
    const closeOnOutside = (e) => {
      if (!popup.contains(e.target) && !iconElement.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closeOnOutside, true);
      }
    };
    document.addEventListener('click', closeOnOutside, true);
  }, 100);
  
  // Trigger entrance animation
  setTimeout(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'scale(1) translateY(0)';
  }, 50);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (popup.parentNode) {
      popup.style.opacity = '0';
      popup.style.transform = 'scale(0.9) translateY(-10px)';
      setTimeout(() => popup.remove(), 300);
    }
  }, 10000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    initializeProviders();
    await initializeData();
    // Check if this is a search results page and scan after a short delay
    setTimeout(() => {
      if (isSearchResultsPage()) {
        setupSearchResultsObserver();
        scanSearchResults();
      }
    }, 1500);
  });
} else {
  // DOM already loaded
  setTimeout(async () => {
    initializeProviders();
    await initializeData();
    // Check if this is a search results page and scan after a short delay
    setTimeout(() => {
      if (isSearchResultsPage()) {
        setupSearchResultsObserver();
        scanSearchResults();
      }
    }, 1500);
  }, 100);
}

// Monitor for URL changes and dynamic content (for SPAs and search results)
let lastUrl = location.href;
let searchResultsObserver = null;

function setupSearchResultsObserver() {
  // Remove existing observer
  if (searchResultsObserver) {
    searchResultsObserver.disconnect();
    searchResultsObserver = null;
  }
  
  const searchEngine = isSearchResultsPage();
  if (!searchEngine) return;
  
  // Set up observer for dynamic search results
  searchResultsObserver = new MutationObserver((mutations) => {
    let shouldRescan = false;
    
    mutations.forEach((mutation) => {
      // Check if new links were added
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasLinks = node.querySelector && node.querySelector('a[href*="://"]');
            if (hasLinks) {
              shouldRescan = true;
            }
          }
        });
      }
    });
    
    if (shouldRescan) {
      // Debounce rescanning to avoid excessive calls
      clearTimeout(window.susRadarRescanTimeout);
      window.susRadarRescanTimeout = setTimeout(() => {
        console.log('SusRadar: Rescanning search results due to dynamic content');
        scanSearchResults();
      }, 1000);
    }
  });
  
  // Start observing
  searchResultsObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    searchResultsProcessed = false;
    
    // Handle URL changes
    setTimeout(() => {
      checkCurrentSite();
      
      // Set up search results scanning for new page
      if (isSearchResultsPage()) {
        setupSearchResultsObserver();
        setTimeout(scanSearchResults, 1500);
      } else {
        // Clean up search results observer if not on search page
        if (searchResultsObserver) {
          searchResultsObserver.disconnect();
          searchResultsObserver = null;
        }
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });