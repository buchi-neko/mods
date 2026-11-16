# buchi-mods

[English](README.md) | **日本語**

Claude Code（デスクトップアプリ）用の mod 置き場です。

## cache-usage-bar

入力欄の上に、次の2つをバーで表示します。

- **cache 残り _N_分**：プロンプトキャッシュが切れるまでの残り時間（60分で数えます）。残り10分を切ると黄色で点滅します。切れると次の送信で会話全体を読み直すため、利用枠が多めに減ります。
- **5h / 7d**：利用枠の使用率と、リセットまでの残り時間。灰色の縦線は「期間のうち過ぎた割合」で、色の部分が縦線より左なら、均等なペースより余裕があります。

ウィンドウが狭いときは、重ならないように塊ごと下の行へ回ります。
ターミナル（CLI）では表示しません（ステータスラインで同じ情報を見られるため）。

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

ターミナルのセッションでは `/config` の画面からも変えられます。

## ライセンス

MIT
