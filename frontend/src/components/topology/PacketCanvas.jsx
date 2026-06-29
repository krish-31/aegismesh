/**
 * PacketCanvas — High-performance canvas overlay for animated packet flow
 *
 * Renders tiny glowing particles that travel along active Cytoscape edges.
 * Uses requestAnimationFrame for smooth 60fps without React rerenders.
 * Automatically pauses packets on inactive/failed edges.
 */

import { useEffect, useRef } from 'react';
import useMeshStore from '../../store/meshStore';
import { useTheme } from '../../lib/ThemeContext';

const PACKET_POOL_SIZE = 40;     // max concurrent packets
const SPAWN_INTERVAL   = 180;    // ms between spawns
const BASE_SPEED       = 0.004;  // progress per frame (0→1)
const TRAIL_LENGTH     = 3;      // number of trail dots

export default function PacketCanvas({ cyRef }) {
  const canvasRef  = useRef(null);
  const packetsRef = useRef([]);
  const frameRef   = useRef(0);
  const lastSpawn  = useRef(0);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.clientWidth  * window.devicePixelRatio;
      canvas.height = parent.clientHeight * window.devicePixelRatio;
      canvas.style.width  = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn a packet on a random active edge
    const spawnPacket = () => {
      const cy = cyRef.current;
      if (!cy) return;

      const activeEdges = cy.edges().filter(e => {
        const s = e.style('line-style');
        return s !== 'dashed' && e.style('opacity') > 0.3;
      });
      if (activeEdges.length === 0) return;

      const edge = activeEdges[Math.floor(Math.random() * activeEdges.length)];
      const srcPos = edge.source().renderedPosition();
      const tgtPos = edge.target().renderedPosition();

      // Determine color based on edge class
      let color = isDark ? { r: 0, g: 245, b: 255 } : { r: 8, g: 145, b: 178 }; // cyan
      if (edge.hasClass('path-highlighted'))     color = isDark ? { r: 57, g: 255, b: 20 } : { r: 5, g: 150, b: 105 };  // green
      if (edge.hasClass('failover-highlight'))   color = isDark ? { r: 191, g: 90, b: 242 } : { r: 124, g: 58, b: 237 }; // purple

      // Determine speed based on edge weight (latency) — lighter = faster
      const weight   = edge.data('weight') || 10;
      const speed    = BASE_SPEED * Math.max(0.5, Math.min(2.5, 30 / weight));
      const reverse  = Math.random() > 0.5;

      if (packetsRef.current.length < PACKET_POOL_SIZE) {
        packetsRef.current.push({
          sx: srcPos.x, sy: srcPos.y,
          tx: tgtPos.x, ty: tgtPos.y,
          progress: 0,
          speed,
          color,
          size: 1.8 + Math.random() * 1.2,
          reverse,
        });
      }
    };

    // Animation loop
    const draw = (ts) => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);

      // Spawn new packets
      if (ts - lastSpawn.current > SPAWN_INTERVAL) {
        spawnPacket();
        if (Math.random() > 0.5) spawnPacket(); // burst
        lastSpawn.current = ts;
      }

      const alive = [];
      packetsRef.current.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) return; // remove

        const t  = p.reverse ? 1 - p.progress : p.progress;
        const x  = p.sx + (p.tx - p.sx) * t;
        const y  = p.sy + (p.ty - p.sy) * t;
        const { r, g, b } = p.color;

        // Trail
        for (let i = TRAIL_LENGTH; i >= 1; i--) {
          const tt    = p.reverse ? 1 - (p.progress - i * 0.015) : p.progress - i * 0.015;
          if (tt < 0 || tt > 1) continue;
          const tx2   = p.sx + (p.tx - p.sx) * tt;
          const ty2   = p.sy + (p.ty - p.sy) * tt;
          const alpha = (1 - i / (TRAIL_LENGTH + 1)) * 0.3;
          ctx.beginPath();
          ctx.arc(tx2, ty2, p.size * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fill();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, p.size * 2.5, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, p.size * 2.5);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fill();

        alive.push(p);
      });
      packetsRef.current = alive;

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [cyRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        borderRadius: 12,
      }}
    />
  );
}
