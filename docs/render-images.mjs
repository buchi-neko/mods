// README 用の「見た目の再現画像」を作るスクリプト。
// mod 本体（cache-usage-bar/hooks/register.tsx）と同じバーの SVG・色・文言で帯を HTML に組み、
// Chrome のヘッドレス機能で PNG に書き出す。実行: node docs/render-images.mjs
// 本体の色や文言を変えたら、ここも合わせて直してから再実行する。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'images')
// Chrome の場所。macOS 以外では環境変数 CHROME で指定する
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// 撮影する高さ（CSS ピクセル）。帯がこれより高いと切れるので、検出して止める
const SHOT_HEIGHT = 400

// ---- 本体と同じ値（register.tsx からの写し） ----
const TTL = 60
const BAR_WIDTH = 120
const BAR_HEIGHT = 6
const BAR_TRACK = 'rgba(128,128,128,0.3)'
const BAR_OK = '#3fa66a'
const BAR_WARN = '#e0a020'
const LIMIT_WIDTH = 56
const LIMIT_PAD = 3
const LIMIT_HEIGHT = BAR_HEIGHT + LIMIT_PAD * 2
const LIMIT_OK = '#5b8def'
const LIMIT_TICK = '#8a8a8a'
const LIMIT_WARN_PERCENT = 80

const TEXT = {
  en: {
    cacheLeft: m => `cache ${m}m left`,
    cacheExpired: 'cache expired — next message re-reads the whole chat',
  },
  ja: {
    cacheLeft: m => `cache 残り ${m}分`,
    cacheExpired: 'cache 切れ（次の送信は会話全体を読み直し）',
  },
}

const barSvg = (ratio, color) => {
  const filled = Math.max(BAR_HEIGHT, Math.round(BAR_WIDTH * Math.min(1, ratio)))
  const r = BAR_HEIGHT / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_WIDTH}" height="${BAR_HEIGHT}">` +
    `<rect width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${r}" fill="${BAR_TRACK}"/>` +
    `<rect width="${filled}" height="${BAR_HEIGHT}" rx="${r}" fill="${color}"/></svg>`
  )
}

const limitBarSvg = (percent, color, elapsed) => {
  const ratio = Math.min(1, Math.max(0, percent / 100))
  const filled = ratio > 0 ? Math.max(BAR_HEIGHT, Math.round(LIMIT_WIDTH * ratio)) : 0
  const r = BAR_HEIGHT / 2
  const tickX = Math.min(LIMIT_WIDTH - 2, Math.max(0, Math.round(LIMIT_WIDTH * elapsed) - 1))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LIMIT_WIDTH}" height="${LIMIT_HEIGHT}">` +
    `<rect y="${LIMIT_PAD}" width="${LIMIT_WIDTH}" height="${BAR_HEIGHT}" rx="${r}" fill="${BAR_TRACK}"/>` +
    `<rect y="${LIMIT_PAD}" width="${filled}" height="${BAR_HEIGHT}" rx="${r}" fill="${color}"/>` +
    `<rect x="${tickX}" width="2" height="${LIMIT_HEIGHT}" rx="1" fill="${LIMIT_TICK}"/></svg>`
  )
}

// ---- 場面（cache の残り分・利用枠の値）と、帯の幅 ----
// elapsed は「期間のうち過ぎた割合」（縦線の位置）
const SCENES = {
  normal: { width: 820, left: 58, limits: [['5h', 12, 0.3, '3h31m'], ['7d', 23, 0.45, '3d20h']] },
  narrow: { width: 420, left: 58, limits: [['5h', 12, 0.3, '3h31m'], ['7d', 23, 0.45, '3d20h']] },
  warning: { width: 820, left: 8, limits: [['5h', 86, 0.7, '1h29m'], ['7d', 41, 0.6, '2d19h']] },
  expired: { width: 820, left: 0, limits: [['5h', 12, 0.3, '3h31m'], ['7d', 23, 0.45, '3d20h']] },
}

const svgImg = (svg, w, h) =>
  `<img width="${w}" height="${h}" src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}">`

const cacheHtml = (lang, left) => {
  if (left <= 0) return `<div class="cache shrink"><span class="error">${TEXT[lang].cacheExpired}</span></div>`
  const warn = left <= 10
  return (
    `<div class="cache group"><span class="${warn ? 'warn' : 'dim'}">${TEXT[lang].cacheLeft(left)}</span>` +
    svgImg(barSvg(left / TTL, warn ? BAR_WARN : BAR_OK), BAR_WIDTH, BAR_HEIGHT) +
    `</div>`
  )
}

const limitHtml = ([label, percent, elapsed, reset]) => {
  const over = percent >= LIMIT_WARN_PERCENT
  const head = over
    ? `<span class="warn"><b>${label}</b> ${percent}%</span>`
    : `<span><b>${label}</b><span class="dim"> ${percent}%</span></span>`
  return (
    `<div class="group">${head}` +
    svgImg(limitBarSvg(percent, over ? BAR_WARN : LIMIT_OK, elapsed), LIMIT_WIDTH, LIMIT_HEIGHT) +
    `<span class="dim">${reset}</span></div>`
  )
}

// デスクトップアプリの暗い画面に置いた帯（角丸の板）として組む
const page = (lang, scene) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: #1a1a1a; }
  body { padding: 10px; width: ${scene.width}px; box-sizing: border-box;
    font: 14px -apple-system, "Hiragino Sans", "Helvetica Neue", sans-serif; color: #e8e8e8; }
  .band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    column-gap: 16px; row-gap: 6px; background: #262626; border-radius: 12px; padding: 10px 14px; }
  .limits { display: flex; flex-wrap: wrap; column-gap: 16px; row-gap: 6px; min-width: 0; }
  .group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .shrink { flex-shrink: 1; min-width: 0; }
  .dim { color: #9a9a9a; } .warn { color: #e0a020; } .error { color: #e5534b; }
  b { font-weight: 600; color: #f2f2f2; } .warn b { color: inherit; }
</style></head><body><div class="band">
  ${cacheHtml(lang, scene.left)}
  <div class="limits">${scene.limits.map(limitHtml).join('')}</div>
</div></body></html>`

mkdirSync(OUT, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'cub-'))

try {
for (const lang of ['en', 'ja']) {
  for (const [name, scene] of Object.entries(SCENES)) {
    const html = join(work, `${name}-${lang}.html`)
    writeFileSync(html, page(lang, scene))
    // 高さは余裕を持って撮り、下の余白を Python（PIL）で中身の高さに切り詰める
    const png = join(OUT, `${name}-${lang}.png`)
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
      `--window-size=${scene.width},${SHOT_HEIGHT}`, `--screenshot=${png}`, `file://${html}`,
    ], { stdio: 'ignore' })
    if (!existsSync(png)) throw new Error(`Chrome が画像を書き出せなかった: ${png}（CHROME=${CHROME}）`)
    // 背景色（#1a1a1a）だけの行を下から削り、上と同じ 10px（2倍で 20px）の余白を残す
    execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
px = im.load()
rows = [y for y in range(h) if any(px[x, y] != (26, 26, 26) for x in range(0, w, 2))]
if not rows:
    sys.exit('画像が背景色だけ（Chrome が何も描けていない）: ' + sys.argv[1])
bottom = rows[-1]
if bottom >= h - 21:
    sys.exit('帯が撮影範囲より高く、下が切れている（SHOT_HEIGHT を増やす）: ' + sys.argv[1])
im.crop((0, 0, w, min(h, bottom + 21))).save(sys.argv[1])
`, png])
    console.log(png)
  }
}
} finally {
  // 作業用の HTML は残さない
  rmSync(work, { recursive: true, force: true })
}
