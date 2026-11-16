import { expect, test } from 'claude-code/testing'

// 入力欄の上の帯を描かせるときの共通の入力
const BAND = {
  plugin: 'cache-usage-bar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    view: {},
    scroll: { offset: 0, bodyRows: 10 },
  },
} as const

// 既存のテストは日本語表示の設定で動かす
const JA = { options: { language: 'ja' } } as const

const MINUTE = 60_000
const NOW = 1_000 * MINUTE

// 「最後のやりとりが minutesAgo 分前」という状態を用意する（$ を使う前に1回だけ呼ぶ）
const arrange = (
  on: any,
  minutesAgo: number | null,
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[] = [],
) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits } }))
  on('state.get', () => ({
    value: { value: minutesAgo === null ? null : NOW - minutesAgo * MINUTE, version: 1 },
  }))
}

// 帯を描かせて、出た文字を返す
const drawn = async ($: any, surface: 'terminal' | 'desktop') => {
  const ui = await $.ui.mount({ ...BAND, surface })
  const text = (await ui.find({ type: 'Text' }))?.text
  await ui.unmount()

  return text
}

test('やりとり直後は、デスクトップで残り60分と出る', JA, async ($, on) => {
  arrange(on, 0)

  expect(await drawn($, 'desktop')).toBe('cache 残り 60分')
})

test('CLI（ターミナル）では何も描かない', JA, async ($, on) => {
  arrange(on, 0)

  expect(await drawn($, 'terminal')).toBeUndefined()
})

test('55分経つと残り5分と出る', JA, async ($, on) => {
  arrange(on, 55)

  expect(await drawn($, 'desktop')).toBe('cache 残り 5分')
})

test('60分を過ぎると切れたと出る', JA, async ($, on) => {
  arrange(on, 61)

  expect(await drawn($, 'desktop')).toBe('cache 切れ（次の送信は会話全体を読み直し）')
})

test('まだやりとりが無ければ何も描かない', JA, async ($, on) => {
  arrange(on, null)

  expect(await drawn($, 'desktop')).toBeUndefined()
})

test('残り時間のバーが描かれ、55分後は幅が12分の1になる', JA, async ($, on) => {
  arrange(on, 55)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const bar = await ui.find({ type: 'Svg' })
  await ui.unmount()

  expect(bar).toBeDefined()
  // 120px の 5/60 = 10px ぶんだけ色が付く
  expect(JSON.stringify(bar)).toContain('rect width=\\"10\\"')
})

test('右側に利用枠の使用率が並ぶ（知らない種類は名前のまま）', JA, async ($, on) => {
  arrange(on, 0, [
    { kind: 'five_hour', percentUsed: 4 },
    { kind: 'seven_day', percentUsed: 23.4 },
    { kind: 'something_new', percentUsed: 28 },
  ])

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const found = await Promise.all(
    [/^5h/, /^7d/, /^something_new/].map(text => ui.find({ type: 'Text', text })),
  )
  await ui.unmount()

  expect(found.map(node => node?.text)).toEqual(['5h 4%', '7d 23%', 'something_new 28%'])
})

test('リセットまでの残りがバーの右に、24時間未満は時間と分、以上は日と時間で出る', JA, async ($, on) => {
  arrange(on, 0, [
    { kind: 'five_hour', percentUsed: 4, resetsAt: new Date(NOW + 151 * MINUTE).toISOString() },
    { kind: 'seven_day', percentUsed: 23, resetsAt: new Date(NOW + (3 * 24 + 5) * 60 * MINUTE + 59 * MINUTE).toISOString() },
    { kind: 'past', percentUsed: 1, resetsAt: new Date(NOW - MINUTE).toISOString() },
  ])

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // 見出し＋使用率と、残り時間は別々の文字として並ぶ
  const heads = await Promise.all(
    [/^5h/, /^7d/, /^past/].map(text => ui.find({ type: 'Text', text })),
  )
  const lefts = await Promise.all(
    [/^2h31m$/, /^3d5h$/].map(text => ui.find({ type: 'Text', text })),
  )
  // 残りは「◯h◯m」「◯d◯h」の形だけ。過ぎた枠（past）のぶんは出ない
  const allLefts = await ui.findAll({ type: 'Text', text: /^\d+[hd]\d+[mh]$/ })
  await ui.unmount()

  expect(heads.map(node => node?.text)).toEqual(['5h 4%', '7d 23%', 'past 1%'])
  expect(lefts.map(node => node?.text)).toEqual(['2h31m', '3d5h'])
  expect(allLefts).toHaveLength(2)
})

// 帯に出た SVG のうち、alt が pattern に合うものの中身を文字列で返す。
// find は alt では絞れないので、全部取ってから自分で選ぶ
const svgOf = async ($: any, pattern: RegExp) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const all = await ui.findAll({ type: 'Svg' })
  await ui.unmount()

  const svg = all.find((node: any) => pattern.test(node.props.alt))

  return svg === undefined ? undefined : JSON.stringify(svg)
}

test('cache のバーは残り10分以下の時だけ点滅する', JA, async ($, on) => {
  arrange(on, 55)

  expect(await svgOf($, /^残り時間のバー/)).toContain('<animate')
})

test('cache のバーは余裕がある間は点滅しない', JA, async ($, on) => {
  arrange(on, 5)

  expect(await svgOf($, /^残り時間のバー/)).not.toContain('<animate')
})

test('利用枠のバーに、期間の経過割合の位置へ縦線が立つ（点滅はしない）', JA, async ($, on) => {
  // 5時間の枠で残り150分 = 半分が経過。56px の半分 = 28px、縦線の左端は 27px
  arrange(on, 0, [
    { kind: 'five_hour', percentUsed: 90, resetsAt: new Date(NOW + 150 * MINUTE).toISOString() },
  ])

  const svg = await svgOf($, /^5h の使用率 90%（期間の 50% が経過）/)

  expect(svg).toContain('rect x=\\"27\\" width=\\"2\\"')
  // 56px の 90% = 50px ぶん色が付く
  expect(svg).toContain('width=\\"50\\"')
  expect(svg).not.toContain('<animate')
})

test('期間の長さが分からない種類の枠は、縦線なしのバーになる', JA, async ($, on) => {
  arrange(on, 0, [
    { kind: 'something_new', percentUsed: 28, resetsAt: new Date(NOW + 60 * MINUTE).toISOString() },
  ])

  const svg = await svgOf($, /^something_new の使用率 28%$/)

  expect(svg).toBeDefined()
  expect(svg).not.toContain('rect x=')
})

test('狭い幅でも崩れないよう、帯は折り返し可で、各塊は縮まない', JA, async ($, on) => {
  arrange(on, 0, [
    { kind: 'five_hour', percentUsed: 2 },
    { kind: 'seven_day', percentUsed: 1 },
  ])

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const [band, cache, limits, five, seven] = await Promise.all(
    ['band', 'cache', 'limits', 'limit-five_hour', 'limit-seven_day'].map(key => ui.find({ key })),
  )
  await ui.unmount()

  // 帯と利用枠の並びは、入りきらなければ次の行へ回す
  expect(band?.props.flexWrap).toBe('wrap')
  expect(limits?.props.flexWrap).toBe('wrap')
  // cache の塊と各枠は縮めない（文字が縦に折れたりバーが重なったりしない）
  expect([cache, five, seven].map(node => node?.props.flexShrink)).toEqual([0, 0, 0])
})

// ---- 英語（既定）の表示 ----

test('設定なしなら英語で、残り時間に left が付く', async ($, on) => {
  arrange(on, 0)

  expect(await drawn($, 'desktop')).toBe('cache 60m left')
})

test('英語で、切れたら次の送信で読み直すと出る', async ($, on) => {
  arrange(on, 61)

  expect(await drawn($, 'desktop')).toBe('cache expired — next message re-reads the whole chat')
})

test('設定の候補に無い値（fr）は未設定扱いになり、既定の英語で出る', { options: { language: 'fr' } }, async ($, on) => {
  arrange(on, 55)

  expect(await drawn($, 'desktop')).toBe('cache 5m left')
})

test('英語では、バーの読み上げ用の説明も英語になる', async ($, on) => {
  arrange(on, 0, [
    { kind: 'five_hour', percentUsed: 90, resetsAt: new Date(NOW + 150 * MINUTE).toISOString() },
  ])

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alts = (await ui.findAll({ type: 'Svg' })).map((node: any) => node.props.alt)
  await ui.unmount()

  expect(alts).toEqual(['Cache time left (60 of 60 min)', '5h usage 90% (50% of the window elapsed)'])
})
