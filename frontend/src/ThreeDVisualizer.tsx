import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeDVisualizerProps {
  theme: 'green' | 'red' | 'blue' | 'gold';
  isPlaying: boolean;
}

export default function ThreeDVisualizer({ theme, isPlaying }: ThreeDVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Track colors dynamically
  const getThemeColor = () => {
    if (theme === 'green') return 0x00ff66;
    if (theme === 'red') return 0xff003c;
    if (theme === 'blue') return 0x00bfff;
    return 0xffcc00;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Create container dimensions
    const width = containerRef.current.clientWidth || 280;
    const height = containerRef.current.clientHeight || 280;

    // Setup Scene
    const scene = new THREE.Scene();
    
    // Setup Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Setup Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Group to hold the dial component (for floating and rotating)
    const dialGroup = new THREE.Group();
    scene.add(dialGroup);

    // 1. Bezel (Outer metallic torus)
    const bezelGeo = new THREE.TorusGeometry(2.1, 0.22, 16, 100);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x4a5a4a,
      metalness: 0.9,
      roughness: 0.15,
      bumpScale: 0.05
    });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    dialGroup.add(bezel);

    // 2. Bezel Indicators (4 outer ridges)
    const ridgeGeo = new THREE.BoxGeometry(0.12, 0.4, 0.3);
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
    const positions = [
      [0, 2.2, 0],
      [0, -2.2, 0],
      [2.2, 0, 0],
      [-2.2, 0, 0]
    ];
    positions.forEach((pos, idx) => {
      const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridge.position.set(pos[0], pos[1], pos[2]);
      if (idx >= 2) {
        ridge.rotation.z = Math.PI / 2;
      }
      dialGroup.add(ridge);
    });

    // 3. Dial Face Plate (Dark inner cylinder)
    const faceGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.15, 64);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x080f08,
      metalness: 0.6,
      roughness: 0.4
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.rotation.x = Math.PI / 2;
    face.position.z = -0.08;
    dialGroup.add(face);

    // 4. Hourglass Core (Glass Chromatic Refractive Triangles)
    const coreGroup = new THREE.Group();
    dialGroup.add(coreGroup);

    // Create custom shapes for top and bottom wedges following circular face (faithful to Ben 10 Omnitrix dial)
    const radius = 1.75; // fits inside the 1.9 face cylinder radius
    
    const shapeTop = new THREE.Shape();
    shapeTop.moveTo(0, 0);
    // Line to the right corner of the top wedge (60 degrees)
    shapeTop.lineTo(radius * Math.cos(Math.PI / 3), radius * Math.sin(Math.PI / 3));
    // Curved arc to the left corner (120 degrees)
    shapeTop.absarc(0, 0, radius, Math.PI / 3, 2 * Math.PI / 3, false);
    // Line back to the center
    shapeTop.lineTo(0, 0);
    shapeTop.closePath();

    const shapeBottom = new THREE.Shape();
    shapeBottom.moveTo(0, 0);
    // Line to the left corner of the bottom wedge (240 degrees)
    shapeBottom.lineTo(radius * Math.cos(4 * Math.PI / 3), radius * Math.sin(4 * Math.PI / 3));
    // Curved arc to the right corner (300 degrees)
    shapeBottom.absarc(0, 0, radius, 4 * Math.PI / 3, 5 * Math.PI / 3, false);
    // Line back to the center
    shapeBottom.lineTo(0, 0);
    shapeBottom.closePath();

    const extrudeSettings = {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04
    };

    const wedgeGeo1 = new THREE.ExtrudeGeometry(shapeTop, extrudeSettings);
    const wedgeGeo2 = new THREE.ExtrudeGeometry(shapeBottom, extrudeSettings);

    const glassColor = getThemeColor();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: glassColor,
      roughness: 0.08,
      metalness: 0.2,
      transmission: 0.7,   // High glass transparency
      thickness: 1.0,      // Refraction thickness
      ior: 1.52,           // Glass index of refraction
      iridescence: 1.0,    // Chromatic oil-slick reflection
      iridescenceIOR: 1.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.95,
      emissive: glassColor,
      emissiveIntensity: 0.35 // Glow effect
    });

    const wedge1 = new THREE.Mesh(wedgeGeo1, glassMat);
    wedge1.position.set(0, 0, 0.05); // Meets exactly in the center
    
    const wedge2 = new THREE.Mesh(wedgeGeo2, glassMat);
    wedge2.position.set(0, 0, 0.05); // Meets exactly in the center

    coreGroup.add(wedge1);
    coreGroup.add(wedge2);

    // 5. Center Bezel core cover
    const centerGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
    const centerMat = new THREE.MeshStandardMaterial({ color: 0x111611, metalness: 0.9, roughness: 0.2 });
    const centerCore = new THREE.Mesh(centerGeo, centerMat);
    centerCore.rotation.x = Math.PI / 2;
    centerCore.position.z = 0.1;
    coreGroup.add(centerCore);

    // Setup Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Theme responsive Pointlight
    const themeLight = new THREE.PointLight(glassColor, 8, 15);
    themeLight.position.set(0, 0, 3);
    scene.add(themeLight);

    // High Specular White light for metallic reflections
    const specularLight = new THREE.DirectionalLight(0xffffff, 2.5);
    specularLight.position.set(-5, 5, 5);
    scene.add(specularLight);

    // Shadow catcher point light
    const fillLight = new THREE.PointLight(0xffffff, 1.5, 10);
    fillLight.position.set(4, -4, 2);
    scene.add(fillLight);

    // Animation variables
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      const time = clock.getElapsedTime();
      
      // Floating motion (Sine wave)
      dialGroup.position.y = Math.sin(time * 1.5) * 0.15;
      dialGroup.position.x = Math.cos(time * 0.7) * 0.05;

      // Rotation reactive to play state
      const rotationSpeed = isPlaying ? 0.03 : 0.006;
      dialGroup.rotation.z += rotationSpeed;
      
      // Counter rotate core slightly for complex visual parallax
      coreGroup.rotation.z = Math.sin(time * 0.5) * 0.08;

      // Render
      renderer.render(scene, camera);
    };

    animate();

    // Handle container resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        try {
          containerRef.current.removeChild(renderer.domElement);
        } catch (e) {
          // ignore already removed
        }
      }
      bezelGeo.dispose();
      bezelMat.dispose();
      faceGeo.dispose();
      faceMat.dispose();
      wedgeGeo1.dispose();
      wedgeGeo2.dispose();
      glassMat.dispose();
      centerGeo.dispose();
      centerMat.dispose();
      renderer.dispose();
    };
  }, [theme, isPlaying]);

  return (
    <div 
      ref={containerRef} 
      className="omnitrix-3d-container"
      style={{ 
        width: '200px', 
        height: '200px', 
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 0 15px var(--color-green-neon-glow))'
      }} 
    />
  );
}
