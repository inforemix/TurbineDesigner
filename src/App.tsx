import { useEffect, useRef, useState } from 'react'
import { useTurbineStore } from './stores/turbineStore'
import { usePuzzleStore } from './stores/puzzleStore'
import Header from './components/ui/Header'
import KaleidoscopeCanvas from './components/canvas/KaleidoscopeCanvas'
import SideViewCanvas from './components/canvas/SideViewCanvas'
import TurbineViewer from './components/viewer/TurbineViewer'
import ParameterPanel from './components/ui/ParameterPanel'
import PresetBrowser from './components/ui/PresetBrowser'
import NacaPanel from './components/ui/NacaPanel'
import PhysicsDashboard from './components/ui/PhysicsDashboard'
import PuzzleHUD from './components/puzzle/PuzzleHUD'
import ChallengeList from './components/puzzle/ChallengeList'
import Celebration from './components/puzzle/Celebration'
import BladeSectionEditor from './components/editor/BladeSectionEditor'
import SectionPreview from './components/editor/SectionPreview'
import { TooltipProvider } from './components/ui/tooltip'
import { ScrollArea } from './components/ui/scroll-area'

export default function App() {
  const { mode, updatePhysics, setTransitioning, setTransitionProgress } = useTurbineStore()
  const { showChallengeList } = usePuzzleStore()
  const prevModeRef = useRef(mode)
  const transitionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    updatePhysics()
  }, [updatePhysics])

  useEffect(() => {
    if (prevModeRef.current === 'draw' && mode === 'view') {
      setTransitioning(true)
      setTransitionProgress(0)

      const duration = 1200
      const startTime = performance.now()

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration)
        setTransitionProgress(progress)
        if (progress < 1) {
          transitionTimerRef.current = requestAnimationFrame(tick)
        } else {
          setTransitioning(false)
        }
      }
      transitionTimerRef.current = requestAnimationFrame(tick)
    }
    prevModeRef.current = mode

    return () => {
      if (transitionTimerRef.current) cancelAnimationFrame(transitionTimerRef.current)
    }
  }, [mode, setTransitioning, setTransitionProgress])

  return (
    <TooltipProvider>
      <div className="w-full h-full flex flex-col bg-void text-text">
        <Header />

        <div className="flex-1 flex overflow-hidden gap-0">
          {/* Left sidebar */}
          <aside className="w-56 border-r border-border/30 bg-surface/30 backdrop-blur-sm overflow-hidden hidden md:flex md:flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <PresetBrowser />
                {mode === 'draw' && (
                  <div className="border-t border-border/30 pt-4">
                    <NacaPanel />
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Main canvas */}
          <main className="flex-1 relative flex flex-col">
            {mode === 'draw' ? (
              <div className="absolute inset-0 flex flex-col p-4">
                <div className="flex-1 relative rounded-lg border border-border/30 overflow-hidden">
                  <KaleidoscopeCanvas />
                  <PuzzleHUD />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                    <div className="bg-surface/90 backdrop-blur-md rounded-full px-4 py-2 border border-teal/20 shadow-lg">
                      <span className="text-[10px] text-text-muted">
                        Click to add points · Drag to reshape · Draw freehand for smooth curves · Ctrl+Z undo
                      </span>
                    </div>
                  </div>
                </div>
                <SectionPanel />
              </div>
            ) : mode === 'side' ? (
              <div className="absolute inset-0 p-4">
                <div className="h-full w-full rounded-lg border border-border/30 overflow-hidden">
                  <SideViewCanvas />
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 p-4">
                <div className="h-full w-full rounded-lg border border-border/30 overflow-hidden">
                  <TurbineViewer />
                </div>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                  <div className="bg-surface/90 backdrop-blur-md rounded-full px-4 py-2 border border-teal/20 shadow-lg">
                    <span className="text-[10px] text-text-muted">
                      Drag to orbit · Scroll to zoom · Wind particles show flow direction
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile preset toggle */}
            <div className="absolute top-6 left-6 md:hidden z-20">
              <MobilePresetDrawer />
            </div>
          </main>

          {/* Right sidebar */}
          <aside className="w-64 border-l border-border/30 bg-surface/30 backdrop-blur-sm overflow-hidden hidden lg:flex lg:flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <ParameterPanel />
                {mode === 'draw' && (
                  <div className="border-t border-border/30 pt-4">
                    <BladeSectionEditor />
                  </div>
                )}
                {mode === 'view' && (
                  <div className="border-t border-border/30 pt-4">
                    <PhysicsDashboard />
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>
        </div>

        {/* Mobile bottom bar */}
        <MobileBottomBar />

        {/* Global overlays */}
        {showChallengeList && <ChallengeList />}
        <Celebration />
      </div>
    </TooltipProvider>
  )
}

function SectionPanel() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="mt-4 border border-border/30 rounded-lg bg-surface/40 backdrop-blur-sm transition-all overflow-hidden"
      style={{ height: expanded ? 240 : 44 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-11 flex items-center justify-between px-4 text-xs uppercase tracking-widest text-text-muted hover:text-teal hover:bg-teal/5 transition-colors font-medium"
      >
        <span>2.5D Section View</span>
        <span className="text-text-dim">{expanded ? '▼' : '▲'}</span>
      </button>
      {expanded && (
        <div className="h-[196px] border-t border-border/20 p-3">
          <SectionPreview />
        </div>
      )}
    </div>
  )
}

function MobilePresetDrawer() {
  return (
    <details className="group">
      <summary className="bg-surface/95 backdrop-blur-md rounded-lg px-3 py-2 border border-teal/20 text-xs text-text-dim cursor-pointer list-none hover:bg-surface hover:text-teal transition-colors font-medium shadow-lg">
        📋 Presets
      </summary>
      <div className="absolute top-12 left-0 bg-surface/98 backdrop-blur-xl rounded-lg border border-teal/20 shadow-2xl w-56 z-50 p-3">
        <PresetBrowser />
      </div>
    </details>
  )
}

function MobileBottomBar() {
  return (
    <div className="lg:hidden border-t border-border/30 bg-surface/40 backdrop-blur-md">
      <div className="max-h-56 overflow-y-auto p-4">
        <ParameterPanel />
      </div>
    </div>
  )
}
