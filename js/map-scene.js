import { loadGuangdongMapData } from './map-data.js';
import { MapInteractions } from './map-interactions.js';

const THREE_MODULE = 'https://unpkg.com/three@0.165.0/build/three.module.js';
const POSTPROCESS_MODULE = 'https://unpkg.com/three@0.165.0/examples/jsm/postprocessing/';
const MAP_VIEW_OFFSET_X = 0.9;
const MAP_VIEW_OFFSET_Y = -1.0;

let threeBundlePromise;

async function loadThreeBundle() {
  if (!threeBundlePromise) {
    threeBundlePromise = import(THREE_MODULE).then(async (THREE) => {
      window.THREE = THREE;

      const postprocessResults = await Promise.allSettled([
        import(`${POSTPROCESS_MODULE}EffectComposer.js`),
        import(`${POSTPROCESS_MODULE}RenderPass.js`),
        import(`${POSTPROCESS_MODULE}UnrealBloomPass.js`),
        import(`${POSTPROCESS_MODULE}OutputPass.js`),
      ]);

      const [composerModule, renderPassModule, bloomModule, outputPassModule] = postprocessResults;
      const postprocessReady = postprocessResults.every((result) => result.status === 'fulfilled');

      if (!postprocessReady) {
        console.warn('Postprocessing modules failed to load, falling back to direct rendering.', postprocessResults);
      }

      return {
        THREE,
        EffectComposer: postprocessReady ? composerModule.value.EffectComposer : null,
        RenderPass: postprocessReady ? renderPassModule.value.RenderPass : null,
        UnrealBloomPass: postprocessReady ? bloomModule.value.UnrealBloomPass : null,
        OutputPass: postprocessReady ? outputPassModule.value.OutputPass : null,
        postprocessReady,
      };
    });
  }

  return threeBundlePromise;
}

function createGlowTexture(THREE, colorA, colorB = 'rgba(0,0,0,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(0.55, colorA);
  gradient.addColorStop(1, colorB);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createCurvePoints(from, to, THREE) {
  const start = new THREE.Vector3(from.x, 0.18, from.y);
  const end = new THREE.Vector3(to.x, 0.18, to.y);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += 0.5 + start.distanceTo(end) * 0.06;
  return new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(48);
}

function createLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(3, 8, 14, 0.9)';
  context.shadowBlur = 10;
  context.fillStyle = '#eef9ff';
  context.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas;
}

function getRegionBounds(region) {
  const points = region?.shapes?.flat() ?? [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  return { minX, maxX, minY, maxY };
}

export class TwinMapScene {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.animationFrame = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.disposeFns = [];
    this.pickables = [];
    this.hotspotMap = new Map();
    this.regionMeshes = [];
    this.hoverRipples = [];
    this.flowPulses = [];
    this.cityLights = [];
    this.regions = [];
    this.hotspots = [];
    this.links = [];
    this.selectedRegionId = '';
    this.activeRegionId = '';
    this.baseCameraPosition = null;
    this.baseCameraTarget = null;
    this.cameraTarget = null;
  }

  async start() {
    if (!this.container) return;

    const bundle = await loadThreeBundle();
    this.THREE = bundle.THREE;
    this.EffectComposer = bundle.EffectComposer;
    this.RenderPass = bundle.RenderPass;
    this.UnrealBloomPass = bundle.UnrealBloomPass;
    this.OutputPass = bundle.OutputPass;
    this.postprocessReady = bundle.postprocessReady;

    const mapData = await loadGuangdongMapData();
    this.regions = mapData.regions;
    this.hotspots = mapData.hotspots;
    this.links = mapData.links;

    this.clock = new this.THREE.Clock();
    this.scene = new this.THREE.Scene();
    this.scene.fog = new this.THREE.FogExp2(0x07121d, 0.018);
    this.mapGroup = null;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera = new this.THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0.3, 6, 8.6);
    this.baseCameraPosition = this.camera.position.clone();
    this.baseCameraTarget = new this.THREE.Vector3(0, 0.45, 0);
    this.cameraTarget = this.baseCameraTarget.clone();
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;
    this.renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.domElement.className = 'viewport-scene__canvas';
    this.container.appendChild(this.renderer.domElement);

    this.composer = null;
    this.bloomPass = null;

    this.buildScene();
    this.interactions = new MapInteractions({
      camera: this.camera,
      domElement: this.renderer.domElement,
      pickables: this.pickables,
      hotspots: this.hotspots,
      onRegionHover: (mesh, hovered) => this.setRegionHover(mesh, hovered),
      onHotspotHover: (mesh, hovered, point) => this.setHotspotHover(mesh, hovered, point),
      onRegionClick: (mesh, region) => this.setRegionSelected(mesh, region),
    });
    this.interactions.connect();

    this.animate = this.animate.bind(this);
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  buildScene() {
    const { THREE } = this;

    const ambient = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambient);

    this.mapGroup = new THREE.Group();
    this.mapGroup.position.set(MAP_VIEW_OFFSET_X, 0, MAP_VIEW_OFFSET_Y);
    this.scene.add(this.mapGroup);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(6.1, 108),
      new THREE.MeshBasicMaterial({
        color: 0x08131f,
        transparent: true,
        opacity: 0.14,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.scene.add(ground);

    this.buildRegions();
  }

  buildRegions() {
    const { THREE } = this;

    for (const region of this.regions) {
      const regionGroup = new THREE.Group();
      regionGroup.userData = { type: 'region', region };
      this.mapGroup.add(regionGroup);
      this.pickables.push(regionGroup);
      this.regionMeshes.push(regionGroup);

      for (const points of region.shapes) {
        const planarPoints = points.map(([x, y]) => [x, -y]);
        const shape = new THREE.Shape();
        planarPoints.forEach(([x, y], index) => {
          if (index === 0) {
            shape.moveTo(x, y);
          } else {
            shape.lineTo(x, y);
          }
        });
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(region.fillStart),
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide,
        });
        const shapeMesh = new THREE.Mesh(geometry, material);
        shapeMesh.userData = { type: 'region-shape', region };
        regionGroup.add(shapeMesh);
      }

      if (region.center) {
        const texture = new THREE.CanvasTexture(createLabelTexture(region.shortName));
        const label = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          })
        );
        label.position.set(region.center.x, 0.035, region.center.y);
        label.scale.set(0.72, 0.24, 1);
        regionGroup.add(label);
        this.disposeFns.push(() => texture.dispose());
        this.disposeFns.push(() => label.material.dispose());
      }
    }
  }

  buildHotspots() {}

  buildFlowLines() {}

  buildAtmosphericParticles() {}

  setRegionOpacity(regionMesh, opacity) {
    regionMesh.children.forEach((child) => {
      if (child.isMesh && child.material) {
        child.material.opacity = opacity;
      }
    });
  }

  setRegionHover(mesh, hovered) {
    const isSelected = mesh.userData?.region?.id === this.selectedRegionId;
    this.setRegionOpacity(mesh, hovered || isSelected ? 1 : 0.98);
  }

  focusRegion(region) {
    if (!region || !this.camera || !this.cameraTarget || !this.baseCameraPosition || !this.baseCameraTarget) return;

    const bounds = getRegionBounds(region);
    const centerX = (bounds.minX + bounds.maxX) / 2 + MAP_VIEW_OFFSET_X;
    const centerZ = -((bounds.minY + bounds.maxY) / 2) + MAP_VIEW_OFFSET_Y;
    const sizeX = bounds.maxX - bounds.minX;
    const sizeZ = bounds.maxY - bounds.minY;
    const size = Math.max(sizeX, sizeZ, 0.8);
    const zoomFactor = Math.min(Math.max(4.8 / size, 1.35), 2.5);

    this.mapGroup.scale.setScalar(zoomFactor);
    this.mapGroup.position.set(MAP_VIEW_OFFSET_X - centerX * (zoomFactor - 1), 0, MAP_VIEW_OFFSET_Y - centerZ * (zoomFactor - 1));
    this.camera.position.set(
      centerX * 0.18 + this.baseCameraPosition.x,
      Math.max(4.4, this.baseCameraPosition.y - (zoomFactor - 1) * 1.1),
      centerZ * 0.22 + Math.max(5.6, this.baseCameraPosition.z - (zoomFactor - 1) * 2.1)
    );
    this.cameraTarget.set(centerX, this.baseCameraTarget.y, centerZ);
    this.camera.lookAt(this.cameraTarget);
  }

  resetView() {
    if (!this.camera || !this.cameraTarget || !this.baseCameraPosition || !this.baseCameraTarget) return;
    this.activeRegionId = '';
    this.selectedRegionId = '';
    this.mapGroup.scale.setScalar(1);
    this.mapGroup.position.set(MAP_VIEW_OFFSET_X, 0, MAP_VIEW_OFFSET_Y);
    this.camera.position.copy(this.baseCameraPosition);
    this.cameraTarget.copy(this.baseCameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.regionMeshes.forEach((regionMesh) => {
      this.setRegionOpacity(regionMesh, 1);
      regionMesh.visible = true;
    });
  }

  setRegionSelected(mesh, region) {
    this.selectedRegionId = region?.id ?? '';

    if (this.options.drilldownOnSelect) {
      this.activeRegionId = region?.id ?? '';
      this.regionMeshes.forEach((regionMesh) => {
        const isSelected = regionMesh.userData?.region?.id === this.selectedRegionId;
        regionMesh.visible = isSelected;
        this.setRegionOpacity(regionMesh, isSelected ? 1 : 0.98);
      });
      this.focusRegion(region);
    } else {
      this.regionMeshes.forEach((regionMesh) => {
        const isSelected = regionMesh.userData?.region?.id === this.selectedRegionId;
        regionMesh.visible = true;
        this.setRegionOpacity(regionMesh, isSelected ? 1 : 0.98);
      });
    }

    this.options.onRegionSelect?.(region, mesh);
  }

  setHotspotHover() {}

  spawnRipple() {}

  updateFlows() {}

  updateRipples() {}

  animate() {
    this.clock.getDelta();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  resize() {
    if (!this.renderer || !this.camera) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
  }

  stop() {
    window.cancelAnimationFrame(this.animationFrame);
    this.interactions?.disconnect();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}
