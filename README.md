# SOLOPASS Vector Studio (sologo)

Precision vector generator, cipher encoder, and animation studio for the SOLOPASS emblem & wordmark.

## Features
- **Parametric Geometric Engine**: Pure SVG vector rendering with customizable center ring, wings, arc curvatures, offsets, balance, and neon glow.
- **Two-Way Vector Seeds (`SP2-`)**: URL and clipboard-friendly serializable state.
- **Steganographic Cipher Codec**: Deterministically encode text phrases directly into geometric parameters and decode them on the fly.
- **`.spmotion` Keyframe Timeline**: Multi-keyframe animation studio with ease curves, scrubbing, looping, and ping-pong playback.
- **Export Suite**:
  - Pure SVG (`.svg`)
  - Standalone Animated SVG (embedded JS & SMIL keyframe runner)
  - Video (`.webm` via canvas stream capture)
  - High-res PNG & 512x512 app icon
  - Keyframe JSON (`.spmotion`)
- **AI Co-Pilot & Automation Bridge (`window.SOLOPASS_API`)**: Exposes programmatic API for external LLM agents and local models to inspect, drive sliders, choreograph motion, and export vectors.

## Quick Start
Open `index.html` in any modern web browser or serve locally:
```powershell
python -m http.server 8080
```
Then visit `http://127.0.0.1:8080`.
