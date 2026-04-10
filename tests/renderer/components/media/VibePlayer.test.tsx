import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VibePlayer } from '../../../../src/renderer/src/components/media/VibePlayer'
import { useMediaStore } from '../../../../src/renderer/src/store/useMediaStore'
import { useUIStore } from '../../../../src/renderer/src/store/useUIStore'

// Mock dependencies
vi.mock('../../../../src/renderer/src/store/useMediaStore', () => ({
  useMediaStore: vi.fn()
}))

vi.mock('../../../../src/renderer/src/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

vi.mock('../../../../src/renderer/src/components/media/AudioVisualizer3D', () => ({
  AudioVisualizer3D: () => <div data-testid="mock-audio-visualizer" />
}))

describe('VibePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides the player overlay when isVibePlayerOpen is false', () => {
    vi.mocked(useUIStore).mockReturnValue({
      isVibePlayerOpen: false,
      setVibePlayerOpen: vi.fn(),
      setMusicGeneratorOpen: vi.fn()
    } as any)

    vi.mocked(useMediaStore).mockReturnValue({
      currentVibe: null,
      customVibe: null,
      isPlaying: false,
      volume: 50,
      setCurrentVibe: vi.fn(),
      setIsPlaying: vi.fn(),
      setVolume: vi.fn()
    } as any)

    render(<VibePlayer />)
    // The player should have opacity 0 and pointerEvents none
    const overlay = screen.getByText('Select Vibe').closest('.fixed.bottom-8')
    expect(overlay).toHaveStyle('opacity: 0')
    expect(overlay).toHaveStyle('pointer-events: none')
  })

  it('renders and displays the correct vibe name', () => {
    vi.mocked(useUIStore).mockReturnValue({
      isVibePlayerOpen: true,
      setVibePlayerOpen: vi.fn(),
      setMusicGeneratorOpen: vi.fn()
    } as any)

    vi.mocked(useMediaStore).mockReturnValue({
      currentVibe: 'lofi',
      customVibe: null,
      isPlaying: false,
      volume: 50,
      setCurrentVibe: vi.fn(),
      setIsPlaying: vi.fn(),
      setVolume: vi.fn()
    } as any)

    render(<VibePlayer />)
    expect(screen.getByText('Lofi')).toBeInTheDocument()
  })

  it('toggles play/pause state when the main button is clicked', () => {
    const setIsPlayingMock = vi.fn()

    vi.mocked(useUIStore).mockReturnValue({
      isVibePlayerOpen: true,
      setVibePlayerOpen: vi.fn(),
      setMusicGeneratorOpen: vi.fn()
    } as any)

    vi.mocked(useMediaStore).mockReturnValue({
      currentVibe: 'lofi',
      customVibe: null,
      isPlaying: false,
      volume: 50,
      setCurrentVibe: vi.fn(),
      setIsPlaying: setIsPlayingMock,
      setVolume: vi.fn()
    } as any)

    const { container } = render(<VibePlayer />)
    const playButton = container.querySelector('button') // The play toggle button is the first button
    expect(playButton).not.toBeNull()

    fireEvent.click(playButton!)
    expect(setIsPlayingMock).toHaveBeenCalledWith(true)
  })
})
