// // // import React, { Suspense, useMemo, useRef } from "react";
// // // import { Canvas, useFrame } from "@react-three/fiber";
// // // import { EffectComposer, Bloom } from "@react-three/postprocessing";
// // // import * as THREE from "three";
// // // import "./HeroAnimation.css";

// // // const COLORS = {
// // //   SUN: "#FD6616",
// // //   EARTH: "#4A90E2",
// // //   ORBIT: "#FFFFFF",
// // //   TRAIL: "#FFFFFF",
// // //   SATURN: "#FFB74D",
// // //   SATURN_RING_INNER: "#FFD699",
// // // };

// // // const deg = (d: number) => (d * Math.PI) / 180;

// // // // ==========================================
// // // // SUN (BIGGER, GLOWING, GRADIENT TEXTURE)
// // // // ==========================================
// // // const createSunTexture = () => {
// // //   const canvas = document.createElement("canvas");
// // //   canvas.width = canvas.height = 256;
// // //   const ctx = canvas.getContext("2d");
// // //   if (!ctx) return null;
// // //   const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
// // //   grad.addColorStop(0, "#FFB74D");
// // //   grad.addColorStop(0.4, "#FF8C42");
// // //   grad.addColorStop(0.7, "#FD6616");
// // //   grad.addColorStop(1, "#E85D3A");
// // //   ctx.fillStyle = grad;
// // //   ctx.fillRect(0, 0, 256, 256);
// // //   const tex = new THREE.CanvasTexture(canvas);
// // //   tex.colorSpace = THREE.SRGBColorSpace;
// // //   return tex;
// // // };

// // // const Sun: React.FC = () => {
// // //   const ref = useRef<THREE.Mesh>(null);
// // //   const texture = useMemo(() => createSunTexture(), []);
// // //   useFrame(({ clock }) => {
// // //     const t = clock.getElapsedTime();
// // //     if (ref.current) {
// // //       const s = 1 + Math.sin(t * 1.5) * 0.06;
// // //       ref.current.scale.setScalar(s);
// // //       ref.current.rotation.y += 0.002;
// // //     }
// // //   });
// // //   return (
// // //     <mesh ref={ref}>
// // //       <sphereGeometry args={[4.5, 64, 64]} />
// // //       <meshStandardMaterial
// // //         map={texture || undefined}
// // //         emissive={COLORS.SUN}
// // //         emissiveIntensity={1.5}
// // //         roughness={0.3}
// // //         toneMapped={false}
// // //       />
// // //     </mesh>
// // //   );
// // // };

// // // // ==========================================
// // // // STARFIELD (REDUCED DENSITY, TWINKLING ONLY)
// // // // ==========================================
// // // const BalancedStarfield: React.FC<{ count?: number; size?: number }> = ({
// // //   count = 1600,
// // //   size = 380,
// // // }) => {
// // //   const pointsRef = useRef<THREE.Points>(null);

// // //   const stars = useMemo(() => {
// // //     const positions = new Float32Array(count * 3);
// // //     const colors = new Float32Array(count * 3);
// // //     const speeds = new Float32Array(count);
// // //     const phases = new Float32Array(count);
// // //     for (let i = 0; i < count; i++) {
// // //       let r = Math.cbrt(Math.random()) * (size / 2);
// // //       if (r < 80) r += 60; // fewer stars near center
// // //       const theta = Math.random() * Math.PI * 2;
// // //       const phi = Math.acos(2 * Math.random() - 1);
// // //       const x = r * Math.sin(phi) * Math.cos(theta);
// // //       const y = r * Math.sin(phi) * Math.sin(theta);
// // //       const z = r * Math.cos(phi);
// // //       positions.set([x, y, z], i * 3);
// // //       const c = new THREE.Color(Math.random() < 0.5 ? 0xfff2df : 0xdfeaff);
// // //       colors.set([c.r, c.g, c.b], i * 3);
// // //       speeds[i] = 0.3 + Math.random() * 0.6;
// // //       phases[i] = Math.random() * Math.PI * 2;
// // //     }
// // //     return { positions, colors, speeds, phases };
// // //   }, [count, size]);

// // //   useFrame(() => {
// // //     if (!pointsRef.current) return;
// // //     const geom = pointsRef.current.geometry as THREE.BufferGeometry;
// // //     const opacity = (geom.getAttribute("opacity") as THREE.BufferAttribute)
// // //       .array as Float32Array;
// // //     const { speeds, phases } = stars;
// // //     for (let i = 0; i < count; i++) {
// // //       const tw = 0.55 + 0.45 * Math.sin(phases[i] + performance.now() * 0.001 * speeds[i]);
// // //       opacity[i] = THREE.MathUtils.clamp(tw, 0.3, 1);
// // //     }
// // //     (geom.getAttribute("opacity") as THREE.BufferAttribute).needsUpdate = true;
// // //   });

// // //   const geometry = useMemo(() => {
// // //     const g = new THREE.BufferGeometry();
// // //     g.setAttribute("position", new THREE.BufferAttribute(stars.positions, 3));
// // //     g.setAttribute("color", new THREE.BufferAttribute(stars.colors, 3));
// // //     g.setAttribute("opacity", new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
// // //     return g;
// // //   }, [stars, count]);

// // //   return (
// // //     <points ref={pointsRef} geometry={geometry}>
// // //       <shaderMaterial
// // //         transparent
// // //         depthWrite={false}
// // //         vertexColors
// // //         vertexShader={`
// // //           attribute float opacity;
// // //           varying float vOpacity;
// // //           varying vec3 vColor;
// // //           void main() {
// // //             vOpacity = opacity;
// // //             vColor = color;
// // //             vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
// // //             gl_PointSize = (2.0 + vOpacity * 2.0) * (400.0 / -mvPosition.z);
// // //             gl_Position = projectionMatrix * mvPosition;
// // //           }
// // //         `}
// // //         fragmentShader={`
// // //           varying float vOpacity;
// // //           varying vec3 vColor;
// // //           void main() {
// // //             vec2 uv = gl_PointCoord - vec2(0.5);
// // //             float d = length(uv);
// // //             float alpha = smoothstep(0.5, 0.0, d);
// // //             gl_FragColor = vec4(vColor, vOpacity * alpha);
// // //           }
// // //         `}
// // //         toneMapped={false}
// // //       />
// // //     </points>
// // //   );
// // // };

// // // // ==========================================
// // // // PLANET (With White Trail)
// // // // ==========================================
// // // const Planet: React.FC<{
// // //   color: string;
// // //   size: number;
// // //   orbitRadius: number;
// // //   orbitSpeed: number;
// // //   orbitAngle: number;
// // //   tilt: number;
// // //   ring?: boolean;
// // // }> = ({ color, size, orbitRadius, orbitSpeed, orbitAngle, tilt, ring }) => {
// // //   const planet = useRef<THREE.Mesh>(null);
// // //   const trail = useRef<THREE.Line>(null);
// // //   const trailPoints = useRef<THREE.Vector3[]>([]);

// // //   useFrame(({ clock }) => {
// // //     const t = clock.getElapsedTime();
// // //     const angle = t * orbitSpeed + orbitAngle;
// // //     const x = Math.cos(angle) * orbitRadius * 1.3;
// // //     const z = Math.sin(angle) * orbitRadius;
// // //     const position = new THREE.Vector3(x, 0, z).applyEuler(
// // //       new THREE.Euler(0, 0, deg(tilt))
// // //     );

// // //     if (planet.current) planet.current.position.copy(position);

// // //     // Trail update
// // //     trailPoints.current.push(position.clone());
// // //     if (trailPoints.current.length > 80) trailPoints.current.shift();

// // //     if (trail.current && trailPoints.current.length > 1) {
// // //       const positions = new Float32Array(trailPoints.current.flatMap((p) => p.toArray()));
// // //       const colors = new Float32Array(positions.length);
// // //       const white = new THREE.Color(COLORS.TRAIL);
// // //       for (let i = 0; i < trailPoints.current.length; i++) {
// // //         const progress = i / (trailPoints.current.length - 1);
// // //         const brightness = 0.05 + progress * 0.3;
// // //         const c = white.clone().multiplyScalar(brightness);
// // //         colors.set([c.r, c.g, c.b], i * 3);
// // //       }
// // //       trail.current.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
// // //       trail.current.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
// // //       trail.current.geometry.computeBoundingSphere();
// // //     }
// // //   });

// // //   const trailGeo = useMemo(() => new THREE.BufferGeometry(), []);
// // //   const trailMat = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true }), []);

// // //   return (
// // //     <>
// // //       <line ref={trail} geometry={trailGeo} material={trailMat} />
// // //       <mesh ref={planet} rotation={[0, 0, deg(tilt)]}>
// // //         <sphereGeometry args={[size, 32, 32]} />
// // //         <meshStandardMaterial
// // //           color={color}
// // //           emissive={color}
// // //           emissiveIntensity={0.45}
// // //           roughness={0.6}
// // //           metalness={0.25}
// // //           toneMapped={false}
// // //         />
// // //         {ring && (
// // //           <mesh rotation={[Math.PI / 2.3, 0, deg(25)]} position={[0, 0.05, 0]}>
// // //             <ringGeometry args={[1.1, 1.7, 64]} />
// // //             <meshBasicMaterial
// // //               color={COLORS.SATURN_RING_INNER}
// // //               opacity={0.65}
// // //               transparent
// // //               side={THREE.DoubleSide}
// // //               toneMapped={false}
// // //             />
// // //           </mesh>
// // //         )}
// // //       </mesh>
// // //     </>
// // //   );
// // // };

// // // // ==========================================
// // // // ORBIT (ELLIPTICAL)
// // // // ==========================================
// // // const Orbit: React.FC<{ radius: number; tilt: number; thickness?: number }> = ({
// // //   radius,
// // //   tilt,
// // //   thickness = 0.02,
// // // }) => {
// // //   const points = useMemo(() => {
// // //     const p = [];
// // //     for (let i = 0; i <= 128; i++) {
// // //       const angle = (i / 128) * Math.PI * 2;
// // //       const x = Math.cos(angle) * radius * 1.3;
// // //       const z = Math.sin(angle) * radius;
// // //       p.push(new THREE.Vector3(x, 0, z));
// // //     }
// // //     return p;
// // //   }, [radius]);

// // //   const geometry = useMemo(() => {
// // //     const curve = new THREE.CatmullRomCurve3(points);
// // //     return new THREE.TubeGeometry(curve, 128, thickness, 8, true);
// // //   }, [points, thickness]);

// // //   return (
// // //     <mesh geometry={geometry} rotation={[0, 0, deg(tilt)]}>
// // //       <meshBasicMaterial color={COLORS.ORBIT} opacity={0.15} transparent />
// // //     </mesh>
// // //   );
// // // };
// // // // ==========================================
// // // // MAIN HERO ANIMATION
// // // // ==========================================
// // // const HeroAnimation: React.FC = () => {
// // //   return (
// // //     <div className="hero-animation-bg">
// // //       <Canvas
// // //         camera={{ position: [0, 20, 60], fov: 55 }}
// // //         dpr={[1, 1.75]}
// // //         gl={{ alpha: true, antialias: true }}
// // //       >
// // //         <ambientLight intensity={0.15} />
// // //         <pointLight
// // //           position={[0, 0, 0]}
// // //           intensity={1.9}
// // //           color={COLORS.SUN}
// // //           distance={140}
// // //           decay={2}
// // //         />

// // //         <Suspense fallback={null}>
// // //           <BalancedStarfield />
// // //           <Sun />

// // //           {/* Mercury */}
// // //           <Orbit radius={8} tilt={15} />
// // //           <Planet
// // //             color="#E57373"
// // //             size={0.6}
// // //             orbitRadius={8}
// // //             orbitSpeed={0.65}
// // //             orbitAngle={1.2}
// // //             tilt={15}
// // //           />

// // //           {/* Venus */}
// // //           <Orbit radius={11} tilt={-15} />
// // //           <Planet
// // //             color="#FFB74D"
// // //             size={0.8}
// // //             orbitRadius={11}
// // //             orbitSpeed={0.48}
// // //             orbitAngle={2.5}
// // //             tilt={-15}
// // //           />

// // //           {/* Earth */}
// // //           <Orbit radius={15} tilt={0} />
// // //           <Planet
// // //             color={COLORS.EARTH}
// // //             size={0.85}
// // //             orbitRadius={15}
// // //             orbitSpeed={0.38}
// // //             orbitAngle={3.1}
// // //             tilt={0}
// // //           />

// // //           {/* Mars */}
// // //           <Orbit radius={19} tilt={30} />
// // //           <Planet
// // //             color="#FF6F61"
// // //             size={0.7}
// // //             orbitRadius={19}
// // //             orbitSpeed={0.31}
// // //             orbitAngle={4.5}
// // //             tilt={30}
// // //           />

// // //           {/* Jupiter */}
// // //           <Orbit radius={25} tilt={10} />
// // //           <Planet
// // //             color="#FFB86F"
// // //             size={1.2}
// // //             orbitRadius={25}
// // //             orbitSpeed={0.2}
// // //             orbitAngle={5.8}
// // //             tilt={10}
// // //           />

// // //           {/* Saturn */}
// // //           <Orbit radius={35} tilt={20} />
// // //           <Planet
// // //             color={COLORS.SATURN}
// // //             size={1.1}
// // //             orbitRadius={35}
// // //             orbitSpeed={0.14}
// // //             orbitAngle={0.9}
// // //             tilt={20}
// // //             ring
// // //           />

// // //           <EffectComposer>
// // //             <Bloom
// // //               luminanceThreshold={0.05}
// // //               luminanceSmoothing={0.7}
// // //               intensity={1.2}
// // //               radius={0.9}
// // //             />
// // //           </EffectComposer>
// // //         </Suspense>
// // //       </Canvas>
// // //     </div>
// // //   );
// // // };

// // // export default HeroAnimation;
// // // Make sure this path is correct based on your folder structure!
// // // Change import to your new MP4 file
// // // import bgVideo from "../assets/output_trimmed_start_final.mp4";
// // // import "./HeroAnimation.css";

// // // const HeroAnimation = () => {
// // //   return (
// // //     <div className="hero-animation-bg">
// // //       <video
// // //         autoPlay
// // //         loop
// // //         muted
// // //         playsInline // Crucial for iOS/Mac support
// // //         // This ensures the video stays cached and doesn't reload
// // //         preload="auto"
// // //         style={{
// // //           width: "100%",
// // //           height: "100%",
// // //           objectFit: "cover",
// // //           display: "block",
// // //         }}
// // //       >
// // //         <source src={bgVideo} type="video/mp4" />
// // //       </video>

// // //       {/* Dark Overlay (Keeps text readable) */}
// // //       <div 
// // //         style={{
// // //           position: "absolute",
// // //           inset: 0,
// // //           background: "rgba(3, 0, 6, 0.3)"
// // //         }} 
// // //       />
// // //     </div>
// // //   );
// // // };


// // // // export default HeroAnimation;
// // // import React from "react";
// // // import "./HeroAnimation.css";

// // // /**
// // //  * HeroAnimation Component
// // //  * Note: The video file 'output_trimmed_start_final.mp4' must be located 
// // //  * in your project's /public folder for this pathing to work on production.
// // //  */
// // // const HeroAnimation: React.FC = () => {
// // //   return (
// // //     <div className="hero-animation-bg">
// // //       <video
// // //         autoPlay
// // //         loop
// // //         muted
// // //         playsInline // Required for autoplay on iOS/Safari
// // //         preload="auto"
// // //         style={{
// // //           width: "100%",
// // //           height: "100%",
// // //           objectFit: "cover",
// // //           display: "block",
// // //         }}
// // //       >
// // //         {/* We reference the public folder using a leading slash / */}
// // //        <source 
// // //   src={process.env.PUBLIC_URL + '/output_trimmed_start_final.mp4'} 
// // //   type="video/mp4" 
// // // />
// // //         Your browser does not support the video tag.
// // //       </video>

// // //       {/* Dark Overlay to maintain text contrast/readability */}
// // //       <div 
// // //         style={{
// // //           position: "absolute",
// // //           inset: 0,
// // //           background: "rgba(3, 0, 6, 0.4)", // Adjusted slightly for better text contrast
// // //           zIndex: 1
// // //         }} 
// // //       />
// // //     </div>
// // //   );
// // // };

// // // export default HeroAnimation;

// // // import React, { useEffect, useRef } from "react";
// // // import "./HeroAnimation.css";

// // // const HeroAnimation: React.FC = () => {
// // //   const videoRef = useRef<HTMLVideoElement>(null);

// // //   useEffect(() => {
// // //     // This force-starts the video if the browser tries to block it
// // //     if (videoRef.current) {
// // //       videoRef.current.defaultMuted = true;
// // //       videoRef.current.muted = true;
// // //       videoRef.current.play().catch(error => {
// // //         console.error("Video autoplay failed:", error);
// // //       });
// // //     }
// // //   }, []);

// // //   return (
// // //     <div className="hero-animation-bg">
// // //       <video
// // //         ref={videoRef}
// // //         autoPlay
// // //         loop
// // //         muted
// // //         playsInline // Required for iOS/Safari production
// // //         preload="auto"
// // //         // poster="/logo512.png" // Temporary placeholder while video loads
// // //         style={{
// // //           width: "100%",
// // //           height: "100%",
// // //           objectFit: "cover",
// // //           display: "block",
// // //         }}
// // //       >
// // //         <source src="/output_trimmed_start_final.mp4" type="video/mp4" />
// // //         Your browser does not support the video tag.
// // //       </video>

// // //       {/* Dark Overlay */}
// // //       <div 
// // //         style={{
// // //           position: "absolute",
// // //           inset: 0,
// // //           background: "rgba(3, 0, 6, 0.4)",
// // //           zIndex: 1
// // //         }} 
// // //       />
// // //     </div>
// // //   );
// // // };

// // // export default HeroAnimation;
// // import React, { useEffect, useRef } from "react";
// // import "./HeroAnimation.css";

// // const HeroAnimation: React.FC = () => {
// //   const videoRef = useRef<HTMLVideoElement>(null);

// //   useEffect(() => {
// //     // Force set muted and try to play to bypass strict production browser policies
// //     if (videoRef.current) {
// //       videoRef.current.defaultMuted = true;
// //       videoRef.current.muted = true;
// //       videoRef.current.play().catch((error) => {
// //         console.error("Production autoplay failed:", error);
// //       });
// //     }
// //   }, []);

// //   return (
// //     <div className="hero-animation-bg">
// //       <video
// //         ref={videoRef}
// //         autoPlay
// //         loop
// //         muted
// //         playsInline // CRITICAL: Required for autoplay on iOS/Safari in production
// //         preload="auto"
// //         poster="/poster_placeholder.png"
// //         // poster="/logo512.png"
// //         style={{
// //           width: "100%",
// //           height: "100%",
// //           objectFit: "cover",
// //           display: "block",
// //         }}
// //       >
// //         {/* Referencing the public folder file directly */}
// //         <source src="/output_trimmed_start_final.mp4" type="video/mp4" />
// //         Your browser does not support the video tag.
// //       </video>

// //       {/* Dark Overlay for text readability */}
// //       <div 
// //         style={{
// //           position: "absolute",
// //           inset: 0,
// //           background: "rgba(3, 0, 6, 0.4)",
// //           zIndex: 1
// //         }} 
// //       />
// //     </div>
// //   );
// // };

// // export default HeroAnimation;
// import React, { useEffect, useRef } from "react";
// import "./HeroAnimation.css";

// const HeroAnimation: React.FC = () => {
//   const videoRef = useRef<HTMLVideoElement>(null);

//   useEffect(() => {
//     const playVideo = async () => {
//       if (videoRef.current) {
//         // Force these properties directly on the DOM element
//         // This is the only way to consistently bypass autoplay blocks on live domains
//         videoRef.current.defaultMuted = true;
//         videoRef.current.muted = true;
        
//         try {
//           await videoRef.current.play();
//         } catch (err) {
//           console.warn("Autoplay was blocked by the browser:", err);
//         }
//       }
//     };
//     playVideo();
//   }, []);

//   return (
//     <div className="hero-animation-bg" style={{ backgroundColor: '#030006' }}>
//       <video
//         ref={videoRef}
//         autoPlay
//         loop
//         muted
//         playsInline // CRITICAL for iOS and Safari mobile support
//         poster="/poster_placeholder.png"
//         preload="auto"
//         style={{
//           width: "100%",
//           height: "100%",
//           objectFit: "cover",
//           display: "block",
//           position: "absolute",
//           top: 0,
//           left: 0,
//           zIndex: 0
//         }}
//       >
//         {/* Absolute path to the file in your /public folder */}
//         <source src="/output_trimmed_start_final.mp4" type="video/mp4" />
//         Your browser does not support the video tag.
//       </video>

//       {/* This overlay ensures text remains readable over the animation */}
//       <div 
//         style={{
//           position: "absolute",
//           inset: 0,
//           background: "rgba(3, 0, 6, 0.4)",
//           zIndex: 1,
//           pointerEvents: "none"
//         }} 
//       />
//     </div>
//   );
// };

// export default HeroAnimation;
import React, { useEffect, useRef } from "react";
import "./HeroAnimation.css";

const HeroAnimation: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    // Force set muted and try to play to bypass strict production browser policies
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch((error) => {
        console.error("Production autoplay failed:", error);
      });
    }
  }, []);
  return (
    <div className="hero-animation-bg">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline // CRITICAL: Required for autoplay on iOS/Safari in production
        preload="auto"
        poster="/poster_placeholder.png"
        // poster="/logo512.png"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      >
        {/* Referencing the public folder file directly */}
        <source src="/output_trimmed_start_final.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {/* Dark Overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(3, 0, 6, 0.4)",
          zIndex: 1
        }}
      />
    </div>
  );
};

export default HeroAnimation;

