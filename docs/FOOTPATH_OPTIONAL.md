# Footpath Optional

Route: `/footpath-optional/`. A free, humorous pedestrian-awareness experiment for Financial District, Nanakramguda and Kokapet. Its question is simple: where is there evidence of space for people to walk, and where do we still need to look?

## What is built

- Leaflet map using actual clipped OSM road geometry, named-road search, area viewport presets, evidence filters, source links and raw tags.
- Missing sidewalk metadata stays unknown. Explicit `sidewalk=no` is described as an OSM tag, never a verified present-day gap. Restricted access and motor roads are separated; private compounds are not advertised as public walks.
- Seven field-note types, including gaps, obstacles, level changes, traffic exposure, unnecessary crossings, difficult crossings and working connections. Exact point, date, road-side context and descriptive evidence are required. Notes remain unreviewed in the current tab and can be exported as GeoJSON or readable text. No server, upload, persistence, moderation service or public submission is implied.
- One real archived junction photograph beside a code-native design schematic. No photorealistic after image is shipped: the image service failed to process the licensed input. The schematic is explicitly not a reconstruction, dimensional plan, approved design or claim of accessibility compliance.
- Keyboard road-list alternative, small-screen layouts, reduced-motion support, tile-failure fallback and static data download.

## Evidence and reproduction

Source: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0. Snapshot `2026-09-09T13:43:06Z`. Retrieval endpoint: `https://overpass-api.de/api/interpreter`.

```overpass
[out:json][timeout:35];way["highway"](17.385,78.32,17.445,78.38);out tags geom;
```

Save the JSON response outside the public tree, then run:

```sh
python scripts/build-footpath-data.py /path/to/overpass.json
```

The script clips geometry to west 78.32, south 17.385, east 78.38, north 17.445; excludes corridors/raceways; keeps a documented tag subset and the source way ID. Snapshot metadata and query travel with the public GeoJSON. This is an approximate study window including connecting streets, not official neighbourhood boundaries. Map buttons are viewport presets, not geographic filters.

6,300 input ways included only 92 with sidewalk-related tags. Those are metadata counts, not a statement that the remaining ways have no footpaths. The clipped output has 6,300 records coincidentally: clipping splits some ways while exclusions remove others. Dual carriageways and split records are not unique streets; no percentage of streets unsafe or complete is calculated.

`core.mjs` handles conservative classification. Conflicting generic and side-specific tags return unknown. Steps, crossing ways and walking links remain map signals with unknown current condition, width and connectivity. Standalone crossing/kerb nodes are not included. No comprehensive crossing inventory, connected walking graph, step-free navigation or safety score exists. **Zero reviewed firsthand field surveys are seeded.**

Tag references: [OSM sidewalks](https://wiki.openstreetmap.org/wiki/Sidewalks). Vendor: [Leaflet 1.9.4](https://leafletjs.com/download.html), BSD-2-Clause; retained LICENSE in `vendor/`. Background tiles follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/): no prefetch/offline cache, standard browser requests and caching, attribution, valid referrer. At scale use a suitable tile provider. Notes/photos are not sent to OSM; background requests disclose the viewer's IP and tile coordinates to the tile server.

## Photograph credit

[View of service road junction towards Nanakramguda, November 2025](https://commons.wikimedia.org/wiki/File:View_of_service_road_junction_towards_Nanakramguda,_November_2025.jpg), by [Tushar0034](https://commons.wikimedia.org/wiki/User:Tushar0034), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Taken 25 November 2025. The shipped WebP is a resized format conversion of the source's primary frame, with no scene changes. Original dimensions 3788 × 2852. Commons camera metadata: 17.419106, 78.356281; not independently geolocated.

This image establishes only what was visible in that frame at that time. It does not establish current conditions, continuity outside the frame, widths, slopes, traffic volumes, signal timing, legal right of way or accessibility. The neighbouring SVG is an original conceptual top-down diagram of continuous paths, driveway continuity, a crossing and landscaping. It is not geometrically registered to the photograph. A future matched photo proposal needs a working image pipeline plus explicit derivative labelling and source credit; do not relabel the archive photo as current.

## Turn this into a true field map

Start with a short, named stretch rather than three purportedly surveyed neighbourhoods. Audit both sides with dated endpoints and direction, gaps/driveways/crossings, precise pin locations and photo references. Capture successful continuous stretches too. Record clear width and level changes if measured; never infer dimensions from photos. Avoid identifiable bystanders, number plates and private property information.

Have a second person review each submitted note against its date, location and evidence. Publish only reviewed observations with source, confidence, review date and a correction process. Keep historical observations separate from the newest verified ones. Keep OSM evidence separate from firsthand findings. Revisit construction-sensitive locations. A future moderated public-submission backend is a separate change; the current export is a handoff file, not a submission.

## Verify and release

`npm test` checks classifiers, report validation/export and real snapshot integrity. `npm run check` checks scripts, HTML IDs, bindings and local assets. These are not browser/visual QA. Existing GitHub Actions validates the full lab and packages the site. Cloudflare deployment remains gated by `CLOUDFLARE_DEPLOY_ENABLED`; setup is deferred per the owner's instruction. Do not publish via OpenAI Sites.
