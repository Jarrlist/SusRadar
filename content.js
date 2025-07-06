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
  }
  
  isValid() {
    return this.company_name.trim() !== '' && 
           this.sus_rating >= 1 && 
           this.sus_rating <= 5;
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
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        const data = result[this.STORAGE_KEY] || {
          url_mappings: {},
          company_data: {}
        };
        resolve(data);
      });
    });
  }
  
  async _saveData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({[this.STORAGE_KEY]: data}, () => {
        resolve();
      });
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
      user_added: false
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
      user_added: false
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
      user_added: false
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

function showSusRadarDropdown(siteInfo) {
  hideSusRadarDropdown();
  
  const dropdown = document.createElement('div');
  dropdown.id = 'susradar-dropdown';
  dropdown.innerHTML = `
    <div class="susradar-header">
      <h3 class="susradar-company-name">${siteInfo.company_name}</h3>
      <button class="susradar-close" onclick="hideSusRadarDropdown()">✕</button>
    </div>
    <div class="susradar-rating-container">
      <div class="susradar-rating-bar">
        <div class="susradar-rating-fill" style="width: ${(siteInfo.sus_rating / 5) * 100}%"></div>
        <div class="susradar-rating-dial" style="left: ${(siteInfo.sus_rating / 5) * 100}%"></div>
      </div>
      <div class="susradar-rating-labels">
        <span class="susradar-safe">Safe</span>
        <span class="susradar-sus">Sus AF</span>
      </div>
    </div>
    <div class="susradar-description">
      ${siteInfo.description}
    </div>
    ${siteInfo.alternative_links && siteInfo.alternative_links.length > 0 ? `
      <div class="susradar-alternatives">
        <h4>🌟 Better Companies:</h4>
        <ul>
          ${siteInfo.alternative_links.map(link => `
            <li><a href="${link}" target="_blank">${link}</a></li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
  `;
  
  document.body.appendChild(dropdown);
  susRadarDropdown = dropdown;
  
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
    }, 300);
  }
}

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