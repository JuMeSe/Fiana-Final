import './style.css';

import stream from '/stream.mp3';
import night from '/night.mp3';
import hoverSFX from '/hover_lantern.wav';
import MonserratRegular from '/fonts/Montserrat-Regular.ttf';
// load data from data.json
import locationsData from './data.json';
import {Howl, Howler} from 'howler';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BokehShader, BokehDepthShader } from 'three/addons/shaders/BokehShader2.js';
import feather from 'feather-icons';

let controls, materialDepth;

const backgroundColor = new THREE.Color("rgb(30, 27, 75)");
const fogColor        = new THREE.Color("rgb(30, 27, 75)");
const groundColor     = new THREE.Color(0x224488);

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 10 );
const cameraInitPos   = new THREE.Vector3(2,5,2);
camera.position.set( cameraInitPos.x, cameraInitPos.y, cameraInitPos.z );
const scene = new THREE.Scene();
scene.background = backgroundColor;
scene.fog = new THREE.Fog( fogColor, 3, 6 );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.CineonToneMapping;
renderer.toneMappingExposure = 1;

const postprocessing  = { enabled: true };
const depthShader     = BokehDepthShader;
const shaderSettings  = {rings: 3,samples: 4};
let windowHalfX       = window.innerWidth / 2;
let windowHalfY       = window.innerHeight / 2;
const loader          = new GLTFLoader().setPath( '/' );
const container       = document.getElementById( 'scene' );

const startTime       = Date.now();
const mouse           = new THREE.Vector2();
const raycaster       = new THREE.Raycaster();
const target          = new THREE.Vector3( -20, -20, - 20 );
var lanterns          = []; 
var currentHover      = {};

var scene360                    = new THREE.Scene();
scene360.background             = new THREE.Color(0xffffff);
var camera360                   = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera360.position.z            = 3;
var controls360                 = new OrbitControls(camera360, renderer.domElement);
controls360.enableDamping       = true;
controls360.dampingFactor       = 0.05;
controls360.screenSpacePanning  = false;
var is360                       = false;
// sons
const ambientPads     = new Howl({
  src: [`${stream}`],
  html5: true,
  loop:true,
  volume:0.5
});
const ambientNight    = new Howl({
  src: [`${night}`],
  html5: true,
  loop:true,
  volume:1
});
const hoverSoundEffect= new Howl({
  src: [`${hoverSFX}`],
  volume:1
});

function setupLight() {
  var hemiLight = new THREE.HemisphereLight( 0x224488, 0xffffff, 0.1 );
  hemiLight.color.setHSL( 0.6, 0.75, 0.5 );
  hemiLight.groundColor.setHSL( 0.095, 0.5, 0.5 );
  hemiLight.position.set( 0, 500, 0 );
  scene.add( hemiLight );

  var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
  dirLight.position.set( -1, 0.75, 1 );
  dirLight.position.multiplyScalar( 50);
  dirLight.name = "dirlight";
  dirLight.shadowCameraVisible = true;

  scene.add( dirLight );

  dirLight.castShadow = true;
  dirLight.shadowMapWidth = dirLight.shadowMapHeight = 1024*2;

  var d = 300;

  dirLight.shadowCameraLeft = -d;
  dirLight.shadowCameraRight = d;
  dirLight.shadowCameraTop = d;
  dirLight.shadowCameraBottom = -d;

  dirLight.shadowCameraFar = 3500;
  dirLight.shadowBias = -0.0001;
  dirLight.shadowDarkness = 0.35;
}

function loadModel(file,overideMaterial=null) {
  loader.load( file, async function ( gltf ) {

    const model = gltf.scene;
    model.scale.set(.001*model.scale.x, .001*model.scale.y, .001 * model.scale.z)
    // wait until the model can be added to the scene without blocking due to shader compilation

    await renderer.compileAsync( model, camera, scene );
    if(overideMaterial != null)
    {
      model.traverse((object)=>{object.material = overideMaterial})
    }
    model.traverse((item)=>{console.log(item)});
    scene.add( model );
  } );
}

function init() {

  // build map 
  // TODO : build by chunk
  loadModel('half_ground.glb');
  loadModel('all_buildings.glb');
  
  // populate lanterns
  locationsData.forEach((locationData,locationIndex)=>{
    let lantern;
    let lanternLight;
    loader.load( 'paper_lantern.glb', async function ( gltf ) {
  
      lantern = gltf.scene;
      lantern.scale.set(.05*lantern.scale.x, .05*lantern.scale.y, .05 * lantern.scale.z)
      // wait until the model can be added to the scene without blocking due to shader compilation
  
      await renderer.compileAsync( lantern, camera, scene );
  
      //lantern.traverse((item)=>{console.log(item)});
      lantern.name = "lantern_"+locationData.nom_lieu;
      scene.add( lantern );
  
      lanternLight = new THREE.PointLight( 0xffff88, 1, 0.2,0.1);
      lanternLight.name = 'lanternLight';
      lanternLight.castShadow = true;
      lantern.add(lanternLight);
      lantern.userData.locationIndex = locationIndex;
      console.log(locationData.x,locationData.y,locationData.z);
      if(locationData.x !== "undefined"){
        lantern.position.set(locationData.x,locationData.y,locationData.z);
      }
  
      lanterns.push(lantern);
    } );
  });
  //console.log("Lanterns : ",lanterns);
  materialDepth = new THREE.ShaderMaterial( {
    uniforms:       depthShader.uniforms,
    vertexShader:   depthShader.vertexShader,
    fragmentShader: depthShader.fragmentShader
  } );

  materialDepth.uniforms[ 'mNear' ].value = 2;
  materialDepth.uniforms[ 'mFar' ].value  = 3;

  setupLight();

  controls = new MapControls( camera, renderer.domElement );
  controls.enableDamping    = true;
  //controls.enableZoom       = false;
  controls.minZoom          = 2;
  controls.maxZoom          = 5;
  controls.maxAzimuthAngle  = THREE.MathUtils.degToRad(45)
  controls.minAzimuthAngle  = THREE.MathUtils.degToRad(45)
  controls.maxPolarAngle    = THREE.MathUtils.degToRad(45)
  controls.minPolarAngle    = THREE.MathUtils.degToRad(45)

  initPostprocessing();

  container.appendChild( renderer.domElement );
  container.style.touchAction = 'none';
  addMouseEvents();

  //container.addEventListener( 'pointermove', onPointerMove );
  
  window.addEventListener( 'resize', onWindowResize );
}

function checkChunks(){

}

function checkLocations(){

}

function animate() {
  requestAnimationFrame( animate );

	// required if controls.enableDamping or controls.autoRotate are set to true
	controls.update();

	render();

}

function render() {

  const elapsedMiliseconds = Math.round((((Date.now() - startTime) * 0.0015) + Number.EPSILON)*1000);
  //console.log( elapsedMiliseconds )
  //camera.lookAt( target );
  
	camera.updateMatrixWorld();

  // default
  let toRenderScene = scene;
  let toRenderCamera = camera;

  if (is360) {
    postprocessing.enabled = false;
    toRenderScene = scene360;
    toRenderCamera = camera360;
  }

  if ( postprocessing.enabled ) {

    renderer.clear();

    // render scene into texture

    renderer.setRenderTarget( postprocessing.rtTextureColor );
    renderer.clear();
    renderer.render( toRenderScene, toRenderCamera );

    // render depth into texture

    scene.overrideMaterial = materialDepth;
    renderer.setRenderTarget( postprocessing.rtTextureDepth );
    renderer.clear();
    renderer.render( toRenderScene, toRenderCamera );
    scene.overrideMaterial = null;

    // render bokeh composite

    renderer.setRenderTarget( null );
    renderer.render( postprocessing.scene, postprocessing.camera );


  } else {

    scene.overrideMaterial = null;

    renderer.setRenderTarget( null );
    renderer.clear();
    renderer.render( toRenderScene, toRenderCamera );

  }

}

function initPostprocessing() {

  postprocessing.scene = new THREE.Scene();

  postprocessing.camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, - 10000, 10000 );
  postprocessing.camera.position.z = 100;

  postprocessing.scene.add( postprocessing.camera );

  postprocessing.rtTextureDepth = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType } );
  postprocessing.rtTextureColor = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType } );

  const bokeh_shader = BokehShader;

  postprocessing.bokeh_uniforms = THREE.UniformsUtils.clone( bokeh_shader.uniforms );

  postprocessing.bokeh_uniforms[ 'tColor' ].value = postprocessing.rtTextureColor.texture;
  postprocessing.bokeh_uniforms[ 'tDepth' ].value = postprocessing.rtTextureDepth.texture;
  postprocessing.bokeh_uniforms[ 'textureWidth' ].value = window.innerWidth;
  postprocessing.bokeh_uniforms[ 'textureHeight' ].value = window.innerHeight;

  postprocessing.materialBokeh = new THREE.ShaderMaterial( {

    uniforms: postprocessing.bokeh_uniforms,
    vertexShader: bokeh_shader.vertexShader,
    fragmentShader: bokeh_shader.fragmentShader,
    defines: {
      RINGS: shaderSettings.rings,
      SAMPLES: shaderSettings.samples
    }

  } );

  postprocessing.quad = new THREE.Mesh( new THREE.PlaneGeometry( window.innerWidth, window.innerHeight ), postprocessing.materialBokeh );
  postprocessing.quad.position.z = - 500;
  postprocessing.scene.add( postprocessing.quad );

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  postprocessing.rtTextureDepth.setSize( window.innerWidth, window.innerHeight );
  postprocessing.rtTextureColor.setSize( window.innerWidth, window.innerHeight );

  postprocessing.bokeh_uniforms[ 'textureWidth' ].value = window.innerWidth;
  postprocessing.bokeh_uniforms[ 'textureHeight' ].value = window.innerHeight;


  renderer.setSize( window.innerWidth, window.innerHeight );

}

function addMouseEvents() {
  window.addEventListener("mouseup", function () { 
      console.log("mouse coords = ", camera.position);
  });

  document.addEventListener("mousedown", (event) => { // here handle click events
      let intersectedObject = checkIntersects(event, "mousedown");
      if(intersectedObject !== 'undifined' & intersectedObject !== null)
      {
        // navigate to 360 view detail page
        create360(locationsData[intersectedObject.userData.locationIndex])
      }
  });

  document.addEventListener("mousemove", (event) => {// here hand hover events
      let intersectedObject = checkIntersects(event, "mousemove");
      if(intersectedObject !== null)
      {
        if(currentHover != intersectedObject){
          currentHover = intersectedObject;
          // play hover sound effect
          hoverSoundEffect.play();
        }
        
        // find point light
        let intersectedLight = intersectedObject.getObjectByName('lanternLight');
        //console.log(intersectedLight);
        // pulse & brighten light
        intersectedLight.intensity = 1;
      }else{
        currentHover = null;
        let i = 0;
        //console.log(scene);
        /*scene.traverseVisible((object)=>{
          console.log("traversing Scene : ",i,object);
          let otherLight = object.getObjectByName('lanternLight');
          if(otherLight !== "undefined" & otherLight.isLight){
            console.log("OtherLight :",otherLight);
            // dim light if unvisited ?
            otherLight.intensity = 0.1;
          }
          i++;
        });*/
      }
  });

  document.addEventListener('wheel', (event)=>{
    console.log(controls.getDistance());
  })
}

function GetMouseCoords(event) {
  let div = container; // replace 'yourDivId' with your div's ID
  let rect = div.getBoundingClientRect();

  return {
      x: event.clientX - rect.x,
      y: event.clientY - rect.y,
  };
}

function checkIntersects(event, eventType) {
  event.preventDefault();

  const rect = container.getBoundingClientRect();
  let mouse = new THREE.Vector2();

  mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  let objects = lanterns;
  const intersects = raycaster.intersectObjects(objects, true);
    

  let intersected = intersects.length > 0 ? intersects[0].object : null;
  if(intersects.length > 0){
    //console.log(intersected.parent);
    return intersected.parent.parent;
  }

  //console.log(" intersects.length = ", intersects.length);
  return null;
}

function create360(locationData) {

  // Création de la géométrie de la sphère
  const geometry = new THREE.SphereGeometry(10, 30, 30);

  // Chargement de la texture
  const texture = new THREE.TextureLoader().load(locationData.photo_360);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;

  // Création du matériau
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
  });

  // Création de la sphère
  const sphere = new THREE.Mesh(geometry, material);

  // Ajout de la sphère à la scène 360
  scene360.add(sphere);

  // Création de texte
  const myText = new Text();
  scene360.add(myText);

  // Configuration des propriétés du texte
  // myText.text = data.lieu;
  myText.text = locationData.nom_lieu;
  myText.fontSize = 1;
  myText.anchorX = "center";
  myText.font = MonserratRegular;
  myText.position.z = -4;
  myText.color = 0x800020;

  // Mise à jour du rendu du texte
  myText.sync();

  // Ajouter le bouton "Quitter" seulement si la scène 360 n'est pas déjà ouverte
  /*if (!exitButton) {
    exitButton = document.createElement('button');
    exitButton.textContent = 'Quitter';
    exitButton.style.position = 'absolute';
    exitButton.style.top = '100px';
    exitButton.style.right = '10px';
    exitButton.style.display = 'none'; // Cacher le bouton par défaut
    document.body.appendChild(exitButton);

    // Ajout d'un gestionnaire d'événements clic au bouton "Quitter"
    exitButton.addEventListener('click', exit360Scene);
  } else {
    // Afficher le bouton s'il existe déjà
    exitButton.style.display = 'block';
  }*/
  is360 = true;
}

// Fonction pour quitter la scène 360 et revenir à la scène principale
function exit360Scene() {
  is360 = false;
  // Nettoyer la scène 360
  scene360.children = [];
  
  // Réinitialiser la caméra principale
  //camera.position.set(cameraInitPos.x, cameraInitPos.y, cameraInitPos.z);
  
  // Masquer le bouton "Quitter" s'il existe
  /*if (exitButton) {
    exitButton.style.display = 'none';
  }*/
}

// may use later
function makeInstances ( geometry, material ) {

  const instanceCount = material.userData.instanceCount;

  const instanceID = new THREE.InstancedBufferAttribute(
    new Float32Array( new Array( instanceCount ).fill( 0 ).map( ( _, index ) => index ) ),
    1
  );

  geometry = new THREE.InstancedBufferGeometry().copy( geometry );
  geometry.addAttribute( 'instanceID', instanceID );
  geometry.maxInstancedCount = instanceCount;

  return geometry;

}

function muteAll(boolean){
  if(boolean){
    document.querySelector('#toggle_sound').innerHTML = feather.icons['volume-x'].toSvg();
  }else{
    document.querySelector('#toggle_sound').innerHTML = feather.icons['volume-2'].toSvg();
  }
  document.querySelector('#toggle_sound').dataset.muted = boolean;
  Howler.mute(boolean);
}

// scene 3D

init();
animate();

document.querySelector('#toggle_sound').addEventListener('click',(event) => {
  let target = event.currentTarget;

  console.log(target,target.dataset.muted,(target.dataset.muted === "false"));
  muteAll((target.dataset.muted === "false"));
});

document.querySelector('#nav_map').addEventListener('click',() => {
  // hide all non map div
});

document.querySelector('#nav_about').addEventListener('click',() => {
  // display about div
});
// Intro screen
document.querySelector('#start').addEventListener('click',() => {
  document.querySelector('#nav_map').innerHTML = feather.icons.map.toSvg();
  muteAll(false);
  document.querySelector('#intro').style.display = 'none';
  ambientPads.play();
  ambientNight.play();
});
