console.log('All scripts loaded');
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === 'FROM_CONTENT_READY') {
    // console.log("Received ready", message);
    import(message.script).then(mod => {
      mod.load( message.filename, message.data );
    });
  }
});
window.postMessage({ type: "FROM_PAGE_READY" });
