# Iron & Burgage

A first playable industrial settlement simulator, starting in April 1890. Built with TypeScript, React, Three.js, bitECS, Recast Navigation, polygon-clipping, earcut, three-mesh-bvh and Zustand. No external art assets or AI services are required.

## Run locally

Use Node 22.12+ or Node 24, then:

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. For verification and a production static build:

```bash
npm run check
npm run build
```

`dist/` is the deployable output. The production build bundles the simulation worker and Recast WASM compatibility loader; no CDN imports are used for the engine. Optional Google Fonts have system font fallbacks.

## Play

- WASD / arrow keys or right drag: pan; left or middle drag: orbit in inspection mode; scroll: zoom; H: reset view.
- Click a building, or open the settlement ledger, to inspect physical stock, outgoing reservations and incoming cargo. Pause/resume production in the inspector.
- Logistics → Country road: click two or more control points; Enter or Finish commits the route. Endpoint snapping connects to nearby road samples. Esc cancels.
- Settlement → Worker plots: place two frontage corners beside a road and two backyard corners. Set lot width between 8 and 20 metres. Valid lots become worker cottages immediately after the worker accepts the cost.
- Individual buildings require dry land, clearance and a road within 25 metres. R rotates placement by 45 degrees.
- Railways validate a minimum 22 m curve radius and maximum 4% terrain grade; invalid curves cannot be committed.
- Fortifications → Trench line: draw control points and finish to deform the heightmap and add duckboards and parapets.
- Space pauses; 1× / 2× / 4× buttons set simulation speed. F3 toggles geometric debug overlays and telemetry. Save/load uses browser-local, versioned JSON.

The opening economy has coal and iron mines, a foundry, a sawmill, a farm, a market, a depot, a tool workshop and worker cottages. Twelve wagons reserve and transport cargo along the sampled road graph. Eighteen pedestrians follow Recast paths. The starting iron-mine spur is intentionally connected so the foundry can receive both inputs without player repairs.

## Implemented scope

| System | Current behavior |
| --- | --- |
| Gridless infrastructure | Terrain-projected Catmull–Rom road and rail ribbons; snap connections; rail curvature/grade validation |
| Parcels | Four-point non-self-intersecting polygons; frontage-aligned polygon-clipping slices; earcut previews; instanced homes, fences and gardens |
| Simulation | Dedicated worker; 20 Hz fixed increments; bitECS typed-array positions and transport components |
| Logistics | Physical per-building stock; outgoing/incoming reservations; capacity checks; pickup and delivery phases; cached shortest paths on road graphs |
| Production | Recipe inputs; staffing modifiers; winter farm slowdown; market/trade revenue; adjustable simulation speed |
| Pedestrians | Recast WASM walkable terrain baking with building footprints removed; route visualization |
| Terrain | Procedural heightmap, BVH picking, six-channel procedural splat blend, mud/soot painting, seasonal snow uniform, heightmap trench deformation |
| Rendering | Instanced scenery, structures, fences, sleepers, cargo and rigid-body agents; batched road meshes; instanced smoke |
| Compatibility | WebGL2 on supported browsers; cached Canvas2D projection of the same procedural geometry when WebGL is unavailable |
| Save/load | Buildings, roads, parcels, inventory, production progress, time, economy and in-transit freight; outgoing jobs return their cargo to the source on restore, then replan without duplication |

## Explicit limitations

This is an extensible prototype, not the completed 1890–1950 game or a production-ready engine.

- No combat, regiments, artillery, ballistics, utility networks, electric power, oil/refining or era technology unlocks. The calendar advances, but it does not unlock historical eras. Trench drawing is a construction sandbox.
- Rail geometry is editable, but rail freight and locomotives are not implemented. Wagons are simplified road vehicles without horses, fatigue, traffic collision avoidance or fuel.
- Construction charges timber instantly. Simulated production cargo moves by wagon. Resources are quantities in typed-array inventories and visible batches on loaded wagons, rather than a separate ECS entity per individual crate.
- Terrain is a single mesh without chunked LOD. Recast rebakes for building changes; its bake currently uses the base height function and does not incorporate deformed trench vertices. Road graph freight is independent of the pedestrian navmesh.
- Parcels use a straight frontage axis between the first two snapped corners, rather than conforming each lot frontage to a deeply curved road. Small/unbuildable slices are not occupied. Footprint overlap uses bounding circles.
- Six materials are represented through procedural GLSL colors/noise and two RGBA splatmaps, not six scanned PBR textures. Smoke uses instancing rather than three-nebula.
- Three.js vectors/matrices are reused in simulation movement and normal WebGL frame updates. The app is not globally zero-GC: snapshots, UI rendering, dispatch/path construction, geometry mutations and the software fallback allocate. No zero-GC claim or stress benchmark is made.
- WebGL draw calls are displayed in telemetry. The 150-call target is not verified in the cloud test browser because WebGL is disabled there. Canvas fallback has no GPU draw-call count and is slower during camera motion. It omits smoke, ignores terrain splat shading and simplifies depth/lighting/debug lines.
- `three-bvh-csg` is installed for future mesh-cutting work; the current trench implementation uses heightmap deformation. Do not infer a CSG combat system from the dependency.
- Save files stay on the same browser and origin; they are not cloud saves. Starting a page creates the opening scenario; Load explicitly restores a local save.

## Architecture

The render loop lives in `src/core/Engine.ts`; React receives snapshots four times a second and does not drive the renderer. `WorkerBridge.ts` uses ordinary worker messages, which works without COOP/COEP headers or SharedArrayBuffer. `WorldECS.ts` owns inventory and economy, and arbitrates construction costs. Geometry edits and new buildings are applied only after worker acceptance.

`Position` and `Transport` are bitECS SoA components. Stocks, incoming reservations, outgoing reservations and production progress are preallocated typed arrays. Freight routing is a cached road-graph shortest-path query; foot navigation uses Recast separately. Capacity is bounded at 256 building slots and twelve freight vehicles.

The reservation identities are:

```text
available source stock = physical stock − outgoing reservations
free destination capacity = capacity − physical stock − incoming reservations
total owned goods = building stocks + loaded wagon cargo
```

Reservations do not change physical ownership. Pickup removes source stock and adds loaded cargo. Delivery removes loaded cargo and credits the destination. Recipes consume and create goods at their own building. The reference brief's incoming/outgoing sign convention is deliberately corrected here.

`AssetLoader.ts` exposes a cached GLTFLoader hook for `/assets/<name>.glb`; all current buildings use procedural geometry. Asset replacement is an integration hook and does not automatically replace instanced procedural models just by dropping a GLB into the folder.

## Validation

`npm run check` runs eight checks: oblique parcel area preservation; concave slicing and intersection rejection; rail curve/grade rejection; reservation math; road graph connectivity; concurrent freight conservation; in-transit save restoration; and the full opening production chain over four simulated minutes.

Browser QA covered the Canvas fallback, live inventories, ledger and inspector, freeform road creation, individual construction, four-corner parcel construction, pause, save and restore. GPU shading and performance require a hardware-enabled browser check.

## References and licensing

These were reviewed as architectural references. No application source was copied from them, and they are not bundled:

- [Fable Cities](https://github.com/rawprogress/fable-cities): browser city-builder reference.
- [CozyStreetBuilder](https://github.com/wurmmatthias/CozyStreetBuilder): placement and serialization reference.
- [MichaelKowal/city-builder](https://github.com/MichaelKowal/city-builder): UI/scene separation reference.
- [Watabou TownGeneratorOS](https://github.com/watabou/TownGeneratorOS): organic layout reference; GPL-3.0 code was not incorporated.
- [bitECS](https://github.com/NateTheGreatt/bitECS), [Recast Navigation JS](https://github.com/isaac-mason/recast-navigation-js), [polygon-clipping](https://github.com/mfogel/polygon-clipping), [earcut](https://github.com/mapbox/earcut), [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh): installed implementation libraries.

Dependency licenses remain their respective authors'. All scenery here is generated in code.
