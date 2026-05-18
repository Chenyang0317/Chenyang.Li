import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';

export function InteractiveDots() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth the mouse movement
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Number of crosses in grid
  const columns = 36;
  const rows = 18;

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none opacity-60"
      style={{ zIndex: 0 }}
    >
      <div 
        className="flex flex-wrap gap-[40px] p-10 justify-center content-center h-full w-full"
      >
        {Array.from({ length: columns * rows }).map((_, i) => (
          <Cross 
            key={i} 
            mouseX={smoothX} 
            mouseY={smoothY} 
          />
        ))}
      </div>
    </div>
  );
}

function Cross({ mouseX, mouseY }: { 
  mouseX: any; 
  mouseY: any; 
}) {
  const crossRef = useRef<HTMLDivElement>(null);
  
  // Use useMotionValue for reactive properties without re-renders
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0.25);
  const color = useMotionValue('#93c5fd'); // blue-300 (Initial light blue)

  useEffect(() => {
    const unsubscribe = mouseX.on("change", (latestX: number) => {
      const latestY = mouseY.get();
      if (crossRef.current) {
        const rect = crossRef.current.getBoundingClientRect();
        const containerRect = crossRef.current.parentElement?.getBoundingClientRect();
        
        if (containerRect) {
          const dx = latestX - (rect.left - containerRect.left);
          const dy = latestY - (rect.top - containerRect.top);
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Sensitivity threshold
          const threshold = 160;
          
          if (distance < threshold) {
            const factor = 1 - distance / threshold;
            scale.set(1 + 0.4 * factor); 
            opacity.set(0.25 + 0.75 * factor); 
            color.set('#2563eb'); // blue-600 (Bright blue when close)
          } else {
            scale.set(1);
            opacity.set(0.25);
            color.set('#93c5fd'); 
          }
        }
      }
    });
    return () => unsubscribe();
  }, [mouseX, mouseY, scale, opacity, color]);

  return (
    <motion.div
      ref={crossRef}
      style={{
        scale,
        opacity,
        color,
      }}
      className="relative w-2 h-2 flex items-center justify-center shrink-0"
    >
      <div className="absolute w-[1px] h-full bg-current rounded-full" />
      <div className="absolute h-[1px] w-full bg-current rounded-full" />
    </motion.div>
  );
}
