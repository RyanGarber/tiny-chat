# Tiny Chat

A lightweight chat app with all the features you want and more.
Seamlessly supporting everything from Claude and GPT to Grok and DeepSeek in one unified interface.
Improving on the chat experience with intuitive features like in-place editing, conversation branching, and transparent reasoning and tool calls.

## Features

#### Stay connected across devices
Chat on the web, or install on your desktop or mobile device. Conversations sync in real time through any platform you choose.

#### Never start from scratch again
Switch between models and providers at any point without losing a thing.
All models share the same chats, memory, and more.

#### Get help with your projects
Attach any GitHub repository to your chat. Models get smart overviews and powerful tools to fully explore and truly understand what you're working on.

#### Stay organized and up to date
Schedule anything. "Remind me to buy milk tomorrow at 5." "Give me a summary of the latest news each Tuesday and Thursday." All you have to do is ask.

#### Do everything in one place
Tiny Chat supports all modalities. Attach images, videos, PDFs, and more to your chats. Generate images, videos, and audio. All without switching chats.

## Installation

Builds are currently available for Windows, macOS, Linux, iOS, and Android. Download the [latest release](https://github.com/ryangarber/tiny-chat/releases) from the releases page.

Notes:
- On macOS, you may need to remove the quarantine attribute before you can open the app: `sudo xattr -d com.apple.quarantine /Applications/Tiny\ Chat.app`.
- On iOS, without a paid developer account, you may need to reinstall the app every 7 days. For a better experience, sideload the app using a tool like [SideStore](https://sidestore.io).

## Building

### Windows, macOS, and Linux

Test the app by running `pnpm run dev:tauri`.\
Build the app by running `pnpm run build:tauri`.

### iOS, Android

Test the app by running `pnpm run dev:tauri:[ios/android]`.\
Build the app by running `pnpm run build:tauri:[ios/android]`.
