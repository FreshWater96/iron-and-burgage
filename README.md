# Clyde & Crown

A regional industrial-strategy foundation set around the Clyde in April 1890. This repository includes a playable browser build, a separate local construction sandbox, and a Tauri v2 desktop wrapper with a compiled/tested Rust simulation core.

The original Iron & Burgage prototype is preserved in Git history; its implementation notes are in `docs/iron-burgage-v1.md`.

## Run the browser version

Node 22.12+ or Node 24:

```bash
npm ci
npm run dev
```

Use the URL printed by Vite. To verify and build:

```bash
npm run check
npm run build
```

The build generates both `dist/` and `public/downloads/clyde-crown-source.zip`. The source ZIP excludes Git metadata, Site identity, dependencies, compiled Rust targets, hosting state and its own output. A Data & desktop setup dialog exposes the ZIP in the deployed app.

## Run the desktop version

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform, including Rust. On Windows, install the C++ build tools and WebView2 required by Tauri. Then run:

```bash
npm ci
npm run tauri:dev
```

To build the configured Windows NSIS installer on Windows:

```bash
npm run tauri:build
```

This environment compiled and tested the native simulation library. The complete GUI and installer have **not** been built or tested here: Linux WebKitGTK 4.1 and librsvg development dependencies are unavailable. No Windows executable is supplied or claimed to be verified.

To test the Rust simulation without GUI dependencies:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib
```

## Play

The opening region has eight aggregate parishes/establishments and five persistent freight services:

- Lanarkshire produces coal and ironstone. Two mineral trains deliver them to Glasgow.
- Glasgow smelts steel; another train carries steel to Clydebank.
- Clydebank commits steel to a coastal coaster in four displayed material stages. Completion increments the launched-vessel ledger; a full physical slipway launch is not implemented.
- Greenock supplies Rothesay by puffer and Brodick by coastal steamer. The deeper Arran service starts draft-restricted.
- Inspect the Arran route and pay £750 to dredge its controlling approach to 6 m. This releases the steamer once draft plus under-keel allowance clears the tide-adjusted depth.

Drag/scroll to pan/zoom the chart. Choose parishes in the keyboard-accessible list or click map markers. Click routes to inspect freight. Space pauses; 1× / 2× / 4× changes speed. One real second advances two game minutes at 1×.

Rail survey accepts freeform control points, then checks 2.5% mainline grade and 300 m minimum curve radius. Valid surveys can be pinned and saved. **Surveys are engineering plans, not newly connected operational rail services.**

Hydro study estimates output using `rho * g * flow * head * efficiency` and flood-fills a bounded terrain window. A paid demonstration records nominal MW. It does not provide a hydrologically complete watershed, dam hydraulics, downstream flow, a transmission grid or historical unlock progression.

A selected parish can open the local building sandbox. It retains the original roads, parcels, wagon supply chains and procedural 3D settlement. Crofts, miners' rows and four-storey sandstone tenements can be built individually or selected as parcel housing tiers. **Local inventories are separate from the regional ledger.** Switching views keeps their workers alive; this is not a seamless conversion between regional aggregates and individual citizens.

## What is implemented

| Area | Implementation |
| --- | --- |
| Regional coordinates | 102,400 × 102,400 m domain; explicit British National Grid origin; approximate place layout; Float64 global and snapped floating-origin Float32 render coordinates |
| Regional presentation | Interactive terrain/bathymetry chart, routes, physical service markers, parish ledgers, ship material stages, engineering controls and diagnostics |
| Regional simulation | Browser bitECS worker or native hecs ECS; 20 Hz increments; production, outgoing/incoming cargo reservations, loading/transit/unloading/return states |
| Native parallelism | Rayon parallel parish production; physical service entities remain active regardless of the inspected parish |
| Rail and maritime | Five seeded services; loading capacity and destination reservations; simplified gradient/load speed penalty; tide/draft clearance; paid route-depth dredging |
| Terrain | Procedural fallback; bounded EPSG:27700 GeoTIFF ingestion; pixel-centre georeferencing; resampling; imported raster persistence in IndexedDB |
| 3D regional renderer | Lazy WebGPURenderer with TSL materials, WebGL2/TSL fallback, 64×64-cell quadtree patches, coarse-height vertex morphing and vertical edge skirts |
| Local construction | Original Three.js terrain/roads/parcels, Recast pedestrians, worker housing, cottages, sandstone tenements, instanced scenery and physical wagon deliveries |
| Civil math | Sampled Catmull–Rom profiles, mainline/narrow-gauge limits, bridge/embankment/cutting/tunnel classification |
| Hydro math | Dimensionally correct nominal MW and connected inundation flood-fill |
| Persistence | Exact regional in-transit save/load, pinned chart surveys, independent local settlement save, imported tile storage; native simulation saves use the Tauri app-data directory |
| Offline foundation | Generated service worker pre-caches the production app shell and all generated engine/decoder/worker chunks; native frontend assets are bundled locally |

## Data provenance

No official Scottish DEM or marine survey is bundled. The starting elevation, islands, coastline, lake and bathymetry are synthetic; place locations are approximate. This is labelled in the app.

Import a north-up **EPSG:27700 GeoTIFF** through Data & desktop setup. Other coordinate systems or rotated rasters are rejected instead of silently mislocated. A layer must be under 160 MB and is resampled to a maximum dimension of 1025 pixels. Imported values replace the matching footprint; uncovered areas remain procedural. Raster source names remain visible in storage metadata.

Elevation and bathymetry are separate layer types. Bathymetry uses negative metre elevations; land DEMs must not be treated as marine soundings. A bathymetry import updates route minimum-depth estimates by sampling their paths. The scenario's paid dredging action changes the route's controlling depth; it does not yet excavate the imported raster or produce spoil/reclamation geometry. Cached raster layers are device-local, not uploaded.

The native GIS helper reads validated binary Float32 tiles; GeoTIFF decoding currently happens in TypeScript. It is not a native GDAL/GeoTIFF streaming engine. The OS Terrain 50 link is a source reference, not evidence that OS data was downloaded or bundled.

## Architecture

- `src/regional/core/RegionalChart.ts`: cached shaded terrain, chart interaction, service markers, surveys and focus coordinates.
- `src/regional/core/WebGPUEngine.ts`: optional GPU regional view, camera-relative origin and terrain/strategic markers.
- `src/regional/world/CDLODTerrain.ts`: quadtree patch selection, parent-height morph attributes, surface weights and skirts.
- `src/regional/world/GeoTIFFLoader.ts`, `RegionalHeight.ts`, `TerrainStorage.ts`: decoding, bilinear sampling, provenance and local tile persistence.
- `src/regional/sim/RegionalSim.ts`: browser economy/freight implementation and exact save contract.
- `src/regional/core/TauriBridge.ts`: native runtime detection, command IPC and snapshot polling; otherwise a dedicated browser worker.
- `src-tauri/src/sim/`: hecs freight state, parallel production, focus classification and matching snapshot/save types.
- `src-tauri/src/world_gen/`: power/inundation math and checked native height-tile ingestion.
- `src/core/`, `src/geometry/`, `src/sim/`: the independent local settlement prototype.

The regional and native cores use the same JSON scenario. A checked-in 1,000-tick browser snapshot is verified by the Rust test suite to catch contract/numeric mismatches. Native snapshots currently use serialized Tauri IPC, not shared memory or zero-copy buffers.

Resource accounting is explicit:

```text
available stock = physical stock - outgoing reservations
free capacity = capacity - physical stock - incoming reservations
owned goods = physical stocks + actually loaded cargo
```

Loading reservations are counted at the source until pickup. Incoming reservations are released only at delivery. Trains and vessels remain in the simulation across all camera positions. The current micro/macro flag classifies parishes within a 3 km focus bubble; it does not synthesize or reconcile half a million citizens.

## Verification

- **17 TypeScript checks** cover the retained local game, parcel math, reservations, civil profiles, floating origin, quadtree coverage, actual GeoTIFF decoding/projection rejection, hydro math, blocked draft, cargo conservation and exact transit restore.
- **8 compiled Rust tests** cover draft and traction math, hydrology, production/shipbuilding, dredging, exact restoration and parity with the browser reference snapshot.
- Browser QA covers the regional chart, draft inspection/dredging, pause/save/load, unsupported-GPU fallback, parish/local view transition, and sandstone-tenement construction with the correct 24-resident capacity.
- GPU rendering cannot be visually tested in the cloud browser because GPU contexts are disabled. The renderer type-checks and bundles, but its appearance and performance need a hardware-enabled browser check.
- The service worker is a production app-shell cache. Full disconnected-browser behavior is not claimed as tested by merely registering it. Offline imported terrain/saves depend on browser storage availability; the downloadable source ZIP is not part of the pre-cache.

## Remaining engine work

This is a substantial foundation, **not** the complete 1890–1950 simulation. There is no 500,000-agent benchmark, seamless population micro/macro reconciliation, complete terrain streaming/eviction pipeline, GPU compute culling, FFT ocean, live rail block signalling, train fuel/water economy, physical ship launches, coal-seam geology, mine flooding, watershed hydraulics, electric grid, strikes, conscription, combat, convoys, blitz damage or historical technology progression.

Civil structure classifications are implemented mathematically; regional viaduct/tunnel construction geometry and operational graph insertion are not. The quadtree implementation uses skirts and coarse-height morphing, rather than a fully crack-free, neighbour-balanced CDLOD implementation. Eight-way TSL surface blending uses vertex weights and procedural fallback colors; it is not a library of scanned Scottish PBR materials.

Allocation is bounded in several simulation arrays, but the application is **not globally zero-allocation**. Geometry edits, snapshots, UI work, Recast baking, chart rendering and Tauri serialization allocate. Tauri provides access to a native process and disk; it does not imply unlimited RAM.

## Primary references

- [Tauri v2 Rust commands](https://v2.tauri.app/develop/calling-rust/) and [prerequisites](https://v2.tauri.app/start/prerequisites/).
- [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) and [TSL](https://threejs.org/docs/pages/TSL.html).
- [geotiff.js](https://github.com/geotiffjs/geotiff.js) and [OS Terrain 50](https://www.ordnancesurvey.co.uk/products/os-terrain-50).
- [hecs](https://github.com/Ralith/hecs), [Rayon](https://github.com/rayon-rs/rayon), [bitECS](https://github.com/NateTheGreatt/bitECS) and [Recast Navigation JS](https://github.com/isaac-mason/recast-navigation-js).

All scene art is procedural. No CC0 model pack is bundled. Optional GLB replacement hooks remain in the local engine. Original reference repositories are listed in the retained v1 notes; their source was not copied. Dependency licenses remain their authors'.
