import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';

import {gsap, Power0} from "gsap";

import * as THREE from 'three';

import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";

import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {NodePass} from 'three/examples/jsm/nodes/postprocessing/NodePass.js';
import * as Nodes from 'three/examples/jsm/nodes/Nodes.js';

import {Water} from 'three/examples/jsm/objects/Water2.js';


import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {FilmPass} from 'three/examples/jsm/postprocessing/FilmPass.js';
import {VignetteShader} from 'three/examples/jsm/shaders/VignetteShader.js';
import {GammaCorrectionShader} from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import {ShadowMesh} from 'three/examples/jsm/objects/ShadowMesh.js';
import {WaterRefractionShader} from 'three/examples/jsm/shaders/WaterRefractionShader.js';


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
		if (this.bloomComposerSceneDNA) {
			this.bloomComposerSceneDNA.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
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
		if (this.seaCamera) {
			this.seaCamera.aspect = this.aspectRatio;
			this.seaCamera.updateProjectionMatrix();
		}
	},

	render: function () {
		let delta = this.clock.getDelta();
		let process = this.process.value;
		let wH = window.innerHeight;
		let wW = window.innerWidth;
		let pH = wH * (process / 100);
		if (!this.renderer.autoClear) this.renderer.clear();
		let frountParams = [0, pH, wW, wH];
		let behindParams = [0, 0, wW, pH];


		this.renderer.setScissor(...frountParams);

		switch (this.activeSceneIndex) {
			case 0:
				renderPersonScene.call(this);
				break
			case 1:
				renderDNAScene.call(this);
				break
		}

		this.renderer.setScissor(...behindParams);

		switch (this.activeSceneIndex) {
			case 0:
				renderDNAScene.call(this);
				break
			case 1:
				break
		}


		function renderPersonScene() {
			if (this.bloomComposerScenePerson) {
				this.bloomComposerScenePerson.render();
			} else {
				this.renderer.render(this.personScene, this.personCamera);
			}
			if (this.personScene) {
				this.scenePersonAnimate();
				if (this.personMixer) {
					this.personMixer.update(delta);
				}
			}
		}

		function renderDNAScene() {
			if (this.bloomComposerSceneDNA) {
				this.bloomComposerSceneDNA.render();
			} else {
				this.renderer.render(this.dnaScene, this.dnaCamera);
			}
			if (this.dnaScene) {
				this.sceneDNAAnimate();
			}
		}


		if (this.controls) {
			this.controls.update();
		}
		// timeline 平滑过度
		if (!this.scrolling && this.timeline && (this.timeline.process !== this.timeline.tl.progress())) {
			this.scrolling = true;
			this.timeline.tl.pause();
			let realProcess = this.timeline.tl.progress();
			let needTime = Math.atan(Math.abs(this.timeline.process * 100 - realProcess * 100)) * 0.5;
			let target = {
				value: realProcess
			};
			gsap.to(target, needTime, {
				ease: Power0.easeNone,
				value: this.timeline.process,
				onUpdate: () => {
					this.timeline.tl.progress(target.value)
				},
				onComplete: () => {
					this.scrolling = false
				}
			});
		}
	},

	/*
	* @desc composer
	* */
	composerScenePerson: function () {
		const params = {
			exposure: 1,
			bloomStrength: 1.5,
			bloomThreshold: 0,
			bloomRadius: 0
		};

		let renderPersonScene = new RenderPass(this.personScene, this.personCamera);

		let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;

		this.bloomComposerScenePerson = new EffectComposer(this.renderer);
		this.bloomComposerScenePerson.addPass(renderPersonScene);
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
		contrast.value = 2;
		this.personSceneProcess.nodepass_contrast = contrast;
		nodepass.needsUpdate = true;
		this.bloomComposerScenePerson.addPass(nodepass);
	},

	composerSceneDNA: function () {
		const params = {
			exposure: 0,
			bloomStrength: 0,
			bloomThreshold: 0,
			bloomRadius: 0
		};

		let renderDNAScene = new RenderPass(this.dnaScene, this.dnaCamera);

		let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;

		this.bloomComposerSceneDNA = new EffectComposer(this.renderer);
		this.bloomComposerSceneDNA.addPass(renderDNAScene);
		this.bloomComposerSceneDNA.addPass(bloomPass);


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
		contrast.value = 0;
		this.__d_nodepass_contrast = contrast;
		nodepass.needsUpdate = true;
		this.bloomComposerSceneDNA.addPass(nodepass);
	},
	/*
	* @desc scenses
	*  */
	initPersonScense() {

		this.personCamera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.personCamera.aspect = this.aspectRatio;
		this.personCamera.position.set(0, 50, 250);
		this.personCamera.lookAt(0, 10, 0);
		this.personCamera.updateProjectionMatrix();

		this.personScene = new THREE.Scene();

		// addLightGroup
		const center = [0, 0];
		const r = 60;
		const speed = 3;
		const colors = ['#ff3983', '#3971ff'];
		const name = 'lineGroup';
		let linesGroup = new THREE.Group();
		linesGroup.name = name;
		for (let i = 0; i < 200; i++) {
			let geometry = new THREE.BoxBufferGeometry(0.3, 0.3, Math.random() * 50 + 10);
			let material = new THREE.MeshStandardMaterial({
				emissive: colors[i % 2],
				color: '#ffffff',
				roughness: 0.5,
			});
			let line = new THREE.Mesh(geometry, material);
			line._speed = 5 + Math.random() * speed;

			let arg = Math.floor(Math.random() * (90 - (-90))) + (-90);
			let range = Math.floor(Math.random() * (10 - (-10))) + (-10);
			let z = Math.floor(Math.random() * (350 - (-350))) + (-350);
			let x = center[0] + Math.sin(arg * Math.PI / 180) * r + range;
			let y = center[1] + Math.cos(arg * Math.PI / 180) * r + range;
			line.position.set(x, y, z);
			linesGroup.add(line);
		}
		linesGroup.layers.enable(1);
		this.personScene.add(linesGroup);

		// mirror
		let geometry = new THREE.PlaneBufferGeometry(1000, 1000, 1);
		let groundMirror = new Reflector(geometry, {
			clipBias: 0.003,
			textureWidth: window.innerWidth * window.devicePixelRatio,
			textureHeight: window.innerHeight * window.devicePixelRatio,
			color: 0x999999,
		});

		groundMirror.position.y = -0.5;
		groundMirror.rotateX(-Math.PI / 2);
		this.personScene.add(groundMirror);

		// background
		let bgGeometry = new THREE.SphereGeometry(1000, 50, 50);
		let bgMaterial = new THREE.MeshPhongMaterial({
			color: '#0c002c',
			shininess: 0,
			side: THREE.BackSide
		});
		let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);

		this.personScene.add(bgMesh);

		let ambientLight = new THREE.AmbientLight('#ffffff', 0.1);
		this.personScene.add(ambientLight);

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
				this.personMixer = new THREE.AnimationMixer(model);
				let actions = [];
				for (let i = 0; i < animations.length; i++) {
					actions[i] = this.personMixer.clipAction(animations[i]);
				}
				actions[0].play();
				this.personScene.add(model);

			},
			(xhr) => {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},
			(error) => {
				console.log('An error happened');
			}
		);

		// add floorCircle
		let circleCpGeometry = new THREE.CircleGeometry(0.2, 20);
		let circleCpMaterial = new THREE.MeshBasicMaterial({
			side: THREE.DoubleSide,
			blending: THREE.AdditiveBlending,
			color: '#2a2a2a',
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

		// create camera path params

		function createScensePersonCameraPath() {
			let cameraCurve = new THREE.CatmullRomCurve3([
				new THREE.Vector3(0, 50, 250),
				new THREE.Vector3(0, 30, 130),
				new THREE.Vector3(10, 10, 130),
				new THREE.Vector3(50, 30, 80),
				new THREE.Vector3(100, 72, 47),
				new THREE.Vector3(123, 100, 34),
				new THREE.Vector3(168, 12, -6),
				new THREE.Vector3(136, 46, -187)
			]);
			cameraCurve.curveType = 'catmullrom';
			cameraCurve.tension = 0.2;
			let targetCurve = new THREE.CatmullRomCurve3([
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

		// sceneProcess params
		this.personSceneProcess = {
			nodepass_contrast: 0,
			value: 0,
			targetIndex: 0,
			cameraShakeRange: [2, 2.5],
			cameraShakeSpeed: [0.5, 0.6],
			cameraShakePosition: [0, 0]
		};

		this.composerScenePerson();
	},

	scenePersonAnimate: function () {
		// addLightGroup Animate
		let linesObj = this.personScene.getObjectByName('lineGroup');
		let lines = [];
		if (linesObj) {
			lines = linesObj.children;
		}
		for (let i = 0; i < lines.length; i++) {
			let pos = lines[i];
			if (pos.position.z < -350) {
				pos.position.z = 350
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
			let s = 200 * Math.asin(this.circleMeshCp._params.fl) + 1;
			this.circleMeshCp.scale.set(s, s, s);
			this.circleMeshCp.material.opacity = 0.15 * Math.acos(this.circleMeshCp._params.fl) - 0.1
		}

		// camera shake
		let x = this.personSceneProcess.cameraShakePosition[0] += this.personSceneProcess.cameraShakeSpeed[0];
		let y = this.personSceneProcess.cameraShakePosition[1] += this.personSceneProcess.cameraShakeSpeed[1];

		//判断相机变量的位置 触壁speed取反
		if (x >= this.personSceneProcess.cameraShakeRange[0] || x <= -this.personSceneProcess.cameraShakeRange[0]) {
			this.personSceneProcess.cameraShakeSpeed[0] *= -1;
		}

		if (y >= this.personSceneProcess.cameraShakeRange[1] || y <= -this.personSceneProcess.cameraShakeRange[1]) {
			this.personSceneProcess.cameraShakeSpeed[1] *= -1;
		}

		let cameraPoints = this.personCameraPoints;
		let sceneCameraPoint = cameraPoints.cameraCurve.getPointAt(this.personSceneProcess && this.personSceneProcess.value ? this.personSceneProcess.value : 0);
		let sceneCameraTargetPoint = cameraPoints.targetCurve.getPointAt(this.personSceneProcess && this.personSceneProcess.targetIndex ? this.personSceneProcess.targetIndex : 0);
		sceneCameraTargetPoint.x += x;
		sceneCameraTargetPoint.y += y;

		this.personCamera.lookAt(sceneCameraTargetPoint);

		this.personCamera.position.set(sceneCameraPoint.x + x * 0.2, sceneCameraPoint.y + y * 0.2, sceneCameraPoint.z);
	},

	initDNAScense() {
		this.dnaSceneProcess = {
			value: 0,
			position: {
				x: 0,
				y: -500,
				z: 0
			}
		};
		this.dnaScene = new THREE.Scene();
		this.dnaCamera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
		this.dnaCamera.aspect = this.aspectRatio;
		this.dnaCamera.position.set(0, 10, 250);
		this.dnaCamera.lookAt(0, 10, 0);
		this.dnaCamera.updateProjectionMatrix();


		// background
		let bgGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 1);
		let bgMaterial = new THREE.MeshPhongMaterial({
			color: '#ffffff',
			specular: '#000000',
			shininess: 30,
			side: THREE.FrontSide,
		});

		let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);

		bgMesh.position.z = -200
		this.dnaScene.add(bgMesh);

		// let ambientLight = new THREE.AmbientLight('#ffffff', 0.2);
		// this.dnaScene.add(ambientLight);

		let pLight = new THREE.PointLight('#bd0009', 1, 0, 2);
		pLight.distance = 1000;
		pLight.position.set(100, 100, 250);
		this.dnaScene.add(pLight);

		let pLight2 = new THREE.PointLight('#0e00b7', 1, 0, 2);
		pLight2.distance = 1000;
		pLight2.position.set(-100, -100, 250);
		this.dnaScene.add(pLight2);

		// pointer
		let vertices = [];
		let range = 150;
		for (let i = 0; i < 500; i++) {
			let x = Math.floor(Math.random() * (range - (-range))) + (-range);
			let y = Math.floor(Math.random() * (range - (-range))) + (-range);
			let z = Math.floor(Math.random() * (range - (-range))) + (-range);
			vertices.push(x, y, z);
		}
		let geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

		function drawPath(x, y, n, r) {
			let canvas = document.createElement("canvas");
			canvas.width = 100;
			canvas.height = 100;
			let ctx = canvas.getContext("2d");
			let i, ang;
			ang = Math.PI * 2 / n;
			ctx.save();
			ctx.fillStyle = 'rgba(255,0,0,.3)'; //填充红色，半透明
			ctx.strokeStyle = 'hsl(120,50%,50%)'; //填充绿色
			ctx.lineWidth = 1; //设置线宽
			ctx.translate(x, y);//原点移到x,y处，即要画的多边形中心
			ctx.moveTo(0, -r);//据中心r距离处画点
			ctx.beginPath();
			for (i = 0; i < n; i++) {
				ctx.rotate(ang);//旋转
				ctx.lineTo(0, -r);//据中心r距离处连线
			}
			ctx.closePath();
			ctx.stroke();
			ctx.fill();
			ctx.restore();
			/*3、将canvas作为纹理，创建Sprite*/
			let texture = new THREE.Texture(canvas);
			texture.needsUpdate = true;
			return texture
		}

		let texture = drawPath(50, 50, 5, 40);

		let material = new THREE.PointsMaterial({
			size: 100,
			sizeAttenuation: false,
			alphaTest: 0.5,
			map: texture,
			transparent: true
		});
		let points = new THREE.Points(geometry, material);
		points.name = 'dnaRoundPoints';
		this.dnaScene.add(points);


		let loader = new FBXLoader();
		loader.load(
			'./static/model/dna.fbx',
			(model) => {
				let mesh = model;
				mesh.scale.set(0.3, 0.3, 0.3);
				let p = this.dnaSceneProcess.position;
				mesh.position.set(p.x, p.y, p.z);
				mesh.rotateX(-(Math.PI / 180) * 10);
				mesh.rotateZ(-(Math.PI / 180) * 20);
				mesh.name = 'dnaModel';
				this.dnaModel = mesh;
				this.dnaScene.add(mesh);
			},
			(xhr) => {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},
			(error) => {
				console.log('An error happened');
				console.log(error)
			}
		);

		// this.controls = new OrbitControls(this.dnaCamera, this.renderer.domElement);
		// this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
		// this.controls.dampingFactor = 0.05;
		// this.controls.screenSpacePanning = false;
		// this.controls.minDistance = 100;
		// this.controls.maxDistance = 500;
		// this.controls.maxPolarAngle = Math.PI;

		this.composerSceneDNA();
	},

	sceneDNAAnimate: function () {
		let dnaModel = this.dnaScene.getObjectByName('dnaModel');
		let dnaRoundPoints = this.dnaScene.getObjectByName('dnaRoundPoints');
		if (dnaModel) {
			let p = this.dnaSceneProcess.position;
			dnaModel.position.set(p.x, p.y, p.z);
			dnaModel.rotateY(Math.PI / 360)
		}
		if (dnaRoundPoints) {
			let p = this.dnaSceneProcess.position;
			dnaRoundPoints.position.set(p.x, p.y, p.z);
			dnaRoundPoints.rotateY(Math.PI / 360 / 2 / 2)
		}
	},

	initTimeLine: function () {
		this.timeline = {
			process: 0,
			tl: null
		};
		let tl = gsap.timeline({smoothChildTiming: true});
		this.timeline.tl = tl;
		tl.addLabel("personScene", 0);
		// camera move
		let step1 = gsap.to(this.personSceneProcess, 5, {value: 1});
		tl.add(step1, 'personScene');
		// camera target move
		let step2 = gsap.to(this.personSceneProcess, 2.5, {targetIndex: 1});
		tl.add(step2, 'personScene+=2.5');
		// person scene dark
		let step3 = gsap.to(this.personSceneProcess.nodepass_contrast, 0.5, {value: 0});
		tl.add(step3, 'personScene+=3');

		// scene 0 to 1
		let step4 = gsap.to(this.process, 2, {
			value: 100,
			onComplete: () => {
			}
		});
		tl.add(step4, 'personScene+=3');

		tl.addLabel("dnaScene", 3);
		// scene 1 in
		let step5 = gsap.to(this.dnaSceneProcess, 2, {value: 1});
		tl.add(step5, 'dnaScene');

		// scene 1 in
		let step6 = gsap.to(this.dnaSceneProcess.position, 2, {x: 0, y: 0, z: -10});
		tl.add(step6, 'dnaScene');

		// person scene dark
		let step7 = gsap.to(this.__d_nodepass_contrast, 2, {value: 2});
		tl.add(step7, 'dnaScene+=1');

		// person scene dark
		let step8 = gsap.to(this.__d_nodepass_contrast, 1.5, {value: 0});
		tl.add(step8, 'dnaScene+=3');

		let step9 = gsap.to(this.dnaSceneProcess.position, 2, {x: 0, y: 100, z: 0});
		tl.add(step9, 'dnaScene+=3');

		tl.pause();

		this.scrolling = false;
		let upScroll = () => {
			if (this.timeline.process > 0) {
				this.timeline.process -= 0.02;
			} else {
				this.timeline.process = 0;
			}
			updateIndex();
		};

		let downScroll = () => {
			if (this.timeline.process < 1) {
				this.timeline.process += 0.02;
			} else {
				this.timeline.process = 1;
			}
			updateIndex();
		};

		let updateIndex = () => {
			let process = tl.progress();
			console.log('滚动进度：' + this.timeline.process + ';' + '全程进度：' + process + ';' + '目前场景标识：' + this.activeSceneIndex);
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
