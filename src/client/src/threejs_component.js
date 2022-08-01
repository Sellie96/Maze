import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js'
import { entity } from './entity.js'
import { grass } from './Grass.js'
import { spatial_grid_controller } from './spatial-grid-controller.js'

export const threejs_component = (() => {
  const _VS = `
  varying vec3 vWorldPosition;
  
  void main() {
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = worldPosition.xyz;
  
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`

  const _FS = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  uniform samplerCube background;
  
  varying vec3 vWorldPosition;
  
  void main() {
    vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
    vec3 stars = textureCube(background, viewDirection).xyz;
  
    float h = normalize(vWorldPosition + offset).y;
    float t = max(pow(max(h, 0.0), exponent), 0.0);
  
    float f = exp(min(0.0, -vWorldPosition.y * 0.00125));
  
    vec3 sky = mix(stars, bottomColor, f);
    gl_FragColor = vec4(sky, 1.0);
  }`

  class ThreeJSController extends entity.Component {
    constructor() {
      super()
    }

    InitEntity() {
      THREE.ShaderChunk.fog_fragment = `
      #ifdef USE_FOG
        vec3 fogOrigin = cameraPosition;
        vec3 fogDirection = normalize(vWorldPosition - fogOrigin);
        float fogDepth = distance(vWorldPosition, fogOrigin);
  
        fogDepth *= fogDepth;
  
        float heightFactor = 0.05;
        float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
            1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
        fogFactor = saturate(fogFactor);
  
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`

      THREE.ShaderChunk.fog_pars_fragment = `
      #ifdef USE_FOG
        uniform float fogTime;
        uniform vec3 fogColor;
        varying vec3 vWorldPosition;
        #ifdef FOG_EXP2
          uniform float fogDensity;
        #else
          uniform float fogNear;
          uniform float fogFar;
        #endif
      #endif`

      THREE.ShaderChunk.fog_vertex = `
      #ifdef USE_FOG
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0 )).xyz;
      #endif`

      THREE.ShaderChunk.fog_pars_vertex = `
      #ifdef USE_FOG
        varying vec3 vWorldPosition;
      #endif`

      this.threejs_ = new THREE.WebGLRenderer({
        antialias: false
      })
      this.threejs_.outputEncoding = THREE.sRGBEncoding
      this.threejs_.gammaFactor = 2.2
      this.threejs_.shadowMap.enabled = true
      this.threejs_.shadowMap.type = THREE.PCFSoftShadowMap
      this.threejs_.setPixelRatio(window.devicePixelRatio)
      this.threejs_.setSize(window.innerWidth, window.innerHeight)
      this.threejs_.domElement.id = 'threejs'

      document.getElementById('container').appendChild(this.threejs_.domElement)

      window.addEventListener(
        'resize',
        () => {
          this.resize()
        },
        false
      )

      const fov = 60
      const aspect = 1920 / 1080
      const near = 1.0
      const far = 10000.0
      this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far)
      this.camera_.position.set(50, 10, 25)

      this.scene_ = new THREE.Scene()
      this.scene_.fog = new THREE.FogExp2(0x87ceeb, 0.0000002)

      let light = new THREE.DirectionalLight(0xffffff, 1.0)
      light.position.set(-10, 500, 10)
      light.target.position.set(0, 0, 0)
      light.castShadow = true
      light.shadow.bias = -0.001
      light.shadow.mapSize.width = 4096
      light.shadow.mapSize.height = 4096
      light.shadow.camera.near = 0.1
      light.shadow.camera.far = 1000.0
      light.shadow.camera.left = 100
      light.shadow.camera.right = -100
      light.shadow.camera.top = 100
      light.shadow.camera.bottom = -100
      this.scene_.add(light)

      this.sun_ = light

      const grass2 = new grass.Grass(900, 900000)
      // this.scene_.add(grass2)

      //SpawnArea
      this.loadCube(200, 75, 150); //Maze Entrance
      this.loadCube(-350, 75, 150);//Maze Entrance
      this.loadCube(-50, 75, -200); //Back spawn
      this.loadCube(150, 75, -100, true); //SideSpawn
      this.loadCube(-300, 75, -100, true); //SideSpawn


      //MazeEntrance
      this.loadCube(-300, 75, 400, true, 500); //Right Arena
      this.loadCube(300, 75, 400, true, 800); //Left Arena

      //MazeExit
      this.loadCube(200, 75, 500); //Maze Exit
      this.loadCube(-340, 75, 500);//Maze Exit
      this.loadCube(-50, 75, 700, false, 1000); //Back Exit

      //Maze
      this.loadCube(-100, 0, 175, false, 350, 10 ); //Maze FirstWall
      this.loadCube(75, 0, 250, true, 100, 10 ); // Left Straight Wall
      this.loadCube(100, 0, 200, true, 100, 10 ); // Left Straight Wall
      this.loadCube(100, 0, 270, false, 100, 10 ); // Left Straight Wall

      //LeftSection
      this.loadCube(150, 0, 250, true, 100, 10 ); // Left Straight Wall
      this.loadCube(200, 0, 175, false, 100, 10 ); // Left Wall
      this.loadCube(170, 0, 250, true, 150, 10 ); // Left Straight Wall

      this.loadCube(240, 0, 200, false, 135, 10 ); // Left Wall

      //Fake Section
      this.loadCube(240, 0, 225, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 250, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 275, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 300, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 325, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 350, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 375, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 400, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 425, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 450, false, 135, 10 ); // Left Wall
      this.loadCube(240, 0, 475, false, 135, 10 ); // Left Wall
      this.loadCube(95, 0, 420, true, 170, 10 ); // Left Wall
      this.loadCube(120, 0, 420, true, 170, 10 ); // Left Wall
      this.loadCube(145, 0, 420, true, 170, 10 ); // Left Wall

      this.loadCube(50, 0, 325, false, 250, 10 ); // Left Wall

      this.loadCube(-50, 0, 200, false, 200, 10 ); // Left Wall

      this.loadCube(45, 0, 310, true, 40, 10 ); // Left Wall

      this.loadCube(-20, 0, 270, false, 150, 10 ); // Left Wall

      this.loadCube(-90, 0, 265, true, 150, 10 ); // Left Wall

      this.loadCube(-20, 0, 340, false, 150, 10 ); // Left Wall

      this.loadCube(70, 0, 425, true, 170, 10 ); // Left Wall

      //Fake Section
      this.loadCube(45, 0, 420, true, 130, 10 ); // Left Wall
      this.loadCube(20, 0, 420, true, 130, 10 ); // Left Wall
      this.loadCube(-5, 0, 420, true, 130, 10 ); // Left Wall
      this.loadCube(-30, 0, 420, true, 130, 10 ); // Left Wall
      this.loadCube(-55, 0, 420, true, 130, 10 ); // Left Wall
      this.loadCube(-80, 0, 420, true, 130, 10 ); // Left Wall

      this.loadCube(50, 0, 420, true, 130, 10 ); // Left Wall

      this.loadCube(-30, 0, 485, false, 160, 10 ); // Left Wall

      this.loadCube(-95, 0, 435, true, 130, 10 ); // Left Wall



      //RightSection
      this.loadCube(-270, 0, 325, true, 295, 10 ); // Right Wall

      this.loadCube(-255, 0, 350, true, 295, 10 ); // Right Wall

      this.loadCube(-230, 0, 325, true, 295, 10 ); // Right Wall

      this.loadCube(-205, 0, 350, true, 295, 10 ); // Right Wall

      this.loadCube(-180, 0, 325, true, 295, 10 ); // Right Wall

      this.loadCube(-155, 0, 350, true, 270, 10 ); // Right Wall

      this.loadCube(-130, 0, 220, false, 50, 10 ); // Right Wall

      this.loadCube(-115, 0, 245, false, 50, 10 ); // Right Wall

      this.loadCube(-130, 0, 270, false, 50, 10 ); // Right Wall

      this.loadCube(-115, 0, 295, false, 50, 10 ); // Right Wall

      this.loadCube(-130, 0, 320, false, 50, 10 ); // Right Wall

      this.loadCube(-115, 0, 345, false, 50, 10 ); // Right Wall

      this.loadCube(-130, 0, 370, false, 50, 10 ); // Right Wall
      this.loadCube(-130, 0, 395, false, 50, 10 ); // Right Wall
      this.loadCube(-130, 0, 420, false, 50, 10 ); // Right Wall

      this.loadCube(-130, 0, 445, false, 50, 10 ); // Right Wall
      this.loadCube(-130, 0, 470, false, 50, 10 ); // Right Wall


      this.LoadSky_()
    }

    loadCube(x, y, z, rotate = false, sizeX = 500, SizeY = 150, SizeZ = 5) {
      const texture = new THREE.TextureLoader().load('resources/wallTexture.jpg')
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(4, 4)

      var geometry = new THREE.CubeGeometry(1, 1, 1)

      var cubeMaterials = new THREE.MeshBasicMaterial({ map: texture })

      var cube = new THREE.Mesh(geometry, cubeMaterials)
      cube.position.set(x, y, z)
      cube.scale.x = sizeX // SCALE
      cube.scale.y = SizeY // SCALE
      cube.scale.z = SizeZ // SCALE
      if (rotate) {
        cube.rotation.y = Math.PI / 2
      }
      this.scene_.add(cube)
    }

    resize() {
      const width = window.innerWidth
      const height = window.innerHeight

      this.camera_.aspect = width / height
      this.camera_.updateProjectionMatrix()

      this.threejs_.setSize(width, height)
    }

    LoadSky_() {
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfffffff, 0.6)
      hemiLight.color.setHSL(0.6, 1, 0.6)
      hemiLight.groundColor.setHSL(0.095, 1, 0.75)
      this.scene_.add(hemiLight)

      const uniforms = {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 33 },
        exponent: { value: 0.6 }
      }
      uniforms['topColor'].value.copy(hemiLight.color)

      this.scene_.fog.color.copy(uniforms['bottomColor'].value)

      const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15)
      const skyMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: _VS,
        fragmentShader: _FS,
        side: THREE.BackSide
      })

      const sky = new THREE.Mesh(skyGeo, skyMat)
      this.scene_.add(sky)
    }

    Update(_) {
      const player = this.FindEntity('player')
      if (!player) {
        return
      }
      const pos = player._position

      this.sun_.position.copy(pos)
      this.sun_.position.add(new THREE.Vector3(-10, 500, -10))
      this.sun_.target.position.copy(pos)
      this.sun_.updateMatrixWorld()
      this.sun_.target.updateMatrixWorld()
    }
  }

  return {
    ThreeJSController: ThreeJSController
  }
})()
