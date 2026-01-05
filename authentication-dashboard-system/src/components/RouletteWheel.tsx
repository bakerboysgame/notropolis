import { useState, useEffect, useRef } from 'react';

// European roulette wheel order (clockwise starting from 0)
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getNumberColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

interface RouletteWheelProps {
  result: number | null;
  spinning: boolean;
  onSpinComplete?: () => void;
}

export function RouletteWheel({ result, spinning, onSpinComplete }: RouletteWheelProps): JSX.Element {
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [ballDropped, setBallDropped] = useState(false);
  const spinStartTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  // Calculate angle for a given number on the wheel
  const getAngleForNumber = (num: number): number => {
    const index = WHEEL_NUMBERS.indexOf(num);
    const segmentAngle = 360 / 37;
    return index * segmentAngle;
  };

  useEffect(() => {
    if (spinning && result !== null) {
      // Start spin animation
      spinStartTimeRef.current = Date.now();
      setBallDropped(false);

      const targetAngle = getAngleForNumber(result);
      const spinDuration = 4000; // 4 seconds total
      const fullRotations = 5; // Number of full rotations

      // Calculate final positions
      const wheelFinalRotation = wheelRotation + 360 * fullRotations + (360 - targetAngle);
      const ballFinalRotation = ballRotation - 360 * (fullRotations + 2); // Ball spins opposite, more rotations

      const animate = () => {
        const elapsed = Date.now() - (spinStartTimeRef.current || 0);
        const progress = Math.min(elapsed / spinDuration, 1);

        // Easing function for realistic deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Update wheel rotation
        const currentWheelRotation = wheelRotation + (wheelFinalRotation - wheelRotation) * easeOut;
        setWheelRotation(currentWheelRotation);

        // Update ball rotation (opposite direction)
        const currentBallRotation = ballRotation + (ballFinalRotation - ballRotation) * easeOut;
        setBallRotation(currentBallRotation);

        // Drop ball into pocket near the end
        if (progress > 0.7 && !ballDropped) {
          setBallDropped(true);
        }

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          onSpinComplete?.();
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [spinning, result]);

  const segmentAngle = 360 / 37;

  return (
    <div className="relative w-72 h-72 mx-auto mb-6">
      {/* Outer rim */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-900 to-amber-950 shadow-2xl" />

      {/* Wheel */}
      <div
        className="absolute inset-2 rounded-full overflow-hidden transition-none"
        style={{ transform: `rotate(${wheelRotation}deg)` }}
      >
        {/* Number segments */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {WHEEL_NUMBERS.map((num, i) => {
            const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
            const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
            const x1 = 50 + 50 * Math.cos(startAngle);
            const y1 = 50 + 50 * Math.sin(startAngle);
            const x2 = 50 + 50 * Math.cos(endAngle);
            const y2 = 50 + 50 * Math.sin(endAngle);

            const color = getNumberColor(num);
            const fillColor = color === 'red' ? '#dc2626' : color === 'black' ? '#1f2937' : '#16a34a';

            // Calculate text position
            const midAngle = ((i + 0.5) * segmentAngle - 90) * (Math.PI / 180);
            const textX = 50 + 38 * Math.cos(midAngle);
            const textY = 50 + 38 * Math.sin(midAngle);
            const textRotation = (i + 0.5) * segmentAngle;

            return (
              <g key={num}>
                <path
                  d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                  fill={fillColor}
                  stroke="#d4a574"
                  strokeWidth="0.3"
                />
                <text
                  x={textX}
                  y={textY}
                  fill="white"
                  fontSize="4"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                >
                  {num}
                </text>
              </g>
            );
          })}

          {/* Center hub */}
          <circle cx="50" cy="50" r="12" fill="#2d1810" stroke="#d4a574" strokeWidth="1" />
          <circle cx="50" cy="50" r="8" fill="#1a0f0a" />

          {/* Decorative spokes */}
          {WHEEL_NUMBERS.map((_, i) => {
            const angle = (i * segmentAngle - 90) * (Math.PI / 180);
            const x1 = 50 + 12 * Math.cos(angle);
            const y1 = 50 + 12 * Math.sin(angle);
            const x2 = 50 + 25 * Math.cos(angle);
            const y2 = 50 + 25 * Math.sin(angle);
            return (
              <line
                key={`spoke-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#d4a574"
                strokeWidth="0.5"
              />
            );
          })}
        </svg>
      </div>

      {/* Ball track (outer ring) */}
      <div className="absolute inset-0 rounded-full border-4 border-amber-800/50 pointer-events-none" />

      {/* Ball */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ transform: `rotate(${-ballRotation}deg)` }}
      >
        <div
          className={`absolute w-4 h-4 bg-gradient-to-br from-gray-100 to-gray-400 rounded-full shadow-lg transition-all duration-300 ${
            ballDropped ? 'opacity-100' : 'opacity-100'
          }`}
          style={{
            left: '50%',
            top: ballDropped ? '18%' : '6%',
            transform: 'translateX(-50%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.8)'
          }}
        />
      </div>

      {/* Ball marker/pointer at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-yellow-500 drop-shadow-lg" />
      </div>
    </div>
  );
}

export default RouletteWheel;
