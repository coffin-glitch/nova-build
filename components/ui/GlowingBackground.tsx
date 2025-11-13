"use client";

import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  radius: number;
  baseRadius: number;
  vx: number;
  vy: number;
  alpha: number;
  targetAlpha: number;
  color: string;
  pulseSpeed: number;
  pulsePhase: number;
  glowIntensity: number;
  glowCycleDuration?: number;
  glowStartTime?: number;
  shape?: 'circle' | 'diamond' | 'star';
  maxGlow?: number; // Maximum glow intensity for this star
  fadeOutStart?: number; // When fade out begins
  fadeOutDuration?: number; // Duration of fade out
  isFadingOut?: boolean; // Whether currently fading out
  nextX?: number; // Next position after fade out
  nextY?: number; // Next position after fade out
}

interface GlowingBackgroundProps {
  className?: string;
  enabled?: boolean;
}

export function GlowingBackground({ className = "", enabled = true }: GlowingBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);
  const { theme } = useTheme();
  const { accentColor } = useAccentColor();
  const [mounted, setMounted] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const ripplesRef = useRef<Array<{ x: number; y: number; radius: number; alpha: number; maxRadius: number; speed: number }>>([]);
  const shootingStarsRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    length: number;
    alpha: number;
    trail: Array<{ x: number; y: number; alpha: number }>;
    life: number;
    maxLife: number;
  }>>([]);
  const lastShootingStarRef = useRef(0);

  // Extract HSL values from accent color
  const getAccentHSL = () => {
    // Parse HSL string like "hsl(221, 83%, 53%)"
    const match = accentColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      return {
        h: parseInt(match[1]),
        s: parseInt(match[2]),
        l: parseInt(match[3]),
      };
    }
    return { h: 221, s: 83, l: 53 }; // Default blue
  };

  const accentHSL = getAccentHSL();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reinitialize particles on resize
      initParticles();
    };

    const initParticles = () => {
      const particles: Particle[] = [];
      // More subtle particle count - fewer particles for better performance and subtlety
      const particleCount = Math.floor((canvas.width * canvas.height) / 20000); // Adaptive count
      
      const isDark = theme === "dark";
      
      for (let i = 0; i < particleCount; i++) {
        const baseRadius = Math.random() * 1.5 + 0.3; // Smaller particles
        // Each star has a unique pulse speed - some faster, some slower
        const pulseSpeed = Math.random() * 0.015 + 0.003; // Slower, smoother pulse
        const pulsePhase = Math.random() * Math.PI * 2; // Random starting phase
        // Each star has a unique glow cycle duration (in milliseconds) - longer for smoother transitions
        const glowCycleDuration = Math.random() * 4000 + 3000; // 3-7 seconds per cycle for smoother transitions
        
        // Determine shape - mix of circles, diamonds, and stars
        const shapeRand = Math.random();
        let shape: 'circle' | 'diamond' | 'star' = 'circle';
        if (shapeRand < 0.3) {
          shape = 'diamond';
        } else if (shapeRand < 0.5) {
          shape = 'star';
        }
        
        // Some stars have enhanced glow
        const isBrightStar = Math.random() < 0.25; // 25% of stars are brighter
        const maxGlow = isBrightStar ? Math.random() * 0.3 + 0.7 : Math.random() * 0.2 + 0.4; // 0.4-0.6 normal, 0.7-1.0 bright
        
        // Create color variations based on accent color and theme
        const hueVariation = (Math.random() - 0.5) * 25; // ±12.5 degrees
        const saturationVariation = isDark ? Math.random() * 15 + 50 : Math.random() * 12 + 35;
        const lightnessVariation = isDark 
          ? Math.random() * 15 + 45  // Brighter in dark mode
          : Math.random() * 12 + 25;  // Darker in light mode
        
        const h = (accentHSL.h + hueVariation + 360) % 360;
        const s = Math.min(100, Math.max(0, saturationVariation));
        const l = Math.min(100, Math.max(0, lightnessVariation));
        
        // Mix with some blue/cyan for supernova effect
        const mixRatio = Math.random() * 0.25;
        const finalH = isDark 
          ? h * (1 - mixRatio) + 200 * mixRatio  // Mix with blue
          : h * (1 - mixRatio) + 220 * mixRatio;
        
        // Initial alpha - each star starts at a different point in its cycle
        const initialAlphaPhase = Math.random() * Math.PI * 2;
        const initialAlpha = (Math.sin(initialAlphaPhase) * 0.3 + 0.7) * 0.5; // More visible initial
        
        // Make diamonds bigger
        const sizeMultiplier = shape === 'diamond' ? 1.6 : 1.0;
        const adjustedBaseRadius = baseRadius * sizeMultiplier;
        
        // Random fade out timing - stars will fade out and reappear at different intervals
        const fadeOutInterval = Math.random() * 15000 + 10000; // 10-25 seconds between fade cycles
        
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: adjustedBaseRadius,
          baseRadius: adjustedBaseRadius,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          alpha: initialAlpha,
          targetAlpha: Math.random() * 0.4 + 0.2,
          color: `hsl(${finalH}, ${s}%, ${l}%)`,
          pulseSpeed,
          pulsePhase,
          glowIntensity: Math.random() * 0.5 + 0.5, // More pronounced glow
          glowCycleDuration, // Store the cycle duration
          glowStartTime: Date.now() + Math.random() * glowCycleDuration, // Stagger start times
          shape,
          maxGlow,
          fadeOutStart: Date.now() + fadeOutInterval, // When to start fading out
          fadeOutDuration: 2000 + Math.random() * 1000, // 2-3 second fade out
          isFadingOut: false,
        } as Particle & { glowCycleDuration: number; glowStartTime: number });
      }
      
      particlesRef.current = particles;
    };

    // Helper function to convert HSL to RGBA
    const hslToRgba = (hslString: string, alpha: number): string => {
      const match = hslString.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
      if (!match) return `rgba(128, 128, 128, ${alpha})`;
      
      const h = parseFloat(match[1]) / 360;
      const s = parseFloat(match[2]) / 100;
      const l = parseFloat(match[3]) / 100;
      
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
    };

    const drawParticle = (particle: Particle, ctx: CanvasRenderingContext2D) => {
      const { x, y, radius, alpha, color, glowIntensity, shape = 'circle', maxGlow = 0.5 } = particle;
      
      // Enhanced glow for brighter stars - more pronounced
      const effectiveGlow = glowIntensity * maxGlow;
      const glowRadius = radius * (4 + effectiveGlow * 3); // Larger, more visible glow
      
      // Create gradient for glow effect - smoother falloff with more color stops
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      gradient.addColorStop(0, hslToRgba(color, alpha));
      gradient.addColorStop(0.2, hslToRgba(color, alpha * effectiveGlow * 0.8));
      gradient.addColorStop(0.4, hslToRgba(color, alpha * effectiveGlow * 0.5));
      gradient.addColorStop(0.6, hslToRgba(color, alpha * effectiveGlow * 0.3));
      gradient.addColorStop(0.8, hslToRgba(color, alpha * effectiveGlow * 0.15));
      gradient.addColorStop(1, hslToRgba(color, 0));
      
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw the actual shape
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = hslToRgba(color, alpha);
      
      if (shape === 'diamond') {
        // Draw diamond shape - bigger and more visible
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius * 0.85, 0); // Wider diamonds
        ctx.lineTo(0, radius);
        ctx.lineTo(-radius * 0.85, 0);
        ctx.closePath();
        ctx.fill();
      } else if (shape === 'star') {
        // Draw star shape (5-pointed)
        const spikes = 5;
        const outerRadius = radius;
        const innerRadius = radius * 0.4;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw circle
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    };

    const animate = () => {
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const isDark = theme === "dark";
      const time = Date.now() * 0.001;
      
      // Smooth easing functions
      const easeInOutCubic = (t: number) => {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      
      const easeInOutQuad = (t: number) => {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      };
      
      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        const currentTime = Date.now();
        
        // Handle fade out and reposition cycle for realistic movement
        if (particle.fadeOutStart && currentTime >= particle.fadeOutStart) {
          if (!particle.isFadingOut) {
            // Start fade out
            particle.isFadingOut = true;
            // Choose new random position
            particle.nextX = Math.random() * canvas.width;
            particle.nextY = Math.random() * canvas.height;
          }
          
          const fadeOutProgress = Math.min(1, (currentTime - particle.fadeOutStart) / (particle.fadeOutDuration || 2000));
          
          if (fadeOutProgress < 1) {
            // Fading out - smoothly reduce alpha to 0
            const fadeOutAlpha = 1 - easeInOutQuad(fadeOutProgress);
            if (particle.glowCycleDuration && particle.glowStartTime !== undefined) {
              // Override glow cycle alpha during fade out
              const minAlpha = 0.15;
              const maxAlpha = particle.maxGlow ? 0.6 + (particle.maxGlow - 0.4) * 0.4 : 0.6;
              const baseAlpha = minAlpha + (maxAlpha - minAlpha) * 0.5; // Use mid-range
              particle.alpha = baseAlpha * fadeOutAlpha;
            } else {
              particle.alpha *= fadeOutAlpha;
            }
            // Continue gentle movement during fade out
            particle.x += particle.vx * 0.5; // Slow down during fade
            particle.y += particle.vy * 0.5;
          } else {
            // Fade out complete - move to new position and start fading in
            particle.x = particle.nextX || Math.random() * canvas.width;
            particle.y = particle.nextY || Math.random() * canvas.height;
            particle.isFadingOut = false;
            // Reset fade out timer for next cycle
            const fadeOutInterval = Math.random() * 15000 + 10000;
            particle.fadeOutStart = currentTime + fadeOutInterval;
            particle.alpha = 0; // Start invisible
          }
        } else if (particle.isFadingOut && particle.fadeOutStart) {
          // Fading in after reposition
          const fadeInStart = (particle.fadeOutStart || 0) + (particle.fadeOutDuration || 2000);
          const fadeInProgress = Math.min(1, (currentTime - fadeInStart) / 1500); // 1.5 second fade in
          
          if (fadeInProgress < 1) {
            const fadeInAlpha = easeInOutQuad(fadeInProgress);
            if (particle.glowCycleDuration && particle.glowStartTime !== undefined) {
              const minAlpha = 0.15;
              const maxAlpha = particle.maxGlow ? 0.6 + (particle.maxGlow - 0.4) * 0.4 : 0.6;
              const baseAlpha = minAlpha + (maxAlpha - minAlpha) * 0.5;
              particle.alpha = baseAlpha * fadeInAlpha;
            } else {
              particle.alpha = 0.3 * fadeInAlpha;
            }
          } else {
            // Fade in complete
            particle.isFadingOut = false;
          }
        } else {
          // Normal movement and glow cycle
          // Gentle drift
          particle.x += particle.vx;
          particle.y += particle.vy;
          
          // Smooth edge fading - fade out near edges instead of instant wrap
          const edgeThreshold = 80; // Distance from edge to start fading
          let edgeFade = 1;
          
          if (particle.x < edgeThreshold) {
            edgeFade = Math.min(edgeFade, Math.max(0, particle.x / edgeThreshold));
          } else if (particle.x > canvas.width - edgeThreshold) {
            edgeFade = Math.min(edgeFade, Math.max(0, (canvas.width - particle.x) / edgeThreshold));
          }
          
          if (particle.y < edgeThreshold) {
            edgeFade = Math.min(edgeFade, Math.max(0, particle.y / edgeThreshold));
          } else if (particle.y > canvas.height - edgeThreshold) {
            edgeFade = Math.min(edgeFade, Math.max(0, (canvas.height - particle.y) / edgeThreshold));
          }
          
          // Only wrap if completely off screen (with smooth fade)
          if (particle.x < -20 || particle.x > canvas.width + 20) {
            particle.x = particle.x < 0 ? canvas.width : 0;
          }
          if (particle.y < -20 || particle.y > canvas.height + 20) {
            particle.y = particle.y < 0 ? canvas.height : 0;
          }
          
          // Pulsing animation for radius
          const pulse = Math.sin(time * particle.pulseSpeed + particle.pulsePhase) * 0.3 + 0.7;
          particle.radius = particle.baseRadius * pulse;
          
          // Enhanced glow cycle - each star glows bright then fades at different intervals
          if (particle.glowCycleDuration && particle.glowStartTime !== undefined) {
            const cycleTime = (currentTime - particle.glowStartTime) % particle.glowCycleDuration;
            const cycleProgress = cycleTime / particle.glowCycleDuration;
            
            // Create a smooth sine wave for the glow: bright peak then fade
            const glowPhase = cycleProgress * Math.PI * 2;
            // Use smoother curve with easing
            const rawGlow = (Math.sin(glowPhase) + 1) / 2;
            const glowIntensity = easeInOutCubic(rawGlow);
            
            // More visible alpha range - min 0.15, max varies by star type
            const minAlpha = 0.15;
            const maxAlpha = particle.maxGlow ? 0.6 + (particle.maxGlow - 0.4) * 0.4 : 0.6;
            const baseAlpha = minAlpha + glowIntensity * (maxAlpha - minAlpha);
            particle.alpha = baseAlpha * edgeFade; // Apply edge fade
            
            // More pronounced radius enhancement during glow
            const radiusBoost = 1 + glowIntensity * 0.5; // Increased for more visibility
            particle.radius = particle.baseRadius * pulse * radiusBoost;
          } else {
            // Fallback for particles without glow cycle (shouldn't happen, but safety)
            const fadeSpeed = 0.001; // Slower for smoother transitions
            if (Math.abs(particle.alpha - particle.targetAlpha) < 0.01) {
              particle.targetAlpha = Math.random() * 0.3 + 0.15;
            }
            particle.alpha = (particle.alpha + (particle.targetAlpha - particle.alpha) * fadeSpeed) * edgeFade;
          }
        }
        
        // Mouse interaction
        if (mouseRef.current.active) {
          const dx = particle.x - mouseRef.current.x;
          const dy = particle.y - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 150;
          
          if (distance < maxDistance) {
            const influence = 1 - (distance / maxDistance);
            particle.alpha = Math.min(1, particle.alpha + influence * 0.3);
            particle.radius = particle.baseRadius * (1 + influence * 0.5);
            
            // Gentle pull toward mouse
            particle.vx += (dx / distance) * influence * 0.01;
            particle.vy += (dy / distance) * influence * 0.01;
          }
        }
        
        // Apply velocity damping
        particle.vx *= 0.99;
        particle.vy *= 0.99;
        
        drawParticle(particle, ctx);
      });
      
      // Update and draw shooting stars
      if (enabled) {
        const currentTime = Date.now();
        // Spawn new shooting star occasionally (every 3-8 seconds)
        if (currentTime - lastShootingStarRef.current > (3000 + Math.random() * 5000)) {
          const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
          let startX = 0, startY = 0, vx = 0, vy = 0;
          
          // Random angle for the shooting star (diagonal movement)
          const angle = (Math.random() * Math.PI * 0.5) + (Math.PI * 0.25); // 45-135 degrees
          const speed = 2 + Math.random() * 2; // 2-4 pixels per frame
          
          switch (side) {
            case 0: // Top
              startX = Math.random() * canvas.width;
              startY = -20;
              vx = Math.cos(angle) * speed;
              vy = Math.sin(angle) * speed;
              break;
            case 1: // Right
              startX = canvas.width + 20;
              startY = Math.random() * canvas.height;
              vx = -Math.cos(angle) * speed;
              vy = Math.sin(angle) * speed;
              break;
            case 2: // Bottom
              startX = Math.random() * canvas.width;
              startY = canvas.height + 20;
              vx = Math.cos(angle) * speed;
              vy = -Math.sin(angle) * speed;
              break;
            case 3: // Left
              startX = -20;
              startY = Math.random() * canvas.height;
              vx = Math.cos(angle) * speed;
              vy = Math.sin(angle) * speed;
              break;
          }
          
          shootingStarsRef.current.push({
            x: startX,
            y: startY,
            vx,
            vy,
            length: 30 + Math.random() * 40, // Trail length
            alpha: 1,
            trail: [],
            life: 0,
            maxLife: 200 + Math.random() * 100, // How long it lives
          });
          
          lastShootingStarRef.current = currentTime;
        }
        
        // Update shooting stars
        shootingStarsRef.current = shootingStarsRef.current.filter((star) => {
          star.x += star.vx;
          star.y += star.vy;
          star.life++;
          
          // Add point to trail
          star.trail.push({ x: star.x, y: star.y, alpha: 1 });
          if (star.trail.length > star.length) {
            star.trail.shift();
          }
          
          // Fade out trail points
          star.trail.forEach((point, index) => {
            point.alpha = index / star.trail.length;
          });
          
          // Fade out as it ages
          star.alpha = 1 - (star.life / star.maxLife);
          
          // Draw shooting star with trail
          if (star.trail.length > 1) {
            ctx.strokeStyle = hslToRgba(
              isDark 
                ? `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.min(90, accentHSL.l + 30)}%)`
                : `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.max(10, accentHSL.l - 20)}%)`,
              star.alpha * 0.8
            );
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            
            for (let i = 0; i < star.trail.length - 1; i++) {
              const point = star.trail[i];
              const nextPoint = star.trail[i + 1];
              const trailAlpha = point.alpha * star.alpha;
              
              ctx.strokeStyle = hslToRgba(
                isDark 
                  ? `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.min(90, accentHSL.l + 30)}%)`
                  : `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.max(10, accentHSL.l - 20)}%)`,
                trailAlpha
              );
              
              ctx.beginPath();
              ctx.moveTo(point.x, point.y);
              ctx.lineTo(nextPoint.x, nextPoint.y);
              ctx.stroke();
            }
            
            // Draw bright head
            const head = star.trail[star.trail.length - 1];
            if (head) {
              const gradient = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 4);
              gradient.addColorStop(0, hslToRgba(
                isDark 
                  ? `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.min(95, accentHSL.l + 40)}%)`
                  : `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.max(5, accentHSL.l - 30)}%)`,
                star.alpha
              ));
              gradient.addColorStop(1, hslToRgba(
                isDark 
                  ? `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.min(95, accentHSL.l + 40)}%)`
                  : `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.max(5, accentHSL.l - 30)}%)`,
                0
              ));
              
              ctx.beginPath();
              ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
              ctx.fillStyle = gradient;
              ctx.fill();
            }
          }
          
          // Remove if off screen or faded out
          return star.life < star.maxLife && 
                 star.x > -50 && star.x < canvas.width + 50 &&
                 star.y > -50 && star.y < canvas.height + 50;
        });
      }
      
      // Draw multiple ripple effects on click - like water ripples
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        const rippleColorHsl = isDark 
          ? `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.min(90, accentHSL.l + 20)}%)`
          : `hsl(${accentHSL.h}, ${accentHSL.s}%, ${Math.max(10, accentHSL.l - 20)}%)`;
        
        // Calculate fade based on progress
        const progress = ripple.radius / ripple.maxRadius;
        const fadeProgress = Math.min(1, progress * 1.2); // Start fading earlier
        const currentAlpha = ripple.alpha * (1 - fadeProgress);
        
        // Create multiple gradient stops for smoother water-like effect
        const gradient = ctx.createRadialGradient(
          ripple.x, ripple.y, ripple.radius * 0.3,
          ripple.x, ripple.y, ripple.radius
        );
        
        // More gradient stops for smoother water ripple effect
        gradient.addColorStop(0, hslToRgba(rippleColorHsl, currentAlpha * 0.8));
        gradient.addColorStop(0.2, hslToRgba(rippleColorHsl, currentAlpha * 0.6));
        gradient.addColorStop(0.4, hslToRgba(rippleColorHsl, currentAlpha * 0.4));
        gradient.addColorStop(0.6, hslToRgba(rippleColorHsl, currentAlpha * 0.25));
        gradient.addColorStop(0.8, hslToRgba(rippleColorHsl, currentAlpha * 0.1));
        gradient.addColorStop(1, hslToRgba(rippleColorHsl, 0));
        
        // Draw outer ring
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.strokeStyle = hslToRgba(rippleColorHsl, currentAlpha * 0.3);
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw filled gradient
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Expand ripple
        ripple.radius += ripple.speed;
        ripple.speed *= 0.98; // Gradually slow down for more realistic effect
        
        // Remove if fully expanded or faded
        return ripple.radius < ripple.maxRadius && currentAlpha > 0.01;
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleClick = (e: MouseEvent) => {
      // Only create ripples if enabled
      if (!enabled) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Create multiple ripples for water-like effect
      const rippleCount = 3; // Number of expanding ripples
      for (let i = 0; i < rippleCount; i++) {
        const delay = i * 0.3; // Stagger the ripples
        setTimeout(() => {
          ripplesRef.current.push({
            x,
            y,
            radius: 0,
            alpha: 0.5 - (i * 0.1), // Each ripple slightly less intense
            maxRadius: 0.52 + (i * 0.13), // Each ripple goes further (50% smaller again)
            speed: 3 + (i * 0.4), // Each ripple slightly faster (reduced speed)
          });
        }, delay * 100);
      }
    };

    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.x = touch.clientX - rect.left;
        mouseRef.current.y = touch.clientY - rect.top;
        mouseRef.current.active = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      mouseRef.current.active = false;
      // Only create ripples if enabled
      if (!enabled) return;
      
      // Create ripple on touch end
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Create multiple ripples for water-like effect
        const rippleCount = 3;
        for (let i = 0; i < rippleCount; i++) {
          const delay = i * 0.3;
          setTimeout(() => {
            ripplesRef.current.push({
              x,
              y,
              radius: 0,
              alpha: 0.5 - (i * 0.1),
              maxRadius: 200 + (i * 50),
              speed: 4 + (i * 0.5),
            });
          }, delay * 100);
        }
      }
    };

    // Global click handler to capture clicks anywhere on the page
    const handleGlobalClick = (e: MouseEvent) => {
      // Only create ripples if enabled
      if (!enabled) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Create multiple ripples for water-like effect
      const rippleCount = 3;
      for (let i = 0; i < rippleCount; i++) {
        const delay = i * 0.3;
        setTimeout(() => {
          ripplesRef.current.push({
            x,
            y,
            radius: 0,
            alpha: 0.5 - (i * 0.1),
            maxRadius: 200 + (i * 50),
            speed: 4 + (i * 0.5),
          });
        }, delay * 100);
      }
    };

    resizeCanvas();
    animate();

    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    if (enabled) {
      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchend", handleTouchEnd);
      // Add global click listener for interactivity
      document.addEventListener("click", handleGlobalClick);
    }
    canvas.addEventListener("touchmove", handleTouch);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      if (enabled) {
        canvas.removeEventListener("click", handleClick);
        canvas.removeEventListener("touchend", handleTouchEnd);
        document.removeEventListener("click", handleGlobalClick);
      }
      canvas.removeEventListener("touchmove", handleTouch);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mounted, theme, accentColor, accentHSL, enabled]);

  if (!mounted) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  );
}

