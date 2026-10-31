# LinuxSim — Modern Developer IDE & Terminal Workspace Redesign

Transform LinuxSim into a cohesive, high-craft developer workspace inspired by Warp and Linear, featuring a unified workspace header, structured terminal command blocks, full theme propagation across every docked panel and modal, interactive telemetry visualizations, and a refined typography system.

## User Review & Critical Decisions

> [!IMPORTANT]
> Review the confirmed architectural and design choices below before implementation begins.

- **Confirmed Visual Aesthetic**: **Sleek Developer IDE (Warp & Linear style)** — Crisp 1px surface hairlines, subtle surface luminance contrast, zero visual clutter, and responsive micro-interactions.
- **Confirmed Workspace Structure**: **Unified Workspace Header with Integrated Docked Side Panels** — Eliminating redundant floating dock buttons in favor of a streamlined top workspace bar and integrated panel switchers.
- **Confirmed Priority Upgrades**:
  1. **Modern Prompt & Command Blocks**: Warp-inspired interactive command blocks, copy-output actions, and clean git/session context indicators.
  2. **Unified Theme Propagation**: Dynamic CSS variables driven by the active theme (`Default Slate`, `Tokyo Night`, `Catppuccin Mocha`, `Dracula`, `Matrix Hacker`) applied across all sidebars, headers, and modals—not just the terminal canvas.
  3. **Upgraded Telemetry & Topology Visuals**: Real-time historical sparkline charts for CPU/Memory in the System Monitor and connected visual node architecture in the Network Topology map.
  4. **Refined Dual-Font Hierarchy**: `Plus Jakarta Sans` for crisp UI navigation, headers, and cards paired with `JetBrains Mono` (`tabular-nums`) for terminal I/O, metrics, and system identifiers.

---

## 1. Overview & Core Concept

- **What It Does**: Elevates the interactive Linux desktop and terminal simulator from a collection of disparate dark panels into a unified, production-grade cloud-native IDE and learning environment.
- **Target Audience / Persona**: Systems engineers, DevOps practitioners, and students practicing Linux administration, Docker, Kubernetes, and incident troubleshooting.
- **Key Value**: Enhances scannability, reduces cognitive load during multi-pane debugging and mission workflows, and delivers a tactile, modern terminal experience.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Unified Workspace Navigation**: Users switch seamlessly between the left Curriculum Drawer (`Missions` + `Lab Builder`), the central multi-tab/split-pane `Terminal Workspace`, and the right Context Inspector (`File Explorer`, `System Monitor`, `Network Topology`) directly from the unified workspace header and keyboard shortcuts (`Ctrl+K`).
2. **Warp-Style Terminal Interaction**: Commands and outputs are visually grouped with subtle block hover states, one-click output copy, clear exit/error visual indicators, and an elevated bottom or inline command input bar with context chips (`user@host`, active directory, git branch, root privilege state).
3. **Live Infrastructure Inspection**: Opening the System Monitor displays live historical CPU and Memory area sparklines alongside single-click daemon and container lifecycle controls. Opening the Network Topology displays structured visual tier cards connected by vertical data-flow pathways with an integrated bottom Node Inspector.

### Visual Identity & Theme
- **Aesthetic Direction**: Utilitarian precision inspired by Linear and Warp—single-elevation flat surfaces, crisp `1px` borders, subtle top-edge specular highlights, and zero decorative pill clutter.
- **Color Palette & Dynamic Theme Tokens**:
  - Every theme (`Slate`, `Tokyo Night`, `Catppuccin`, `Dracula`, `Matrix`) exposes semantic CSS custom properties (`--theme-bg`, `--theme-surface`, `--theme-elevated`, `--theme-border`, `--theme-text`, `--theme-muted`, `--theme-accent`, `--theme-user`, `--theme-dir`) on the root workspace container so all panels, modals, and toolbars adapt cohesively.
  - Semantic status colors remain consistent and accessible: Nominal (`#10b981`), Warning (`#f59e0b`), Critical (`#f43f5e`).
- **Typography & Hierarchy**:
  - **UI & Chrome**: `Plus Jakarta Sans` (weights 400, 500, 600, 700) for clean, high-density legibility at `12px`–`15px`.
  - **Terminal & Telemetry**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for all terminal buffers, PIDs, port mappings, file sizes, and live counters.
- **Component Styling & Layout**:
  - **Zero-Pill Metadata Discipline**: Static metadata (file permissions, timestamps, mission difficulty, port numbers, categories) rendered as clean unboxed typographic text with subtle `·` separators rather than noisy bordered pills.
  - **Elimination of Duplicate Controls**: Consolidate the redundant floating bottom-right buttons into a clean segmented workspace switcher in the top header and a subtle status footer bar.

### Interactive Feedback & Motion
- **Latency Budget**: All tab switches, drawer toggles, and command palette interactions settle within `150ms` using `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Toast & Status Feedback**: Replace bouncing cartoon alerts with a sleek, Linear-style slide-down notification toast in the top-center viewport with semantic icon indicators.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified CSS Variable Theme Engine vs. Hardcoded Component Hex Colors**
  - *Chosen Approach*: Inject dynamic CSS custom properties from the active theme object into the root workspace wrapper and reference them across all sidebars, headers, and modals.
  - *Why*: Previously, switching themes only recolored the terminal background while leaving the TopBar, File Explorer, System Monitor, and Modals hardcoded to `#121420`. Propagating CSS variables makes theme switching feel instantaneous and holistic.
  - *Alternatives Considered*: Passing theme props into every child element and styling inline (verbose and harder to maintain across hover states).
- **Decision 2: Consolidated Workspace Header & Status Bar vs. Floating Action Buttons**
  - *Chosen Approach*: Remove the floating bottom-right button cluster that overlapped terminal text, and integrate panel switching (`Missions`, `Explorer`, `Monitor`, `Topology`) into a clean segmented control in the workspace header paired with a compact 24px IDE status bar at the bottom.
  - *Why*: Floating buttons obscured terminal output in split-pane views and duplicated controls already present in the TopBar.
  - *Alternatives Considered*: Auto-hiding floating dock (still causes accidental hover triggers while typing).

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Root Theme & Workspace Provider                        │
│        (Injects --theme-* CSS variables, Keyboard Shortcuts, SFX)            │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
┌─────────────────────┐   ┌─────────────────────────┐   ┌──────────────────────┐
│ Unified Workspace   │   │ Central Terminal Engine │   │ Integrated Modals    │
│ Header & Status Bar │   │ (Tabs & Split Multiplex)│   │ & Spotlight (Ctrl+K) │
├─────────────────────┤   ├─────────────────────────┤   ├──────────────────────┤
│ • Brand & CWD Trail │   │ • Tab Bar + Split Ctrls │   │ • Command Palette    │
│ • Segmented Panel   │   │ • Command Block Render  │   │ • Incident Console   │
│   Switcher          │   │ • Prompt Context Bar    │   │ • Reference Guide    │
│ • Incident & Theme  │   │ • Nano / Vim / Watch    │   │ • Custom Lab Builder │
│   Quick Actions     │   │   Full-Pane Views       │   │                      │
└──────────┬──────────┘   └────────────┬────────────┘   └──────────────────────┘
           │                           │
           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────────┐
│ Left Docked Drawer  │   │ Right Docked Inspector  │
│ (Missions & Labs)   │   │ (Segmented Active View) │
├─────────────────────┤   ├─────────────────────────┤
│ • Progress Header   │   │ • File Explorer + Quick │
│ • Difficulty Filter │   │   Inline File Creator   │
│ • Clean Mission     │   │ • System Monitor + Live │
│   Cards & Hints     │   │   CPU/RAM Sparklines    │
│                     │   │ • Network Topology +    │
│                     │   │   Visual Node Inspector │
└─────────────────────┘   └─────────────────────────┘
```

### Interactive Component & State Mapping
- **Theme State Synchronization**: Selecting a theme in the TopBar or Command Palette (`Ctrl+K`) updates `theme` state, persists to `localStorage`, and immediately updates CSS variables (`--theme-bg`, `--theme-card-bg`, `--theme-tab-bg`, `--theme-border`, `--theme-accent`, `--theme-text`) across the entire DOM tree.
- **Inline File & Folder Creation in File Explorer**: Replaces browser `window.prompt` / `window.confirm` dialogs with clean inline input rows and confirmation states directly inside the File Explorer header and file list, ensuring full compatibility with sandboxed iframe environments.
- **Historical Telemetry Ring Buffer**: System Monitor maintains a rolling 20-point time-series array for CPU and Memory usage, rendering smooth SVG area sparklines alongside live daemon and container controls.
- **Terminal Command Block Copying**: Terminal lines support quick copy-to-clipboard actions and crisp prompt rendering with active directory, user privilege, and git branch status.
