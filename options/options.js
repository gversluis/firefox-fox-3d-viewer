import { supportedExtensions, stubExtensions, defaultSettings, loadSettings, saveSettings } from '../viewer/settings.js';
const settings = defaultSettings;
loadSettings(settings, addOptions);

const stubUrl = document.getElementById('stuburl');
const requestStubUrl = event => requestOptionalHostPermission(event.target.value, true, () => { stubUrl.className = stubUrl.className.replaceAll("error", ''); stubUrl.blur() }, () => stubUrl.className+=" error") && save() && loadPermissions();
stubUrl.addEventListener('blur', event => requestStubUrl(event));
stubUrl.addEventListener('focus', event => event.target.oldValue = event.target.value);
stubUrl.addEventListener('keydown', event => event.key == 'Escape' ? event.target.value=event.target.oldValue || '' : event.key == 'Enter' ? requestStubUrl(event) : null );

chrome.permissions.onRemoved.addListener(loadPermissions);
loadPermissions();
loadDemoViewer();

function addOptions(settings) {
  document.getElementById('stuburl').value = settings.stubUrl;
  addExtensionList(settings.extensions);
  addStubExtensionList(settings.stubExtensions);

  document.getElementById('permissions').addEventListener('click', event => requestOptionalHostPermission('<all_urls>', event.target.checked, loadPermissions));
  document.getElementById('permissionstuburl').addEventListener('click', event => requestOptionalHostPermission(document.getElementById('stuburl').value || document.getElementById('stuburl').placeholder, event.target.checked, loadPermissions));
  addRangeEventHandler(false);
}

function loadPermissions() {
    const allUrlsPermission = document.getElementById('permissions');
    const stubPermission = document.getElementById('permissionstuburl');
    browser.permissions.getAll().then((permissions) => {
        console.log('Fox 3D load host permissions', permissions.origins);
        if (permissions.origins.includes('<all_urls>')) {
            allUrlsPermission.checked = true;
            stubPermission.checked = true;   // automatically included when <all_urls> is granted
            stubPermission.parentElement.style.display = 'none';
        } else {
            allUrlsPermission.checked = false;
            stubPermission.parentElement.style.display = null;
            let stubUrl = document.getElementById('stuburl').value || document.getElementById('stuburl').placeholder;
            if (stubUrl.match(/^https?:\/\/[^\/]+$/i)) stubUrl += '/';   // domain without trailing slash
            if (stubUrl.match(/^https?:\/\/[^\/]+\/$/i)) stubUrl += '*';   // domain without trailing star
            stubPermission.checked = permissions.origins.includes(stubUrl);
            // console.log('Fox 3D permissions stub', stubUrl, stubPermission.checked);
        }
    });
}

async function requestOptionalHostPermission(host, enable, onAfter) {
  if (host.match(/^https?:\/\/[^\/]+$/i)) host += '/';   // domain without trailing slash
  if (host.match(/^https?:\/\/[^\/]+\/$/i)) host += '*';   // domain without trailing star
  if (!host.match(/^(https?:\/\/[a-zA-Z0-9\.]+\/|<all_urls>)/i)) {
      console.warn('Fox 3D permission host does not match https://domain.tld/ or <all_urls>', host);
      onAfter(false);
      return;
  }
  console.log("Fox 3D request change host permission", host, enable);
  const permissions = { origins: [host] };
  enable
    ? chrome.permissions.request(permissions)
    .then(onAfter)
    .catch(e => console.warn('Fox 3D could not request permission', e))
    : !browser.permissions.remove(permissions)
    .then(granted => onAfter(!granted))
    .catch(e => console.warn('Fox 3D could not remove permission', e))
  return true;
}

function addExtensionList(checkedExtensions) {
  const extensionTemplate = document.querySelector('template#extension');
  // console.log('Fox 3D template', extensionTemplate, supportedExtensions);
  Object.keys(supportedExtensions).reverse().forEach( e => {
      if (!stubExtensions.includes(e)) {
        const clone = document.importNode(extensionTemplate.content, true);
        const div = clone.querySelector('div');
        div.innerHTML = div.innerHTML.replaceAll('${ext}', e);
        div.innerHTML = div.innerHTML.replaceAll('${description}', supportedExtensions[e]);
        clone.querySelector('input[type=checkbox]').checked=checkedExtensions.includes(e);
        extensionTemplate.after( clone );
      }
  });
  document.querySelectorAll('input[name=extension]').forEach( e => e.addEventListener('click', save) );
}

function addStubExtensionList(checkedExtensions) {
  const stubExtensionTemplate = document.querySelector('template#stubextension');
  // console.log('Fox 3D template', stubExtensionTemplate);
  stubExtensions.forEach( e => {
      const clone = document.importNode(stubExtensionTemplate.content, true);
      const div = clone.querySelector('div');
      div.innerHTML = div.innerHTML.replaceAll('${ext}', e);
      div.innerHTML = div.innerHTML.replaceAll('${description}', supportedExtensions[e]);
      clone.querySelector('input[type=checkbox]').checked=checkedExtensions.includes(e);
      stubExtensionTemplate.after( clone );
  });
  document.querySelectorAll('input[name=stubextension]').forEach( e => e.addEventListener('click', save) );
}

function addRangeEventHandler(triggersClick) {
    console.log('Fox 3D addRangeEventHandler');
    var previouslyClicked = {};
    var shift = false;

    var labelShiftHandler = function(event) {
        shift = event.shiftKey;
        if (event.shiftKey) {
            event.preventDefault();
            // console.log('shift label', this, event);
            const checkbox = document.getElementById(this.getAttribute('for'));
            checkbox.click();
        }
        return true;
    };

    var rangeEventHandler = function(event) {
        const checkbox = this;
        // console.log("Fox 3D rangeEventHandler1!", event.shiftKey, checkbox.name, previouslyClicked[checkbox.name]?.value, checkbox.value, checkbox.checked);
        if ((shift || event.shiftKey) && previouslyClicked[checkbox.name] && checkbox != previouslyClicked[checkbox.name]) {
            shift = false;
            const clickEvent = new Event('click');
            const checkboxes = [...document.querySelectorAll('input[type=checkbox][name='+checkbox.name+']')];
            console.log('Fox 3D checkboxes', checkboxes);
            const start = checkboxes.indexOf( checkbox );
            const end = checkboxes.indexOf( previouslyClicked[checkbox.name] );
//              console.log('range', start, end, checkbox, previouslyClicked[checkbox.name]);
            const changingCheckboxes = checkboxes.slice(Math.min(start,end), Math.max(start,end)+ 1);
            changingCheckboxes.forEach( e => { 
              e.checked = previouslyClicked[checkbox.name].checked;
              if (triggersClick) e.dispatchEvent(clickEvent)
            });
        } else {
            previouslyClicked[checkbox.name] = checkbox;
        }
        return true;
    };

    if ("MutationObserver" in window) { // https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/MutationObserver to refresh on new checkboxes
        var mutationCallback = function(mutationList, observer) {
            mutationList.forEach((mutation) => {
                mutation.addedNodes.forEach( e => {
                    if (e.nodeName == 'INPUT' && e.type == 'checkbox') {
                        e.addEventListener('click', rangeEventHandler);
                        if (e.id) document.querySelector('label[for='+e.id+']').addEventListener('click', labelShiftHandler);
                    }
                });
            });
        };

        var observer = new MutationObserver(mutationCallback);
        observer.observe(document, {
            childList: true,
            attributes: false,  // since name is dynamically read
            subtree: true
        });
    }

    document.querySelectorAll('input[type=checkbox][name]').forEach(e => {
        e.addEventListener('click', rangeEventHandler);
        if (e.id) document.querySelector('label[for='+e.id+']').addEventListener('click', labelShiftHandler);
    });
}

function loadDemoViewer(target='.viewer', model='Fox.vox') {
  import('../viewer/viewer.js').then(mod => {
    const xhr = new XMLHttpRequest(); // we fake the request to intercept the data
    xhr.open("GET", "../viewer/Fox.vox", false); // false = synchronous
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    xhr.send();
    if (xhr.status === 200 && !xhr.getResponseHeader('Content-Type')?.match('text/html') && !xhr.responseText.match(/\s*<!doctype|\s*<html/i)) {
      const binary = xhr.responseText;
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
      const viewer = document.querySelector(target);
      const res = mod.load( model,  bytes.buffer, viewer, { width: Math.min(viewer.offsetWidth, viewer.offsetHeight) || viewer.offsetWidth || window.innerWidth, height: Math.min(viewer.offsetWidth, viewer.offsetHeight) || viewer.offsetWidth  || window.innerWidth});
      let count = 0;
      if (res) {
        const interval = setInterval(function() {
          if (count++>100) clearInterval(interval);
          // document.querySelector('.lil-gui').remove();
          if (res.gui?.ids?.cameraZ) {
            console.log('Fox 3D loadDemoViewer', res);
            res.gui.ids.cameraX.setValue(0.6);
            res.gui.ids.cameraY.setValue(7);
            res.gui.ids.cameraZ.setValue(20);
            res.gui.ids.directionalLightIntensity.setValue(3.7);
            res.gui.ids.directionalLightX.setValue(0);
            res.gui.ids.directionalLightY.setValue(10);
            res.gui.ids.directionalLightZ.setValue(2);
            clearInterval(interval);
          }
        }, 100);
      }
    } else {
      log.warn("Fox 3D could not load 3d file", xhr);
    }
  });
}

async function save() {
  const settings = await browser.storage.local.get();
  const extensions = [...document.querySelectorAll('input[name=extension]:checked,input[name=stubextension]:checked')].map( i => i.value);
  const stubExtensions = [...document.querySelectorAll('input[name=stubextension]:checked')].map( i => i.value);
  const stubUrl = document.getElementById('stuburl').value || document.getElementById('stuburl').placeholder;
  // console.log('BEFORE SAVING', settings);
  Object.assign(settings, {
      extensions,
      stubExtensions,
      stubUrl,
  });
  console.log('Fox 3D save', settings);
  saveSettings(settings);
}
