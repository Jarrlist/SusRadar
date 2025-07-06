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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalStorageProvider;
}