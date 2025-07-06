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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SiteInfoProvider, URLMatcher, CompanyData };
}