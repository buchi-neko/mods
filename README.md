# buchi-mods

**English** | [日本語](README.ja.md)

Mods for the Claude Code desktop app.

## cache-usage-bar

Shows two things as bars above the prompt box:

- **cache _N_m left** — time until the prompt cache expires (counted as 60 minutes). Turns yellow and pulses when 10 minutes or less are left. Once it expires, your next message re-reads the whole conversation, which uses more of your limits.
- **5h / 7d** — how much of your usage limits you have used, and the time until each resets. The gray tick marks how much of the window has passed: if the colored part is left of the tick, you are using less than an even pace.

When the window is narrow, each group moves to the next row instead of overlapping.

> **Claude desktop app only** (the Code tab). The bar is not shown in the terminal (CLI), the VS Code extension, or the mobile app: Claude Code draws this area above the prompt only in the desktop app and the terminal, and the terminal can show the same information in its status line.

### Install

At the prompt of Claude Code running in a terminal:

```
/plugin install cache-usage-bar --marketplace buchi-neko/mods
```

Answer `y` to `Add marketplace?`, then press Enter to choose the user scope.

From a shell:

```bash
claude plugin install cache-usage-bar --marketplace buchi-neko/mods
```

In the desktop app, where `/plugin` is not available: click **+** next to the prompt box, then **Plugins** → **Add marketplace**, enter `buchi-neko/mods`, and add it from **Add plugin**.

### Settings

| Setting | Values | Default |
| --- | --- | --- |
| `language` | `en` (English) / `ja` (日本語) | `en` |

The easiest way to change it is to **ask Claude**, for example:

> Set the language of the cache-usage-bar mod to Japanese.

To change it yourself, add this to `~/.claude/settings.json` and start a new session:

```json
{
  "pluginConfigs": {
    "cache-usage-bar@buchi-mods": {
      "options": { "language": "ja" }
    }
  }
}
```

Or run this in a shell, then start a new session:

```bash
echo '{"language":"ja"}' | claude plugin configure cache-usage-bar@buchi-mods --values-stdin
```

## License

MIT
