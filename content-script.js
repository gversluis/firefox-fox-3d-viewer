(function() {
  let data;
  
  // get data from content script to page and proxy messages to background script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "FROM_PAGE_READY") {
      window.postMessage({ 
        ...data,
        type: "FROM_CONTENT_READY",
        script: browser.runtime.getURL('/viewer/viewer.js'),
      });
    }
    if (event.data.type === "FROM_PAGE") {
      console.log('received', event.data.filename, event.data.data);
      browser.runtime.sendMessage({
        type: 'FROM_PAGE',
        filename: event.data.filename,
        data: event.data.data,
      });
    }
  });
  
  // when requested from background script, replace whole page with viewer html so code can be executed in page context (which allows eval, blob:, data:)
  browser.runtime.onMessage.addListener(function listener(message) {
    console.log("Content-script viewer received data", message);
    browser.runtime.onMessage.removeListener(listener);
    data = message;
    const plugin = browser.runtime.getURL('/viewer/');
    const source = plugin+'viewer.html';
    console.log('test', plugin, source);
    fetch(source).then( response => response.text().then( html => {
      html = html.replace(/(<head[^>]*>)/, '$1<base href="'+plugin+'">');
      // html = html.replace('src="', 'src="'+plugin);
      // html = html.replace('href="', 'href="'+plugin);
      document.documentElement.innerHTML = html 
      const scripts = document.querySelectorAll("script");
      const loadedScripts = [];
      for (const oldScript of scripts) {
        const newScript = document.createElement("script");
        for (const attr of oldScript.attributes) newScript.setAttribute(attr.name, attr.value);
        newScript.textContent = oldScript.textContent;
        newScript.addEventListener("load", function () {
          loadedScripts.push(this);
          console.log('script loaded', loadedScripts, scripts);
          if (loadedScripts.length == scripts.length) {
          }
        });
        oldScript.replaceWith(newScript);
      }

      const script = document.createElement("script");
      script.setAttribute('src', plugin+'viewer.page.js');
      (document.head || document.documentElement).appendChild(script);
    }));
    // TODO: store data in cookie or something so page can be refreshed?
  });

  // catch click on links to 3d file blob
  const proxyClick = {
    apply(target, thisArg, args) {
      const is3dFile = function(url) {
        const ext = url.split("?")[0]?.split("#")[0]?.split('.')?.pop()?.toLowerCase();
        console.log('ext', ext);
        return ['3dm','3ds','3mf','amf','dae','drc','fbx','gcode','glb','kmz','lwo','md2','mdd','mpd','nrrd','obj','pcd','pdb','ply','stl',/*'tilt',*//*'urdf',*/'usdz',/*'octree','binvox',*/'vox',/*'vsb',*/'vtk','vtp','wrl','xyz'].includes(ext);
      }
      if (thisArg.href.startsWith('blob:')) {
        if (is3dFile(thisArg.download)) { 
          console.log('filename:', thisArg.download, thisArg.href);
          fetch(thisArg.href)
            .then(res => res.arrayBuffer())
            .then(buffer => {
              window.postMessage({ type: "FROM_PAGE", filename: thisArg.download, data: buffer }, "*");
            });
          return false;
        }
      }
      return target.apply(thisArg, args);
    }
  };
  window.wrappedJSObject.HTMLAnchorElement.prototype.click = exportFunction(new Proxy(window.HTMLAnchorElement.prototype.click, proxyClick), window.wrappedJSObject);

})();