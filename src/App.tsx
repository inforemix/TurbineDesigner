import { useEffect, useRef, useState } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'
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

        {/* Main resizable layout */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup>
            {/* Left sidebar - Presets */}
            <Panel defaultSize={16} minSize={10} maxSize={28} className="hidden md:block bg-card border-r border-border">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  <PresetBrowser />
                  {mode === 'draw' && (
                    <div className="border-t border-border pt-6">
                      <NacaPanel />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Panel>

            {/* Resize handle - left */}
            <Separator className="w-1 bg-border hover:bg-primary/40 transition-colors" />

            {/* Main canvas */}
            <Panel defaultSize={55} minSize={35}>
              <div className="h-full flex flex-col p-4 gap-3">
                {mode === 'draw' ? (
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <div className="flex-1 relative rounded-lg border border-border overflow-hidden bg-background min-h-0">
                      <KaleidoscopeCanvas />
                      <PuzzleHUD />
                      <CanvasHint text="Click to add · Drag to reshape · Ctrl+Z undo" />
                    </div>
                    <SectionPanel />
                  </div>
                ) : mode === 'side' ? (
                  <div className="flex-1 rounded-lg border border-border overflow-hidden bg-background">
                    <SideViewCanvas />
                  </div>
                ) : (
                  <div className="flex-1 relative rounded-lg border border-border overflow-hidden bg-background">
                    <TurbineViewer />
                    <CanvasHint text="Drag to orbit · Scroll to zoom" />
                  </div>
                )}
              </div>

              {/* Mobile preset button */}
              <div className="absolute top-16 left-4 md:hidden z-20">
                <MobilePresetDrawer />
              </div>
            </Panel>

            {/* Resize handle - right */}
            <Separator className="w-1 bg-border hover:bg-primary/40 transition-colors hidden lg:block" />

            {/* Right sidebar - Parameters */}
            <Panel defaultSize={29} minSize={16} maxSize={40} className="hidden lg:block bg-card border-l border-border">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  <ParameterPanel />
                  {mode === 'draw' && (
                    <div className="border-t border-border pt-6">
                      <BladeSectionEditor />
                    </div>
                  )}
                  {mode === 'view' && (
                    <div className="border-t border-border pt-6">
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

        {/* Overlays */}
        {showChallengeList && <ChallengeList />}
        <Celebration />
      </div>
    </TooltipProvider>
  )
}

function CanvasHint({ text }: { text: string }) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
      <div className="bg-card/90 backdrop-blur-md rounded-full px-4 py-2 border border-border text-[10px] text-muted-foreground shadow-lg">
        {text}
      </div>
    </div>
  )
}

function SectionPanel() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="shrink-0 rounded-lg border border-border bg-card overflow-hidden transition-all duration-300"
      style={{ height: expanded ? 220 : 44 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-11 flex items-center justify-between px-4 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 font-semibold transition-colors"
      >
        <span>2.5D Section</span>
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

function MobilePresetDrawer() {
  return (
    <details className="group">
      <summary className="bg-card/95 backdrop-blur-md rounded-lg px-3 py-2 border border-border text-xs text-muted-foreground cursor-pointer list-none hover:text-primary transition-colors font-semibold shadow-lg">
        📋 Presets
      </summary>
      <div className="absolute top-12 left-0 bg-card backdrop-blur-xl rounded-lg border border-border shadow-xl w-52 z-50 p-3">
        <PresetBrowser />
      </div>
    </details>
  )
}

function MobileBottomBar() {
  return (
    <div className="lg:hidden border-t border-border bg-card/80 backdrop-blur-md max-h-52 overflow-y-auto">
      <div className="p-4">
        <ParameterPanel />
      </div>
    </div>
  )
}
