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
		this.activeSceneIndex = 0;
		this.porcess = 0;
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			autoClear: true,
		});
		this.renderer.setClearColor('#020206');
		this.renderer.shadowMap.enabled = true;
		this.renderer.setScissorTest(true);

		this.camera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.resetCamera();

		// this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		// this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
		// this.controls.dampingFactor = 0.05;
		// this.controls.screenSpacePanning = false;
		// this.controls.minDistance = 100;
		// this.controls.maxDistance = 500;
		// this.controls.maxPolarAngle = Math.PI;
	},

	/*
	* @desc common
	*  */
	resizeDisplayGL: function () {
		this.recalcAspectRatio();
		this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight, false);
		if (this.bloomComposerScenePerson) {
			this.bloomComposerScenePerson.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
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
		let porcess = this.porcess;
		let wH = window.innerHeight;
		let wW = window.innerWidth;
		if (!this.renderer.autoClear) this.renderer.clear();
		if (this.bloomComposerScenePerson) {
			this.renderer.setScissor(0, 0, wW, wH * (100 - porcess) / 100);
			this.bloomComposerScenePerson.render();
			this.renderer.setScissor(0, wH * porcess / 100, wW, wH);
			this.renderer.render(this.dnaScene, this.camera);
		} else {
			this.renderer.setScissor(0, 0, wW, wH * (100 - porcess) / 100);
			this.renderer.render(this.personScene, this.camera);
			this.renderer.setScissor(0, wH * porcess / 100, wW, wH);
			this.renderer.render(this.dnaScene, this.camera);
		}
		if (this.mixer) {
			this.mixer.update(delta);
		}
		if (this.controls) {
			this.controls.update();
		}
		this.scensePersonAnimate();
	},

	/*
	* @desc composer
	* */
	composerBloom: function () {
		const params = {
			exposure: 1,
			bloomStrength: 1,
			bloomThreshold: 0,
			bloomRadius: 0
		};

		let renderScene = new RenderPass(this.personScene, this.camera);

		let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;

		this.bloomComposerScenePerson = new EffectComposer(this.renderer);
		this.bloomComposerScenePerson.addPass(renderScene);
		this.bloomComposerScenePerson.addPass(bloomPass);

	},

	/*
	* @desc scenses
	*  */
	initPersonScense() {

		this.personScene = new THREE.Scene();
		this.composerBloom();
		// addLightGroup
		const center = [0, 0];
		const r = 60;
		const speed = 3;
		const colors = ['#ff0039', '#001eff'];
		const name = 'lineGroup';
		let linesGroup = new THREE.Group();
		linesGroup.name = name;
		for (let i = 0; i < 200; i++) {
			let geometry = new THREE.BoxBufferGeometry(0.3, 0.3, Math.random() * 50 + 10);
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
		this.personScene.add(linesGroup);

		// mirror
		let geometry = new THREE.PlaneBufferGeometry(1000, 1000, 1);
		let groundMirror = new Reflector(geometry, {
			clipBias: 0,
			color: 0x777777,
		});
		groundMirror.position.y = -0.5;
		groundMirror.rotateX(-Math.PI / 2);
		this.personScene.add(groundMirror);

		// load human model
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
				this.personScene.add(model);

				let ambientLight = new THREE.AmbientLight('#ffffff', 0.2);
				this.personScene.add(ambientLight);
			},
			(xhr) => {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},
			(error) => {
				console.log('An error happened');
			}
		);

		// add floor
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
		this.personScene.add(this.circleMeshCp);
		let cubeShadow = new ShadowMesh(this.circleMeshCp);
		this.personScene.add(cubeShadow);
	},

	scensePersonAnimate: function () {
		// addLightGroup Animate
		let linesObj = this.personScene.getObjectByName('lineGroup');
		let lines = [];
		if (linesObj) {
			lines = linesObj.children;
		}
		for (let i = 0; i < lines.length; i++) {
			let pos = lines[i];
			if (pos.position.z < -300) {
				pos.position.z = 300
			} else {
				pos.position.z -= pos._speed;
			}
		}

		// floorAnimate
		if (this.circleMeshCp) {
			if (this.circleMeshCp._params.fl >= 1) {
				this.circleMeshCp._params.fl = 0;
			} else {
				this.circleMeshCp._params.fl += 0.06;
			}
			let s = 300 * Math.asin(this.circleMeshCp._params.fl) + 1;
			this.circleMeshCp.scale.set(s, s, s);
			this.circleMeshCp.material.opacity = 0.15 * Math.acos(this.circleMeshCp._params.fl) - 0.1
		}
	},

	initDNAScense() {
		this.dnaScene = new THREE.Scene();
		let loader = new FBXLoader();
		loader.load(
			'./static/model/dna.fbx',
			(model) => {
				let mesh = model;
				mesh.scale.set(0.2, 0.2, 0.2);
				this.dnaScene.add(mesh);

				let vertices = [];
				for (let i = 0; i < 200; i++) {
					let x = Math.floor(Math.random() * (115 - (-115))) + (-115);
					let y = Math.floor(Math.random() * (115 - (-115))) + (-115);
					let z = Math.floor(Math.random() * (115 - (-115))) + (-115);
					vertices.push(x, y, z);
				}
				let geometry = new THREE.BufferGeometry();
				geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
				let material = new THREE.PointsMaterial({color: '#71c4ff'});
				let points = new THREE.Points(geometry, material);
				this.dnaScene.add(points);

				let ambientLight = new THREE.AmbientLight('#1ba1ff', 1);
				this.dnaScene.add(ambientLight);
			},
			(xhr) => {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},
			(error) => {
				console.log('An error happened');
				console.log(error)
			}
		);
	},

	initTimeLine: function () {
		let tl = gsap.timeline({});
		let step1 = gsap.to(this.camera.position, 5, {z: 45, y: 85});
		tl.add(step1);
		tl.pause();

		let upScroll = () => {
			tl.pause();
			tl.progress((tl.progress() * 100 + 1) / 100);
			updateIndex();
		};

		let downScroll = () => {
			tl.pause();
			tl.progress((tl.progress() * 100 - 1) / 100);
			updateIndex();
		};

		let updateIndex = () => {
			this.activeSceneIndex = 0;
			this.porcess = tl.progress() * 100;
			console.log(this.porcess)
		};

		$(document).bind('mousewheel DOMMouseScroll', function (event) {
			let wheel = event.originalEvent.wheelDelta;
			let detail = event.originalEvent.detail;
			if (event.originalEvent.wheelDelta) { //判断浏览器IE,谷歌滚轮事件
				if (wheel > 0) {
					console.log('上滚');
					downScroll();
				}
				if (wheel < 0) {
					console.log('下滚');
					upScroll();
				}
			} else if (event.originalEvent.detail) {  //Firefox滚轮事件
				if (detail > 0) {
					console.log('下滚');
					upScroll();
				}
				if (detail < 0) {
					console.log('上滚');
					downScroll();
				}
			}
		});
	},


};


console.log('Starting initialisation');
let app = new appClass(document.querySelector('#canvas'));

let render = function () {
	requestAnimationFrame(render);
	app.render();
};

window.addEventListener('resize', function () {
	app.resizeDisplayGL();
}, false);

app.initGL();
app.resizeDisplayGL();
app.initPersonScense();
app.initDNAScense();
app.initTimeLine();

render();
