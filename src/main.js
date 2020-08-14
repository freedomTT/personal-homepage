import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';
import * as THREE from 'three';
import {MapControls} from "three/examples/jsm/controls/OrbitControls.js";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";
import {OBJLoader2} from "three/examples/jsm/loaders/OBJLoader2.js";
import {MtlObjBridge} from "three/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js";

import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {FilmPass} from 'three/examples/jsm/postprocessing/FilmPass.js';
import {VignetteShader} from 'three/examples/jsm/shaders/VignetteShader.js';
import {GammaCorrectionShader} from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

const appClass = function (elementToBindTo) {
	this.clock = new THREE.Clock();
	this.renderer = null;
	this.canvas = elementToBindTo;
	this.aspectRatio = 1;
	this.recalcAspectRatio();

	this.scene = null;
	this.cameraDefaults = {
		posCamera: new THREE.Vector3(30.0, 100.0, 200.0),
		posCameraTarget: new THREE.Vector3(30.0, 85.0, 0.0),
		near: 0.1,
		far: 10000,
		fov: 45
	};
	this.camera = null;
	this.cameraTarget = this.cameraDefaults.posCameraTarget;

	this.controls = null;
};

appClass.prototype = {

	constructor: appClass,

	initGL: function () {
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			autoClear: true
		});
		this.renderer.setClearColor(0x050505);

		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.controls = new MapControls(this.camera, this.renderer.domElement);

		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.screenSpacePanning = false;
		this.controls.minDistance = 0;
		this.controls.maxDistance = 200;
		this.controls.maxPolarAngle = Math.PI / 2;
		this.controls.target = this.cameraTarget;
		this.resetCamera();

		let PointLight = new THREE.PointLight('#ffffff');
		PointLight.position.set(0, 100, 300);
		this.scene.add(PointLight);

		let helper = new THREE.GridHelper(1200, 60, 0xFF4444, 0x404040);
		this.scene.add(helper);
	},

	initContent: function () {
		let modelName = 'room';
		let scope = this;
		let objLoader2 = new OBJLoader2();
		let callbackOnLoad = function (object3d) {
			object3d.scale.set(40, 40, 40);
			object3d.rotateY(-Math.PI / 2);
			scope.scene.add(object3d);
			console.log('Loading complete: ' + modelName);
		};

		let onLoadMtl = function (mtlParseResult) {
			objLoader2.setModelName(modelName);
			objLoader2.setLogging(true, true);
			objLoader2.addMaterials(MtlObjBridge.addMaterialsFromMtlLoader(mtlParseResult), true);
			objLoader2.load('./static/model/room.obj', callbackOnLoad, null, null, null);
		};
		let mtlLoader = new MTLLoader();
		mtlLoader.load('./static/model/room.mtl', onLoadMtl);
	},
	setEffact: function () {

		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(new RenderPass(this.scene, this.camera));

		let effectFilmBW = new FilmPass(0.25, 0.0, 2048, true);
		let gammaCorrection = new ShaderPass(GammaCorrectionShader);
		let vignetteShader = new ShaderPass(VignetteShader);
		this.composer.addPass(gammaCorrection);
		this.composer.addPass(effectFilmBW);
		this.composer.addPass(vignetteShader);

	},

	resizeDisplayGL: function () {
		this.recalcAspectRatio();
		this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight, false);

		this.updateCamera();
	},

	recalcAspectRatio: function () {
		this.aspectRatio = (this.canvas.offsetHeight === 0) ? 1 : this.canvas.offsetWidth / this.canvas.offsetHeight;
	},

	resetCamera: function () {
		this.camera.position.copy(this.cameraDefaults.posCamera);
		this.cameraTarget.copy(this.cameraDefaults.posCameraTarget);

		this.updateCamera();
	},

	updateCamera: function () {
		this.camera.aspect = this.aspectRatio;
		this.camera.lookAt(this.cameraTarget);
		this.camera.updateProjectionMatrix();
	},

	render: function () {
		let delta = this.clock.getDelta();
		if (!this.renderer.autoClear) this.renderer.clear();
		// this.controls.update(delta);
		// this.renderer.render(this.scene, this.camera);
		this.composer.render();
	}
};

let app = new appClass(document.querySelector('#canvas'));

let resizeWindow = function () {
	app.resizeDisplayGL();
};

let render = function () {
	requestAnimationFrame(render);
	app.render();
};

window.addEventListener('resize', resizeWindow, false);

console.log('Starting initialisation phase...');
app.initGL();
app.resizeDisplayGL();
app.initContent();
app.setEffact();

render();
