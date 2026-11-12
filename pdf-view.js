// Pure math for the PDF reader: page scale, margin cropping and touch gestures.
// No DOM here, so the same file runs in the app and in the Node tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PdfView = api;
})(typeof self !== "undefined" ? self : this, () => {
  "use strict";

  const MAX_DPR = 3;
  // iOS Safari refuses to draw canvases above this many pixels.
  const MAX_CANVAS_PIXELS = 16777216;
  const MIN_ZOOM = 0.5, MAX_ZOOM = 4;
  const FULL = Object.freeze({x: 0, y: 0, w: 1, h: 1});

  const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;

  function clampZoom(z, min = MIN_ZOOM, max = MAX_ZOOM) {
    return Math.min(max, Math.max(min, finite(Number(z), 1)));
  }

  // Zoom after a pinch, from the distance between the fingers at the start and now.
  function pinchZoom(startZoom, startDist, dist, min, max) {
    if (!(startDist > 0) || !(dist > 0)) return clampZoom(startZoom, min, max);
    return clampZoom(startZoom * dist / startDist, min, max);
  }

  // How big to show the page (CSS pixels) and how sharp to draw it (canvas pixels).
  // crop is the visible part of the page as fractions; boxW is the width the page should fill at zoom 1.
  function fitScale({pageW, pageH, boxW, zoom = 1, dpr = 1, crop = FULL, maxPixels = MAX_CANVAS_PIXELS}) {
    const c = crop || FULL;
    const visW = pageW * c.w, visH = pageH * c.h;
    const cssW = Math.max(1, boxW) * clampZoom(zoom);
    const cssScale = cssW / visW;
    const cssH = visH * cssScale;
    let ratio = Math.min(MAX_DPR, Math.max(1, finite(dpr, 1)));
    // Above the pixel limit, draw less sharp rather than not at all.
    if (cssW * ratio * cssH * ratio > maxPixels) ratio = Math.sqrt(maxPixels / (cssW * cssH));
    return {cssW, cssH, ratio, scale: cssScale * ratio};
  }

  // The part of a rendered page that has ink, as fractions of the page, with a small margin left around it.
  // Pages that are blank, or whose content is too narrow to be worth zooming into, stay whole.
  function contentBox({data, width, height}, {threshold = 240, pad = 0.03, minSize = 0.4} = {}) {
    let left = width, right = -1, top = height, bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 16) continue;
        if (data[i] < threshold || data[i + 1] < threshold || data[i + 2] < threshold) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right < 0) return FULL;
    const x0 = Math.max(0, left / width - pad), x1 = Math.min(1, (right + 1) / width + pad);
    const y0 = Math.max(0, top / height - pad), y1 = Math.min(1, (bottom + 1) / height + pad);
    if (x1 - x0 < minSize || y1 - y0 < minSize) return FULL;
    return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
  }

  const TAP_MOVE = 10, TAP_MS = 300, SWIPE_MIN = 50, SWIPE_MS = 800, EDGE = 0.25;

  // What a finished one-finger touch means: "next", "prev", "toggleBars" or "none".
  // zoomed: the page is wider than the screen. atLeft/atRight: where the horizontal scroll was when the touch began,
  // so a swipe on a zoomed page pans it first and only turns the page once already at that edge.
  function gestureAction({dx, dy, dt, x, width, zoomed = false, atLeft = true, atRight = true}) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < TAP_MOVE && ay < TAP_MOVE && dt < TAP_MS) {
      if (x < width * EDGE) return "prev";
      if (x > width * (1 - EDGE)) return "next";
      return "toggleBars";
    }
    if (ax >= SWIPE_MIN && ax > ay * 1.5 && dt < SWIPE_MS) {
      if (dx < 0) return !zoomed || atRight ? "next" : "none";
      return !zoomed || atLeft ? "prev" : "none";
    }
    return "none";
  }

  function isDoubleTap(prev, cur) {
    if (!prev || !cur) return false;
    return cur.t - prev.t < TAP_MS && Math.hypot(cur.x - prev.x, cur.y - prev.y) < 30;
  }

  return {MAX_DPR, MAX_CANVAS_PIXELS, MIN_ZOOM, MAX_ZOOM, FULL, clampZoom, pinchZoom, fitScale, contentBox, gestureAction, isDoubleTap};
});
