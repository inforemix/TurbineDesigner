import { useEffect, useRef } from 'react'
import { useTurbineStore } from './stores/turbineStore'
import { usePuzzleStore } from './stores/puzzleStore'
import Header from './components/ui/Header'
import KaleidoscopeCanvas from './components/canvas/KaleidoscopeCanvas'
import SideViewCanvas from './components/canvas/SideViewCanvas'
import TurbineViewer from './components/viewer/TurbineViewer'
import ParameterPanel from './components/ui/ParameterPanel'
import PresetBrowser from './components/ui/PresetBrowser'
import PuzzleHUD from './components/puzzle/PuzzleHUD'
import ChallengeList from './components/puzzle/ChallengeList'
import Celebration from './components/puzzle/Celebration'

export default function App() {
  const { mode, updatePhysics, setTransitioning, setTransitionProgress } = useTurbineStore()
  const { showChallengeList } = usePuzzleStore()
  const prevModeRef = useRef(mode)
  const transitionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    updatePhysics()
  }, [updatePhysics])

  useEffect(() => {
    if ((prevModeRef.current === 'draw' || prevModeRef.current === 'side') && mode === 'view') {
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
    <div className="w-full h-full flex flex-col bg-void">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Presets */}
        <aside className="w-48 border-r border-border/40 bg-deep/60 overflow-y-auto hidden md:block">
          <PresetBrowser />
        </aside>

        {/* Main canvas area */}
        <main className="flex-1 relative">
          {mode === 'draw' ? (
            <div className="absolute inset-0">
              <KaleidoscopeCanvas />
              {/* Puzzle HUD overlay */}
              <PuzzleHUD />
              {/* Drawing hints overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-surface/80 backdrop-blur-sm rounded-full px-4 py-1.5 border border-border/40">
                  <span className="text-[10px] text-text-muted">
                    Click to add · Drag to reshape · Right-click to delete · Ctrl+Z to undo
                  </span>
                </div>
              </div>
            </div>
          ) : mode === 'side' ? (
            <div className="absolute inset-0">
              <SideViewCanvas />
            </div>
          ) : (
            <div className="absolute inset-0">
              <TurbineViewer />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-surface/80 backdrop-blur-sm rounded-full px-4 py-1.5 border border-border/40">
                  <span className="text-[10px] text-text-muted">
                    Drag to orbit · Scroll to zoom · Wind particles show flow direction
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mobile preset toggle */}
          <div className="absolute top-3 left-3 md:hidden">
            <MobilePresetDrawer />
          </div>
        </main>

        {/* Right sidebar - Parameters */}
        <aside className="w-56 border-l border-border/40 bg-deep/60 overflow-y-auto hidden lg:block">
          <ParameterPanel />
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <MobileBottomBar />

      {/* Global overlays */}
      {showChallengeList && <ChallengeList />}
      <Celebration />
    </div>
  )
}

function MobilePresetDrawer() {
  return (
    <details className="group">
      <summary className="bg-surface/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/40 text-xs text-text-dim cursor-pointer list-none">
        ☰ Presets
      </summary>
      <div className="absolute top-10 left-0 bg-deep/95 backdrop-blur-md rounded-xl border border-border/40 shadow-2xl w-48 z-50">
        <PresetBrowser />
      </div>
    </details>
  )
}

function MobileBottomBar() {
  return (
    <div className="lg:hidden border-t border-border/40 bg-deep/80 backdrop-blur-sm">
      <div className="max-h-48 overflow-y-auto">
        <ParameterPanel />
      </div>
    </div>
  )
}
