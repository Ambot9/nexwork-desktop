# Nexwork Desktop - Project Summary

## Current product shape

Nexwork Desktop is no longer just an early Electron dashboard. It is now a workspace-centered desktop tool for multi-repository feature execution with:

- per-account GitHub / GitLab authentication
- per-account workspace restoration
- feature creation and feature lifecycle management
- workspace health and repo status visibility
- an internal extension system
- a built-in Feature Memory integration that talks to MemStack

## What was added recently

### Multi-account Git behavior

- GitHub and GitLab accounts can be saved and switched
- feature visibility is scoped by account ownership
- workspaces are stored per account
- self-hosted GitLab support is included

### Extension system

- plugin host, registry, manifest types, and lifecycle hooks now live under `electron/main/plugins`
- extensions can be enabled, configured, and invoked through IPC
- renderer-facing extension descriptors are exposed through preload
- the Settings page now uses an extension-library style UX

### Feature Memory flow

- the first built-in extension is Feature Memory
- it reuses the active Nexwork Git account to list repositories
- users pick a single storage repository for structured markdown
- feature creation can collect requirement items after project selection
- dashboard users can ask Feature Memory support-style questions
- feature lifecycle sync events are sent to MemStack

### UI refinement

- tighter sidebar and account footer
- clearer settings hierarchy
- improved feature details layout and hierarchy
- side-by-side workspace and worktree cards
- cleaner worktree and workspace rows
- collapsible integrated terminal
- better empty states for changes and commit timeline

## Main implementation areas

```text
electron/main/ipc-handlers.ts
electron/main/plugins/
electron/preload/index.ts
src/App.tsx
src/components/CreateFeatureModal.tsx
src/components/settings/PluginSettings.tsx
src/pages/FeatureDetails.tsx
src/components/ChangesViewer.tsx
src/components/CommitTimeline.tsx
```

## Runtime model

### Nexwork owns

- feature workflow
- git account reuse
- workspace and feature UI
- worktree and branch operations
- extension invocation

### MemStack owns

- feature-memory storage
- structured markdown generation
- requirement and implementation history
- topic wiki documents
- ask / retrieval backend

## Release state

- current desktop version: `1.1.0-beta.1`
- website download points to the latest GitHub release, not the latest branch commit
- publishing a new desktop release is what updates the website download target

## Next practical focus

1. validate full production sync between Nexwork and deployed MemStack
2. harden remote GitHub / GitLab write behavior for Feature Memory storage
3. continue UI polish where needed, but keep the main focus on reliability and release flow
