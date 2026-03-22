import { useState, useMemo } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'
import { solveDMST } from '../../physics/dmst'

export default function PhysicsDashboardCompact() {
  const [open, setOpen] = useState(false)
  const { windSpeed, bladeCount, height, thickness, bloomTier } = useTurbineStore()

  const radius = 0.5
  const chord = thickness * 2 + 0.05

  const dmstInput = useMemo(
    () => ({
      windSpeed: Math.max(windSpeed, 0.5),
      radius,
      height,
      numBlades: bladeCount,
      chord,
      tsr: 3.5,
    }),
    [windSpeed, height, bladeCount, chord]
  )

  const result = useMemo(() => solveDMST(dmstInput), [dmstInput])

  // Capacity factor estimate
  const cf = Math.min(result.cp / 0.593, 0.95) * 0.35
  const annualEnergy = ((result.power * cf * 8760) / 1000).toFixed(1)

  // Color coding based on efficiency
  const efficiencyPercent = Math.min((result.cp / 0.593) * 100, 100)
  const efficiencyColor =
    efficiencyPercent >= 50 ? '#10b981' :
    efficiencyPercent >= 30 ? '#f59e0b' :
    '#ef4444'

  const statusColors = {
    dormant: '#64748b',
    seedling: '#2dd4bf',
    flourishing: '#fbbf24',
    radiant: '#f472b6',
  }

  return (
    <div className="absolute top-3 right-3 z-20">
      {/* Toggle icon button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Physics Dashboard"
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all border shadow-md backdrop-blur-md ${
          open
            ? 'bg-amber-500/30 border-amber-400/60 text-amber-300 shadow-amber-500/20'
            : 'bg-card/80 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground hover:border-border'
        }`}
      >
        ⚙️
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-11 right-0 w-80 bg-card/97 backdrop-blur-md rounded-xl border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-secondary/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Physics Performance</span>
            <button onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs px-1">✕</button>
          </div>

          <div className="p-4 flex flex-col gap-4">

            {/* Status & Power Card */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Status</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg" style={{ color: statusColors[bloomTier] }}>●</span>
                  <span className="text-sm font-bold capitalize" style={{ color: statusColors[bloomTier] }}>
                    {bloomTier}
                  </span>
                </div>
              </div>

              {/* Power Output */}
              <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Power Output</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                    {result.power.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">W</span>
                </div>
              </div>
            </div>

            {/* Efficiency Card */}
            <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Efficiency (Cp)</p>
                <span className="text-sm font-mono font-bold" style={{ color: efficiencyColor }}>
                  {efficiencyPercent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden border border-border/20">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${efficiencyPercent}%`,
                    background: `linear-gradient(90deg, ${efficiencyColor}80, ${efficiencyColor})`
                  }}
                />
              </div>
              <div className="text-[8px] text-muted-foreground mt-1 text-right">Betz limit: 59.3%</div>
            </div>

            {/* Key Metrics */}
            <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Operating Conditions</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Wind Speed</span>
                  <span className="font-mono font-bold text-foreground">{windSpeed.toFixed(1)} m/s</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Tip Speed Ratio (λ)</span>
                  <span className="font-mono font-bold text-foreground">3.5</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Torque</span>
                  <span className="font-mono font-bold text-foreground">{result.torque.toFixed(1)} Nm</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">RPM</span>
                  <span className="font-mono font-bold text-foreground">
                    {((result.omega * 60) / (2 * Math.PI)).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Geometry */}
            <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Turbine Geometry</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Swept Area</span>
                  <span className="font-mono font-bold text-foreground">{(2 * radius * height).toFixed(2)} m²</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Blades</span>
                  <span className="font-mono font-bold text-foreground">{bladeCount}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Solidity (σ)</span>
                  <span className="font-mono font-bold text-foreground">
                    {((bladeCount * chord) / (2 * radius)).toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Est. Annual Energy</span>
                  <span className="font-mono font-bold" style={{ color: '#fbbf24' }}>{annualEnergy} kWh/yr</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 rounded-lg p-2.5 border border-blue-400/20">
              <p className="text-[9px] text-blue-300 leading-relaxed">
                <strong>DMST Model:</strong> Double Multiple Streamtube aerodynamic solver based on Paraschivoiu's VAWT theory. Updates in real-time as you adjust turbine parameters.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
