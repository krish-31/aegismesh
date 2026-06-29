import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 90;
const CONNECTION_DISTANCE = 140;
const MOUSE_RADIUS = 220;

class Particle {
  constructor(w, h) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.35;
    this.vy = (Math.random() - 0.5) * 0.35;
    this.radius = Math.random() * 1.8 + 0.6;
    this.opacity = Math.random() * 0.4 + 0.15;
    this.pulseSpeed = Math.random() * 0.02 + 0.005;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.isNode = Math.random() < 0.12;
    this.isViolet = Math.random() < 0.25; // some particles are violet accent
    if (this.isNode) {
      this.radius = Math.random() * 2 + 2.2;
      this.opacity = 0.55;
    }
  }

  update(w, h, time) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < -10) this.x = w + 10;
    if (this.x > w + 10) this.x = -10;
    if (this.y < -10) this.y = h + 10;
    if (this.y > h + 10) this.y = -10;
    this.currentOpacity = this.opacity + Math.sin(time * this.pulseSpeed + this.pulsePhase) * 0.12;
  }
}

export default function ParticleBackground({ className, style }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Particle(w, h));

    const handleMouse = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouse);

    let startTime = performance.now();

    const animate = (now) => {
      const time = (now - startTime) / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      particles.forEach(p => p.update(w, h, time));

      // Draw connections — cyan lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.12;
            const isVioletLine = particles[i].isViolet && particles[j].isViolet;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isVioletLine
              ? `rgba(139, 92, 246, ${opacity})`
              : `rgba(0, 212, 255, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Mouse connections — brighter cyan
      particles.forEach(p => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const opacity = (1 - dist / MOUSE_RADIUS) * 0.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      });

      // Draw particles
      particles.forEach(p => {
        const color = p.isViolet
          ? { r: 139, g: 92, b: 246 }   // violet
          : { r: 0, g: 212, b: 255 };    // cyan

        if (p.isNode) {
          // Glow halo
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
          grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.currentOpacity})`);
          grad.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.currentOpacity * 0.3})`);
          grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Bright core
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.min(color.r + 100, 255)}, ${Math.min(color.g + 100, 255)}, 255, ${p.currentOpacity + 0.25})`;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.currentOpacity})`;
          ctx.fill();
        }
      });

      // Slow-moving ambient glow orbs
      for (let i = 0; i < 3; i++) {
        const gx = w * (0.15 + 0.35 * i) + Math.sin(time * 0.2 + i * 2.5) * 100;
        const gy = h * (0.3 + 0.2 * i) + Math.cos(time * 0.15 + i * 1.8) * 80;
        const isVioletOrb = i === 1;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 300);
        const pulse = 0.025 + Math.sin(time * 0.4 + i) * 0.01;
        if (isVioletOrb) {
          grad.addColorStop(0, `rgba(139, 92, 246, ${pulse})`);
          grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        } else {
          grad.addColorStop(0, `rgba(0, 212, 255, ${pulse})`);
          grad.addColorStop(1, 'rgba(0, 212, 255, 0)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(gx - 300, gy - 300, 600, 600);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 'var(--particle-opacity, 1)',
        transition: 'opacity 0.35s ease',
        ...style,
      }}
    />
  );
}

