/**
 * Background service worker for Chrome Charset extension - Manifest V3
 * Created by Liming on 2017/2/14.
 * Updated for MV3 compatibility
 */

// Import encoding data and menu functionality
importScripts('encoding.js', 'menu.js');

// Storage for encoding settings per tab
const tabEncodings = new Map();
let defaultEncoding = null;

// Utility functions
const recordRecentlySelectedEncoding = async (encoding) => {
  const result = await chrome.storage.local.get(['recent']);
  const recent = (result.recent || '')
    .split(',')
    .filter(e => e && e !== encoding)
    .slice(0, 2);
  
  await chrome.storage.local.set({
    recent: [encoding, ...recent].join(',')
  });
  
  // Update the encoding lists for menu sorting
  await initializeEncodingLists();
};

// Main encoding management functions
const setEncoding = async (tabId, encoding) => {
  tabEncodings.set(tabId, encoding);
  await recordRecentlySelectedEncoding(encoding);
  
  // Notify content script about encoding change
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'setPageEncoding',
      encoding: encoding
    });
  } catch (error) {
    console.log('Could not send message to content script:', error);
  }
};

const resetEncoding = (tabId) => {
  tabEncodings.delete(tabId);
};

const getEncoding = (tabId) => {
  return tabEncodings.get(tabId) || defaultEncoding;
};

// Setup default encoding from storage
const setupDefaultEncoding = async () => {
  const result = await chrome.storage.local.get(['config_enable_default']);
  defaultEncoding = result.config_enable_default || null;
};

const unsetDefaultEncoding = () => {
  defaultEncoding = null;
};

// Create new tab with UTF-8 decoded content
const createDecodedContentTab = async (sourceTabId, encoding) => {
  try {
    // Get the source tab info
    const sourceTab = await chrome.tabs.get(sourceTabId);
    
    let result;
    
    try {
      // Try to get decoded content from content script
      result = await chrome.tabs.sendMessage(sourceTabId, {
        type: 'getDecodedContent',
        encoding: encoding
      });
    } catch (contentScriptError) {
      console.log('Content script not available, fetching directly...');
      
      // Fallback: inject content script and try again
      try {
        console.log('Injecting content script...');
        await chrome.scripting.executeScript({
          target: { tabId: sourceTabId },
          files: ['j/content-script.js']
        });
        
        // Wait a bit for content script to load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try again
        result = await chrome.tabs.sendMessage(sourceTabId, {
          type: 'getDecodedContent',
          encoding: encoding
        });
      } catch (injectError) {
        throw new Error(`Content script injection failed: ${injectError.message}`);
      }
    }
    
    if (!result || !result.success) {
      throw new Error('Failed to get decoded content');
    }
    
    // Create HTML content for the new tab
    const htmlContent = createDecodedContentHTML(
      result.content, 
      encoding, 
      sourceTab.url, 
      result.originalEncoding
    );
    
    // Create data URL
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    
    // Open new tab with decoded content
    await chrome.tabs.create({
      url: dataUrl,
      active: true
    });
    
  } catch (error) {
    console.error('Error creating decoded content tab:', error);
    throw error;
  }
};

// HTML escape helper
const escapeHtml = (text) => {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Create HTML content for the decoded content tab
const createDecodedContentHTML = (content, encoding, originalUrl, originalEncoding) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>UTF-8 Content</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Regio Mono',monospace;
      font-size: 9pt;
    }
  </style>
</head>
<body>${escapeHtml(content)}</body>
</html>`;
};

// Handle file:// URLs by injecting content with proper encoding
const handleFileUrl = async (tabId, encoding) => {
  try {
    // Get the tab to access its URL
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab.url.toLowerCase().startsWith('file://')) {
      return;
    }

    // For file URLs, we can try to re-read the file content
    // This is a limited workaround since we can't modify headers in MV3
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (selectedEncoding) => {
        // Try to reload the page with a hint about the encoding
        // This is limited but better than nothing
        if (document.readyState === 'loading') {
          // Add charset meta tag if page is still loading
          const metaCharset = document.createElement('meta');
          metaCharset.setAttribute('charset', selectedEncoding);
          if (document.head) {
            document.head.insertBefore(metaCharset, document.head.firstChild);
          }
        } else {
          // Page already loaded - notify user that reload is needed
          console.log(`Encoding changed to ${selectedEncoding}. Page reload may be required for full effect.`);
        }
      },
      args: [encoding]
    });
  } catch (error) {
    console.error('Error handling file URL:', error);
  }
};

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch(message.type) {
        case 'setEncoding':
          await setEncoding(message.tabId, message.encoding);
          await handleFileUrl(message.tabId, message.encoding);
          sendResponse({ success: true });
          break;
          
        case 'resetEncoding':
          resetEncoding(message.tabId);
          sendResponse({ success: true });
          break;
          
        case 'getEncoding':
          sendResponse({ encoding: getEncoding(message.tabId) });
          break;
          
        case 'createMenu':
          removeMenu();
          createMenu();
          sendResponse({ success: true });
          break;
          
        case 'removeMenu':
          removeMenu();
          sendResponse({ success: true });
          break;
          
        case 'setupDefaultEncoding':
          unsetDefaultEncoding();
          await setupDefaultEncoding();
          sendResponse({ success: true });
          break;
          
        case 'unsetDefaultEncoding':
          unsetDefaultEncoding();
          sendResponse({ success: true });
          break;
          
        case 'getPageInfo':
          // New message type to get detected page encoding from content script
          sendResponse({ 
            detectedEncoding: message.detectedEncoding,
            selectedEncoding: getEncoding(sender.tab?.id)
          });
          break;
          
        case 'decodeInNewTab':
          await createDecodedContentTab(message.tabId, message.encoding);
          
          // Close original tab if requested
          if (message.closeOriginal) {
            try {
              await chrome.tabs.remove(message.tabId);
              console.log('Original tab closed after creating UTF-8 version');
            } catch (error) {
              console.error('Failed to close original tab:', error);
            }
          }
          
          sendResponse({ success: true });
          break;
          
        case 'autoDecodeInNewTab':
          // Auto-decode from content script (no tabId needed, use sender.tab.id)
          await createDecodedContentTab(sender.tab.id, message.encoding);
          
          // Close original tab if requested
          if (message.closeOriginal) {
            try {
              await chrome.tabs.remove(sender.tab.id);
              console.log('Original TeamCity log tab closed');
            } catch (error) {
              console.error('Failed to close original tab:', error);
            }
          }
          
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabEncodings.delete(tabId);
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.wasChecked) {
    return;
  }
  try {
    if (info.menuItemId === 'default') {
      resetEncoding(tab.id);
    } else {
      await setEncoding(tab.id, info.menuItemId);
    }
    chrome.tabs.reload(tab.id, { bypassCache: true });
  } catch (error) {
    console.error('Context menu click error:', error);
  }
});

// Initialize
(async () => {
  // Initialize encoding lists first
  await initializeEncodingLists();
  await setupDefaultEncoding();
  
  // Check if context menu should be enabled
  const result = await chrome.storage.local.get(['config_menu']);
  if (result.config_menu === 'true') {
    createMenu();
  }
})();

// Handle installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Chrome Charset MV3 extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated to MV3');
    
    // Initialize encoding lists for new installation
    await initializeEncodingLists();
  }
});