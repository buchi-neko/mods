// cache-usage-bar が $.state に置く値の型の約束

// メインの会話で最後に Claude とやりとりした時刻（ミリ秒）。まだ無ければ null
export type LastAt = number | null

declare module 'claude-code' {
  interface PluginState {
    'cache-usage-bar': { lastAt: LastAt }
  }
}
