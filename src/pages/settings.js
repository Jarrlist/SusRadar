// SusRadar Settings Page
let serverProvider = null;
let localProvider = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize providers
    localProvider = new LocalStorageProvider();
    serverProvider = new ServerProvider();
    
    // Load current settings
    await loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update UI based on authentication status
    updateAuthenticationUI();
    
    // Load data statistics
    await updateDataStats();
    
    // Test initial connection
    await testConnection();
});

function setupEventListeners() {
    // Server configuration
    document.getElementById('testConnectionBtn').addEventListener('click', testConnection);
    document.getElementById('saveServerBtn').addEventListener('click', saveServerSettings);
    
    // Authentication
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Form toggles
    document.getElementById('showRegisterForm').addEventListener('click', () => toggleAuthForms('register'));
    document.getElementById('showLoginForm').addEventListener('click', () => toggleAuthForms('login'));
    
    // Data management
    document.getElementById('syncNowBtn').addEventListener('click', syncWithServer);
    document.getElementById('exportDataBtn').addEventListener('click', exportLocalData);
    document.getElementById('clearLocalBtn').addEventListener('click', clearLocalData);
    
    // Real-time server URL validation
    document.getElementById('serverUrl').addEventListener('input', () => {
        updateConnectionStatus('unknown', 'URL changed - click Test Connection');
    });
}

async function loadSettings() {
    try {
        const settings = await chrome.storage.local.get([
            'susradar_server_url',
            'susradar_token',
            'susradar_username'
        ]);
        
        if (settings.susradar_server_url) {
            document.getElementById('serverUrl').value = settings.susradar_server_url;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function testConnection() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    
    if (!serverUrl) {
        showServerStatus('Please enter a server URL', 'error');
        return;
    }
    
    updateConnectionStatus('unknown', 'Testing connection...');
    
    try {
        // Test basic connectivity
        const response = await fetch(`${serverUrl}/health`, { 
            method: 'GET',
            timeout: 5000 
        });
        
        if (response.ok) {
            const data = await response.json();
            updateConnectionStatus('online', `Connected to ${data.service || 'server'}`);
            showServerStatus('Connection successful!', 'success');
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (error) {
        updateConnectionStatus('offline', 'Connection failed');
        showServerStatus(`Connection failed: ${error.message}`, 'error');
    }
}

async function saveServerSettings() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    
    if (!serverUrl) {
        showServerStatus('Please enter a server URL', 'error');
        return;
    }
    
    try {
        await serverProvider.setServerUrl(serverUrl);
        showServerStatus('Server settings saved successfully!', 'success');
        
        // Re-test connection with new URL
        await testConnection();
    } catch (error) {
        showServerStatus(`Error saving settings: ${error.message}`, 'error');
    }
}

function updateConnectionStatus(status, message) {
    const indicator = document.getElementById('connectionIndicator');
    const statusText = document.getElementById('connectionStatus');
    
    indicator.className = `status-indicator ${status}`;
    statusText.textContent = message;
}

function showServerStatus(message, type) {
    const statusDiv = document.getElementById('serverStatus');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function showAuthStatus(message, type) {
    const statusDiv = document.getElementById('authStatus');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function showDataStatus(message, type) {
    const statusDiv = document.getElementById('dataStatus');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function toggleAuthForms(form) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (form === 'register') {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    } else {
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
    }
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAuthStatus('Please enter both username and password', 'error');
        return;
    }
    
    try {
        await serverProvider.login(username, password);
        showAuthStatus('Login successful!', 'success');
        updateAuthenticationUI();
        await updateDataStats();
    } catch (error) {
        showAuthStatus(`Login failed: ${error.message}`, 'error');
    }
}

async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!username || !password || !confirmPassword) {
        showAuthStatus('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthStatus('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 8) {
        showAuthStatus('Password must be at least 8 characters long', 'error');
        return;
    }
    
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        showAuthStatus('Username must be 3-30 characters, alphanumeric and underscore only', 'error');
        return;
    }
    
    try {
        await serverProvider.register(username, password);
        showAuthStatus('Registration successful! You can now login.', 'success');
        
        // Clear form and switch to login
        document.getElementById('registerUsername').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        toggleAuthForms('login');
    } catch (error) {
        showAuthStatus(`Registration failed: ${error.message}`, 'error');
    }
}

async function handleLogout() {
    try {
        await serverProvider.logout();
        showAuthStatus('Logged out successfully', 'success');
        updateAuthenticationUI();
        await updateDataStats();
    } catch (error) {
        showAuthStatus(`Logout error: ${error.message}`, 'error');
    }
}

function updateAuthenticationUI() {
    const userInfo = document.getElementById('userInfo');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const currentUser = document.getElementById('currentUser');
    
    if (serverProvider.isAuthenticated()) {
        userInfo.style.display = 'block';
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        currentUser.textContent = serverProvider.getUsername();
        
        // Clear form fields
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    } else {
        userInfo.style.display = 'none';
        loginForm.style.display = '';
        registerForm.style.display = '';
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    }
}

async function updateDataStats() {
    try {
        const data = await localProvider.getAllSites();
        const companyCount = Object.keys(data.companies || {}).length;
        const urlCount = Object.keys(data.mappings || {}).length;
        
        document.getElementById('companyCount').textContent = companyCount;
        document.getElementById('urlCount').textContent = urlCount;
        
        // Try to get last sync time
        const lastSync = await chrome.storage.local.get(['susradar_last_sync']);
        if (lastSync.susradar_last_sync) {
            const syncDate = new Date(lastSync.susradar_last_sync);
            document.getElementById('lastSync').textContent = syncDate.toLocaleDateString();
        } else {
            document.getElementById('lastSync').textContent = 'Never';
        }
    } catch (error) {
        console.error('Error updating data stats:', error);
        document.getElementById('companyCount').textContent = 'Error';
        document.getElementById('urlCount').textContent = 'Error';
    }
}

async function syncWithServer() {
    if (!serverProvider.isAuthenticated()) {
        showDataStatus('Please login first to sync with server', 'error');
        return;
    }
    
    try {
        showDataStatus('Syncing with server...', 'warning');
        const success = await serverProvider.syncWithServer();
        
        if (success) {
            // Save sync timestamp
            await chrome.storage.local.set({
                'susradar_last_sync': new Date().toISOString()
            });
            
            showDataStatus('Successfully synced with server!', 'success');
            await updateDataStats();
        } else {
            showDataStatus('Sync failed - check connection and try again', 'error');
        }
    } catch (error) {
        showDataStatus(`Sync error: ${error.message}`, 'error');
    }
}

async function exportLocalData() {
    try {
        const data = await localProvider.getAllSites();
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `susradar-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showDataStatus('Data exported successfully!', 'success');
    } catch (error) {
        showDataStatus(`Export error: ${error.message}`, 'error');
    }
}

async function clearLocalData() {
    if (!confirm('Are you sure you want to clear all local data? This cannot be undone!')) {
        return;
    }
    
    try {
        // Clear all SusRadar data from local storage
        await chrome.storage.local.clear();
        
        showDataStatus('Local data cleared successfully!', 'success');
        await updateDataStats();
        updateAuthenticationUI();
        
        // Reset server provider
        serverProvider = new ServerProvider();
    } catch (error) {
        showDataStatus(`Error clearing data: ${error.message}`, 'error');
    }
}