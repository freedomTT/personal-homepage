import "./style/main.less";
import $ from "jquery";
import {gsap, Power0, Elastic} from "gsap";
import scrollTrigger from "gsap/dist/ScrollTrigger.js";
import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {NodePass} from "three/examples/jsm/nodes/postprocessing/NodePass.js";
import * as Nodes from "three/examples/jsm/nodes/Nodes.js";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {FilmPass} from "three/examples/jsm/postprocessing/FilmPass.js";
import {ShadowMesh} from "three/examples/jsm/objects/ShadowMesh.js";
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader.js";
import {Reflector} from "three/examples/jsm/objects/Reflector.js";
import PhyTouch from "phy-touch";

let DarkMaskShader = {

  uniforms: {
    "tDiffuse": {
      value: null
    },
    "maskColor": {
      value: new THREE.Color(0x000000)
    },
    "maskAlpha": {
      value: 1.0
    },
    "markRadius": {
      value: 0.15
    },
    "smoothSize": {
      value: 0.5
    }
  },

  vertexShader: [

    "varying vec2 vUv;",

    "void main() {",

    "	vUv = uv;",
    "	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

    "}"

  ].join("\n"),

  fragmentShader: [

    "uniform float maskAlpha;",
    "uniform vec3 maskColor;",
    "uniform float markRadius;",
    "uniform float smoothSize;",

    "uniform sampler2D tDiffuse;",

    "varying vec2 vUv;",

    "float sdfCircle(vec2 coord, vec2 center, float radius)",
    "{",
    "	vec2 offset = coord - center;",
    "	return sqrt((offset.x * offset.x) + (offset.y * offset.y)) - radius;",
    "}",

    "void main() {",

    "	vec4 texel = texture2D( tDiffuse, vUv );",
    "   float sdfValue = sdfCircle(vUv, vec2(0.5, 0.5), markRadius);",
    "	if (sdfValue < 0.0){",
    " 		gl_FragColor = texel;",
    "	}else{",
    "		float a = smoothstep(0.0, smoothSize, sdfValue);",
    "   	gl_FragColor = mix(texel, vec4(maskColor, maskAlpha), a);",
    "	}",
    "}"

  ].join("\n")

};

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
  this.isLoading = true;
};

appClass.prototype = {

  constructor: appClass,

  loadModels: function () {
    let app = this;

    app.isLoading = true;

    function model1(chain) {
      // load human model
      let loader = new FBXLoader();
      loader.load(
        "./static/model/fastrun2.fbx",
        (model) => {
          app.model1 = model;
          chain.next();
        },
        (xhr) => {
          setProcess(parseInt((xhr.loaded / xhr.total) * 33));
        },
        (error) => {
          console.log("An error happened");
        }
      );
    }

    function model2(chain) {
      // 加载 glTF 格式的模型
      let loader = new GLTFLoader();/*实例化加载器*/
      loader.load("./static/model/street.gltf", (obj) => {
        app.model2 = obj;
        chain.next();
      }, function (xhr) {
        setProcess(parseInt((xhr.loaded / xhr.total) * 33) + 34);
      }, function (error) {
        console.log("load error!" + error);
      });
    }

    function model3(chain) {
      // 加载 人物 模型
      let loader = new FBXLoader();
      loader.load(
        "./static/model/walk2.fbx",
        (model) => {
          app.model3 = model;
          chain.next();
        },
        (xhr) => {
          setProcess(parseInt((xhr.loaded / xhr.total) * 33) + 67);
        },
        (error) => {
          console.log("An error happened");
        }
      );
    }

    function setProcess(num) {
      $(".loading-rect").text(num + "%");
    }

    let chain;

    function* loadAllModels() {
      yield model1(chain);
      yield model2(chain);
      yield model3(chain);
      app.initPersonScense();
      app.initMainScence();
      app.initTimeLine();
      app.isLoading = false;
      setTimeout(() => {
        $(".loading-ctn").fadeOut(3000);
      }, 1500);
    }

    chain = loadAllModels();

    chain.next();
  },

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
    this.renderer.autoClear = true;
    this.renderer.setClearColor("#000000");
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
    if (this.bloomComposerSceneMain) {
      this.bloomComposerSceneMain.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
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
    if (this.mainCamera) {
      this.mainCamera.aspect = this.aspectRatio;
      this.mainCamera.updateProjectionMatrix();
    }
    if (this.seaCamera) {
      this.seaCamera.aspect = this.aspectRatio;
      this.seaCamera.updateProjectionMatrix();
    }
  },

  render: function () {
    if (!this.isLoading) {
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
        break;
      case 1:
        renderMainScene.call(this);
        break;
      }

      this.renderer.setScissor(...behindParams);

      switch (this.activeSceneIndex) {
      case 0:
        renderMainScene.call(this);
        break;
      case 1:
        break;
      }


      function renderPersonScene() {
        if (this.bloomComposerScenePerson) {
          this.bloomComposerScenePerson.render();
        } else {
          this.renderer.render(this.personScene, this.personCamera);
        }
        if (this.personScene) {
          this.scenePersonAnimate(delta);
        }
      }

      function renderMainScene() {
        if (this.bloomComposerSceneMain) {
          this.bloomComposerSceneMain.render();
        } else {
          this.renderer.render(this.mainScene, this.mainCamera);
        }
        if (this.mainScene) {
          this.sceneMainAnimate(delta);
        }
      }


      if (this.controls) {
        this.controls.update();
      }

      // timeline 平滑过度
      // if (!this.scrolling && this.timeline && (this.timeline.process !== this.timeline.tl.progress())) {
      // this.scrolling = true;
      // this.timeline.tl.pause();
      // let realProcess = this.timeline.tl.progress();
      // let needTime = Math.atan(Math.abs(this.timeline.process * 100 - realProcess * 100));
      // let target = {
      //   value: realProcess
      // };
      // gsap.to(target, needTime, {
      //   ease: Power0.easeNone,
      //   value: this.timeline.process,
      //   onUpdate: () => {
      //     this.timeline.tl.progress(target.value);
      //   },
      //   onComplete: () => {
      //     this.scrolling = false;
      //   }
      // });
      // this.timeline.tl.progress(this.timeline.process);
      // }
    }
  },

  /*
	* @desc scenses
	*  */
  initPersonScense() {

    this.personCamera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
    this.personCamera.aspect = this.aspectRatio;
    this.personCamera.position.set(0, 120, 250);
    this.personCamera.lookAt(0, 10, 0);
    this.personCamera.updateProjectionMatrix();

    this.personScene = new THREE.Scene();

    // addLightGroup
    const center = [0, 0];
    const r = 65;
    const speed = 3;
    const colors = ["#ff3983", "#3971ff"];
    const name = "lineGroup";
    let linesGroup = new THREE.Group();
    linesGroup.name = name;
    for (let i = 0; i < 200; i++) {
      let geometry = new THREE.BoxBufferGeometry(0.3, 0.3, Math.random() * 30 + 10);
      let material = new THREE.MeshStandardMaterial({
        emissive: colors[i % 2],
        color: "#ffffff",
        roughness: 0.5,
      });
      let line = new THREE.Mesh(geometry, material);
      line._speed = 5 + Math.random() * speed;

      let arg = Math.floor(Math.random() * (90 - (-90))) + (-90);
      let range = Math.random() * 20;
      let z = -Math.random() * 350 + 200;
      let x = center[0] + Math.sin(arg * Math.PI / 180) * (r + range);
      let y = center[1] + Math.cos(arg * Math.PI / 180) * (r + range);
      line.position.set(x, y, z);
      linesGroup.add(line);
    }
    linesGroup.layers.enable(1);
    this.personScene.add(linesGroup);

    // mirror
    let geometry = new THREE.PlaneBufferGeometry(1000, 1000, 1);
    let groundMirror = new Reflector(geometry, {
      clipBias: 0,
      textureWidth: window.innerWidth,
      textureHeight: window.innerHeight,
      color: 0x999999,
    });

    groundMirror.position.y = -0.5;
    groundMirror.rotateX(-Math.PI / 2);
    this.personScene.add(groundMirror);

    // background
    let bgGeometry = new THREE.SphereGeometry(1000, 50, 50);
    let bgMaterial = new THREE.MeshPhongMaterial({
      color: "#080646",
      shininess: 0,
      side: THREE.BackSide
    });
    let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    this.personScene.add(bgMesh);

    let ambientLight = new THREE.AmbientLight("#ffffff", 0.2);
    this.personScene.add(ambientLight);

    // load human model
    {
      let model = this.model1;
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
    }

    // add floorCircle
    let circleCpGeometry = new THREE.CircleGeometry(0.2, 20);
    let circleCpMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      color: "#2a2a2a",
      depthTest: true,
      transparent: true,
      opacity: 0.6
    });
    this.circleMeshCp = new THREE.Mesh(circleCpGeometry, circleCpMaterial);
    this.circleMeshCp.name = "circleMesh";
    this.circleMeshCp._params = {fl: 0};
    this.circleMeshCp.rotateX(-Math.PI / 2);
    this.personScene.add(this.circleMeshCp);
    let cubeShadow = new ShadowMesh(this.circleMeshCp);
    this.personScene.add(cubeShadow);

    // create camera path params

    function createScensePersonCameraPath() {
      let cameraCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-10, 50, 250),
        new THREE.Vector3(0, 30, 130),
        new THREE.Vector3(10, 40, 130),
        new THREE.Vector3(90, 50, 80),
        new THREE.Vector3(150, 72, 47),
        new THREE.Vector3(163, 100, 34),
        new THREE.Vector3(188, 40, -6),
        new THREE.Vector3(176, 46, -187),
      ]);
      cameraCurve.curveType = "catmullrom";
      cameraCurve.tension = 0.2;
      let targetCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 10, 0),
        new THREE.Vector3(0, 10, -200),
        new THREE.Vector3(0, 0, -200),
      ]);
      targetCurve.curveType = "catmullrom";

      // let points = cameraCurve.getPoints(100);
      // let geometry = new THREE.BufferGeometry().setFromPoints(points);
      // let material = new THREE.LineBasicMaterial({color: 0xff0000});
      // let points2 = targetCurve.getPoints(100);
      // let curveObject = new THREE.Line(geometry, material);
      // this.personScene.add(curveObject);
      //
      // let geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
      // let material2 = new THREE.LineBasicMaterial({color: 0x00ff00});
      // let curveObject2 = new THREE.Line(geometry2, material2);
      // this.personScene.add(curveObject2);

      return {cameraCurve, targetCurve};
    }

    this.personCameraPoints = createScensePersonCameraPath.bind(this)();

    // sceneProcess params
    this.personSceneProcess = {
      nodepass_contrast: 0,
      value: 0,
      targetIndex: 0,
      isShake: true,
      cameraShakeRange: [2, 2.5],
      cameraShakeSpeed: [0.2, 0.1],
      cameraShakePosition: [0, 0]
    };

    this.composerScenePerson();
  },

  scenePersonAnimate: function (delta) {
    // addLightGroup Animate
    let linesObj = this.personScene.getObjectByName("lineGroup");
    let lines = [];
    if (linesObj) {
      lines = linesObj.children;
    }
    for (let i = 0; i < lines.length; i++) {
      let pos = lines[i];
      if (pos.position.z < -350) {
        pos.position.z = 200;
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
      this.circleMeshCp.material.opacity = 0.15 * Math.acos(this.circleMeshCp._params.fl) - 0.1;
    }

    // camera shake
    let x = 0, y = 0;
    if (this.personSceneProcess.isShake) {
      x = this.personSceneProcess.cameraShakePosition[0] += this.personSceneProcess.cameraShakeSpeed[0];
      y = this.personSceneProcess.cameraShakePosition[1] += this.personSceneProcess.cameraShakeSpeed[1];

      //判断相机变量的位置 触壁speed取反
      if (x >= this.personSceneProcess.cameraShakeRange[0] || x <= -this.personSceneProcess.cameraShakeRange[0]) {
        this.personSceneProcess.cameraShakeSpeed[0] *= -1;
      }

      if (y >= this.personSceneProcess.cameraShakeRange[1] || y <= -this.personSceneProcess.cameraShakeRange[1]) {
        this.personSceneProcess.cameraShakeSpeed[1] *= -1;
      }
    }


    let cameraPoints = this.personCameraPoints;
    let sceneCameraPoint = cameraPoints.cameraCurve.getPointAt(this.personSceneProcess && this.personSceneProcess.value ? this.personSceneProcess.value : 0);
    let sceneCameraTargetPoint = cameraPoints.targetCurve.getPointAt(this.personSceneProcess && this.personSceneProcess.targetIndex ? this.personSceneProcess.targetIndex : 0);
    sceneCameraTargetPoint.x += x;
    sceneCameraTargetPoint.y += y;

    this.personCamera.lookAt(sceneCameraTargetPoint);

    this.personCamera.position.set(sceneCameraPoint.x + x * 0.2, sceneCameraPoint.y + y * 0.2, sceneCameraPoint.z);

    if (this.personMixer) {
      this.personMixer.update(delta);
    }
  },

  initMainScence() {
    this.mainSceneProcess = {
      value: 0,
      position: {
        x: 0,
        y: -500,
        z: 0
      },
      characterAnimate: false,
      characterAnimateRun: null,
      composer: {
        contrast: null,
        bloomPass: null,
      },
      streetLight: null,
      isInFooter: false,
      fogColor: {
        r: 0,
        g: 0,
        b: 0
      }
    };
    this.mainScene = new THREE.Scene();
    this.mainCamera = new THREE.PerspectiveCamera(this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far);
    this.mainCamera.aspect = this.aspectRatio;
    this.mainCamera.position.set(0, 10, 250);
    this.mainCamera.lookAt(0, 10, 0);
    this.mainCamera.updateProjectionMatrix();

    // this.mainScene.fog = new THREE.FogExp2('#000000', 0.00025);
    this.mainScene.fog = new THREE.Fog("#000000", 5, 1000);

    let ambientLight = new THREE.AmbientLight("#ffffff", 0.5);
    this.mainScene.add(ambientLight);

    // background
    let bgGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 10);
    let bgMaterial = new THREE.MeshPhongMaterial({
      color: "#000000",
      specular: "#ffffff",
      shininess: 2,
      side: THREE.FrontSide,
    });
    let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);

    bgMesh.position.z = -200;
    this.mainScene.add(bgMesh);

    // mouse light
    this.pLight = new THREE.PointLight("#0063ff", 1, 500, 4);
    this.pLight.position.set(100, 100, -160);
    this.mainScene.add(this.pLight);

    let streetLight = new THREE.PointLight("#ffffff", 1, 0, 2);
    streetLight.distance = 5000;
    streetLight.position.set(0, 0, 0);
    this.mainScene.add(streetLight);
    this.mainSceneProcess.streetLight = streetLight;

    // pointer
    this.dnaRoundPointsGroup = new THREE.Group();
    let vertices = [];
    let range = 50;
    for (let i = 0; i < 20; i++) {
      let x = Math.floor(Math.random() * (range - (-range))) + (-range);
      let y = Math.floor(Math.random() * (range - (-range))) + (-range);
      let z = Math.floor(Math.random() * (range - (-range))) + (-range);
      vertices.push(x, y, z);
    }
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

    function drawPath(x, y, n, r, color) {
      let canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      let ctx = canvas.getContext("2d");
      let i, ang;
      ang = Math.PI * 2 / n;
      ctx.save();
      ctx.fillStyle = color; //填充红色，半透明
      ctx.lineWidth = 1; //设置线宽
      ctx.translate(x, y);//原点移到x,y处，即要画的多边形中心
      ctx.moveTo(0, -r);//据中心r距离处画点
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        ctx.rotate(ang);//旋转
        ctx.lineTo(0, -r);//据中心r距离处连线
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      /*3、将canvas作为纹理，创建Sprite*/
      let texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    let texture1 = drawPath(50, 50, 6, 40, "rgba(74,0,255,0.2)");
    let texture2 = drawPath(50, 50, 6, 40, "rgba(255,0,69,0.4)");
    let parameters = [[2, 0.6, texture2], [2, 0.8, texture1], [3, 0.6, texture1], [8, 0.6, texture1], [10, 0.2, texture1]];
    for (let i = 0; i < parameters.length; i++) {
      let size = parameters[i][0];
      let opacity = parameters[i][1];
      let texture = parameters[i][2];
      let materials = [];
      materials[i] = new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        depthTest: false,
        size: size,
        sizeAttenuation: true,
        alphaTest: false,
        opacity: opacity,
        map: texture,
        transparent: true
      });

      let particles = new THREE.Points(geometry, materials[i]);

      particles.rotation.x = Math.random() * 6;
      particles.rotation.y = Math.random() * 6;
      particles.rotation.z = Math.random() * 6;

      this.dnaRoundPointsGroup.add(particles);
    }
    this.mainScene.add(this.dnaRoundPointsGroup);

    // this.controls = new OrbitControls(this.mainCamera, this.renderer.domElement);
    // this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    // this.controls.dampingFactor = 0.05;
    // this.controls.screenSpacePanning = false;
    // this.controls.minDistance = 100;
    // this.controls.maxDistance = 500;
    // this.controls.maxPolarAngle = Math.PI;

    /*
		* @desc model
		* */
    // 加载 glTF 格式的模型
    {
      let obj = this.model2;
      obj.scene.position.x = -80;
      obj.scene.position.y = 0;
      obj.scene.position.z = 3000;
      obj.scene.scale.set(20, 20, 20);
      obj.scene.rotateY(Math.PI / 2);
      obj.scene.rotateX(Math.PI / 180 * (-2));
      obj.scene.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.mainScene.add(obj.scene);

      this.mainCamera.lookAt(0, 50, 0);

      this.mainCamera.position.set(-50, 40, 2000);

      // create camera path params

      function createScenseCameraPath() {
        let cameraCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-50, 40, 3500),
          new THREE.Vector3(-40, 20, 2000),
          new THREE.Vector3(0, 10, 1000),
          new THREE.Vector3(10, 0, 800),
          new THREE.Vector3(0, 0, 0),
        ]);
        cameraCurve.curveType = "catmullrom";
        cameraCurve.tension = 0.1;
        let targetCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 50, 0),
          new THREE.Vector3(0, 0, -200)
        ]);
        targetCurve.curveType = "catmullrom";

        return {cameraCurve, targetCurve};
      }

      this.streetCameraPoints = createScenseCameraPath.apply(this);
    }
    // 加载 人物 模型
    {
      let model = this.model3;
      model.scale.set(0.14, 0.14, 0.14);
      model.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      let animations = model.animations;
      this.personMixer2 = new THREE.AnimationMixer(model);
      let actions = [];
      for (let i = 0; i < animations.length; i++) {
        actions[i] = this.personMixer2.clipAction(animations[i]);
      }
      actions[0].play();

      model.position.set(-50, -10, 4000);
      model.rotateY(Math.PI);
      this.streetCharacter = model;
      this.mainScene.add(model);
    }

    /*
		*
		* footer
		*
		* */
    {

      let Theme = {
        primary: 0xFFFFFF,
        secundary: "#00FFFF",
        background: "#0055FF",
        darker: "#5802f0"
      };
      let _primitive = new THREE.Group();
      let _myplane = new THREE.Group();
      let _particles = new THREE.Group();

      this._primitive = _primitive;
      this._myplane = _myplane;
      this._lights = null;
      this._particles = _particles;
      this._gridHelper = null;
      this._ambientLights = null;
      let z = -250;

      function createGrid() {
        this._gridHelper = new THREE.GridHelper(80, 100, 0x888888, 0x888888);
        this._gridHelper.position.y = 0.1;
        this._gridHelper.position.z = -250;
        this.mainScene.add(this._gridHelper);

        let plane_geo = new THREE.PlaneGeometry(80, 80);
        let plane_mat = new THREE.MeshLambertMaterial({color: Theme.darker});
        let plane_mes = new THREE.Mesh(plane_geo, plane_mat);
        plane_mes.castShadow = false;
        plane_mes.receiveShadow = true;
        plane_mes.rotation.x = -90 * Math.PI / 180;
        plane_mes.position.y = 0;
        plane_mes.position.z = z;
        this.mainScene.add(plane_mes);
      }


      function createLights() {
        this._ambientLights = new THREE.HemisphereLight(Theme.primary, Theme.background, 0);
        this._lights = new THREE.SpotLight(Theme.primary, 0, 0);
        this._lights.castShadow = true;
        this._lights.shadow.mapSize.width = 8000;
        this._lights.shadow.mapSize.height = this._lights.shadow.mapSize.width;
        this._lights.penumbra = 0.8;
        this._lights.position.set(10, 20, 20 + z);
        this.mainScene.add(this._lights);
        this.mainScene.add(this._ambientLights);
      }

      function mathRandom(num = 10) {
        let numValue = -Math.random() * num + Math.random() * num;
        return numValue;
      };

      function createPrimitive() {
        let mesh_mat = new THREE.MeshPhysicalMaterial({color: Theme.darker, flatShading: true});
        let mesh_wat = new THREE.MeshBasicMaterial({color: Theme.secundary, wireframe: true});
        //---
        for (let i = 0; i <= 30; i++) {
          let s = Math.abs(2 + mathRandom(3));
          let t = Math.abs(0.9 + mathRandom(0));
          let mesh_geo = new THREE.CubeGeometry(t, s, t);
          let mesh_pri = new THREE.Mesh(mesh_geo, mesh_mat);
          let mesh_wir = new THREE.Mesh(mesh_geo, mesh_wat);
          mesh_pri.castShadow = true;
          mesh_pri.receiveShadow = true;
          mesh_pri.position.y = s - (mesh_pri.geometry.parameters.height / 2);
          mesh_pri.add(mesh_wir);
          _primitive.add(mesh_pri);
        }
        _primitive.position.y = 0;
        _primitive.position.z = z;
        this.mainScene.add(_primitive);
      }

      function createNave() {
        let mesh_mat = new THREE.MeshPhongMaterial({
          color: Theme.background,
          side: THREE.DoubleSide,
          flatShading: true
        });
        let mesh_geo = new THREE.CubeGeometry(0.5, 0.5, 0.5);
        let mesh_pri = new THREE.Mesh(mesh_geo, mesh_mat);
        mesh_pri.castShadow = true;
        mesh_pri.receiveShadow = true;

        let plan_geo = new THREE.OctahedronGeometry(0.43, 1);
        let plan_mat = new THREE.MeshPhongMaterial({
          color: Theme.background,
          side: THREE.DoubleSide,
          flatShading: true
        });
        let plan_mes = new THREE.Mesh(plan_geo, plan_mat);
        plan_mes.castShadow = true;
        plan_mes.receiveShadow = true;
        let part_geo = new THREE.OctahedronGeometry(0.05, 1);
        let part_mes = new THREE.Mesh(part_geo, plan_mat);

        part_mes.castShadow = true;
        part_mes.receiveShadow = true;

        plan_mes.scale.set(0, 0, 0);
        mesh_pri.scale.set(0, 0, 0);

        gsap.to(plan_mes.scale, 1, {x: 1, y: 1, z: 1, repeat: -1, yoyo: true, ease: Elastic.easeInOut});
        gsap.to(mesh_pri.scale, 1, {x: 1, y: 1, z: 1, repeat: -1, yoyo: true, delay: 1, ease: Elastic.easeInOut});

        _myplane.add(plan_mes);
        _myplane.add(mesh_pri);
        _myplane.position.z = 0.5 + z;
        this.mainScene.add(_myplane);
      }

      function createParticles() {
        let s = 0.01;
        let part_mat = new THREE.MeshNormalMaterial();
        let part_geo = new THREE.CubeGeometry(s, s, s);

        for (let i = 0; i < 50; i++) {
          let p = 20;
          let part_mes = new THREE.Mesh(part_geo, part_mat);
          part_mes.vel = mathRandom() / 10;
          part_mes.amp = mathRandom();
          part_mes.position.set(mathRandom(p), mathRandom(p), mathRandom(p) + z);
          _particles.add(part_mes);
        }
      }

      createLights.apply(this);
      createGrid.apply(this);
      createPrimitive.apply(this);
      createNave.apply(this);
      createParticles.apply(this);
    }
    this.composerSceneMain();
  },

  sceneMainAnimate: function (delta) {
    let dnaRoundPoints = this.dnaRoundPointsGroup.children;
    if (dnaRoundPoints) {
      dnaRoundPoints.forEach((item, index) => {
        let p = this.mainSceneProcess.position;
        item.position.set(p.x, p.y, p.z);
        item.rotateY(Math.PI / 360 * 0.05 * (index + 1));
      });
    }
    // 相机动画
    if (this.streetCameraPoints && !this.mainSceneProcess.isInFooter) {
      let cameraPoints = this.streetCameraPoints;
      let sceneCameraPoint = cameraPoints.cameraCurve.getPointAt(this.mainSceneProcess && this.mainSceneProcess.value ? this.mainSceneProcess.value : 0);
      let sceneCameraTargetPoint = cameraPoints.targetCurve.getPointAt(this.mainSceneProcess && this.mainSceneProcess.value ? this.mainSceneProcess.value : 0);
      this.mainCamera.lookAt(sceneCameraTargetPoint);
      this.mainCamera.position.set(sceneCameraPoint.x, sceneCameraPoint.y, sceneCameraPoint.z);
    }
    // 人物动画
    if (this.streetCameraPoints && this.streetCharacter) {
      let points = this.streetCameraPoints.cameraCurve;
      let point = points.getPointAt(this.mainSceneProcess && this.mainSceneProcess.value ? this.mainSceneProcess.value : 0);
      let p1 = this.streetCharacter.position;
      let p2 = point;
      let x1 = p1.x, y1 = p1.z, x2 = p2.x, y2 = p2.z;
      let cos = (x1 * x2 + y1 * y2) / (Math.sqrt((x1 * x1 + y1 * y1)) * Math.sqrt((x2 * x2 + y2 * y2)));
      let x = 2 * Math.PI + Math.acos(cos);
      this.streetCharacter.rotation.y = ((x2 - x1 < 0 ? -1 : 1) * Math.PI / 180 * x);
      this.streetCharacter.position.set(point.x, point.y - 30, point.z - (100 + 118 * this.mainSceneProcess.value));
    }
    if (this.personMixer2 && this.mainSceneProcess.characterAnimateRun) {
      this.personMixer2.update(delta);
    }


    if (this.mainSceneProcess.isInFooter) {
      let _particles = this._particles;
      let _primitive = this._primitive;
      let _myplane = this._myplane;

      function mathRandom(num = 10) {
        let numValue = -Math.random() * num + Math.random() * num;
        return numValue;
      };
      let a = 20;
      let v = 0.1;
      let time = Date.now() * 0.003;
      for (let i = 0, l = _primitive.children.length; i < l; i++) {
        let object = _primitive.children[i];
        object.position.z += v;
        if (object.position.z > 10) {
          object.position.z = -20 + Math.round(mathRandom());
          object.position.x = Math.round(mathRandom());
        }
      }
      _particles.rotation.x += v / 5;
      //---
      for (let i = 0, l = _particles.children.length; i < l; i++) {
        let object = _particles.children[i];
        object.position.x = Math.sin(time * object.vel) * object.amp;
        object.position.y = Math.cos(time * object.vel) * object.amp;
        object.position.z = Math.tan(time * object.vel) * object.amp;
      }
      //---
      _myplane.position.x = Math.sin(time / 2.3) * (a / 10);
      _myplane.position.y = (Math.cos(time / 2) * (a / 15)) + 2;
      _myplane.rotation.z = (Math.sin(time / 2.3) * a) * Math.PI / 180;
      _myplane.rotation.y = (-Math.cos(time / 2.3) * a) * Math.PI / 180;
      _myplane.rotation.x += 0.1;


      this._gridHelper.position.z += v;
      if (this._gridHelper.position.z >= -249) this._gridHelper.position.z = -250;

      this.mainCamera.lookAt(_myplane.position);
    }
  },

  /*
	* @desc composer
	* */
  composerScenePerson: function () {
    const params = {
      exposure: 1,
      bloomThreshold: 0,
      bloomStrength: 1.5,
      bloomRadius: 0
    };

    let renderPersonScene = new RenderPass(this.personScene, this.personCamera);

    let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.exposure = params.exposure;
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
    contrast.value = 1;
    this.personSceneProcess.nodepass_contrast = contrast;
    nodepass.needsUpdate = true;
    this.bloomComposerScenePerson.addPass(nodepass);

    let effectDarkMask = new ShaderPass(DarkMaskShader);
    effectDarkMask.uniforms["maskColor"].value = new THREE.Color(0x000000);
    effectDarkMask.uniforms["maskAlpha"].value = 1.0;
    effectDarkMask.uniforms["markRadius"].value = 0.25;
    effectDarkMask.uniforms["smoothSize"].value = 0.6;
    this.bloomComposerScenePerson.addPass(effectDarkMask);

    // file Pass
    const filmPass = new FilmPass(
      0.2,   // noise intensity
      0,  // scanline intensity
      0,    // scanline count
      false  // grayscale
    );
    filmPass.renderToScreen = true;
    this.bloomComposerScenePerson.addPass(filmPass);
  },

  composerSceneMain: function () {
    let params = {
      exposure: 0,
      bloomThreshold: 0,
      bloomStrength: 0,
      bloomRadius: 0
    };
    let renderMainScene = new RenderPass(this.mainScene, this.mainCamera);

    let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.exposure = params.exposure;
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;

    this.bloomComposerSceneMain = new EffectComposer(this.renderer);
    this.bloomComposerSceneMain.addPass(renderMainScene);
    this.bloomComposerSceneMain.addPass(bloomPass);
    this.mainSceneProcess.composer.bloomPass = bloomPass;

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
    contrast.value = 0;
    nodepass.needsUpdate = true;
    this.mainSceneProcess.composer.contrast = contrast;
    this.bloomComposerSceneMain.addPass(nodepass);

    let effectDarkMask = new ShaderPass(DarkMaskShader);
    effectDarkMask.uniforms["maskColor"].value = new THREE.Color(0x000000);
    effectDarkMask.uniforms["maskAlpha"].value = 1.0;
    effectDarkMask.uniforms["markRadius"].value = 0.1;
    effectDarkMask.uniforms["smoothSize"].value = 0.6;
    this.bloomComposerSceneMain.addPass(effectDarkMask);
    this.mainSceneProcess.composer.effectDarkMaskPass = effectDarkMask;

    // filmPass
    const filmPass = new FilmPass(
      0.2,   // noise intensity
      0,  // scanline intensity
      0,    // scanline count
      false  // grayscale
    );
    filmPass.renderToScreen = true;
    this.bloomComposerSceneMain.addPass(filmPass);
  },

  /*
	* @desc timeline
	* */
  initTimeLine: function () {
    let app = this;
    this.timeline = {
      process: 0,
      tl: null
    };

    let triangle = $(".nav-triangle");
    $("nav a").on("click", function () {
      let type = $(this).data("target");
      switch (type) {
      case "home":
        app.timeline.process = 0;
        tl.progress(0);
        break;
      case "work":
        app.timeline.process = 0.6;
        tl.progress(0.6);
        break;
      case "about":
        app.timeline.process = 0.98;
        tl.progress(0.98);
        break;
      case "blog":
        window.open("http://blog.luozhongdao.com/");
        break;
      }
    });
    gsap.registerPlugin(scrollTrigger);
    let tl = gsap.timeline({
      smoothChildTiming: true,
      scrollTrigger: {
        trigger: ".container",
        pin: true,   // pin the trigger element while active
        start: "top top", // when the top of the trigger hits the top of the viewport
        end: "+=10000", // end after scrolling 500px beyond the start
        scrub: 1, // smooth scrubbing, takes 1 second to "catch up" to the scrollbar
        // snap: {
        //   snapTo: "labels", // snap to the closest label in the timeline
        //   duration: {min: 0.2, max: 3}, // the snap animation should be at least 0.2 seconds, but no more than 3 seconds (determined by velocity)
        //   delay: 0.2, // wait 0.2 seconds from the last scroll event before doing the snapping
        //   ease: "power1.inOut" // the ease of the snap animation ("power3" by default)
        // }
        markers: false
      },
      onUpdate: () => {
        let progress = tl.progress();
        if (progress >= 0 && progress < 0.6) {
          triangle.css("transform", "translateY(" + 0 + "px)");
        } else if (progress >= 0.6 && progress < 0.98) {
          triangle.css("transform", "translateY(" + 30 + "px)");
        } else if (progress >= 0.98 && progress <= 1) {
          triangle.css("transform", "translateY(" + 60 + "px)");
        }
      }
    });
    this.timeline.tl = tl;

    tl.addLabel("personScene", 0);

    // camera move
    tl.add(gsap.to(this.personSceneProcess, 5, {
      value: 1
    }), "personScene");

    // camera target move
    tl.add(gsap.to(this.personSceneProcess, 2.5, {
      targetIndex: 1,
      onStart: () => {
        this.personSceneProcess.isShake = false;
      },
      onReverseComplete: () => {
        this.personSceneProcess.isShake = true;
      },
    }), "personScene+=2.5");

    // person scene dark
    tl.add(gsap.to(this.personSceneProcess.nodepass_contrast, 1, {value: 0}), "personScene+=3");

    tl.add(gsap.to(".s1-text1", 1, {
      translateY: -100,
      opacity: 0
    }), "personScene");

    tl.add(gsap.to(".s1-text2", 0.5, {
      translateY: 0,
      opacity: 1
    }), "personScene+=1.5");

    tl.add(gsap.to(".s1-text2", 1, {
      translateY: -100,
      opacity: 0
    }), "personScene+=2.5");

    // scene 0 to 1
    tl.add(gsap.to(this.process, 1, {
      value: 100
    }), "personScene+=4");

    tl.addLabel("mainScene", "personScene+=4");

    tl.add(gsap.to(".s2-text1", 0.5, {
      translateY: 0,
      opacity: 1
    }), "mainScene");

    tl.add(gsap.to(".s2-text1", 1, {
      translateY: -100,
      opacity: 0
    }), "mainScene+=2.5");

    tl.add(gsap.to(".s2-text2", 0.5, {
      translateY: 0,
      opacity: 1
    }), "mainScene+=3.5");

    tl.add(gsap.to(".s2-text2", 2, {
      translateY: -100,
      opacity: 0
    }), "mainScene+=5");

    // scene 1 in
    tl.add(gsap.to(this.mainSceneProcess, 10, {
      value: 1,
      onUpdate: function () {
        app.mainSceneProcess.characterAnimateRun = true;
        clearTimeout(app.mainSceneProcess.characterAnimate);
        app.mainSceneProcess.characterAnimate = setTimeout(() => {
          app.mainSceneProcess.characterAnimateRun = false;
        }, 100);
      }
    }), "mainScene");

    // scene 1 in
    tl.add(gsap.to(this.mainSceneProcess.streetPosition, 2, {y: 0}), "mainScene");

    // person scene dark
    tl.add(gsap.to(this.mainSceneProcess.composer.contrast, 3, {value: 1}), "mainScene+=0.2");

    tl.add(gsap.to(this.mainSceneProcess.composer.bloomPass, 4, {
      strength: 1
    }), "mainScene+=3");

    tl.add(gsap.to(this.mainSceneProcess.composer.bloomPass, 2, {
      strength: 0.2,
    }), "mainScene+=9");

    tl.add(gsap.to(app.mainSceneProcess.streetLight, 0.5, {
      distance: 0,
      intensity: 0,
      decay: 0,
      onComplete: () => {
        $(".s3-works").css("display", "block");
        $(".s3-work").css("transform", "translate(0%, 300%)");
      },
      onReverseComplete: () => {
        $(".s3-works").css("display", "none");
      }
    }), "mainScene+=8.5");


    tl.addLabel("textScene", "mainScene+=9");
    tl.add(gsap.to(this.mainSceneProcess.composer.effectDarkMaskPass.uniforms.markRadius, 1, {value: 1}), "textScene-=1");
    tl.add(gsap.to(this.mainSceneProcess.position, 1, {x: 0, y: 0, z: -50}), "textScene-=1");
    tl.add(gsap.fromTo(".work-1", 1, {opacity: 0, yPercent: 300}, {opacity: 1, yPercent: 150}), "textScene+=0");
    tl.add(gsap.fromTo(".work-1", 4, {opacity: 1, yPercent: 150}, {opacity: 0, yPercent: 0}), "textScene+=1");
    tl.add(gsap.fromTo(".work-2", 1, {opacity: 0, yPercent: 300}, {opacity: 1, yPercent: 150}), "textScene+=2.5");
    tl.add(gsap.fromTo(".work-2", 4, {opacity: 1, yPercent: 150}, {opacity: 0, yPercent: 0}), "textScene+=3.5");
    tl.add(gsap.fromTo(".work-3", 1, {opacity: 0, yPercent: 300}, {opacity: 1, yPercent: 150}), "textScene+=4.5");
    tl.add(gsap.fromTo(".work-3", 4, {opacity: 1, yPercent: 150}, {
      opacity: 0, yPercent: 0,
    }), "textScene+=5.5");


    tl.add(gsap.to(this.mainSceneProcess.composer.contrast, 1, {value: 0}), "textScene+=8");

    tl.addLabel("footerScene", "textScene+=9");


    tl.add(gsap.to(".about", 1, {
      opacity: 1
    }), "footerScene");

    tl.add(gsap.to(this.mainSceneProcess.composer.contrast, 1, {value: 0.4}), "footerScene+=1");

    tl.add(gsap.to(this._ambientLights, 0.5, {
      intensity: 2,
    }), "footerScene");

    tl.add(gsap.to(this._lights, 0.5, {
      intensity: 2,
      distance: 200,
    }), "footerScene");

    tl.add(gsap.to(this.mainCamera.position, 0.5, {
      x: 7, y: 5, z: -243,
      onStart: () => {
        this.mainSceneProcess.isInFooter = true;
      },
      onReverseComplete: () => {
        this.mainSceneProcess.isInFooter = false;
        this.mainCamera.position.set(new THREE.Vector3(0, 0, 0));
      }
    }), "footerScene");

    tl.add(gsap.fromTo(this.mainScene.fog, 0.5, {far: 4000, near: 20}, {far: 20, near: 5}), "footerScene");

    tl.add(gsap.to(this.mainSceneProcess.fogColor, 0.5, {
      r: 0, g: 0, b: 0,
      onUpdate: () => {
        let c = this.mainSceneProcess.fogColor;
        this.mainScene.fog.color = new THREE.Color("rgb(" + parseInt(c.r) + "," + parseInt(c.g) + "," + parseInt(c.b) + ")");
        this.mainScene.background = new THREE.Color("rgb(" + parseInt(c.r) + "," + parseInt(c.g) + "," + parseInt(c.b) + ")");
      }
    }), "footerScene");

    $(document).bind("mousemove", (event) => {
      event.preventDefault();
      let vec = new THREE.Vector3(); // create once and reuse
      let pos = new THREE.Vector3(); // create once and reuse
      vec.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
        0.5);
      vec.unproject(this.mainCamera);
      vec.sub(this.mainCamera.position).normalize();
      // let distance = -this.mainCamera.position.z / vec.z;
      let distance = (this.pLight.position.z - this.mainCamera.position.z) / vec.z;
      pos.copy(this.mainCamera.position).add(vec.multiplyScalar(distance));
      this.pLight.position.copy(pos);
    }
    );

  },

};

window.onload = function () {
  $("body").css("display", "block");
  let app = new appClass(document.querySelector("#canvas"));

  let render = function () {
    requestAnimationFrame(render);
    app.render();
  };

  window.addEventListener("resize", function () {
    app.resizeDisplayGL();
  }, false);

  app.initGL();
  app.resizeDisplayGL();
  app.loadModels();
  render();

  /*移动端按钮*/
  let beginAC = 80,
    endAC = 320,
    beginB = 80,
    endB = 320;

  function inAC(s) {
    s.draw("80% - 240", "80%", 0.3, {
      delay: 0.1,
      callback: function () {
        inAC2(s);
      }
    });
  }

  function inAC2(s) {
    s.draw("100% - 545", "100% - 305", 0.6, {
      easing: ease.ease("elastic-out", 1, 0.3)
    });
  }

  function inB(s) {
    s.draw(beginB - 60, endB + 60, 0.1, {
      callback: function () {
        inB2(s);
      }
    });
  }

  function inB2(s) {
    s.draw(beginB + 120, endB - 120, 0.3, {
      easing: ease.ease("bounce-out", 1, 0.3)
    });
  }

  /* Out animations (to burger icon) */

  function outAC(s) {
    s.draw("90% - 240", "90%", 0.1, {
      easing: ease.ease("elastic-in", 1, 0.3),
      callback: function () {
        outAC2(s);
      }
    });
  }

  function outAC2(s) {
    s.draw("20% - 240", "20%", 0.3, {
      callback: function () {
        outAC3(s);
      }
    });
  }

  function outAC3(s) {
    s.draw(beginAC, endAC, 0.7, {
      easing: ease.ease("elastic-out", 1, 0.3)
    });
  }

  function outB(s) {
    s.draw(beginB, endB, 0.7, {
      delay: 0.1,
      easing: ease.ease("elastic-out", 2, 0.4)
    });
  }

  /* Awesome burger default */

  let pathA = document.getElementById("pathA"),
    pathB = document.getElementById("pathB"),
    pathC = document.getElementById("pathC"),
    segmentA = new Segment(pathA, beginAC, endAC),
    segmentB = new Segment(pathB, beginB, endB),
    segmentC = new Segment(pathC, beginAC, endAC),
    trigger = document.getElementById("menu-icon-trigger"),
    toCloseIcon = true,
    wrapper = document.getElementById("menu-icon-wrapper"),
    sidenav = $("nav");

  wrapper.style.visibility = "visible";

  trigger.onclick = function () {
    if (toCloseIcon) {
      inAC(segmentA);
      inB(segmentB);
      inAC(segmentC);
      sidenav.attr("style", "transform: translateY(0)");
    } else {
      outAC(segmentA);
      outB(segmentB);
      outAC(segmentC);
      sidenav.attr("style", "transform: translateY(-100%)");
    }
    toCloseIcon = !toCloseIcon;
  };
};
