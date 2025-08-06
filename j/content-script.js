/**
 * Content script for Chrome Charset extension - Manifest V3
 * Handles charset detection and page modification without webRequest API
 */

let currentEncoding = null;
let originalCharset = null;

// Detect encoding from various sources
function detectPageEncoding() {
  // Try multiple methods to detect charset
  const detectedEncodings = {
    documentCharset: document.charset || document.characterSet,
    metaCharset: null,
    metaHttpEquiv: null,
    xmlDeclaration: null
  };
  
  // Check meta charset tag
  const metaCharset = document.querySelector('meta[charset]');
  if (metaCharset) {
    detectedEncodings.metaCharset = metaCharset.getAttribute('charset');
  }
  
  // Check meta http-equiv content-type
  const metaHttpEquiv = document.querySelector('meta[http-equiv="content-type" i]');
  if (metaHttpEquiv) {
    const content = metaHttpEquiv.getAttribute('content');
    const charsetMatch = content && content.match(/charset\s*=\s*([^;,\s]+)/i);
    if (charsetMatch) {
      detectedEncodings.metaHttpEquiv = charsetMatch[1];
    }
  }
  
  // Check XML declaration for XML documents
  if (document.contentType && document.contentType.includes('xml')) {
    const xmlDeclaration = document.documentElement?.outerHTML?.match(/encoding\s*=\s*["']([^"']+)["']/i);
    if (xmlDeclaration) {
      detectedEncodings.xmlDeclaration = xmlDeclaration[1];
    }
  }
  
  return detectedEncodings;
}

// Analyze text content for common encoding issues
function analyzeTextContent() {
  const textSample = document.body?.textContent?.substring(0, 1000) || '';
  const issues = {
    hasReplacementChars: /�/.test(textSample),
    hasLatin1Issues: /Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|Ã¼|Ã¿|Ãº|Ã´|Ã¢|Ã§/.test(textSample), // Common UTF-8 as Latin-1 issues
    hasWin1252Issues: /â€™|â€œ|â€�|â€¢|â€"|â€¦/.test(textSample), // Common Windows-1252 issues
    suspiciousChars: textSample.match(/[^\x00-\x7F\u00A0-\u024F\u1E00-\u1EFF]/g)?.length || 0,
    likelyOriginalEncoding: detectLikelyEncoding(textSample)
  };
  
  return issues;
}

// Detect likely original encoding based on garbled patterns
function detectLikelyEncoding(textSample) {
  // UTF-8 interpreted as Latin-1 patterns
  if (/Ã[¡-ÿ]/.test(textSample)) {
    return 'utf-8-as-latin1';
  }
  
  // Windows-1252 interpreted as UTF-8 patterns
  if (/â€[™œ�¢"¦]/.test(textSample)) {
    return 'windows-1252-as-utf8';
  }
  
  // Cyrillic in wrong encoding
  if (/Ð[À-Ÿ]|Ñ[€-]./.test(textSample)) {
    return 'cyrillic-wrong-encoding';
  }
  
  return 'unknown';
}

// Handle local file encoding for file:// URLs
async function handleLocalFile(encoding) {
  if (!location.href.startsWith('file://')) {
    return false;
  }
  
  try {
    // For local files, we can attempt to re-read the content with the correct encoding
    // This is limited since we can't truly change how the browser interprets the file
    const response = await fetch(location.href);
    const buffer = await response.arrayBuffer();
    
    // Use TextDecoder to decode with the specified encoding
    const decoder = new TextDecoder(encoding);
    const decodedText = decoder.decode(buffer);
    
    // Determine if this is HTML or plain text
    const isHtml = location.pathname.match(/\.html?$/i);
    
    if (isHtml) {
      // For HTML files, replace the document content
      document.open();
      document.write(decodedText);
      document.close();
    } else {
      // For text files, wrap in <pre> and display
      document.open();
      document.write(`<pre>${escapeHtml(decodedText)}</pre>`);
      document.close();
    }
    
    return true;
  } catch (error) {
    console.error('Error re-reading local file:', error);
    return false;
  }
}

// Escape HTML special characters
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Decode and show content with specified encoding
async function decodeAndShowContent(encoding) {
  currentEncoding = encoding;
  console.log(`Decoding content as: ${encoding}`);
  
  try {
    // Fetch the raw content
    const response = await fetch(location.href);
    const buffer = await response.arrayBuffer();
    
    // Decode with the specified encoding
    const decoder = new TextDecoder(encoding);
    const decodedContent = decoder.decode(buffer);
    
    // Show the decoded content in an overlay
    showDecodedContentOverlay(decodedContent, encoding);
    
    return { success: true, encoding: encoding, hasOverlay: true };
  } catch (error) {
    console.error('Error decoding content:', error);
    return { success: false, error: error.message };
  }
}

// Show decoded content in an overlay
function showDecodedContentOverlay(content, encoding) {
  // Remove any existing overlay
  const existingOverlay = document.getElementById('charset-decoder-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'charset-decoder-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: monospace;
  `;
  
  // Create content container
  const contentContainer = document.createElement('div');
  contentContainer.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 90%;
    max-height: 90%;
    overflow: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    position: relative;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    border-bottom: 1px solid #ccc;
    padding-bottom: 10px;
    margin-bottom: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    color: #333;
  `;
  
  const title = document.createElement('span');
  title.textContent = `Content decoded as ${encoding}`;
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeButton.onclick = () => overlay.remove();
  
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.style.cssText = `
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 14px;
    margin-right: 10px;
  `;
  copyButton.onclick = () => {
    navigator.clipboard.writeText(content).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => copyButton.textContent = 'Copy', 2000);
    });
  };
  
  header.appendChild(title);
  const buttonContainer = document.createElement('div');
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(closeButton);
  header.appendChild(buttonContainer);
  
  // Create content display
  const contentDisplay = document.createElement('pre');
  contentDisplay.style.cssText = `
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.4;
    color: #333;
    margin: 0;
    background: #f8f8f8;
    padding: 15px;
    border-radius: 4px;
    border: 1px solid #ddd;
  `;
  contentDisplay.textContent = content;
  
  // Assemble overlay
  contentContainer.appendChild(header);
  contentContainer.appendChild(contentDisplay);
  overlay.appendChild(contentContainer);
  
  // Add to page
  document.body.appendChild(overlay);
  
  // Close on click outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

// Get decoded content for new tab
async function getDecodedContentForNewTab(encoding) {
  try {
    console.log(`Getting decoded content for new tab using encoding: ${encoding}`);
    
    // Fetch the raw content
    const response = await fetch(location.href);
    const buffer = await response.arrayBuffer();
    
    // Decode with the specified encoding
    const decoder = new TextDecoder(encoding);
    const decodedContent = decoder.decode(buffer);
    
    // Get original encoding info
    const detectedEncodings = detectPageEncoding();
    const originalEncoding = detectedEncodings.documentCharset;
    
    return {
      success: true,
      content: decodedContent,
      originalEncoding: originalEncoding,
      encoding: encoding,
      url: location.href
    };
    
  } catch (error) {
    console.error('Error getting decoded content:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Update meta charset tags
function updateMetaCharset(encoding) {
  console.log(`Updating meta charset to: ${encoding}`);
  
  // Try to add or update charset meta tag
  let metaCharset = document.querySelector('meta[charset]');
  if (!metaCharset) {
    metaCharset = document.querySelector('meta[http-equiv="content-type" i]');
    if (!metaCharset) {
      // Create new charset meta tag
      metaCharset = document.createElement('meta');
      metaCharset.setAttribute('charset', encoding);
      if (document.head) {
        document.head.insertBefore(metaCharset, document.head.firstChild);
      }
    } else {
      // Update existing content-type meta
      const content = metaCharset.getAttribute('content');
      if (content) {
        const newContent = content.replace(/charset\s*=\s*[^;,\s]+/i, `charset=${encoding}`);
        if (newContent === content) {
          // No charset found, add it
          metaCharset.setAttribute('content', `${content}; charset=${encoding}`);
        } else {
          metaCharset.setAttribute('content', newContent);
        }
      }
    }
  } else {
    // Update existing charset meta
    metaCharset.setAttribute('charset', encoding);
  }
}

// Attempt to reprocess page content with new encoding
async function attemptContentReprocessing(encoding) {
  console.log('Attempting content reprocessing...');
  
  try {
    // For pages that might be text files served as HTML or plain text
    if (document.contentType && (
      document.contentType.includes('text/plain') ||
      document.contentType.includes('text/html') ||
      document.contentType.includes('application/octet-stream')
    )) {
      
      // Try to fetch the page again with the proper encoding
      const response = await fetch(location.href);
      const buffer = await response.arrayBuffer();
      
      // Try to decode with the new encoding
      const decoder = new TextDecoder(encoding);
      const redecodedText = decoder.decode(buffer);
      
      // Check if the redecoded text looks better (fewer replacement characters)
      const originalText = document.body.textContent || '';
      const originalReplacementChars = (originalText.match(/�/g) || []).length;
      const newReplacementChars = (redecodedText.match(/�/g) || []).length;
      
      console.log(`Original replacement chars: ${originalReplacementChars}, New: ${newReplacementChars}`);
      
      // If the new encoding seems better, update the page
      if (newReplacementChars < originalReplacementChars || 
          (originalReplacementChars > 0 && newReplacementChars === 0)) {
        
        console.log('New encoding appears better, updating page content');
        
        // Determine content type
        const isHtml = location.pathname.match(/\.html?$/i) || 
                      document.contentType.includes('text/html');
        
        if (isHtml) {
          // For HTML, try to parse and update
          const parser = new DOMParser();
          const newDoc = parser.parseFromString(redecodedText, 'text/html');
          
          if (newDoc.body) {
            document.body.innerHTML = newDoc.body.innerHTML;
            if (newDoc.head && document.head) {
              // Update head content while preserving our charset meta
              const charsetMeta = document.querySelector('meta[charset]');
              document.head.innerHTML = newDoc.head.innerHTML;
              if (charsetMeta) {
                document.head.insertBefore(charsetMeta, document.head.firstChild);
              }
            }
          }
        } else {
          // For plain text, wrap in pre
          document.body.innerHTML = `<pre>${escapeHtml(redecodedText)}</pre>`;
        }
        
        console.log('Page content updated with new encoding');
        return true;
      } else {
        console.log('New encoding does not appear to improve content');
      }
    }
  } catch (error) {
    console.error('Error during content reprocessing:', error);
  }
  
  return false;
}

// Message listener for communication with background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'setPageEncoding':
      // Use the new decode-and-show approach
      decodeAndShowContent(message.encoding)
        .then((result) => {
          console.log(`decodeAndShowContent result:`, result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('decodeAndShowContent error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Async response
      
    case 'getPageEncoding':
      const detectedEncodings = detectPageEncoding();
      const textAnalysis = analyzeTextContent();
      sendResponse({
        detected: detectedEncodings,
        analysis: textAnalysis,
        current: currentEncoding,
        url: location.href
      });
      break;
      
    case 'analyzePageContent':
      sendResponse({
        contentType: document.contentType,
        charset: document.charset || document.characterSet,
        readyState: document.readyState,
        url: location.href,
        title: document.title,
        isFile: location.href.startsWith('file://'),
        textSample: document.body?.textContent?.substring(0, 500)
      });
      break;
      
    case 'getDecodedContent':
      getDecodedContentForNewTab(message.encoding)
        .then((result) => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Store original charset when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    originalCharset = document.charset || document.characterSet;
  });
} else {
  originalCharset = document.charset || document.characterSet;
}

// Check if this is a TeamCity log file (for UI hints, not auto-decode)
function isTeamCityLogFile() {
  return location.href.match(/https:\/\/teamcity\.cockroachdb\.com\/.*\.log$/);
}

// Notify background script about page load and detected encoding
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    const detectedEncodings = detectPageEncoding();
    chrome.runtime.sendMessage({
      type: 'getPageInfo',
      detectedEncoding: detectedEncodings.documentCharset,
      url: location.href
    }).catch(() => {
      // Ignore errors if background script is not ready
    });
    
  }, 100);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const detectedEncodings = detectPageEncoding();
      chrome.runtime.sendMessage({
        type: 'getPageInfo',
        detectedEncoding: detectedEncodings.documentCharset,
        url: location.href
      }).catch(() => {
        // Ignore errors if background script is not ready
      });
      
    }, 100);
  });
}