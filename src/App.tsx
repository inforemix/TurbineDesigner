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
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Desktop Left Sidebar */}
          {leftOpen && (
            <>
              <div className="hidden md:flex md:flex-col w-56 lg:w-64 bg-card border-r border-border shrink-0">
                <ScrollArea className="flex-1">
                  <div className="p-3 lg:p-4 space-y-5 lg:space-y-6">
                    <PresetBrowser />
                    <div className="border-t border-border pt-5 lg:pt-6">
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
                className="hidden md:flex h-12 w-8 p-0 rounded-none border-r border-border hover:bg-primary/10 shrink-0"
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
              className="hidden md:flex h-12 w-8 p-0 rounded-none border-r border-border hover:bg-primary/10 shrink-0"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col overflow-hidden p-2 sm:p-3 md:p-3 lg:p-4 gap-2 sm:gap-3 min-w-0">
            {mode === 'draw' ? (
              <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-h-0">
                <div className="flex-1 relative rounded-lg border border-border overflow-hidden bg-background min-h-0">
                  <KaleidoscopeCanvas />
                  <PuzzleHUD />
                  <CentralController />
                  <CanvasHint text="Click to add · Drag to reshape · Ctrl+Z undo" />
                </div>
                <SectionPanel />
              </div>
            ) : mode === 'side' ? (
              <div className="flex-1 rounded-lg border border-border overflow-hidden bg-background min-h-0">
                <SideViewCanvas />
              </div>
            ) : (
              <div className="flex-1 relative rounded-lg border border-border overflow-hidden bg-background min-h-0">
                <TurbineViewer />
                <CanvasHint text="Drag to orbit · Scroll to zoom · Auto-rotates when idle" />
              </div>
            )}

            {/* Mobile Preset Drawer */}
            <div className="md:hidden shrink-0">
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
                className="hidden lg:flex h-12 w-8 p-0 rounded-none border-l border-border hover:bg-primary/10 shrink-0"
                title="Collapse sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="hidden lg:flex lg:flex-col w-64 xl:w-72 bg-card border-l border-border shrink-0">
                <ScrollArea className="flex-1">
                  <div className="p-3 xl:p-4 space-y-5 xl:space-y-6">
                    <ParameterPanel />
                    {mode === 'draw' && (
                      <div className="border-t border-border pt-5 xl:pt-6">
                        <AirfoilSelector />
                      </div>
                    )}
                    {mode === 'draw' && (
                      <div className="border-t border-border pt-5 xl:pt-6">
                        <BladeSectionEditor />
                      </div>
                    )}
                    {mode === 'view' && (
                      <div className="border-t border-border pt-5 xl:pt-6">
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
              className="hidden lg:flex h-12 w-8 p-0 rounded-none border-l border-border hover:bg-primary/10 shrink-0"
              title="Expand sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Mobile bottom bar — shown on all non-desktop screens */}
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
    <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-2 w-full flex justify-center">
      <div className="bg-card/90 backdrop-blur-md rounded-full px-3 sm:px-4 py-1.5 sm:py-2 border border-border text-[9px] sm:text-[10px] text-muted-foreground shadow-lg whitespace-nowrap">
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
        variant="outline"
        className="w-full font-semibold text-sm h-10 border-border"
      >
        {open ? '✕ Hide Presets' : '📋 Show Presets'}
      </Button>
      {open && (
        <div className="absolute bottom-12 left-0 right-0 bg-card border border-border rounded-lg shadow-xl p-4 z-50 max-h-[60vh] overflow-y-auto">
          <PresetBrowser />
        </div>
      )}
    </div>
  )
}

function MobileBottomBar() {
  const { mode } = useTurbineStore()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'params' | 'airfoil' | 'section' | 'physics'>('params')

  const tabs = mode === 'draw'
    ? [
        { id: 'params' as const, label: 'Params' },
        { id: 'airfoil' as const, label: 'Airfoil' },
        { id: 'section' as const, label: 'Section' },
      ]
    : [
        { id: 'params' as const, label: 'Params' },
        { id: 'physics' as const, label: 'Physics' },
      ]

  return (
    <div className="lg:hidden border-t border-border bg-card/90 backdrop-blur-md shrink-0">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-11 flex items-center justify-between px-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="uppercase tracking-widest">{open ? '▼ Hide' : '▲ Show'} Controls</span>
        {open && (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors border"
                style={activeTab === tab.id
                  ? { background: 'var(--color-primary)', color: 'var(--color-primary-foreground)', borderColor: 'var(--color-primary)' }
                  : { background: 'transparent', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </button>

      {/* Panel content */}
      {open && (
        <div className="max-h-[45vh] overflow-y-auto border-t border-border p-3 sm:p-4">
          {activeTab === 'params' && <ParameterPanel />}
          {activeTab === 'airfoil' && mode === 'draw' && <AirfoilSelector />}
          {activeTab === 'section' && mode === 'draw' && <BladeSectionEditor />}
          {activeTab === 'physics' && mode === 'view' && <PhysicsDashboard />}
        </div>
      )}
    </div>
  )
}
