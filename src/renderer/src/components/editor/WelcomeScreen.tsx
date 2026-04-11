import { FolderOpen, Terminal, MessageSquare, Folder, Plus } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useProjectStore, Project } from '../../store/useProjectStore'
import { WeatherTimeWidget } from '../ui/WeatherTimeWidget'
import { motion } from 'framer-motion'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'

const GeometricCube = () => (
  <div className="perspective-[1000px] w-20 h-20">
    <motion.div
      animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      className="relative w-full h-full [transform-style:preserve-3d]"
    >
      {[
        'translateZ(40px)',
        'rotateY(180deg) translateZ(40px)',
        'rotateY(90deg) translateZ(40px)',
        'rotateY(-90deg) translateZ(40px)',
        'rotateX(90deg) translateZ(40px)',
        'rotateX(-90deg) translateZ(40px)'
      ].map((transform, i) => (
        <div
          key={i}
          className="absolute inset-0 border border-[333333] bg-[#0a0a0a]/80 backdrop-blur-md flex/items-center justify-center"
          style={{ transform }}
        >
          <div className="w-2 h-2 bg-[#444444]" />
        </div>
      ))}
    </motion.div>
  </div>
)

export const WelcomeScreen = () => {
  const { setWorkspaceDir, setFileTree } = useFileStore()
  const { setActiveView, setChatOpen } = useUIStore()
  const projects = useProjectStore((s) => s.projects)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  const recentProjects = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 8)

  const handleOpenFolder = async () => {
    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      useProjectStore.getState().addProject(dirPath)
      setWorkspaceDir(dirPath)
      const tree = await window.api.readDirectory(dirPath)
      setFileTree(tree)
    }
  }

  const handleOpenRecent = async (project: Project) => {
    setActiveProject(project.id)
    setWorkspaceDir(project.path)
    const tree = await window.api.readDirectory(project.path)
    setFileTree(tree)
  }

  return (
    <div className="relative h-full w-full bg-[#050505] text-[#cccccc] overflow-hidden selection:bg-[#333333] flex items-center justify-center px-6 md:px-12">
      {/* Architectural Perspective Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div
          className="absolute inset-[-100%] [transform:perspective(1000px)_rotateX(75deg)_translateY(-100px)_scale(2)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)',
            backgroundSize: '4rem 4rem',
            maskImage: 'radial-gradient(ellipse 60% 60% at 50% 10%, #000 40%, transparent 100%)'
          }}
        />
      </div>

      <WeatherTimeWidget />

      {/* Main Studio Frame */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[900px] bg-[#0a0a0a]/80 backdrop-blur-2xl border border-[#222222] p-10 md:p-16 shadow-2xl flex flex-col md:flex-row gap-16 md:gap-24"
      >
        {/* Engineering Corner Accents (Crosshairs) */}
        <Plus
          className="absolute -top-3 -left-3 text-[#555] opacity-50"
          size={24}
          strokeWidth={1}
        />
        <Plus
          className="absolute -top-3 -right-3 text-[#555] opacity-50"
          size={24}
          strokeWidth={1}
        />
        <Plus
          className="absolute -bottom-3 -left-3 text-[#555] opacity-50"
          size={24}
          strokeWidth={1}
        />
        <Plus
          className="absolute -bottom-3 -right-3 text-[#555] opacity-50"
          size={24}
          strokeWidth={1}
        />

        {/* Left Column: Start Actions */}
        <div className="flex-1 min-w-[280px]">
          <div className="mb-12 flex items-start gap-8">
            <div>
              <h1 className="text-[32px] font-normal tracking-tight text-[#eeeeee] leading-tight">
                Vibe Studio
              </h1>
              <p className="text-[13px] text-[3777777] mt-3 font-mono flex/items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[3444] rounded-none animate-pulse" />
                System initialized.
              </p>
            </div>
            <div className="hidden md:block ml-auto opacity-80">
              <GeometricCube />
            </div>
          </div>

          <h2 className="text-[11px] font-medium text-[#555555] tracking-widest uppercase mb-4">
            Initialize
          </h2>
          <div className="flex flex-col space-y-1">
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-4 px-4 py-3 border border-transparent border-l-[#222222] rounded-none hover:bg-[#111111] hover:border-l-[#eeeeee] transition-all duration-200 text-[13px] text-[999999] group text-left cursor-pointer outline-none focus-visible:bg-[#111111] focus-visible:border-l-[#eeeeee]"
            >
              <FolderOpen
                size={16}
                strokeWidth={1}
                className="text-[#666666] group-hover:text-[#eeeeee] transition-colors duration-200"
              />
              <span className="flex-1 font-light">Open Folder...</span>
              <span className="text-[11px] text-[#555555] font-mono group-hover:text-[#999999] transition-colors">
                {mod} O
              </span>
            </button>
            <button
              onClick={() => setActiveView('terminal')}
              className="flex items-center gap-4 px-4 py-3 border border-transparent border-l-[#222222] rounded-none hover:bg-[#111111] hover:border-l-[3eeeeee] transition-all duration-200 text-[13px] text-[#999999] group text-left cursor-pointer outline-none focus-visible:bg-[3111111] focus-visible:border-l-[3eeeeee]"
            >
              <Terminal
                size={16}
                strokeWidth={1}
                className="text-[#666666] group-hover:text-[#eeeeee] transition-colors duration-200"
              />
              <span className="flex-1 font-light">New Terminal Session</span>
              <span className="text-[11px] text-[#555555] font-mono group-hover:text-[#999999] transition-colors">
                {mod} `
              </span>
            </button>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-4 px-4 py-3 border border-transparent border-l-[#222222] rounded-none hover:bg-[3111111] hover:border-l-[#eeeeee] transition-all duration-200 text-[13px] text-[#999999] group text-left cursor-pointer outline-none focus-visible:bg-[#111111] focus-visible:border-l-[#eeeeee]"
            >
              <MessageSquare
                size={16}
                strokeWidth={1}
                className="text-[#666666] group-hover:text-[#eeeeee] transition-colors duration-200"
              />
              <span className="flex-1 font-light">Chat Assistant</span>
              <span className="text-[11px] text-[#555555] font-mono group-hover:text-[#999999] transition-colors">
                {mod} I
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Recent */}
        <div className="flex-1 min-w-[280px]">
          <h2 className="text-[11px] font-medium text-[#555555] tracking-widest uppercase mb-4 mt-2 md:mt-[124px]">
            Active Workspaces
          </h2>
          {recentProjects.length > 0 ? (
            <div className="flex flex-col space-y-1">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleOpenRecent(project)}
                  className="flex items-start gap-4 px-4 py-3 border border-transparent border-l-[#222222] rounded-none hover:bg-[#111111] hover:border-l-[3eeeeee] transition-all duration-200 text-left cursor-pointer outline-none group focus-visible:bg-[3111111] focus-visible:border-l-[3eeeeee]"
                >
                  <Folder
                    size={16}
                    strokeWidth={1}
                    className="text-[#666666] mt-0.5 group-hover:text-[#eeeeee] transition-colors duration-200"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-light text-[#999999] group-hover:text-[#eeeeee] transition-colors duration-200 truncate">
                      {project.name}
                    </span>
                    <span
                      className="text-[11px] text-[#555555] truncate mt-1 font-mono group-hover:text-[3777777] transition-colors duration-200"
                      title={project.path}
                    >
                      {project.path}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-[13px] text-[#555555] font-light border-l border-[#222222]">
              No recent workspaces found.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
