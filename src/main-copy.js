import "./style/main.less";
import $ from "jquery";
import {gsap} from "gsap";
import scrollTrigger from "gsap/dist/ScrollTrigger.js";
import ScrollToPlugin from "gsap/dist/ScrollToPlugin.js";
import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {NodePass} from "three/examples/jsm/nodes/postprocessing/NodePass.js";
import * as Nodes from "three/examples/jsm/nodes/Nodes.js";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {FilmPass} from "three/examples/jsm/postprocessing/FilmPass.js";
import {RGBShiftShader} from "three/examples/jsm/shaders/RGBShiftShader.js";
import {ShadowMesh} from "three/examples/jsm/objects/ShadowMesh.js";
import {Reflector} from "three/examples/jsm/objects/Reflector.js";

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

class appClass {
  constructor(elementToBindTo) {
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
  }

  /*
	* @desc: load models file
	*  */
  loadModels() {
    let app = this;

    app.isLoading = true;

    // 加载 glTF 格式的模型
    let GLTFloader = new GLTFLoader();/*实例化加载器*/
    let dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("./static/lib/draco/gltf/");
    dracoLoader.setDecoderConfig({type: "js"});
    GLTFloader.setDRACOLoader(dracoLoader);

    function model1(chain) {
      GLTFloader.load(
        "./static/model/fastrun/fastrundraco.gltf",
        (model) => {
          app.model1 = model;
          chain.next();
        },
        (xhr) => {
          setProcess(parseInt((xhr.loaded / xhr.total) * 25));
        },
        (error) => {
          console.log("An error happened");
        }
      );
    }

    function model2(chain) {
      GLTFloader.load("./static/model/street/streetdraco.gltf", (obj) => {
        app.model2 = obj;
        chain.next();
      }, function (xhr) {
        setProcess(parseInt((xhr.loaded / xhr.total) * 25) + 25);
      }, function (error) {
        console.log("load error!" + error);
      });
    }

    function model3(chain) {
      GLTFloader.load("./static/model/walk_out/walkdraco.gltf", (obj) => {
        app.model3 = obj;
        chain.next();
      }, function (xhr) {
        setProcess(parseInt((xhr.loaded / xhr.total) * 25) + 75);
      }, function (error) {
        console.log(error);
      });
    }

    function model4(chain) {
      GLTFloader.load("./static/model/darkperson/scene.gltf", (obj) => {
        app.model4 = obj;
        chain.next();
      }, function (xhr) {
        setProcess(parseInt((xhr.loaded / xhr.total) * 25) + 75);
      }, function (error) {
        console.log(error);
      });
    }

    function setProcess(num) {
      $(".loading-process").text(num + "%");
    }

    let chain;

    function* loadAllModels() {
      yield model1(chain);
      yield model2(chain);
      yield model3(chain);
      yield model4(chain);
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
  }

  /*
	* @desc: initGL
	*  */
  initGL() {
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
  }

  /*
	* @desc common
	*  */
  resizeDisplayGL() {
    let w = document.body.clientWidth;
    let h = document.body.clientHeight;
    this.recalcAspectRatio();
    this.renderer.setSize(w, h, false);
    if (this.bloomComposerScenePerson) {
      this.bloomComposerScenePerson.setSize(w, h);
    }
    if (this.bloomComposerSceneMain) {
      this.bloomComposerSceneMain.setSize(w, h);
    }
    this.updateCamera();
  }

  recalcAspectRatio() {
    let w = document.body.clientWidth;
    let h = document.body.clientHeight;
    this.aspectRatio = (h === 0) ? 1 : w / h;
  }

  updateCamera() {
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
  }

  render() {
    if (!this.isLoading) {
      let delta = this.clock.getDelta();
      let process = this.process.value;
      let wH = document.body.clientHeight;
      let wW = document.body.clientWidth;
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
    }
  }

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
        roughness: 0.2,
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
      textureWidth: document.body.clientWidth,
      textureHeight: window.innerHeight,
      color: 0x999999,
    });

    groundMirror.position.y = -0.5;
    groundMirror.rotateX(-Math.PI / 2);
    this.personScene.add(groundMirror);

    // background
    let bgGeometry = new THREE.SphereGeometry(1000, 50, 50);
    let bgMaterial = new THREE.MeshPhongMaterial({
      color: "#060322",
      shininess: 0,
      side: THREE.BackSide
    });
    let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    this.personScene.add(bgMesh);

    let ambientLight = new THREE.AmbientLight("#ffffff", 0.3);
    this.personScene.add(ambientLight);

    // load human model
    {
      let model = this.model1;
      model.scene.scale.set(35, 35, 35);
      model.scene.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      let animations = model.animations;
      this.personMixer = new THREE.AnimationMixer(model.scene);
      let actions = [];
      for (let i = 0; i < animations.length; i++) {
        actions[i] = this.personMixer.clipAction(animations[i]);
      }
      actions[0].play();
      this.personScene.add(model.scene);
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
  }

  scenePersonAnimate(delta) {
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
  }

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

    this.mainScene.fog = new THREE.Fog("#000000", 5, 500);

    let ambientLight = new THREE.AmbientLight("#ffffff", 0.5);
    this.mainScene.add(ambientLight);

    // this.controls = new OrbitControls(this.mainCamera, this.renderer.domElement);
    // this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    // this.controls.dampingFactor = 0.05;
    // this.controls.screenSpacePanning = false;
    // this.controls.minDistance = 100;
    // this.controls.maxDistance = 500;
    // this.controls.maxPolarAngle = Math.PI;


    // background
    let bgGeometry = new THREE.PlaneBufferGeometry(200, 175, 5, 5);
    let bgMaterial = new THREE.MeshLambertMaterial({
      color: "#ffffff",
      side: THREE.DoubleSide,
      flatShading: true
    });
    let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);

    bgMesh.position.x = -30;
    bgMesh.position.y = 35;
    bgMesh.position.z = 0;
    this.mainScene.add(bgMesh);

    let streetLight = new THREE.PointLight("#ffffff", 1, 0, 2);
    streetLight.distance = 2000;
    streetLight.position.set(0, 0, 0);
    this.mainScene.add(streetLight);
    this.mainSceneProcess.streetLight = streetLight;

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
          child.material.wireframe = true;
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
      model.scene.scale.set(20, 20, 20);
      model.scene.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      let animations = model.animations;
      this.personMixer2 = new THREE.AnimationMixer(model.scene);
      let actions = [];
      for (let i = 0; i < animations.length; i++) {
        actions[i] = this.personMixer2.clipAction(animations[i]);
      }
      actions[0].play();

      model.scene.position.set(-50, -10, 4000);
      model.scene.rotateY(Math.PI);
      this.streetCharacter = model.scene;
      this.mainScene.add(model.scene);
    }
    // 加载 模型
    {
      let model = this.model4;
      model.scene.scale.set(0.14, 0.14, 0.14);
      model.scene.traverse(function (child) {
        if (child.isMesh) {
          child.material.transparent = false;
          child.material.depthWrite = true;
          child.material.alphaTest = 0.1;
        }
      });

      model.scene.position.set(-60, -20, -100);
      model.scene.rotation.y = Math.PI / 180 * 90;
      this.mainModel = model.scene;
      this.mainScene.add(model.scene);
      let model2 = model.scene.clone();
      let m = new THREE.Matrix4();
      let vec = new THREE.Vector3(0, 0, 1);

      m.set(1 - 2 * vec.x * vec.x, -2 * vec.x * vec.y, -2 * vec.x * vec.z, 0,
        -2 * vec.x * vec.y, 1 - 2 * vec.y * vec.y, -2 * vec.y * vec.z, 0,
        -2 * vec.x * vec.z, -2 * vec.y * vec.z, 1 - 2 * vec.z * vec.z, 0,
        0, 0, 0, 1);
      model2.applyMatrix(m);
      model2.position.set(60, -20, -100);
      model2.rotation.y = -Math.PI / 180 * 90;
      this.mainModel2 = model2;
      this.mainScene.add(model2);


      let pLight = new THREE.PointLight("#ffffff", 1, 0, 2);
      pLight.distance = 5000;
      pLight.position.set(0, 0, -5);
      this.mainScene.add(pLight);
    }

    /*
		*
		* footer
		*
		* */
    {
      // background
      let bgGeometry = new THREE.PlaneBufferGeometry(2000, 2000, 100, 100);
      let bgMaterial = new THREE.MeshBasicMaterial({
        color: "0x555555",
        wireframe: true,
        side: THREE.DoubleSide
      });
      let bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);

      bgMesh.position.z = -500;
      this.mainScene.add(bgMesh);

      let bgMaterial2 = new THREE.MeshLambertMaterial({
        color: 0x333333,
        side: THREE.DoubleSide,
        shading: THREE.FlatShading
      });
      let bgMesh2 = new THREE.Mesh(bgGeometry, bgMaterial2);

      bgMesh.position.z = -500;
      bgMesh2.position.z = -500;
      this.mainScene.add(bgMesh);
      this.mainScene.add(bgMesh2);

      this._ambientLight = new THREE.AmbientLight("#ffffff", 0);
      this.mainScene.add(this._ambientLight);
    }
    this.composerSceneMain();
  }

  sceneMainAnimate(delta) {
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

    if (this.mainModel) {
      this.mainModel.rotateY(-Math.PI / 180);
      this.mainModel2.rotateY(Math.PI / 180);
    }
  }

  /*
	* @desc composer
	* */
  composerScenePerson() {
    const params = {
      exposure: 1,
      bloomThreshold: 0,
      bloomStrength: 1.5,
      bloomRadius: 0
    };

    let renderPersonScene = new RenderPass(this.personScene, this.personCamera);

    let bloomPass = new UnrealBloomPass(new THREE.Vector2(document.body.clientWidth, window.innerHeight), 1.5, 0.4, 0.85);
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
  }

  composerSceneMain() {
    let params = {
      exposure: 0,
      bloomThreshold: 0,
      bloomStrength: 0,
      bloomRadius: 0
    };
    let renderMainScene = new RenderPass(this.mainScene, this.mainCamera);

    let bloomPass = new UnrealBloomPass(new THREE.Vector2(document.body.clientWidth, window.innerHeight), 1.5, 0.4, 0.85);
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

    // RGBShiftShader
    let rgbSplit = new ShaderPass(RGBShiftShader);
    rgbSplit.uniforms["amount"].value = 0.0;
    rgbSplit.renderToScreen = true;
    this.bloomComposerSceneMain.addPass(rgbSplit);
    this.mainSceneProcess.composer.rgbSplit = rgbSplit;
  }

  /*
	* @desc timeline
	* */
  initTimeLine() {
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
        gsap.to("html", 2, {scrollTo: 0});
        break;
      case "work":
        gsap.to("html", 2, {scrollTo: 6000});
        break;
      case "about":
        gsap.to("html", 2, {scrollTo: 10000});
        break;
      case "blog":
        window.open("http://blog.luozhongdao.com/");
        break;
      }
    });
    gsap.registerPlugin(scrollTrigger);
    gsap.registerPlugin(ScrollToPlugin);
    let tl = gsap.timeline({
      smoothChildTiming: true,
      scrollTrigger: {
        trigger: ".container",
        pin: true,   // pin the trigger element while active
        start: "top top", // when the top of the trigger hits the top of the viewport
        end: "+=10000", // end after scrolling 500px beyond the start
        scrub: 1, // smooth scrubbing, takes 1 second to "catch up" to the scrollbar
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

    tl.add(gsap.to(this.mainSceneProcess.composer.contrast, 1, {value: 0}), "mainScene+=8.5");
    tl.add(gsap.to(this.mainSceneProcess.composer.contrast, 1, {value: 1}), "mainScene+=10");

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

    let footerFl = null;
    tl.add(gsap.to(this.mainCamera.position, 0.5, {
      x: 0, y: 0, z: -243,
      onStart: () => {
        this.mainSceneProcess.isInFooter = true;

        footerFl = setInterval(animeIn, 2000);

        function animeIn() {
          setTimeout(animeOne, 700);
        };

        function animeOne() {
          app.mainSceneProcess.composer.rgbSplit.uniforms["amount"].value = 0.01;
          setTimeout(animeTwo, 100);
        }

        function animeTwo() {
          app.mainSceneProcess.composer.rgbSplit.uniforms["amount"].value = 0.003;
          setTimeout(animeThree, 100);
        }

        function animeThree() {
          app.mainSceneProcess.composer.rgbSplit.uniforms["amount"].value = 0.05;
          setTimeout(animeOut, 100);
        }

        function animeOut() {
          app.mainSceneProcess.composer.rgbSplit.uniforms["amount"].value = 0;
        };
      },
      onReverseComplete: () => {
        clearInterval(footerFl);
        this.mainSceneProcess.isInFooter = false;
        this.mainCamera.position.set(new THREE.Vector3(0, 0, 0));
      }
    }), "footerScene");


  }
}

window.onload = function () {
  $("body").css("display", "block");
  let app = new appClass(document.querySelector("#canvas"));

  let render = function () {
    requestAnimationFrame(render);
    app.render();
  };


  let resizeTimeout = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      app.resizeDisplayGL();
    }, 300);
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
