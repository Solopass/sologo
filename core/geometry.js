/**
 * Pure parametric SVG generator for SOLOPASS Vector Studio.
 */
import { escapeXml } from './state.js';
import { encodeStateToCode } from './seed.js';

export function generateSVGString(s, {
    forExport = false,
    includeGuides = false,
    isTimelinePlaying = false,
    opticalGridMarkup = ''
} = {}) {
    const width = 600;
    const height = (s.showText || s.showLowerThird) ? 290 : 220;
    const cx = width / 2;
    const cy = (s.showText || s.showLowerThird) ? 105 : 110;

    const r = s.circleRadius;
    const gap = s.wingGap;
    const balanceFactor = s.wingBalance / 100;
    const leftTopLen = Math.max(15, s.topWingLen * (1 - balanceFactor));
    const rightTopLen = Math.max(15, s.topWingLen * (1 + balanceFactor));
    const leftBotLen = Math.max(10, s.botWingLen * (1 - balanceFactor));
    const rightBotLen = Math.max(10, s.botWingLen * (1 + balanceFactor));
    const halfSpread = s.wingSpacing / 2;
    const offsetY = s.wingOffsetY;
    const inset = s.botInnerInset;

    let effectiveAngle = s.wingAngle;
    let effectiveCurve = s.wingCurve;
    if (s.lockNonStraight && effectiveAngle === 0 && effectiveCurve === 0) {
        effectiveCurve = 8;
    }

    const topY = cy - halfSpread + offsetY;
    const botY = cy + halfSpread + offsetY;

    const leftTopInX = cx - r - gap;
    const leftTopOutX = leftTopInX - leftTopLen;
    const leftBotInX = cx - r - gap - inset;
    const leftBotOutX = leftBotInX - leftBotLen;

    const rightTopInX = cx + r + gap;
    const rightTopOutX = rightTopInX + rightTopLen;
    const rightBotInX = cx + r + gap + inset;
    const rightBotOutX = rightBotInX + rightBotLen;

    const buildWingPath = (x1, y1, x2, y2, curveY) => {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - curveY;
        return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };

    const leftTopPath = buildWingPath(leftTopInX, topY, leftTopOutX, topY, effectiveCurve);
    const leftBotPath = buildWingPath(leftBotInX, botY, leftBotOutX, botY, effectiveCurve * 0.75);
    const rightTopPath = buildWingPath(rightTopInX, topY, rightTopOutX, topY, effectiveCurve);
    const rightBotPath = buildWingPath(rightBotInX, botY, rightBotOutX, botY, effectiveCurve * 0.75);

    const thirdTierMarkup = { left: '', right: '' };
    if (s.tripleWing) {
        const thirdY = botY + halfSpread * 0.92;
        const thirdInset = inset * 1.6 + 8;
        const l3InX = cx - r - gap - thirdInset;
        const l3OutX = l3InX - Math.max(12, leftBotLen * 0.62);
        const r3InX = cx + r + gap + thirdInset;
        const r3OutX = r3InX + Math.max(12, rightBotLen * 0.62);
        const l3Path = buildWingPath(l3InX, thirdY, l3OutX, thirdY, effectiveCurve * 0.5);
        const r3Path = buildWingPath(r3InX, thirdY, r3OutX, thirdY, effectiveCurve * 0.5);
        thirdTierMarkup.left = `\n      <path d="${l3Path}" stroke-width="${Math.max(2, s.wingStrokeWidth * 0.85)}" />`;
        thirdTierMarkup.right = `\n      <path d="${r3Path}" stroke-width="${Math.max(2, s.wingStrokeWidth * 0.85)}" />`;
    }

    const circumference = 2 * Math.PI * r;
    const gapFraction = Math.max(0, Math.min(0.45, s.ringGapDeg / 360));
    const dashLength = circumference * (1 - gapFraction);
    const gapLength = circumference * gapFraction;
    const ringDashAttr = gapFraction > 0
        ? ` stroke-dasharray="${dashLength.toFixed(2)} ${gapLength.toFixed(2)}" transform="rotate(${s.ringRotate + (s.ringGapDeg / 2)} ${cx} ${cy})"`
        : '';

    const styleMode = s.visualStyle || 'classic';
    const useMultiGrad = s.useGradient || styleMode === 'plasma' || styleMode === 'holographic';
    const strokePaint = useMultiGrad ? 'url(#solopassGrad)' : s.strokeColor;
    const effectiveGlow = styleMode === 'minimal'
        ? 0
        : styleMode === 'bloom'
            ? (forExport ? Math.min(22, Math.max(8, s.glowBlur * 1.15)) : Math.max(10, s.glowBlur * 1.35))
            : s.glowBlur;
    const filterAttr = effectiveGlow > 0 ? 'filter="url(#neonGlow)"' : '';
    const seedCode = encodeStateToCode(s);
    const safeTitle = escapeXml(s.brandText || 'SOLOPASS');

    let gradStops = `
      <stop offset="0%" stop-color="${s.strokeColor}" />
      <stop offset="50%" stop-color="${s.secondaryColor}" />
      <stop offset="100%" stop-color="${s.strokeColor}" />`;
    if (styleMode === 'plasma') {
        gradStops = `
      <stop offset="0%" stop-color="${s.strokeColor}" />
      <stop offset="35%" stop-color="#ffffff" stop-opacity="0.95" />
      <stop offset="68%" stop-color="${s.secondaryColor}" />
      <stop offset="100%" stop-color="${s.strokeColor}" />`;
    } else if (styleMode === 'holographic') {
        gradStops = `
      <stop offset="0%" stop-color="${s.strokeColor}" />
      <stop offset="28%" stop-color="#38bdf8" />
      <stop offset="52%" stop-color="#f472b6" />
      <stop offset="76%" stop-color="#a78bfa" />
      <stop offset="100%" stop-color="${s.secondaryColor || '#34d399'}" />`;
    }

    const bloomExtraFilter = styleMode === 'bloom' && !forExport
        ? `\n      <feGaussianBlur stdDeviation="${(effectiveGlow * 1.65).toFixed(1)}" result="blurOuter" />`
        : '';
    const bloomExtraMerge = styleMode === 'bloom' && !forExport
        ? `\n        <feMergeNode in="blurOuter" />`
        : '';

    const defs = `
  <defs>
    <linearGradient id="solopassGrad" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="540" y2="0" gradientTransform="rotate(${s.gradAngle || 0} ${cx} ${cy})">
${gradStops}
    </linearGradient>
    <filter id="neonGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${effectiveGlow.toFixed(1)}" result="blur1" />
      <feGaussianBlur stdDeviation="${(effectiveGlow * 0.42).toFixed(1)}" result="blur2" />${bloomExtraFilter}
      <feComponentTransfer in="blur1" result="fadeBlur1">
        <feFuncA type="linear" slope="${s.glowOpacity}" />
      </feComponentTransfer>
      <feMerge>${bloomExtraMerge}
        <feMergeNode in="fadeBlur1" />
        <feMergeNode in="blur2" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>`;

    const guidesMarkup = includeGuides ? `
  <g stroke="#6366f1" stroke-opacity="0.32" stroke-width="1" stroke-dasharray="4 4">
    <line x1="0" y1="${cy}" x2="${width}" y2="${cy}" />
    <line x1="${cx}" y1="0" x2="${cx}" y2="${height}" />
    <circle cx="${cx}" cy="${cy}" r="${r + gap}" fill="none" />
  </g>
  <g class="direct-handles">
    <circle data-handle="radius" cx="${cx}" cy="${cy - r}" r="6.5" fill="#0d0d16" stroke="#38bdf8" stroke-width="2" style="cursor:ns-resize" />
    <circle data-handle="gap" cx="${rightTopInX}" cy="${topY}" r="6.5" fill="#0d0d16" stroke="#a78bfa" stroke-width="2" style="cursor:ew-resize" />
    <circle data-handle="topLen" cx="${rightTopOutX}" cy="${topY}" r="6.5" fill="#0d0d16" stroke="#818cf8" stroke-width="2" style="cursor:ew-resize" />
    <circle data-handle="botLen" cx="${rightBotOutX}" cy="${botY}" r="6.5" fill="#0d0d16" stroke="#818cf8" stroke-width="2" style="cursor:ew-resize" />
  </g>` : '';

    const wordmarkMarkup = s.showText ? `
  <text x="${cx}" y="${cy + r + (s.textOffsetY || 58)}" text-anchor="middle" fill="${strokePaint}" font-family="'Space Grotesk', 'Inter', sans-serif" font-weight="700" font-size="${s.fontSize}" letter-spacing="${s.letterSpacing}" ${filterAttr}>${safeTitle}</text>` : '';

    const ctaRaw = (s.encodedMessage && s.encodedMessage.trim()) ? s.encodedMessage.trim() : (s.brandText || 'SOLOPASS');
    const ctaText = escapeXml(ctaRaw.slice(0, 32));
    const pillW = Math.max(150, Math.min(460, ctaText.length * 10 + 44));
    const pillY = s.showText ? (cy + r + (s.textOffsetY || 58) + 18) : (cy + r + 34);
    const lowerThirdMarkup = s.showLowerThird ? `
  <g>
    <rect x="${cx - pillW / 2}" y="${pillY}" width="${pillW}" height="32" rx="16" fill="#0d0d16" fill-opacity="0.86" stroke="${strokePaint}" stroke-width="1.5" />
    <circle cx="${cx - pillW / 2 + 16}" cy="${pillY + 16}" r="4" fill="${s.secondaryColor || '#38bdf8'}" />
    <text x="${cx + 6}" y="${pillY + 20.5}" text-anchor="middle" fill="#f8fafc" font-family="'JetBrains Mono', 'Inter', monospace" font-weight="600" font-size="12.5" letter-spacing="1.6">${ctaText}</text>
  </g>` : '';

    const innerR = (s.innerRingRadius || 0) > 0 ? Math.max(4, Math.min(r - 4, s.innerRingRadius)) : 0;
    const innerRingMarkup = innerR > 0
        ? `\n    <circle cx="${cx}" cy="${cy}" r="${innerR}" stroke-width="${Math.max(1.5, s.ringStrokeWidth * 0.45).toFixed(1)}" stroke-opacity="0.75" fill="none" />`
        : '';

    const emblemCore = `
    <!-- Center Ring -->
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="${s.ringStrokeWidth}" fill="${s.strokeColor}" fill-opacity="${s.ringFillOpacity}"${ringDashAttr} />${innerRingMarkup}
    <!-- Left Wings -->
    <g transform="rotate(${-effectiveAngle} ${cx} ${cy + offsetY})">
      <path d="${leftTopPath}" stroke-width="${s.wingStrokeWidth}" />
      <path d="${leftBotPath}" stroke-width="${s.wingStrokeWidth}" />${thirdTierMarkup.left}
    </g>
    <!-- Right Wings -->
    <g transform="rotate(${effectiveAngle} ${cx} ${cy + offsetY})">
      <path d="${rightTopPath}" stroke-width="${s.wingStrokeWidth}" />
      <path d="${rightBotPath}" stroke-width="${s.wingStrokeWidth}" />${thirdTierMarkup.right}
    </g>`;

    const echoMarkup = (s.motionTrail && isTimelinePlaying && !forExport) ? `
  <g opacity="0.22" fill="none" stroke="${strokePaint}" stroke-linecap="${s.lineCap}" stroke-linejoin="round" transform="translate(${cx} ${cy}) scale(0.93) translate(${-cx} ${-cy})">${emblemCore}
  </g>
  <g opacity="0.10" fill="none" stroke="${strokePaint}" stroke-linecap="${s.lineCap}" stroke-linejoin="round" transform="translate(${cx} ${cy}) scale(0.86) translate(${-cx} ${-cy})">${emblemCore}
  </g>` : '';

    const glitchMarkup = styleMode === 'glitch' ? `
  <g opacity="0.58" fill="none" stroke="#22d3ee" stroke-linecap="${s.lineCap}" stroke-linejoin="round" transform="translate(-3.2 -1)">${emblemCore}
  </g>
  <g opacity="0.55" fill="none" stroke="#f43f5e" stroke-linecap="${s.lineCap}" stroke-linejoin="round" transform="translate(3.2 1)">${emblemCore}
  </g>` : '';

    const minimalAccentMarkup = styleMode === 'minimal' ? `
  <circle cx="${cx}" cy="${cy}" r="${(r + 6).toFixed(1)}" fill="none" stroke="${strokePaint}" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="3 5" />` : '';

    const coreHighlightMarkup = (styleMode === 'plasma' || styleMode === 'bloom' || styleMode === 'aggressive') ? `
  <g opacity="${styleMode === 'bloom' ? '0.42' : '0.28'}" fill="none" stroke="#ffffff" stroke-linecap="${s.lineCap}" stroke-linejoin="round">
    <g transform="rotate(${-effectiveAngle} ${cx} ${cy + offsetY})">
      <path d="${leftTopPath}" stroke-width="${Math.max(1.2, s.wingStrokeWidth * 0.24).toFixed(1)}" />
      <path d="${leftBotPath}" stroke-width="${Math.max(1.0, s.wingStrokeWidth * 0.2).toFixed(1)}" />
    </g>
    <g transform="rotate(${effectiveAngle} ${cx} ${cy + offsetY})">
      <path d="${rightTopPath}" stroke-width="${Math.max(1.2, s.wingStrokeWidth * 0.24).toFixed(1)}" />
      <path d="${rightBotPath}" stroke-width="${Math.max(1.0, s.wingStrokeWidth * 0.2).toFixed(1)}" />
    </g>
  </g>` : '';

    const flowAmount = Number(s.energyFlow || 0);
    const flowPhase = Number(s._flowPhase ?? ((s.gradAngle || 0) * 0.5));
    const flowMarkup = flowAmount > 0 ? `
  <g opacity="${Math.min(0.85, 0.25 + (flowAmount / 100) * 0.6).toFixed(2)}" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-dasharray="18 32" stroke-dashoffset="${flowPhase.toFixed(1)}">
    <g transform="rotate(${-effectiveAngle} ${cx} ${cy + offsetY})">
      <path d="${leftTopPath}" stroke-width="${Math.max(1.2, s.wingStrokeWidth * 0.32).toFixed(1)}" />
      <path d="${leftBotPath}" stroke-width="${Math.max(1.0, s.wingStrokeWidth * 0.28).toFixed(1)}" />
    </g>
    <g transform="rotate(${effectiveAngle} ${cx} ${cy + offsetY})">
      <path d="${rightTopPath}" stroke-width="${Math.max(1.2, s.wingStrokeWidth * 0.32).toFixed(1)}" />
      <path d="${rightBotPath}" stroke-width="${Math.max(1.0, s.wingStrokeWidth * 0.28).toFixed(1)}" />
    </g>
  </g>` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="${safeTitle} Vector Emblem" data-solopass-seed="${seedCode}">
  <title>${safeTitle} Vector Emblem</title>
  <!-- SOLOPASS Vector Emblem | Seed: ${seedCode} -->${defs}${opticalGridMarkup}${guidesMarkup}${echoMarkup}${glitchMarkup}${minimalAccentMarkup}
  <g ${filterAttr} fill="none" stroke="${strokePaint}" stroke-linecap="${s.lineCap}" stroke-linejoin="round">${emblemCore}
  </g>${coreHighlightMarkup}${flowMarkup}${wordmarkMarkup}${lowerThirdMarkup}
</svg>`;
}
