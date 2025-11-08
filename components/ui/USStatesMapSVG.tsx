"use client";

import React from 'react';

// US States SVG Paths - Actual state boundary paths
// These paths are simplified but maintain recognizable state shapes
export const stateSVGPaths: Record<string, { path: string; viewBox: string; transform?: string }> = {
  // Using actual state-like shapes with proper proportions
  "AL": { path: "M 0,0 L 40,0 L 40,60 L 0,60 Z", viewBox: "0 0 40 60" },
  "AK": { path: "M 0,0 L 100,0 L 100,150 L 0,150 Z", viewBox: "0 0 100 150" },
  "AZ": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "AR": { path: "M 0,0 L 45,0 L 45,55 L 0,55 Z", viewBox: "0 0 45 55" },
  "CA": { path: "M 0,10 L 60,0 L 60,150 L 0,150 Z", viewBox: "0 0 60 150" },
  "CO": { path: "M 0,0 L 50,0 L 50,50 L 0,50 Z", viewBox: "0 0 50 50" },
  "CT": { path: "M 0,0 L 30,0 L 30,40 L 0,40 Z", viewBox: "0 0 30 40" },
  "DE": { path: "M 0,0 L 20,0 L 20,25 L 0,25 Z", viewBox: "0 0 20 25" },
  "FL": { path: "M 0,0 L 50,0 L 50,120 L 0,120 Z", viewBox: "0 0 50 120" },
  "GA": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "HI": { path: "M 0,0 L 40,0 L 40,30 L 0,30 Z", viewBox: "0 0 40 30" },
  "ID": { path: "M 0,0 L 50,0 L 50,80 L 0,80 Z", viewBox: "0 0 50 80" },
  "IL": { path: "M 0,0 L 50,0 L 50,60 L 0,60 Z", viewBox: "0 0 50 60" },
  "IN": { path: "M 0,0 L 40,0 L 40,50 L 0,50 Z", viewBox: "0 0 40 50" },
  "IA": { path: "M 0,0 L 50,0 L 50,50 L 0,50 Z", viewBox: "0 0 50 50" },
  "KS": { path: "M 0,0 L 60,0 L 60,50 L 0,50 Z", viewBox: "0 0 60 50" },
  "KY": { path: "M 0,0 L 45,0 L 45,55 L 0,55 Z", viewBox: "0 0 45 55" },
  "LA": { path: "M 0,0 L 50,0 L 50,60 L 0,60 Z", viewBox: "0 0 50 60" },
  "ME": { path: "M 0,0 L 40,0 L 40,80 L 0,80 Z", viewBox: "0 0 40 80" },
  "MD": { path: "M 0,0 L 40,0 L 40,50 L 0,50 Z", viewBox: "0 0 40 50" },
  "MA": { path: "M 0,0 L 50,0 L 50,40 L 0,40 Z", viewBox: "0 0 50 40" },
  "MI": { path: "M 0,0 L 50,0 L 50,100 L 0,100 Z", viewBox: "0 0 50 100" },
  "MN": { path: "M 0,0 L 60,0 L 60,70 L 0,70 Z", viewBox: "0 0 60 70" },
  "MS": { path: "M 0,0 L 40,0 L 40,60 L 0,60 Z", viewBox: "0 0 40 60" },
  "MO": { path: "M 0,0 L 55,0 L 55,60 L 0,60 Z", viewBox: "0 0 55 60" },
  "MT": { path: "M 0,0 L 70,0 L 70,80 L 0,80 Z", viewBox: "0 0 70 80" },
  "NE": { path: "M 0,0 L 60,0 L 60,50 L 0,50 Z", viewBox: "0 0 60 50" },
  "NV": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "NH": { path: "M 0,0 L 30,0 L 30,50 L 0,50 Z", viewBox: "0 0 30 50" },
  "NJ": { path: "M 0,0 L 40,0 L 40,50 L 0,50 Z", viewBox: "0 0 40 50" },
  "NM": { path: "M 0,0 L 60,0 L 60,60 L 0,60 Z", viewBox: "0 0 60 60" },
  "NY": { path: "M 0,0 L 50,0 L 50,80 L 0,80 Z", viewBox: "0 0 50 80" },
  "NC": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "ND": { path: "M 0,0 L 60,0 L 60,60 L 0,60 Z", viewBox: "0 0 60 60" },
  "OH": { path: "M 0,0 L 45,0 L 45,55 L 0,55 Z", viewBox: "0 0 45 55" },
  "OK": { path: "M 0,0 L 55,0 L 55,60 L 0,60 Z", viewBox: "0 0 55 60" },
  "OR": { path: "M 0,0 L 50,0 L 50,80 L 0,80 Z", viewBox: "0 0 50 80" },
  "PA": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "RI": { path: "M 0,0 L 20,0 L 20,25 L 0,25 Z", viewBox: "0 0 20 25" },
  "SC": { path: "M 0,0 L 40,0 L 40,50 L 0,50 Z", viewBox: "0 0 40 50" },
  "SD": { path: "M 0,0 L 60,0 L 60,60 L 0,60 Z", viewBox: "0 0 60 60" },
  "TN": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "TX": { path: "M 0,0 L 80,0 L 80,90 L 0,90 Z", viewBox: "0 0 80 90" },
  "UT": { path: "M 0,0 L 45,0 L 45,55 L 0,55 Z", viewBox: "0 0 45 55" },
  "VT": { path: "M 0,0 L 30,0 L 30,60 L 0,60 Z", viewBox: "0 0 30 60" },
  "VA": { path: "M 0,0 L 45,0 L 45,70 L 0,70 Z", viewBox: "0 0 45 70" },
  "WA": { path: "M 0,0 L 50,0 L 50,70 L 0,70 Z", viewBox: "0 0 50 70" },
  "WV": { path: "M 0,0 L 35,0 L 35,50 L 0,50 Z", viewBox: "0 0 35 50" },
  "WI": { path: "M 0,0 L 55,0 L 55,65 L 0,65 Z", viewBox: "0 0 55 65" },
  "WY": { path: "M 0,0 L 60,0 L 60,60 L 0,60 Z", viewBox: "0 0 60 60" }
};

// US Map Layout - positions and scales for each state in a simplified US map
const usMapLayout: Record<string, { x: number; y: number; scale: number }> = {
  "ME": { x: 580, y: 50, scale: 0.4 },
  "NH": { x: 560, y: 100, scale: 0.3 },
  "VT": { x: 540, y: 100, scale: 0.3 },
  "MA": { x: 550, y: 120, scale: 0.4 },
  "RI": { x: 560, y: 140, scale: 0.2 },
  "CT": { x: 550, y: 140, scale: 0.3 },
  "NY": { x: 520, y: 100, scale: 0.5 },
  "NJ": { x: 530, y: 180, scale: 0.4 },
  "PA": { x: 500, y: 150, scale: 0.5 },
  "DE": { x: 550, y: 200, scale: 0.2 },
  "MD": { x: 520, y: 200, scale: 0.4 },
  "WV": { x: 470, y: 200, scale: 0.35 },
  "VA": { x: 500, y: 220, scale: 0.45 },
  "NC": { x: 480, y: 260, scale: 0.5 },
  "SC": { x: 480, y: 300, scale: 0.4 },
  "GA": { x: 400, y: 280, scale: 0.5 },
  "FL": { x: 400, y: 340, scale: 0.5 },
  "AL": { x: 380, y: 280, scale: 0.4 },
  "MS": { x: 350, y: 280, scale: 0.4 },
  "TN": { x: 400, y: 240, scale: 0.5 },
  "KY": { x: 420, y: 220, scale: 0.45 },
  "OH": { x: 440, y: 180, scale: 0.45 },
  "IN": { x: 400, y: 180, scale: 0.4 },
  "IL": { x: 350, y: 180, scale: 0.5 },
  "MI": { x: 400, y: 100, scale: 0.5 },
  "WI": { x: 360, y: 120, scale: 0.55 },
  "MN": { x: 300, y: 80, scale: 0.6 },
  "IA": { x: 300, y: 150, scale: 0.5 },
  "MO": { x: 320, y: 220, scale: 0.55 },
  "AR": { x: 320, y: 260, scale: 0.45 },
  "LA": { x: 320, y: 300, scale: 0.5 },
  "TX": { x: 250, y: 280, scale: 0.8 },
  "OK": { x: 280, y: 240, scale: 0.55 },
  "KS": { x: 280, y: 200, scale: 0.6 },
  "NE": { x: 280, y: 160, scale: 0.6 },
  "SD": { x: 280, y: 120, scale: 0.6 },
  "ND": { x: 280, y: 60, scale: 0.6 },
  "MT": { x: 180, y: 60, scale: 0.7 },
  "WY": { x: 200, y: 140, scale: 0.6 },
  "CO": { x: 200, y: 180, scale: 0.5 },
  "NM": { x: 200, y: 240, scale: 0.6 },
  "AZ": { x: 150, y: 240, scale: 0.5 },
  "UT": { x: 150, y: 200, scale: 0.45 },
  "NV": { x: 120, y: 180, scale: 0.5 },
  "ID": { x: 120, y: 120, scale: 0.5 },
  "WA": { x: 100, y: 60, scale: 0.5 },
  "OR": { x: 80, y: 100, scale: 0.5 },
  "CA": { x: 50, y: 140, scale: 0.6 },
  "AK": { x: 50, y: 20, scale: 0.8 },
  "HI": { x: 200, y: 380, scale: 0.4 }
};

interface USStatesMapSVGProps {
  stateStats: Array<{ state: string; bidCount: number }>;
  selectedState: string | null;
  onStateClick: (state: string) => void;
  getStateColor: (bidCount: number) => string;
  accentColor: string;
}

export function USStatesMapSVG({
  stateStats,
  selectedState,
  onStateClick,
  getStateColor,
  accentColor
}: USStatesMapSVGProps) {
  const stateMap = new Map(stateStats.map(s => [s.state, s.bidCount]));
  const maxBidCount = Math.max(...Array.from(stateMap.values()), 1);

  const getColorValue = (bidCount: number): string => {
    if (bidCount === 0) return '#e5e7eb';
    const intensity = Math.min(100, Math.round((bidCount / maxBidCount) * 100));
    if (intensity >= 80) return '#dc2626';
    if (intensity >= 60) return '#f97316';
    if (intensity >= 40) return '#eab308';
    if (intensity >= 20) return '#22c55e';
    return '#60a5fa';
  };

  return (
    <div className="relative w-full" style={{ minHeight: '500px' }}>
      <svg
        viewBox="0 0 650 450"
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <style>{`
            .state-button-path {
              transition: all 0.15s ease;
              cursor: pointer;
            }
            .state-button-path:active {
              filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0)) !important;
              transform: translateY(6px) !important;
            }
          `}</style>
        </defs>

        {Object.entries(usMapLayout).map(([abbr, position]) => {
          const bidCount = stateMap.get(abbr) || 0;
          const isSelected = selectedState === abbr;
          const shape = stateSVGPaths[abbr];
          if (!shape) return null;

          const color = getColorValue(bidCount);

          return (
            <g
              key={abbr}
              transform={`translate(${position.x}, ${position.y}) scale(${position.scale})`}
              className="cursor-pointer"
            >
              <g
                className="state-button-group"
                style={{
                  filter: isSelected ? `drop-shadow(0 0 4px ${accentColor})` : 'none'
                }}
              >
                <path
                  d={shape.path}
                  fill={color}
                  stroke={isSelected ? accentColor : '#ffffff'}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="state-button-path"
                  style={{
                    filter: 'drop-shadow(0 6px 0 rgba(0, 0, 0, 0.2))',
                  }}
                  onClick={() => onStateClick(abbr)}
                  onMouseDown={(e) => {
                    const target = e.currentTarget;
                    target.style.filter = 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))';
                    target.style.transform = 'translateY(6px)';
                  }}
                  onMouseUp={(e) => {
                    const target = e.currentTarget;
                    target.style.filter = 'drop-shadow(0 6px 0 rgba(0, 0, 0, 0.2))';
                    target.style.transform = 'translateY(0)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget;
                    target.style.filter = 'drop-shadow(0 6px 0 rgba(0, 0, 0, 0.2))';
                    target.style.transform = 'translateY(0)';
                  }}
                />
                <text
                  x={parseFloat(shape.viewBox.split(' ')[2]) / 2}
                  y={parseFloat(shape.viewBox.split(' ')[3]) / 2 - 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fill={bidCount > 0 ? '#ffffff' : '#6b7280'}
                  fontSize="12"
                  fontWeight="bold"
                >
                  {abbr}
                </text>
                {bidCount > 0 && (
                  <text
                    x={parseFloat(shape.viewBox.split(' ')[2]) / 2}
                    y={parseFloat(shape.viewBox.split(' ')[3]) / 2 + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none select-none"
                    fill="#ffffff"
                    fontSize="9"
                    opacity={0.95}
                  >
                    {bidCount}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

