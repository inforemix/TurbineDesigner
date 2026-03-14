import { useEffect, useRef, useState } from 'react'
import { useTurbineStore } from './stores/turbineStore'
import Header from './components/ui/Header'
import KaleidoscopeCanvas from './components/canvas/KaleidoscopeCanvas'
import TurbineViewer from './components/viewer/TurbineViewer'
import ParameterPanel from './components/ui/ParameterPanel'
import PresetBrowser from './components/ui/PresetBrowser'
import BladeSectionEditor from './components/editor/BladeSectionEditor'
import SectionPreview from './components/editor/SectionPreview'

export default function App() {
  const { mode, updatePhysics, setTransitioning, setTransitionProgress } = useTurbineStore()
  const prevModeRef = useRef(mode)
  const transitionTimerRef = useRef<number | null>(null)

  // Initialize physics on mount
  useEffect(() => {
    updatePhysics()
  }, [updatePhysics])

  // Bloom transition when switching to 3D view
  useEffect(() => {
    if (prevModeRef.current === 'draw' && mode === 'view') {
      setTransitioning(true)
      setTransitionProgress(0)

      let start: number | null = null
      const duration = 800

      const animate = (ts: number) => {
        if (start === null) start = ts
        const elapsed = ts - start
        const progress = Math.min(1, elapsed / duration)
        setTransitionProgress(progress)

        if (progress < 1) {
          transitionTimerRef.current = requestAnimationFrame(animate)
        } else {
          setTransitioning(false)
          setTransitionProgress(1)
        }
      }
      transitionTimerRef.current = requestAnimationFrame(animate)
    }
    prevModeRef.current = mode

    return () => {
      if (transitionTimerRef.current) {
        cancelAnimationFrame(transitionTimerRef.current)
      }
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
            <div className="absolute inset-0 flex flex-col">
              {/* Drawing canvas */}
              <div className="flex-1 relative">
                <KaleidoscopeCanvas />
                {/* Drawing hints overlay */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="bg-surface/80 backdrop-blur-sm rounded-full px-4 py-1.5 border border-border/40">
                    <span className="text-[10px] text-text-muted">
                      Click to add points · Drag to reshape · Draw freehand for smooth curves · Ctrl+Z undo
                    </span>
                  </div>
                </div>
              </div>

              {/* 2.5D Section Preview (collapsible) */}
              <SectionPanel />
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

        {/* Right sidebar - Parameters + Section Editor */}
        <aside className="w-56 border-l border-border/40 bg-deep/60 overflow-y-auto hidden lg:block">
          <ParameterPanel />
          {mode === 'draw' && (
            <div className="border-t border-border/40">
              <BladeSectionEditor />
            </div>
          )}
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <MobileBottomBar />
    </div>
  )
}

function SectionPanel() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="border-t border-border/40 bg-deep/80 backdrop-blur-sm transition-all"
      style={{ height: expanded ? 200 : 36 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-9 flex items-center justify-between px-4 text-[10px] uppercase tracking-widest text-text-muted hover:text-teal transition-colors"
      >
        <span>2.5D Section View</span>
        <span className="text-text-dim">{expanded ? '▼' : '▲'}</span>
      </button>
      {expanded && (
        <div className="h-[164px]">
          <SectionPreview />
        </div>
      )}
    </div>
  )
}

function MobilePresetDrawer() {
  return (
    <details className="group">
      <summary className="bg-surface/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/40 text-xs text-text-dim cursor-pointer list-none">
        Presets
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
