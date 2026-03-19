/**
 * Double Multiple Streamtube (DMST) model for VAWT performance prediction.
 *
 * Reference: Paraschivoiu (2002), "Wind Turbine Design with Emphasis on Darrieus Concept"
 * Simplified for real-time browser execution (<10 ms for typical inputs).
 *
 * Conventions:
 *  - θ = 0    upwind station, blade moving against the wind
 *  - θ = π    downwind station
 *  - Positive torque = power-generating direction
 */

// ── Airfoil Cl/Cd approximation (Montgomerie model) ──────────────────────────

/** Thin-plate + camber approximation for Cl at low-to-mid AoA. */
function cl(alpha_deg: number): number {
  const a = alpha_deg * (Math.PI / 180)
  // Linear lift curve slope (flat plate ≈ 2π/rad, corrected for finite AR)
  const cl_lin = 2 * Math.PI * Math.sin(a) * Math.cos(a)
  // Dynamic stall / separation after ~15°
  const stall = Math.max(0, 1 - ((Math.abs(alpha_deg) - 15) / 10) ** 2)
  return cl_lin * (Math.abs(alpha_deg) <= 15 ? 1 : stall)
}

/** Simple quadratic drag polar: Cd = Cd0 + k·Cl² */
function cd(alpha_deg: number, cd0 = 0.012): number {
  const clVal = cl(alpha_deg)
  return cd0 + 0.02 * clVal * clVal + 0.001 * Math.abs(alpha_deg)
}

// ── Core DMST solver ─────────────────────────────────────────────────────────

export interface DMSTInput {
  /** Wind speed [m/s] */
  windSpeed: number
  /** Rotor radius [m] */
  radius: number
  /** Rotor height [m] */
  height: number
  /** Number of blades */
  numBlades: number
  /** Blade chord length [m] (uniform) */
  chord: number
  /** Tip-speed ratio λ = ω·R/V */
  tsr: number
  /** Angular offset / pitch [deg] */
  pitch?: number
  /** Number of streamtube divisions (higher = more accurate, slower) */
  divisions?: number
}

export interface DMSTOutput {
  /** Power coefficient Cp (theoretical max ~0.593 Betz limit) */
  cp: number
  /** Torque coefficient Cq */
  cq: number
  /** Generated power [W] */
  power: number
  /** Torque [Nm] */
  torque: number
  /** Rotor angular velocity [rad/s] */
  omega: number
  /** Per-azimuth normal force coefficient */
  cn_array: number[]
  /** Per-azimuth tangential force coefficient */
  ct_array: number[]
  /** Upstream induction factors */
  a_up: number[]
  /** Downstream induction factors */
  a_dn: number[]
}

export function solveDMST(input: DMSTInput): DMSTOutput {
  const {
    windSpeed: V,
    radius: R,
    height: H,
    numBlades: N,
    chord: c,
    tsr: lambda,
    pitch = 0,
    divisions = 36,
  } = input

  const omega = (lambda * V) / R
  const sigma = (N * c) / (2 * R) // rotor solidity
  const A = 2 * R * H // reference swept area

  const cn_array: number[] = new Array(divisions).fill(0)
  const ct_array: number[] = new Array(divisions).fill(0)
  const a_up: number[] = new Array(divisions).fill(0)
  const a_dn: number[] = new Array(divisions).fill(0)

  let Cq_total = 0

  for (let i = 0; i < divisions; i++) {
    const theta = (i / divisions) * Math.PI * 2

    // ── Upstream half (0 < θ < π) ───────────────────────────────────────────
    const isUpstream = Math.cos(theta) >= 0
    const semiPlane = isUpstream ? 1 : -1

    // Initial guess for induction factor a
    let a = 0.25
    let Ve: number // equatorial velocity
    let alpha_deg = 0

    // Iterate induction factor (converges in ~5–10 steps)
    for (let iter = 0; iter < 20; iter++) {
      if (isUpstream) {
        Ve = V * (1 - a)
      } else {
        Ve = V * (1 - 2 * a_up[i]) * (1 - a) // use upstream a for downstream calc
      }

      const Vrel_x = Ve * Math.cos(theta) - omega * R * Math.sin(theta) * semiPlane
      const Vrel_y = Ve * Math.sin(theta) + omega * R * Math.cos(theta) * semiPlane
      const Vrel = Math.sqrt(Vrel_x ** 2 + Vrel_y ** 2)

      // Local angle of attack
      const phi = Math.atan2(Vrel_y, Vrel_x) * (180 / Math.PI)
      const alpha = phi - pitch

      const Cl = cl(alpha)
      const Cd = cd(alpha)

      // Normal & tangential force coefficients (per unit span)
      const cn = Cl * Math.cos(phi * Math.PI / 180) + Cd * Math.sin(phi * Math.PI / 180)
      const ct = Cl * Math.sin(phi * Math.PI / 180) - Cd * Math.cos(phi * Math.PI / 180)

      // Thrust coefficient for this streamtube element
      const dCt = (sigma / (4 * Math.PI)) * (Vrel / Ve) ** 2 * cn * Math.abs(Math.sin(theta))

      // Updated induction factor (Glauert correction for high induction)
      let a_new: number
      if (dCt <= 0.96) {
        a_new = dCt / (1 + dCt)
      } else {
        // Glauert empirical correction
        a_new = (18 * dCt - 20 - 3 * Math.sqrt(dCt * (50 - 36 * dCt) + 12 * (3 * dCt - 4))) / (36 * dCt - 50)
        a_new = Math.max(0, Math.min(0.95, a_new))
      }

      if (Math.abs(a_new - a) < 1e-5) {
        a = a_new
        alpha_deg = alpha
        cn_array[i] = cn
        ct_array[i] = ct
        break
      }
      a = a_new
      alpha_deg = alpha
    }

    if (isUpstream) {
      a_up[i] = a
    } else {
      a_dn[i] = a
    }

    // Contribution to torque coefficient
    const Vrel_x = Ve! * Math.cos(theta) - omega * R * Math.sin(theta) * semiPlane
    const Vrel_y = Ve! * Math.sin(theta) + omega * R * Math.cos(theta) * semiPlane
    const Vrel = Math.sqrt(Vrel_x ** 2 + Vrel_y ** 2)

    // alpha_deg used during iteration; suppress unused warning
    void alpha_deg
    Cq_total += (sigma / (4 * Math.PI)) * (Vrel / V) ** 2 * ct_array[i] / divisions
  }

  const Cp = lambda * Cq_total * 2
  const Cq = Cq_total * 2

  const power = 0.5 * 1.225 * A * V ** 3 * Cp
  const torque = power / Math.max(omega, 0.001)

  return {
    cp: Math.max(0, Cp),
    cq: Math.max(0, Cq),
    power: Math.max(0, power),
    torque: Math.max(0, torque),
    omega,
    cn_array,
    ct_array,
    a_up,
    a_dn,
  }
}

/**
 * Sweep TSR from 0 to tsrMax and return {tsr, cp} pairs for the power curve.
 */
export function computePowerCurve(
  input: Omit<DMSTInput, "tsr">,
  tsrMax = 6,
  steps = 40
): { tsr: number; cp: number; power: number }[] {
  const results = []
  for (let i = 1; i <= steps; i++) {
    const tsr = (i / steps) * tsrMax
    const { cp, power } = solveDMST({ ...input, tsr })
    results.push({ tsr, cp, power })
  }
  return results
}
