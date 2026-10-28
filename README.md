# 🐧 LinuxSim — Client-Side Linux Desktop & Terminal Simulator

**LinuxSim** is a fully local, browser-based Linux Desktop and Terminal Simulator built for practicing command-line skills, shell scripting concepts, and file-system management in a safe, zero-risk sandbox.

Everything runs **100% client-side** in your web browser with zero external backend dependencies. State is persisted automatically to `localStorage`, with instant two-way synchronization between terminal commands and a visual desktop GUI.

---

## 📸 Key Highlights

- **Authentic Terminal Emulator:** Multi-tab shell with colorized prompts, history navigation, tab completion, signals (`Ctrl+C`, `Ctrl+L`), and ANSI/HTML output coloring.
- **Tree-Based Virtual File System (VFS):** Full directory tree supporting absolute and relative paths, home expansion (`~`), and real Unix permission checking (octal & symbolic).
- **Pipes, Redirection & Chaining:** True UNIX pipeline execution (`|`), output redirection (`>`, `>>`), and command chaining (`&&`, `;`).
- **Real-Time Synchronized File Explorer:** Watch directories and files appear, change, or disappear in real-time as you type commands, with an integrated file preview drawer.
- **In-Terminal Nano Editor:** Interactive text editor overlay (`nano <file>`) featuring line numbers, status indicators, and keyboard shortcuts (`Ctrl+O`, `Ctrl+X`).
- **Interactive Practice Missions:** 15 progressive hands-on challenges across Beginner, Intermediate, and Advanced tiers with automated state validation and badges.
- **Searchable Cheat Sheet:** Built-in modal reference with category filters, flag specifications, and one-click syntax copying.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` (comes bundled with Node.js)

### Installation & Launch

1. Clone or navigate to the project directory:
   ```bash
   cd linux_clone
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173/
   ```

### Production Build
To create an optimized production build:
```bash
npm run build
npm run preview
```

---

## 🖥️ Desktop Interface & Features

### 1. Top Status Bar
- **Current Path Indicator:** Displays active working directory in real-time (`~/Documents`, `/var/log`, etc.).
- **User Identity:** Shows active session user (`user@linux-box`).
- **Live System Clock:** Real-time digital clock formatted for system metrics.
- **Reset File System Button:** One-click confirmation button to wipe `localStorage` and restore the VFS to default state.
- **Cheat Sheet Button:** Launches the command reference modal (`BookOpen` icon).

### 2. Multi-Tab Terminal Emulator
- **Tab Management:** Click the `+` icon to spawn isolated terminal sessions or `X` to close them.
- **Command History:** Use `Arrow Up` and `Arrow Down` to recall previously executed commands.
- **Tab Auto-Completion:** Press `Tab` once to autocomplete matching command names or file/directory paths.
- **Interactive Interrupts:**
  - `Ctrl + C`: Cancel current command line or terminate streaming processes (such as `ping`).
  - `Ctrl + L`: Clear the terminal scrollback buffer.

### 3. Synchronized Visual File Explorer (Right Panel)
- **Two-Way Real-Time Sync:** Running `mkdir demo`, `touch file.txt`, or `rm -rf dir` immediately updates the GUI without a manual page refresh.
- **Folder Navigation:** Click any folder to drill down, or click `..` / breadcrumbs at the top to navigate upwards.
- **File Inspector:** Click on any file to open the inspection drawer showing file permissions, owner/group, size, last modification timestamp, and a scrollable content preview.
- **Panel Toggle:** Minimize or expand the File Explorer at any time using the dock button at the bottom-right.

### 4. Practice Curriculum / Missions Drawer (Left Panel)
- **Curriculum:** 15 progressive tasks divided into **Beginner**, **Intermediate**, and **Advanced** tiers.
- **Automated Validation:** Click **Validate** on any mission to trigger real-time inspection of your VFS structure, file contents, and shell history.
- **Auto-Evaluation:** Missions automatically complete as soon as you run the winning command!
- **Hints:** Click **Hint** on any mission card to expand guidance and tips.
- **Progress Tracking:** Live visual progress bar and completion badges saved to `localStorage`.

### 5. Built-in Nano Editor Overlay
Launch the editor from the terminal by running:
```bash
nano <filename>
```
- **Line numbering & position tracking** (current line and column).
- **Save / Write Out:** Press `Ctrl + O` or `Ctrl + S`.
- **Exit:** Press `Ctrl + X` to close the editor and return to the shell.

---

## 🛠️ Supported Commands Reference

### Navigation & Directory Structure
| Command | Usage | Description |
| :--- | :--- | :--- |
| `pwd` | `pwd` | Print current working directory |
| `ls` | `ls [-a] [-l] [path]` | List files. Supports `-a` (hidden dotfiles) and `-l` (permissions, owner, size, timestamp) |
| `cd` | `cd [dir]` | Change directory. Supports `cd ~`, `cd ..`, `cd -` (previous dir), absolute & relative paths |
| `tree` | `tree [path]` | Render an ASCII directory tree hierarchy |
| `find` | `find <path> -name <glob>` | Recursively search for files matching name patterns (e.g. `find ~ -name "*.txt"`) |

### File Operations
| Command | Usage | Description |
| :--- | :--- | :--- |
| `mkdir` | `mkdir [-p] <dir...>` | Create directories. `-p` creates missing parent directories |
| `touch` | `touch <file...>` | Create new empty files or update timestamps of existing files |
| `rm` | `rm [-r] [-f] <target...>` | Remove files. `-r` or `-rf` required for directories |
| `cp` | `cp [-r] <source> <dest>` | Copy files or directories recursively (`-r`) |
| `mv` | `mv <source> <dest>` | Move or rename files and directories |

### Text Processing & Pipelines
| Command | Usage | Description |
| :--- | :--- | :--- |
| `cat` | `cat [-n] [file...]` | Concatenate and print file contents or pipe stdin. `-n` numbers output lines |
| `echo` | `echo [-n] [-e] [text...]` | Print text to terminal or redirect to file. Supports variable expansion (`$USER`) and `-e` escape codes (`\n`, `\t`) |
| `grep` | `grep [-i] [-v] [-n] [-c] <pattern> [file...]` | Search patterns in files or pipeline stdin with highlighted matches. `-i` ignore case, `-v` invert, `-n` line numbers, `-c` count |
| `head` | `head [-n <count>] [file...]` | Output first $N$ lines of file or stdin (default 10) |
| `tail` | `tail [-n <count>] [file...]` | Output last $N$ lines of file or stdin (default 10) |
| `wc` | `wc [-l] [-w] [-c] [file...]` | Count lines (`-l`), words (`-w`), or bytes (`-c`) |
| `sort` | `sort [-r] [-n] [-u] [file...]` | Sort lines alphabetically or numerically (`-n`). `-r` reverse, `-u` unique |
| `uniq` | `uniq [-c] [-d] [file]` | Filter adjacent duplicate lines. `-c` count occurrences, `-d` only duplicates |
| `nano` | `nano <filename>` | Open interactive in-terminal text editor |

### Permissions & User Privileges
| Command | Usage | Description |
| :--- | :--- | :--- |
| `chmod` | `chmod <mode> <file...>` | Change file permissions using octal (`755`, `644`, `600`) or symbolic syntax (`+x`, `-w`, `u+x`, `go-w`) |
| `chown` | `chown <owner[:group]> <file...>` | Change file owner and group (requires simulated root) |
| `sudo` | `sudo <command>` | Execute a command with elevated root privileges, bypassing permission blocks |
| `whoami` | `whoami` | Print active user name (`user` or `root`) |
| `id` | `id` | Display user UID, GID, and assigned security groups |

### System Metrics & Process Inspection
| Command | Usage | Description |
| :--- | :--- | :--- |
| `neofetch` | `neofetch` | Display ASCII Linux art alongside system metrics, kernel version, and VFS file count |
| `uname` | `uname [-a]` | Print operating system kernel information |
| `hostname`| `hostname` | Display system host identifier (`linux-box`) |
| `date` | `date` | Display formatted system timestamp and timezone |
| `uptime` | `uptime` | Display simulated uptime and load averages |
| `cal` | `cal` | Render current month calendar with today's date highlighted |
| `df` | `df [-h]` | Report file system disk space utilization |
| `du` | `du [-sh] [path]` | Estimate file space usage for target path |
| `free` | `free [-m]` | Display free, used, and cached memory metrics |
| `ps` | `ps [aux]` | Snapshot of active processes |
| `top` / `htop` | `top`, `htop` | Interactive process status and system resource overview |
| `kill` | `kill <pid>` | Signal simulation for terminating mock processes |
| `ping` | `ping <host>` | Stream ICMP packet requests with simulated latencies (cancelable with `Ctrl+C`) |

### Shell Builtins & Utilities
| Command | Usage | Description |
| :--- | :--- | :--- |
| `history` | `history` | List session command history |
| `alias` | `alias [name='cmd']` | View all aliases or assign command shortcuts (e.g. `alias ll='ls -la'`) |
| `unalias` | `unalias <name>` | Remove an assigned command alias |
| `export` | `export [VAR=value]` | Set environment variables accessible across sub-commands |
| `env` | `env` | Print all current environment variables |
| `man` | `man <command>` | Formatted manual page detailing command synopsis, flags, and description |
| `help` | `help` | Quick overview of all registered commands |
| `type` | `type <command>` | Indicate whether a command is a builtin, alias, or executable binary |
| `which` | `which <command>` | Locate the binary path of a command |
| `clear` | `clear` | Clear terminal display (same as `Ctrl+L`) |

---

## 💡 Pipeline & Redirection Examples

Try running these realistic examples directly in the terminal:

```bash
# 1. Pipe log entries to grep, then count occurrences
cat /var/log/syslog | grep ERROR | wc -l

# 2. Extract errors and save them to a file in home
grep ERROR /var/log/syslog > ~/errors.txt

# 3. Append warning events to the error file
grep WARNING /var/log/syslog >> ~/errors.txt

# 4. View sorted unique entries from a file
cat /etc/passwd | sort | uniq

# 5. Create nested directories and verify with tree
mkdir -p ~/projects/web/src/components && tree ~/projects

# 6. Change file permission and verify long listing
chmod 600 ~/Documents/secret.log && ls -l ~/Documents/secret.log
```

---

## 📂 Project Architecture

```
linux_clone/
├── index.html                   # HTML entry point with JetBrains Mono font loading
├── vite.config.ts               # Vite configuration with React & Tailwind CSS plugins
├── package.json                 # Project dependencies and script declarations
└── src/
    ├── types.ts                 # VFS nodes, shell AST, missions, and process interfaces
    ├── index.css                # Global styles, Tailwind imports, scrollbar, and cursor animations
    ├── main.tsx                 # React DOM mount point
    ├── App.tsx                  # Root component loading DesktopLayout
    ├── vfs/                     # Virtual File System Engine
    │   ├── permissions.ts       # Octal & symbolic permission evaluator
    │   ├── pathResolver.ts      # Path normalization, traversal, and glob matcher
    │   ├── initialData.ts       # Pre-seeded Linux directory tree (/home, /etc, /var/log, /bin)
    │   └── fileSystem.ts        # VirtualFileSystem class managing tree and localStorage sync
    ├── shell/                   # Command Execution & Lexing Pipeline
    │   ├── lexer.ts             # Tokenizer handling quotes, escapes, and operators
    │   ├── parser.ts            # Parser for pipes, redirects, flags, and command chaining
    │   ├── environment.ts       # Environment variable manager ($USER, $PWD, $?, etc.)
    │   ├── commandRegistry.ts   # Central extensible command registry
    │   ├── executor.ts          # Multi-stage execution pipeline and auto-completer
    │   └── commands/            # Implementations of 40+ Linux commands
    │       ├── navigation.ts    # pwd, ls, cd, tree, find
    │       ├── fileOps.ts       # mkdir, touch, rm, cp, mv
    │       ├── textProcessing.ts# cat, echo, grep, head, tail, wc, sort, uniq, nano
    │       ├── permissions.ts   # chmod, chown, sudo, whoami, id
    │       ├── system.ts        # neofetch, uname, date, uptime, cal, df, du, free, ps, ping
    │       └── utility.ts       # history, alias, man, help, clear, env, export, type, which
    ├── data/
    │   └── missions.ts          # 15 progressive practice challenges with state validators
    ├── hooks/
    │   ├── useVFS.ts            # Hook providing persistent VFS instance & reset triggers
    │   ├── useShell.ts          # Initializes command registry
    │   └── useTerminal.ts       # Hook managing tabs, lines, history, nano, and execution context
    └── components/              # Desktop GUI components
        ├── DesktopLayout.tsx    # Workspace orchestrator (top bar, terminal, explorer, sidebar)
        ├── TopBar.tsx           # Status bar with path, clock, and reset trigger
        ├── TerminalWindow.tsx   # Interactive terminal emulator with multi-tab support
        ├── NanoEditor.tsx       # In-terminal GNU nano editor overlay
        ├── FileExplorerGUI.tsx  # Synchronized visual file explorer with metadata & preview
        ├── MissionSidebar.tsx   # Hands-on challenge drawer with tier filters & progress bar
        └── CheatSheetModal.tsx  # Searchable quick-reference modal for all commands
```

---

## 📜 License

This project is open-source and free to use for personal practice, education, and Linux command-line learning.
