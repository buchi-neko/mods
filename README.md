# buchi-mods

Claude Code（デスクトップアプリ）用の mod 置き場です。
Mods for the Claude Code desktop app.

## cache-usage-bar

入力欄の上に、次の2つをバーで表示します。

- **cache 残り**: プロンプトキャッシュが切れるまでの残り時間（60分で数える。残り10分を切ると黄色で点滅）
- **5h / 7d**: 利用枠の使用率と、リセットまでの残り時間。灰色の縦線は「期間のうち過ぎた割合」で、色の部分が縦線より左なら余裕あり

ウィンドウが狭いときは、塊ごと下の行へ回って重ならないように表示します。
ターミナル（CLI）では表示しません（ステータスラインで同じ情報を見られるため）。

Shows the prompt-cache time left and your 5-hour / 7-day usage limits as bars above the prompt box (desktop app only; labels are in Japanese).

## インストール / Install

ターミナルで動いている Claude Code のプロンプトに入力:

```
/plugin install cache-usage-bar --marketplace buchi-neko/mods
```

`Add marketplace?` には `y`、続く範囲（scope）の選択は Enter で user を選びます。

シェルから:

```bash
claude plugin install cache-usage-bar --marketplace buchi-neko/mods
```

デスクトップアプリでは `/plugin` が使えないので、プロンプト欄の横の **+** → **Plugins** → **Add marketplace** に `buchi-neko/mods` を入れ、**Add plugin** から追加します。

## ライセンス / License

MIT
