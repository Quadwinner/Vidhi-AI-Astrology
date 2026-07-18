import React from 'react';
import './CelestialLoader.css';

interface CelestialLoaderProps {
  size?: number;
}

// A premium 3D-style celestial orbital loader: a glowing sun with a rotating
// halo, tilted elliptical orbits, and planets orbiting in perspective.
export default function CelestialLoader({ size = 300 }: CelestialLoaderProps) {
  return (
    <div className="cl-wrap" style={{ width: size, height: size }}>
      <div className="cl-stars" />
      <div className="cl-scene">
        <div className="cl-sun">
          <div className="cl-sun-halo" />
          <div className="cl-sun-core" />
        </div>
        <div className="cl-orbit cl-orbit1"><span className="cl-planet cl-p1" /></div>
        <div className="cl-orbit cl-orbit2"><span className="cl-planet cl-p2" /></div>
        <div className="cl-orbit cl-orbit3"><span className="cl-planet cl-p3" /></div>
      </div>
    </div>
  );
}
