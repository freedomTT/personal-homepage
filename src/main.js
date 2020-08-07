import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

const config = {
	stats: true // 显示状态
};

let camera, scene, controls, renderer, stats;

const loader = new THREE.TextureLoader();
const textures = loader.load(  './static/images/textures.png' );

const clock = new THREE.Clock();

/*
*
* 场景1
*
* */
function InitScene1() {
	this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
	this.camera.position.z = 1;
	this.scene = new THREE.Scene();
	let geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
	let material = new THREE.MeshNormalMaterial();

	let mesh = new THREE.Mesh(geometry, material);
	this.scene.add(mesh);
	this.controls = initControls(this.camera);
	// WebGLRenderTarget
	const renderTargetParameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};
	this.fbo = new THREE.WebGLRenderTarget(window.offsetWidth, window.offsetHeight, renderTargetParameters);
	this.render = function (delta, rtt) {
		renderer.setClearColor('#00ff55');
		if (rtt) {
			renderer.setRenderTarget(null)
			renderer.clear();
			renderer.render(this.scene, this.camera)
		} else {
			renderer.setRenderTarget(null);
			renderer.render(this.scene, this.camera)
		}
		this.controls.update()
	};
}


/*
*
* 场景2
*
* */
function InitScene2() {
	this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
	this.camera.position.z = 1;
	this.scene = new THREE.Scene();
	let geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
	let material = new THREE.MeshNormalMaterial();

	let mesh = new THREE.Mesh(geometry, material);
	this.scene.add(mesh);
	this.controls = initControls(this.camera);
	// WebGLRenderTarget
	const renderTargetParameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};
	this.fbo = new THREE.WebGLRenderTarget(window.offsetWidth, window.offsetHeight, renderTargetParameters);
	this.render = function (delta, rtt) {
		renderer.setClearColor('#000000');
		if (rtt) {
			renderer.setRenderTarget(null);
			renderer.clear();
			renderer.render(this.scene, this.camera)
		} else {
			renderer.setRenderTarget(null);
			renderer.render(this.scene, this.camera)
		}
		this.controls.update()
	};
}

/*
*
* initRender
*
* */
function initRender() {
	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
}

/*
*
* 渲染器刷新
*
* */
function animate() {
	stats.begin();
	requestAnimationFrame(animate);
	sceneTransition && sceneTransition.render(clock.getDelta());
	renderer.render(scene, camera);
	stats.end();
}

/*
*
* 状态查看器
*
* */
function initStats() {
	stats = new Stats();
	stats.showPanel(0);
	document.body.appendChild(stats.dom);
}

/*
*
* 控制器
*
* */
function initControls(camera) {
	const controls = new OrbitControls(camera, renderer.domElement);
	// 使动画循环使用时阻尼或自转 意思是否有惯性
	controls.enableDamping = true;
	//动态阻尼系数 就是鼠标拖拽旋转灵敏度
	//controls.dampingFactor = 0.25;
	//是否可以缩放
	controls.enableZoom = true;
	//是否自动旋转
	controls.autoRotate = true;
	controls.autoRotateSpeed = 0.3;
	//设置相机距离原点的最远距离
	controls.minDistance = 1;
	//设置相机距离原点的最远距离
	// controls.maxDistance = 1000;
	//是否开启右键拖拽
	controls.enablePan = true;

	return controls
}


/*
*
* 场景转换
*
* */
function SceneTransition(sceneA, sceneB) {
	const config = {
		useTexture: false,
		texture: textures,
		animate: true,
		transition: null,
		transitionSpeed: 0.01,
	};
	this.scene = new THREE.Scene();
	this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
	this.camera.position.z = 1;
	this.material = new THREE.ShaderMaterial({
		uniforms: {
			tDiffuse1: {
				value: null
			},
			tDiffuse2: {
				value: null
			},
			mixRatio: {
				value: 0.0
			},
			threshold: {
				value: 0.1
			},
			useTexture: {
				value: true
			},
			tMixTexture: {
				value: config.texture
			}
		},
		vertexShader: `varying vec2 vUv;
            void main() {
            vUv = vec2( uv.x, uv.y );
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }`,
		fragmentShader: `uniform float mixRatio;
            uniform sampler2D tDiffuse1;
            uniform sampler2D tDiffuse2;
            uniform sampler2D tMixTexture;
            uniform bool useTexture;
            uniform float threshold;
            varying vec2 vUv;
            void main() {
            	vec4 texel1 = texture2D( tDiffuse1, vUv );
            	vec4 texel2 = texture2D( tDiffuse2, vUv );
            	if (useTexture==true) {
            		vec4 transitionTexel = texture2D( tMixTexture, vUv );
            		float r = mixRatio * (1.0 + threshold * 2.0) - threshold;
            		float mixf=clamp((transitionTexel.r - r)*(1.0/threshold), 0.0, 1.0);
            		gl_FragColor = mix( texel1, texel2, mixf );
            	} else {
            		gl_FragColor = mix( texel2, texel1, mixRatio );
            	}
            }`
	});
	const geometry = new THREE.PlaneBufferGeometry(window.offsetWidth, window.offsetHeight);
	const quad = new THREE.Mesh(geometry, this.material);
	this.scene.add(quad);
	this.update = function (sceneA, sceneB, animate) {
		this.sceneA = sceneA;
		this.sceneB = sceneB;
		this.material.uniforms.tDiffuse1.value = this.sceneB.fbo.texture;
		this.material.uniforms.tDiffuse2.value = this.sceneA.fbo.texture;
		this.material.uniforms.mixRatio.value = 0.0;
		this.material.uniforms.threshold.value = 0.1;
		this.material.uniforms.useTexture.value = config.useTexture;
		this.material.uniforms.tMixTexture.value = config.texture;

		config.animate = animate;
		config.transition = 0
	};
	this.update(sceneA, sceneB, config.animate);
	this.needChange = false;
	this.render = function (delta) {
		if (config.transition === 0) {
			this.sceneA.render(delta, false)
		} else if (config.transition >= 1) {
			this.sceneB.render(delta, false);
			config.animate = false
		} else {
			this.sceneA.render(delta, true);
			this.sceneB.render(delta, true);
			renderer.setRenderTarget(null);
			renderer.clear();
			renderer.render(this.scene, this.camera);
		}
		if (config.animate && config.transition <= 1) {
			config.transition = config.transition + config.transitionSpeed;
			this.needChange = true;
			this.material.uniforms.mixRatio.value = config.transition;
		}
	}
}


/*
*
* 初始化
*
* */
let sceneTransition

function init() {
	initRender();
	let scene1 = new InitScene1();
	let scene2 = new InitScene2();
	sceneTransition = new SceneTransition(scene1, scene2);

	$('body').on('click', () => {
		sceneTransition.update(scene1, scene2, true);
	})

	scene = scene1.scene;
	camera = scene1.camera;
	if (config.stats) initStats();
	animate();
}

init();

