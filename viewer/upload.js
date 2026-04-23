console.log("Theme", browser.theme);

document.body.addEventListener("dragover", e => {
  const fileItems = [...e.dataTransfer.items].filter( item => item.kind === "file" );
  if (fileItems.length > 0) {
    e.preventDefault();
	fileItems.some( item => console.log('DRAG', item) );
    e.dataTransfer.dropEffect = "copy";
    // e.dataTransfer.dropEffect = "none";
  }
});
document.body.addEventListener("drop", e => {
	console.log("DROP", e);
	[...e.dataTransfer.items].some( item => {
		if (item.kind === "file") {
			console.log('item', item);
			e.preventDefault();
			const file = e.dataTransfer.files[0];
			upload(file);
		}
	});
});

document.querySelector('input[type=file]').addEventListener('change', e => {
    const file = e.target.files[0];
    console.log('upload', file);
	upload(file);
});

function upload(file) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function() {
        const arrayBuffer = reader.result; // This is your ArrayBuffer
        console.log(arrayBuffer);
        browser.runtime.sendMessage({
          type: 'FROM_PAGE',
          filename: file.name,
          data: arrayBuffer,
        });
		window.close();
    };
}

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
	const viewer = document.querySelector('.viewer');
    const res = mod.load( 'Fox.vox',  bytes.buffer, viewer, { width: Math.min(viewer.offsetWidth, viewer.offsetHeight) || viewer.offsetWidth, height: Math.min(viewer.offsetWidth, viewer.offsetHeight) || viewer.offsetWidth });
    const interval = setInterval(function() {
      // document.querySelector('.lil-gui').remove();
      console.log('res', res);
      if (res.gui?.ids?.cameraZ) {
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
  } else {
    log.warn("Could not load 3d file", xhr);
  }
});
