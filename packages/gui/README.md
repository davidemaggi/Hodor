# @hodor/gui

Desktop application for Hodor built with Electron and React.

## Overview

Modern, cross-platform GUI for managing Kubernetes port-forwards with a beautiful interface.

## Features

- 🎨 Light and Dark themes (Snow & Night)
- 🌍 Multi-language support (English, Italian)
- 🖱️ Drag-and-drop template reordering
- 🔐 Secure credential storage
- 📊 Real-time port-forward monitoring
- 🔍 Search and filter templates
- 📤 Import/Export templates
- 📋 Copy secrets and configmaps

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Package application
pnpm build:electron
```

## Project Structure

```
src/
├── main/           # Electron main process
├── preload/        # Preload scripts
└── renderer/       # React application
    ├── components/ # Reusable components
    ├── pages/      # Page components
    ├── hooks/      # Custom hooks
    ├── contexts/   # React contexts
    └── styles/     # Global styles
```

## Building

The app can be built for:
- **macOS:** .dmg, .zip
- **Windows:** .exe installer, .zip
- **Linux:** AppImage, .deb, .rpm, .tar.gz

## License

Apache 2.0
