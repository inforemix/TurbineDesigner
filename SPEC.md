# TurbineDesigner v1 - Specification

## Overview

TurbineDesigner v1 is an interactive 3D web-based design tool for Vertical-Axis Wind Turbines (VAWT). It provides real-time visualization, aerodynamic simulation, and parametric design capabilities for engineers and educators.

## Core Features

### 1. 3D Turbine Visualization

- Real-time 3D rendering using React Three Fiber and Three.js
- Interactive camera controls (orbit, zoom, pan)
- Dynamic lighting and shadow rendering
- Multiple material presets with shader effects:
  - Teal Metal (brushed metal finish)
  - Neon (glowing shader with pattern effects)
  - Bamboo (organic wood-like texture)
  - Quantum (animated scientific pattern)

### 2. Blade Design System

#### Blade Geometry Parameters
- **Height**: Turbine rotor height (0.6 - 3.0 m)
- **Blade Count**: Number of blades (2 - 6)
- **Twist**: Blade pitch angle along height (-45° to +45°)
- **Taper**: Taper factor from root to tip (0.0 - 1.0)
- **Thickness**: Blade profile thickness scale (0.1 - 2.0)

#### Blade Path Editor
- Bézier curve control points for blade profile shape
- Catmull-Rom spline smoothing with adjustable resolution
- Interactive point dragging with visual feedback
- Curve handle manipulation for smooth transitions

#### Symmetry Modes
- **Standard**: Single blade repeated around central axis
- **Helix**: Helical blade arrangement with progressive pitch
- **Snowflake**: Dual-camber blades (mirrored for flow separation effects)

### 3. Airfoil Profile Management

#### Preset Profiles
- Multiple standard airfoil shapes (NACA, custom profiles)
- Visual preview of airfoil cross-section
- Thickness and camber information

#### Custom NACA Profiles
- Interactive NACA parameter editor (M, P, T values)
- Real-time profile generation
- Normalized thickness calculation with cubic spline interpolation

### 4. Physics Simulation

#### DMST Model (Double-Multiple Streamtube)
- Blade element momentum theory implementation
- Angle-of-attack based lift/drag coefficients
- Tip-speed-ratio (TSR) optimization
- Power coefficient calculation

#### Real-time Outputs
- **Torque**: Rotor torque calculation
- **Power**: Generated mechanical power
- **Efficiency**: Power coefficient (Cp)
- **RPM**: Rotational speed based on wind velocity
- **Tip-Speed-Ratio**: Optimal TSR indicator

### 5. User Interface

#### Central Controller
- Wind speed slider (0 - 15 m/s)
- Turbine spin toggle
- Material preset selector
- Shader pattern chooser (for advanced materials)

#### Parameter Panel
- Height, blade count, twist, taper, thickness sliders
- Real-time visualization updates
- Parameter reset to defaults

#### Blade Section Editor
- Visual blade path curve editor with points and handles
- Airfoil selection dropdown
- Curve smoothing control
- Preview of current blade profile cross-section

#### Physics Dashboard
- Real-time physics metrics display
- Compact and full view modes
- Wind speed input synchronized with controller

#### Side View Canvas
- 2D orthogonal view of turbine profile
- Airfoil cross-section visualization at selected heights
- Canvas-based rendering for fast 2D previews

#### Mini Turbine Viewer
- Compact 3D preview (200x200px)
- Auto-rotating view with orbit controls
- Used in preset browser and design exploration

#### Preset Browser
- Browse saved turbine configurations
- Load and apply saved designs
- Edit or delete custom presets

#### Save Panel
- Export/import turbine configurations as JSON
- Share designs via text-based format
- Configuration validation

### 6. Visual Components

#### Turbine Model
- **Blades**: Procedurally generated from Bézier curve and airfoil profile
- **Central Shaft**: Cylindrical support (4cm diameter, height-dependent)
- **Top Bearing Ring**: Torus at top (18cm radius, 1.2cm thickness)
- **Bottom Base Disk**: Static torus at bottom (18cm radius, 1.2cm thickness)
- **Radial Struts**: Cylindrical connectors between rings and shaft
- **Wireframe Mode**: Optional debug visualization

#### Ground and Environment
- Gradient ground plane with distance-based shading
- Contact shadows for depth perception
- Sky dome with preset colors (dawn, day, dusk, night)
- Dynamic lighting system with multiple light sources

#### Animation
- **Spinning**: Blades, shaft, and top ring rotate based on wind speed
- **Static Base**: Bottom disk and base struts remain stationary for visual stability
- **Auto-rotate**: Mini viewer auto-rotates for preview purposes
- **Transitions**: Smooth reveal animations for blade and strut elements

### 7. Data Management

#### Storage
- Browser LocalStorage for theme and preference persistence
- JSON-based configuration export/import
- Challenge progress tracking for puzzle mode

#### Configuration Structure
```typescript
{
  bladePoints: Array<{x, y}>,
  bladeHandles: Array<{x, y}>,
  bladeCount: number,
  height: number,
  twist: number,
  taper: number,
  thickness: number,
  airfoilPreset: string,
  customNacaM: number,
  customNacaP: number,
  customNacaT: number,
  symmetryMode: 'standard' | 'helix' | 'snowflake',
  materialPreset: MaterialPreset,
  curveSmoothing: number,
  windSpeed: number,
  isSpinning: boolean
}
```

### 8. Advanced Features

#### Puzzle/Challenge Mode
- Educational challenges with step-by-step hints
- Specific turbine design objectives
- Celebrate completions with visual feedback
- Progress tracking

#### Material System
- Multiple material presets with pre-configured values
- Neon shader with animated patterns:
  - Wave pattern (energy rings)
  - Scanlines (horizontal bands)
  - Grid pattern (world-space grid)
- Bamboo shader for organic appearance
- Quantum shader for scientific visualization

#### Rendering Optimization
- Memoized geometry and material creation
- GPU-accelerated computation
- WebGL optimizations via Three.js
- Efficient buffer geometry management

## UI/UX Specifications

### Layout
- Header with title and theme toggle
- Central 3D viewport (main focus)
- Right sidebar with collapsible panels:
  - Central Controller
  - Parameter Panel
  - Blade Section Editor
  - Physics Dashboard
  - Save/Export Panel
- Footer with mini viewer and additional controls

### Interactions
- Drag to rotate camera
- Scroll to zoom
- Click to select/adjust parameters
- Drag curve points to edit blade geometry
- Click presets to load configurations

### Visual Design
- Dark theme default with light mode option
- Teal accent color (#2dd4bf)
- Monospace font for technical values (JetBrains Mono)
- Sans-serif for UI text (DM Sans)
- High contrast for readability

### Performance Targets
- 60 FPS rendering on modern browsers
- < 100ms initial load time
- Smooth parameter updates without lag
- Responsive to user input

## Constraints and Notes

### Turbine Physics
- Static base disk for visual stability during rotation
- Blades and top ring spin synchronously with central shaft
- Physics calculations assume uniform wind conditions
- TSR optimization based on standard turbine theory

### Browser Compatibility
- Requires WebGL 2.0 support
- Optimized for Chrome, Firefox, Safari (modern versions)
- Touch controls not fully implemented

### Limitations
- 2D blade profiles (no full 3D surface fitting)
- Simplified aerodynamic model (DMST)
- No structural analysis or stress calculations
- Single wind speed assumption (no time-series)

## Future Enhancements

- Multi-speed wind simulation
- Blade stress and fatigue analysis
- Export to CAD formats (STEP, STL)
- Advanced CFD integration
- Multiplayer design collaboration
- Mobile/touch interface optimization
- Performance profiling and metrics
- Custom material creation UI
