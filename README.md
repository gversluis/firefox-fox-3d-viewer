# Fox 3D viewer — Firefox extension

View a wide range of 3D formats directly in your browser, like 3DM (Rhino 3D), 3DS, 3MF, DAE (COLLADA), DRC (Draco), FBX, GCODE, GLB, GLTF, KMZ, LWO, MD2, MPD, NRRD, OBJ (Wavefront), PDB, PLY, STL, USDZ, VOX, VTK, VTP, WRL, XYZ.

<img src="/icons/icon-128.png" height="128" alt="Logo" />

---

## 📌 Features

- 🛡️ **Your data is yours** — no ads, no external monitoring, no measurements
- 🔗 **Automatic link detection** — URLs ending with a 3D file extension automatically open in the viewer
- 🪤 **In memory download links** — Blob: download links with a 3D file extension automatically open in the viewer
- 📂 **Open local files** — click on the toolbar button to view local files in the viewer
- ✨ **Material presets** — switch between Default, Color, Cartoon, Flat, and a selection of materials
- 📷 **PNG export** — render and download a screenshot of the current view
- 💾 **Download button** — last but not least, download the original file
- 🤝 Open source **LGPL license** — you can modify the code for your fittings

---

## 🗃️ Supported Formats

| Extension | Format |
|-----------|--------|
| `3dm` | Rhino 3D model |
| `3ds` | 3D Studio mesh |
| `3mf` | 3D Manufacturing Format |
| `amf` | Additive Manufacturing File |
| `dae` | COLLADA digital asset |
| `drc` | Google Draco compressed mesh |
| `fbx` | Autodesk FBX interchange format |
| `gcode` | 3D printer/CNC toolpath |
| `glb` | GL Transmission Format |
| `kmz` | Keyhole Markup Language (3D geodata) |
| `lwo` | LightWave object |
| `md2` | Quake II model |
| `mdd` | Point cache animation data |
| `mpd` | LDraw (LEGO model) |
| `nrrd` | Nearly Raw Raster Data (often medical) |
| `obj` | Wavefront OBJ model |
| `pcd` | Point Cloud Data |
| `pdb` | Protein Data Bank structure |
| `ply` | Polygon file format |
| `stl` | Stereolithography mesh |
| `usdz` | Universal Scene Description |
| `vox` | MagicaVoxel voxel model |
| `vtk` | Visualization Toolkit dataset |
| `vtp` | VTK polygonal data |
| `wrl` | Virtual Reality Modeling Language world |
| `xyz` | XYZ point cloud |

Extensions are limited by a content security policy.<br>
This means extensions can not load on the fly generated scripts which some loaders use.<br>
A stub website is loaded as workaround. The extension is inserted so it loads as a regular page.

`3dm` needs to load in a stub page. 

---

## 👓 Permissions

- Fox 3D viewer requires access to all websites
  * To detect requests to 3D files and to catch blobs (in memory files)
  * You can disable this if you only want to upload local files*
- Fox 3D viewer requires access to the stub URL*
  * If you disable access to all websites and want to view extensions which require a stub URL, then do not forget to grant access to the stub URL
- Access downloads
  * Lets you download the file
- webNavigation/webRequest/webRequestBlocking
  * Check the request URL and redirect to the viewer
- Access to tabs
  * Open tabs
  * Wait for tab to load before sending data
- Storage
  * Load and save the extensions to be intercepted

\* `Stub URL` is a website that is opened by the extension. All contents are replaced so the viewer can load. This allows the viewer to run in page context and run dynamic code which is required by some loaders.

---

## 📷 Screenshots

<img src="/screenshots/vox.jpg" height="747" alt="Screenshot of Vox file opened in Fox 3D viewer" />

---

## 📐 Architecture
Below is the description of the files containing most logic.

### background.js
Background service worker

a) Open 3D URLs in the viewer
1. Listens to onBeforeNavigate/onBeforeSendHeaders and checks for supported file extensions
2. Spoofs the request and loads the data into a Blob
3. Opens the viewer in the tab where the file would have opened
4. Sends the file contents and filename to the viewer

b) Sends data from the content script to the viewer
1. Listens to onMessage
2. Loads viewer in a new tab
3. Sends the file contents and filename to the viewer

### content-script.js
Injected script

a) Open blob: download links in the viewer
1. Listens for click events on anchors with a download property
2. Checks if it is a known file extension
3. Send the blob: data and filename to the background script to open in the viewer

b) Open viewer in page context
1. Listens to onMessage to the background script
2. Loads data and filename from the message
3. Replace the stub webpage content with the content of the viewer
4. Load viewer.page.js in page context
5. Script viewer.page.js requests data and filename
6. Script viewer.page.js sends the file contents and filename to the viewer

### viewer.js
Display rendered result

1. Selects a loader based on the file extension
2. Loads the model
3. Fits camera to the object
4. Draw the rest of the owl (Three.js scene setup, GUI controls, animations)

---

## 🚲 Firefox installation (Development)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select the extension's `manifest.json`.

---

## 🚫 Known Limitations

- **`.3dm` (Rhino)** requires page-context execution (WASM + `new Function()`) and cannot be loaded directly inside the extension sandbox; it is routed to a stub page
- Page reload does not work since the model is only in the viewer's memory which is lost at a reload, press back and open the file again
- Pressing back and forward does not work since the model is only in the viewers memory which is lost at a reload, press back and open the file again

---

## 🚨 Troubleshooting

Q: The viewer does not start at all<br>
**A: Go to Add-ons manager, add-on options, and Grant permission to access all websites**

Q: I do not see anything
**A: Go to Add-ons manager, add-on options, scroll to the bottom. There should be a Fox 3D viewer logo. If not then there might be a rendering problem.**

Q: When I refresh the page my model is gone<br>
**A: The viewer has the model in memory which is gone on a refresh. Press back and open the file again.**

Q: My Rhino 3D model (.3dm) does not load<br>
**A: Go to Add-ons manager, add-on options, try https://www.example.org/ as Stub URL**

Q: My model does not load (properly)<br>
**A: Download [Three.js](https://threejs.org/), modify the [example loader](https://threejs.org/examples/) to load your model. If it does not work the error is not the extension but the loader or your loader. Try to save your file with another extension.**

---

## 📚 Dependencies

- [Three.js](https://threejs.org/) — 3D engine and most format loaders
- [lil-gui](https://lil-gui.georgealways.com/) — GUI control panel

---

## 📄 Credits

- Author: Gerben Versluis
- Distributed under the terms specified in the repository [LICENSE](LICENSE).

