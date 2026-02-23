# Tiny Chat

LLMs without the bloat.

## Features

- Chat with LLMs
    - **Gemini** via Google AI Studio
    - **GPT**, **Claude**, **DeepSeek**, and **more** via Microsoft Foundry
- Fork chats at any point
- Edit messages in place
- Switch models at any time
- Sync across devices

## Install

_Coming soon_

## Build

### Desktop

Develop:

```bash
npm run dev:tauri
```

Or build:

```bash
npm run build:tauri
```

### Mobile

#### Android

Generate the project:

```bash
npx tauri android init
```

Then develop:

```bash
npm run dev:tauri:android
```

Or build:

```bash
npx tauri android build
```

#### iOS

Generate the project:

```bash
npx tauri ios init
```

Then develop:

```bash
npm run dev:tauri:ios
```

Or build:

```bash
npx tauri ios build
```

Depending on shell configuration, you may need to export PATH in the build phase:

```bash
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
```
