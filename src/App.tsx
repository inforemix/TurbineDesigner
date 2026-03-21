import { useEffect, useRef, useState } from 'react'
import { useTurbineStore } from './stores/turbineStore'
import { usePuzzleStore } from './stores/puzzleStore'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Header from './components/ui/Header'
import KaleidoscopeCanvas from './components/canvas/KaleidoscopeCanvas'
import SideViewCanvas from './components/canvas/SideViewCanvas'
import TurbineViewer from './components/viewer/TurbineViewer'
import ParameterPanel from './components/ui/ParameterPanel'
import PresetBrowser from './components/ui/PresetBrowser'
import NacaPanel from './components/ui/NacaPanel'
import PhysicsDashboard from './components/ui/PhysicsDashboard'
import BladeSectionStacker from './components/ui/BladeSectionStacker'
import PuzzleHUD from './components/puzzle/PuzzleHUD'
import ChallengeList from './components/puzzle/ChallengeList'
import Celebration from './components/puzzle/Celebration'
import BladeSectionEditor from './components/editor/BladeSectionEditor'
import SectionPreview from './components/editor/SectionPreview'
import CentralController from './components/ui/CentralController'
import AirfoilSelector from './components/ui/AirfoilSelector'
import { TooltipProvider } from './components/ui/tooltip'
import { ScrollArea } from './components/ui/scroll-area'
import { Button } from './components/ui/button'

export default function App() {
  const { mode, updatePhysics, setTransitioning, setTransitionProgress } = useTurbineStore()
  const { showChallengeList } = usePuzzleStore()
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
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

        {/* Main content area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Desktop Left Sidebar */}
          {leftOpen && (
            <>
              <div className="hidden md:flex md:flex-col w-64 bg-card border-r border-border">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    <PresetBrowser />
                    <div className="border-t border-border pt-6">
                      <BladeSectionStacker />
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Collapse button for left sidebar */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLeftOpen(false)}
                className="hidden md:flex h-12 w-12 p-0 rounded-none border-r border-border hover:bg-primary/10"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Expand button for left sidebar when collapsed */}
          {!leftOpen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLeftOpen(true)}
              className="hidden md:flex h-12 w-12 p-0 rounded-none border-r border-border hover:bg-primary/10"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4 gap-3">
            {mode === 'draw' ? (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="flex-1 relative rounded-lg border border-border overflow-hidden bg-background min-h-0">
                  <KaleidoscopeCanvas />
                  <PuzzleHUD />
                  <CentralController />
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
                <CanvasHint text="Drag to orbit · Scroll to zoom · Auto-rotates when idle" />
              </div>
            )}

            {/* Mobile Preset Menu */}
            <div className="md:hidden">
              <MobilePresetDrawer />
            </div>
          </div>

          {/* Desktop Right Sidebar */}
          {rightOpen && (
            <>
              {/* Collapse button for right sidebar */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRightOpen(false)}
                className="hidden lg:flex h-12 w-12 p-0 rounded-none border-l border-border hover:bg-primary/10"
                title="Collapse sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="hidden lg:flex lg:flex-col w-72 bg-card border-l border-border">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    <ParameterPanel />
                    {mode === 'draw' && (
                      <div className="border-t border-border pt-6">
                        <AirfoilSelector />
                      </div>
                    )}
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
              </div>
            </>
          )}

          {/* Expand button for right sidebar when collapsed */}
          {!rightOpen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRightOpen(true)}
              className="hidden lg:flex h-12 w-12 p-0 rounded-none border-l border-border hover:bg-primary/10"
              title="Expand sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
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
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        onClick={() => setOpen(!open)}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        📋 {open ? 'Hide' : 'Show'} Presets
      </Button>
      {open && (
        <div className="absolute top-12 left-0 right-0 bg-card border border-border rounded-lg shadow-xl p-4 z-50">
          <PresetBrowser />
        </div>
      )}
    </div>
  )
}

function MobileBottomBar() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden border-t border-border bg-card/80 backdrop-blur-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-12 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? '▼ Hide' : '▲ Show'} Parameters
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border p-4">
          <ParameterPanel />
        </div>
      )}
    </div>
  )
}
