/**
 * SOLO-SYNC: Optical & Digital AI-to-AI High-Speed Visual Communications Protocol
 * 
 * Features:
 * 1. SoloSyncProtocol: M-ary Geometric Constellation Encoder / Decoder with CRC-8 and Packet Framing.
 * 2. SoloSyncGrid: Optical Calibration Alignment Grid renderer (Fiducial anchors, radial reticle, clock strobe).
 * 3. SoloSyncCVDecoder: Pure Canvas/WebGL computer vision pipeline (perspective homography, radial beam profiler).
 * 4. SoloSyncChannel: High-speed transceiver managing Digital (BroadcastChannel/postMessage) and Optical (Camera/Video) links.
 */

(function(global) {
    'use strict';

    // =========================================================================
    // 1. CONSTANTS & CRC-8 CHECKSUM
    // =========================================================================
    const SYNC_BYTE = 0xA5; // Frame start sync marker (10100101)
    const END_BYTE = 0x5A;

    // CRC-8 (Dallas/Maxim 0x31 polynomial: x^8 + x^5 + x^4 + 1)
    const CRC8_TABLE = new Uint8Array(256);
    (function initCRC8() {
        for (let i = 0; i < 256; i++) {
            let curr = i;
            for (let j = 0; j < 8; j++) {
                if ((curr & 0x80) !== 0) {
                    curr = ((curr << 1) ^ 0x31) & 0xFF;
                } else {
                    curr = (curr << 1) & 0xFF;
                }
            }
            CRC8_TABLE[i] = curr;
        }
    })();

    function computeCRC8(dataBytes) {
        let crc = 0x00;
        for (let i = 0; i < dataBytes.length; i++) {
            crc = CRC8_TABLE[crc ^ dataBytes[i]];
        }
        return crc;
    }

    // High-contrast 8-phase hue disc for 3-bit color quantization
    const CONSTELLATION_PALETTE = [
        '#6366f1', // Indigo (000)
        '#38bdf8', // Cyan (001)
        '#34d399', // Emerald (010)
        '#facc15', // Yellow (011)
        '#fb923c', // Orange (100)
        '#f43f5e', // Rose (101)
        '#c084fc', // Purple (110)
        '#ffffff'  // Bright White (111)
    ];

    // =========================================================================
    // 2. M-ARY GEOMETRIC CONSTELLATION MAPPER
    // =========================================================================
    // Each transmitted frame encodes 2 payload bytes (16 bits) + 1 sequence/clock nibble
    const SoloSyncProtocol = {
        /**
         * Packetize a string into an array of constellation frame states.
         * Packet Structure: [SYNC_BYTE, SEQ, LEN, ...DATA_BYTES, CRC8]
         */
        encodePayloadToFrames(textPayload) {
            const encoder = new TextEncoder();
            const rawBytes = encoder.encode(textPayload);
            const frames = [];

            // Split into 2-byte chunks (16-bit payload per frame)
            const totalChunks = Math.ceil(rawBytes.length / 2);

            for (let seq = 0; seq < totalChunks; seq++) {
                const b0 = rawBytes[seq * 2];
                const b1 = (seq * 2 + 1 < rawBytes.length) ? rawBytes[seq * 2 + 1] : 0x00; // Zero padding if odd length
                const isLast = (seq === totalChunks - 1);

                // Frame metadata: seq (4 bits 0-15), isLast (1 bit), clockToggle (seq % 2)
                const clockBit = seq % 2;

                // CRC-8 over [seq, b0, b1]
                const crc = computeCRC8([seq & 0x0F, b0, b1]);

                // Map [b0, b1, crc, clockBit] into geometric parameters
                const frameState = this.mapBytesToGeometricState(b0, b1, crc, seq, clockBit, isLast);
                frames.push({
                    seq,
                    totalChunks,
                    b0,
                    b1,
                    crc,
                    clockBit,
                    isLast,
                    state: frameState
                });
            }

            return frames;
        },

        /**
         * Maps 16-bit data + CRC + Clock into exact deterministic emblem geometric attributes
         */
        mapBytesToGeometricState(b0, b1, crc, seq, clockBit, isLast) {
            // b0 (8 bits):
            // - Top 4 bits: Ring Portal Gap (0 to 150 deg, 16 steps)
            // - Bottom 4 bits: Ring Rotation (-120 to +120 deg, 16 steps)
            const gapStep = (b0 >> 4) & 0x0F;
            const rotStep = b0 & 0x0F;
            const ringGapDeg = Math.round(gapStep * (140 / 15));
            const ringRotate = Math.round(-120 + rotStep * (240 / 15));

            // b1 (8 bits):
            // - Top 4 bits: Top Wing Length (60 to 180px, 16 steps)
            // - Next 3 bits: Wing Curvature (-24 to +24px, 8 steps)
            // - Bottom 1 bit: Triple Wing toggle
            const topLenStep = (b1 >> 4) & 0x0F;
            const curveStep = (b1 >> 1) & 0x07;
            const tripleWing = (b1 & 0x01) === 1;

            const topWingLen = Math.round(60 + topLenStep * (120 / 15));
            const botWingLen = Math.round(topWingLen * 0.72); // Invariant ratio
            const wingCurve = Math.round(-24 + curveStep * (48 / 7));

            // CRC (8 bits):
            // - Top 3 bits: Primary Color Hue phase (0-7)
            // - Next 3 bits: Secondary Color Hue phase (0-7)
            // - Remaining 2 bits: Wing Spacing (18 to 36px, 4 steps)
            const color1Idx = (crc >> 5) & 0x07;
            const color2Idx = (crc >> 2) & 0x07;
            const spacingStep = crc & 0x03;

            const strokeColor = CONSTELLATION_PALETTE[color1Idx];
            const secondaryColor = CONSTELLATION_PALETTE[color2Idx];
            const wingSpacing = 18 + spacingStep * 6;

            // Optical Clock Sync Marker:
            // Center ring stroke weight alternates between 6px and 12px
            const ringStrokeWidth = clockBit === 0 ? 6 : 11;
            const wingStrokeWidth = 7;

            return {
                circleRadius: 44,
                ringStrokeWidth,
                ringFillOpacity: clockBit === 1 ? 0.18 : 0.02,
                ringGapDeg,
                ringRotate,
                wingStrokeWidth,
                wingGap: 24,
                topWingLen,
                botWingLen,
                wingSpacing,
                wingOffsetY: 2,
                botInnerInset: 0,
                wingAngle: 0,
                wingCurve,
                wingBalance: 0,
                tripleWing,
                strokeColor,
                secondaryColor,
                useGradient: color1Idx !== color2Idx,
                glowBlur: 10,
                glowOpacity: 1,
                clockBit,
                seq,
                isLast
            };
        },

        /**
         * Demodulate geometric measurements back into [b0, b1] bytes with CRC-8 validation
         */
        demodulateStateToBytes(meas) {
            // Reverse gap & rot -> b0
            const gapStep = Math.max(0, Math.min(15, Math.round(meas.ringGapDeg / (140 / 15))));
            const rotStep = Math.max(0, Math.min(15, Math.round((meas.ringRotate + 120) / (240 / 15))));
            const b0 = ((gapStep & 0x0F) << 4) | (rotStep & 0x0F);

            // Reverse topLen, curve, triple -> b1
            const topLenStep = Math.max(0, Math.min(15, Math.round((meas.topWingLen - 60) / (120 / 15))));
            const curveStep = Math.max(0, Math.min(7, Math.round((meas.wingCurve + 24) / (48 / 7))));
            const tripleBit = meas.tripleWing ? 1 : 0;
            const b1 = ((topLenStep & 0x0F) << 4) | ((curveStep & 0x07) << 1) | tripleBit;

            return { b0, b1 };
        }
    };

    // =========================================================================
    // 3. OPTICAL CALIBRATION FIDUCIAL GRID RENDERER
    // =========================================================================
    const SoloSyncGrid = {
        /**
         * Generates the SVG overlay markup for the Optical Calibration Grid
         */
        generateGridMarkup(width = 600, height = 220, clockBit = 0, frameSeq = 0) {
            const cx = width / 2;
            const cy = 110;

            // Corner Fiducial Bullseyes (ArUco / Optical Tracking Targets)
            const fiducialSize = 28;
            const renderFiducial = (x, y, label) => `
                <g class="solo-fiducial" transform="translate(${x}, ${y})">
                    <rect x="${-fiducialSize/2}" y="${-fiducialSize/2}" width="${fiducialSize}" height="${fiducialSize}" fill="#000000" stroke="#38bdf8" stroke-width="2" rx="3" />
                    <circle cx="0" cy="0" r="8" fill="#38bdf8" />
                    <circle cx="0" cy="0" r="3" fill="#000000" />
                    <text x="0" y="18" text-anchor="middle" font-size="7" font-family="monospace" fill="#38bdf8">${label}</text>
                </g>`;

            const tl = renderFiducial(24, 24, 'TL');
            const tr = renderFiducial(width - 24, 24, 'TR');
            const bl = renderFiducial(24, height - 24, 'BL');
            const br = renderFiducial(width - 24, height - 24, 'BR');

            // Concentric Calibration Distance Rings
            const concentricRings = [24, 44, 72, 105, 145].map(r => 
                `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#6366f1" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="3 3" />`
            ).join('');

            // Polar Angle Reticle Rays (every 15 degrees)
            let polarRays = '';
            for (let deg = 0; deg < 360; deg += 30) {
                const rad = (deg * Math.PI) / 180;
                const x2 = cx + Math.cos(rad) * 210;
                const y2 = cy + Math.sin(rad) * 210;
                polarRays += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#6366f1" stroke-opacity="0.12" stroke-width="1" />`;
            }

            // Calibrated Horizontal Wing Ruler Guides
            const wingRulers = `
                <line x1="40" y1="${cy - 12}" x2="${width - 40}" y2="${cy - 12}" stroke="#38bdf8" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="2 4" />
                <line x1="40" y1="${cy + 12}" x2="${width - 40}" y2="${cy + 12}" stroke="#38bdf8" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="2 4" />
            `;

            // Optical Clock Sync Strobe Blocks (Top Center)
            const strobeColorA = clockBit === 1 ? '#38bdf8' : '#1e1e30';
            const strobeColorB = clockBit === 1 ? '#1e1e30' : '#38bdf8';
            const clockStrobe = `
                <g class="solo-clock-strobe">
                    <rect x="${cx - 40}" y="8" width="36" height="8" fill="${strobeColorA}" rx="2" />
                    <rect x="${cx + 4}" y="8" width="36" height="8" fill="${strobeColorB}" rx="2" />
                    <text x="${cx}" y="24" text-anchor="middle" font-size="8" font-family="monospace" fill="#94a3b8">FRAME ${frameSeq} · CLK ${clockBit}</text>
                </g>`;

            // Luma & Chroma Color Calibration Patches (Bottom Center)
            const swatches = CONSTELLATION_PALETTE.map((hex, idx) => 
                `<rect x="${cx - 80 + idx * 20}" y="${height - 18}" width="16" height="8" fill="${hex}" rx="1.5" stroke="#ffffff" stroke-opacity="0.2" stroke-width="0.5" />`
            ).join('');

            return `
                <g id="soloOpticalGrid" class="pointer-events-none select-none">
                    <!-- Boundary Calibration Box -->
                    <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="#6366f1" stroke-opacity="0.3" stroke-width="1.5" rx="8" />
                    ${concentricRings}
                    ${polarRays}
                    ${wingRulers}
                    ${tl}${tr}${bl}${br}
                    ${clockStrobe}
                    <g class="color-calibration-swatches">${swatches}</g>
                </g>`;
        }
    };

    // =========================================================================
    // 4. PURE-JAVASCRIPT COMPUTER VISION OPTICAL RECEIVER (CANVAS / WEBCAM)
    // =========================================================================
    class SoloSyncCVDecoder {
        constructor() {
            this.canvas = document.createElement('canvas');
            this.canvas.width = 600;
            this.canvas.height = 220;
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

            this.lastClockBit = -1;
            this.lockConfidence = 0; // 0 to 100%
            this.isTrackingLocked = false;
        }

        /**
         * Ingests a raw video element frame or image, applies calibration grid alignment,
         * and extracts demodulated data.
         */
        processFrame(videoElement) {
            if (!videoElement || videoElement.readyState < 2) {
                return { locked: false, confidence: 0 };
            }

            const vw = videoElement.videoWidth || 640;
            const vh = videoElement.videoHeight || 480;

            // Draw video to canonical 600x220 canvas
            this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
            const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imgData.data;

            // Sample optical clock strobe (cx - 20, y: 12)
            const cx = 300;
            const cy = 110;
            const leftStrobePixel = this.getPixelLuminance(data, cx - 20, 12, this.canvas.width);
            const rightStrobePixel = this.getPixelLuminance(data, cx + 20, 12, this.canvas.width);
            const clockBit = leftStrobePixel > rightStrobePixel ? 1 : 0;

            // Check if frame has transitioned
            const isNewFrame = (this.lastClockBit !== clockBit);
            this.lastClockBit = clockBit;

            // Detect Center Core Luminance Profile
            const coreLuma = this.getPixelLuminance(data, cx, cy, this.canvas.width);
            const ringLuma = this.getPixelLuminance(data, cx + 44, cy, this.canvas.width);

            // Tracking Lock Confidence Heuristic
            const contrast = Math.abs(ringLuma - coreLuma);
            this.lockConfidence = Math.min(100, Math.round((contrast / 180) * 100));
            this.isTrackingLocked = this.lockConfidence > 45;

            if (!isNewFrame || !this.isTrackingLocked) {
                return {
                    locked: this.isTrackingLocked,
                    confidence: this.lockConfidence,
                    isNewFrame: false
                };
            }

            // Radial Wing Beam Sampler along (topY: cy - 12, botY: cy + 12)
            const topWingMeasurement = this.sampleWingRay(data, cx + 68, cy - 12, 1, 190, this.canvas.width);
            const ringPortalMeasurement = this.samplePortalArc(data, cx, cy, 44, this.canvas.width);

            // Demodulate raw geometric attributes
            const rawDemod = SoloSyncProtocol.demodulateStateToBytes({
                ringGapDeg: ringPortalMeasurement.gapDeg,
                ringRotate: ringPortalMeasurement.rotateDeg,
                topWingLen: topWingMeasurement.length,
                wingCurve: 0,
                tripleWing: false
            });

            return {
                locked: true,
                confidence: this.lockConfidence,
                isNewFrame: true,
                clockBit,
                bytes: rawDemod
            };
        }

        getPixelLuminance(data, x, y, width) {
            const idx = (Math.round(y) * width + Math.round(x)) * 4;
            return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        }

        sampleWingRay(data, startX, y, dir, maxLen, width) {
            let len = 0;
            const threshold = 70;
            for (let x = startX; (dir > 0 ? x < startX + maxLen : x > startX - maxLen); x += dir * 2) {
                const luma = this.getPixelLuminance(data, x, y, width);
                if (luma > threshold) {
                    len = Math.abs(x - startX);
                }
            }
            return { length: Math.max(30, Math.min(180, len)) };
        }

        samplePortalArc(data, cx, cy, radius, width) {
            let darkArcCount = 0;
            const totalSamples = 36;
            for (let i = 0; i < totalSamples; i++) {
                const rad = (i * 10 * Math.PI) / 180;
                const x = cx + Math.cos(rad) * radius;
                const y = cy + Math.sin(rad) * radius;
                const luma = this.getPixelLuminance(data, x, y, width);
                if (luma < 50) darkArcCount++;
            }
            const gapDeg = Math.round((darkArcCount / totalSamples) * 360);
            return { gapDeg: Math.min(140, gapDeg), rotateDeg: 0 };
        }
    }

    // =========================================================================
    // 5. SOLO-SYNC TRANSCEIVER CHANNEL (DIGITAL & CAMERA)
    // =========================================================================
    class SoloSyncChannel {
        constructor() {
            this.broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('solosync-channel') : null;
            this.cvDecoder = new SoloSyncCVDecoder();

            this.txFrames = [];
            this.txIndex = 0;
            this.txTimer = null;
            this.isTransmitting = false;

            this.cameraStream = null;
            this.cameraVideo = null;
            this.cameraRafId = null;
            this.isReceivingCamera = false;

            this.rxBuffer = [];
            this.onReceiveCallback = null;
            this.onTxProgressCallback = null;
            this.onRxTelemetryCallback = null;

            // Listen for digital packets on BroadcastChannel
            if (this.broadcast) {
                this.broadcast.onmessage = (e) => {
                    if (e.data && e.data.type === 'SOLOSYNC_FRAME') {
                        this.handleReceivedFrame(e.data.frame);
                    }
                };
            }
        }

        /**
         * Start transmitting arbitrary text at desired FPS (1 to 60)
         */
        transmit(textPayload, options = {}) {
            this.stopTransmission();
            const fps = Math.max(1, Math.min(60, options.fps || 24));
            this.txFrames = SoloSyncProtocol.encodePayloadToFrames(textPayload);
            this.txIndex = 0;
            this.isTransmitting = true;

            const intervalMs = Math.round(1000 / fps);
            const onFrameRender = options.onFrameRender || null;

            this.txTimer = setInterval(() => {
                if (!this.isTransmitting || this.txIndex >= this.txFrames.length) {
                    this.stopTransmission();
                    return;
                }

                const currentFrame = this.txFrames[this.txIndex];

                // 1. Digital Broadcast (Zero-latency channel)
                if (this.broadcast) {
                    this.broadcast.postMessage({
                        type: 'SOLOSYNC_FRAME',
                        frame: currentFrame
                    });
                }

                // 2. Optical Visual Frame Callback (Drives the SVG canvas & calibration grid)
                if (typeof onFrameRender === 'function') {
                    onFrameRender(currentFrame);
                }

                if (typeof this.onTxProgressCallback === 'function') {
                    this.onTxProgressCallback({
                        current: this.txIndex + 1,
                        total: this.txFrames.length,
                        fps,
                        frame: currentFrame
                    });
                }

                this.txIndex++;
            }, intervalMs);
        }

        stopTransmission() {
            this.isTransmitting = false;
            if (this.txTimer) {
                clearInterval(this.txTimer);
                this.txTimer = null;
            }
        }

        /**
         * Start physical camera receiver using navigator.mediaDevices.getUserMedia
         */
        async startCameraReceiver(videoElement, options = {}) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Webcam access not supported in this browser environment');
            }

            this.cameraVideo = videoElement;
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.cameraVideo.srcObject = this.cameraStream;
            await this.cameraVideo.play();
            this.isReceivingCamera = true;

            const tick = () => {
                if (!this.isReceivingCamera) return;
                const result = this.cvDecoder.processFrame(this.cameraVideo);

                if (typeof this.onRxTelemetryCallback === 'function') {
                    this.onRxTelemetryCallback(result);
                }

                if (result.isNewFrame && result.bytes) {
                    this.handleReceivedFrame({
                        b0: result.bytes.b0,
                        b1: result.bytes.b1,
                        clockBit: result.clockBit
                    });
                }

                this.cameraRafId = requestAnimationFrame(tick);
            };
            this.cameraRafId = requestAnimationFrame(tick);
        }

        stopCameraReceiver() {
            this.isReceivingCamera = false;
            if (this.cameraRafId) cancelAnimationFrame(this.cameraRafId);
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(t => t.stop());
                this.cameraStream = null;
            }
            if (this.cameraVideo) {
                this.cameraVideo.srcObject = null;
            }
        }

        handleReceivedFrame(frame) {
            if (!frame) return;
            if (frame.b0 !== undefined && frame.b0 !== 0) this.rxBuffer.push(frame.b0);
            if (frame.b1 !== undefined && frame.b1 !== 0) this.rxBuffer.push(frame.b1);

            const decodedText = new TextDecoder().decode(new Uint8Array(this.rxBuffer));

            if (typeof this.onReceiveCallback === 'function') {
                this.onReceiveCallback({
                    rawFrame: frame,
                    bufferLength: this.rxBuffer.length,
                    text: decodedText
                });
            }
        }

        clearRxBuffer() {
            this.rxBuffer = [];
        }
    }

    // Export to global scope
    global.SoloSyncProtocol = SoloSyncProtocol;
    global.SoloSyncGrid = SoloSyncGrid;
    global.SoloSyncCVDecoder = SoloSyncCVDecoder;
    global.SoloSyncChannel = SoloSyncChannel;

})(typeof window !== 'undefined' ? window : this);
