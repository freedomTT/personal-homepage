import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';

import {gsap} from "gsap";

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


import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';

const appClass = function (elementToBindTo) {
	this.clock = new THREE.Clock();
	this.renderer = null;
	this.canvas = elementToBindTo;
	this.aspectRatio = 1;
	this.recalcAspectRatio();

	this.scene = null;
	this.cameraDefaults = {
		posCamera: new THREE.Vector3(30.0, 90.0, 200.0),
		posCameraTarget: new THREE.Vector3(30.0, 85.0, 45.0),
		near: 0.1,
		far: 10000,
		fov: 45
	};
	this.camera = null;
	this.cameraTarget = this.cameraDefaults.posCameraTarget;

	this.controls = null;
	this.mixers = [];
};

appClass.prototype = {

	constructor: appClass,

	initGL: function () {
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			autoClear: true
		});
		this.renderer.setClearColor('#000000');

		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.FogExp2('#2a2a2a', 0.0025);

		this.camera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.resetCamera();

		// this.controls = new MapControls(this.camera, this.renderer.domElement);
		// this.controls.enableDamping = true;
		// this.controls.dampingFactor = 0.05;
		// this.controls.screenSpacePanning = false;
		// this.controls.minDistance = 0;
		// this.controls.maxDistance = 200;
		// this.controls.maxPolarAngle = Math.PI / 2;
		// this.controls.target = this.cameraTarget;

		let PointLight = new THREE.PointLight('#4a4a4a');
		PointLight.position.set(0, 100, 300);
		this.scene.add(PointLight);

		let helper = new THREE.GridHelper(1200, 60, 0xFF4444, 0x404040);
		this.scene.add(helper);


		/**/
		let loader = new FBXLoader();
		loader.load('./static/model/Sitting.fbx', (object) => {

			object.mixer = new THREE.AnimationMixer(object);
			this.mixers.push(object.mixer);

			let action = object.mixer.clipAction(object.animations[0]);
			action.play();

			object.traverse(function (child) {

				if (child.isMesh) {

					child.castShadow = true;
					child.receiveShadow = true;

				}

			});

			this.scene.add(object);

		});
		/**/
	},

	initContent: function (callback) {
		let modelName = 'room';
		let scope = this;
		let objLoader2 = new OBJLoader2();
		let callbackOnLoad = function (object3d) {
			object3d.scale.set(40, 40, 40);
			object3d.rotateY(-Math.PI / 2);
			scope.scene.add(object3d);
			console.log('Loading complete: ' + modelName);

			callback && callback();
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

		// let effectFilmBW = new FilmPass(0.25, 0.0, 2048, true);
		// let gammaCorrection = new ShaderPass(GammaCorrectionShader);
		// let vignetteShader = new ShaderPass(VignetteShader);
		// this.composer.addPass(gammaCorrection);
		// this.composer.addPass(effectFilmBW);
		// this.composer.addPass(vignetteShader);

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
		if (!this.renderer.autoClear) this.renderer.clear();
		if (this.camera.position.z < 60) {
			this.renderer.render(this.sceneOne, this.cameraOne);
		} else {
			this.composer.render();
		}


		if (this.mixers.length > 0) {

			for (var i = 0; i < this.mixers.length; i++) {

				this.mixers[i].update(this.clock.getDelta());

			}

		}

	},

	initAnimate: function () {
		let tl = gsap.timeline({});
		let step1 = gsap.to(this.camera.position, 5, {z: 45, y: 85});
		tl.add(step1);

		let upScroll = function () {
			tl.pause();
			tl.progress((tl.progress() * 100 + 1) / 100);
		};

		let downScroll = function () {
			tl.pause();
			tl.progress((tl.progress() * 100 - 1) / 100);
		};

		$(document).bind('mousewheel DOMMouseScroll', function (event) {
			let wheel = event.originalEvent.wheelDelta;
			let detail = event.originalEvent.detail;
			if (event.originalEvent.wheelDelta) { //判断浏览器IE,谷歌滚轮事件
				if (wheel > 0) {
					console.log('上滚');
					upScroll();
				}
				if (wheel < 0) {
					console.log('下滚');
					downScroll();
				}
			} else if (event.originalEvent.detail) {  //Firefox滚轮事件
				if (detail > 0) {
					console.log('下滚');
					downScroll();
				}
				if (detail < 0) {
					console.log('上滚');
					upScroll();
				}
			}
		});


	},

	initSceneOne: function () {
		this.sceneOne = new THREE.Scene();
		this.cameraOne = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		let PointLight = new THREE.PointLight('#4a4a4a');
		PointLight.position.set(0, 100, 300);
		this.sceneOne.add(PointLight);

		let helper = new THREE.GridHelper(1200, 60, 0xFF4444, 0x404040);
		this.sceneOne.add(helper);
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

console.log('Starting initialisation');
app.initGL();
app.initSceneOne();
app.resizeDisplayGL();
app.initContent(() => {
	setTimeout(() => {
		app.initAnimate();
	}, 1000)
});
app.setEffact();

render();
