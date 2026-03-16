# Nexwork Plugin System Guide

## Goal

Add a small internal plugin system to Nexwork so optional integrations like Memstack can hook into the app without bloating the core workflow.

This guide is written for the current codebase:

- Electron main process owns IPC and OS integrations
- React renderer owns the UI flow
- `window.nexworkAPI` is the safe boundary between them

## What To Build First

Build a private plugin system, not a public marketplace.

Start with:

1. Plugin registry
2. Plugin settings model
3. Lifecycle event bus
4. UI extension points
5. Memstack as the first plugin

Do not start with:

- third-party installable packages
- dynamic remote code loading
- arbitrary plugin execution from user files

Keep the first version built-in and controlled by your app.

## Recommended Architecture

Use three layers.

### 1. Core

Core Nexwork stays responsible for:

- workspaces
- features
- projects
- worktrees
- git operations
- statuses

### 2. Plugin Host

The plugin host should:

- register available plugins
- expose plugin metadata
- know whether a plugin is enabled
- dispatch lifecycle events
- collect UI contributions

### 3. Plugins

Plugins should:

- declare metadata
- declare what hooks they use
- optionally expose settings UI metadata
- optionally handle lifecycle events

## Suggested Folder Structure

Add a new area under `src/` and `electron/`.

```text
src/plugins/
  types.ts
  registry.ts
  hooks.ts
  builtins/
    memstack.ts

electron/main/plugins/
  registry.ts
  types.ts
  host.ts
  builtins/
    memstack.ts
```

You can keep renderer and main plugin registration separate at first. That is simpler than trying to share one runtime object across both processes.

## Step 1: Define Plugin Types

Create a shared mental model before writing logic.

Renderer-side plugin metadata should include:

- `id`
- `name`
- `description`
- `enabledByDefault`
- `settingsSection`
- `createFeatureStep`
- `featureDetailPanel`

Main-side plugin capabilities should include:

- `id`
- `onFeatureCreated`
- `onFeatureCompleted`
- `onProjectStatusUpdated`
- `onFeatureDeleted`

Example shape:

```ts
export interface PluginManifest {
  id: string
  name: string
  description: string
  enabledByDefault?: boolean
}

export interface MainPlugin extends PluginManifest {
  onFeatureCreated?: (payload: FeatureCreatedEvent) => Promise<void>
  onFeatureCompleted?: (payload: FeatureCompletedEvent) => Promise<void>
  onProjectStatusUpdated?: (payload: ProjectStatusUpdatedEvent) => Promise<void>
}
```

Keep v1 small. You can extend later.

## Step 2: Add Plugin Settings Storage

Store plugin enable/disable flags in the existing settings storage.

Suggested shape inside `storage.ts` settings:

```ts
plugins?: Record<string, {
  enabled: boolean
  config?: Record<string, any>
}>
```

Start with only:

- enabled
- plugin-specific config blob

That is enough for Memstack.

## Step 3: Add Main Process Plugin Registry

Create a registry in Electron main that returns all built-in plugins.

Responsibilities:

- register built-in plugins
- filter to enabled plugins
- dispatch lifecycle events safely
- catch plugin failures so core app flow does not break

Important rule:

Plugin failures must never block Nexwork core unless you explicitly mark a plugin as required.

For Memstack, default behavior should be:

- if plugin fails, show warning
- continue normal feature flow

## Step 4: Add Lifecycle Event Dispatching

Use the current IPC handlers as the integration points.

Best first dispatch points in `electron/main/ipc-handlers.ts`:

- after `features:create` succeeds
- after `features:complete` succeeds
- after `projects:updateStatus` succeeds
- after `features:delete` succeeds

Suggested events:

- `feature.created`
- `feature.completed`
- `project.status.updated`
- `feature.deleted`

Do not add too many events at first.

## Step 5: Add Renderer Plugin Registry

In the renderer, create a lightweight registry for UI contributions.

Use it to power:

- plugin settings page/cards
- extra feature creation step(s)
- extra panels on feature details

The renderer registry should not do network or persistence logic directly. It should ask the main process through IPC if a plugin is enabled or configured.

## Step 6: Add Plugin IPC Namespace

Add a namespaced API to preload, for example:

```ts
plugins: {
  getAll: () => ipcRenderer.invoke('plugins:getAll'),
  getState: () => ipcRenderer.invoke('plugins:getState'),
  setEnabled: (pluginId: string, enabled: boolean) => ipcRenderer.invoke('plugins:setEnabled', pluginId, enabled),
  runAction: (pluginId: string, action: string, payload: any) =>
    ipcRenderer.invoke('plugins:runAction', pluginId, action, payload),
}
```

Keep the API generic enough for multiple plugins.

## Step 7: Extend Feature Creation With Plugin Steps

Your current feature wizard is in `src/components/CreateFeatureModal.tsx`.

Add a small extension point after project selection.

Recommended renderer flow:

1. Load enabled plugins
2. Ask each plugin if it contributes a create-feature step
3. Render those steps after project selection and before final review

For Memstack, this step should allow:

- toggle: `Track in Memstack`
- paste requirement text
- optional tags/customer/ticket

If Memstack is disabled, the step should not appear.

## Step 8: Pass Plugin Payload Through Feature Creation

When feature creation is submitted, include a `pluginData` object in the payload.

Example:

```ts
{
  name,
  projects,
  selectedBranches,
  template,
  expiresAt,
  pluginData: {
    memstack: {
      enabled: true,
      requirement: "...",
      customer: "Coloris",
      tags: ["promotion", "checkout"]
    }
  }
}
```

Then in main:

- core feature creation still runs normally
- after success, dispatch the plugin event with both feature data and plugin data

## Step 9: Add A Plugins Page In Settings

In `src/pages/Settings.tsx`, add a plugin/integrations section.

Keep it simple:

- plugin name
- description
- enabled toggle
- status badge
- configure button if needed

For Memstack the user should be able to:

- enable/disable plugin
- set server URL or connection details
- test connection

## Step 10: Add Feature Details Plugin Panels

Extend `src/pages/FeatureDetails.tsx` with optional plugin panels.

Best v1 UI:

- a `Memstack` card or tab
- show summary status
- show last sync
- show “Open Memory”
- show “Sync Now”

Do not overload the main feature screen with plugin-first UI.

## Step 11: Keep Plugin Boundaries Strict

Nexwork should not store Memstack documents directly.

Nexwork should store only lightweight references like:

```ts
pluginRefs?: {
  memstack?: {
    featureId: string
    tracked: boolean
    lastSyncAt?: string
  }
}
```

Memstack owns:

- requirement markdown
- implementation notes
- summaries
- search index

That separation keeps the core app maintainable.

## Step 12: Memstack Plugin Responsibilities

The Memstack plugin should do only these things in Nexwork:

- collect optional requirement input
- send feature lifecycle events to Memstack
- display memory status and quick links
- optionally trigger sync/summary actions

It should not replace Nexwork’s feature system.

## Suggested Initial Task List

Implement in this order:

1. Add plugin settings storage in `electron/main/storage.ts`
2. Add plugin IPC endpoints in `electron/main/ipc-handlers.ts`
3. Add preload bridge methods in `electron/preload/index.ts`
4. Add main plugin host and registry
5. Add renderer plugin registry
6. Add Plugins section in settings UI
7. Add create-feature extension point in `CreateFeatureModal.tsx`
8. Add plugin payload passthrough in `features:create`
9. Add plugin lifecycle dispatch after feature create/complete/update
10. Add feature details plugin panel area

## File-by-File Starting Points

Use these files first:

- `electron/main/storage.ts`
- `electron/main/ipc-handlers.ts`
- `electron/preload/index.ts`
- `src/components/CreateFeatureModal.tsx`
- `src/pages/Settings.tsx`
- `src/pages/FeatureDetails.tsx`

Then add the new plugin folders.

## Good v1 Definition Of Done

You are done with plugin-system v1 when:

- Nexwork can list built-in plugins
- users can enable/disable a plugin
- Memstack step appears only when enabled
- feature creation can send plugin data
- plugin lifecycle handlers run after core success
- plugin failure does not break feature creation

## What To Learn While Building

As you implement this, pay attention to:

- process boundaries in Electron
- stable extension interfaces
- defensive error handling for optional integrations
- avoiding plugin-specific logic leaking into core code

That discipline matters more than fancy abstractions in v1.
