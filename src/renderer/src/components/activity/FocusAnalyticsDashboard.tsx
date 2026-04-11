import { useMemo } from 'react'
import { useZenStore } from '../../store/useZenStore'

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function averageWpm(total: number, samples: number): number {
  if (samples === 0) return 0
  return Math.round(total / samples)
}

function calculateFocusScore(activeSeconds: number, avgWpmValue: number, filesTouched: number, linesChanged: number): number {
  const durationScore = Math.min(40, Math.round(activeSeconds / 180))
  const speedScore = Math.min(30, Math.round(avgWpmValue * 0.8))
  const breadthScore = Math.min(20, filesTouched * 2)
  const progressScore = Math.min(10, Math.round(linesChanged / 25))
  return Math.min(100, durationScore + speedScore + breadthScore + progressScore)
}

export const FocusAnalyticsDashboard = () => {
  const { dailyStats, focusSamples, continuousCodingTime } = useZenStore()

  const chartData = useMemo(() => {
    return Object.values(dailyStats)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
  }, [dailyStats])

  const today = chartData[chartData.length - 1]
  const maxSeconds = Math.max(...chartData.map((item) => item.activeSeconds), 1)
  const recentSamples = focusSamples.slice(-30)
  const maxWpm = Math.max(...recentSamples.map((sample) => sample.wpm), 1)
  const avgTodayWpm = today ? averageWpm(today.totalWpm, today.sampleCount) : 0
  const focusScore = today
    ? calculateFocusScore(today.activeSeconds, avgTodayWpm, today.filesTouched.length, today.linesChanged)
    : 0

  return (
    <div className="flex-1 flex flex-col bg-zinc-800 p-px gap-px font-mono text-[10px] uppercase overflow-hidden">
      
      {/* Top Header & Stats Ribbon */}
      <div className="flex flex-col lg:flex-row gap-px shrink-0">
        <div className="bg-[#000000] p-4 flex-1 flex flex-col justify-center">
          <h1 className="text-[14px] text-zinc-100 tracking-widest mb-1">Focus Analytics</h1>
          <p className="text-zinc-600 text-[9px]">Session telemetry matrix</p>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[120px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Streak</span>
          <span className="text-zinc-200 text-[16px]">{formatDuration(continuousCodingTime)}</span>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[120px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Focus Score</span>
          <span className="text-zinc-200 text-[16px]">{focusScore} <span className="text-[10px] text-zinc-600">/100</span></span>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[120px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Avg WPM</span>
          <span className="text-zinc-200 text-[16px]">{avgTodayWpm}</span>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[140px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Session Time</span>
          <span className="text-zinc-200 text-[16px]">{today ? formatDuration(today.activeSeconds) : '0m'}</span>
        </div>
      </div>

      {/* Main Workspace Split */}
      <div className="flex flex-col lg:flex-row flex-1 gap-px min-h-0">
        
        {/* Left Pane: Charts Vertical Stack */}
        <div className="flex flex-col w-full lg:w-[65%] gap-px min-h-0">
          
          {/* Top Half: WPM Trend Line Chart */}
          <div className="bg-[#000000] flex-1 flex flex-col p-4 relative min-h-[200px]">
            <div className="text-zinc-500 tracking-widest shrink-0 mb-4 z-10 flex justify-between">
              <span>WPM Telemetry</span>
              <span className="text-zinc-700">[SAMPLES_30]</span>
            </div>
            
            {recentSamples.length === 0 ? (
              <div className="m-auto text-zinc-700">Waiting for keystroke data</div>
            ) : (
              <div className="flex-1 w-full relative">
                <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible preserve-aspect-ratio-none">
                  {/* Minimalist Grid */}
                  <line x1="0" y1="40" x2="600" y2="40" stroke="#18181b" strokeWidth="1" />
                  <line x1="0" y1="80" x2="600" y2="80" stroke="#18181b" strokeWidth="1" />
                  <line x1="0" y1="120" x2="600" y2="120" stroke="#18181b" strokeWidth="1" />
                  <line x1="0" y1="160" x2="600" y2="160" stroke="#18181b" strokeWidth="1" />
                  <line x1="0" y1="200" x2="600" y2="200" stroke="#27272a" strokeWidth="1" />
                  
                  {/* Brutalist Sharp Path */}
                  <path
                    fill="none"
                    stroke="#e4e4e7"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    d={`M ${recentSamples
                      .map((sample, index) => {
                        const x = (index / Math.max(recentSamples.length - 1, 1)) * 600
                        const y = 200 - (sample.wpm / maxWpm) * 180
                        return `${x},${y}`
                      })
                      .join(' L ')}`}
                  />
                  
                  {/* Square Nodes */}
                  {recentSamples.map((sample, index) => {
                    const x = (index / Math.max(recentSamples.length - 1, 1)) * 600
                    const y = 200 - (sample.wpm / maxWpm) * 180
                    return (
                      <rect key={sample.timestamp} x={x - 2} y={y - 2} width="4" height="4" fill="#000000" stroke="#a1a1aa" strokeWidth="1" />
                    )
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Bottom Half: Weekly Bar Chart */}
          <div className="bg-[#000000] flex-1 flex flex-col p-4 relative min-h-[200px]">
            <div className="text-zinc-500 tracking-widest shrink-0 mb-4 z-10 flex justify-between">
              <span>Weekly Vector</span>
              <span className="text-zinc-700">[DAYS_7]</span>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-1 w-full h-full pt-4">
              {chartData.map((item) => {
                const heightPercent = Math.max(2, (item.activeSeconds / maxSeconds) * 100)
                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center h-full relative group">
                    {/* Tooltip */}
                    <div className="absolute -top-6 bg-zinc-200 text-black px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-nowrap">
                      {formatDuration(item.activeSeconds)}
                    </div>
                    
                    {/* Flat Mono Bar */}
                    <div className="w-full h-full flex items-end justify-center">
                      <div
                        className="w-full max-w-[24px] bg-zinc-700 group-hover:bg-zinc-400 transition-colors"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <div className="w-full border-t border-zinc-900 mt-2 pt-2 text-center">
                      <span className="text-zinc-500 group-hover:text-zinc-200 transition-colors truncate">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
        </div>

        {/* Right Pane: Modified Sectors (Files) */}
        <div className="bg-[#000000] w-full lg:w-[35%] flex flex-col min-h-0 relative">
          
          <div className="p-4 border-b border-zinc-800 text-zinc-500 tracking-widest sticky top-0 bg-[#000000] z-10 shrink-0 flex justify-between">
            <span>Modified Files</span>
            <span className="text-zinc-700">[{today?.filesTouched.length ?? 0}]</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-px bg-zinc-900/50">
            {today?.filesTouched.length ? (
              today.filesTouched.map((file) => (
                <div
                  key={file}
                  className="bg-[#000000] p-2 pl-3 text-zinc-400 normal-case hover:text-zinc-200 hover:bg-zinc-900 cursor-default transition-colors border-l border-zinc-800 hover:border-zinc-500 truncate"
                >
                  <span className="text-zinc-600 mr-2">/</span>
                  {file.split('/').pop() || file}
                  <span className="text-zinc-700 ml-2 text-[9px]">{file}</span>
                </div>
              ))
            ) : (
              <div className="bg-[#000000] p-4 text-center text-zinc-700 m-auto w-full">
                Buffer empty
              </div>
            )}
          </div>
          
        </div>

      </div>
    </div>
  )
}
