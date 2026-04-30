export const supportedExtensions = {
  '3dm': 'Rhino 3D model',
  '3ds': '3D Studio mesh',
  '3mf': '3D Manufacturing Format',
  'amf': 'Additive Manufacturing File',
  'dae': 'COLLADA digital asset',
  'drc': 'Google Draco compressed mesh',
  'fbx': 'Autodesk FBX interchange format',
  'gcode': '3D printer/CNC toolpath',
  'glb': 'GL Transmission Format',
  'kmz': 'Keyhole Markup Language (3D geodata)',
  'lwo': 'LightWave object',
  'md2': 'Quake II model',
  'mdd': 'Point cache animation data',
  'mpd': 'LDraw (LEGO model)',
  'nrrd': 'Nearly Raw Raster Data (often medical)',
  'obj': 'Wavefront OBJ model',
  'pcd': 'Point Cloud Data',
  'pdb': 'Protein Data Bank structure',
  'ply': 'Polygon file format',
  'stl': 'Stereolithography mesh',
  // 'tilt' => '',
  // 'urdf' => '',
  'usdz': 'Universal Scene Description',
  // 'octree' => '',
  // 'binvox' => '',
  'vox': 'MagicaVoxel voxel model',
  // 'vsb' => '',
  'vtk': 'Visualization Toolkit dataset',
  'vtp': 'VTK polygonal data',
  'wrl': 'Virtual Reality Modeling Language world',
  'xyz': 'XYZ point cloud',
};

export const stubExtensions = [
  '3dm',
]

export const Target = {
    EXISTING_TAB: { value: 'EXISTING_TAB', label: "Open in existing tab" },
    NEW_NEXT_TAB: { value: 'NEW_NEXT_TAB', label: "Open in new tab next to existing if possible" },
    NEW_PREV_TAB: { value: 'NEW_PREV_TAB', label: "Open in new tab previous to existing if possible" },
    NEW_END_TAB: { value: 'NEW_END_TAB', label: "Open in new tab at the end if possible" },
    NEW_WINDOW: { value: 'NEW_WINDOW', label: "Open in new window" },
};

export const defaultSettings = {
  extensions: Object.keys(supportedExtensions),
  stubExtensions: stubExtensions,
  stubUrl: 'https://www.example.org/',
  target: Target.NEW_NEXT_TAB.value,
};

// warning: this is async, so settings are not directly loaded
export function loadSettings(settings, onReady = (settings) => {}) {
	browser.storage.local.get(settings).then( loaded => { Object.assign(settings, loaded); onReady(settings) }, error => { console.warn("Failed to load settings", error); onReady(settings) } );
}

export function saveSettings(settings) {
	browser.runtime.sendMessage({ type: 'RELOAD', settings: settings });
	browser.storage.local.set(settings);
}
