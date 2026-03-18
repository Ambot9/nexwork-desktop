# Nexwork Desktop

Nexwork Desktop is an Electron app for managing multi-repository feature work across a shared workspace. It combines Git branch and worktree operations, feature lifecycle tracking, workspace health checks, and optional knowledge integrations such as Feature Memory.

## What it does

- manages features across multiple repositories in one workspace
- creates and tracks feature branches and worktrees
- shows live progress, changes, commits, and repo status
- supports GitHub, GitLab, and self-hosted GitLab accounts
- scopes workspaces and feature visibility per Git account
- exposes an extension system for optional workflow capabilities

## Recent implementation highlights

- built-in extension host in `electron/main/plugins`
- first shipped extension: **Feature Memory**
- Feature Memory setup reuses the active Nexwork Git account to choose a storage repo
- feature creation can capture requirement items after project selection
- dashboard includes `Ask Feature Memory` for grounded support-style questions
- feature lifecycle events now sync to MemStack on:
  - `feature.created`
  - `feature.completed`
  - `project.status.updated`
- refined settings, sidebar, feature details, worktree rows, and integrated terminal layout

## Feature Memory integration

Nexwork does not embed MemStack. It connects to an external MemStack service.

When Feature Memory is enabled and ready:

- Nexwork sends requirement context to MemStack
- Nexwork sends selected project relationships
- Nexwork syncs lifecycle updates to MemStack
- MemStack stores structured markdown in the selected GitHub or GitLab repository
- Nexwork can ask MemStack questions using feature and project context

## Core stack

- Electron 28
- React 18
- TypeScript 5
- Vite 5
- Ant Design 5
- better-sqlite3
- node-pty

## Important areas

- `electron/main/ipc-handlers.ts`
  main backend IPC surface
- `electron/main/plugins/`
  extension host, registry, plugin types, built-in Feature Memory plugin
- `electron/preload/index.ts`
  secure renderer bridge
- `src/App.tsx`
  app shell, sidebar, dashboard, ask modal
- `src/components/CreateFeatureModal.tsx`
  feature creation flow with extension step injection
- `src/pages/FeatureDetails.tsx`
  feature operations, changes, timeline, terminal
- `src/components/settings/PluginSettings.tsx`
  extension library and Feature Memory setup

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run lint
npm run build:mac
```

## Distribution

Desktop builds are generated into `release/<version>/`.

Example artifacts:

- `Nexwork_<version>_macOS.dmg`
- `Nexwork_<version>_macOS.zip`

The website download section reads from the latest GitHub release, so a new desktop version must be published as a GitHub release before the website points to it.

## Related repos

- [MemStack](https://github.com/Ambot9/MemStack)
  external feature memory backend
- `../multi-repo-orchestrator`
  local Git/worktree orchestration library used by the desktop app
