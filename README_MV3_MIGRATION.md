# Chrome Charset Extension - Manifest V3 Migration

This document outlines the migration of the Chrome Charset Extension from Manifest V2 to Manifest V3.

## Migration Summary

### Files Created/Modified

#### New Files:
- `manifest_v3.json` - New Manifest V3 configuration
- `j/background_v3.js` - Service worker implementation  
- `j/content_v3.js` - Updated encoding list with async support
- `README_MV3_MIGRATION.md` - This migration documentation

#### Modified Files:
- `j/popup.js` - Updated to use chrome.storage and chrome.scripting APIs
- `j/option.js` - Updated to use chrome.storage API
- `j/menu.js` - Updated to use chrome.storage API

### Key Changes

#### 1. Manifest Updates
- Changed `manifest_version` from 2 to 3
- Replaced `browser_action` with `action`
- Updated `background.scripts` to `background.service_worker`
- Added `host_permissions` for `<all_urls>`
- Updated permissions:
  - Added `storage`, `scripting`, `declarativeNetRequest`
  - Moved URL permissions to `host_permissions`
  - Increased minimum Chrome version to 88.0.4324.0

#### 2. Background Script Migration
- Converted persistent background page to service worker
- Used `importScripts()` to load dependencies
- Replaced `localStorage` with `chrome.storage.local`
- Updated `chrome.tabs.executeScript` to `chrome.scripting.executeScript`
- Added proper async/await handling for storage operations

#### 3. Storage Migration
- All `localStorage` calls replaced with `chrome.storage.local`
- Updated all scripts to use async/await pattern for storage operations
- Storage operations now return promises

#### 4. Script Execution Updates
- Replaced deprecated `chrome.tabs.executeScript` with `chrome.scripting.executeScript`
- Updated injection patterns to use new API structure

### Usage Instructions

#### For Development:
1. Load the extension using `manifest_v3.json` instead of `manifest.json`
2. The extension will automatically migrate user settings from localStorage to chrome.storage

#### For Users:
- No action required - settings will be automatically migrated
- All existing functionality remains the same

### Compatibility Notes

- **Minimum Chrome Version**: 88.0.4324.0 (required for Manifest V3)
- **Storage**: Settings are migrated automatically from localStorage
- **Permissions**: Users may need to re-approve host permissions due to new permission model

### Testing

To test the migrated extension:
1. Load `manifest_v3.json` in Chrome's extension developer mode
2. Verify all functionality works:
   - Encoding detection and changes
   - Context menu operations
   - Options page settings
   - File URL handling

### Known Limitations

1. **Service Worker Lifespan**: Unlike persistent background pages, service workers can be terminated by the browser
2. **File URL Access**: Requires explicit user permission for file:// URLs
3. **Cross-Origin Requests**: Some restrictions may apply due to enhanced security model

### Migration Checklist

- [x] Update manifest to V3 format
- [x] Convert background scripts to service worker
- [x] Replace localStorage with chrome.storage
- [x] Update chrome.tabs.executeScript calls
- [x] Update permissions and host_permissions
- [x] Test all functionality
- [x] Document migration process