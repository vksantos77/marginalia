const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../pdf-view.js");

// A white RGBA page with a dark rectangle from (x0, y0) up to, not including, (x1, y1).
function page(width, height, ink) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (ink) {
    for (let y = ink.y0; y < ink.y1; y++) for (let x = ink.x0; x < ink.x1; x++) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 20;
    }
  }
  return {data, width, height};
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("fitScale: a página ocupa a largura da tela no zoom 1", () => {
  const f = V.fitScale({pageW: 612, pageH: 792, boxW: 360, dpr: 1});
  near(f.cssW, 360);
  near(f.cssH, 792 * 360 / 612);
  near(f.scale, 360 / 612);
});

test("fitScale: usa o DPR real até 3 e não passa disso", () => {
  near(V.fitScale({pageW: 600, pageH: 800, boxW: 360, dpr: 3}).ratio, 3);
  near(V.fitScale({pageW: 600, pageH: 800, boxW: 360, dpr: 4}).ratio, 3);
  near(V.fitScale({pageW: 600, pageH: 800, boxW: 360, dpr: 0.5}).ratio, 1);
  near(V.fitScale({pageW: 600, pageH: 800, boxW: 360, dpr: NaN}).ratio, 1);
});

test("fitScale: com zoom, reduz a nitidez para não passar do limite de pixels do canvas", () => {
  const f = V.fitScale({pageW: 600, pageH: 800, boxW: 390, zoom: 4, dpr: 3});
  near(f.cssW, 1560);
  assert.ok(f.ratio < 3);
  assert.ok(f.cssW * f.ratio * f.cssH * f.ratio <= V.MAX_CANVAS_PIXELS + 1);
});

test("fitScale: com corte, a parte visível é que ocupa a largura", () => {
  const crop = {x: 0.1, y: 0.05, w: 0.8, h: 0.9};
  const f = V.fitScale({pageW: 600, pageH: 800, boxW: 360, dpr: 2, crop});
  near(f.cssW, 360);
  near(f.cssH, 800 * 0.9 * 360 / (600 * 0.8));
  near(f.scale, 360 / 480 * 2);
});

test("clampZoom e pinchZoom respeitam os limites", () => {
  assert.equal(V.clampZoom(10), V.MAX_ZOOM);
  assert.equal(V.clampZoom(0.1), V.MIN_ZOOM);
  assert.equal(V.clampZoom("x"), 1);
  assert.equal(V.pinchZoom(1, 100, 200), 2);
  assert.equal(V.pinchZoom(1, 100, 50, 1), 1);
  assert.equal(V.pinchZoom(2, 0, 50), 2);
});

test("contentBox: corta a margem branca e deixa uma folga", () => {
  const b = V.contentBox(page(100, 100, {x0: 20, y0: 10, x1: 80, y1: 90}), {pad: 0.02});
  near(b.x, 0.18); near(b.w, 0.64);
  near(b.y, 0.08); near(b.h, 0.84);
});

test("contentBox: página em branco fica inteira", () => {
  assert.deepEqual(V.contentBox(page(50, 50)), V.FULL);
});

test("contentBox: conteúdo estreito demais, como só o número da página, não vira zoom gigante", () => {
  assert.deepEqual(V.contentBox(page(100, 100, {x0: 48, y0: 90, x1: 52, y1: 95})), V.FULL);
});

test("contentBox: ignora pixel transparente e quase branco", () => {
  const p = page(100, 100, {x0: 20, y0: 20, x1: 80, y1: 80});
  // A faint gray dot and a transparent dark one in the corner must not widen the box.
  p.data.set([245, 245, 245, 255], 0);
  p.data.set([0, 0, 0, 0], (99 * 100 + 99) * 4);
  const b = V.contentBox(p, {pad: 0});
  near(b.x, 0.2); near(b.w, 0.6);
});

test("gestureAction: toque nas bordas troca de página e no centro mostra as barras", () => {
  const tap = x => V.gestureAction({dx: 2, dy: 3, dt: 120, x, width: 400});
  assert.equal(tap(40), "prev");
  assert.equal(tap(380), "next");
  assert.equal(tap(200), "toggleBars");
});

test("gestureAction: deslizar para os lados troca de página", () => {
  assert.equal(V.gestureAction({dx: -120, dy: 10, dt: 250, x: 300, width: 400}), "next");
  assert.equal(V.gestureAction({dx: 120, dy: 10, dt: 250, x: 100, width: 400}), "prev");
});

test("gestureAction: arrasto curto, lento ou vertical não troca de página", () => {
  assert.equal(V.gestureAction({dx: -30, dy: 0, dt: 200, x: 200, width: 400}), "none");
  assert.equal(V.gestureAction({dx: -120, dy: 0, dt: 1500, x: 200, width: 400}), "none");
  assert.equal(V.gestureAction({dx: -60, dy: 200, dt: 300, x: 200, width: 400}), "none");
  assert.equal(V.gestureAction({dx: 2, dy: 2, dt: 600, x: 380, width: 400}), "none");
});

test("gestureAction: com zoom, deslizar só troca de página quem já está na borda", () => {
  const swipe = (dx, atLeft, atRight) => V.gestureAction({dx, dy: 0, dt: 200, x: 200, width: 400, zoomed: true, atLeft, atRight});
  assert.equal(swipe(-120, false, false), "none");
  assert.equal(swipe(-120, false, true), "next");
  assert.equal(swipe(120, false, true), "none");
  assert.equal(swipe(120, true, false), "prev");
});

test("isDoubleTap: dois toques rápidos e próximos", () => {
  assert.equal(V.isDoubleTap({t: 0, x: 100, y: 100}, {t: 200, x: 110, y: 105}), true);
  assert.equal(V.isDoubleTap({t: 0, x: 100, y: 100}, {t: 400, x: 100, y: 100}), false);
  assert.equal(V.isDoubleTap({t: 0, x: 100, y: 100}, {t: 100, x: 200, y: 100}), false);
  assert.equal(V.isDoubleTap(null, {t: 0, x: 0, y: 0}), false);
});
