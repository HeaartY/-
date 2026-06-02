import { loadGuangdongMapData, loadCityMapData } from './map-data-special-analysis.js';
import { MapInteractionsSpecialAnalysis } from './map-interactions-special-analysis.js';

const THREE_MODULE = 'https://unpkg.com/three@0.165.0/build/three.module.js';
const POSTPROCESS_MODULE = 'https://unpkg.com/three@0.165.0/examples/jsm/postprocessing/';
const MAP_VIEW_OFFSET_X = 0.9;
const MAP_VIEW_OFFSET_Y = -1.0;
const TOPIC = 'special-analysis';

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

function getTopicSections() {
  return Array.from(document.querySelectorAll(`[data-topic-content="${TOPIC}"]`));
}

function getTopicElement(selector) {
  for (const section of getTopicSections()) {
    const match = section.querySelector(selector);
    if (match) return match;
  }
  return null;
}

function getSpecialTopbarFilters() {
  return document.querySelector('[data-special-topbar-filters]');
}

function getSpecialRegionSelect() {
  return document.querySelector('[data-special-region-select]');
}

function getSpecialLayerToolbar() {
  return getTopicElement('[data-special-analysis-layer-toolbar]');
}

function syncSpecialRegionFilter(cityName = '') {
  const regionSelect = getSpecialRegionSelect();
  if (!regionSelect) return;

  const resolvedCityName = cityName || getTopicElement('[data-breadcrumb-city]')?.textContent?.trim() || '';
  const dynamicOption = regionSelect.querySelector('[data-special-region-dynamic]');

  if (!resolvedCityName) {
    dynamicOption?.remove();
    regionSelect.value = 'guangdong';
    return;
  }

  const matchedOption = Array.from(regionSelect.options).find((option) => option.textContent.trim() === resolvedCityName);
  if (matchedOption) {
    dynamicOption?.remove();
    regionSelect.value = matchedOption.value;
    return;
  }

  if (dynamicOption) {
    dynamicOption.value = resolvedCityName;
    dynamicOption.textContent = resolvedCityName;
  } else {
    const option = document.createElement('option');
    option.value = resolvedCityName;
    option.textContent = resolvedCityName;
    option.dataset.specialRegionDynamic = 'true';
    regionSelect.append(option);
  }
  regionSelect.value = resolvedCityName;
}

export class TwinMapSceneSpecialAnalysis {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.animationFrame = 0;
    this.active = false;
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
    this.currentCityName = '';
    this.currentDistrictName = '';
    this.isCityView = false;
    this.activeLayerMode = 'hot-items';
    this.hotspotGroup = null;
  }

  async start() {
    if (!this.container) return;

    this.bindTopicControls();
    this.syncTopicControls();

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
    this._provinceMapData = mapData;
    this._provinceMapData = mapData;

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
    this.interactions = new MapInteractionsSpecialAnalysis({
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

  setActive(active) {
    this.active = active;
    this.syncTopicControls();
  }

  syncTopicControls() {
    const filters = getSpecialTopbarFilters();
    if (filters) {
      filters.hidden = !this.active;
    }
    syncSpecialRegionFilter();
  }

  bindTopicControls() {
    if (this.topicControlsBound) return;
    this.topicControlsBound = true;

    const cityLabel = getTopicElement('[data-breadcrumb-city]');
    if (cityLabel) {
      const observer = new MutationObserver(() => {
        syncSpecialRegionFilter();
      });
      observer.observe(cityLabel, { childList: true, characterData: true, subtree: true });
      this.disposeFns.push(() => observer.disconnect());
    }

    const regionSelect = getSpecialRegionSelect();
    if (regionSelect) {
      const handleChange = () => {
        if (!this.active) return;
        if (regionSelect.value === 'guangdong') {
          this.resetView();
          return;
        }
        const selectedName = regionSelect.selectedOptions[0]?.textContent?.trim();
        const region = this._provinceMapData?.regions?.find((item) => item.name === selectedName);
        if (region) {
          this.handleRegionSelect(region);
        }
      };
      regionSelect.addEventListener('change', handleChange);
      this.disposeFns.push(() => regionSelect.removeEventListener('change', handleChange));
    }

    const layerToolbar = getSpecialLayerToolbar();
    if (layerToolbar) {
      const handleToolbarClick = (event) => {
        const button = event.target.closest('[data-special-analysis-layer-toggle]');
        if (!button) return;
        const layer = button.dataset.specialAnalysisLayerToggle;
        if (!layer || !['hot-items', 'bottlenecks'].includes(layer)) return;
        this.activeLayerMode = layer;
        this.syncLayerToolbar();
        this.applyLayerVisibility();
      };
      layerToolbar.addEventListener('click', handleToolbarClick);
      this.disposeFns.push(() => layerToolbar.removeEventListener('click', handleToolbarClick));
    }
  }

  handleRegionSelect(region, mesh = null) {
    const resolvedRegion = region ?? mesh?.userData?.region ?? null;
    if (!resolvedRegion?.name) return;

    if (this.currentCityName) {
      this.selectedRegionId = resolvedRegion?.id ?? '';
      this.activeRegionId = resolvedRegion?.id ?? '';
      this.currentDistrictName = resolvedRegion.name;
      this.regionMeshes.forEach((regionMesh) => {
        const isSelected = regionMesh.userData?.region?.id === this.selectedRegionId;
        regionMesh.visible = isSelected;
        this.setRegionOpacity(regionMesh, isSelected ? 1 : 0.98);
      });
      this.focusRegion(resolvedRegion);
      this.syncBreadcrumb();
      this.syncLayerToolbar();
      return;
    }

    this.selectedRegionId = resolvedRegion?.id ?? '';
    this.activeRegionId = resolvedRegion?.id ?? '';
    this.currentCityName = resolvedRegion.name;
    this.currentDistrictName = '';
    this.regionMeshes.forEach((regionMesh) => {
      const isSelected = regionMesh.userData?.region?.id === this.selectedRegionId;
      regionMesh.visible = isSelected;
      this.setRegionOpacity(regionMesh, isSelected ? 1 : 0.98);
    });
    this.focusRegion(resolvedRegion);
    this.isCityView = true;
    this.syncBreadcrumb();
    this.syncLayerToolbar();
    syncSpecialRegionFilter(resolvedRegion.name);
    this.drilldownToCity(resolvedRegion);
    this.options.onRegionSelect?.(resolvedRegion, mesh);
  }

  buildScene() {
    const { THREE } = this;

    const ambient = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambient);

    this.mapGroup = new THREE.Group();
    this.mapGroup.position.set(MAP_VIEW_OFFSET_X, 0, MAP_VIEW_OFFSET_Y);
    this.scene.add(this.mapGroup);

    this.hotspotGroup = new THREE.Group();
    this.scene.add(this.hotspotGroup);

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

    this.buildRegions(this.regions);
    this.buildHotspots(this.hotspots);
    this.syncLayerToolbar();
    this.applyLayerVisibility();
  }

  buildRegions(regions = this.regions) {
    const { THREE } = this;

    for (const region of regions) {
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

  buildHotspots(hotspots = this.hotspots) {
    const { THREE } = this;
    if (!this.hotspotGroup) return;

    while (this.hotspotGroup.children.length) {
      const child = this.hotspotGroup.children[0];
      this.hotspotGroup.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }

    hotspots.forEach((hotspot) => {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(hotspot.radius ?? 0.36, 28),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(hotspot.color ?? '#57b8ff'),
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(hotspot.x, 0.05, hotspot.y);
      mesh.userData = { type: 'hotspot', hotspot };
      this.hotspotGroup.add(mesh);
    });
  }

  syncLayerToolbar() {
    const layerToolbar = getSpecialLayerToolbar();
    if (!layerToolbar) return;
    const cityLabel = getTopicElement('[data-breadcrumb-city]')?.textContent?.trim() || '';
    layerToolbar.hidden = !cityLabel;
    layerToolbar.querySelectorAll('[data-special-analysis-layer-toggle]').forEach((button) => {
      const layer = button.dataset.specialAnalysisLayerToggle;
      const pressed = layer === this.activeLayerMode;
      button.setAttribute('aria-pressed', String(pressed));
    });
  }

  getRegionColorByMode(region, index = 0) {
    const intensityBase = ((index % 5) + 1) / 5;
    const heat = Number(region?.heatLevel ?? intensityBase);
    const strength = Math.max(0, Math.min(1, heat));
    if (this.activeLayerMode === 'bottlenecks') {
      return [0x1f5eff, 0x2253d8, 0x1a46b8, 0x17419d, 0x12357f][index % 5];
    }
    return [0x5fd9ff, 0x44c8ff, 0x31b7ff, 0x2298f0, 0x1b7cd4][Math.min(4, Math.max(0, Math.round((1 - strength) * 4)))];
  }

  applyLayerVisibility() {
    this.regionMeshes.forEach((regionMesh, index) => {
      regionMesh.visible = true;
      regionMesh.children.forEach((child) => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(this.getRegionColorByMode(regionMesh.userData?.region, index));
          child.material.opacity = 1;
        }
        if (child.isSprite) {
          child.visible = true;
        }
      });
    });
    if (this.hotspotGroup) {
      this.hotspotGroup.visible = this.activeLayerMode === 'hot-items';
    }
  }

  syncBreadcrumb() {
    const breadcrumb = getTopicElement('[data-breadcrumb]');
    const cityLabel = getTopicElement('[data-breadcrumb-city]');
    const districtLabel = getTopicElement('[data-breadcrumb-district]');
    const districtSep = getTopicElement('[data-breadcrumb-district-sep]');
    if (breadcrumb) {
      if (this.currentCityName) {
        breadcrumb.dataset.breadcrumbState = 'drilled';
      } else {
        delete breadcrumb.dataset.breadcrumbState;
      }
    }
    if (cityLabel) cityLabel.textContent = this.currentCityName;
    if (districtLabel) {
      districtLabel.textContent = this.currentDistrictName;
      districtLabel.hidden = !this.currentDistrictName;
    }
    if (districtSep) districtSep.hidden = !this.currentDistrictName;
  }

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

    this.clearMapGroup();
    this.regions = this._provinceMapData.regions;
    this.hotspots = this._provinceMapData.hotspots;
    this.links = this._provinceMapData.links;
    this.isCityView = false;
    this.activeLayerMode = 'hot-items';
    this.buildRegions(this.regions);

    this.activeRegionId = '';
    this.selectedRegionId = '';
    this.currentCityName = '';
    this.currentDistrictName = '';
    this.mapGroup.scale.setScalar(1);
    this.mapGroup.position.set(MAP_VIEW_OFFSET_X, 0, MAP_VIEW_OFFSET_Y);
    this.camera.position.copy(this.baseCameraPosition);
    this.cameraTarget.copy(this.baseCameraTarget);
    this.camera.lookAt(this.cameraTarget);

    this.syncBreadcrumb();
    this.syncLayerToolbar();
    syncSpecialRegionFilter();
    this.options.onReset?.();
  }

  async drilldownToCity(region) {
    if (!region?.name) return;
    const adcode = String(region.id).length === 4 ? `${region.id}00` : String(region.id);

    const cityData = await loadCityMapData(adcode);
    this.clearMapGroup();
    this.regions = cityData.regions;
    this.hotspots = cityData.hotspots;
    this.links = cityData.links;
    this.isCityView = true;
    this.currentDistrictName = '';
    this.activeLayerMode = 'hot-items';
    this.buildRegions(cityData.regions);

    // 地市级地图使用自身 bbox 投影，已居中于 (0,0)
    this.mapGroup.scale.setScalar(1);
    this.mapGroup.position.set(0, 0, 0);
    this.camera.position.set(0, 6, 8.6);
    this.cameraTarget.set(0, 0.45, 0);
    this.camera.lookAt(this.cameraTarget);
    this.syncLayerToolbar();
  }

  clearMapGroup() {
    while (this.mapGroup.children.length) {
      const child = this.mapGroup.children[0];
      this.mapGroup.remove(child);
      if (child.isMesh || child.isSprite) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
      if (child.isGroup) {
        child.children.forEach((c) => {
          c.geometry?.dispose();
          c.material?.dispose();
        });
      }
    }
    this.pickables.length = 0;
    this.regionMeshes.length = 0;
    while (this.hotspotGroup?.children?.length) {
      const child = this.hotspotGroup.children[0];
      this.hotspotGroup.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  setRegionSelected(mesh, region) {
    this.handleRegionSelect(region, mesh);
  }

  setHotspotHover(mesh, hovered) {
    if (!mesh?.material) return;
    mesh.material.opacity = hovered ? 1 : 0.88;
    mesh.scale.setScalar(hovered ? 1.16 : 1);
  }

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
    this.syncLayerToolbar();
  }

  stop() {
    window.cancelAnimationFrame(this.animationFrame);
    this.interactions?.disconnect();
    this.disposeFns.forEach((dispose) => dispose());
    this.disposeFns = [];
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}
