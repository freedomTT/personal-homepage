import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';
import * as THREE from 'three';
import {FlyControls} from "three/examples/jsm/controls/FlyControls.js";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";
import {OBJLoader2} from "three/examples/jsm/loaders/OBJLoader2.js";
import {MtlObjBridge} from "three/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js";


const appClass = function (elementToBindTo) {
	this.clock = new THREE.Clock();
	this.renderer = null;
	this.canvas = elementToBindTo;
	this.aspectRatio = 1;
	this.recalcAspectRatio();

	this.scene = null;
	this.cameraDefaults = {
		posCamera: new THREE.Vector3(0.0, 200.0, 0.0),
		posCameraTarget: new THREE.Vector3(0.0, 0.0, -1000.0),
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
		this.resetCamera();
		this.controls = new FlyControls(this.camera, this.renderer.domElement);
		this.controls.movementSpeed = 1000;
		this.controls.domElement = this.renderer.domElement;
		this.controls.rollSpeed = Math.PI / 24;
		this.controls.autoForward = false;
		this.controls.dragToLook = false;

		let ambientLight = new THREE.AmbientLight('#404040');
		let directionalLight1 = new THREE.DirectionalLight('#626262');
		directionalLight1.position.set(-100, -50, 100);
		let pointLight = new THREE.PointLight('#62000c');
		pointLight.position.set(0, 0, 0);
		this.scene.add(directionalLight1);
		this.scene.add(ambientLight);
		this.scene.add(pointLight);

		let helper = new THREE.GridHelper(1200, 60, 0xFF4444, 0x404040);
		this.scene.add(helper);
	},

	initContent: function () {
		let modelName = 'female02';
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

	resizeDisplayGL: function () {
		// this.controls.handleResize();

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
		this.controls.update(delta);
		this.renderer.render(this.scene, this.camera);
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

render();
