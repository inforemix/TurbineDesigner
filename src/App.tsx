import { useEffect } from 'react'
import { useTurbineStore } from './stores/turbineStore'
import Header from './components/ui/Header'
import KaleidoscopeCanvas from './components/canvas/KaleidoscopeCanvas'
import TurbineViewer from './components/viewer/TurbineViewer'
import ParameterPanel from './components/ui/ParameterPanel'
import PresetBrowser from './components/ui/PresetBrowser'

export default function App() {
  const { mode, updatePhysics } = useTurbineStore()

  // Initialize physics on mount
  useEffect(() => {
    updatePhysics()
  }, [updatePhysics])

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
              {/* Drawing hints overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-surface/80 backdrop-blur-sm rounded-full px-4 py-1.5 border border-border/40">
                  <span className="text-[10px] text-text-muted">
                    Click to add points · Drag to reshape · Points auto-sort by radius
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0">
              <TurbineViewer />
              {/* 3D hints overlay */}
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
