export class MapInteractionsAppealMap {
  constructor({ camera, domElement, pickables, hotspots, onRegionHover, onHotspotHover, onRegionClick }) {
    this.camera = camera;
    this.domElement = domElement;
    this.pickables = pickables;
    this.hotspots = hotspots;
    this.onRegionHover = onRegionHover;
    this.onHotspotHover = onHotspotHover;
    this.onRegionClick = onRegionClick;
    this.pointer = { x: 0, y: 0 };
    this.raycaster = new window.THREE.Raycaster();
    this.hovered = null;
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  connect() {
    this.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.domElement.addEventListener('pointerleave', this.handlePointerLeave);
    this.domElement.addEventListener('click', this.handleClick);
  }

  disconnect() {
    this.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.domElement.removeEventListener('pointerleave', this.handlePointerLeave);
    this.domElement.removeEventListener('click', this.handleClick);
  }

  updatePointer(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  handlePointerMove(event) {
    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pickables, false);
    const next = intersects[0]?.object ?? null;

    if (next === this.hovered) {
      return;
    }

    if (this.hovered?.userData?.type === 'region') {
      this.onRegionHover?.(this.hovered, false);
    }

    if (this.hovered?.userData?.type === 'hotspot') {
      this.onHotspotHover?.(this.hovered, false);
    }

    this.hovered = next;

    if (next?.userData?.type === 'region') {
      this.onRegionHover?.(next, true);
    }

    if (next?.userData?.type === 'hotspot') {
      this.onHotspotHover?.(next, true, intersects[0]?.point);
    }
  }

  handlePointerLeave() {
    if (this.hovered?.userData?.type === 'region') {
      this.onRegionHover?.(this.hovered, false);
    }

    if (this.hovered?.userData?.type === 'hotspot') {
      this.onHotspotHover?.(this.hovered, false);
    }

    this.hovered = null;
  }

  handleClick(event) {
    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pickables, true);
    const target = intersects[0]?.object ?? null;
    const regionGroup = target?.parent?.userData?.type === 'region' ? target.parent : target?.userData?.type === 'region' ? target : null;
    if (regionGroup && regionGroup.userData?.region) {
      this.onRegionClick?.(regionGroup, regionGroup.userData.region);
    }
  }
}
