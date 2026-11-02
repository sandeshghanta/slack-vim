// Dev hook: a `slack-vim:reload` event in a Slack tab reloads the extension from
// disk (content.js forwards it), so edits can be picked up without opening
// chrome://extensions. Reload the Slack tab afterwards.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg === "reload") chrome.runtime.reload();
});
