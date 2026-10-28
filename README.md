# 🐧 LinuxSim — Client-Side Linux Desktop & Terminal Simulator (Phase 2)

**LinuxSim** is a fully local, browser-based Linux Desktop and Terminal Simulator built for learning and practicing command-line skills, shell scripting, system administration, and file-system management in a safe, zero-risk sandbox.

Everything runs **100% client-side** in your web browser with zero external backend dependencies. State is persisted automatically to `localStorage`, with instant two-way synchronization between terminal commands and a visual desktop GUI.

---

## 📸 Key Highlights & New Phase 2 Capabilities

- **Executable Shell Scripting Engine:** Direct script execution (`./script.sh`, `bash script.sh`, `sh script.sh`), permission enforcement (`+x`), shebang parsing (`#!/bin/bash`), positional parameters (`$0`, `$1`..`$9`, `$@`, `$#`, `$?`), variable assignment, `if [ condition ]; then ... else ... fi` blocks, and `for VAR in ...; do ... done` loops.
- **Power Text & Data Processing:** Full implementations of `sed` (stream editing with `-i` in-place file editing), `awk` (delimiter splitting `-F`, column printing, pattern matching), `cut` (delimiter `-d` and fields `-f`), `tr` (character translation, delete `-d`, squeeze `-s`), `diff` (standard and unified `-u`), and `jq` (JSON dot-notation, arrays, and keys).
- **Archive & Link Engine:**
  - `ln -s`: Real symbolic links across the VFS with recursive transparent resolution and `ls -l` link indicators (`lrwxrwxrwx name -> target`).
  - `tar`: Bundling and restoring directories (`tar -czvf backup.tar.gz ~/projects` & `tar -xzvf backup.tar.gz`).
  - `zip` & `unzip`: Archive creation and extraction.
- **Simulated SysAdmin & Networking:**
  - `apt` / `apt-get`: Simulated Debian package management (`apt update`, `apt install <pkg>`, `apt list --installed`, `apt remove`). Includes easter-egg commands `cowsay` and `figlet` once installed!
  - `systemctl`: Manage simulated system daemons (`nginx`, `ssh`, `postgresql`, `redis`, `cron`) with `status`, `start`, `stop`, `restart`, `enable`, `disable`.
  - Dynamic `ps aux`, `top`, `htop`: Real-time synchronization showing active daemons with realistic PIDs and metrics.
  - `netstat` & `ss`: View active listening ports dynamically mapped to running `systemctl` daemons (`-tuln`).
  - `curl` & `wget`: Offline mock router supporting `http://localhost:80` (tied directly to `nginx` service status!), `https://api.linuxsim.local/users`, `https://api.linuxsim.local/status`, and file downloading with `-o`.
  - `crontab`: Manage scheduled cron jobs (`crontab -l`, `crontab -r`, `crontab <file>`).
- **Interactive File Explorer Actions:**
  - Header toolbar with **New File**, **New Folder**, and **Upload Text File** (directly from host PC into current VFS folder).
  - Inspection drawer with **Edit in Nano** (opens directly in active terminal), **Download to PC**, and **Delete**.
- **VFS Snapshot Import/Export:** One-click **Export VFS** to download your complete filesystem as `linuxsim-snapshot.json` and **Import VFS** to restore state.
- **25 Comprehensive Practice Missions:** Expanded curriculum across 4 tiers: **Beginner**, **Intermediate**, **Advanced**, and **Expert (SysAdmin & Scripting)** with automated validation, hints, and progress tracking.

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

### 3. Power Text & Data Processing
| Command | Usage | Description |
| :--- | :--- | :--- |
| `cat` | `cat [-n] [file...]` | Concatenate and print file contents or pipe stdin. `-n` numbers output lines |
| `echo` | `echo [-n] [-e] [text...]` | Print text to terminal or redirect to file. Supports variable expansion (`$USER`) and `-e` escape codes (`\n`, `\t`) |
| `sed` | `sed [-i] 's/find/replace/[g\|i]' [file...]` | Stream editor for substitutions. `-i` enables in-place VFS file editing |
| `awk` | `awk [-F <delim>] 'program' [file...]` | Pattern scanning and column processing language (e.g. `awk -F: '{print $1}' /etc/passwd`) |
| `cut` | `cut -d <delim> -f <fields> [file...]` | Extract sections from lines (e.g. `cut -d':' -f1,3 /etc/passwd`) |
| `tr` | `tr [-d] [-s] 'set1' ['set2']` | Translate characters (e.g. `tr 'a-z' 'A-Z'`), delete (`-d`), or squeeze repeats (`-s`) |
| `diff` | `diff [-u] file1 file2` | Compare files line by line (standard or unified format `-u`) |
| `jq` | `jq '<filter>' [file...]` | Parse and query JSON with dot-notation (`.`, `.users`, `.[].name`, `keys`, `length`) |
| `grep` | `grep [-i] [-v] [-n] [-c] <pattern> [file...]` | Search patterns in files or pipeline stdin with highlighted matches. `-i` ignore case, `-v` invert, `-n` line numbers, `-c` count |
| `head` | `head [-n <count>] [file...]` | Output first $N$ lines of file or stdin (default 10) |
| `tail` | `tail [-n <count>] [file...]` | Output last $N$ lines of file or stdin (default 10) |
| `wc` | `wc [-l] [-w] [-c] [file...]` | Count lines (`-l`), words (`-w`), or bytes (`-c`) |
| `sort` | `sort [-r] [-n] [-u] [file...]` | Sort lines alphabetically or numerically (`-n`). `-r` reverse, `-u` unique |
| `uniq` | `uniq [-c] [-d] [file]` | Filter adjacent duplicate lines. `-c` count occurrences, `-d` only duplicates |
| `nano` | `nano <filename>` | Open interactive in-terminal text editor |

### 4. SysAdmin, Services, Networking & Packages
| Command | Usage | Description |
| :--- | :--- | :--- |
| `systemctl` | `systemctl [status\|start\|stop\|restart\|enable\|disable] <svc>` | Control system daemons: `nginx` (port 80), `ssh` (port 22), `postgresql` (port 5432), `redis` (port 6379), `cron` |
| `netstat` | `netstat -tuln` | Display active listening TCP/UDP sockets mapped dynamically to running daemons |
| `ss` | `ss -tuln` | Socket statistics showing active listening services |
| `curl` | `curl [-s] [-I] [-o <file>] <url>` | Fetch URLs with local offline mock router (simulates `localhost:80`, `api.linuxsim.local/users`, etc.) |
| `wget` | `wget [-O <file>] <url>` | Download files from simulated web router into VFS |
| `apt` / `apt-get` | `apt [update\|install\|remove\|list --installed]` | Package manager to install simulated packages (`jq`, `nmap`, `cowsay`, `figlet`, `cmatrix`, `htop`) |
| `crontab` | `crontab [-l\|-r\|<file>]` | Manage scheduled user cron jobs stored in `/etc/crontab` |
| `cowsay` | `cowsay <text>` | ASCII cow displaying custom speech (installed via `apt`) |
| `figlet` | `figlet <text>` | Large ASCII text banner generator (installed via `apt`) |

### 5. Shell Scripting & Execution
| Command | Usage | Description |
| :--- | :--- | :--- |
| `./script.sh` | `./<script.sh> [args...]` | Direct script execution. Requires execute permission (`chmod +x`) |
| `bash` / `sh` | `bash <script.sh> [args...]` | Execute shell scripts directly without requiring execute bit |
| `chmod` | `chmod <mode> <file...>` | Modify permissions using octal (`755`, `644`, `600`) or symbolic notation (`+x`, `-w`, `u+x`) |
| `chown` | `chown <owner[:group]> <file...>` | Change file owner and group (requires simulated root) |
| `sudo` | `sudo <command>` | Execute a command with simulated root privileges |
| `whoami` | `whoami` | Print active user name (`user` or `root`) |
| `id` | `id` | Display user UID, GID, and assigned security groups |

### 6. System Metrics & Builtin Utilities
| Command | Usage | Description |
| :--- | :--- | :--- |
| `neofetch` | `neofetch` | Display ASCII Linux art alongside system metrics, kernel version, and VFS file count |
| `uname` | `uname [-a]` | Print operating system kernel information |
| `hostname` | `hostname` | Display system host identifier (`linux-box`) |
| `date` | `date` | Display formatted system timestamp and timezone |
| `uptime` | `uptime` | Display simulated uptime and load averages |
| `cal` | `cal` | Render current month calendar with today's date highlighted |
| `df` | `df [-h]` | Report file system disk space utilization |
| `du` | `du [-sh] [path]` | Estimate file space usage for target path |
| `free` | `free [-m]` | Display free, used, and cached memory metrics |
| `ps` | `ps [aux]` | Snapshot of active processes (dynamically synchronized with running services) |
| `top` / `htop` | `top`, `htop` | Interactive process status and system resource overview |
| `kill` | `kill <pid>` | Signal simulation for terminating mock processes |
| `ping` | `ping <host>` | Stream ICMP packet requests with simulated latencies (cancelable with `Ctrl+C`) |
| `history` | `history` | List session command history |
| `alias` | `alias [name='cmd']` | View all aliases or assign command shortcuts (e.g. `alias ll='ls -la'`) |
| `export` | `export [VAR=value]` | Set environment variables accessible across sub-commands |
| `env` | `env` | Print all current environment variables |
| `man` | `man <command>` | Formatted manual page detailing command synopsis, flags, and description |
| `help` | `help` | Quick overview of all registered commands |
| `type` | `type <command>` | Indicate whether a command is a builtin, alias, or executable binary |
| `which` | `which <command>` | Locate the binary path of a command |
| `clear` | `clear` | Clear terminal display (same as `Ctrl+L`) |

---

## 🎯 25 Hands-On Practice Missions

The simulator includes a progressive curriculum across 4 tiers:

### 🟢 Beginner (Missions 1–5)
1. **Hello Terminal:** Type `whoami`.
2. **Where Am I?:** Run `pwd` and `ls`.
3. **Explorer:** Navigate to `/var/log` using `cd` and list files.
4. **File Creator:** Create directory `~/practice` and file `~/practice/hello.txt` with `touch`.
5. **Writer:** Output `"Hello, Linux!"` into `~/practice/greeting.txt` using `echo >`.

### 🟡 Intermediate (Missions 6–10)
6. **Log Detective:** Extract `ERROR` lines from `/var/log/syslog` and save to `~/errors.txt`.
7. **File Manager:** Copy `~/Documents/notes.txt` to `~/Downloads/backup_notes.txt`.
8. **Permission Master:** Create `~/myscript.sh` and make it executable with `chmod +x`.
9. **Pipe Wizard:** Count the number of error lines in `/var/log/syslog` using `grep ... | wc -l`.
10. **Directory Builder:** Build nested directories `~/projects/webapp/src/components` with `mkdir -p`.

### 🔴 Advanced (Missions 11–15)
11. **System Admin:** Restrict permissions on `~/Documents/secret.log` to `600`.
12. **Text Surgeon:** Sort users from `/etc/passwd` alphabetically into `~/sorted_users.txt`.
13. **Log Analyzer:** Extract unique warnings from `auth.log` and save to `~/warnings.txt`.
14. **Cleanup Crew:** Recursively delete `~/Downloads` and recreate it empty.
15. **Config Editor:** Use `nano ~/projects/config.json` to change the port to `8080`.

### 🟣 Expert (Missions 16–25: SysAdmin & Scripting)
16. **Column Extraction:** Use `cut` or `awk` on `/etc/passwd` to extract usernames to `~/users.txt`.
17. **Stream Editing:** Replace `WARN` with `WARNING` in `/var/log/syslog` using `sed` and save to `~/cleaned.log`.
18. **Symbolic Links:** Create a symbolic link at `~/logs` pointing to `/var/log` using `ln -s`.
19. **Archive & Backup:** Bundle `~/projects` into `~/backup.tar.gz` using `tar -czvf`.
20. **Service Recovery:** Start the `nginx` web server using `sudo systemctl start nginx` and verify with `curl http://localhost:80`.
21. **Package Management & JSON:** Install `jq` with `sudo apt install jq`, fetch `https://api.linuxsim.local/users` with `curl`, and extract names to `~/api_users.txt`.
22. **Writing a Bash Script:** Create `~/sys_check.sh`, make it executable (`chmod +x`), and have it write user info and uptime into `~/report.txt`.
23. **Bash Loops & Args:** Write and run a script `~/greet.sh` taking `$1` and echoing `"Hello, $1"`.
24. **Persistent Environment:** Add `alias ports='netstat -tuln'` to `~/.bashrc`.
25. **Security Audit:** Run `netstat -tuln` and save listening ports report to `~/audit.txt`.

---

## 💡 Scripting & Pipeline Examples

### Example 1: Executable Bash Script with Arguments and Loops
Create `~/deploy_apps.sh`:
```bash
#!/bin/bash
echo "Deploying for environment: $1"
for APP in web api db; do
  echo "Setting up $APP..."
  mkdir -p ~/projects/$APP
done
echo "Deployment of $# targets complete!"
```
Make it executable and run it:
```bash
chmod +x ~/deploy_apps.sh
./deploy_apps.sh production staging
```

### Example 2: Inspecting Daemons & Querying Local API
```bash
# Start nginx web server
sudo systemctl start nginx

# Verify open ports
netstat -tuln

# Query local web server
curl -s http://localhost:80

# Query simulated REST API and format with jq
curl -s https://api.linuxsim.local/users | jq '.[].name'
```

---

## 📜 License

This project is open-source and free to use for personal practice, education, and Linux command-line learning.
