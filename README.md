# SOLOPASS Vector Studio

A zero-build, dark-themed parametric SVG logo studio, keyframe motion lab, and experimental optical beacon sync playground built with native ES modules.

## Features

- **Parametric Vector Studio**: Real-time SVG synthesis with controls for core circle, inner ring, top/bottom/triple wings, accent strokes, linear gradients, visual treatments (`Classic Neon`, `Plasma Core`, `Holographic`, `Chromatic Glitch`, `Heavy Bloom`, `Minimal Futurist`, `Apex Aggressive`), Energy Flow highlights, and custom typography.
- **Per-Slider & Section Locks**: Lock individual sliders or entire control groups (`Core`, `Wings`, `Stroke & Color`, `Text`) so Randomize, Smooth Morph, AI mutations, and Seeded Motion preserve locked attributes.
- **Keyframe Timeline & Motion Modes**: Multi-keyframe motion lab with 9 easing curves (`Smooth Cubic`, `Strong Quint`, `Elastic Spring`, `Out Elastic`, `Out Bounce`, `Overshoot Back`, `In-Out Back`, `Warp Expo`, `Linear`), staggered wing lag, continuous Idle Behaviors (`Pulse`, `Orbit`, `Flow`), one-click Motion Modes (`Idle Pulse`, `Power Up`, `Scan`, `Spin & Expand`, `Glitch Burst`, `Morph Loop`), Seeded Motion, and Smooth Morph.
- **Multi-Format Exporters**: Export static `.SVG`, `.PNG` (with embedded `tEXt` `solopass_seed` metadata chunk), `512px` App Icon `.PNG`, animated `.GIF` (pure-JS Gif89a encoder), `.WEBM`, Animated `.SVG`, and `.SPMOTION` timeline files.
- **Geometric Cipher & Message-to-Motion**: Deterministic text-to-geometry cipher, shareable `SP2-` state seeds, and a **Message-to-Motion Composer** (`Stealth Morph`, `Plasma Pulse`, `Holo Scan`, `Glitch Cipher`, or CRC-8 `Decodable Beacon`) for turning real phrases into animated corner-bug logos.
- **YouTube Video Bug Preview & Transparent/Chroma Export**: Preview your animated logo in the bottom corner of a simulated 16:9 frame (`📺 Video Bug`) and export `.GIF` / `.WEBM` with `Studio BG`, `Transparent` (alpha), or `Chroma Green (#00FF00)` and `Centered` / `YT Bottom-Left` / `YT Bottom-Right` framing.
- **Video Clip Optical Decoder & Beacon Verifier**: Scan an exported `.WEBM` / `.MP4` clip frame-by-frame (`🎞️ Decode Video Clip`) or run an instant offscreen CRC-8 round-trip check (`🧪 Verify Beacon`) without a physical webcam.
- **AI Theme Co-Pilot & Vault**: Generates themed visual variations via a local OpenAI-compatible LLM server with an automatic deterministic heuristic fallback, plus saved presets and local Vault snapshots.
- **Optical Sync (`SoloSync`, Experimental)**: Screen-to-camera data transmission using modulated chromatic corners.

## Project Architecture

```text
sologo/
├── index.html            # Layout, modals, Tailwind + custom CSS, module entrypoint
├── app.js                # Bootstrap, audio-reactive mode, user profile, SoloSync modal wiring
├── optical-sync.js       # SoloSync TX/RX optical protocol & camera decoder
├── core/
│   ├── state.js          # DEFAULTS, reactive state, presets, lock group maps, helpers
│   ├── geometry.js       # Pure SVG generator (generateSVGString)
│   ├── seed.js           # SP2- seed encode/decode & strict validation
│   ├── cipher.js         # Deterministic phrase-to-geometry encoder
│   ├── message-motion.js # Message-to-Motion choreography (Stealth & CRC-8 Beacon)
│   └── locks.js          # Group & per-slider lock state and enforcement
├── animation/
│   └── timeline.js       # Keyframe interpolation, playback, seeded motion, smooth morph
├── ui/
│   ├── render.js         # rAF-throttled SVG render, toast notifications, input/lock sync
│   └── controls.js       # Slider/lock bindings, undo stack, tabs, guides, shortcuts
├── export/
│   └── exporters.js      # SVG, PNG (tEXt seed), Gif89a, WebM, Animated SVG, .spmotion
├── ai/
│   └── copilot.js        # Local LLM client + heuristic fallback, AI Vault, SOLOPASS_API
└── tests/
    ├── test.html         # Browser test runner
    └── core.test.js      # Unit tests for seeds, cipher, locks, and SVG output
```

## Running Locally

Because the app uses native ES modules (`<script type="module">`), serve the directory over HTTP rather than opening `index.html` via `file://`:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Then open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in your browser. It also deploys directly to GitHub Pages with no build step.

## AI Co-Pilot Requirements

- The **AI Studio** tab attempts to query a local OpenAI-compatible chat completions endpoint at `http://127.0.0.1:11440/v1/chat/completions` (for example `llama.cpp` router or Ollama/compatible local servers).
- If no local server is running or reachable, the UI explicitly displays:
  > `Local model not running – using heuristic mode`
- In heuristic mode, theme generation continues to work offline using deterministic keyword-to-palette/geometry rules.

## `SP2-` Seed Format Notes

- Seeds use the format `SP2-<base64>` where `<base64>` encodes a UTF-8 JSON object:
  - `n`: Ordered array of 27 numeric parameters (`circleRadius`, `rotation`, `topWingLen`, etc.)
  - `c`: 4 hex colors (`[strokeColor, secondaryColor, bgColor, textColor]`)
  - `b`: 7 boolean flags (`showText`, `showCircle`, `showWings`, `showGuides`, `useGradient`, `glowEnabled`, `tripleWing`)
  - `t`: `[brandText, encodedMessage, fontFamily]`
- `decodeSeedDetailed()` validates structure, array lengths, finite numbers, and `#RRGGBB` hex colors before mutating any state. Invalid or legacy seeds return `{ ok: false, error }` cleanly without side effects.

## Export Behavior for Visual Effects

- **Static `.SVG` Export**: Keeps output clean and portable — `Chromatic Glitch`, `Minimal Futurist`, `Holographic`, `Plasma Core`, and static `Energy Flow` dash offsets export as pure SVG elements/gradients, while `Heavy Bloom` caps its outer blur stack to avoid oversized filter regions. Kinetic `Motion Trail` echoes are omitted from static SVG exports.
- **`.GIF`, `.WEBM`, and Animated `.SVG`**: Capture keyframe interpolation, staggered `Wing Lag`, `Energy Flow` traversal, and `Visual Treatment` transitions cleanly for playback and sharing.

## Optical Sync (`SoloSync`) Limitations

- **Experimental**: Optical Sync relies on camera frame rate, screen refresh rate, glare, and ambient lighting.
- Best results require `15–30 cm` distance, steady framing so all 4 calibration corners remain visible, and moderate screen brightness.
- If camera permission is denied or hardware is unavailable, the modal surfaces the error directly; when tracking confidence drops below `40%`, a low-confidence warning banner prompts recalibration.

## Running Tests

With the local HTTP server running, open:

- [http://127.0.0.1:8765/tests/test.html](http://127.0.0.1:8765/tests/test.html)

The browser test suite verifies:
- `SP2-` seed encode -> decode round-trip state preservation
- Graceful rejection of invalid/malformed seeds without mutating `targetState`
- Deterministic cipher encoding for identical phrases
- Group and per-slider lock enforcement
- Valid SVG output from `generateSVGString()`
