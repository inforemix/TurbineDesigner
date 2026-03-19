import { useEffect, useRef, useState } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
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
      <div className="w-full h-full flex flex-col bg-background text-foreground">
        <Header />

        {/* ── Main layout: resizable 3-column panel ─────────────────── */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup orientation="horizontal" className="h-full">

            {/* ── Left sidebar ──────────────────────────────────────── */}
            <Panel
              id="left-sidebar"
              defaultSize={15}
              minSize={10}
              maxSize={30}
              className="hidden md:flex md:flex-col border-r border-border bg-card"
            >
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  <PresetBrowser />
                  {mode === 'draw' && (
                    <div className="border-t border-border pt-5">
                      <NacaPanel />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Panel>

            {/* ── Left resize handle ────────────────────────────────── */}
            <PanelResizeHandle className="hidden md:flex w-1.5 items-center justify-center bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize group">
              <div className="w-px h-12 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
            </PanelResizeHandle>

            {/* ── Main canvas ───────────────────────────────────────── */}
            <Panel id="main-canvas" defaultSize={65} minSize={40}>
              <div className="h-full flex flex-col p-3">
                {mode === 'draw' ? (
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <div className="flex-1 relative rounded-xl border border-border overflow-hidden bg-background min-h-0">
                      <KaleidoscopeCanvas />
                      <PuzzleHUD />
                      <CanvasHint text="Click to add points · Drag to reshape · Freehand for curves · Ctrl+Z undo" />
                    </div>
                    <SectionPanel />
                  </div>
                ) : mode === 'side' ? (
                  <div className="flex-1 rounded-xl border border-border overflow-hidden bg-background min-h-0">
                    <SideViewCanvas />
                  </div>
                ) : (
                  <div className="flex-1 relative rounded-xl border border-border overflow-hidden bg-background min-h-0">
                    <TurbineViewer />
                    <CanvasHint text="Drag to orbit · Scroll to zoom · Wind particles show flow direction" />
                  </div>
                )}
              </div>

              {/* Mobile preset toggle */}
              <div className="absolute top-16 left-3 md:hidden z-20">
                <MobilePresetDrawer />
              </div>
            </Panel>

            {/* ── Right resize handle ───────────────────────────────── */}
            <PanelResizeHandle className="hidden lg:flex w-1.5 items-center justify-center bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize group">
              <div className="w-px h-12 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
            </PanelResizeHandle>

            {/* ── Right sidebar ─────────────────────────────────────── */}
            <Panel
              id="right-sidebar"
              defaultSize={20}
              minSize={14}
              maxSize={35}
              className="hidden lg:flex lg:flex-col border-l border-border bg-card"
            >
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  <ParameterPanel />
                  {mode === 'draw' && (
                    <div className="border-t border-border pt-5">
                      <BladeSectionEditor />
                    </div>
                  )}
                  {mode === 'view' && (
                    <div className="border-t border-border pt-5">
                      <PhysicsDashboard />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Panel>

          </PanelGroup>
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

/* ── Canvas hint pill ─────────────────────────────────────────────────────── */
function CanvasHint({ text }: { text: string }) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
      <div className="bg-card/90 backdrop-blur-md rounded-full px-4 py-2 border border-border shadow-lg">
        <span className="text-[10px] text-muted-foreground">{text}</span>
      </div>
    </div>
  )
}

/* ── Collapsible 2.5D section panel ──────────────────────────────────────── */
function SectionPanel() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="shrink-0 rounded-xl border border-border bg-card overflow-hidden transition-all duration-300"
      style={{ height: expanded ? 220 : 44 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-11 flex items-center justify-between px-4 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors font-semibold"
      >
        <span>2.5D Section View</span>
        <span>{expanded ? '▼' : '▲'}</span>
      </button>
      {expanded && (
        <div className="h-[176px] border-t border-border p-3">
          <SectionPreview />
        </div>
      )}
    </div>
  )
}

/* ── Mobile preset drawer ─────────────────────────────────────────────────── */
function MobilePresetDrawer() {
  return (
    <details className="group">
      <summary className="bg-card/95 backdrop-blur-md rounded-lg px-3 py-2 border border-border text-xs text-muted-foreground cursor-pointer list-none hover:text-primary hover:border-primary/30 transition-colors font-semibold shadow-lg">
        📋 Presets
      </summary>
      <div className="absolute top-12 left-0 bg-card backdrop-blur-xl rounded-xl border border-border shadow-2xl w-56 z-50 p-4">
        <PresetBrowser />
      </div>
    </details>
  )
}

/* ── Mobile bottom bar ────────────────────────────────────────────────────── */
function MobileBottomBar() {
  return (
    <div className="lg:hidden border-t border-border bg-card/80 backdrop-blur-md">
      <div className="max-h-56 overflow-y-auto p-4">
        <ParameterPanel />
      </div>
    </div>
  )
}
