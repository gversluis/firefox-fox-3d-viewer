/**
 * 3D File Viewer - Background Script
 *
 * Intercepts browser navigations to .stl / .obj / .vsb / .3mf files
 * and redirects them to the built-in viewer page.
 */
 

import { defaultSettings, loadSettings, Target } from './viewer/settings.js';
// do not catch anything before loading settings
export const settings = {
  extensions: [],
  stubExtensions: [],
  stubUrl: [],
  target: Target.NEW_NEXT_TAB.value,
};

loadSettings(defaultSettings, newSettings => Object.assign(settings, newSettings) );
const tabUrlCache = new Map();
const isAndroid = navigator.userAgent.toLowerCase().includes("android");
  
browser.action.onClicked.addListener((event) => {
  browser.tabs.create({ url: browser.runtime.getURL(`viewer/upload.html`) });
  /*
  browser.windows.getCurrent().then(w => {
    // console.log('action clicked', w, event);
    const width = 400;
    browser.windows.create({
      url: browser.runtime.getURL(`viewer/upload.html`),
      type: "popup", // or popup with width/height
      top: Math.max(w.top, 0) + 100,
      left: Math.max(w.left + w.width, 0) - width,
      width: width,
      height: Math.min(200, w.height),
    }).then( popup => {
      // console.log('action popup', popup);
      const popupId = popup.id;
      browser.windows.onFocusChanged.addListener(function autoClosePopup(windowId) {
        if (popupId && windowId>0 && windowId !== popupId) {  // windowId -1 = focus outside Firefox
          browser.windows.onFocusChanged.removeListener(autoClosePopup);        
          browser.windows.remove(popupId).catch(() => {});
        }
      });
    });
  });
  */
});

function getFingerprintId(buffer) {
    const data = new Uint8Array(buffer);
    const len = data.length;
    let hash = 0;
    const step = Math.max(1, Math.floor(len / 16));
    for (let i = 0; i < len; i += step) {
        hash = (hash * 31 + data[i]) | 0;
    }
    return len + ":" + (hash >>> 0).toString(16);
}

function getUrl(url='') {
  const ext = url.split("?")[0]?.split("#")[0]?.split('.')?.pop()?.toLowerCase();
  const newUrl = settings.stubExtensions?.includes(ext) ? settings.stubUrl : browser.runtime.getURL(`viewer/viewer.html`); // either directly use extension url or external dummy, since dummy can load blob: and wasm: workers
  console.log('getUrl', newUrl, ext, url, settings.stubExtensions);
  return newUrl;
}

function getFilename(url='') {
    const filename = decodeURI(url.split("?")[0]?.split("#")[0]?.split(/[\/\\]/)?.pop());
    console.log('filename', filename);
    return filename;
}

function hasHttpOrHttpsProtocolOrIsRelative(urlString) {
  const protocolMatch = urlString.match(/^([a-zA-Z][a-zA-Z\d+\-.]*):/);
  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();
    return protocol === "http" || protocol === "https" || protocol === "file";
  } else {
    return true;
  }
}

function is3dFile(url) {
  const ext = url.split(/https?:\/\/[a-zA-Z\-\.]+/).pop().split("?")[0]?.split("#")[0]?.split('.')?.pop()?.toLowerCase();
  console.log('check 3d filename', ext, url);
  return settings.extensions?.includes(ext) ? hasHttpOrHttpsProtocolOrIsRelative(url) : false;
}

function getOnViewerTabLoad(message, windowId) {
  return function(tab) {
    browser.tabs.onUpdated.addListener(function listener(tabId, info, tab) {
        console.log("TABS UPDATED", tabId, info, tab);
        if (tabId === tab.id && info.status === "complete") {
            // browser.tabs.onUpdated.removeListener(listener); // disabled since a refresh needs to trigger this too, that is why the URL must be unique
            if (tab.url == message.url) {
              browser.tabs.sendMessage(tabId, message);
            }
        }
    });
  };
};

function openView(filename, message, tabId) {
  message.cacheId = getFingerprintId(message.data);
  message.url = getUrl(filename) + "?fox3dViewerId=" + message.cacheId;
  const tabProperties = {
      url: message.url,
  };
  const hasTabId = typeof tabId === 'number';
  if (!isAndroid && hasTabId && settings.target != Target.NEW_END_TAB.value && settings.target != Target.NEW_WINDOW.value) tabProperties.openerTabId = tabId;
  const decideView = (message, tabId) => {
    console.log('decide view', message, tabId);
    switch (settings.target) {   // all make string because switch is type sensitive
      case Target.EXISTING_TAB.value: 
        hasTabId ? browser.tabs.update(tabId, { url: message.url }).then(getOnViewerTabLoad(message)) : browser.tabs.create(tabProperties).then(getOnViewerTabLoad(message));;
        break;
      case Target.NEW_NEXT_TAB.value: 
      case Target.NEW_PREV_TAB.value: 
      case Target.NEW_END_TAB.value: 
        browser.tabs.create(tabProperties).then(getOnViewerTabLoad(message));
        break;
      case Target.NEW_WINDOW.value:
        browser.windows.create(tabProperties).then(getOnViewerTabLoad(message));
        break;
      default:
        console.error("Fox 3D viewer has unknown target in settings:", settings.target, Target);
        browser.tabs.create(tabProperties).then(getOnViewerTabLoad(message));   // fall back to default
    }
  };
  setTimeout(function() {
    if (hasTabId && (settings.target == Target.NEW_NEXT_TAB.value || settings.target == Target.NEW_PREV_TAB.value)) {
      browser.tabs.get(tabId).then( tab => {
        tabProperties.index = settings.target == Target.NEW_NEXT_TAB.value ? tab?.index + 1 : tab?.index;
        decideView(message, tabId);
      });
    } else {
      decideView(message, tabId);
    }
  }, 0);
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('onMessage', message, sender);
  if (message.type == 'RELOAD') {
    Object.assign(settings, message.settings);
  } else {
    openView(message.filename, message, sender?.tab?.id)
  }
});

// disabled catching downloads because you first still need to select a download folder and click save, and only then it opens in the viewer which is unexpected behaviour
/*
browser.downloads.onCreated.addListener((downloadItem) => {
  if (is3dFile(downloadItem.filename)) {
    console.log("Download 3D file detected:", downloadItem.filename);
    const viewerUrl = getUrl();
    browser.tabs.create({ url: viewerUrl });
    browser.downloads.cancel(downloadItem.id).catch(() => {});
  }
});
*/

// test URLs:
// HTML: https://github.com/jnweiger/inkscape-input-stl/blob/master/test/pikachu.stl
// 3d file: https://raw.githubusercontent.com/jnweiger/inkscape-input-stl/b21ba60cfeb3ad2fba47f4fb6c7aa116a90f1d2f/test/pikachu.stl
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (is3dFile(details.url)  && !tabUrlCache.get(details.tabId).match(/^view-source:/)) {
      console.log("onBeforeNavigate 3D file detected:", details.url, details);
      const xhr = new XMLHttpRequest(); // we fake the request to intercept the data
      xhr.open(details.method, details.url, false); // false = synchronous
      details.requestHeaders.forEach( e => xhr.setRequestHeader(e.name, e.value));
      xhr.overrideMimeType("text/plain; charset=x-user-defined");
      xhr.send();
      if (xhr.status === 200 && !xhr.getResponseHeader('Content-Type')?.match('text/html') && !xhr.responseText.match(/\s*<!doctype|\s*<html/i)) {
        const binary = xhr.responseText;
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
        // console.log('xhr', xhr);
        // console.log('download', [bytes[0].toString(16),bytes[1].toString(16),bytes[2].toString(16),bytes[3].toString(16),bytes[4].toString(16),bytes[5].toString(16),bytes[6].toString(16),bytes[7].toString(16),bytes[8].toString(16),bytes[9].toString(16)]);
        const message = {
            filename: getFilename(details.url),
            data: bytes.buffer,
        }
        openView(details.url, message, details.tabId)
        console.log("Redirect", message.url);
        return { 
          cancel: true,
          // redirectUrl: message.url,
        };
      }
    }
  },
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
  ['blocking', "requestHeaders"]
);

browser.webNavigation.onBeforeNavigate.addListener(
  (details) => {
      if (details.url) { tabUrlCache.set(details.tabId, details.url); }
  },
);
