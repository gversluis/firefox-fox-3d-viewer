/**
 * 3D File Viewer - Background Script
 *
 * Intercepts browser navigations to .stl / .obj / .vsb / .3mf files
 * and redirects them to the built-in viewer page.
 */
 

import { defaultSettings, loadSettings } from './viewer/settings.js';
// do not catch anything before loading settings
export const settings = {
  extensions: [],
  stubExtensions: [],
  stubUrl: [],
};
loadSettings(defaultSettings, newSettings => Object.assign(settings, newSettings) );
const tabUrlCache = new Map();

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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('onMessage', message);
  if (message.type == 'RELOAD') {
    Object.assign(settings, message.settings);
  } else {
    const viewerUrl = getUrl(message.filename);
    const onLoad = function(tab) {
      browser.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === "complete") {
              browser.tabs.onUpdated.removeListener(listener);
              browser.tabs.sendMessage(tabId, message);
          }
      });
    };
    if (message.type === 'FROM_PAGE') {
      browser.tabs.create({ url: viewerUrl }).then(onLoad);
    } else {
      if (sender?.tab?.id >= 0) {
        try {
          browser.tabs.update(sender.tab.id, { url: viewerUrl }).then(onLoad);
        } catch (e) {
          console.warn('Failed to update tab:', e);
        }
      } else {
        browser.tabs.create({ url: viewerUrl });
      }
    }
  }
});

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
// does not detect blobs
/*
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const contentTypeRegex = /^Content-Type$/i;
    console.log("Fetch detected:", details.url, details.responseHeaders.find(header => header.name?.match(contentTypeRegex)), details);
    if (is3dFile(details.url)) {
      const contentTypeHeader = details.responseHeaders.find(header => header.name?.toLowerCase() == 'content-type');
      console.log("Fetch 3D file detected:", details.url, details, contentTypeHeader);
      if (!contentTypeHeader || contentTypeHeader.value?.toLowerCase().search('text/html')==-1) {
        contentTypeHeader ? contentTypeHeader.value = "text/plain; charset=ISO-8859-1" : details.responseHeaders.push({ name: 'Content-Type', value: "text/plain; charset=ISO-8859-1" });   // make it open in browser
        const contentDispositionRegex = /^Content-Disposition$/i;
        const contentDispositionHeader = details.responseHeaders.find(header => header.name?.match(contentDispositionRegex));
        const filename = contentDispositionHeader?.match(/filename\*?=("([^"]*)|[^\s]*)/)?.findLast( e => e );
        contentDispositionHeader ? contentDispositionHeader.value = "inline" : details.responseHeaders.push({ name: 'Content-Disposition', value: "inline" });   // make it open in browser
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === details.tabId && info.status === "complete") {
            chrome.tabs.sendMessage(details.tabId, { type: '3d', filename: filename });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      }
    }
    return { responseHeaders: details.responseHeaders };
  },
  // Firefox cannot fire onHeadersReceived for local files.
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
  // The blocking option is required to modify the response headers in detectJSON.
  ["blocking", "responseHeaders"],
);
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
        browser.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === details.tabId && info.status === "complete") {
                browser.tabs.onUpdated.removeListener(listener);
                browser.tabs.sendMessage(tabId, { filename: getFilename(details.url), data: bytes.buffer} );
            }
        });
        const viewerUrl = getUrl(details.url);
        console.log("Redirect", viewerUrl);
        return { 
          // cancel: true,
          redirectUrl: viewerUrl,
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

/*
browser.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (is3dFile(details.url)) {
      console.log("onBeforeNavigate 3D file detected:", details.url, details);
      const request = new XMLHttpRequest();
      request.open('GET', details.url, false);
      request.send();
      const viewerUrl = browser.runtime.getURL(`viewer.html?url=${encodeURIComponent(details.url)}`);
      if (details.tabId >= 0) {
        try {
          browser.tabs.update(details.tabId, { url: viewerUrl });
        } catch (e) {
          console.warn('Failed to update tab:', e);
        }
      } else {
        browser.tabs.create({ url: viewerUrl });
      }
    }
    return { responseHeaders: details.responseHeaders };
  },
);

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && is3dFile(changeInfo.url)) {
      console.log("Tab 3D file detected:", changeInfo.url, changeInfo);
      const viewerUrl = browser.runtime.getURL(`viewer.html?url=${encodeURIComponent(changeInfo.url)}`);
      browser.tabs.create({ url: viewerUrl });
      if (tabId >= 0) {
        console.log('Closing tab:', tabId);
        try {
          chrome.tabs.remove(tabId);
        } catch (e) {
          console.warn('Failed to close tab:', e);
        }
      }
    }
});
*/