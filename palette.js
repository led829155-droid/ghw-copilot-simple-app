(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    if (require.main === module) api.selfCheck();
  } else {
    root.Palette = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [r, g, b].map((v) => Math.round((v + m) * 255));
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function hslToHex(h, s, l) {
    return rgbToHex(...hslToRgb(h, s, l));
  }

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s: s * 100, l: l * 100 };
  }

  function clean(hex) {
    return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : null;
  }

  function hueDelta(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  // ponytail: anchor hue is the first locked swatch only; fit each stop if locks ever disagree
  function generatePalette(mode, locked, rng) {
    const random = rng || Math.random;
    const kept = (locked || []).map(clean);
    const anchor = kept.find(Boolean);
    const base = anchor ? hexToHsl(anchor).h : random() * 360;
    const wrap = (d) => (base + d + 360) % 360;
    let slots;
    const tone = (h, s, l) => ({ h, s: s + random() * 16, l: l + random() * 10 });
    if (mode === 'complementary') {
      slots = [
        tone(wrap(0), 58, 26),
        tone(wrap(0), 52, 42),
        tone(wrap(0), 14, 74),
        tone(wrap(180), 54, 34),
        tone(wrap(180), 42, 56),
      ];
    } else if (mode === 'analogous') {
      slots = [-30, -15, 0, 15, 30].map((d, i) => tone(wrap(d), 52, 28 + i * 9));
    } else {
      slots = [0, 1, 2, 3, 4].map((i) => ({
        h: random() * 360,
        s: 50 + random() * 30,
        l: 32 + i * 9,
      }));
    }
    return slots.map((slot, i) => kept[i] || hslToHex(slot.h, slot.s, slot.l));
  }

  function toCssVariables(colors) {
    const lines = colors.map((c, i) => '  --color-' + (i + 1) + ': ' + c + ';');
    return ':root {\n' + lines.join('\n') + '\n}\n';
  }

  function selfCheck() {
    const assert = require('assert');
    assert.strictEqual(hslToHex(0, 100, 50), '#FF0000');
    assert.strictEqual(hslToHex(120, 100, 50), '#00FF00');
    assert.strictEqual(hslToHex(240, 100, 50), '#0000FF');
    assert.strictEqual(hslToHex(60, 100, 50), '#FFFF00');
    assert.strictEqual(hslToHex(0, 0, 0), '#000000');
    assert.strictEqual(hslToHex(0, 0, 100), '#FFFFFF');

    const empty = [null, null, null, null, null];
    const base = 90;
    const ana = generatePalette('analogous', empty, () => base / 360);
    ana.forEach((hex) => {
      assert.ok(hueDelta(hexToHsl(hex).h, base) <= 31, hex);
    });
    const comp = generatePalette('complementary', empty, () => base / 360);
    comp.forEach((hex) => {
      const h = hexToHsl(hex).h;
      assert.ok(hueDelta(h, base) < 2 || hueDelta(h, (base + 180) % 360) < 2, hex + ' ' + h);
    });
    assert.ok(comp.some((hex) => hueDelta(hexToHsl(hex).h, (base + 180) % 360) < 2));

    const rnd = generatePalette('random', empty, () => 0);
    assert.strictEqual(rnd[0], hslToHex(0, 50, 32));
    assert.strictEqual(rnd[4], hslToHex(0, 50, 68));

    const locked = generatePalette('complementary', [null, '#FF0000', null, null, null], () => 0.99);
    assert.strictEqual(locked[1], '#FF0000');
    assert.ok(hueDelta(hexToHsl(locked[3]).h, 180) < 2);

    const all = ['#112233', '#445566', '#778899', '#AABBCC', '#DDEEFF'];
    assert.deepStrictEqual(generatePalette('analogous', all, () => 0.2), all);

    assert.strictEqual(
      toCssVariables(['#AABBCC', '#112233']),
      ':root {\n  --color-1: #AABBCC;\n  --color-2: #112233;\n}\n'
    );
    console.log('palette self-check ok');
  }

  return { generatePalette, toCssVariables, hslToHex, hexToHsl, selfCheck };
});
