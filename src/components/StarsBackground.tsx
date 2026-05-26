import React, { useEffect, useRef } from 'react';

const StarsBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale for high DPI displays but cap at 1.5 to save performance 
    // since blurred stars don't need crystal clear retina rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    
    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    interface Star {
       x: number;
       y: number;
       size: number;
       speed: number;
       alpha: number;
    }
    
    const stars: Star[] = [];
    
    // Layer 1
    for(let i = 0; i < 800; i++) {
        stars.push({ x: Math.random() * width, y: Math.random() * height, size: 1, speed: 0.3, alpha: 0.6 });
    }
    // Layer 2
    for(let i = 0; i < 300; i++) {
        stars.push({ x: Math.random() * width, y: Math.random() * height, size: 2, speed: 0.15, alpha: 0.8 });
    }
    // Layer 3
    for(let i = 0; i < 100; i++) {
        stars.push({ x: Math.random() * width, y: Math.random() * height, size: 3, speed: 0.08, alpha: 1.0 });
    }
    
    const draw = () => {
       ctx.clearRect(0, 0, width, height);
       ctx.fillStyle = '#ffffff';
       
       for(let i = 0; i < stars.length; i++) {
           const star = stars[i];
           star.y -= star.speed;
           
           if (star.y < -star.size) {
               star.y = height + star.size;
               star.x = Math.random() * width;
           }
           
           ctx.globalAlpha = star.alpha;
           ctx.fillRect(star.x, star.y, star.size, star.size);
       }
       
       ctx.globalAlpha = 1.0;
       animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    
    const handleResize = () => {
       width = window.innerWidth;
       height = window.innerHeight;
       canvas.width = width * dpr;
       canvas.height = height * dpr;
       ctx.scale(dpr, dpr);
       
       // Reposition stars that fall out of new bounds
       for (let i = 0; i < stars.length; i++) {
           if (stars[i].x > width) stars[i].x = Math.random() * width;
           if (stars[i].y > height) stars[i].y = Math.random() * height;
       }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
       cancelAnimationFrame(animationFrameId);
       window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[-2] pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at bottom, #321b35 0%, #090a0f 100%)' }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ display: 'block', width: '100vw', height: '100vh' }}
      />
    </div>
  );
};

export default StarsBackground;
