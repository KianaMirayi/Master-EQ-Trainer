import React, { useMemo } from 'react';

const generateStars = (count: number) => {
  const shadows = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 2000);
    const y = Math.floor(Math.random() * 2000);
    shadows.push(`${x}px ${y}px #fff`);
  }
  return shadows.join(', ');
};

const StarsBackground: React.FC = () => {
  const stars1 = useMemo(() => generateStars(700), []);
  const stars2 = useMemo(() => generateStars(200), []);
  const stars3 = useMemo(() => generateStars(100), []);

  return (
    <div 
      className="fixed inset-0 z-[-2] overflow-hidden pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at bottom, #321b35 0%, #090a0f 100%)' }}
    >
      <style>
        {`
          @keyframes animStar {
            from { transform: translateY(0px); }
            to { transform: translateY(-2000px); }
          }
          
          .star-layer-1 {
            width: 1px;
            height: 1px;
            background: transparent;
            box-shadow: ${stars1};
            animation: animStar 50s linear infinite;
          }
          .star-layer-1:after {
            content: " ";
            position: absolute;
            top: 2000px;
            width: 1px;
            height: 1px;
            background: transparent;
            box-shadow: ${stars1};
          }

          .star-layer-2 {
            width: 2px;
            height: 2px;
            background: transparent;
            box-shadow: ${stars2};
            animation: animStar 100s linear infinite;
          }
          .star-layer-2:after {
            content: " ";
            position: absolute;
            top: 2000px;
            width: 2px;
            height: 2px;
            background: transparent;
            box-shadow: ${stars2};
          }

          .star-layer-3 {
            width: 3px;
            height: 3px;
            background: transparent;
            box-shadow: ${stars3};
            animation: animStar 150s linear infinite;
          }
          .star-layer-3:after {
            content: " ";
            position: absolute;
            top: 2000px;
            width: 3px;
            height: 3px;
            background: transparent;
            box-shadow: ${stars3};
          }
        `}
      </style>
      <div className="star-layer-1" />
      <div className="star-layer-2" />
      <div className="star-layer-3" />
    </div>
  );
};

export default StarsBackground;
