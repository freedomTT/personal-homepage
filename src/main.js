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
import {ShadowMesh} from 'three/examples/jsm/objects/ShadowMesh.js';


import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {edgeTable} from "three/examples/jsm/objects/MarchingCubes";

import {Reflector} from 'three/examples/jsm/objects/Reflector.js';

const appClass = function (elementToBindTo) {
	this.clock = new THREE.Clock();
	this.renderer = null;
	this.canvas = elementToBindTo;
	this.aspectRatio = 1;
	this.recalcAspectRatio();

	this.scene = null;
	this.cameraDefaults = {
		posCamera: new THREE.Vector3(0.0, 0.0, 200.0),
		posCameraTarget: new THREE.Vector3(0.0, 0.0, 0.0),
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
		this.renderer.setClearColor('#000715');
		this.renderer.shadowMap.enabled = true;
		this.composer = null;
		this.scene = new THREE.Scene();
		// this.scene.fog = new THREE.FogExp2('#000000', 0.0015);

		this.camera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.resetCamera();

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
		this.controls.dampingFactor = 0.05;
		this.controls.screenSpacePanning = false;
		this.controls.minDistance = 100;
		this.controls.maxDistance = 500;

		this.controls.maxPolarAngle = Math.PI / 2;

		let ambientLight = new THREE.AmbientLight('#ffffff', 0.2);
		this.scene.add(ambientLight);
		// let directionalLight = new THREE.DirectionalLight('#ffffff', 0.3);
		// directionalLight.position.set(0.5, 0, 0.866); // ~60º
		// this.scene.add(directionalLight);
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
		let delta = this.clock.getDelta();
		if (!this.renderer.autoClear) this.renderer.clear();
		if (this.composer) {
			this.composer.render();
		} else {
			this.renderer.render(this.scene, this.camera);
		}
		if (this.mixer) {
			this.mixer.update(delta);
		}
		this.controls.update(delta);

		this.scenseAnimate();
		this.floorAnimate();
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
	// load human model
	loadModels: function () {
		let loader = new FBXLoader();
		loader.load(
			'./static/model/fastrun2.fbx',
			(model) => {
				model.scale.set(0.3, 0.3, 0.3);
				model.traverse(function (child) {
					if (child.isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
					}
				});
				let animations = model.animations;
				this.mixer = new THREE.AnimationMixer(model);
				let actions = [];
				for (let i = 0; i < animations.length; i++) {
					actions[i] = this.mixer.clipAction(animations[i]);
				}
				actions[0].play();
				this.scene.add(model);
			},
			(xhr) => {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},
			(error) => {
				console.log('An error happened');
			}
		);
	},
	composerOne: function () {
		const params = {
			exposure: 1,
			bloomStrength: 1,
			bloomThreshold: 0,
			bloomRadius: 0
		};

		let bloomLayer = new THREE.Layers();
		bloomLayer.set(1);

		let renderScene = new RenderPass(this.scene, this.camera);

		let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;

		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(renderScene);
		this.composer.addPass(bloomPass);
	},
	// add floor
	loadFloor: function () {
		let circleCpGeometry = new THREE.CircleGeometry(0.2, 20);
		let circleCpMaterial = new THREE.MeshBasicMaterial({
			side: THREE.DoubleSide,
			blending: THREE.AdditiveBlending,
			color: '#003b84',
			depthTest: true,
			transparent: true,
			opacity: 0.6
		});
		this.circleMeshCp = new THREE.Mesh(circleCpGeometry, circleCpMaterial);
		this.circleMeshCp.name = 'circleMesh';
		this.circleMeshCp._params = {fl: 0};
		this.circleMeshCp.rotateX(-Math.PI / 2);
		this.scene.add(this.circleMeshCp);
		let cubeShadow = new ShadowMesh(this.circleMeshCp);
		this.scene.add(cubeShadow);
	},
	// addLightGroup Animate
	floorAnimate: function () {
		if (this.circleMeshCp._params.fl >= 1) {
			this.circleMeshCp._params.fl = 0;
		} else {
			this.circleMeshCp._params.fl += 0.06;
		}
		let s = 300 * Math.asin(this.circleMeshCp._params.fl) + 1;
		this.circleMeshCp.scale.set(s, s, s);
		this.circleMeshCp.material.opacity = 0.15 * Math.acos(this.circleMeshCp._params.fl) - 0.1
	},
	// addLightGroup
	loadScense: function () {
		const center = [0, 0];
		const r = 60;
		const speed = 3;
		const colors = ['#4892ff', '#ff475d'];
		const name = 'lineGroup';
		let linesGroup = new THREE.Group();
		linesGroup.name = name;
		for (let i = 0; i < 500; i++) {
			let geometry = new THREE.BoxBufferGeometry(0.3, 0.3, Math.random() * 50);
			let material = new THREE.MeshBasicMaterial({color: colors[i % 2]});
			let line = new THREE.Mesh(geometry, material);
			line._speed = 1 + Math.random() * speed;

			let arg = Math.floor(Math.random() * (115 - (-115))) + (-115);
			let x = center[0] + Math.sin(arg * Math.PI / 180) * r + Math.random() * 15;
			let y = center[1] + Math.cos(arg * Math.PI / 180) * r + Math.random() * 15;
			line.position.set(x, y, Math.random() * 300);
			linesGroup.add(line);
		}
		linesGroup.layers.enable(1);
		this.scene.add(linesGroup);

		// mirror
		let geometry = new THREE.PlaneBufferGeometry(1000, 1000, 1);
		let groundMirror = new Reflector(geometry, {
			clipBias: 0,
			color: 0x777777,
		});
		groundMirror.position.y = -0.5;
		groundMirror.rotateX(-Math.PI / 2);
		this.scene.add(groundMirror);
	},
	// addLightGroup Animate
	scenseAnimate: function () {
		let lines = this.scene.getObjectByName('lineGroup').children;
		for (let i = 0; i < lines.length; i++) {
			let pos = lines[i];
			if (pos.position.z < -300) {
				pos.position.z = 300
			} else {
				pos.position.z -= pos._speed;
			}
		}
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
app.composerOne();
app.loadScense();
app.loadModels();
app.loadFloor();
// app.initAnimate();

render();
