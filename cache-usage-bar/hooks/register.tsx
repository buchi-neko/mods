import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

// キャッシュの寿命（分）。サブスク利用時は 60 分。
// 利用枠の超過中は 5 分に縮むが、mod からは判別できないので 60 分固定で数える。
const TTL_MINUTES = 60
// 残りがこの分数を切ったら色を変えて知らせる
const WARN_MINUTES = 10
// 表示を書き換える間隔（ミリ秒）
const TICK_MS = 30_000

// 最後に Claude とやりとりした時刻。リロードしても消えないよう $.state に置く
const lastAt = atom({ plugin: 'cache-usage-bar', key: 'lastAt' } as const, null)

// バーの大きさ（ピクセル）と色。
// SVG は画像として描かれテーマ色を使えないので、明暗どちらの画面でも見える色を直接指定する
const BAR_WIDTH = 120
const BAR_HEIGHT = 6
const BAR_TRACK = 'rgba(128,128,128,0.3)'
const BAR_OK = '#3fa66a'
const BAR_WARN = '#e0a020'

// 急ぎを知らせる、ゆっくりした点滅（SVG 内蔵のアニメ。スクリプトは使わない）
const PULSE = '<animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite"/>'

// 残り割合（0〜1）ぶんだけ色が付いた、角の丸い横棒の SVG を作る。
// isPulsing なら色の部分がゆっくり点滅する（cache の残りが少ない時だけ使う）
const barSvg = (ratio: number, color: string, isPulsing = false): string => {
  const filled = Math.max(BAR_HEIGHT, Math.round(BAR_WIDTH * Math.min(1, ratio)))
  const r = BAR_HEIGHT / 2

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_WIDTH}" height="${BAR_HEIGHT}" viewBox="0 0 ${BAR_WIDTH} ${BAR_HEIGHT}">` +
    `<rect width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${r}" fill="${BAR_TRACK}"/>` +
    `<rect width="${filled}" height="${BAR_HEIGHT}" rx="${r}" fill="${color}">${isPulsing ? PULSE : ''}</rect>` +
    `</svg>`
  )
}

// 利用枠のバーの大きさと色。縦線（ペースの目印）が上下にはみ出すぶん、画像は棒より背が高い
const LIMIT_WIDTH = 56
const LIMIT_PAD = 3
const LIMIT_HEIGHT = BAR_HEIGHT + LIMIT_PAD * 2
const LIMIT_OK = '#5b8def'
const LIMIT_TICK = '#8a8a8a'

// 利用枠の種類ごとの期間の長さ（ミリ秒）。ここに無い種類はペースの目印を出さない
const HOUR_MS = 3_600_000
const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * HOUR_MS,
  seven_day: 7 * 24 * HOUR_MS,
}

// 期間のうち過ぎた時間の割合（0〜1）。
// 「1 −（リセットまでの残り ÷ 期間の長さ）」で、分単位よりも細かく連続的に進む。
// 期間の長さが分からない・リセット時刻が無い/読めない/過ぎている時は null
const elapsedRatio = (limit: SessionRateLimit, now: number): number | null => {
  const windowMs = WINDOW_MS[limit.kind]

  if (windowMs === undefined || limit.resetsAt === undefined) {
    return null
  }

  const leftMs = Date.parse(limit.resetsAt) - now

  if (!Number.isFinite(leftMs) || leftMs <= 0) {
    return null
  }

  return Math.min(1, Math.max(0, 1 - leftMs / windowMs))
}

// 使用率ぶん色が付いた横棒に、ペースの目印（灰色の縦線）を重ねた SVG を作る。
// 色が縦線より左なら余裕あり、右なら使いすぎのペース。elapsed が null なら縦線なし
const limitBarSvg = (percentUsed: number, color: string, elapsed: number | null): string => {
  const ratio = Math.min(1, Math.max(0, percentUsed / 100))
  const filled = ratio > 0 ? Math.max(BAR_HEIGHT, Math.round(LIMIT_WIDTH * ratio)) : 0
  const r = BAR_HEIGHT / 2
  // 縦線（幅 2px）が画像の左右からはみ出さない位置に収める
  const tickX = elapsed === null ? null : Math.min(LIMIT_WIDTH - 2, Math.max(0, Math.round(LIMIT_WIDTH * elapsed) - 1))

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LIMIT_WIDTH}" height="${LIMIT_HEIGHT}" viewBox="0 0 ${LIMIT_WIDTH} ${LIMIT_HEIGHT}">` +
    `<rect y="${LIMIT_PAD}" width="${LIMIT_WIDTH}" height="${BAR_HEIGHT}" rx="${r}" fill="${BAR_TRACK}"/>` +
    `<rect y="${LIMIT_PAD}" width="${filled}" height="${BAR_HEIGHT}" rx="${r}" fill="${color}"/>` +
    (tickX === null ? '' : `<rect x="${tickX}" width="2" height="${LIMIT_HEIGHT}" rx="1" fill="${LIMIT_TICK}"/>`) +
    `</svg>`
  )
}

// 利用枠バーの読み上げ用の説明
const limitAlt = (limit: SessionRateLimit, elapsed: number | null): string => {
  const head = `${limitLabel(limit)} の使用率 ${Math.round(limit.percentUsed)}%`

  return elapsed === null ? head : `${head}（期間の ${Math.round(elapsed * 100)}% が経過）`
}

// 利用枠の使用率がこの % 以上なら色を変えて知らせる
const LIMIT_WARN_PERCENT = 80

// 利用枠の種類ごとの短い呼び名。ここに無い種類は、届いた名前のまま出す
const LIMIT_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
}

// リセットまでの残りを「2h31m」「3d5h」の形にする。時刻が無い・読めない・過ぎているなら null
const untilReset = (resetsAt: string | undefined, now: number): string | null => {
  if (resetsAt === undefined) {
    return null
  }

  const leftMs = Date.parse(resetsAt) - now

  if (!Number.isFinite(leftMs) || leftMs <= 0) {
    return null
  }

  const minutes = Math.floor(leftMs / 60_000)
  const hours = Math.floor(minutes / 60)

  // 24 時間以上は「日と時間」、それ未満は「時間と分」
  return hours >= 24 ? `${Math.floor(hours / 24)}d${hours % 24}h` : `${hours}h${minutes % 60}m`
}

// 利用枠の見出し（「5h」「7d」。知らない種類は届いた名前のまま）
const limitLabel = (limit: SessionRateLimit): string => LIMIT_LABELS[limit.kind] ?? limit.kind

// 今の利用枠の一覧を取る。取れなければ空（帯の左側だけ出す）
const rateLimits = async ($: EngineInterface): Promise<readonly SessionRateLimit[]> => {
  try {
    return (await $.session.usage()).rateLimits ?? []
  } catch {
    return []
  }
}

// 今の時刻を「最後のやりとり」として記録する。
// 記録に失敗してもツール実行や会話を止めないよう、失敗は握りつぶす
const stamp = async ($: EngineInterface): Promise<void> => {
  try {
    const now = await $.clock.now()
    await update($, lastAt, () => now)
  } catch {
    // 表示が古くなるだけなので何もしない
  }
}

export const register: Register = on => {
  // セッション開始時（リロード時も再実行される）に、定期的な再描画を仕掛ける
  on('session.start', ($, e, next) => {
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  // ツール呼び出し = 直前に Claude の応答が届いた合図。
  // サブエージェントの呼び出し（agentId あり）は別のキャッシュなので数えない
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await stamp($)
    }

    return next(e)
  })

  // ターン終了 = 最後の応答が届いた合図
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await stamp($)
    }

    return next(e)
  })

  // 入力欄の上の帯に残り時間を描く
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const at = await read($, lastAt)

    // CLI（ターミナル）はステータスラインで見られるので出さない。
    // アンケート表示中と、まだ一度もやりとりしていない間も何も出さない
    if (e.surface === 'terminal' || e.props.hasSurvey || at === null) {
      return next(e)
    }

    const { Box, Svg, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const elapsedMs = now - at
    const leftMinutes = Math.ceil(TTL_MINUTES - elapsedMs / 60_000)
    const isWarning = leftMinutes <= WARN_MINUTES
    const label = `cache 残り ${leftMinutes}分`

    // 左側: キャッシュの残り時間（切れたら文字だけ）。
    // 幅が足りない時、文字だけ縮んで縦に折れたりバーが隣と重なったりしないよう、
    // 塊ごと縮めない（flexShrink 0）。入りきらなければ帯の側で次の行へ送る
    const cache =
      leftMinutes <= 0 ? (
        // 切れた時の長い文は、狭ければ普通に折り返してよい
        <Box key="cache" flexShrink={1} minWidth={0}>
          <Text color="error">cache 切れ（次の送信は会話全体を読み直し）</Text>
        </Box>
      ) : (
        <Box key="cache" flexDirection="row" alignItems="center" gap="sm" flexShrink={0}>
          {isWarning ? <Text color="warning">{label}</Text> : <Text dimColor>{label}</Text>}
          <Svg
            source={barSvg(leftMinutes / TTL_MINUTES, isWarning ? BAR_WARN : BAR_OK, isWarning)}
            alt={`残り時間のバー（${TTL_MINUTES}分中 ${leftMinutes}分）`}
            width={BAR_WIDTH}
            height={BAR_HEIGHT}
          />
        </Box>
      )

    // 右側: 利用枠の使用率。まだ値が無ければ出さない
    const limits = await rateLimits($)

    // 帯全体は折り返し可（flexWrap）。広ければ1行で左右に分かれ、
    // 狭ければ「cache」「利用枠」の順に塊ごと下の行へ回る
    return (
      <Box
        key="band"
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        columnGap="md"
        rowGap="xs"
        width="100%"
      >
        {cache}
        {limits.length > 0 && (
          // 利用枠の並び。さらに狭ければ 5h と 7d も別の行に分かれる
          <Box key="limits" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs" flexShrink={1} minWidth={0}>
            {limits.map(limit => {
              const isOver = limit.percentUsed >= LIMIT_WARN_PERCENT
              const elapsed = elapsedRatio(limit, now)
              const left = untilReset(limit.resetsAt, now)
              const percent = ` ${Math.round(limit.percentUsed)}%`

              // 並びは「太字の見出し＋使用率 → バー → リセットまでの残り」
              return (
                // 1つの枠（見出し・バー・残り）は縮めず、ひとかたまりのまま動かす
                <Box key={`limit-${limit.kind}`} flexDirection="row" alignItems="center" gap="sm" flexShrink={0}>
                  {isOver ? (
                    <Text color="warning">
                      <Text weight="semibold">{limitLabel(limit)}</Text>
                      {percent}
                    </Text>
                  ) : (
                    <Text>
                      <Text weight="semibold">{limitLabel(limit)}</Text>
                      <Text dimColor>{percent}</Text>
                    </Text>
                  )}
                  <Svg
                    source={limitBarSvg(limit.percentUsed, isOver ? BAR_WARN : LIMIT_OK, elapsed)}
                    alt={limitAlt(limit, elapsed)}
                    width={LIMIT_WIDTH}
                    height={LIMIT_HEIGHT}
                  />
                  {left !== null && <Text dimColor>{left}</Text>}
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )
  })
}
