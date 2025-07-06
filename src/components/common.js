// SusRadar - Common Classes and Data
// Shared across all extension files

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
    
    // Support both old single description and new multi-category descriptions
    if (data.descriptions) {
      this.descriptions = {
        usability: data.descriptions.usability || '',
        customer: data.descriptions.customer || '',
        political: data.descriptions.political || ''
      };
    } else {
      // Migrate old description to usability category
      this.descriptions = {
        usability: data.description || '',
        customer: '',
        political: ''
      };
    }
    
    // Default description category (usability, customer, political)
    this.default_description = data.default_description || 'usability';
    
    // Keep old description field for backward compatibility
    this.description = this.descriptions[this.default_description] || this.descriptions.usability;
    
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

// URL Matcher Implementation
class ExactMatcher extends URLMatcher {
  findMatch(currentUrl, urlMappings) {
    const cleanUrl = this._cleanUrl(currentUrl);
    
    for (const [mappedUrl, companyId] of Object.entries(urlMappings)) {
      const cleanMappedUrl = this._cleanUrl(mappedUrl);
      if (cleanMappedUrl === cleanUrl) {
        return companyId;
      }
    }
    
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

// Local Storage Provider Implementation
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
      descriptions: {
        usability: "🕵️ Cluttered interface with endless scrolling designed to maximize engagement. Algorithmic feeds prioritize sensational content over quality information.",
        customer: "🛡️ Aggressive data collection, privacy violations, and spreading misinformation. Has been fined billions for privacy breaches and continues to track users across the web.",
        political: "⚖️ Lobbies against privacy regulations, facilitates election interference, and amplifies extremist content for profit while claiming neutrality."
      },
      default_description: "customer",
      description: "🛡️ Aggressive data collection, privacy violations, and spreading misinformation. Has been fined billions for privacy breaches and continues to track users across the web.",
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
      descriptions: {
        usability: "🎭 Chaotic interface changes, broken verification system, and algorithmic timeline manipulation that prioritizes engagement over user experience.",
        customer: "🛡️ Platform has become increasingly problematic with content moderation issues, bot accounts, and questionable leadership decisions affecting user safety and data privacy.",
        political: "⚖️ Amplifies misinformation, suspends journalists critical of leadership, and has become a tool for political manipulation and extremist recruitment."
      },
      default_description: "political",
      description: "⚖️ Amplifies misinformation, suspends journalists critical of leadership, and has become a tool for political manipulation and extremist recruitment.",
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
      descriptions: {
        usability: "🚨 Addictive design optimized for maximum screen time. Infinite scroll with algorithm that learns user weaknesses to maximize engagement over wellbeing.",
        customer: "🛡️ Chinese-owned app with serious data privacy concerns. Collects massive amounts of user data and has potential ties to Chinese government surveillance programs.",
        political: "⚖️ Accused of censoring content critical of China, promoting pro-China propaganda, and potentially influencing elections through algorithmic manipulation of information flow."
      },
      default_description: "customer",
      description: "🛡️ Chinese-owned app with serious data privacy concerns. Collects massive amounts of user data and has potential ties to Chinese government surveillance programs.",
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

// Common Utilities
const SusRadarUtils = {
  generateCompanyId(companyName) {
    return companyName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  },

  getHostname(url = window.location.href) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return 'Current Site';
    }
  },

  determineDefaultDescription(usabilityDesc, customerDesc, politicalDesc) {
    // Determine default description based on which has content
    let defaultDesc = 'usability';
    if (customerDesc && !usabilityDesc && !politicalDesc) defaultDesc = 'customer';
    else if (politicalDesc && !usabilityDesc && !customerDesc) defaultDesc = 'political';
    else if (customerDesc && politicalDesc && !usabilityDesc) defaultDesc = 'customer';
    else if (usabilityDesc && politicalDesc && !customerDesc) defaultDesc = 'usability';
    else if (usabilityDesc && customerDesc && !politicalDesc) defaultDesc = 'usability';
    return defaultDesc;
  },

  async initializeDefaultData(siteInfoProvider) {
    const data = await siteInfoProvider.getAllSites();
    if (Object.keys(data.companies).length === 0) {
      console.log('SusRadar: Loading initial data...');
      for (const [url, companyId] of Object.entries(INITIAL_DATA.url_mappings)) {
        await siteInfoProvider.addSiteInfo(url, companyId, INITIAL_DATA.company_data[companyId]);
      }
    }
  }
};