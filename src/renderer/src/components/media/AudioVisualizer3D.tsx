import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMediaStore } from '../../store/useMediaStore'

const BARS_COUNT = 24

const Bars = () => {
  const groupRef = useRef<THREE.Group>(null)
  const isPlaying = useMediaStore((state) => state.isPlaying)

  // Initialize bar positions in a circle
  const bars = useMemo(() => {
    return Array.from({ length: BARS_COUNT }).map((_, i) => {
      const angle = (i / BARS_COUNT) * Math.PI * 2
      const radius = 1.2
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius
      }
    })
  }, [])

  useFrame(({ clock }) => {
    if (!groupRef.current) return

    const time = clock.getElapsedTime()

    groupRef.current.children.forEach((child, i) => {
      if (isPlaying) {
        // Create an organic wave effect to simulate audio frequencies
        const wave1 = Math.sin(time * 4 + i * 0.5)
        const wave2 = Math.cos(time * 3 + i * 1.2)
        const target = Math.max(0.1, (wave1 + wave2) * 0.5 + 0.6)

        // Smoothly interpolate current scale to the target
        child.scale.y = THREE.MathUtils.lerp(child.scale.y, target * 1.5, 0.15)

        // Randomly pulse some bars higher to mimic high hats/kicks
        if (Math.random() > 0.98) {
          child.scale.y = Math.max(child.scale.y, Math.random() * 2 + 1)
        }
      } else {
        // Smoothly go down to idle height (0.1) when paused
        child.scale.y = THREE.MathUtils.lerp(child.scale.y, 0.1, 0.05)
      }
    })

    // Rotate the whole group slowly
    groupRef.current.rotation.y += isPlaying ? 0.005 : 0.001
  })

  return (
    <group ref={groupRef}>
      {bars.map((bar, i) => (
        <mesh key={i} position={[bar.x, 0, bar.z]}>
          {/* Box geometry with height 1, centered at origin */}
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshBasicMaterial color="#a1a1aa" opacity={0.6} transparent={true} />
        </mesh>
      ))}
    </group>
  )
}

export const AudioVisualizer3D = () => {
  return (
    <div className="w-16 h-10 pointer-events-none opacity-80 flex items-center justify-center">
      <Canvas camera={{ position: [0, 2.5, 3.5], fov: 40 }}>
        <ambientLight intensity={1} />
        <Bars />
      </Canvas>
    </div>
  )
}
