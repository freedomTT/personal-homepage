import './style/main.less'
import _ from 'lodash';
import $ from 'jquery';
import Stats from 'stats-js';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';


let camera, renderer, scene, controls, el

el = document.querySelector('#canvas');

function init() {
	const width = el.offsetWidth;
	const height = el.offsetHeight;
	const asp = width / height;
	// scene
	scene = new THREE.Scene();

	// camera
	camera = new THREE.PerspectiveCamera(45, asp, 1, 100000);
	window.addEventListener('resize', function () {
		console.log(camera.aspect)
		camera.aspect = el.offsetWidth / el.offsetHeight;
		renderer.setSize(el.offsetWidth, el.offsetHeight); // 重新获取
		camera.updateProjectionMatrix();
		renderer.render(scene, camera)
	}, false)
	camera.position.set(30, 30, 30);

	// renderer
	renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(width, height);
	el.append(renderer.domElement);
	renderer.setClearColor('#000');

	//按序渲染
	renderer.sortObjects = true
}

init();


function initControls(camera) {
	const controls = new OrbitControls(camera, renderer.domElement)
	// 如果使用animate方法时，将此函数删除
	//controls.addEventListener( 'change', render );
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
	controls.enablePan = true

	return controls
}


function OneScene(option) {

	//camera
	this.camera = new THREE.PerspectiveCamera(45, el.offsetWidth / el.offsetHeight, 1, 10000)
	// this.camera.position = option.cameraPosition

	// Setup scene
	this.scene = new THREE.Scene()
	this.scene.add(new THREE.AmbientLight(0x555555))

	//light
	const light = new THREE.SpotLight(0xffffff, 1.5)
	light.position.set(0, 500, 2000)
	this.scene.add(light)

	// WebGLRenderTarget
	const renderTargetParameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};
	this.fbo = new THREE.WebGLRenderTarget(el.offsetWidth, el.offsetHeight, renderTargetParameters)

	this.controls = initControls(this.camera)
	this.render = function (delta, rtt) {
		if (option.renderCallBack) option.renderCallBack()
		renderer.setClearColor(option.clearColor)
		if (rtt) {
			renderer.setRenderTarget(this.fbo)
			renderer.clear()
			renderer.render(this.scene, this.camera)
		} else {
			renderer.setRenderTarget(null)
			renderer.render(this.scene, this.camera)
		}
		this.controls.update()
	};

}

const sceneA = new OneScene({
	cameraPosition: new THREE.Vector3(0, 0, 1200),
	clearColor: '#fff',
	renderCallBack: function () {

	}
})
const sceneB = new OneScene({
	cameraPosition: new THREE.Vector3(0, 0, 1200),
	fov: 45,
	clearColor: '#000',
	renderCallBack: function () {

	}
})
//场景A中的物体
for (let i = 0; i < 100; i++) {
	var geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
	var material = new THREE.MeshBasicMaterial({color: 0x00ff00});
	var cube = new THREE.Mesh(geometry, material);
	sceneA.scene.add(cube)
}
//场景B中的物体
for (let i = 0; i < 100; i++) {
	const sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(5, 20), new THREE.MeshBasicMaterial({color: 'yellow'}))
	sphere.position.set(300 - Math.random() * 600, 300 - Math.random() * 600, 300 - Math.random() * 600)
	sceneB.scene.add(sphere)
}


const loader = new THREE.TextureLoader();
const transitionParams = {
	useTexture: true, //为 false 默认采用渐变式
	transition: 0,
	transitionSpeed: 0.01,
	texture: loader.load('./static/images/textures.png'),
	animate: false,
};


function SceneTransition(sceneA, sceneB, transitionParams) {
	const T = this
	//
	T.scene = new THREE.Scene()
	T.camera = new THREE.OrthographicCamera(el.offsetWidth / -2, el.offsetWidth / 2, el.offsetHeight / 2, el.offsetHeight / -2, -10, 10)

	//
	T.quadmaterial = new THREE.ShaderMaterial({
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
				value: transitionParams.texture
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
	})
	const quadgeometry = new THREE.PlaneBufferGeometry(el.offsetWidth, el.offsetHeight)

	// 类似一种蒙层提供过度效果
	T.quad = new THREE.Mesh(quadgeometry, T.quadmaterial)
	T.scene.add(T.quad)

	T.update = function (sceneA, sceneB, animate) {
		T.sceneA = sceneA
		T.sceneB = sceneB
		T.quadmaterial.uniforms.tDiffuse1.value = T.sceneB.fbo.texture
		T.quadmaterial.uniforms.tDiffuse2.value = T.sceneA.fbo.texture
		T.quadmaterial.uniforms.mixRatio.value = 0.0
		T.quadmaterial.uniforms.threshold.value = 0.1
		T.quadmaterial.uniforms.useTexture.value = transitionParams.useTexture
		T.quadmaterial.uniforms.tMixTexture.value = transitionParams.texture

		transitionParams.animate = animate
		transitionParams.transition = 0
	}
	T.update(sceneA, sceneB, transitionParams.animate)
	T.needChange = false

	T.render = function (delta) {
		if (transitionParams.transition === 0) {
			T.sceneA.render(delta, false)
		} else if (transitionParams.transition >= 1) {
			T.sceneB.render(delta, false)
			transitionParams.animate = false // 停止
		} else {
			T.sceneA.render(delta, true)
			T.sceneB.render(delta, true)
			renderer.setRenderTarget(null)
			renderer.clear()
			renderer.render(T.scene, T.camera)
		}

		if (transitionParams.animate && transitionParams.transition <= 1) {
			transitionParams.transition = transitionParams.transition + transitionParams.transitionSpeed
			T.needChange = true
			T.quadmaterial.uniforms.mixRatio.value = transitionParams.transition
		}
	}
}


const transition = new SceneTransition(sceneA, sceneB, transitionParams)

$('#s1').bind('click', () => {
	transition.update(sceneA, sceneB, transitionParams)
})
$('#s2').bind('click', () => {
	transition.update(sceneB, sceneA, transitionParams)
})

const clock = new THREE.Clock()

function loop() {
	requestAnimationFrame(() => loop());
	transition.render(clock.getDelta())
}

loop()
