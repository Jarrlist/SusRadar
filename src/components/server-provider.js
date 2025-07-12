// SusRadar Server Provider - API client for communicating with Flask server
// Handles authentication, data sync, and server communication

class ServerProvider {
    constructor(serverUrl = 'http://localhost:5000') {
        this.serverUrl = serverUrl;
        this.token = null;
        this.username = null;
        this.isOnline = navigator.onLine;
        this.localProvider = new LocalStorageProvider(); // Fallback for offline mode
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncWithServer();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        // Load saved credentials
        this.loadCredentials();
    }
    
    async loadCredentials() {
        try {
            const stored = await chrome.storage.local.get(['susradar_token', 'susradar_username', 'susradar_server_url']);
            if (stored.susradar_token) {
                this.token = stored.susradar_token;
                this.username = stored.susradar_username;
                if (stored.susradar_server_url) {
                    this.serverUrl = stored.susradar_server_url;
                }
                
                // Verify token is still valid
                if (this.isOnline) {
                    const isValid = await this.verifyToken();
                    if (!isValid) {
                        await this.clearCredentials();
                    }
                }
            }
        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    }
    
    async saveCredentials() {
        try {
            await chrome.storage.local.set({
                'susradar_token': this.token,
                'susradar_username': this.username,
                'susradar_server_url': this.serverUrl
            });
        } catch (error) {
            console.error('Error saving credentials:', error);
        }
    }
    
    async clearCredentials() {
        this.token = null;
        this.username = null;
        try {
            await chrome.storage.local.remove(['susradar_token', 'susradar_username']);
        } catch (error) {
            console.error('Error clearing credentials:', error);
        }
    }
    
    async makeRequest(endpoint, options = {}) {
        const url = `${this.serverUrl}/api${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            }
        };
        
        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, requestOptions);
            
            if (response.status === 401) {
                // Token expired or invalid
                await this.clearCredentials();
                throw new Error('Authentication failed');
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (!this.isOnline) {
                throw new Error('Server unavailable - working offline');
            }
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to server - check URL and ensure server is running');
            }
            
            // Handle timeout errors
            if (error.name === 'AbortError') {
                throw new Error('Request timed out - server may be slow or unreachable');
            }
            
            throw error;
        }
    }
    
    async verifyToken() {
        if (!this.token) return false;
        
        try {
            await this.makeRequest('/data');
            return true;
        } catch (error) {
            return false;
        }
    }
    
    async register(username, password) {
        const response = await this.makeRequest('/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        return response;
    }
    
    async login(username, password) {
        const response = await this.makeRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.token) {
            this.token = response.token;
            this.username = response.username;
            await this.saveCredentials();
        }
        
        return response;
    }
    
    async logout() {
        await this.clearCredentials();
    }
    
    isAuthenticated() {
        return !!this.token;
    }
    
    getUsername() {
        return this.username;
    }
    
    // SusRadar Provider Interface Implementation
    async getAllSites() {
        if (!this.isOnline || !this.isAuthenticated()) {
            return await this.localProvider.getAllSites();
        }
        
        try {
            const data = await this.makeRequest('/data');
            
            // Also cache locally for offline access
            await this.localProvider.saveAllSites(data);
            
            return data;
        } catch (error) {
            console.warn('Server request failed, using local data:', error.message);
            return await this.localProvider.getAllSites();
        }
    }
    
    async saveAllSites(data) {
        // Always save locally first
        await this.localProvider.saveAllSites(data);
        
        if (this.isOnline && this.isAuthenticated()) {
            try {
                await this.makeRequest('/data', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            } catch (error) {
                console.warn('Failed to sync to server:', error.message);
                // Data is still saved locally, so this isn't a critical failure
            }
        }
    }
    
    async getSiteInfo(url) {
        const data = await this.getAllSites();
        const cleanUrl = SusRadarUtils.cleanUrl(url);
        const companyId = data.mappings[cleanUrl];
        
        if (companyId && data.companies[companyId]) {
            return new CompanyData(data.companies[companyId]);
        }
        
        return null;
    }
    
    async addSite(companyData) {
        const data = await this.getAllSites();
        const companyId = SusRadarUtils.generateId();
        
        data.companies[companyId] = companyData;
        
        if (companyData.urls && Array.isArray(companyData.urls)) {
            companyData.urls.forEach(url => {
                const cleanUrl = SusRadarUtils.cleanUrl(url);
                data.mappings[cleanUrl] = companyId;
            });
        }
        
        await this.saveAllSites(data);
        return companyId;
    }
    
    async updateSite(companyId, companyData) {
        const data = await this.getAllSites();
        
        if (data.companies[companyId]) {
            // Remove old URL mappings
            Object.keys(data.mappings).forEach(url => {
                if (data.mappings[url] === companyId) {
                    delete data.mappings[url];
                }
            });
            
            // Update company data
            data.companies[companyId] = companyData;
            
            // Add new URL mappings
            if (companyData.urls && Array.isArray(companyData.urls)) {
                companyData.urls.forEach(url => {
                    const cleanUrl = SusRadarUtils.cleanUrl(url);
                    data.mappings[cleanUrl] = companyId;
                });
            }
            
            await this.saveAllSites(data);
            return true;
        }
        
        return false;
    }
    
    async deleteSite(companyId) {
        if (this.isOnline && this.isAuthenticated()) {
            try {
                await this.makeRequest(`/companies/${companyId}`, {
                    method: 'DELETE'
                });
                
                // Also delete locally
                await this.localProvider.deleteSite(companyId);
                return true;
            } catch (error) {
                console.warn('Failed to delete from server:', error.message);
            }
        }
        
        // Delete locally regardless
        return await this.localProvider.deleteSite(companyId);
    }
    
    async syncWithServer() {
        if (!this.isOnline || !this.isAuthenticated()) {
            return false;
        }
        
        try {
            // Get local data
            const localData = await this.localProvider.getAllSites();
            
            // Sync with server
            const response = await this.makeRequest('/data/sync', {
                method: 'POST',
                body: JSON.stringify(localData)
            });
            
            // Update local data with merged result
            await this.localProvider.saveAllSites(response.data);
            
            console.log('Successfully synced with server');
            return true;
        } catch (error) {
            console.warn('Sync failed:', error.message);
            return false;
        }
    }
    
    async addUrl(companyId, url) {
        const data = await this.getAllSites();
        
        if (data.companies[companyId]) {
            const cleanUrl = SusRadarUtils.cleanUrl(url);
            data.mappings[cleanUrl] = companyId;
            
            // Update company's URL list if it exists
            if (!data.companies[companyId].urls) {
                data.companies[companyId].urls = [];
            }
            
            if (!data.companies[companyId].urls.includes(url)) {
                data.companies[companyId].urls.push(url);
            }
            
            await this.saveAllSites(data);
            return true;
        }
        
        return false;
    }
    
    async removeUrl(url) {
        const data = await this.getAllSites();
        const cleanUrl = SusRadarUtils.cleanUrl(url);
        const companyId = data.mappings[cleanUrl];
        
        if (companyId) {
            delete data.mappings[cleanUrl];
            
            // Also remove from company's URL list
            if (data.companies[companyId] && data.companies[companyId].urls) {
                data.companies[companyId].urls = data.companies[companyId].urls.filter(u => u !== url);
            }
            
            await this.saveAllSites(data);
            return true;
        }
        
        return false;
    }
    
    // Server-specific methods
    async setServerUrl(url) {
        this.serverUrl = url;
        await chrome.storage.local.set({ 'susradar_server_url': url });
    }
    
    getServerUrl() {
        return this.serverUrl;
    }
    
    async testConnection() {
        try {
            const response = await fetch(`${this.serverUrl}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}