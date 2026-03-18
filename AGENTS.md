# AGENTS.md - Nexwork Desktop

## Project Overview

Electron desktop app for multi-repository feature management. Manages git worktrees, branches, and feature lifecycles across multiple repos in a workspace.

**Stack**: Electron 28 + React 18 + TypeScript 5.3 + Vite 5 + Ant Design 5
**Storage**: JSON file (settings), better-sqlite3 (features/activity), filesystem (git config)

## Build & Run Commands

```bash
# Development (with HMR)
npm run dev

# Production builds
npm run build:mac          # macOS DMG + ZIP (x64 + arm64)
npm run build:win          # Windows NSIS + portable
npm run build:linux        # Linux AppImage + deb
npm run build:all          # All platforms
npm run build              # tsc + vite build + electron-builder

# Type checking only
npx tsc --noEmit
npm run typecheck

# Linting
npm run lint               # Runs oxlint + eslint
npm run lint:fix           # Auto-fix lint issues

# Preview production renderer
npm run preview

# Rebuild native deps after npm install
npm run postinstall        # electron-builder install-app-deps
```

**Linting**: Uses ESLint with TypeScript support. Run `npm run lint` before committing.

## Architecture

```
electron/
  main/
    index.ts            # App lifecycle, window creation, auto-cleanup service
    ipc-handlers.ts     # All IPC handlers (~2000 lines) - the core backend
    plugins/            # Extension host, registry, built-in Feature Memory plugin
    storage.ts          # StorageService: JSON settings + SQLite singleton
    security.ts         # Input validation, sanitization, rate limiting
    notifications.ts    # Native OS notifications
    tray.ts             # System tray menu
    auth-store.ts       # GitHub/GitLab authentication state
  preload/
    index.ts            # contextBridge exposing nexworkAPI to renderer

src/                    # React renderer process
  App.tsx               # Root component, manual view routing (dashboard/details/settings/git-auth)
  components/
    CreateFeatureModal.tsx   # Multi-step feature creation wizard
    FeatureDetails.tsx       # Main feature view (large file ~107KB)
    IntegratedTerminal.tsx   # xterm.js terminal emulator
    ChangesViewer.tsx        # Git diff viewer
    AITerminal.tsx           # AI-powered terminal
  pages/
    Settings.tsx        # Settings form with JSON settings persistence
    GitAuth.tsx         # GitHub/GitLab authentication UI
    ActivityLog.tsx     # Activity history
    FeatureDetails.tsx  # Feature execution view (workspace, worktrees, changes, commits, terminal)
  services/
    ai-service.ts       # Claude/OpenAI/Ollama integration
  contexts/
    ThemeContext.tsx     # Theme provider (6 themes)
  types/
    index.ts            # Shared TypeScript interfaces
```

## Extension System

Nexwork now includes an internal extension system. The most important built-in extension is **Feature Memory**.

Key behavior:
- extensions are registered in `electron/main/plugins/registry.ts`
- main-process extension lifecycle lives in `electron/main/plugins/host.ts`
- renderer gets extension status and actions through preload IPC
- Settings exposes an extension-library style setup UI via `src/components/settings/PluginSettings.tsx`

## Feature Memory Flow

Nexwork integrates with an external MemStack service.

Important rules for future agents:
- Nexwork is the workflow client, not the knowledge store
- MemStack lives outside this repo and owns structured markdown storage
- Feature Memory should only appear when the extension is enabled and `ready`
- repository selection for MemStack storage reuses the active Nexwork Git account
- feature creation can inject a Feature Memory step after project selection
- dashboard includes `Ask Feature Memory`
- lifecycle events currently sync on:
  - `feature.created`
  - `feature.completed`
  - `project.status.updated`

Important files:
- `electron/main/plugins/builtins/memstack.ts`
- `src/components/CreateFeatureModal.tsx`
- `src/components/settings/PluginSettings.tsx`
- `src/App.tsx`

## IPC Communication

All renderer-to-main communication uses `window.nexworkAPI` (exposed via preload contextBridge).

**Namespaced channels:**
- `features:*` - CRUD for features (getAll, create, update, delete, complete)
- `projects:*` - Project status, worktree management
- `config:*` - Workspace config load/save/setWorkspace
- `stats:*` - Git statistics, feature stats, diffs
- `settings:*` - electron-store get/set/getAll
- `templates:*` - Feature templates CRUD
- `activity:*` - Activity logging
- `terminal:*` - PTY create/write/resize/kill
- `gitAuth:*` - GitHub/GitLab authentication (checkAuth, githubLogin, gitlabLogin, logout)
- `plugins:*` - Extension list, enable/disable, config update, extension actions

**Security model**: Context isolation enabled, nodeIntegration disabled, sandbox true. All IPC inputs validated in `security.ts`.

## Code Style

### TypeScript
- **Strict mode**: OFF (`strict: false` in tsconfig)
- **Target**: ES2020, Module: ESNext, JSX: react-jsx
- **Path aliases**: `@/*` → src/, `@main/*` → electron/main/, `@preload/*` → electron/preload/

### Naming
- **Components/Types**: PascalCase (`CreateFeatureModal`, `FeatureStats`)
- **Functions/variables**: camelCase (`loadFeatures`, `handleFeatureClick`)
- **IPC channels**: namespace:camelCase (`features:getAll`, `config:setWorkspace`)
- **CSS classes**: kebab-case or Ant Design conventions

### Imports
- ESM imports throughout (`import X from 'y'`)
- Exception: `require()` used in main process for `multi-repo-orchestrator` (CommonJS-only lib)
- Group order: node builtins → electron → external packages → local modules

### Error Handling
- Try-catch in all IPC handlers with `console.error` logging
- User-facing errors via `message.error()` (Ant Design)
- Validation before operations (path validation, name sanitization)
- Non-critical failures logged with `console.warn`, don't throw

### UI Patterns
- Ant Design components for all UI (Layout, Form, Table, Modal, Message)
- Inline styles via React style objects (not CSS modules)
- Theme tokens from Ant Design ConfigProvider
- Lucide React for icons

### State Management
- React `useState`/`useEffect` for component state
- React Context for theme (ThemeContext)
- Direct IPC calls for data fetching (no Redux/Zustand in practice)
- 5-second polling interval for auto-refresh of feature details

## Key Patterns

### Feature Lifecycle
1. User creates feature via modal → `features:create` IPC
2. Git branches created per project: `feature/<sanitized-name>`
3. Git worktrees created for each project
4. Status tracked: pending → in_progress → completed
5. Expired features auto-cleaned (hourly check)

### Storage Persistence
- **Settings** saved to JSON file (`nexwork-settings.json`) in `app.getPath('userData')`
- **Workspace path** saved as `lastWorkspace` and `perAccountWorkspaces[accountId]`, restored on startup via `config:load`
- **Features** stored in `.multi-repo-config.json` in workspace root
- **Activity/stats** in SQLite at `~/.config/Nexwork/nexwork-data.db`
- **Extension config** saved inside Nexwork settings storage and surfaced through the plugin host
- **Feature Memory refs** stored on features as lightweight `pluginRefs` / `pluginData`, not as full MemStack documents

### Native Module Handling
- `better-sqlite3` and `node-pty` are native modules requiring rebuild for Electron
- Both marked as `external` in vite rollup config
- electron-builder handles native rebuild during packaging
- `electron-store` marked external in preload rollup config

## External Dependencies (Native)

These require special build handling — mark as external in vite.config.ts:
- `better-sqlite3` - SQLite database
- `node-pty` - Terminal emulation
- `multi-repo-orchestrator` - Git/worktree operations (local package)

## Common Gotchas

1. **Feature names with spaces**: Must be sanitized to dashes for git branch names (`sanitizeFeatureName()` in security.ts)
2. **Native modules**: Must be in rollupOptions.external or build will fail with dynamic require errors
3. **Workspace restoration**: On startup, app loads `lastWorkspace` from electron-store and calls `setWorkspaceOnStartup()`
4. **Version in filenames**: Comes from package.json `version` field — must update before building releases
5. **DMG + ZIP releases**: Build creates both; remember to upload both to GitHub releases
6. **macOS code signing**: Currently skipped (`identity: null`) — not signed/notarized
7. **Large components**: FeatureDetails.tsx is very large; read in sections with offset/limit
8. **Website downloads**: The website reads the latest GitHub release, not the latest branch commit

## Release Process

```bash
# 1. Update version in package.json
# 2. Build
npm run build:mac
# 3. Files appear in release/<version>/
# 4. Commit and push
git add -A && git commit -m "Release vX.Y.Z" && git push
# 5. Create GitHub release with both DMG and ZIP
gh release create vX.Y.Z release/<version>/Nexwork_<version>_macOS.dmg release/<version>/Nexwork_<version>_macOS.zip
# 6. Deploy website
cd ../nexwork-website && npm run build && npx wrangler deploy
```

## File References

| Purpose | File |
|---------|------|
| App entry (main) | `electron/main/index.ts` |
| All IPC handlers | `electron/main/ipc-handlers.ts` |
| Storage service | `electron/main/storage.ts` |
| Security/validation | `electron/main/security.ts` |
| Auth store | `electron/main/auth-store.ts` |
| Preload bridge | `electron/preload/index.ts` |
| React entry | `src/main.tsx` |
| Root component | `src/App.tsx` |
| Auth page | `src/pages/GitAuth.tsx` |
| Type definitions | `src/types/index.ts` |
| Theme system | `src/contexts/ThemeContext.tsx` |
| AI service | `src/services/ai-service.ts` |
| Vite config | `vite.config.ts` |
| Build config | `package.json` (build section) |
