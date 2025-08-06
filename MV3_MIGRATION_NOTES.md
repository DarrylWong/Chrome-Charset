# Chrome Charset Extension - Manifest V3 Migration

This extension has been successfully migrated from Manifest V2 to V3.

## Key Changes

### ✅ What Was Migrated
- **Manifest V3 compliance**: Updated manifest.json to version 3
- **Service Worker**: Background scripts converted to service worker
- **Content Scripts**: New content script for charset detection and page parsing
- **Storage API**: Migrated from localStorage to chrome.storage.local
- **Scripting API**: Updated from deprecated chrome.tabs.executeScript to chrome.scripting
- **Permissions**: Updated permission model for V3

### ⚠️ Limitations in V3
- **No HTTP Header Modification**: Cannot intercept and modify Content-Type headers like V2
- **Limited Charset Control**: Cannot force browser to interpret pages with different charset
- **Page Reload Required**: Most encoding changes now require page reload for full effect
- **Reduced Web Page Support**: Works better with local files than web content

### 🛠️ New Functionality
- **Enhanced Detection**: Better charset detection from meta tags and document properties
- **Issue Analysis**: Detects common encoding problems (garbled characters, etc.)
- **Local File Support**: Improved handling of file:// URLs with proper encoding
- **Visual Feedback**: Shows detected vs selected encoding in popup

## Testing the Extension

1. **Load in Developer Mode**:
   - Open Chrome Extensions page (chrome://extensions/)
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. **Test Basic Functionality**:
   - Click the extension icon to open popup
   - Should show detected page encoding
   - Try selecting different encodings from the list

3. **Test with Local Files**:
   - Open a text file with known encoding issues
   - Use the extension to change encoding
   - File should reload with correct charset

4. **Check Context Menu** (if enabled):
   - Right-click on any page
   - Should see charset options in context menu

## Troubleshooting

- **Service Worker Errors**: Check browser console for error messages
- **Content Script Issues**: Verify content script is injected on all pages
- **Storage Problems**: Clear extension storage if migrating from V2

## Files Changed
- `manifest.json` - Updated to V3 format
- `j/background.js` - Converted to service worker
- `j/content-script.js` - New content script for V3
- `j/encoding.js` - Removed localStorage dependency  
- `j/popup.js` - Updated for new storage and messaging
- `j/option.js` - Updated for chrome.storage
- `j/menu.js` - Updated for service worker compatibility

The extension maintains backward compatibility while working within V3's security constraints.