// Debug script to check storage
chrome.storage.local.get(null, (result) => {
  console.log('All storage data:', result);
});
EOF < /dev/null