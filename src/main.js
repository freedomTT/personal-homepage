import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';

import {gsap} from "gsap";

import * as THREE from 'three';

import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";

import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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
		posCamera: new THREE.Vector3(0.0, 90.0, 200.0),
		posCameraTarget: new THREE.Vector3(0.0, 90.0, 0.0),
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
			autoClear: true,
		});
		this.renderer.setClearColor('#000000');
		this.renderer.shadowMap.enabled = true;
		this.composer = null;
		this.scene = new THREE.Scene();
		// this.scene.fog = new THREE.FogExp2('#000514', 0.0025);

		this.camera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.resetCamera();

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
		this.controls.dampingFactor = 0.05;
		this.controls.screenSpacePanning = false;
		this.controls.minDistance = 100;
		this.controls.maxDistance = 500;

		this.controls.maxPolarAngle = Math.PI / 2;

		let ambientLight = new THREE.AmbientLight('#ffffff', 0.8);
		this.scene.add(ambientLight);
		// let directionalLight = new THREE.DirectionalLight('#ffffff', 0.3);
		// directionalLight.position.set(0.5, 0, 0.866); // ~60º
		// this.scene.add(directionalLight);

		let helper = new THREE.GridHelper(1200, 60, 0xFF4444, 0x404040);
		this.scene.add(helper);
	},

	resizeDisplayGL: function () {
		this.recalcAspectRatio();
		this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight, false);
		if (this.composer) {
			this.composer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
		}
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
		// this.renderer.render(this.scene, this.camera);
		if (this.composer) {
			this.composer.render();
		}
		this.controls.update(this.clock.getDelta());
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
	loadModels: function () {


		let loader = new GLTFLoader();

		// Optional: Provide a DRACOLoader instance to decode compressed mesh data
		let dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath('./static/draco/');
		loader.setDRACOLoader(dracoLoader);
		// Load a glTF resource
		loader.load(
			// resource URL
			'./static/model/pine-forest/sceneDraco.gltf',
			// called when the resource is loaded
			(gltf) => {
				gltf.scene.scale.set(0.1, 0.1, 0.1);
				gltf.scene.rotateY(-Math.PI / 2);
				gltf.scene.traverse((child) => {
					if (child.isMesh) {
						if (child.name === 'Moon_Material_0') { // 太阳
						}
						child.castShadow = true;
						child.receiveShadow = true;
					}
				});
				this.scene.add(gltf.scene);
				this.scene.updateMatrixWorld(true);
				const sunPosition = this.scene.getObjectByName('Moon_Material_0').getWorldPosition(new THREE.Vector3());

				const dirLight = new THREE.DirectionalLight('#ffffff');
				dirLight.castShadow = true;
				dirLight.position.set(0, 1, -1).normalize();
				// this.scene.add(dirLight);


				/*特效*/

				const params = {
					exposure: 1.5,
					bloomStrength: 0.5,
					bloomThreshold: 0,
					bloomRadius: 0
				};

				let renderScene = new RenderPass(this.scene, this.camera);

				let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
				bloomPass.threshold = params.bloomThreshold;
				bloomPass.strength = params.bloomStrength;
				bloomPass.radius = params.bloomRadius;

				this.composer = new EffectComposer(this.renderer);
				this.composer.addPass(renderScene);
				this.composer.addPass(bloomPass);

			},
			// called while loading is progressing
			(xhr) => {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},
			// called when loading has errors
			(error) => {
				console.log('An error happened');
			}
		);
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
app.resizeDisplayGL();
app.loadModels();
// app.initAnimate();

render();
