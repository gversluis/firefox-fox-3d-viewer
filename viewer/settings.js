export const supportedExtensions = {
  '3dm': 'Rhino 3D model',
  '3ds': '3D Studio mesh',
  '3mf': '3D Manufacturing Format',
  'amf': 'Additive Manufacturing File',
  'dae': 'COLLADA digital asset',
  'drc': 'Google Draco compressed mesh',
  'fbx': 'Autodesk FBX interchange format',
  'gcode': '3D printer/CNC toolpath',
  'glb': 'Binary glTF model',
  'kmz': 'Zipped KML (often 3D geodata)',
  'lwo': 'LightWave object',
  'md2': 'Quake II model format',
  'mdd': 'Point cache animation data',
  'mpd': 'LDraw multi-part model',
  'nrrd': 'Nearly Raw Raster Data (volumetric)',
  'obj': 'Wavefront OBJ model',
  'pcd': 'Point Cloud Data',
  'pdb': 'Protein Data Bank structure',
  'ply': 'Polygon file format',
  'stl': 'Stereolithography mesh',
  // 'tilt' => '',
  // 'urdf' => '',
  'usdz': 'USD zipped (AR format)',
  // 'octree' => '',
  // 'binvox' => '',
  'vox': 'MagicaVoxel voxel model',
  // 'vsb' => '',
  'vtk': 'Visualization Toolkit dataset',
  'vtp': 'VTK polygonal data',
  'wrl': 'VRML world',
  'xyz': 'XYZ point cloud',
};

export const stubExtensions = [
  '3dm',
]

export const defaultSettings = {
  extensions: Object.keys(supportedExtensions),
  stubExtensions: stubExtensions,
  stubUrl: 'https://www.example.org/',
};

// warning: this is async, so settings are not directly loaded
export function loadSettings(settings, onReady = (settings) => {}) {
	browser.storage.local.get(settings).then( loaded => { Object.assign(settings, loaded); onReady(settings) }, error => { console.warn("Failed to load settings", error); onReady(settings) } );
}

export function saveSettings(settings) {
	browser.runtime.sendMessage({ type: 'RELOAD', settings: settings });
	browser.storage.local.set(settings);
}
