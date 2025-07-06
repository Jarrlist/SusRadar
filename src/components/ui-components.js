// SusRadar - Shared UI Components
// Common UI creation and interaction logic

const SusRadarUI = {
  // Create description tabs HTML
  createDescriptionTabs(siteInfo, tabClass = 'desc-tab', idPrefix = '', tabsContainerClass = 'description-tabs') {
    return `
      <div class="${tabsContainerClass}">
        <button class="${tabClass} ${siteInfo.default_description === 'usability' ? 'active' : ''} ${siteInfo.descriptions.usability ? '' : 'disabled'}" 
                data-category="usability" 
                ${idPrefix ? `data-company-id="${idPrefix}"` : ''}
                title="Usability & Information Quality" 
                ${siteInfo.descriptions.usability ? '' : 'disabled'}>🖥️</button>
        <button class="${tabClass} ${siteInfo.default_description === 'customer' ? 'active' : ''} ${siteInfo.descriptions.customer ? '' : 'disabled'}" 
                data-category="customer" 
                ${idPrefix ? `data-company-id="${idPrefix}"` : ''}
                title="Customer Protection & Scam Risk" 
                ${siteInfo.descriptions.customer ? '' : 'disabled'}>🛡️</button>
        <button class="${tabClass} ${siteInfo.default_description === 'political' ? 'active' : ''} ${siteInfo.descriptions.political ? '' : 'disabled'}" 
                data-category="political" 
                ${idPrefix ? `data-company-id="${idPrefix}"` : ''}
                title="Political & Legal Issues" 
                ${siteInfo.descriptions.political ? '' : 'disabled'}>⚖️</button>
      </div>
    `;
  },

  // Create description content HTML
  createDescriptionContent(siteInfo, contentClass = 'desc-content', idPrefix = '', maxLength = 120) {
    return `
      <div class="description-content" ${idPrefix ? `id="desc-content-${idPrefix}"` : ''}>
        <div class="${contentClass} ${siteInfo.default_description === 'usability' ? 'active' : ''}" 
             data-category="usability" 
             ${idPrefix ? `data-company-id="${idPrefix}"` : ''}>
          ${siteInfo.descriptions.usability ? (maxLength && siteInfo.descriptions.usability.length > maxLength ? siteInfo.descriptions.usability.substring(0, maxLength) + '...' : siteInfo.descriptions.usability) : ''}
        </div>
        <div class="${contentClass} ${siteInfo.default_description === 'customer' ? 'active' : ''}" 
             data-category="customer" 
             ${idPrefix ? `data-company-id="${idPrefix}"` : ''}>
          ${siteInfo.descriptions.customer ? (maxLength && siteInfo.descriptions.customer.length > maxLength ? siteInfo.descriptions.customer.substring(0, maxLength) + '...' : siteInfo.descriptions.customer) : ''}
        </div>
        <div class="${contentClass} ${siteInfo.default_description === 'political' ? 'active' : ''}" 
             data-category="political" 
             ${idPrefix ? `data-company-id="${idPrefix}"` : ''}>
          ${siteInfo.descriptions.political ? (maxLength && siteInfo.descriptions.political.length > maxLength ? siteInfo.descriptions.political.substring(0, maxLength) + '...' : siteInfo.descriptions.political) : ''}
        </div>
      </div>
    `;
  },

  // Create complete description container
  createDescriptionContainer(siteInfo, options = {}) {
    const {
      tabClass = 'desc-tab',
      contentClass = 'desc-content',
      idPrefix = '',
      maxLength = 120,
      containerClass = 'susradar-description-container',
      tabsContainerClass = 'description-tabs'
    } = options;

    return `
      <div class="${containerClass}">
        ${this.createDescriptionTabs(siteInfo, tabClass, idPrefix, tabsContainerClass)}
        ${this.createDescriptionContent(siteInfo, contentClass, idPrefix, maxLength)}
      </div>
    `;
  },

  // Create rating display
  createRatingDisplay(siteInfo) {
    return `
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
    `;
  },

  // Create alternatives section
  createAlternativesSection(siteInfo, maxVisible = 3) {
    if (!siteInfo.alternative_links || siteInfo.alternative_links.length === 0) {
      return '';
    }

    return `
      <div class="susradar-alternatives">
        <h4>🌟 Better Companies:</h4>
        <ul>
          ${siteInfo.alternative_links.slice(0, maxVisible).map(link => `
            <li><a href="${link}" target="_blank">${this.getDomainFromUrl(link)}</a></li>
          `).join('')}
          ${siteInfo.alternative_links.length > maxVisible ? '<li class="more-alternatives">+ more in management page</li>' : ''}
        </ul>
      </div>
    `;
  },

  // Create control buttons
  createControlButtons(isTracked, options = {}) {
    const { showAllEntries = false } = options;
    
    return `
      <div class="control-buttons">
        ${isTracked ? '<button class="control-btn manage-btn" title="Manage Entry">⚙️</button>' : '<button class="control-btn add-btn" title="Add to Radar">➕</button>'}
        ${!isTracked && showAllEntries ? '<button class="control-btn all-entries-btn" title="Manage All Entries">⚙️</button>' : ''}
        <button class="susradar-close" title="Close">✕</button>
      </div>
    `;
  },

  // Create form description tabs (for editing)
  createFormDescriptionTabs() {
    return `
      <div class="form-description-tabs">
        <button type="button" class="form-desc-tab active" data-category="usability" title="Usability & Information Quality">🖥️</button>
        <button type="button" class="form-desc-tab" data-category="customer" title="Customer Protection & Scam Risk">🛡️</button>
        <button type="button" class="form-desc-tab" data-category="political" title="Political & Legal Issues">⚖️</button>
      </div>
    `;
  },

  // Create form description content (for editing)
  createFormDescriptionContent() {
    return `
      <div class="form-description-content">
        <div class="form-desc-content active" data-category="usability">
          <textarea id="usabilityInput" rows="3" placeholder="How is the site's usability? Is information presented effectively and accurately? Are there excessive ads, paywalls, or auto-generated content?"></textarea>
        </div>
        <div class="form-desc-content" data-category="customer">
          <textarea id="customerInput" rows="3" placeholder="Are they selling overpriced dropshipped goods? Counterfeit products? Is this a scam? Are they exploiting customer ignorance?"></textarea>
        </div>
        <div class="form-desc-content" data-category="political">
          <textarea id="politicalInput" rows="3" placeholder="Are they suing smaller companies? Lying to customers? Lobbying for harmful changes? Union busting? Environmental damage? Are they evil?"></textarea>
        </div>
      </div>
    `;
  },

  // Create rating slider
  createRatingSlider(value = 3) {
    return `
      <div class="rating-input-container">
        <div class="rating-slider-wrapper">
          <input type="range" id="susRating" min="1" max="5" value="${value}">
          <span id="ratingDisplay">${value}</span>
        </div>
        <div class="rating-labels">
          <span>Safe</span>
          <span>Sus AF</span>
        </div>
      </div>
    `;
  },

  // Utility function to get domain from URL
  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  },

  // Switch description tab (general function)
  switchDescriptionTab(category, container, tabClass = 'desc-tab', contentClass = 'desc-content') {
    // Update tab active states
    const tabs = container.querySelectorAll(`.${tabClass}`);
    tabs.forEach(tab => {
      if (tab.getAttribute('data-category') === category) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update content active states
    const contents = container.querySelectorAll(`.${contentClass}`);
    contents.forEach(content => {
      if (content.getAttribute('data-category') === category) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  },

  // Switch entry-specific description tab
  switchEntryDescriptionTab(category, companyId) {
    // Update tab active states for this specific entry
    const tabs = document.querySelectorAll(`[data-company-id="${companyId}"].entry-desc-tab`);
    tabs.forEach(tab => {
      if (tab.getAttribute('data-category') === category) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update content active states for this specific entry
    const contents = document.querySelectorAll(`[data-company-id="${companyId}"].entry-desc-content`);
    contents.forEach(content => {
      if (content.getAttribute('data-category') === category) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  },

  // Attach description tab event listeners
  attachDescriptionTabListeners(container, tabClass = 'desc-tab', contentClass = 'desc-content') {
    const tabs = container.querySelectorAll(`.${tabClass}`);
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        if (!tab.disabled && !tab.classList.contains('disabled')) {
          const category = tab.getAttribute('data-category');
          this.switchDescriptionTab(category, container, tabClass, contentClass);
        }
      });
    });
  },

  // Attach form description tab listeners
  attachFormDescriptionTabListeners(container) {
    const tabs = container.querySelectorAll('.form-desc-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const category = tab.getAttribute('data-category');
        this.switchFormDescriptionTab(category, container);
      });
    });
  },

  // Switch form description tab
  switchFormDescriptionTab(category, container) {
    // Update form tab active states
    const tabs = container.querySelectorAll('.form-desc-tab');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-category') === category) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update form content active states
    const contents = container.querySelectorAll('.form-desc-content');
    contents.forEach(content => {
      if (content.getAttribute('data-category') === category) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  },

  // Auto-resize textarea
  autoResize(event) {
    const textarea = event.target;
    
    // Reset height to auto to get the actual scroll height
    textarea.style.height = 'auto';
    
    // Calculate the required height
    const scrollHeight = textarea.scrollHeight;
    const minHeight = parseInt(getComputedStyle(textarea).minHeight, 10) || 80;
    
    // Set the height to either scroll height or minimum height, whichever is larger
    textarea.style.height = Math.max(scrollHeight + 4, minHeight) + 'px';
  },

  // Update rating display
  updateRatingDisplay(container) {
    const rating = container.querySelector('#susRating')?.value || container.querySelector('#editSusRating')?.value || 3;
    const display = container.querySelector('#ratingDisplay') || container.querySelector('#editRatingDisplay');
    if (display) display.textContent = rating;
  },

  // Show success message
  showSuccessMessage(message, duration = 3000) {
    const successMsg = document.createElement('div');
    successMsg.textContent = message;
    successMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(successMsg);
    setTimeout(() => {
      successMsg.remove();
    }, duration);
  },

  // Open all-entries page
  openAllEntries(focusCompanyId = null) {
    const baseUrl = chrome.runtime.getURL('src/pages/all-entries.html');
    const url = focusCompanyId ? `${baseUrl}?focus=${encodeURIComponent(focusCompanyId)}` : baseUrl;
    window.open(url, '_blank');
  }
};

// Form handling utilities
const SusRadarForms = {
  // Get multi-category description values from form
  getDescriptionValues(container) {
    const usabilityDesc = container.querySelector('#usabilityInput')?.value.trim() || '';
    const customerDesc = container.querySelector('#customerInput')?.value.trim() || '';
    const politicalDesc = container.querySelector('#politicalInput')?.value.trim() || '';
    
    return { usabilityDesc, customerDesc, politicalDesc };
  },

  // Create site info object for saving
  createSiteInfoObject(formData, existingSiteInfo = null) {
    const {
      companyName,
      susRating,
      usabilityDesc,
      customerDesc,
      politicalDesc,
      alternativeLinks,
      defaultDesc
    } = formData;

    // Determine if this is modifying an original SusRadar entry
    const isModifyingOriginal = existingSiteInfo && existingSiteInfo.origin === 'susradar' && !existingSiteInfo.is_modified;
    
    // Auto-determine default if not provided
    const finalDefaultDesc = defaultDesc || SusRadarUtils.determineDefaultDescription(usabilityDesc, customerDesc, politicalDesc);

    return {
      company_name: companyName,
      sus_rating: susRating,
      descriptions: {
        usability: usabilityDesc,
        customer: customerDesc,
        political: politicalDesc
      },
      default_description: finalDefaultDesc,
      description: usabilityDesc, // For backward compatibility
      alternative_links: alternativeLinks,
      date_added: existingSiteInfo ? existingSiteInfo.date_added : new Date().toISOString(),
      user_added: existingSiteInfo ? existingSiteInfo.user_added : true,
      origin: existingSiteInfo ? existingSiteInfo.origin : 'user',
      is_modified: isModifyingOriginal ? true : (existingSiteInfo ? existingSiteInfo.is_modified : false),
      original_data: isModifyingOriginal ? {
        company_name: existingSiteInfo.company_name,
        sus_rating: existingSiteInfo.sus_rating,
        descriptions: existingSiteInfo.descriptions,
        default_description: existingSiteInfo.default_description,
        description: existingSiteInfo.description,
        alternative_links: existingSiteInfo.alternative_links
      } : (existingSiteInfo ? existingSiteInfo.original_data : null)
    };
  },

  // Validate form data
  validateFormData(formData) {
    if (!formData.companyName) {
      throw new Error('Company name is required');
    }
    
    if (isNaN(formData.susRating) || formData.susRating < 1 || formData.susRating > 5) {
      throw new Error('Please enter a valid rating between 1 and 5');
    }
    
    return true;
  }
};