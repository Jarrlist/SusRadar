chrome.runtime.onInstalled.addListener(() => {
  console.log('SusRadar extension installed! 🚨');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('SusRadar: Tab updated:', tab.url);
  }
});

chrome.action.onClicked.addListener((tab) => {
  console.log('SusRadar: Extension icon clicked for tab:', tab.url);
});