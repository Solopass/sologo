/**
 * SOLO-SYNC: Optical & Digital AI-to-AI High-Speed Visual Communications Protocol
 * 
 * Features:
 * 1. SoloSyncProtocol: M-ary Geometric Constellation Encoder / Decoder with CRC-8 and Packet Framing.
 * 2. SoloSyncGrid: Optical Calibration Alignment Grid renderer (Fiducial anchors, radial reticle, clock strobe).
 * 3. SoloSyncCVDecoder: Pure Canvas computer vision pipeline (fiducial bounding-box crop, clock strobe, radial & arc sampler).
 * 4. SoloSyncChannel: High-speed transceiver managing Digital (BroadcastChannel) and Optical (Camera/Canvas) links.
 */

(function(global) {
    'use strict';

    // =========================================================================
    // 1. CONSTANTS & CRC-8 CHECKSUM
    // =========================================================================
    const SYNC_BYTE = 0xA5;
    const END_BYTE = 0x5A;

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
    const SoloSyncProtocol = {
        computeCRC8,

        /**
         * Packetize a string into an array of constellation frame states.
         */
        encodePayloadToFrames(textPayload) {
            const encoder = new TextEncoder();
            const rawBytes = encoder.encode(textPayload || '');
            const frames = [];

            if (rawBytes.length === 0) return frames;

            const totalChunks = Math.ceil(rawBytes.length / 2);

            for (let seq = 0; seq < totalChunks; seq++) {
                const b0 = rawBytes[seq * 2];
                const b1 = (seq * 2 + 1 < rawBytes.length) ? rawBytes[seq * 2 + 1] : 0x00;
                const isLast = (seq === totalChunks - 1);
                const clockBit = seq % 2;
                const crc = computeCRC8([seq & 0x0F, b0, b1]);

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
            const gapStep = (b0 >> 4) & 0x0F;
            const rotStep = b0 & 0x0F;
            // Ensure minimum 20 deg gap when gapStep > 0, 0 when 0
            const ringGapDeg = Math.round(gapStep * (140 / 15));
            const ringRotate = Math.round(-120 + rotStep * (240 / 15));

            const topLenStep = (b1 >> 4) & 0x0F;
            const curveStep = (b1 >> 1) & 0x07;
            const tripleWing = (b1 & 0x01) === 1;

            const topWingLen = Math.round(60 + topLenStep * (120 / 15));
            const botWingLen = Math.round(topWingLen * 0.72);
            const wingCurve = Math.round(-24 + curveStep * (48 / 7));

            const color1Idx = (crc >> 5) & 0x07;
            const color2Idx = (crc >> 2) & 0x07;
            const spacingStep = crc & 0x03;

            const strokeColor = CONSTELLATION_PALETTE[color1Idx];
            const secondaryColor = CONSTELLATION_PALETTE[color2Idx];
            const wingSpacing = 18 + spacingStep * 6;

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
                glowBlur: 0,
                glowOpacity: 1,
                lockNonStraight: false,
                clockBit,
                seq,
                isLast
            };
        },

        /**
         * Demodulate geometric measurements back into [b0, b1] bytes
         */
        demodulateStateToBytes(meas) {
            const gapStep = Math.max(0, Math.min(15, Math.round(meas.ringGapDeg / (140 / 15))));
            const rotStep = Math.max(0, Math.min(15, Math.round((meas.ringRotate + 120) / (240 / 15))));
            const b0 = ((gapStep & 0x0F) << 4) | (rotStep & 0x0F);

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
        generateGridMarkup(width = 600, height = 220, clockBit = 0, frameSeq = 0) {
            const cx = width / 2;
            const cy = 110;

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

            const concentricRings = [24, 44, 72, 105, 145].map(r =>
                `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#6366f1" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="3 3" />`
            ).join('');

            let polarRays = '';
            for (let deg = 0; deg < 360; deg += 30) {
                const rad = (deg * Math.PI) / 180;
                const x2 = cx + Math.cos(rad) * 210;
                const y2 = cy + Math.sin(rad) * 210;
                polarRays += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#6366f1" stroke-opacity="0.12" stroke-width="1" />`;
            }

            const wingRulers = `
                <line x1="40" y1="${cy - 12}" x2="${width - 40}" y2="${cy - 12}" stroke="#38bdf8" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="2 4" />
                <line x1="40" y1="${cy + 12}" x2="${width - 40}" y2="${cy + 12}" stroke="#38bdf8" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="2 4" />
            `;

            const strobeColorA = clockBit === 1 ? '#38bdf8' : '#1e1e30';
            const strobeColorB = clockBit === 1 ? '#1e1e30' : '#38bdf8';
            const clockStrobe = `
                <g class="solo-clock-strobe">
                    <rect x="${cx - 40}" y="8" width="36" height="8" fill="${strobeColorA}" rx="2" />
                    <rect x="${cx + 4}" y="8" width="36" height="8" fill="${strobeColorB}" rx="2" />
                    <text x="${cx}" y="24" text-anchor="middle" font-size="8" font-family="monospace" fill="#94a3b8">FRAME ${frameSeq} · CLK ${clockBit}</text>
                </g>`;

            const swatches = CONSTELLATION_PALETTE.map((hex, idx) =>
                `<rect x="${cx - 80 + idx * 20}" y="${height - 18}" width="16" height="8" fill="${hex}" rx="1.5" stroke="#ffffff" stroke-opacity="0.2" stroke-width="0.5" />`
            ).join('');

            return `
                <g id="soloOpticalGrid" class="pointer-events-none select-none">
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

            this.scanCanvas = document.createElement('canvas');
            this.scanCanvas.width = 300;
            this.scanCanvas.height = 110;
            this.scanCtx = this.scanCanvas.getContext('2d', { willReadFrequently: true });

            this.lastClockBit = -1;
            this.lockConfidence = 0;
            this.isTrackingLocked = false;
        }

        reset() {
            this.lastClockBit = -1;
            this.lockConfidence = 0;
            this.isTrackingLocked = false;
        }

        /**
         * Locate the cyan corner fiducial bounding box in a raw video/canvas source
         * and map it into the canonical 600x220 canvas.
         */
        alignSourceToCanonical(source, srcW, srcH) {
            const sw = this.scanCanvas.width;
            const sh = this.scanCanvas.height;
            this.scanCtx.drawImage(source, 0, 0, sw, sh);
            const scanData = this.scanCtx.getImageData(0, 0, sw, sh).data;

            // Search 4 quadrants for cyan fiducial bullseyes (#38bdf8 -> high B & G, lower R)
            const findCornerCentroid = (x0, y0, x1, y1) => {
                let sumX = 0, sumY = 0, count = 0;
                for (let y = y0; y < y1; y += 2) {
                    for (let x = x0; x < x1; x += 2) {
                        const i = (y * sw + x) * 4;
                        const r = scanData[i], g = scanData[i + 1], b = scanData[i + 2];
                        if (b > 150 && g > 130 && (b - r) > 55) {
                            sumX += x;
                            sumY += y;
                            count++;
                        }
                    }
                }
                if (count < 3) return null;
                return { x: (sumX / count) / sw * srcW, y: (sumY / count) / sh * srcH };
            };

            // Search outer corner regions only so center emblem, strobe, and swatches never skew centroids
            const leftMaxX = Math.floor(sw * 0.25);
            const rightMinX = Math.floor(sw * 0.75);
            const topMaxY = Math.floor(sh * 0.32);
            const botMinY = Math.floor(sh * 0.68);
            const tl = findCornerCentroid(0, 0, leftMaxX, topMaxY);
            const tr = findCornerCentroid(rightMinX, 0, sw, topMaxY);
            const bl = findCornerCentroid(0, botMinY, leftMaxX, sh);
            const br = findCornerCentroid(rightMinX, botMinY, sw, sh);

            if (tl && tr && bl && br) {
                // Fiducials sit at (24, 24) and (576, 196) inside 600x220
                const boxW = Math.max(40, ((tr.x - tl.x) + (br.x - bl.x)) / 2);
                const boxH = Math.max(20, ((bl.y - tl.y) + (br.y - tr.y)) / 2);
                const scaleX = boxW / 552;
                const scaleY = boxH / 172;
                const cropX = Math.max(0, tl.x - 24 * scaleX);
                const cropY = Math.max(0, tl.y - 24 * scaleY);
                const cropW = Math.min(srcW - cropX, 600 * scaleX);
                const cropH = Math.min(srcH - cropY, 220 * scaleY);

                if (cropW > 60 && cropH > 30) {
                    this.ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, 600, 220);
                    return true;
                }
            }

            // Fallback: full-frame stretch
            this.ctx.drawImage(source, 0, 0, 600, 220);
            return false;
        }

        processFrame(videoElement) {
            if (!videoElement || videoElement.readyState < 2) {
                return { locked: false, confidence: 0, isNewFrame: false };
            }
            const vw = videoElement.videoWidth || 640;
            const vh = videoElement.videoHeight || 480;
            const fiducialsFound = this.alignSourceToCanonical(videoElement, vw, vh);
            return this.decodeCanonicalCanvas(fiducialsFound, false);
        }

        decodeCanvas(sourceCanvas, forceNewFrame = true) {
            if (!sourceCanvas) return { locked: false, confidence: 0, isNewFrame: false };
            const fiducialsFound = this.alignSourceToCanonical(sourceCanvas, sourceCanvas.width, sourceCanvas.height);
            return this.decodeCanonicalCanvas(fiducialsFound, forceNewFrame);
        }

        decodeCanonicalCanvas(fiducialsFound = false, forceNewFrame = false) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            const data = this.ctx.getImageData(0, 0, w, h).data;

            const cx = 300;
            const cy = 110;

            // Sample optical clock strobe (cx - 22, y: 12) vs (cx + 22, y: 12)
            const leftStrobeLuma = this.getRegionLuminance(data, cx - 22, 12, w, 4);
            const rightStrobeLuma = this.getRegionLuminance(data, cx + 22, 12, w, 4);
            const clockBit = leftStrobeLuma > rightStrobeLuma ? 1 : 0;

            const isNewFrame = forceNewFrame || (this.lastClockBit !== clockBit);

            // Detect ring contrast across 360 deg to stay robust even with a portal gap
            const coreLuma = this.getRegionLuminance(data, cx, cy, w, 3);
            let maxRingLuma = 0;
            for (let deg = 0; deg < 360; deg += 30) {
                const rad = (deg * Math.PI) / 180;
                const rx = cx + Math.cos(rad) * 44;
                const ry = cy + Math.sin(rad) * 44;
                maxRingLuma = Math.max(maxRingLuma, this.getPixelLuminance(data, rx, ry, w));
            }

            const contrast = Math.max(0, maxRingLuma - coreLuma);
            const strobeContrast = Math.abs(leftStrobeLuma - rightStrobeLuma);
            const rawConf = Math.round(((contrast / 140) * 0.7 + (fiducialsFound ? 0.3 : 0.1) + Math.min(0.2, strobeContrast / 150)) * 100);
            this.lockConfidence = Math.max(0, Math.min(100, rawConf));
            this.isTrackingLocked = this.lockConfidence > 35;

            if (!isNewFrame || !this.isTrackingLocked) {
                return {
                    locked: this.isTrackingLocked,
                    confidence: this.lockConfidence,
                    fiducialsFound,
                    isNewFrame: false
                };
            }

            this.lastClockBit = clockBit;

            // 1. Locate active top wing row across possible wingSpacing values (18, 24, 30, 36)
            const startX = cx + 44 + 24; // cx + r + wingGap
            const bestTop = this.findBestWingRow(data, startX, cy, w);
            const topWingMeasurement = this.sampleWingRay(data, startX, bestTop.y, 1, 190, w);

            // 2. Measure wing curvature at wing midpoint
            const midX = startX + topWingMeasurement.length / 2;
            const wingCurve = this.sampleWingCurveAtX(data, midX, bestTop.y, w);

            // 3. Measure 3-wing tier presence near its root (minimal Bezier curve interference)
            const halfSpread = Math.abs(cy + 2 - bestTop.y);
            const botY = cy + 2 + halfSpread;
            const thirdY = Math.round(botY + halfSpread * 0.92);
            const thirdX = cx + 44 + 24 + 12;
            const tripleWing = this.getRegionLuminance(data, thirdX, thirdY, w, 2) > 90;

            // 4. Measure center ring portal gap & rotation
            const ringPortalMeasurement = this.samplePortalArc(data, cx, cy, 44, w, clockBit);

            const rawDemod = SoloSyncProtocol.demodulateStateToBytes({
                ringGapDeg: ringPortalMeasurement.gapDeg,
                ringRotate: ringPortalMeasurement.rotateDeg,
                topWingLen: topWingMeasurement.length,
                wingCurve,
                tripleWing
            });

            return {
                locked: true,
                confidence: this.lockConfidence,
                fiducialsFound,
                isNewFrame: true,
                clockBit,
                bytes: rawDemod
            };
        }

        getPixelLuminance(data, x, y, width) {
            const px = Math.max(0, Math.min(width - 1, Math.round(x)));
            const py = Math.max(0, Math.min(219, Math.round(y)));
            const idx = (py * width + px) * 4;
            return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        }

        getRegionLuminance(data, cx, cy, width, radius = 2) {
            let sum = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    sum += this.getPixelLuminance(data, cx + dx, cy + dy, width);
                    count++;
                }
            }
            return sum / Math.max(1, count);
        }

        findBestWingRow(data, startX, cy, width) {
            // wingOffsetY = 2, halfSpread in [9, 12, 15, 18] -> topY in [cy-7 .. cy-16]
            // Sample near the wing root (startX..startX+10) so wingCurve never shifts the detected row
            let bestY = cy - 10;
            let bestScore = -1;
            for (let y = cy - 18; y <= cy - 6; y++) {
                let score = 0;
                for (let x = startX + 1; x <= startX + 10; x += 2) {
                    score += this.getPixelLuminance(data, x, y, width);
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestY = y;
                }
            }
            return { y: bestY, score: bestScore };
        }

        sampleWingRay(data, startX, baseY, dir, maxLen, width) {
            let len = 0;
            const threshold = 90;
            for (let offset = 0; offset <= maxLen; offset += 2) {
                const x = startX + dir * offset;
                // Search vertical band around baseY to handle curved wings
                let maxBandLuma = 0;
                for (let dy = -14; dy <= 14; dy += 2) {
                    maxBandLuma = Math.max(maxBandLuma, this.getPixelLuminance(data, x, baseY + dy, width));
                }
                if (maxBandLuma > threshold) {
                    len = offset;
                }
            }
            // Compensate ~3px for round lineCap radius (wingStrokeWidth=7 -> r=3.5)
            return { length: Math.max(55, Math.min(185, len - 3)) };
        }

        sampleWingCurveAtX(data, midX, baseY, width) {
            let bestY = baseY;
            let bestLuma = 0;
            for (let dy = -16; dy <= 16; dy++) {
                const luma = this.getPixelLuminance(data, midX, baseY + dy, width);
                if (luma > bestLuma) {
                    bestLuma = luma;
                    bestY = baseY + dy;
                }
            }
            // In SVG, midY = baseY - curveY -> curveY = (baseY - bestY) * 2
            return Math.max(-24, Math.min(24, Math.round((baseY - bestY) * 2)));
        }

        samplePortalArc(data, cx, cy, radius, width, clockBit = 0) {
            const totalSamples = 180;
            const darkFlags = new Array(totalSamples);
            let darkArcCount = 0;

            for (let i = 0; i < totalSamples; i++) {
                const deg = i * (360 / totalSamples);
                const rad = (deg * Math.PI) / 180;
                const x = cx + Math.cos(rad) * radius;
                const y = cy + Math.sin(rad) * radius;
                // Sample slight radial band to handle strokeWidth 6-11px
                const luma = Math.max(
                    this.getPixelLuminance(data, x, y, width),
                    this.getPixelLuminance(data, cx + Math.cos(rad) * (radius - 2), cy + Math.sin(rad) * (radius - 2), width),
                    this.getPixelLuminance(data, cx + Math.cos(rad) * (radius + 2), cy + Math.sin(rad) * (radius + 2), width)
                );
                const isDark = luma < 115;
                darkFlags[i] = isDark;
                if (isDark) darkArcCount++;
            }

            const rawGapDeg = (darkArcCount / totalSamples) * 360;
            const gapDeg = darkArcCount > 0 ? Math.min(140, Math.round(rawGapDeg + (clockBit === 1 ? 8 : 5))) : 0;
            let rotateDeg = 0;

            if (darkArcCount > 1 && darkArcCount < totalSamples) {
                // Find longest contiguous dark run
                let bestStart = 0, bestLen = 0;
                for (let i = 0; i < totalSamples * 2; i++) {
                    if (darkFlags[i % totalSamples]) {
                        let len = 0;
                        while (len < totalSamples && darkFlags[(i + len) % totalSamples]) len++;
                        if (len > bestLen) {
                            bestLen = len;
                            bestStart = i % totalSamples;
                        }
                        i += len;
                    }
                }
                const startDeg = bestStart * (360 / totalSamples);
                // In SVG: stroke-dasharray starts at 0 deg (3 o'clock), rotated by (ringRotate + ringGapDeg/2)
                // So the dark gap starts at (ringRotate + ringGapDeg/2 + 360 - gapDeg) = ringRotate - gapDeg/2
                let estRotate = startDeg + gapDeg / 2;
                while (estRotate > 180) estRotate -= 360;
                while (estRotate < -180) estRotate += 360;
                rotateDeg = Math.max(-120, Math.min(120, Math.round(estRotate)));
            }

            return { gapDeg, rotateDeg };
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
            this.onTxCompleteCallback = null;

            this.cameraStream = null;
            this.cameraVideo = null;
            this.cameraRafId = null;
            this.isReceivingCamera = false;

            this.rxBuffer = [];
            this.rxHistory = [];
            this.lastSeqReceived = -1;
            this.onReceiveCallback = null;
            this.onTxProgressCallback = null;
            this.onRxTelemetryCallback = null;

            if (this.broadcast) {
                this.broadcast.onmessage = (e) => {
                    if (e.data && e.data.type === 'SOLOSYNC_FRAME') {
                        this.handleReceivedFrame(e.data.frame);
                    }
                };
            }
        }

        transmit(textPayload, options = {}) {
            this.stopTransmission(false);
            const fps = Math.max(1, Math.min(60, options.fps || 24));
            const loop = Boolean(options.loop);
            this.txFrames = SoloSyncProtocol.encodePayloadToFrames(textPayload);
            if (!this.txFrames.length) {
                if (typeof options.onComplete === 'function') options.onComplete();
                return;
            }

            this.txIndex = 0;
            this.isTransmitting = true;
            this.onTxCompleteCallback = options.onComplete || null;

            const intervalMs = Math.round(1000 / fps);
            const onFrameRender = options.onFrameRender || null;

            const emitCurrentFrame = () => {
                if (!this.isTransmitting) return;
                if (this.txIndex >= this.txFrames.length) {
                    if (loop) {
                        this.txIndex = 0;
                    } else {
                        this.stopTransmission(true);
                        return;
                    }
                }

                const currentFrame = this.txFrames[this.txIndex];

                if (this.broadcast) {
                    this.broadcast.postMessage({
                        type: 'SOLOSYNC_FRAME',
                        frame: currentFrame
                    });
                }

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
            };

            emitCurrentFrame();
            this.txTimer = setInterval(emitCurrentFrame, intervalMs);
        }

        stopTransmission(triggerComplete = false) {
            this.isTransmitting = false;
            if (this.txTimer) {
                clearInterval(this.txTimer);
                this.txTimer = null;
            }
            if (triggerComplete && typeof this.onTxCompleteCallback === 'function') {
                const cb = this.onTxCompleteCallback;
                this.onTxCompleteCallback = null;
                cb();
            }
        }

        async startCameraReceiver(videoElement) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Webcam access not supported in this browser environment');
            }

            this.cvDecoder.reset();
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

            // If seq === 0 and we already have a non-empty buffer from a previous message, archive it
            if (frame.seq === 0 && this.rxBuffer.length > 0 && this.lastSeqReceived !== 0) {
                const prevMsg = new TextDecoder().decode(new Uint8Array(this.rxBuffer));
                if (prevMsg.trim()) this.rxHistory.push(prevMsg);
                this.rxBuffer = [];
            }
            if (frame.seq !== undefined) {
                this.lastSeqReceived = frame.seq;
            }

            if (frame.b0 !== undefined && frame.b0 !== 0) this.rxBuffer.push(frame.b0);
            if (frame.b1 !== undefined && frame.b1 !== 0) this.rxBuffer.push(frame.b1);

            const currentText = new TextDecoder().decode(new Uint8Array(this.rxBuffer));
            const fullText = this.rxHistory.length
                ? [...this.rxHistory, currentText].filter(Boolean).join('\n')
                : currentText;

            if (typeof this.onReceiveCallback === 'function') {
                this.onReceiveCallback({
                    rawFrame: frame,
                    bufferLength: this.rxBuffer.length,
                    currentMessage: currentText,
                    text: fullText
                });
            }
        }

        clearRxBuffer() {
            this.rxBuffer = [];
            this.rxHistory = [];
            this.lastSeqReceived = -1;
        }
    }

    global.SoloSyncProtocol = SoloSyncProtocol;
    global.SoloSyncGrid = SoloSyncGrid;
    global.SoloSyncCVDecoder = SoloSyncCVDecoder;
    global.SoloSyncChannel = SoloSyncChannel;

})(typeof window !== 'undefined' ? window : this);
