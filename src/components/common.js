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
    console.log(`SusRadar: Starting with ${Object.keys(data.companies).length} companies from storage`);
    // No default data loaded - users start with a clean slate
    // Use "Backup Entries" and "Restore Entries" to manage data
  }
};