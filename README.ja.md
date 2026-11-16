# buchi-mods

[English](README.md) | **日本語**

Claude Code 用の mod 置き場です。どの mod もこの1つの marketplace からインストールできます。使える場所は mod ごとに書いています。

| mod | できること | 使える場所 |
| --- | --- | --- |
| [cache-usage-bar](#cache-usage-bar) | 入力欄の上に、キャッシュの残り時間と利用枠（5h / 7d）をバーで表示 | デスクトップアプリ |

## cache-usage-bar

入力欄の上に、次の2つをバーで表示します。

- **cache 残り _N_分**：プロンプトキャッシュが切れるまでの残り時間（60分で数えます）。残り10分を切ると黄色で点滅します。切れると次の送信で会話全体を読み直すため、利用枠が多めに減ります。
- **5h / 7d**：利用枠の使用率と、リセットまでの残り時間。灰色の縦線は「期間のうち過ぎた割合」で、色の部分が縦線より左なら、均等なペースより余裕があります。

ウィンドウが狭いときは、重ならないように塊ごと下の行へ回ります。

<img src="docs/images/normal-ja.png" width="820" alt="cache 残り 58分、5h 12%、7d 23%">

残り10分以下（使用率80%以上の利用枠も黄色になります）:

<img src="docs/images/warning-ja.png" width="820" alt="黄色の cache 残り 8分と 5h 86%">

切れたとき:

<img src="docs/images/expired-ja.png" width="820" alt="cache 切れ（次の送信は会話全体を読み直し）">

狭いウィンドウ:

<img src="docs/images/narrow-ja.png" width="420" alt="2行に折り返した帯">

<sub>画像はスクリーンショットではなく、mod と同じ色・バーで描いた再現画像です。</sub>

> **Claude デスクトップアプリ（Code タブ）専用です。** ターミナル（CLI）、VS Code 拡張、モバイルアプリでは表示されません。Claude Code が入力欄の上のこの場所を描くのはデスクトップアプリとターミナルだけで、ターミナルではステータスラインで同じ情報を見られるため、表示しないようにしています。

### インストール

ターミナルで動いている Claude Code のプロンプトに入力します。

```
/plugin install cache-usage-bar --marketplace buchi-neko/mods
```

`Add marketplace?` には `y`、続く範囲（scope）の選択は Enter で user を選びます。

シェルからは次のとおりです。

```bash
claude plugin install cache-usage-bar --marketplace buchi-neko/mods
```

デスクトップアプリでは `/plugin` が使えないので、プロンプト欄の横の **+** → **Plugins** → **Add marketplace** に `buchi-neko/mods` を入れ、**Add plugin** から追加します。

### 設定

| 設定 | 値 | 既定 |
| --- | --- | --- |
| `language` | `en`（English）/ `ja`（日本語） | `en` |

表示は英語が既定です。日本語にしたいときは **Claude にお願いする**のがいちばん簡単です。

> cache-usage-bar の mod の表示を日本語にして

自分で変える場合は、`~/.claude/settings.json` に次を追加して、新しいセッションを開きます。

```json
{
  "pluginConfigs": {
    "cache-usage-bar@buchi-mods": {
      "options": { "language": "ja" }
    }
  }
}
```

または、シェルで次を実行してから新しいセッションを開きます。

```bash
echo '{"language":"ja"}' | claude plugin configure cache-usage-bar@buchi-mods --values-stdin
```

## ライセンス

MIT
