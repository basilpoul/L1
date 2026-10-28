# 🐧 LinuxSim — Client-Side Linux Desktop, Terminal & DevOps Simulator (Phase 3)

**LinuxSim** is a fully local, browser-based Linux Desktop, Terminal, and DevOps Simulator built for learning and practicing Linux commands, shell scripting, Git version control, Docker containers, multi-user system administration, and network security in a safe, zero-risk sandbox.

Everything runs **100% client-side** in your web browser with zero external backend dependencies. State is persisted automatically to `localStorage`, with instant two-way synchronization between terminal commands and a visual desktop GUI.

---

## 📸 Key Highlights & New Phase 3 Capabilities

- **Interactive Modal `vim` Editor:**
  - Classic modal editor triggered via `vim <filename>` or `vi <filename>`.
  - Supports **NORMAL**, **INSERT**, **VISUAL**, and **COMMAND** (`:`, `/`) modes.
  - Authentic bottom status bar with mode indicators (`-- INSERT --`, `-- VISUAL --`), cursor position (`row,col`), line count, `[Modified]` flag, and file completion percentage (`Top`, `Bot`, `X%`).
  - Full Normal mode navigation (`h`, `j`, `k`, `l`, `0`, `$`, `w`, `b`, `gg`, `G`, arrow keys) and editing (`i`, `a`, `I`, `A`, `o`, `O`, `x`, `dd`, `yy`, `p`, `u`, `v`).
  - Command mode operations (`:w`, `:q`, `:wq`, `:x`, `:q!`, `:set nu`, `:set nonu`, `/<pattern>` with `n` / `N` forward/backward match jumping).
- **Local `git` Engine & Branch-Aware Prompt:**
  - Persistent repository metadata in `.git/` (`HEAD`, `commits.json`, `staging.json`, `branches.json`, `config`).
  - Commands: `git init`, `git status` (color-coded staged, modified, and untracked files), `git add`, `git commit -m`, `git log` (`--oneline`), `git diff`, `git branch` (create, list, delete), `git checkout` (`-b` branch switching and file checkout), `git merge`, and `git clone`.
  - Mock remote repositories: `https://git.linuxsim.local/devops/webapp.git` and `https://git.linuxsim.local/security/audit-tools.git`.
  - **Dynamic Branch-Aware Terminal Prompt:** Displays the active branch and dirty status `*` whenever the current working directory is inside a Git repository (e.g., `user@linux-box:~/projects (main*)$ `).
- **Docker Container Engine & Dynamic Port Binding:**
  - Complete Docker runtime simulator stored in `localStorage` (`linuxsim_docker`).
  - Pre-seeded catalog: `nginx:latest`, `redis:alpine`, `postgres:15`, `ubuntu:22.04`, `hello-world:latest`, `node:20-alpine`.
  - Commands: `docker images`, `docker pull`, `docker rmi`, `docker run` (`-d`, `-p hostPort:containerPort`, `--name`, `-e`), `docker ps` (`-a`), `docker stop`, `docker start`, `docker restart`, `docker rm` (`-f`), `docker logs`, `docker exec`.
  - **Dynamic Port & `curl` Integration:** Running containers with mapped ports (e.g. `-p 8080:80`) dynamically register as listening sockets in `netstat -tuln` / `ss -tuln`, and allow `curl http://localhost:8080` to return the container's live response!
- **Multi-User Management, Permissions & Remote Security:**
  - User accounts: `sudo useradd [-m] [-s shell] <user>`, `sudo userdel [-r] <user>`, `passwd`, `su [-] [user]`, `usermod -aG`, `groups`.
  - Session user switching with prompt updates (`root@linux-box:~#`) and user-stack restoration on `exit`.
  - Accurate permission checks against active user, groups, and root overrides.
  - **Uncomplicated Firewall (`ufw`):** `sudo ufw status [numbered|verbose]`, `sudo ufw enable`, `sudo ufw disable`, `sudo ufw allow <port>`, `sudo ufw deny <port>`, `sudo ufw delete <num>`. Active rules directly enforce or block network traffic.
  - **Simulated Remote Server (`ssh` & `scp`):** Interactive remote shell on `prod-node` (`10.0.0.5`) with mini VFS tree (`/home/admin/flag.txt`, `/etc/nginx/nginx.conf`, `/var/log/prod.log`) and bi-directional `scp` file transfer.
- **Live Background `cron` Runner:**
  - Background daemon that inspects `/etc/crontab` when the `cron` daemon is running in `systemctl`.
  - Periodically executes scheduled jobs and logs timestamped execution records to `/var/log/syslog`.
- **Visual System Monitor GUI Panel:**
  - Slide-out monitor drawer accessible via the Activity/Monitor button in `TopBar` and bottom dock.
  - **Live Gauges:** Animated CPU load and Memory meters that react dynamically to running `systemctl` services and `docker` containers.
  - **Services Manager:** Visual list of `systemctl` services (`nginx`, `ssh`, `postgresql`, `redis`, `cron`) with live status badges and one-click Start/Stop toggles.
  - **Docker Containers View:** List of running and exited containers with port mappings and one-click Start/Stop/Remove buttons.
  - **Network & Firewall Status:** Active listening ports table (`netstat`) and UFW firewall status indicator.
- **35 Comprehensive Practice Missions:**
  - Expanded across 5 curriculum tiers: **Beginner**, **Intermediate**, **Advanced**, **Expert (SysAdmin & Scripting)**, and **Master (DevOps & Security)** with automated validation, hints, and progress tracking.

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

## 🛠️ Complete Supported Commands Suite

### 1. Navigation & Directory Structure
| Command | Usage | Description |
| :--- | :--- | :--- |
| `pwd` | `pwd` | Print current working directory |
| `ls` | `ls [-a] [-l] [path]` | List files. Supports `-a` (hidden dotfiles), `-l` (long format with permissions, owner, size, timestamp, and symlink targets `->`) |
| `cd` | `cd [dir]` | Change directory. Supports `cd ~`, `cd ..`, `cd -` (previous dir), symlinks, absolute & relative paths |
| `tree` | `tree [path]` | Render an ASCII directory tree hierarchy |
| `find` | `find <path> -name <glob>` | Recursively search for files matching name patterns (e.g. `find ~ -name "*.txt"`) |

### 2. File Operations, Archives & Symlinks
| Command | Usage | Description |
| :--- | :--- | :--- |
| `mkdir` | `mkdir [-p] <dir...>` | Create directories. `-p` creates missing parent directories |
| `touch` | `touch <file...>` | Create new empty files or update timestamps of existing files |
| `rm` | `rm [-r] [-f] <target...>` | Remove files. `-r` or `-rf` required for directories |
| `cp` | `cp [-r] <source> <dest>` | Copy files or directories recursively (`-r`) |
| `mv` | `mv <source> <dest>` | Move or rename files and directories |
| `ln` | `ln -s <target> <link_name>` | Create symbolic links in the VFS |
| `tar` | `tar -czvf <file.tar.gz> <targets...>` | Create (`-c`), extract (`-x`), list (`-t`), verbose (`-v`), gzip (`-z`), file (`-f`) tar archives |
| `zip` | `zip [-r] <archive.zip> <files...>` | Compress files and directories into a zip archive |
| `unzip` | `unzip <archive.zip>` | Extract files from a zip archive |

### 3. Text Editors & Processing
| Command | Usage | Description |
| :--- | :--- | :--- |
| `vim` / `vi` | `vim <filename>` | Interactive modal Vim text editor with Normal, Insert, Visual, and Command modes |
| `nano` | `nano <filename>` | Interactive GNU nano clone editor with status bar and keyboard shortcuts (`Ctrl+O`, `Ctrl+X`) |
| `cat` | `cat [-n] [file...]` | Concatenate and print file contents or pipe stdin. `-n` numbers output lines |
| `echo` | `echo [-n] [-e] [text...]` | Print text to terminal or redirect to file. Supports variable expansion (`$USER`) and `-e` escape codes (`\n`, `\t`) |
| `sed` | `sed [-i] 's/find/replace/[g\|i]' [file...]` | Stream editor for substitutions. `-i` enables in-place VFS file editing |
| `awk` | `awk [-F <delim>] 'program' [file...]` | Pattern scanning and column processing language (e.g. `awk -F: '{print $1}' /etc/passwd`) |
| `cut` | `cut -d <delim> -f <fields> [file...]` | Extract sections from lines (e.g. `cut -d':' -f1,3 /etc/passwd`) |
| `tr` | `tr [-d] [-s] <set1> [set2]` | Translate, squeeze, or delete characters from standard input |
| `diff` | `diff [-u] <file1> <file2>` | Compare two files and display differences with unified diff markers |
| `jq` | `jq 'filter' [file...]` | Parse and transform JSON from file or stdin using dot-notation, arrays, and keys |
| `grep` | `grep [-i] [-v] [-n] [-c] <pattern> [file...]` | Search patterns. Supports case-insensitivity (`-i`), invert (`-v`), line numbers (`-n`), count (`-c`) |
| `head` | `head [-n <lines>] [file...]` | Output the first N lines (default 10) |
| `tail` | `tail [-n <lines>] [file...]` | Output the last N lines (default 10) |
| `wc` | `wc [-l] [-w] [-c] [file...]` | Print newline (`-l`), word (`-w`), and byte (`-c`) counts |
| `sort` | `sort [-r] [-n] [-u] [file...]` | Sort lines alphabetically, reverse (`-r`), numeric (`-n`), unique (`-u`) |
| `uniq` | `uniq [-c] [-d] [file...]` | Filter adjacent duplicate lines. `-c` adds counts, `-d` displays only duplicates |

### 4. Git & Version Control
| Command | Usage | Description |
| :--- | :--- | :--- |
| `git init` | `git init [dir]` | Initialize an empty Git repository |
| `git status` | `git status` | Show status of working tree, staging index, and active branch |
| `git add` | `git add <file \| . \| -A>` | Stage changes for commit |
| `git commit` | `git commit -m "<message>"` | Record staged changes to the repository with author and timestamp |
| `git log` | `git log [--oneline] [-n <num>]` | Show commit history in reverse chronological order |
| `git diff` | `git diff` | Show changes between working tree, index, and commits |
| `git branch` | `git branch [<name> \| -d <name>]` | List, create, or delete branches |
| `git checkout` | `git checkout [-b] <branch \| file>` | Switch branches or restore working tree files |
| `git merge` | `git merge <branch>` | Join development histories together |
| `git clone` | `git clone <url> [dir]` | Clone repository into a new directory (supports mock repos) |

### 5. Docker Containers
| Command | Usage | Description |
| :--- | :--- | :--- |
| `docker images` | `docker images` | List local Docker images |
| `docker pull` | `docker pull <image>` | Pull an image from registry catalog |
| `docker rmi` | `docker rmi <image>` | Remove one or more local images |
| `docker run` | `docker run [-d] [-p H:C] [--name N] <image>` | Create and run a container |
| `docker ps` | `docker ps [-a]` | List running or all (`-a`) containers |
| `docker stop` | `docker stop <name\|id>` | Stop a running container |
| `docker start` | `docker start <name\|id>` | Start a stopped container |
| `docker restart` | `docker restart <name\|id>` | Restart a container |
| `docker rm` | `docker rm [-f] <name\|id>` | Remove a container |
| `docker logs` | `docker logs <name\|id>` | Fetch container output logs |
| `docker exec` | `docker exec <name\|id> <cmd>` | Execute a command inside a running container |

### 6. Security, Users & Remote Access
| Command | Usage | Description |
| :--- | :--- | :--- |
| `useradd` | `sudo useradd [-m] [-s shell] <username>` | Create a new user account with home directory |
| `userdel` | `sudo userdel [-r] <username>` | Delete a user account and home directory |
| `passwd` | `passwd [username]` | Change user password |
| `su` | `su [-] [username]` | Change user ID or become superuser (`exit` to return) |
| `usermod` | `sudo usermod -aG <group> <username>` | Append user to a supplementary group |
| `groups` | `groups [username]` | Print group memberships for user |
| `ufw` | `sudo ufw [status\|enable\|disable\|allow\|deny\|delete]` | Program for managing firewall rules |
| `ssh` | `ssh [user@]hostname [cmd]` | OpenSSH remote login to simulated servers (`10.0.0.5`) |
| `scp` | `scp <src> <dest>` | Secure copy files between local VFS and `10.0.0.5` |

### 7. SysAdmin, Services & Networking
| Command | Usage | Description |
| :--- | :--- | :--- |
| `systemctl` | `sudo systemctl [start\|stop\|restart\|status\|enable\|disable] <daemon>` | Control simulated system daemons (`nginx`, `ssh`, `postgresql`, `redis`, `cron`) |
| `apt` / `apt-get`| `sudo apt [update\|install\|remove\|list] [pkg]` | Package manager (`jq`, `curl`, `htop`, `cowsay`, `figlet`, etc.) |
| `netstat` / `ss` | `netstat -tuln` / `ss -tuln` | Print active listening TCP/UDP network sockets |
| `curl` / `wget` | `curl [-s] [-I] [-o file] <url>` | Network client for local endpoints and Docker containers |
| `crontab` | `crontab [-l \| -r \| file]` | Maintain user crontab files |
| `chmod` | `chmod [mode] <file...>` | Change file permissions (octal `755` or symbolic `+x`, `u=rwx`) |
| `chown` | `chown [owner][:group] <file...>` | Change file owner and group |
| `sudo` | `sudo <command>` | Execute a command with elevated superuser privileges |
| `cowsay` | `cowsay <message>` | Speaking cow ASCII art (install via `apt`) |
| `figlet` | `figlet <message>` | Large ASCII text banner generator (install via `apt`) |

---

## 🏆 Curriculum Missions (35 Total)

### Tier 1: Beginner (Missions 1–5)
1. **Hello Terminal:** Execute `pwd` to locate working directory.
2. **First Exploration:** Inspect `/home/user` with `ls -la`.
3. **Changing Directories:** Navigate to Documents and verify with `pwd`.
4. **Creating a Folder:** Create `~/workspace` using `mkdir`.
5. **Creating a File:** Create `~/workspace/notes.txt` using `touch`.

### Tier 2: Intermediate (Missions 6–10)
6. **Writing with Echo:** Write text to `~/workspace/hello.txt` using `echo >`.
7. **Reading Files:** Read `/etc/os-release` using `cat`.
8. **Copying Files:** Copy `/etc/hosts` to `~/workspace/hosts.bak` with `cp`.
9. **Moving & Renaming:** Rename `~/workspace/hosts.bak` to `~/workspace/hosts.old` with `mv`.
10. **Removing Files:** Remove `~/workspace/notes.txt` using `rm`.

### Tier 3: Advanced (Missions 11–15)
11. **Text Searching:** Search for `ERROR` in `/var/log/syslog` using `grep`.
12. **Counting Lines:** Count total lines in `/var/log/syslog` with `wc -l`.
13. **Inspecting Log Head:** Read first 5 lines of `/var/log/syslog` with `head -n 5`.
14. **Piping & Redirection:** Extract `WARN` lines to `~/warnings.txt` with `grep | cat >`.
15. **File Permissions:** Make a script executable with `chmod +x`.

### Tier 4: Expert (SysAdmin & Scripting) (Missions 16–25)
16. **Stream Editing (`sed`):** Replace strings in `/etc/hosts` with `sed -i`.
17. **Column Extraction (`awk` & `cut`):** Extract usernames and UIDs from `/etc/passwd`.
18. **Symbolic Links:** Create a symlink at `~/logs` pointing to `/var/log` with `ln -s`.
19. **Archive & Backup:** Bundle `~/projects` into `~/backup.tar.gz` with `tar -czvf`.
20. **Service Recovery:** Start the `nginx` daemon via `sudo systemctl start nginx`.
21. **Package Management & JSON:** Install `jq`, fetch users API with `curl`, and parse names.
22. **Writing a Bash Script:** Create `~/sys_check.sh`, make executable, and write system status.
23. **Bash Loops & Args:** Write and execute `~/greet.sh` taking positional parameters `$1`.
24. **Persistent Environment:** Add custom alias `alias ports='netstat -tuln'` to `~/.bashrc`.
25. **Security Audit:** Inspect open sockets with `netstat -tuln` and save output to `~/audit.txt`.

### Tier 5: Master (DevOps & Security) (Missions 26–35)
26. **Vim Mastery:** Open `~/Documents/notes.txt` in `vim`, append `"Edited with Vim"`, and `:wq`.
27. **Git Initialization & First Commit:** Initialize Git in `~/projects`, stage with `git add .`, and commit.
28. **Git Branching:** Create and switch to branch `feature/login` with `git checkout -b`.
29. **Clone & Inspect:** Clone `https://git.linuxsim.local/devops/webapp.git` into `~/webapp`.
30. **Docker Deployment:** Run detached `nginx` container named `web-proxy` on port `8080:80`.
31. **User Provisioning:** Create a new user named `devops` with home dir via `sudo useradd -m devops`.
32. **Firewall Hardening:** Enable `ufw`, allow SSH (22), allow HTTP (80), and deny Telnet (23).
33. **Remote SCP Transfer:** Copy `admin@10.0.0.5:/home/admin/flag.txt` into `~/flag.txt` with `scp`.
34. **Cron Automation:** Schedule a job in `/etc/crontab` and ensure `cron` service is running.
35. **Full DevOps Pipeline:** Clone webapp, archive backup with `tar`, start `nginx`, and output verification.

---

## 💻 Tech Stack & Architecture

- **UI Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + Lucide React icons
- **Virtual File System (VFS):** In-memory tree with path normalization, symlink resolution, permissions matrix, and `localStorage` debounced persistence.
- **Shell Engine:** Lexer, Parser, Pipeline executor, Environment variable expansion, Script runner, Command Registry.
- **Architecture Highlights:** 100% Client-Side, Zero External APIs, Zero Tracking, Zero Telemetry.
