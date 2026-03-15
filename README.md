<p align="center">
  <img src="build/icon.png" width="120" alt="Echo icon" />
</p>

# Echo

AI-powered voice transcription for macOS — open source alternative to [Wispr Flow](https://wisprflow.ai).

## Features

- Push-to-talk transcription via **Fn** key or **Right Option**
- **Groq** and **OpenRouter** API support
- Tray-based — no dock icon
- Auto-pastes transcribed text into the active app
- Multiple profiles with per-profile system prompts
- **Developer Mode** — optimises transcription for code: filenames, paths, and symbols (`_`, `.`, `/`) are output as code notation instead of spoken words

## Requirements

- macOS 10.15 (Catalina) or later
- Node.js / npm (for development only)
- A [Groq](https://console.groq.com) or [OpenRouter](https://openrouter.ai) API key

## Installation (packaged app)

1. Download the `.dmg` from the [releases page](../../releases) and drag **Echo.app** to `/Applications`.

2. **Remove macOS quarantine** — macOS marks downloaded apps as quarantined, which prevents Echo from appearing in **System Settings → Privacy & Security → Accessibility**. Fix this by running:

   ```bash
   xattr -cr /Applications/Echo.app
   ```

3. Open Echo from `/Applications`.

4. Follow the setup wizard to enter your API key and grant the required permissions.

> **Why is this needed?** macOS applies a quarantine extended attribute (`com.apple.quarantine`) to apps downloaded from the internet. This attribute causes the OS to block the app from registering in the Accessibility privacy list, so you can never grant it the permission it needs. Stripping the attribute with `xattr -cr` is the standard workaround for unsigned / self-signed apps.

## Development setup

```bash
npm install
npm start
```

For hot-reload-style logging during development:

```bash
npm run dev
```

## Building

```bash
npm run build        # Universal binary (arm64 + x64)
npm run build:arm64  # Apple Silicon only
npm run build:x64    # Intel only
```

Output is written to the `dist/` directory.

## Permissions

Echo requires two macOS permissions:

| Permission | Why |
|---|---|
| **Microphone** | Records your voice for transcription |
| **Accessibility** | Detects the PTT key and pastes transcribed text into the active app |

If **Echo does not appear** in System Settings → Privacy & Security → Accessibility after launching, run the quarantine fix:

```bash
xattr -cr /Applications/Echo.app
```

Then re-open Echo and try granting Accessibility access again.

## Configuration

Open **Settings** via the tray icon (menu bar). You can configure:

- API provider and key (Groq or OpenRouter)
- Transcription model
- Push-to-talk hotkey (Fn or Right Option)
- Profiles — each profile can have its own system prompt for post-processing transcriptions
- **Developer Mode** — toggle in Settings → Developer Mode
  - **ON**: Whisper is primed with code patterns; spoken symbols become code notation (`process.env`, `./utils`, `snake_case`)
  - **OFF**: symbols are transcribed as spoken words (`"dot env"`, `"slash utils"`, `"snake underscore case"`)

## License

MIT
