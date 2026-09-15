import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/home/user/Financeapp/instagram/exports';
mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&family=Outfit:wght@800&display=swap">`;

const COMMON_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1350px; overflow: hidden; }
  .slide {
    width: 1080px; height: 1350px;
    background: linear-gradient(176deg, #1E3A5F 0%, #142B47 100%);
    position: relative;
  }
  .safe {
    position: absolute;
    top: 80px; right: 80px; bottom: 80px; left: 80px;
    display: flex; flex-direction: column;
  }
  .grow { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .foot {
    display: flex; justify-content: space-between; align-items: flex-end;
    padding-top: 22px;
  }
  .wm {
    font-family: 'Outfit', sans-serif; font-weight: 800;
    font-size: 28px; color: rgba(255,255,255,0.6);
    letter-spacing: -0.02em; line-height: 1;
  }
  .wm-i { color: rgba(96,165,250,0.85); }
  .hd {
    font-family: 'DM Sans', sans-serif; font-weight: 400;
    font-size: 16px; color: rgba(255,255,255,0.6); line-height: 1;
  }
`;

const slides = [
  // Slide 1: Hook
  `<style>
    ${COMMON_CSS}
    .s1-hook {
      font-family: 'DM Serif Display', serif;
      font-size: 84px; color: #FFFFFF; line-height: 1.12;
    }
    .s1-sub {
      font-family: 'DM Serif Display', serif;
      font-size: 54px; color: #60A5FA; line-height: 1.2;
      margin-top: 38px;
    }
    .swipe {
      display: flex; align-items: center; gap: 8px;
      align-self: flex-end; margin-bottom: 32px;
      font-family: 'DM Sans', sans-serif; font-size: 14px;
      font-weight: 500; color: rgba(255,255,255,0.4);
      letter-spacing: 0.12em; text-transform: uppercase;
    }
  </style>
  <div class="slide">
    <div class="safe">
      <div class="grow">
        <h1 class="s1-hook">Ya sabes en qué gastas.</h1>
        <p class="s1-sub">Lo que nadie te dice es qué hacer con eso.</p>
      </div>
      <div class="swipe"><span>Desliza</span><span>&#x203A;</span></div>
      <div class="foot">
        <span class="wm">zaf<span class="wm-i">i</span></span>
        <span class="hd">@usezafi</span>
      </div>
    </div>
  </div>`,

  // Slide 2: App de gastos
  `<style>
    ${COMMON_CSS}
    .cmp-title {
      font-family: 'DM Sans', sans-serif; font-weight: 500;
      font-size: 30px; color: rgba(255,255,255,0.7);
      margin-bottom: 54px; letter-spacing: 0.01em;
    }
    .bullets { list-style: none; display: flex; flex-direction: column; gap: 45px; }
    .b-item {
      display: flex; align-items: baseline; gap: 26px;
      font-family: 'DM Sans', sans-serif; font-size: 34px;
      line-height: 1.45; color: rgba(255,255,255,0.7);
    }
    .dot-grey {
      flex-shrink: 0; width: 11px; height: 11px;
      border-radius: 50%; background: #4B5563;
      position: relative; top: -2px;
    }
  </style>
  <div class="slide">
    <div class="safe">
      <div class="grow">
        <p class="cmp-title">Una app de gastos te dice:</p>
        <ul class="bullets">
          <li class="b-item"><span class="dot-grey"></span><span>Gastaste Q1,850 en comida</span></li>
          <li class="b-item"><span class="dot-grey"></span><span>Subiste 12% vs. el mes pasado</span></li>
          <li class="b-item"><span class="dot-grey"></span><span>Tu categoría más alta: Restaurantes</span></li>
        </ul>
      </div>
      <div class="foot">
        <span class="wm">zaf<span class="wm-i">i</span></span>
        <span class="hd">@usezafi</span>
      </div>
    </div>
  </div>`,

  // Slide 3: zafi te dice
  `<style>
    ${COMMON_CSS}
    .slide::before {
      content: ''; position: absolute;
      top: 20%; left: -10%; width: 70%; height: 60%;
      background: radial-gradient(ellipse, rgba(37,99,235,0.06) 0%, transparent 70%);
      pointer-events: none;
    }
    .cmp-title {
      font-family: 'DM Sans', sans-serif; font-weight: 500;
      font-size: 30px; color: rgba(255,255,255,0.7);
      margin-bottom: 54px; letter-spacing: 0.01em;
    }
    .cmp-wm {
      font-family: 'Outfit', sans-serif; font-weight: 800;
      font-size: 32px; letter-spacing: -0.02em;
    }
    .cmp-wm .wm-accent { color: #60A5FA; }
    .bullets { list-style: none; display: flex; flex-direction: column; gap: 45px; }
    .b-item {
      display: flex; align-items: baseline; gap: 26px;
      font-family: 'DM Sans', sans-serif; font-size: 34px;
      line-height: 1.45; color: rgba(255,255,255,0.9);
    }
    .dot-blue {
      flex-shrink: 0; width: 11px; height: 11px;
      border-radius: 50%; background: #2563EB;
      box-shadow: 0 0 8px rgba(37,99,235,0.4);
      position: relative; top: -2px;
    }
    .num { font-family: 'Outfit', sans-serif; font-weight: 800; color: #FFFFFF; }
    .score { font-family: 'Outfit', sans-serif; font-weight: 800; color: #10B981; }
  </style>
  <div class="slide">
    <div class="safe">
      <div class="grow">
        <p class="cmp-title"><span class="cmp-wm">zaf<span class="wm-accent">i</span></span> te dice:</p>
        <ul class="bullets">
          <li class="b-item"><span class="dot-blue"></span><span>Si sigues así, el <span class="num">24</span> te quedas sin efectivo</span></li>
          <li class="b-item"><span class="dot-blue"></span><span>Mueve <span class="num">Q400</span> de Restaurantes a tu meta de Bono 14</span></li>
          <li class="b-item"><span class="dot-blue"></span><span>Tu Health Score sube a <span class="score">71</span> si lo haces</span></li>
        </ul>
      </div>
      <div class="foot">
        <span class="wm">zaf<span class="wm-i">i</span></span>
        <span class="hd">@usezafi</span>
      </div>
    </div>
  </div>`,

  // Slide 4: Cierre
  `<style>
    ${COMMON_CSS}
    .s4-grow { align-items: center; text-align: center; }
    .s4-head {
      font-family: 'DM Serif Display', serif;
      font-size: 70px; color: #FFFFFF; line-height: 1.15;
    }
    .s4-sub {
      font-family: 'DM Serif Display', serif;
      font-size: 52px; color: #60A5FA; line-height: 1.2;
      margin-top: 22px;
    }
    .s4-brand {
      font-family: 'Outfit', sans-serif; font-weight: 800;
      font-size: 118px; color: #FFFFFF; letter-spacing: -0.03em;
      line-height: 1; margin-top: 65px;
    }
    .s4-brand .brand-i { color: #2563EB; }
    .s4-glow {
      position: relative;
    }
    .s4-glow::after {
      content: ''; position: absolute;
      bottom: -20px; left: 50%; transform: translateX(-50%);
      width: 60%; height: 32px;
      background: radial-gradient(ellipse, rgba(37,99,235,0.2) 0%, transparent 70%);
    }
    .cta {
      display: inline-block; background: #2563EB; color: #FFFFFF;
      font-family: 'DM Sans', sans-serif; font-weight: 600;
      font-size: 26px; padding: 24px 54px; border-radius: 15px;
      margin-top: 54px;
      box-shadow: 0 4px 20px rgba(37,99,235,0.35);
    }
  </style>
  <div class="slide">
    <div class="safe">
      <div class="grow s4-grow">
        <h2 class="s4-head">No es otra app de gastos.</h2>
        <p class="s4-sub">Es tu asesor financiero.</p>
        <div class="s4-glow">
          <div class="s4-brand">zaf<span class="brand-i">i</span></div>
        </div>
        <span class="cta">Pruébalo gratis en zafiapp.com</span>
      </div>
      <div class="foot">
        <span class="wm">zaf<span class="wm-i">i</span></span>
        <span class="hd">@usezafi</span>
      </div>
    </div>
  </div>`
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
});

const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 2
});

const page = await ctx.newPage();

for (let i = 0; i < slides.length; i++) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=1080">${FONTS}</head><body>${slides[i]}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const path = `${OUT}/post-01-slide-${i + 1}.png`;
  await page.screenshot({
    path,
    clip: { x: 0, y: 0, width: 1080, height: 1350 }
  });
  console.log(`Slide ${i + 1} ✓`);
}

await browser.close();
console.log(`\nListo: ${OUT}`);
