import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Code2, FolderOpen, FilePlus, Terminal, MessageSquare, Folder } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useProjectStore } from '../../store/useProjectStore'
import { transition, ease } from '../../lib/motion'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const VortexTunnel = () => {
  const meshRef = useRef<THREE.Mesh>(null)

  const segments = 40
  const segmentLength = 60 / segments

  useFrame(({ clock, pointer, camera }) => {
    if (!meshRef.current) return
    const time = clock.getElapsedTime()

    // Slowly rotate the tunnel
    meshRef.current.rotation.y = time * 0.05

    // Move tunnel towards the camera to create infinite forward effect
    meshRef.current.position.z = (time * 2.5) % segmentLength

    // Gentle mouse parallax
    camera.position.x += (pointer.x * 1.5 - camera.position.x) * 0.05
    camera.position.y += (pointer.y * 1.5 - camera.position.y) * 0.05
    camera.lookAt(pointer.x * 0.5, pointer.y * 0.5, -10)
  })

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[8, 8, 60, 24, segments, true]} />
      <meshBasicMaterial
        color="#fbbf24"
        wireframe={true}
        transparent={true}
        opacity={0.35}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export const WelcomeScreen = () => {
  const { workspaceDir, setWorkspaceDir, setFileTree } = useFileStore()
  const { setActiveView, setSidebarOpen, setChatOpen } = useUIStore()

  const handleOpenFolder = async () => {
    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      useProjectStore.getState().addProject(dirPath)
      setWorkspaceDir(dirPath)
      const tree = await window.api.readDirectory(dirPath)
      setFileTree(tree)
    }
  }

  const greeting = getGreeting()

  return (
    <div className="h-full w-full relative flex flex-col items-center justify-center overflow-hidden bg-[#0c0c0e]">
      {/* 3D Background - The Vortex Tunnel */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-100">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <fog attach="fog" args={['#0c0c0e', 2, 40]} />
          <VortexTunnel />
        </Canvas>
      </div>

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center gap-10 w-full px-6"
        style={{ maxWidth: '560px' }}
      >
        {/* Hero: greeting + branding */}
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.gentle }}
        >
          {/* Logo with top glow */}
          <div className="relative group cursor-default">
            <div
              className="w-[84px] h-[84px] rounded-[24px] flex items-center justify-center border transition-all duration-500 ease-out group-hover:-translate-y-1 relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
                borderColor: 'rgba(255,255,255,0.05)',
                boxShadow: '0 8px 32px -8px rgba(0,0,0,0.8)'
              }}
            >
              {/* Inner top glow */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)',
                  boxShadow: '0 1px 12px 1px rgba(251,191,36,0.3)'
                }}
              />
              <Code2
                size={32}
                className="text-zinc-500 transition-colors duration-500 group-hover:text-zinc-300"
                strokeWidth={1.2}
              />
            </div>
          </div>

          {/* Greeting + title */}
          <div className="text-center flex flex-col gap-1.5 relative z-10">
            <p className="text-body font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {greeting}
            </p>
            <h1
              className="font-semibold tracking-tight"
              style={{
                fontSize: '38px',
                lineHeight: 1.1,
                color: '#facc15'
              }}
            >
              Zen Workspace
            </h1>
            <p className="text-body mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Your distraction-free command center
            </p>
          </div>
        </motion.div>

        {/* Bento action grid */}
        <motion.div
          className="grid gap-3 w-full"
          style={{ gridTemplateColumns: '1fr 1fr' }}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: transition.stagger } }}
        >
          {/* Open Folder — primary hero card, spans 2 cols */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={handleOpenFolder}
            className="group relative p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer overflow-hidden"
            style={{
              gridColumn: 'span 2',
              backgroundColor: 'rgba(251,191,36,0.015)',
              borderColor: 'rgba(251,191,36,0.15)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(251,191,36,0.03)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.3)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(251,191,36,0.015)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.15)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
                  style={{ backgroundColor: 'rgba(251,191,36,0.12)' }}
                >
                  <FolderOpen size={22} strokeWidth={1.5} style={{ color: '#facc15' }} />
                </div>
                <div>
                  <p className="text-[15px] text-zinc-100 group-hover:text-white transition-colors font-semibold leading-tight">
                    Open Folder
                  </p>
                  <p className="text-body mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Open a workspace directory
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 group-hover:bg-amber-400/10"
                style={{
                  border: '1px solid rgba(251,191,36,0.25)',
                  color: '#facc15'
                }}
              >
                <span
                  className="text-[12px] font-bold tracking-wide uppercase"
                  style={{ color: '#facc15' }}
                >
                  Browse
                </span>
                <FolderOpen size={14} strokeWidth={2} style={{ color: '#facc15' }} />
              </div>
            </div>
          </motion.button>

          {/* Browse Files */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={() => {
              setSidebarOpen(true)
              setActiveView('explorer')
            }}
            className="group relative p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.05)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.02)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)'
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              >
                <FilePlus
                  size={18}
                  strokeWidth={1.5}
                  className="text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200"
                />
              </div>
              <span
                className="text-mono px-2 py-1 rounded-lg font-medium"
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: 'var(--color-text-muted)'
                }}
              >
                {mod}+B
              </span>
            </div>
            <p className="text-[15px] font-semibold text-zinc-200 group-hover:text-white transition-colors duration-200 leading-tight">
              Browse Files
            </p>
            <p className="text-body text-zinc-500 mt-0.5">Explore your project</p>
          </motion.button>

          {/* Terminal */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={() => setActiveView('terminal')}
            className="group relative p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.05)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.02)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)'
            }}
          >
            <div className="mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              >
                <Terminal
                  size={18}
                  strokeWidth={1.5}
                  className="text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200"
                />
              </div>
            </div>
            <p className="text-[15px] font-semibold text-zinc-200 group-hover:text-white transition-colors duration-200 leading-tight">
              Open Terminal
            </p>
            <p className="text-body text-zinc-500 mt-0.5">Start a session</p>
          </motion.button>

          {/* AI Assistant — spans 2 cols */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={() => setChatOpen(true)}
            className="group relative p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer"
            style={{
              gridColumn: 'span 2',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.05)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.02)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              >
                <MessageSquare
                  size={20}
                  strokeWidth={1.5}
                  className="text-zinc-400 group-hover:text-zinc-200"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-zinc-200 group-hover:text-white transition-colors leading-tight">
                  AI Assistant
                </p>
                <p className="text-body text-zinc-500 mt-0.5">Chat with your AI coding partner</p>
              </div>
              <span
                className="text-mono px-2 py-1 rounded-lg shrink-0 font-medium"
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: 'var(--color-text-muted)'
                }}
              >
                {mod}+I
              </span>
            </div>
          </motion.button>
        </motion.div>

        {/* Workspace path (only show if it exists, the screenshot has it) */}
        {workspaceDir && (
          <motion.div
            className="flex items-center gap-2 justify-center mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Folder size={14} className="text-zinc-600 shrink-0" strokeWidth={1.5} />
            <span
              className="text-mono truncate max-w-xs font-medium"
              style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}
            >
              {workspaceDir}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
