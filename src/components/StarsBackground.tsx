import React, { useMemo } from 'react';

const generateStars = (count: number) => {
  const shadows = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 200); // 0 to 200vw
    const y = Math.floor(Math.random() * 300); // 0 to 300vh
    shadows.push(`${x}vw ${y}vh #fff`);
  }
  return shadows.join(', ');
};

const StarsBackground: React.FC = () => {
  const stars1 = useMemo(() => generateStars(800), []);
  const stars2 = useMemo(() => generateStars(300), []);
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
            to { transform: translateY(-150vh); }
          }
          
          .star-layer-1 {
            position: absolute;
            top: 0; left: 0;
            width: 1px;
            height: 1px;
            background: transparent;
            box-shadow: ${stars1};
            animation: animStar 70s linear infinite;
          }
          .star-layer-1:after {
            content: " ";
            position: absolute;
            top: 150vh;
            left: 0;
            width: 1px;
            height: 1px;
            background: transparent;
            box-shadow: ${stars1};
          }
          .star-layer-2 {
            position: absolute;
            top: 0; left: 0;
            width: 2px;
            height: 2px;
            background: transparent;
            box-shadow: ${stars2};
            animation: animStar 140s linear infinite;
          }
          .star-layer-2:after {
            content: " ";
            position: absolute;
            top: 150vh;
            left: 0;
            width: 2px;
            height: 2px;
            background: transparent;
            box-shadow: ${stars2};
          }
          .star-layer-3 {
            position: absolute;
            top: 0; left: 0;
            width: 3px;
            height: 3px;
            background: transparent;
            box-shadow: ${stars3};
            animation: animStar 200s linear infinite;
          }
          .star-layer-3:after {
            content: " ";
            position: absolute;
            top: 150vh;
            left: 0;
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
