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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExactMatcher;
}