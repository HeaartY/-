export class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.particles = [];
    this.animationFrame = 0;
    this.lastTime = 0;
    this.pixelRatio = 1;
    this.width = 0;
    this.height = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.handleMotionChange = this.handleMotionChange.bind(this);
  }

  start() {
    this.reducedMotion.addEventListener('change', this.handleMotionChange);
    this.resize();
    this.lastTime = performance.now();
    this.animationFrame = window.requestAnimationFrame(this.tick.bind(this));
  }

  stop() {
    this.reducedMotion.removeEventListener('change', this.handleMotionChange);
    window.cancelAnimationFrame(this.animationFrame);
  }

  handleMotionChange() {
    this.seedParticles();
  }

  resize() {
    const { innerWidth, innerHeight, devicePixelRatio } = window;
    this.pixelRatio = Math.min(devicePixelRatio || 1, 2);
    this.width = innerWidth;
    this.height = innerHeight;

    this.canvas.width = Math.round(innerWidth * this.pixelRatio);
    this.canvas.height = Math.round(innerHeight * this.pixelRatio);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;

    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.seedParticles();
  }

  seedParticles() {
    const area = this.width * this.height;
    const reduced = this.reducedMotion.matches;
    const density = reduced ? 1 / 52000 : 1 / 32000;
    const count = Math.max(28, Math.round(area * density));

    this.particles = Array.from({ length: count }, (_, index) => {
      const layer = index % 3;
      return this.createParticle(layer);
    });
  }

  createParticle(layer) {
    const layerConfig = [
      { speed: 0.8, radius: [0.6, 1.4], alpha: [0.08, 0.18] },
      { speed: 1.25, radius: [1, 2.2], alpha: [0.12, 0.24] },
      { speed: 1.8, radius: [1.8, 3.4], alpha: [0.08, 0.16] },
    ][layer];

    return {
      layer,
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: this.randomBetween(...layerConfig.radius),
      alpha: this.randomBetween(...layerConfig.alpha),
      speedX: this.randomBetween(-0.12, 0.12) * layerConfig.speed,
      speedY: this.randomBetween(-0.2, -0.04) * layerConfig.speed,
      drift: this.randomBetween(0.2, 1.2),
      phase: Math.random() * Math.PI * 2,
    };
  }

  randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  tick(time) {
    const delta = Math.min((time - this.lastTime) / 16.6667, 2.2);
    this.lastTime = time;

    this.draw(delta, time);
    this.animationFrame = window.requestAnimationFrame(this.tick.bind(this));
  }

  draw(delta, time) {
    this.context.clearRect(0, 0, this.width, this.height);

    for (const particle of this.particles) {
      particle.x += particle.speedX * delta + Math.sin(time * 0.0002 + particle.phase) * 0.02 * particle.drift;
      particle.y += particle.speedY * delta;

      if (particle.y < -20) {
        particle.y = this.height + 20;
        particle.x = Math.random() * this.width;
      }

      if (particle.x < -20) particle.x = this.width + 20;
      if (particle.x > this.width + 20) particle.x = -20;

      const haloAlpha = particle.alpha * (particle.layer === 2 ? 0.55 : 0.3);
      const gradient = this.context.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.radius * (particle.layer === 2 ? 5 : 3)
      );
      gradient.addColorStop(0, `rgba(186, 224, 238, ${particle.alpha})`);
      gradient.addColorStop(0.4, `rgba(117, 178, 205, ${haloAlpha})`);
      gradient.addColorStop(1, 'rgba(20, 42, 67, 0)');

      this.context.fillStyle = gradient;
      this.context.beginPath();
      this.context.arc(particle.x, particle.y, particle.radius * (particle.layer === 2 ? 5 : 3), 0, Math.PI * 2);
      this.context.fill();

      this.context.fillStyle = `rgba(215, 238, 247, ${Math.min(particle.alpha + 0.1, 0.3)})`;
      this.context.beginPath();
      this.context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.context.fill();
    }
  }
}
