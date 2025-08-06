/**
 * Created by Liming on 2017/3/22.
 */
const rtl = chrome.i18n.getMessage('@@bidi_dir') === 'rtl' ? '\u{200f}' : '';
const printEncodingInfo = info => `${info[1]} ${rtl}(${info[0]})`;

let selectedMenu;

const menuClicked = async (info, tab) => {
  if (info.wasChecked) {
    return;
  }
  try {
    if (info.menuItemId === 'default') {
      await chrome.runtime.sendMessage({ 
        type: 'resetEncoding', 
        tabId: tab.id 
      });
    } else {
      await chrome.runtime.sendMessage({ 
        type: 'setEncoding', 
        tabId: tab.id, 
        encoding: info.menuItemId 
      });
    }
    chrome.tabs.reload(tab.id, { bypassCache: true });
  } catch (error) {
    console.error('Menu click error:', error);
  }
};

const updateMenu = async (tabId) => {
  try {
    const response = await chrome.runtime.sendMessage({ 
      type: 'getEncoding', 
      tabId: tabId 
    });
    const encoding = response.encoding || 'default';
    
    if (selectedMenu === encoding) {
      return;
    }
    
    chrome.contextMenus.update(selectedMenu, { checked: false });
    chrome.contextMenus.update(encoding, { checked: true });
    selectedMenu = encoding;
  } catch (error) {
    console.error('Error updating menu:', error);
  }
};

const tabUpdatedEvent = tabId => updateMenu(tabId);
const tabActivatedEvent = activeInfo => updateMenu(activeInfo.tabId);
const windowsFocusedEvent = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs.length === 0) {
      return;
    }
    updateMenu(tabs[0].id);
  });
};

const createMenu = () => {
  chrome.contextMenus.create({
    type: 'radio',
    id: 'default',
    title: chrome.i18n.getMessage('default'),
    checked: true
  });
  selectedMenu = 'default';
  for (const encoding of BASE_ENCODINGS) {
    if (encoding.length === 1) {
      continue;
    }
    chrome.contextMenus.create({
      type: 'radio',
      id: encoding[0],
      title: printEncodingInfo(encoding),
      checked: false
    });
  }
  chrome.tabs.onUpdated.addListener(tabUpdatedEvent);
  chrome.tabs.onActivated.addListener(tabActivatedEvent);
  chrome.windows.onFocusChanged.addListener(windowsFocusedEvent);
};

const removeMenu = () => {
  chrome.contextMenus.removeAll();
  chrome.tabs.onUpdated.removeListener(tabUpdatedEvent);
  chrome.tabs.onActivated.removeListener(tabActivatedEvent);
  chrome.windows.onFocusChanged.removeListener(windowsFocusedEvent);
};

// Menu initialization is now handled by background script
// which checks chrome.storage.local for config_menu setting
