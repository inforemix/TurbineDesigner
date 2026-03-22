# TurbineDesigner v1

An interactive 3D designer for Vertical-Axis Wind Turbine (VAWT) visualization and optimization. This application allows engineers and designers to experiment with blade geometry, airfoil profiles, and turbine configurations in real-time with dynamic physics calculations.

## Features

- **3D Interactive Visualization**: Real-time 3D rendering of turbine models with OrbitControls
- **Blade Geometry Design**: Adjust blade points, twist, taper, and height with intuitive curve editors
- **Airfoil Management**: Choose from preset airfoils or define custom NACA profiles
- **Symmetry Modes**: Support for standard, helix, and snowflake blade configurations
- **Material Presets**: Multiple material and shader systems (teal-metal, neon, bamboo, quantum)
- **Physics Simulation**: Real-time aerodynamic calculations including tip-speed-ratio optimization
- **Multiple Visualization Modes**: Full viewer, mini preview, side-view canvas with airfoil cross-sections
- **Theme Support**: Dark/light mode with saved preferences

## Architecture

- **React 18** + **TypeScript** for type-safe UI components
- **React Three Fiber** for WebGL 3D rendering via Three.js
- **Zustand** for lightweight state management
- **Vite** for fast development and optimized builds
- **GLSL Shaders** for advanced material effects (neon, quantum patterns)

## Project Structure

```
src/
├── components/
│   ├── viewer/        # 3D visualization components
│   ├── canvas/        # Canvas-based 2D previews
│   ├── editor/        # Geometry and profile editors
│   ├── ui/           # UI panels and controls
│   └── puzzle/       # Challenge/puzzle mode
├── stores/           # Zustand state stores
├── utils/            # Physics, geometry, and utility functions
├── physics/          # DMST and aerodynamic calculations
└── data/             # Challenge definitions
```

## Development

```bash
npm install
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## Design Notes

The turbine visualization consists of:
- **Spinning Components**: Blades, central shaft, and top bearing ring rotate with wind speed
- **Static Base Disk**: The bottom torus disk and radial struts remain stationary for visual stability
- **Radial Struts**: Connect the top and bottom rings to the central shaft
- **Shaft**: Central cylindrical support structure

## License

Built as an educational tool for wind turbine design and optimization.
