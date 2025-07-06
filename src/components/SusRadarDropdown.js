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
          ${isTracked ? '' : '<button class="control-btn add-btn" title="Add to Radar">➕</button>'}
          ${isTracked ? '<button class="control-btn edit-btn" title="Edit Entry">✏️</button>' : ''}
          ${isTracked ? '<button class="control-btn remove-btn" title="Remove from Radar">🗑️</button>' : ''}
          <button class="control-btn view-all-btn" title="View All Entries">📋</button>
          ${this.isPopup ? '<button class="susradar-close" title="Close">✕</button>' : ''}
        </div>
      </div>
      
      <div class="site-content">
        ${isTracked ? this.createTrackedContent(siteInfo) : this.createNotTrackedContent()}
      </div>
      
      <div class="form-container" id="addSiteForm" style="display: none;">
        ${this.createFormHTML()}
      </div>
      
      <div class="form-container" id="allSitesView" style="display: none;">
        <h3>All Radar Entries</h3>
        <div id="allSitesList"></div>
        <button class="btn btn-secondary back-btn">Back</button>
      </div>
    `;
  }

  createTrackedContent(siteInfo) {
    return `
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
    const editBtn = this.container.querySelector('.edit-btn');
    const removeBtn = this.container.querySelector('.remove-btn');
    const viewAllBtn = this.container.querySelector('.view-all-btn');
    const closeBtn = this.container.querySelector('.susradar-close');

    if (addBtn) addBtn.addEventListener('click', () => this.showAddForm());
    if (editBtn) editBtn.addEventListener('click', () => this.showEditForm());
    if (removeBtn) removeBtn.addEventListener('click', () => this.handleRemove());
    if (viewAllBtn) viewAllBtn.addEventListener('click', () => this.showAllSites());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Form buttons
    const form = this.container.querySelector('#siteForm');
    const cancelBtn = this.container.querySelector('.cancel-btn');
    const backBtn = this.container.querySelector('.back-btn');
    const ratingSlider = this.container.querySelector('#susRating');

    if (form) form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideForm());
    if (backBtn) backBtn.addEventListener('click', () => this.hideForm());
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
        this.close();
        location.reload();
      }
    }
  }

  async showAllSites() {
    const data = await siteInfoProvider.getAllSites();
    const listEl = this.container.querySelector('#allSitesList');
    
    listEl.innerHTML = '';
    
    if (Object.keys(data.companies).length === 0) {
      listEl.innerHTML = '<p>No sites tracked yet.</p>';
    } else {
      Object.entries(data.companies).forEach(([companyId, company]) => {
        const urls = Object.keys(data.mappings).filter(url => data.mappings[url] === companyId);
        
        const entryEl = document.createElement('div');
        entryEl.className = 'site-entry';
        entryEl.innerHTML = `
          <h4>${company.company_name}</h4>
          <div class="rating rating-${company.sus_rating}">Sus Rating: ${company.sus_rating}/5</div>
          <div class="urls">URLs: ${urls.join(', ')}</div>
          <div class="description">${company.description}</div>
        `;
        listEl.appendChild(entryEl);
      });
    }
    
    this.container.querySelector('.site-content').style.display = 'none';
    this.container.querySelector('#allSitesView').style.display = 'block';
  }

  hideForm() {
    this.container.querySelector('.site-content').style.display = 'block';
    this.container.querySelector('#addSiteForm').style.display = 'none';
    this.container.querySelector('#allSitesView').style.display = 'none';
    
    const form = this.container.querySelector('#siteForm');
    if (form) form.reset();
    this.updateRatingDisplay();
  }

  updateRatingDisplay() {
    const rating = this.container.querySelector('#susRating')?.value || 3;
    const display = this.container.querySelector('#ratingDisplay');
    if (display) display.textContent = rating;
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
    
    const siteInfo = {
      company_name: companyName,
      sus_rating: susRating,
      description: description,
      alternative_links: alternativeLinks,
      date_added: new Date().toISOString(),
      user_added: true
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
      
      // Reload tab if not popup
      if (!this.isPopup) {
        chrome.tabs.reload();
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
      // Hide the dropdown with animation
      this.container.classList.remove('susradar-visible');
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
      }, 300);
    }
  }
}