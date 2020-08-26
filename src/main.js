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
import {NodePass} from 'three/examples/jsm/nodes/postprocessing/NodePass.js';
import * as Nodes from 'three/examples/jsm/nodes/Nodes.js';


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
		posCamera: new THREE.Vector3(0, 10, 250),
		posCameraTarget: new THREE.Vector3(0, 10, 0),
		near: 0.1,
		far: 10000,
		fov: 45
	};

	this.controls = null;
	this.mixers = [];
};

appClass.prototype = {

	constructor: appClass,

	initGL: function () {
		this.activeSceneIndex = 0;
		this.process = {
			value: 0
		};
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			autoClear: true,
		});
		this.renderer.setClearColor('#000000');
		this.renderer.shadowMap.enabled = true;
		this.renderer.setScissorTest(true);

		// this.controls = new OrbitControls(this.personCamera, this.renderer.domElement);
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

	updateCamera: function () {
		if (this.personCamera) {
			this.personCamera.aspect = this.aspectRatio;
			this.personCamera.updateProjectionMatrix();
		}
		if (this.dnaCamera) {
			this.dnaCamera.aspect = this.aspectRatio;
			this.dnaCamera.updateProjectionMatrix();
		}
	},

	render: function () {
		let delta = this.clock.getDelta();
		let process = this.process.value;
		let wH = window.innerHeight;
		let wW = window.innerWidth;
		let pH = wH * (process / 100);
		if (!this.renderer.autoClear) this.renderer.clear();
		if (this.bloomComposerScenePerson) {
			this.renderer.setScissor(0, pH, wW, wH);
			this.bloomComposerScenePerson.render();
			this.renderer.setScissor(0, 0, wW, pH);
			this.renderer.render(this.dnaScene, this.dnaCamera);
		} else {
			this.renderer.setScissor(0, pH, wW, wH);
			this.renderer.render(this.personScene, this.personCamera);
			this.renderer.setScissor(0, 0, wW, pH);
			this.renderer.render(this.dnaScene, this.dnaCamera)
		}
		if (this.mixer) {
			this.mixer.update(delta);
		}
		if (this.controls) {
			this.controls.update();
		}
		this.scensePersonAnimate();
		// console.log(this.personCamera.position);
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

		let renderScene = new RenderPass(this.personScene, this.personCamera);

		let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;

		this.bloomComposerScenePerson = new EffectComposer(this.renderer);
		this.bloomComposerScenePerson.addPass(renderScene);
		this.bloomComposerScenePerson.addPass(bloomPass);


		let nodepass = new NodePass();
		let screen = new Nodes.ScreenNode();
		let hue = new Nodes.FloatNode();
		let sataturation = new Nodes.FloatNode(1);
		let vibrance = new Nodes.FloatNode();
		let brightness = new Nodes.FloatNode(0);
		let contrast = new Nodes.FloatNode(1);
		let hueNode = new Nodes.ColorAdjustmentNode(screen, hue, Nodes.ColorAdjustmentNode.HUE);
		let satNode = new Nodes.ColorAdjustmentNode(hueNode, sataturation, Nodes.ColorAdjustmentNode.SATURATION);
		let vibranceNode = new Nodes.ColorAdjustmentNode(satNode, vibrance, Nodes.ColorAdjustmentNode.VIBRANCE);
		let brightnessNode = new Nodes.ColorAdjustmentNode(vibranceNode, brightness, Nodes.ColorAdjustmentNode.BRIGHTNESS);
		let contrastNode = new Nodes.ColorAdjustmentNode(brightnessNode, contrast, Nodes.ColorAdjustmentNode.CONTRAST);
		nodepass.input = contrastNode;
		/*todo*/
		contrast.value = 2;
		this.__p_nodepass_contrast = contrast;
		nodepass.needsUpdate = true;
		this.bloomComposerScenePerson.addPass(nodepass);
	},

	/*
	* @desc scenses
	*  */
	initPersonScense() {

		this.personCamera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.personCamera.aspect = this.aspectRatio;
		this.personCamera.position.set(0, 10, 250);
		this.personCamera.lookAt(0, 10, 0);
		this.personCamera.updateProjectionMatrix();

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

		// params

		function createScensePersonCameraPath() {
			let cameraCurve = new THREE.CatmullRomCurve3([
				new THREE.Vector3(0, 10, 250),
				new THREE.Vector3(0, 10, 130),
				new THREE.Vector3(10, 10, 130),
				new THREE.Vector3(100, 72, 47),
				new THREE.Vector3(123, 100, 34),
				new THREE.Vector3(168, 12, -6),
				new THREE.Vector3(136, 46, -187)
			]);
			cameraCurve.curveType = 'catmullrom';
			cameraCurve.tension = 0.2;
			let targetCurve = new THREE.CatmullRomCurve3([
				new THREE.Vector3(0, 10, 0),
				new THREE.Vector3(0, 10, 0),
				new THREE.Vector3(0, 10, 0),
				new THREE.Vector3(0, 10, 0),
				new THREE.Vector3(0, 10, 0),
				new THREE.Vector3(0, 10, 0),
				new THREE.Vector3(0, 10, -200),
			]);
			targetCurve.curveType = 'catmullrom';

			let points = cameraCurve.getPoints(100);
			let geometry = new THREE.BufferGeometry().setFromPoints(points);
			let material = new THREE.LineBasicMaterial({color: 0xff0000});
			let points2 = targetCurve.getPoints(100);
			// let curveObject = new THREE.Line(geometry, material);
			// this.personScene.add(curveObject);

			let geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
			let material2 = new THREE.LineBasicMaterial({color: 0x00ff00});
			// let curveObject2 = new THREE.Line(geometry2, material2);
			// this.personScene.add(curveObject2);

			return {cameraCurve, targetCurve}
		}

		this.personCameraPoints = createScensePersonCameraPath.bind(this)();
		this.personSceneProcess = {
			value: 0,
			targetIndex: 0
		};
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


		let cameraPoints = this.personCameraPoints;
		let sceneCameraPoint = cameraPoints.cameraCurve.getPointAt(this.personSceneProcess && this.personSceneProcess.value ? this.personSceneProcess.value : 0);
		let sceneCameraTargetPoint = cameraPoints.targetCurve.getPointAt(this.personSceneProcess && this.personSceneProcess.targetIndex ? this.personSceneProcess.targetIndex : 0);
		this.personCamera.lookAt(sceneCameraTargetPoint);
		this.personCamera.position.set(sceneCameraPoint.x, sceneCameraPoint.y, sceneCameraPoint.z);
	},

	initDNAScense() {

		this.dnaCamera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.dnaCamera.aspect = this.aspectRatio;
		this.dnaCamera.position.set(0, 10, 250);
		this.dnaCamera.lookAt(0, 10, 0);
		this.dnaCamera.updateProjectionMatrix();

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
		let tl = gsap.timeline({smoothChildTiming:true});

		tl.addLabel("personScene", 0);
		// camera move
		let step1 = gsap.to(this.personSceneProcess, 5, {value: 1});
		tl.add(step1, 'personScene');
		// camera target move
		let step2 = gsap.to(this.personSceneProcess, 2.5, {targetIndex: 1});
		tl.add(step2, 'personScene+=2.5');
		// person scene dark
		let step3 = gsap.to(this.__p_nodepass_contrast, 1, {value: 0});
		tl.add(step3, 'personScene+=3.5');

		// scene 0 to 1
		let step4 = gsap.to(this.process, 2, {value: 100});
		tl.add(step4, 'personScene+=3');

		tl.pause();

		let upScroll = () => {
			tl.pause();
			tl.progress((tl.progress() * 100 - 10) / 100);
			updateIndex();
		};

		let downScroll = () => {
			tl.pause();
			tl.progress((tl.progress() * 100 + 10) / 100);
			updateIndex();
		};

		let updateIndex = () => {
			let process = tl.progress();
			this.activeSceneIndex = 0;
			console.log('场景：' + this.activeSceneIndex + ';' + '进度：' + process);
		};

		$(document).bind('mousewheel DOMMouseScroll', function (event) {
			let wheel = event.originalEvent.wheelDelta;
			let detail = event.originalEvent.detail;
			if (event.originalEvent.wheelDelta) { //判断浏览器IE,谷歌滚轮事件
				if (wheel > 0) {
					console.log('👆');
					upScroll();
				}
				if (wheel < 0) {
					console.log('👇');
					downScroll();
				}
			} else if (event.originalEvent.detail) {  //Firefox滚轮事件
				if (detail > 0) {
					console.log('👇');
					downScroll();
				}
				if (detail < 0) {
					console.log('👆');
					upScroll();
				}
			}
		});
	},


};

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
