let susRadarDropdown = null;
let siteInfoProvider = null;
let isInitialized = false;

// Load all code directly inline to avoid script loading issues

// Core interfaces
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

class URLMatcher {
  findMatch(currentUrl, urlMappings) {
    throw new Error('findMatch must be implemented');
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
}

// URL Matcher
class ExactMatcher extends URLMatcher {
  findMatch(currentUrl, urlMappings) {
    const cleanUrl = this._cleanUrl(currentUrl);
    console.log('SusRadar: Matching URL:', cleanUrl);
    console.log('SusRadar: Available mappings:', Object.keys(urlMappings).map(url => this._cleanUrl(url)));
    
    for (const [mappedUrl, companyId] of Object.entries(urlMappings)) {
      const cleanMappedUrl = this._cleanUrl(mappedUrl);
      console.log('SusRadar: Comparing', cleanUrl, 'vs', cleanMappedUrl);
      if (cleanMappedUrl === cleanUrl) {
        console.log('SusRadar: Found match!', companyId);
        return companyId;
      }
    }
    
    console.log('SusRadar: No match found');
    return null;
  }
  
  _cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return url.toLowerCase().replace(/^www\./, '');
    }
  }
}

// Local Storage Provider
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
  
  async getSiteInfo(url) {
    const data = await this._getData();
    const matcher = new ExactMatcher();
    const companyId = matcher.findMatch(url, data.url_mappings);
    
    if (companyId && data.company_data[companyId]) {
      return new CompanyData(data.company_data[companyId]);
    }
    return null;
  }
  
  async addSiteInfo(url, companyId, info) {
    const data = await this._getData();
    
    data.url_mappings[url] = companyId;
    data.company_data[companyId] = new CompanyData(info);
    
    await this._saveData(data);
    return true;
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
  
  async getAllSites() {
    const data = await this._getData();
    return {
      mappings: data.url_mappings,
      companies: data.company_data
    };
  }
}

// Initial data
const INITIAL_DATA = {
  url_mappings: {
    "facebook.com": "meta_corp",
    "www.facebook.com": "meta_corp",
    "instagram.com": "meta_corp",
    "www.instagram.com": "meta_corp",
    "whatsapp.com": "meta_corp",
    "www.whatsapp.com": "meta_corp",
    "twitter.com": "x_corp",
    "www.twitter.com": "x_corp",
    "x.com": "x_corp",
    "www.x.com": "x_corp",
    "tiktok.com": "bytedance",
    "www.tiktok.com": "bytedance"
  },
  company_data: {
    "meta_corp": {
      company_name: "Meta (Facebook)",
      sus_rating: 4,
      description: "🕵️ Known for aggressive data collection, privacy violations, and spreading misinformation. Has been fined billions for privacy breaches and continues to track users across the web.",
      alternative_links: [
        "https://signal.org",
        "https://mastodon.social",
        "https://diasporafoundation.org",
        "https://element.io"
      ],
      date_added: "2024-01-01T00:00:00.000Z",
      user_added: false,
      origin: "susradar",
      is_modified: false,
      original_data: null
    },
    "x_corp": {
      company_name: "X (formerly Twitter)",
      sus_rating: 4,
      description: "🎭 Platform has become increasingly problematic with content moderation issues, bot accounts, and questionable leadership decisions affecting user safety and data privacy.",
      alternative_links: [
        "https://mastodon.social",
        "https://bsky.app",
        "https://threads.net",
        "https://counter.social"
      ],
      date_added: "2024-01-01T00:00:00.000Z",
      user_added: false,
      origin: "susradar",
      is_modified: false,
      original_data: null
    },
    "bytedance": {
      company_name: "ByteDance (TikTok)",
      sus_rating: 5,
      description: "🚨 Chinese-owned app with serious data privacy concerns. Collects massive amounts of user data and has potential ties to Chinese government surveillance programs.",
      alternative_links: [
        "https://youtube.com/shorts",
        "https://instagram.com/reels",
        "https://triller.co",
        "https://byte.co"
      ],
      date_added: "2024-01-01T00:00:00.000Z",
      user_added: false,
      origin: "susradar",
      is_modified: false,
      original_data: null
    }
  }
};

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
    const siteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
    console.log('SusRadar: Site info:', siteInfo);
    
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
        <h3 class="susradar-company-name">${isTracked ? siteInfo.company_name : this.getHostname()}</h3>
        <div class="control-buttons">
          ${isTracked ? '<button class="control-btn manage-btn" title="Manage Entry">⚙️</button>' : '<button class="control-btn add-btn" title="Add to Radar">➕</button>'}
          ${!isTracked ? '<button class="control-btn all-entries-btn" title="Manage All Entries">⚙️</button>' : ''}
          <button class="susradar-close" title="Close">✕</button>
        </div>
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
      
      <div class="susradar-rating-container">
        <div class="susradar-rating-bar">
          <div class="susradar-rating-fill" style="width: ${(siteInfo.sus_rating / 5) * 100}%"></div>
          <div class="susradar-rating-dial" style="left: ${(siteInfo.sus_rating / 5) * 100}%"></div>
        </div>
        <div class="susradar-rating-labels">
          <span class="susradar-safe">Safe</span>
          <span class="susradar-sus">Sus AF (${siteInfo.sus_rating}/5)</span>
        </div>
      </div>
      
      <div class="susradar-description">
        ${siteInfo.description.length > 120 ? siteInfo.description.substring(0, 120) + '...' : siteInfo.description}
      </div>
      
      ${siteInfo.alternative_links && siteInfo.alternative_links.length > 0 ? `
        <div class="susradar-alternatives">
          <h4>🌟 Better Companies:</h4>
          <ul>
            ${siteInfo.alternative_links.slice(0, 3).map(link => `
              <li><a href="${link}" target="_blank">${link}</a></li>
            `).join('')}
            ${siteInfo.alternative_links.length > 3 ? '<li class="more-alternatives">+ more in management page</li>' : ''}
          </ul>
        </div>
      ` : ''}
      
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
          <div class="rating-input">
            <input type="range" id="susRating" min="1" max="5" value="3">
            <span id="ratingDisplay">3</span>
            <div class="rating-labels">
              <span>Safe</span>
              <span>Sus AF</span>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="descriptionInput">Description:</label>
          <textarea id="descriptionInput" rows="3" placeholder="Why is this company sus?"></textarea>
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

  getHostname() {
    try {
      return new URL(window.location.href).hostname;
    } catch (e) {
      return 'Current Site';
    }
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
    if (ratingSlider) ratingSlider.addEventListener('input', () => this.updateRatingDisplay());

    // Initial rating display
    this.updateRatingDisplay();
  }

  showAddForm() {
    this.container.querySelector('.site-content').style.display = 'none';
    this.container.querySelector('#addSiteForm').style.display = 'block';
  }

  showEditForm() {
    if (this.currentSiteInfo) {
      this.container.querySelector('#companyNameInput').value = this.currentSiteInfo.company_name;
      this.container.querySelector('#susRating').value = this.currentSiteInfo.sus_rating;
      this.container.querySelector('#descriptionInput').value = this.currentSiteInfo.description;
      this.container.querySelector('#alternativeLinks').value = this.currentSiteInfo.alternative_links.join('\n');
      this.updateRatingDisplay();
    }
    this.showAddForm();
  }

  async handleRemove() {
    if (!this.currentSiteInfo) return;
    
    if (confirm(`Remove ${this.currentSiteInfo.company_name} from radar?`)) {
      const companyId = this.generateCompanyId(this.currentSiteInfo.company_name);
      await siteInfoProvider.deleteSiteInfo(companyId);
      
      if (this.isPopup) {
        // Reload the popup content
        const currentUrl = await this.getCurrentUrl();
        const siteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
        this.render(siteInfo);
      } else {
        // Hide dropdown and reload page
        hideSusRadarDropdown();
        location.reload();
      }
    }
  }

  async openManagePage() {
    // Open the management page (all-entries) with focus on current site
    const currentUrl = await this.getCurrentUrl();
    const companyId = this.generateCompanyId(this.currentSiteInfo.company_name);
    const allEntriesUrl = chrome.runtime.getURL(`all-entries.html?focus=${encodeURIComponent(companyId)}`);
    window.open(allEntriesUrl, '_blank');
  }

  async showAllSites() {
    // Open the all-entries page in a new tab
    const allEntriesUrl = chrome.runtime.getURL('all-entries.html');
    window.open(allEntriesUrl, '_blank');
  }

  hideForm() {
    this.container.querySelector('.site-content').style.display = 'block';
    this.container.querySelector('#addSiteForm').style.display = 'none';
    
    const form = this.container.querySelector('#siteForm');
    if (form) form.reset();
    this.updateRatingDisplay();
  }

  updateRatingDisplay() {
    const rating = this.container.querySelector('#susRating')?.value || 3;
    const display = this.container.querySelector('#ratingDisplay');
    if (display) display.textContent = rating;
  }

  getHostname() {
    try {
      return new URL(window.location.href).hostname;
    } catch (e) {
      return 'Current Site';
    }
  }

  generateCompanyId(companyName) {
    return companyName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  }

  async getCurrentUrl() {
    if (this.isPopup) {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs[0].url);
        });
      });
    } else {
      return window.location.href;
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const companyName = this.container.querySelector('#companyNameInput').value;
    const susRating = parseInt(this.container.querySelector('#susRating').value);
    const description = this.container.querySelector('#descriptionInput').value;
    const alternativeLinks = this.container.querySelector('#alternativeLinks').value
      .split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0);
    const additionalUrls = this.container.querySelector('#additionalUrls').value
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    const companyId = this.generateCompanyId(companyName);
    const currentUrl = await this.getCurrentUrl();
    
    // Check if this is editing an existing SusRadar entry
    const existingSiteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
    const isModifyingOriginal = existingSiteInfo && existingSiteInfo.origin === 'susradar' && !existingSiteInfo.is_modified;
    
    const siteInfo = {
      company_name: companyName,
      sus_rating: susRating,
      description: description,
      alternative_links: alternativeLinks,
      date_added: existingSiteInfo ? existingSiteInfo.date_added : new Date().toISOString(),
      user_added: existingSiteInfo ? existingSiteInfo.user_added : true,
      origin: existingSiteInfo ? existingSiteInfo.origin : 'user',
      is_modified: isModifyingOriginal ? true : (existingSiteInfo ? existingSiteInfo.is_modified : false),
      original_data: isModifyingOriginal ? {
        company_name: existingSiteInfo.company_name,
        sus_rating: existingSiteInfo.sus_rating,
        description: existingSiteInfo.description,
        alternative_links: existingSiteInfo.alternative_links
      } : (existingSiteInfo ? existingSiteInfo.original_data : null)
    };
    
    try {
      await siteInfoProvider.addSiteInfo(currentUrl, companyId, siteInfo);
      
      for (const url of additionalUrls) {
        await siteInfoProvider.addSiteInfo(url, companyId, siteInfo);
      }
      
      this.hideForm();
      
      // Refresh the content
      const updatedSiteInfo = await siteInfoProvider.getSiteInfo(currentUrl);
      this.render(updatedSiteInfo);
      
      // Reload page if not popup
      if (!this.isPopup) {
        location.reload();
      }
      
    } catch (error) {
      console.error('Error saving site info:', error);
      alert('Error saving site information. Please try again.');
    }
  }

  close() {
    if (this.isPopup) {
      window.close();
    } else {
      hideSusRadarDropdown();
    }
  }
}

let currentDropdownComponent = null;

function showSusRadarDropdown(siteInfo) {
  hideSusRadarDropdown();
  
  const dropdown = document.createElement('div');
  dropdown.id = 'susradar-dropdown';
  dropdown.className = 'popup-dropdown'; // Use same CSS class as popup
  
  document.body.appendChild(dropdown);
  susRadarDropdown = dropdown;
  
  // Create and render the dropdown component
  currentDropdownComponent = new SusRadarDropdown(dropdown, false);
  currentDropdownComponent.render(siteInfo);
  
  setTimeout(() => {
    dropdown.classList.add('susradar-visible');
  }, 100);
}

function hideSusRadarDropdown() {
  if (susRadarDropdown) {
    susRadarDropdown.classList.remove('susradar-visible');
    setTimeout(() => {
      if (susRadarDropdown && susRadarDropdown.parentNode) {
        susRadarDropdown.parentNode.removeChild(susRadarDropdown);
      }
      susRadarDropdown = null;
      currentDropdownComponent = null;
    }, 300);
  }
}

// Make function globally available
window.hideSusRadarDropdown = hideSusRadarDropdown;

async function initializeSusRadar() {
  console.log('SusRadar: Starting initialization...');
  
  // Initialize providers directly
  initializeProviders();
  
  // Wait for initialization to complete
  if (isInitialized && siteInfoProvider) {
    const data = await siteInfoProvider.getAllSites();
    if (Object.keys(data.companies).length === 0) {
      console.log('SusRadar: Loading initial data...');
      for (const [url, companyId] of Object.entries(INITIAL_DATA.url_mappings)) {
        await siteInfoProvider.addSiteInfo(url, companyId, INITIAL_DATA.company_data[companyId]);
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSusRadar);
} else {
  initializeSusRadar();
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(checkCurrentSite, 1000);
  }
}).observe(document, { subtree: true, childList: true });