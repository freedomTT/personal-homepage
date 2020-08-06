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


// todo
function initScene1() {
	const s = new THREE.Scene();
	let geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
	let material = new THREE.MeshNormalMaterial();

	let mesh = new THREE.Mesh(geometry, material);
	s.add(mesh);
	return s
}

let scene1 = initScene1();

function initScene2() {
	const s = new THREE.Scene();
	let geometry = new THREE.BoxGeometry(0.1, 0.1, 0.2);
	let material = new THREE.MeshNormalMaterial();

	let mesh = new THREE.Mesh(geometry, material);
	s.add(mesh);
	return s
}

let scene2 = initScene2();
scene = scene1;

setTimeout(() => {
	scene = scene2;
}, 5000);


init();

function init() {

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
	camera.position.z = 1;

	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	controls = initControls(camera);

	if (config.stats) initStats();

	animate();
}


function animate() {
	stats.begin();
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
	stats.end();
}

function initStats() {
	stats = new Stats();
	stats.showPanel(0);
	document.body.appendChild(stats.dom);
}

function initControls(camera) {
	const controls = new OrbitControls(camera, renderer.domElement);
	// 如果使用animate方法时，将此函数删除
	// controls.addEventListener('change', render);
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

//
// $(document).on('mousewheel DOMMouseScroll', onMouseScroll);
//
// function onMouseScroll(e) {
// 	e.preventDefault();
// 	var wheel = e.originalEvent.wheelDelta || -e.originalEvent.detail;
// 	var delta = Math.max(-1, Math.min(1, wheel));
// 	if (delta < 0) {//向下滚动
// 		console.log('向下滚动');
// 	} else {//向上滚动
// 		console.log('向上滚动');
// 	}
// }
