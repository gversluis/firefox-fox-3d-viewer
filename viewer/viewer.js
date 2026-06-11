"use strict";
import * as THREE from './three.module.js';

import { OrbitControls } from './three/addons/controls/OrbitControls.js';
import { HDRLoader } from './three/addons/loaders/HDRLoader.js';
import { EXRLoader } from './three/addons/loaders/EXRLoader.js';
import { OutlineEffect } from './three/addons/effects/OutlineEffect.js';
import { GUI } from './three/addons/libs/lil-gui.module.min.js';
import { MeshTransmissionMaterial } from './three/MeshTransmissionMaterial.js';
import { SimplifyModifier } from './three/addons/modifiers/SimplifyModifier.js';
import * as BufferGeometryUtils from './three/addons/utils/BufferGeometryUtils.js';
import { STLExporter } from './three/addons/exporters/STLExporter.js';
import { GLTFExporter } from './three/addons/exporters/GLTFExporter.js';
import * as TextureUtils from './three/addons/utils/WebGLTextureUtils.js';

import { Rhino3dmLoader } from './three/addons/loaders/3DMLoader.js'; // 3dm
import { TDSLoader } from './three/addons/loaders/TDSLoader.js';  // 3ds
import { ThreeMFLoader } from './three/addons/loaders/3MFLoader.js';  // 3mf
import { AMFLoader } from './three/addons/loaders/AMFLoader.js';
import { ColladaLoader } from './three/addons/loaders/ColladaLoader.js';  // dae
import { DRACOLoader } from './three/addons/loaders/DRACOLoader.js';  // drc
import { FBXLoader } from './three/addons/loaders/FBXLoader.js';
import { GCodeLoader } from './three/addons/loaders/GCodeLoader.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './three/addons/libs/meshopt_decoder.module.js';
import { KMZLoader } from './three/addons/loaders/KMZLoader.js';
import { LWOLoader } from './three/addons/loaders/LWOLoader.js';
import { MD2Loader } from './three/addons/loaders/MD2Loader.js';
import { MDDLoader } from './three/addons/loaders/MDDLoader.js';
import { LDrawLoader } from './three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from './three/addons/materials/LDrawConditionalLineMaterial.js';
import { NRRDLoader } from './three/addons/loaders/NRRDLoader.js';
import { OBJLoader } from './three/addons/loaders/OBJLoader.js';
import { PCDLoader } from './three/addons/loaders/PCDLoader.js';
import { PDBLoader } from './three/addons/loaders/PDBLoader.js';
import { CSS2DRenderer, CSS2DObject } from './three/addons/renderers/CSS2DRenderer.js';
import { PLYLoader } from './three/addons/loaders/PLYLoader.js';
import { STLLoader } from './three/addons/loaders/STLLoader.js';
import { USDLoader } from './three/addons/loaders/USDLoader.js';
import { VOXLoader } from './three/VOXLoader.js';
import { VRMLLoader } from './three/addons/loaders/VRMLLoader.js';
import { VTKLoader } from './three/addons/loaders/VTKLoader.js';
import { XYZLoader } from './three/addons/loaders/XYZLoader.js';
// TODO: .step, .stp    Standard for the Exchange of Product Data; used in engineering and manufacturing.   https://github.com/Roadinforest/occt-step-viewer-web ?
// TODO: .blend         Native format for Blender, a popular 3D modeling tool.      Python parser: https://github.com/gabdube/tinyblend

const timer = new THREE.Timer();
timer.connect( document );

let model=null,
    camera=null,
    perspectiveCamera=null,
    orthographicCamera=null,
    scene=null,
    renderer=null,
    labelRenderer=null,
    controls=null,
    loader=null,
    gui=null,
    mixers = [],
    guiData = {};

const isPageContext = (typeof browser === 'undefined');
console.log("Viewer executed in context", isPageContext ? 'page script' : 'content script');

if (!isPageContext) {
  browser.runtime.onMessage.addListener(function listener(message) {
    console.log("Viewer received data", message);
    browser.runtime.onMessage.removeListener(listener);
    load( message.filename, message.data, message.settings );
    // TODO: store data in cookie or something so page can be refreshed?
  });
}

const glassMaterial = Object.assign(new MeshTransmissionMaterial(10), {
    metalness: 0.1,
    clearcoat: 0,
    clearcoatRoughness: 0.05,
    transmission: 1,
    chromaticAberration: 0.03,
    anisotrophicBlur: 0.1,
    // Set to > 0 for diffuse roughness
    roughness: 0.05,
    thickness: 0.25,
    ior: 1.5,
    // Set to > 0 for animation
    distortion: 0.1,
    distortionScale: 0.2,
    temporalDistortion: 0.2,
    envMapIntensity: 0.2,
    
    dispersion: 5,
});

const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xFFD700,
    metalness: 1.0,
    roughness: 0.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
});

function error(html) {
    document.querySelector('canvas')?.remove();
    const error = document.querySelector('.error');
    error ? error.innerHTML = html : console.error(html);
}

function load(filename, buffer, settings, target, dimensions) {
    console.log('module viewer.js', (isPageContext ? "Page context" : "Content script context"));

    // const params = new URLSearchParams(window.location.search);
    if (!buffer) {
      error("<h1>No data found to render</h1>");
      throw new Error("No data found to render", filename, buffer);
    }
    const downloadButton = document.getElementById('download');
    if (downloadButton) {
        const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
        downloadButton.setAttribute('href', url);
        downloadButton.setAttribute('download', filename);
    }

    const ext = filename.split("?")[0]?.split("#")[0]?.split('.')?.pop()?.toLowerCase();
    addGui(ext, settings, dimensions);

    loadModel(ext, buffer, (m) => {
        model = m;
        console.log("add model", model);
        model.castShadow = true;
        model.receiveShadow = true;
        
        let animations = getAnimations(model);
        if (animations?.length) {
            console.log("Animations", animations);
            animations.unshift({name: "None"});
            guiData.animation = animations[0].name;
            const mixer = new THREE.AnimationMixer(model);
            mixers.push(mixer);
            gui.ids.animation = replaceGuiController(gui.ids.animate, gui.add( guiData, 'animation', animations.map( a => a.name) ).name( 'Animation' ).onChange( function (v) {
                const clip = animations[gui.ids.animation.$select.selectedIndex];
                console.log('Selected animation', clip);
                if (clip.tracks) {
                    let newAction = mixer.existingAction(clip);
                    if (!newAction) newAction = mixer.clipAction(clip);
                    mixer.stopAllAction();
                    newAction.play();
                    guiData.animate=true;
                    if (guiData.animate) animate();
                } else {
                    guiData.animate=false;
                }
            }));
        }

        try {
            const glassMesh = model.getObjectByName( 'glass' );
            if (glassMesh) {
                glassMesh.material = glassMaterial;
            }
        } catch(e) {
            console.warn("Failed to set glass material (if there was any)", e);
        }

        init(ext, target, dimensions);
        if (ext != 'wrl') {
            normalizeMeshIfTooSmall(model);
            fitCameraToObject(perspectiveCamera, model, controls);
        } else {
            console.warn("Object too large, skipping auto-fit:", sphere.radius);
        }
        scene.add(model);
        
        if (!gui.ids.model) gui.ids.model = insertGuiControllerAfter(gui.ids.controls, gui.addFolder( 'Model' ).close());
        gui.ids.modelRotateX = replaceGuiController(gui.ids.modelRotateX, gui.ids.model.add(model.rotation, 'x', -Math.PI, Math.PI).name('Rotate over X').onChange( () => { render(); } ));
        gui.ids.modelRotateY = replaceGuiController(gui.ids.modelRotateY, gui.ids.model.add(model.rotation, 'y', -Math.PI, Math.PI).name('Rotate over Y').onChange( () => { render(); } ));
        gui.ids.modelRotateZ = replaceGuiController(gui.ids.modelRotateZ, gui.ids.model.add(model.rotation, 'z', -Math.PI, Math.PI).name('Rotate over Z').onChange( () => { render(); } ));
        render();
    });
    return {
        gui: gui,   // rest is not initialized
    }
}

function loadModel(ext, buffer, callback) {
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
    const manager = new THREE.LoadingManager();
    manager.setURLModifier( function transform(url) {
        if (url.toString()?.match(/\.(gif|png|tga|jpg)/i)) {
            console.log("Intercepted image URL and replaced with texture.png", url);
            return 'texture.png';
        } else {
            return url;
        }
    });
    
    switch (ext) {
      case '3dm':
        if (!isPageContext) {
            error(`<h1>Can not load Rhino 3dm in extension<br>Use in page context</h1>`);
            throw new Error(`<h1>Can not load Rhino 3dm in extension<br>Use in page context</h1>`);
        }
        loader = new Rhino3dmLoader(manager);
        loader.setLibraryPath( './three/addons/libs/rhino3dm/' );
        /*
        loader.libraryPending = new Promise((resolve) => {
            resolve();
        }).then(() => {
            loader.workerSourceURL = './three/addons/libs/rhino3dm/fox3d_rhino3dm_loader.js'; // Workaround: DRACOLoader creates JS on the fly and loads that from a blob which is not allowed in an extension, so I build the JS in advance and load it directly from the file
            loader.libraryConfig.wasmBinary = './three/addons/libs/rhino3dm/rhino3dm.wasm';
            // issue: rhino3dm_loader.js still has new Function() which is not allowed in extension
        });
        */
        
        loader.load( url, function ( object ) {
            console.log('Loaded 3dm', object);
            const layers = object.userData.layers;
            gui?.ids?.simplify?.destroy();
            for ( let i = 0; i < layers.length; i ++ ) {
                const layer = layers[ i ];
                gui.ids['layer'+layer.name] = insertGuiControllerBefore(gui.ids.exportpng, gui.add( layer, 'visible' ).name( layer.name ).onChange( function ( val ) {
                    const name = this.object.name;
                    console.log('3dm change', name);
                    scene.traverse( function ( child ) {
                        if ( child.userData.hasOwnProperty( 'attributes' ) ) {
                            if ( 'layerIndex' in child.userData.attributes ) {
                                const layerName = layers[ child.userData.attributes.layerIndex ].name;
                                if ( layerName === name ) {
                                    child.visible = val;
                                    layer.visible = val;
                                }
                            }
                        }
                    } );
                    renderer.render(scene, camera);
                } ));
            }
            callback(object);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break; 
      case '3ds':
        loader = new TDSLoader(manager);
        // loader.debug = 1;
        loader.load( url, function ( object ) {
            console.log('Loaded 3ds');
            callback(object);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break; 
      case '3mf': 
        loader = new ThreeMFLoader(manager);
        loader.load( url, function ( object ) {
            console.log('Loaded 3mf');
            object.traverse( function ( child ) {
                child.castShadow = true;
            });
            callback(object);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'amf':   // skin_and_morph.dae not working, elf.dae & stromtrooper.dae working
        loader = new AMFLoader (manager); 
        loader.load( url, function ( amfobject ) {
            callback( amfobject );
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;    // collada
      case 'dae':   // skin_and_morph.dae not working, elf.dae & stromtrooper.dae working
        loader = new ColladaLoader(manager); 
        loader.load( url, function ( collada ) {
            console.log('Loaded dae (collada)');
            callback(collada.scene);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;    // collada
      case 'drc':
        loader = new DRACOLoader(manager);
        loader.setDecoderPath('./draco/');
        loader.decoderPending = Promise.resolve().then(() => {
            loader.workerSourceURL = './draco/draco_worker.js'; // Workaround: DRACOLoader creates JS on the fly and loads that from a blob which is not allowed in an extension, so I build the JS in advance and load it directly from the file
        });
        // loader.setWorkerLimit(1);
        // loader.setDecoderConfig({ type: 'js' });
        loader.load(url, function(geometry) {
            console.log('Draco loaded!', geometry);
            const material = new THREE.MeshStandardMaterial({ color: 0x6699ff, side: THREE.DoubleSide });
            const model = new THREE.Mesh(geometry, material);
            callback(model);
            loader.dispose();
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;    // draco
      case 'fbx':
        loader = new FBXLoader(manager);
        loader.load( url, function ( model ) {
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'gcode':     // working
        loader = new GCodeLoader(manager); 
        loader.load( url, function ( model ) {
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'glb':   // compressed files do not work since DRACOLoader / MeshoptDecoder use dynamic loading (see drc for workaround DRACOLoader) 
      case 'gltf':     // gltf not working since it is not a single file but maps to other files, could work if uploaded as zip
        loader = new GLTFLoader(manager);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./draco/gltf/');
        dracoLoader.decoderPending = Promise.resolve().then(() => {
            dracoLoader.workerSourceURL = './draco/gltf/draco_worker.js'; // Workaround: DRACOLoader creates JS on the fly and loads that from a blob which is not allowed in an extension, so I build the JS in advance and load it directly from the file
        });
        // loader.setKTX2Loader( ktx2Loader );  // test with coffeemat.glb
        loader.setDRACOLoader( dracoLoader );
        loader.setMeshoptDecoder( MeshoptDecoder );
        loader.load(url, function(gltf) {
            console.log('gltf loaded', gltf);
            gltf.scene.animations = gltf.animations;
            callback(gltf.scene);
        }, null, function(e) {
            if (e.toString().match('No DRACOLoader instance provided')) {
                error(`<h1>Error loading ${ext}<br>3D viewer needs to load in page context because content_security_policy does not allow Three JS blob: workers to run in the extension which are used for compressed glb and drc files.</h1>`);
            } else {
                error(`<h1>Error loading ${ext}<br>${e}</h1>`);
                throw new Error(e);
            }
        });
        break;
      /* Does not work because eval is not allowed in extension: Content-Security-Policy: The page’s settings blocked a JavaScript eval (script-src) from being executed because it violates the following directive: “script-src 'self' blob: 'wasm-unsafe-eval'” (Missing 'unsafe-eval')
      case 'ifc':
        const loader = new IFCLoader();
        loader.ifcManager.setWasmPath('./three/', true)
            .then(() => loader.ifcManager.parser.setupOptionalCategories({ [IFCSPACE]: false }))
            .then(() => loader.ifcManager.applyWebIfcConfig({ USE_FAST_BOOLS: true }))
            .then(() => loader.load( url, function ( model ) {
                            callback(model.mesh);
                        },null, function(e) {
                            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
                            throw new Error(e);
                        }))
            .catch(error => console.error('Error:', error));
        break;
        */
      case 'kmz':
        loader = new KMZLoader(manager); 
        loader.load( url, function ( kmz ) {
            console.log("Loaded kmz", kmz);
            callback(kmz.scene);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'lwo':
        loader = new LWOLoader(manager); 
        loader.load( url, function ( object  ) {
            console.log("Loaded lwo", object );
            const group = new THREE.Group();
            object.meshes.forEach( model => group.add(model) );
            callback(group);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'md2':
        loader = new MD2Loader(manager);
        loader.load( url, function ( geometry  ) {
            console.log("Loaded md2", geometry );
            const material = new THREE.MeshStandardMaterial({ color: 0x6699ff, morphTargets: true, side: THREE.DoubleSide, flatShading: true });    // morphTargets is required for md2
            const mesh = new THREE.Mesh(geometry, material);
            mesh.animations = geometry.animations;
            callback(mesh);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'mdd':
        loader = new MDDLoader(manager);
        loader.load( url, function ( result ) {
            const morphTargets = result.morphTargets;
            result.clip.optimize();
            const geometry = new THREE.BoxGeometry();
            geometry.morphAttributes.position = morphTargets; // apply morph targets
            const material = new THREE.MeshNormalMaterial();
            const mesh = new THREE.Mesh( geometry, material );
            mesh.animations = [result.clip];
            callback(mesh);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'mpd':
        loader = new LDrawLoader(manager);
        loader.setConditionalLineMaterial( LDrawConditionalLineMaterial );
        Object.assign(guiData, {
            displayLines: true,
            conditionalLines: true,
            buildingStep: 0,
        });
        loader.smoothNormals = true; // guiData.smoothNormals && ! guiData.flatColors; // TODO: add to GUI menu and reload model?
        console.log("Loading ldraw", loader );
        loader.load( url, function ( model ) {
            console.log("Loaded ldraw", model );
            model.rotation.x = Math.PI;
            gui?.ids?.simplify?.destroy();
            guiData.buildingStep = model?.userData?.numBuildingSteps > 1 ? model.userData.numBuildingSteps - 1 : 1;
            gui.ids.buildingStep = insertGuiControllerBefore(gui.ids.exportpng, gui.add( guiData, 'buildingStep', 0, guiData.buildingStep ).step( 1 ).name( 'Building step' ).onChange( updateObjectsVisibility ));
            if ( model?.userData?.numBuildingSteps-1 <= 0 ) gui.ids.buildingStep.disable();

            gui.ids.displayLines = insertGuiControllerBefore(gui.ids.exportpng, gui.add( guiData, 'displayLines' ).name( 'Display Lines' ).onChange( updateObjectsVisibility ));
            gui.ids.conditionalLines = insertGuiControllerBefore(gui.ids.exportpng, gui.add( guiData, 'conditionalLines' ).name( 'Conditional Lines' ).onChange( updateObjectsVisibility ));
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;    // ldraw
      case 'nrrd':
        loader = new NRRDLoader(manager);
        loader.load( url, function ( volume ) {
            console.log('Loaded nrrd', volume);
            const group = new THREE.Group();

            //box helper to see the extend of the volume
            const geometry = new THREE.BoxGeometry( volume.xLength, volume.yLength, volume.zLength );
            const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
            const cube = new THREE.Mesh( geometry, material );
            cube.visible = false;
            group.add(cube);
            const box = new THREE.BoxHelper( cube );
            box.applyMatrix4( volume.matrix );
            
            group.add(box);

            //z plane
            const sliceZ = volume.extractSlice( 'z', Math.floor( volume.RASDimensions[ 2 ] / 4 ) );
            group.add( sliceZ.mesh );
            //y plane
            const sliceY = volume.extractSlice( 'y', Math.floor( volume.RASDimensions[ 1 ] / 2 ) );
            group.add( sliceY.mesh );
            //x plane
            const sliceX = volume.extractSlice( 'x', Math.floor( volume.RASDimensions[ 0 ] / 2 ) );
            group.add( sliceX.mesh );

            gui.ids.sliceX = insertGuiControllerBefore(gui.ids.exportpng, gui.add( sliceX, 'index', 0, volume.RASDimensions[ 0 ], 1 ).name( 'indexX' ).onChange( function () { sliceX.repaint.call( sliceX ); render(); }));
            gui.ids.sliceY = insertGuiControllerBefore(gui.ids.exportpng, gui.add( sliceY, 'index', 0, volume.RASDimensions[ 1 ], 1 ).name( 'indexY' ).onChange( function () { sliceY.repaint.call( sliceY ); render(); }));
            gui.ids.sliceZ = insertGuiControllerBefore(gui.ids.exportpng, gui.add( sliceZ, 'index', 0, volume.RASDimensions[ 2 ], 1 ).name( 'indexZ' ).onChange( function () { sliceZ.repaint.call( sliceZ ); render(); }));
            gui.ids.volumeLowerThreshold = insertGuiControllerBefore(gui.ids.exportpng, gui.add( volume, 'lowerThreshold', volume.min, volume.max, 1 ).name( 'Lower Threshold' ).onChange( function () { volume.repaintAllSlices(); render(); }));
            gui.ids.volumeUpperThreshold = insertGuiControllerBefore(gui.ids.exportpng, gui.add( volume, 'upperThreshold', volume.min, volume.max, 1 ).name( 'Upper Threshold' ).onChange( function () { volume.repaintAllSlices(); render(); }));
            callback(group);

        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'obj':   // working
        loader = new OBJLoader(manager);
        loader.load( url, function ( model ) {
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'pcd':
        loader = new PCDLoader(manager);
        loader.load( url, function ( points ) {
            gui?.ids?.simplify?.destroy();
            points.geometry.center();
            points.geometry.rotateX( Math.PI );
            gui.ids.material.hide();
            gui.ids.materialColor.hide();
            gui.ids.outline.hide();
            gui.ids.pointSize = insertGuiControllerBefore(gui.ids.exportpng, gui.add( points.material, 'size', 0.001, 0.1 ).onChange( render ));
            gui.ids.pointColor = insertGuiControllerBefore(gui.ids.exportpng, gui.addColor( points.material, 'color' ).onChange( render ));
            callback(points);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'pdb':
        loader = new PDBLoader(manager);
        loader.load( url, function ( pdb ) {
            const model = pdb2model(pdb);
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'ply':
        loader = new PLYLoader(manager);
        loader.load( url, function ( geometry  ) {
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ color: 0x6699ff, morphTargets: true, side: THREE.DoubleSide, flatShading: true });
            const mesh = new THREE.Mesh( geometry, material );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            callback(mesh);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'stl':   // working 
        loader = new STLLoader(manager);
        loader.load( url, function ( geometry ) {
            const material = geometry.hasColors ? new THREE.MeshPhongMaterial( { opacity: geometry.alpha, vertexColors: true,  side: THREE.DoubleSide } ) :  new THREE.MeshPhongMaterial( { color: 0xd5d5d5, specular: 0x494949, shininess: 200,  side: THREE.DoubleSide } );
            const model = new THREE.Mesh( geometry, material );
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      // case 'tilt': break;
      // case 'urdf': break;   // https://github.com/gkjohnson/urdf-loaders/blob/master/javascript/README.md
      case 'usdz':
        loader = new USDLoader(manager);
        loader.load( url, function ( model ) {
            callback(model);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      // case 'octree':
      // case 'binvox':
      case 'vox':
        if (!bufferContains(buffer, "VOX", 3)) {
            error(`<h1>Error loading<br>Not a Vox file</h1>`);
            throw new Error("Missing parser", ext, buffer);
        }
        /*
        if (bufferContains(buffer, "PACK", 500)) {
            error(`<h1>Error loading<br>Vox file is an unsupported multi-model (PACK).<br>Save file as single model from <a href="https://ephtracy.github.io/">MagicaVoxel</a>.</h1>`);
            throw new Error("Missing parser", ext, buffer);
        }
        */
        // console.log('buffer', buffer);
        loader = new VOXLoader(manager);
        loader.load( url, function ( result ) {
            const mesh = result.scene;
            mesh.rotateY(Math.PI*0.8);
            const voxSettings = { frame: 0 };
            const frames = mesh.setFrame(0)
            if (frames>1) {
                gui.ids.frame = insertGuiControllerBefore(gui.ids.exportpng, gui.add( voxSettings, 'frame', 0, frames, 1 ).onChange( frame => {
                    mesh.setFrame(frame);
                    render();
                }));
            }
            callback(mesh);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      //  case 'vsb': break;
      case 'wrl':   // TODO: Does not show terrain of house.wrl
        loader = new VRMLLoader(manager);
        loader.load( url, function ( object ) {
            console.log("Loaded VMRL wrl", object);
            callback(object);
        },null, function(e) {
            error(`<h1>Error loading ${ext}<br>${e}</h1>`);
            throw new Error(e);
        });
        break;
      case 'vtk':
      case 'vtp':
        loader = new VTKLoader(manager);
        loader.load( url, function ( geometry ) {
            geometry.center();
            geometry.computeVertexNormals();
            const material = new THREE.MeshLambertMaterial( { color: 0x6699ff, side: THREE.DoubleSide } );
            const mesh = new THREE.Mesh( geometry, material );
            callback( mesh );
        });
        break;
      case 'xyz':
        loader = new XYZLoader(manager);
        loader.load( url, function ( geometry ) {
            gui?.ids?.simplify?.destroy();
            geometry.center();
            const vertexColors = ( geometry.hasAttribute( 'color' ) === true );
            const material = new THREE.PointsMaterial( { size: 0.1, vertexColors: vertexColors } );
            const points = new THREE.Points( geometry, material );
            gui.ids.material.hide();
            gui.ids.materialColor.hide();
            gui.ids.outline.hide();
            gui.ids.pointSize = insertGuiControllerBefore(gui.ids.exportpng, gui.add( points.material, 'size', 0.001, 0.1 ).onChange( render ));
            gui.ids.pointColor = insertGuiControllerBefore(gui.ids.exportpng, gui.addColor( points.material, 'color' ).onChange( render ));
            callback( points );
        });
        break;
      default:
        // TODO: read content-type
        error(`<h1>Error loading<br>No known parser for ${ext}</h1>`);
        throw new Error("Missing parser", ext, buffer);
    }
}

function bufferContains(buffer, needle, maxBytes) {
  const bytes = new Uint8Array(buffer);
  const needleLength = needle.length;
  if (needleLength === 0) return true;
  if (needleLength > bytes.length) return false;
  const n = new Uint8Array(needleLength);
  for (let i = 0; i < needleLength; i++) {
    n[i] = needle.charCodeAt(i);
  }
  const n0 = n[0];
  for (let i = 0, end = Math.min(bytes.length, maxBytes) - needleLength; i <= end; i++) {
    if (bytes[i] !== n0) continue;
    let j = 1;
    for (; j < needleLength; j++) {
      if (bytes[i + j] !== n[j]) break;
    }
    if (j === needleLength) return true;
  }
  return false;
}

function init(type, target, dimensions) {
    console.log('viewer.js init');

    addRenderer()

    scene = new THREE.Scene();
    camera = addPerspectiveCamera(scene, dimensions);
    addIsoMetricCamera(scene, dimensions);
    
    addControls(camera);
    addLights(camera, model);
    addDevelopers();
    if (!target) target = document.body;
    target.appendChild( renderer.domElement );
    dimensions ? resize(dimensions) : window.addEventListener( 'resize', resize );
    if (guiData.animate) animate();
    // gui.open();
}

function addPerspectiveCamera(scene, dimensions) {
    perspectiveCamera = new THREE.PerspectiveCamera( 60, dimensions ? dimensions.width / dimensions.height : window.innerWidth / window.innerHeight, 1, 1000 );
    perspectiveCamera.position.set( 0, 40, 70 );
    scene.add(perspectiveCamera);
    return perspectiveCamera;
}

function addIsoMetricCamera(scene, dimensions) {
    const d = 20;
    const aspect = dimensions ? dimensions.width / dimensions.height : window.innerWidth / window.innerHeight;
    orthographicCamera = new THREE.OrthographicCamera( - d * aspect, d * aspect, d, - d, 1, 1000 );
    orthographicCamera.rotation.order = 'YXZ';

    scene.add(orthographicCamera);
    return orthographicCamera;
}

function fitCameraToObject(camera, object, controls, offset = 1) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = camera.fov * (Math.PI / 180);
  let distance = sphere.radius / Math.sin(fov / 2);

  const aspect = camera.aspect;
  const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  const distanceHorizontal = sphere.radius / Math.sin(horizontalFov / 2);
  distance = Math.max(distance, distanceHorizontal);
  distance *= offset;

  const direction = new THREE.Vector3()
    .subVectors(perspectiveCamera.position, controls.target)
    .normalize();

  perspectiveCamera.position.copy(center.clone().add(direction.multiplyScalar(distance)));

  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  camera.lookAt(center);

  controls.target.copy(center);
  controls.minDistance = distance * 0.10;
  controls.maxDistance = distance * 4;

  controls.update();
}

function addRenderer() {
    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, preserveDrawingBuffer: true } );
    console.log('renderer', renderer);
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    // renderer.toneMapping = THREE.ACESFilmicToneMapping;  // physically based rendering (PBR)
    renderer.toneMappingExposure = 1.0;
}

function addLights(camera, target) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    gui.ids.ambientLight = gui.addFolder( 'Ambient light' ).close();
    gui.ids.ambientLight.add(ambientLight, 'intensity', 0, 5, 0.01).name('Intensity').onChange( render );

    // scene.add( new THREE.HemisphereLight( 0x8d7c7c, 0x494966, 3 ) );

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.target = target;
    directionalLight.position.set(1,7,2);
    // directionalLight.position.normalize();
    camera.add(directionalLight);

    gui.ids.directionalLight = gui.addFolder( 'Directional light' ).close();
    gui.ids.directionalLightIntensity = gui.ids.directionalLight.add(directionalLight, 'intensity', 0, 5, 0.01).name('Intensity').onChange( render );
    gui.ids.directionalLightX = gui.ids.directionalLight.add(directionalLight.position, 'x', -10, 10).onChange(render);
    gui.ids.directionalLightY = gui.ids.directionalLight.add(directionalLight.position, 'y', 0, 10).onChange(render);
    gui.ids.directionalLightZ = gui.ids.directionalLight.add(directionalLight.position, 'z', -20, 20).onChange(render);

    const pointLight = new THREE.PointLight(0xffffff, 3);
    pointLight.position.set(0, -25, 30);
    camera.add(pointLight);
    gui.ids.pointLight = gui.addFolder( 'Point light' ).close();
    gui.ids.pointLight.add(pointLight, 'intensity', 0, 5, 0.01).name('Intensity').onChange( render );
    gui.ids.pointLight.add(pointLight, 'distance', 0, 40).name('Reach distance').onChange( render );
    gui.ids.pointLight.add(pointLight.position, 'x', -20, 20).onChange(render);
    gui.ids.pointLight.add(pointLight.position, 'y', -20, 20).onChange(render);
    gui.ids.pointLight.add(pointLight.position, 'z', -100, 100).onChange(render);
}

function addControls(camera) {
    controls = new OrbitControls( camera, renderer.domElement );    // replace with https://github.com/yomotsu/camera-controls ?
    controls.addEventListener( 'change', render ); // use if there is no animation loop
    controls.enableDamping = false;
    controls.enablePan = true;
    if (!gui.ids.controls) gui.ids.controls = gui.addFolder( 'Camera' ).close();

    const state = {
        azimuth: 0,
        polar: Math.PI / 4
    };
    function applyOrbitRotation() {
        const radius = controls.object.position.distanceTo(controls.target);
        const spherical = new THREE.Spherical(radius, state.polar, state.azimuth);
        const offset = new THREE.Vector3().setFromSpherical(spherical);
        controls.object.position.copy(controls.target).add(offset);
        controls.object.lookAt(controls.target);
        controls.update();
    }
    gui.ids.controls.add(state, 'azimuth', -Math.PI, Math.PI, 0.01).name('Yaw').onChange(applyOrbitRotation);
    gui.ids.controls.add(state, 'polar', 0.01, Math.PI - 0.01, 0.01).name('Pitch').onChange(applyOrbitRotation);
    gui.ids.controlsX = replaceGuiController(gui.ids.controlsX, gui.ids.controls.add(controls.target, 'x', -20, 20).onChange( () => { render(); controls.update(); } ));
    gui.ids.controlsY = replaceGuiController(gui.ids.controlsY, gui.ids.controls.add(controls.target, 'y', -20, 20).onChange( () => { render(); controls.update(); } ));
    gui.ids.controlsZ = replaceGuiController(gui.ids.controlsZ, gui.ids.controls.add(controls.target, 'z', -20, 20).onChange( () => { render(); controls.update(); } ));
}

function addDevelopers() {
    gui.ids.developer = gui.addFolder( 'Developer information' ).close();
    const template = document.querySelector('template#license')?.content;
    if (template) {
        const node = document.importNode(template, true);
        gui.ids.developer.$children.appendChild(node);
    }
}

function normalizeMeshIfTooSmall(mesh, minSize=10, targetSize=10) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.x<minSize && size.y<minSize && size.z<minSize) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        mesh.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = targetSize / maxDim;
        mesh.scale.setScalar(scale);
    }
    return mesh;
}

function insertGuiControllerAfter(otherController, newController) {
    if (otherController?.domElement?.parentElement) { // parentElement is not set when destroyed
        const gui = otherController.parent;
        const otherRow = otherController.domElement;
        const newRow = newController.domElement;
        otherRow.after(newRow);
    }
    return newController;
}

function insertGuiControllerBefore(otherController, newController) {
    if (otherController?.domElement?.parentElement) { // parentElement is not set when destroyed
        const gui = otherController.parent;
        const otherRow = otherController.domElement;
        const newRow = newController.domElement;
        otherRow.parentElement.insertBefore(newRow, otherRow);
    }
    return newController;
}

function replaceGuiController(oldController, newController) {
    if (oldController?.domElement?.parentElement) { // parentElement is not set when destroyed
        insertGuiControllerAfter(oldController, newController);
        oldController.destroy();
    }
    return newController;
}

function groupGuiControllers(controllers, title=null) {
    const firstDom = controllers.shift()?.domElement;
    if (title) {
        const nameElement = firstDom.querySelector(':scope>.name') || document.createElement("div");
        nameElement.classList.add('name');
        nameElement.textContent = title;
        firstDom.insertBefore(nameElement, firstDom.firstChild);
    }
    controllers.forEach(c => firstDom.append(c.domElement.querySelector(':scope>.widget')));
}

function getAnimations(model, depth = 0, result = []) {
    if (depth>10) return;   // be safe because it is recursive
    if (model.animations && model.animations.length) {
        result.push.apply(result, model.animations);
    }
    model.traverse( function ( child ) {
        if ( child.isMesh ) {
            getAnimations(child, depth+1, result);
        }
    });
    return result;
}

function setMaterial(enable=true, materialCallback, mesh=model, depth=0) {
    if (depth>3) return;
    mesh.traverse( c => {
        if ( c.isMesh && c.geometry) {
            if ( Array.isArray( c.material ) ) {
                if (!c.materialBackup) c.materialBackup = c.material.map( (material) => material.clone() );
                c.material = enable ? c.materialBackup.map( materialCallback ) : c.materialBackup.map( (material) => material.clone() );
            } else {
                if (!c.materialBackup) c.materialBackup = c.material.clone();
                c.material = enable ? materialCallback( c.materialBackup ) : c.materialBackup.clone();
            }
        } else {
            setMaterial(enable, materialCallback, c, ++depth);
        }
    });
}


function animate() {
    if (guiData.animate) requestAnimationFrame(function() { setTimeout(animate, 1000/25) });
    if (!mixers.length && model) {
        model.rotation.x += 0.02;
        model.rotation.y += 0.01;
        model.rotation.z += 0;
    }
    controls.update();
    timer.update();
    const delta = timer.getDelta();
    mixers.forEach((mixer) => mixer.update(delta));
    renderer.render(scene, camera);
};

function resize(dimensions) {
    const width = dimensions?.width ? dimensions.width : window.innerWidth;
    const height = dimensions?.height ? dimensions.height : window.innerHeight;
    console.log("Resize", width, height, width / height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize( width, height );
    labelRenderer?.setSize( width, height );
    render();
}

function render() {
    renderer.render( scene, camera );
    labelRenderer?.render( scene, camera );
}

function getMaterialProperties(material) {
    console.log('material', material);
    const m = {
        alphaMap: material.alphaMap,
        alphaTest: material.alphaTest,
        aoMap: material.aoMap,
        blending: material.blending,
        bumpMap: material.bumpMap,
        color: new THREE.Color(material.color),
        displacementMap: material.displacementMap,
        emissive: material.emissive,
        emissiveMap: material.emissiveMap,
        envMap: material.envMap,
        envMapIntensity: material.envMapIntensity,
        fog: material.fog,
        map: material.map,
        metalness: material.metalness,
        metalnessMap: material.metalnessMap,
        name: material.name,
        normalMap: material.normalMap,
        opacity: material.opacity,
        roughness: material.roughness,
        roughnessMap: material.roughnessMap,
        side: material.side,
        toneMapped: material.toneMapped,
        transparent: material.transparent,
        vertexColors: material.vertexColors,
        visible: material.visible,
        wireframe: material.wireframe,
    }
    return m;
}

function addGui(type, settings, dimensions) {
    function saveBlob(blob, ext) {
        if (ext>'' && ext[0] != '.') ext = '.' + ext;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("download", document.getElementById('download')?.getAttribute('download')?.replace(/.\w+$/, ext));
        link.setAttribute("href", url);
        link.click();
    }
    
    if ( gui ) gui.destroy();
    gui = new GUI();
    console.log("Add GUI", gui);
    gui.close();
    Object.assign(guiData, {
      animate: false,
      animation: null,
      background: "Color",
      backgroundColor: '#000000',
      material: "Default",
      materialColor: '#CCCCCC',
      flatColors: false,
      outline: false,
      simplify: 0,
      isometric: false,
      png: () => {
        renderer.domElement.toBlob( blob => saveBlob(blob, '.png'), "image/png");
      },
      stl: () => {
        const exporter = new STLExporter();
        const buffer = exporter.parse( model, { binary: true } );
        const blob = new Blob( [ buffer ], { type: 'application/octet-stream' } );
        saveBlob(blob, '.stl');
      },
      glb: () => {
        const exporter = new GLTFExporter().setTextureUtils( TextureUtils );
        exporter.parse(
            model,
            function(buffer) {
                const blob = new Blob( [ buffer ], { type: 'application/octet-stream' } );
                saveBlob(blob, '.glb');
            },
            function(error) {
                error(`<h1>Could not save glb<br>${error}</h1>`);
            },
            {
                trs: false,
                onlyVisible: true,
                binary: true,
                maxTextureSize: Infinity,
                // TODO: animations: [<AnimationClip>]
                includeCustomExtensions: true,
            }
        );
      },
    });
    
    gui.ids = {};
    gui.ids.animate = gui.add( guiData, 'animate' ).name( 'Animate' ).onChange( function () { if (guiData.animate) animate() } );
    gui.ids.background = gui.add( guiData, 'background', { 
        "Color": 'backgroundColor',
        "Texture Disturb": "./textures/disturb.jpg",
        "Texture Hardwood": "./textures/hardwood2_diffuse.jpg",
        "Texture Jade": "./textures/jade.jpg",
        "Blouberg Sunrise": "./textures/equirectangular/blouberg_sunrise_2_1k.hdr",
        "Decaying room": "./textures/2294472375_24a3b8ef46_o.jpg",
        "Esplanade": "./textures/equirectangular/royal_esplanade_2k.hdr.jpg",
        "Glass building": "./textures/equirectangular/lobe.hdr",
        "Ice Planet": "./textures/equirectangular/ice_planet_close.jpg",
        "Meeting room": "./textures/equirectangular.png",
        "Moonless golf": "./textures/equirectangular/moonless_golf_1k.hdr",
        "Overpass": "./textures/equirectangular/pedestrian_overpass_1k.hdr",
        "Quarry": "./textures/equirectangular/quarry_01_1k.hdr",
        "Rocky beach": "./textures/kandao3.jpg",
        "San Giuseppe bridge": "./textures/equirectangular/san_giuseppe_bridge_2k.hdr.jpg",
        "Snowy beach": "./textures/equirectangular/752-hdri-skies-com_1k.hdr",
        "Sunrise": "./textures/equirectangular/spruit_sunrise_1k.hdr",
        "Venice sunset": "./textures/equirectangular/venice_sunset_1k.hdr",
        "World": "./textures/land_ocean_ice_cloud_2048.jpg",
    } ).name('Background').onChange(function(v) {
        if (v && v.toString().match(/\.(hdr)$/)) {
            const loader = new HDRLoader();
            loader.load(v, (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping;
              scene.background = texture;
              scene.environment = texture; // important for reflections too
              render(); // since loader is async
            });
        } else if (v && v.toString().match(/\.(exr)$/)) {
            const loader = new EXRLoader();
            loader.load(v, (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping;
              scene.background = texture;
              scene.environment = texture; // important for reflections too
              render(); // since loader is async
            });
        } else if (v && v.toString().match(/\.(jpg|png|gif)$/)) {
            const loader = new THREE.TextureLoader();
            loader.load(v, (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping;
              scene.background = texture;
              scene.environment = texture; // important for reflections too
              render(); // since loader is async
            });
        } else {
            if (v===null) {
                renderer.setClearColor( 0xffffff, 0);
            } else {
                renderer.setClearColor( guiData.backgroundColor, 1);
                scene.background = guiData.backgroundColor;
                // scene.environment = null;    // allows textures and null?
            }
            render();
        }
    });
    gui.ids.backgroundColor = gui.addColor( guiData, 'backgroundColor' ).name('Background color').onChange( v => gui.ids.background.setValue("backgroundColor") );

    const textureLoader = new THREE.TextureLoader();
    const threeTone = textureLoader.load( './textures/gradientMaps/threeTone.jpg' );
    threeTone.minFilter = THREE.NearestFilter;
    threeTone.magFilter = THREE.NearestFilter;
    
    const setMaterialColor = () => setMaterial(true, (material) => { const newMaterial = material.clone(); newMaterial.color.set( guiData.materialColor ); return newMaterial; });
    gui.ids.material = gui.add( guiData, 'material', {
        "Default": () => setMaterial(false),
        "Color": setMaterialColor,
        'Cartoon': () => setMaterial(true, (material) => new THREE.MeshToonMaterial( { ...getMaterialProperties(material), gradientMap: threeTone } )),
        'Matcap': () => setMaterial(true, (material) => new THREE.MeshMatcapMaterial( {...getMaterialProperties(material) } )),
        'Smooth': () => setMaterial(true, (material) => new THREE.MeshStandardMaterial({ ...getMaterialProperties(material), flatShading: false }) ),
        'FlatShading': () => setMaterial(true, (material) => new THREE.MeshStandardMaterial({ ...getMaterialProperties(material), flatShading: true }) ),
        'Flat': () => setMaterial(true, (material) => new THREE.MeshBasicMaterial( { toneMapped: false } )),
        'Wireframe': () => setMaterial(true, (material) => new THREE.MeshBasicMaterial( {...getMaterialProperties(material), wireframe: true } )),
        "Gold": () => setMaterial(true, () => goldMaterial),
        "Glass": () => setMaterial(true, () => glassMaterial),
    } ).name('Material').onChange(function(v) {
        if (typeof v === 'string') {
            console.log('material index', v, this._names.indexOf(v));
            v = this._values[ this._names.indexOf(v) ];
        }
        console.log("gui", this, gui, guiData, v);
        typeof v === 'function' ? v() : console.warn("Could set material", v);
        render();
    });
    
    gui.ids.materialColor = gui.addColor( guiData, 'materialColor' ).name( 'Material color' ).onChange( () => gui.ids.material.setValue(setMaterialColor) );
    gui.ids.outline = gui.add( guiData, 'outline').name( 'Outline' ).onChange( function(v) {
        if (v) {
            const effect = new OutlineEffect( renderer );
            let renderingOutline = false;
            scene.onAfterRender = function () {
                if ( renderingOutline ) return;
                renderingOutline = true;
                effect.renderOutline( scene, camera );
                renderingOutline = false;
            }
        } else {
            console.log("clear onAfterRender"); 
            scene.onAfterRender = () => {}; // when null is sometimes complains it is not a function
        }
        render();
    } );
    if (settings?.experimental?.includes('simplify')) {
        gui.ids.simplify = gui.add( guiData, 'simplify', 0, 0.99, 0.1).name( 'Simplify' ).onFinishChange( (removeAmount) => {
            simplify(model, removeAmount);
            render();
        });
    }

    gui.ids.isometric = gui.add( guiData, 'isometric').name( 'Isometric' ).onChange( function(isIsoMetric) {
        function syncPerspectiveCamera() {
            perspectiveCamera.position.copy(camera.position);
            perspectiveCamera.quaternion.copy(camera.quaternion);
            perspectiveCamera.updateMatrixWorld(true);
        }
        if (isIsoMetric) {
            function updateOrthoFrustum() {
                const distance = perspectiveCamera.position.distanceTo(controls.target);
                const vFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
                const height = 2 * Math.tan(vFov / 2) * distance;
                const width = height * perspectiveCamera.aspect;
                orthographicCamera.left = -width / 2;
                orthographicCamera.right = width / 2;
                orthographicCamera.top = height / 2;
                orthographicCamera.bottom = -height / 2;

                orthographicCamera.near = perspectiveCamera.near;
                orthographicCamera.far = perspectiveCamera.far;
                orthographicCamera.position.copy(perspectiveCamera.position);
                orthographicCamera.quaternion.copy(perspectiveCamera.quaternion);

                orthographicCamera.updateProjectionMatrix();
                orthographicCamera.updateMatrixWorld(true);

                camera = orthographicCamera;
                controls.object = camera;
                
                controls.addEventListener('change', syncPerspectiveCamera);
                
            }
            updateOrthoFrustum();
        } else {
            controls.removeEventListener('change', syncPerspectiveCamera);
            perspectiveCamera.position.copy(orthographicCamera.position);
            perspectiveCamera.quaternion.copy(orthographicCamera.quaternion);
            camera = perspectiveCamera;
            controls.object = camera;
        }
        camera.updateMatrixWorld(true);
        render();
    });

    gui.ids.exportpng = gui.add( guiData, 'png').name( 'PNG' );
    gui.ids.exportstl = gui.add( guiData, 'stl').name( 'STL' );
    gui.ids.exportglb = gui.add( guiData, 'glb').name( 'GLB' );
    groupGuiControllers([gui.ids.exportpng, gui.ids.exportstl, gui.ids.exportglb], 'Download');
    // TODO: append licenses
}

function simplify(model, removeAmount, weightedExponent = 1.5) {
    const modifier = new SimplifyModifier();
    const maxDepth = 100;
    function getGeometryAttributesPositionCount(mpart, depth=0) {
        if (depth>maxDepth) return false;   // be safe because it is recursive
        let totalGeometry = (mpart.backup?.attributes?.position?.count || mpart.geometry?.attributes?.position?.count || 0) ** weightedExponent;
        if (!totalGeometry) {
            mpart.traverse && mpart.traverse( c => {
                if (c.geometry) {
                    totalGeometry += getGeometryAttributesPositionCount(c, depth+1);
                }
            });
        }
        return totalGeometry;
    }
    function simplify(mpart, totalGeometry, depth=0) {
        if (depth>maxDepth) return false;   // be safe because it is recursive
        if (mpart.geometry) {
            // console.log("Found geometry at depth", depth, mpart.geometry);
            if (mpart.backup) mpart.geometry = mpart.backup;
            if (!mpart.backup) mpart.backup = mpart.geometry;
            let geometryCount = (mpart.geometry?.attributes?.position?.count || 0) ** weightedExponent;
            if (geometryCount / totalGeometry>0) {
                const count = Math.floor( mpart.geometry?.attributes?.position?.count * removeAmount *  (geometryCount / totalGeometry) ); 
                mpart.geometry = modifier.modify( BufferGeometryUtils.mergeVertices( mpart.geometry ), count );
            }
            return true;
        } else {
            mpart.traverse && mpart.traverse( c => {
                if (c.geometry) {
                    simplify(c,  totalGeometry, depth+1);
                }
            });
        }
        return false;
    }
    let totalGeometry = getGeometryAttributesPositionCount(model);
    simplify(model, totalGeometry);
}

function updateObjectsVisibility() {
    model.traverse( c => {
        if ( c.isLineSegments ) {
            if ( c.isConditionalLine ) {
                c.visible = guiData.conditionalLines;
            } else {
                c.visible = guiData.displayLines;
            }
        } else if ( c.isGroup ) {
            // Hide objects with building step > gui setting
            c.visible = c.userData.buildingStep <= guiData.buildingStep;
        }
    });
    renderer.render(scene, camera);
}

function pdb2model(pdb) {
    const root = new THREE.Group();
    const offset = new THREE.Vector3();
    const geometryAtoms = pdb.geometryAtoms;
    const geometryBonds = pdb.geometryBonds;
    const json = pdb.json;

    const boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
    const sphereGeometry = new THREE.IcosahedronGeometry( 1, 3 );

    geometryAtoms.computeBoundingBox();
    geometryAtoms.boundingBox.getCenter( offset ).negate();

    geometryAtoms.translate( offset.x, offset.y, offset.z );
    geometryBonds.translate( offset.x, offset.y, offset.z );

    let positions = geometryAtoms.getAttribute( 'position' );
    const colors = geometryAtoms.getAttribute( 'color' );

    const position = new THREE.Vector3();
    const color = new THREE.Color();

    for ( let i = 0; i < positions.count; i ++ ) {

        position.x = positions.getX( i );
        position.y = positions.getY( i );
        position.z = positions.getZ( i );

        color.r = colors.getX( i );
        color.g = colors.getY( i );
        color.b = colors.getZ( i );

        const material = new THREE.MeshPhongMaterial( { color: color } );

        const object = new THREE.Mesh( sphereGeometry, material );
        object.position.copy( position );
        object.position.multiplyScalar( 75 );
        object.scale.multiplyScalar( 25 );
        root.add( object );

        const atom = json.atoms[ i ];

        const text = document.createElement( 'div' );
        text.className = 'label';
        text.style.color = 'rgb(' + atom[ 3 ][ 0 ] + ',' + atom[ 3 ][ 1 ] + ',' + atom[ 3 ][ 2 ] + ')';
        text.textContent = atom[ 4 ];

        const label = new CSS2DObject( text );
        label.position.copy( object.position );
        root.add( label );

    }

    positions = geometryBonds.getAttribute( 'position' );

    const start = new THREE.Vector3();
    const end = new THREE.Vector3();

    for ( let i = 0; i < positions.count; i += 2 ) {

        start.x = positions.getX( i );
        start.y = positions.getY( i );
        start.z = positions.getZ( i );

        end.x = positions.getX( i + 1 );
        end.y = positions.getY( i + 1 );
        end.z = positions.getZ( i + 1 );

        start.multiplyScalar( 75 );
        end.multiplyScalar( 75 );

        const object = new THREE.Mesh( boxGeometry, new THREE.MeshPhongMaterial( { color: 0xffffff } ) );
        object.position.copy( start );
        object.position.lerp( end, 0.5 );
        object.scale.set( 5, 5, start.distanceTo( end ) );
        object.lookAt( end );
        root.add( object );

    }

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize( window.innerWidth, window.innerHeight );
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild( labelRenderer.domElement );
    return root;
}

export { load };

console.log('viewer.js end of script');