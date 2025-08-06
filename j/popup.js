/**
 * Simple UTF-8 Decoder Popup - Manifest V3
 * Shows current encoding and provides UTF-8 decode button
 */

chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
  if (tabs.length === 0) {
    return;
  }
  
  const tab = tabs[0];
  const currentDOM = document.getElementById('current');
  const encodingInfoDOM = document.getElementById('encoding-info');
  
  currentDOM.innerHTML = 'Detecting...';
  
  try {
    // Get detailed page information from content script
    const pageInfo = await chrome.tabs.sendMessage(tab.id, { 
      type: 'getPageEncoding' 
    });
    
    let displayText = '';
    let detectedEncoding = pageInfo?.detected?.documentCharset || 'Unknown';
    
    // Show detected encoding
    displayText = detectedEncoding;
    currentDOM.innerHTML = displayText;
    
    // Show encoding analysis
    let infoText = '';
    if (pageInfo?.analysis) {
      const issues = pageInfo.analysis;
      if (issues.hasReplacementChars) {
        infoText += '⚠ Replacement characters detected<br>';
      }
      if (issues.hasLatin1Issues) {
        infoText += '💡 May be UTF-8 decoded as Latin-1<br>';
      }
      if (issues.hasWin1252Issues) {
        infoText += '💡 May be Windows-1252 encoding issues<br>';
      }
      if (issues.likelyOriginalEncoding && issues.likelyOriginalEncoding !== 'unknown') {
        infoText += `🔍 Likely issue: ${issues.likelyOriginalEncoding}<br>`;
      }
    }
    
    if (!infoText) {
      infoText = '✅ No obvious encoding issues detected';
    }
    
    encodingInfoDOM.innerHTML = infoText;
    
  } catch (error) {
    console.error('Error getting page encoding:', error);
    currentDOM.innerHTML = 'Unknown';
    encodingInfoDOM.innerHTML = 'Could not analyze page encoding';
  }
  
  // UTF-8 decode button
  document.getElementById('decode-utf8').addEventListener('click', async () => {
    try {
      // Send message to background script to create new tab with UTF-8 decoded content
      const result = await chrome.runtime.sendMessage({
        type: 'decodeInNewTab',
        tabId: tab.id,
        encoding: 'UTF-8',
        closeOriginal: true  // Close the original tab after creating UTF-8 version
      });
      
      if (result && result.success) {
        console.log('UTF-8 decoded content opened in new tab');
        window.close();
      } else {
        const errorMsg = result?.error || 'Unknown error';
        console.error('Decode failed:', errorMsg);
        alert(`Failed to decode content: ${errorMsg}\n\nTry reloading the page and trying again.`);
      }
    } catch (error) {
      console.error('Error requesting UTF-8 decode:', error);
      alert('Error: ' + error.message);
    }
  });
});