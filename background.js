// Background script for Altissia Extension

// Listen for tab updates and execute content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the URL contains 'altissia.org' and page is fully loaded
    if (changeInfo.status === 'complete' && tab.url.includes('altissia.org')) {
        // Execute the content scripts in order
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['interceptor.js']
        });
        
        // Wait a bit and then inject the auto-clicker
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['autoClicker.js']
            });
            
            // Inject the pronunciation handler last
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['pronunciationHandler.js']
            });
        }, 500);
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle messages if needed
    if (message.type === 'EXERCISE_DATA_INTERCEPTED') {
        console.log('Exercise data intercepted in background script');
    }
    return true;
}); 