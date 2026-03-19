/**
 * PhysicsDashboard — real-time DMST physics output panel.
 * Shows Cp, power, torque, TSR, power curve sparkline.
 * Shown in the right sidebar during "view" mode.
 */
import { useMemo } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'
import { solveDMST, computePowerCurve } from '../../physics/dmst'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Label } from './label'
import { Separator } from './separator'

function Sparkline({
  data,
  width = 200,
  height = 48,
  color = '#2dd4bf',
  peakX,
}: {
  data: { x: number; y: number }[]
  width?: number
  height?: number
  color?: string
  peakX?: number
}) {
  if (data.length < 2) return null
  const maxY = Math.max(...data.map((d) => d.y), 0.001)
  const maxX = data[data.length - 1].x

  const pts = data
    .map((d) => {
      const sx = (d.x / maxX) * width
      const sy = height - (d.y / maxY) * (height - 4)
      return `${sx.toFixed(1)},${sy.toFixed(1)}`
    })
    .join(' ')

  const fill = data
    .map((d, i) => {
      const sx = (d.x / maxX) * width
      const sy = height - (d.y / maxY) * (height - 4)
      return i === 0 ? `M${sx.toFixed(1)},${height} L${sx.toFixed(1)},${sy.toFixed(1)}` : `L${sx.toFixed(1)},${sy.toFixed(1)}`
    })
    .join(' ') + ` L${width},${height} Z`

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sparkGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      {peakX !== undefined && (
        <line
          x1={((peakX / maxX) * width).toFixed(1)}
          y1="0"
          x2={((peakX / maxX) * width).toFixed(1)}
          y2={height}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.6"
        />
      )}
    </svg>
  )
}

function MetricRow({
  label,
  value,
  unit,
  color = '#e2e8f0',
}: {
  label: string
  value: string
  unit?: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-[10px] text-text-muted font-medium">{label}</Label>
      <span className="text-[11px] font-mono font-bold" style={{ color }}>
        {value}
        {unit && <span className="text-text-dim text-[9px] ml-1">{unit}</span>}
      </span>
    </div>
  )
}

export default function PhysicsDashboard() {
  const { windSpeed, bladeCount, height, thickness } = useTurbineStore()

  // Derive rotor geometry from store params
  const radius = 0.5 // normalised to 1m diameter — scale with height
  const chord = thickness * 2 + 0.05

  const dmstInput = useMemo(
    () => ({
      windSpeed: Math.max(windSpeed, 0.5),
      radius,
      height,
      numBlades: bladeCount,
      chord,
      tsr: 3.5, // operating TSR
    }),
    [windSpeed, height, bladeCount, chord]
  )

  const result = useMemo(() => solveDMST(dmstInput), [dmstInput])

  const powerCurve = useMemo(
    () => computePowerCurve(dmstInput, 7, 35),
    [dmstInput]
  )

  const peakCp = Math.max(...powerCurve.map((d) => d.cp))
  const peakTSR = powerCurve.find((d) => d.cp === peakCp)?.tsr ?? 0

  const annualEnergy = useMemo(() => {
    // Simplified AEP: assume Rayleigh wind dist, average V = windSpeed
    const hours = 8760
    const cf = Math.min(result.cp / 0.593, 0.95) * 0.35 // capacity factor estimate
    return ((result.power * cf * hours) / 1000).toFixed(1)
  }, [result])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Physics Dashboard</Label>
        <Badge
          variant="outline"
          className="text-[9px] border-teal/30 text-teal bg-teal/10 font-semibold"
        >
          ● live
        </Badge>
      </div>

      {/* Power Curve Sparkline */}
      <Card className="bg-surface/40 border-teal/20">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-[10px] text-text-muted flex justify-between font-semibold">
            <span>Cp vs TSR Curve</span>
            <span className="text-teal font-mono">Cp<sub>max</sub>={peakCp.toFixed(3)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <Sparkline
            data={powerCurve.map((d) => ({ x: d.tsr, y: d.cp }))}
            height={44}
            color="#2dd4bf"
            peakX={peakTSR}
          />
          <div className="flex justify-between text-[9px] text-text-dim mt-2">
            <span>TSR 0</span>
            <span>optimal λ={peakTSR.toFixed(1)}</span>
            <span>7</span>
          </div>
        </CardContent>
      </Card>

      {/* Key metrics */}
      <div className="flex flex-col gap-1 bg-surface/20 rounded-lg p-3 border border-border/20">
        <div className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1">Key Metrics</div>
        <MetricRow label="Power coeff. Cp" value={result.cp.toFixed(3)} color="#2dd4bf" />
        <MetricRow label="Torque coeff. Cq" value={result.cq.toFixed(4)} color="#94a3b8" />
        <MetricRow label="Shaft power" value={result.power.toFixed(1)} unit="W" color="#fbbf24" />
        <MetricRow label="Torque" value={result.torque.toFixed(2)} unit="Nm" color="#94a3b8" />
        <MetricRow label="ω (omega)" value={result.omega.toFixed(2)} unit="rad/s" color="#94a3b8" />
        <MetricRow label="RPM" value={((result.omega * 60) / (2 * Math.PI)).toFixed(1)} color="#a78bfa" />
      </div>

      <Separator className="bg-border/20" />

      {/* Secondary metrics */}
      <div className="flex flex-col gap-1 bg-surface/20 rounded-lg p-3 border border-border/20">
        <div className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1">Configuration</div>
        <MetricRow label="Wind speed" value={windSpeed.toFixed(1)} unit="m/s" />
        <MetricRow label="Swept area" value={(2 * radius * height).toFixed(2)} unit="m²" />
        <MetricRow label="Solidity σ" value={((bladeCount * chord) / (2 * radius)).toFixed(3)} />
        <MetricRow label="Est. AEP" value={annualEnergy} unit="kWh/yr" color="#fbbf24" />
      </div>

      {/* Betz limit indicator */}
      <div className="bg-surface/20 rounded-lg p-3 border border-teal/20">
        <div className="flex justify-between text-[10px] text-text-muted mb-2 font-semibold">
          <span>Betz Efficiency</span>
          <span className="text-teal font-mono">{((result.cp / 0.593) * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden border border-border/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal via-teal-glow to-bloom-gold transition-all duration-500 shadow-lg"
            style={{ width: `${Math.min((result.cp / 0.593) * 100, 100)}%` }}
          />
        </div>
        <div className="text-[9px] text-text-muted mt-2 text-right font-mono">Betz limit: 59.3%</div>
      </div>
    </div>
  )
}
