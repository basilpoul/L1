# 🐧 LinuxSim — Client-Side Linux Desktop, Terminal, Cloud-Native & SRE Simulator (Phase 5)

**LinuxSim** is a fully local, browser-based Linux Desktop, Terminal, Cloud-Native Orchestrator, and SRE Simulator built for learning and mastering Linux commands, shell scripting, Git version control, Docker containers, Kubernetes (`kubectl`), Docker Compose, kernel tuning, block storage mounting, network security, and site reliability engineering in a safe, zero-risk sandbox.

Everything runs **100% client-side** in your web browser with zero external backend dependencies. State is persisted automatically to `localStorage`, with instant two-way synchronization between terminal commands and visual desktop GUI panels.

---

## 📸 Key Highlights & Phase 5 Upgrades

### 1. Cloud-Native Orchestration (`kubectl` & `docker-compose`)
- **Kubernetes CLI (`kubectl`):**
  - Manages simulated cluster state (`k8s-default`, node `linux-box-control-plane` v1.30.0).
  - Pre-seeded manifests in `/home/user/projects/k8s/deployment.yaml` and `service.yaml`.
  - Commands: `kubectl get nodes|pods|deployments|svc|all [-o wide]`, `kubectl apply -f <manifest.yaml>`, `kubectl scale deployment <name> --replicas=<N>`, `kubectl describe pod|deployment|node <name>`, `kubectl logs <pod>`, `kubectl create deployment <name> --image=<img>`, `kubectl delete pod|deployment|svc <name>`.
  - **Automated Self-Healing:** Deleting a pod belonging to a deployment triggers an automatic Kubernetes respawn!
- **Docker Compose (`docker-compose`):**
  - Pre-seeded multi-container stack in `/home/user/projects/docker-compose.yml` (`web: nginx` and `cache: redis`).
  - Commands: `docker-compose up [-d]`, `docker-compose down`, `docker-compose ps`, and `docker-compose logs`.
  - Containers integrate seamlessly into Docker state and appear in `docker ps`, `SystemMonitorGUI`, and `netstat -tuln`.

### 2. Block Storage, Mounts & Kernel Internals
- **Block Devices (`lsblk`, `mount`, `umount`, `fdisk`):**
  - Simulated disks `sda` (50G: `sda1` root `/`, `sda2` `[SWAP]`) and unmounted secondary volume `sdb1` (20G ext4).
  - `lsblk`: Visual ASCII device tree with sizes, types, and mount points.
  - `sudo mount /dev/sdb1 <dir>`: Mounts volume, populates `/lost+found` and `vault_backup.tar.gz`, and dynamically updates `df -h`.
  - `sudo umount <dir>`: Safely unmounts volume and hides attached files.
  - `fdisk -l`: Partition table layout inspection for `/dev/sda` and `/dev/sdb`.
- **Systemd Journal & Kernel Tools (`journalctl`, `dmesg`, `sysctl`):**
  - `journalctl [-u <service>] [-n <lines>]`: View system logs for `nginx`, `ssh`, `postgresql`, `redis`, `docker`, and `cron`.
  - `dmesg [-T]`: Colorized kernel ring buffer boot messages with piping and grep support.
  - `sysctl [-a] [-w key=value]`: Inspect and configure runtime kernel parameters (e.g. `sudo sysctl -w net.ipv4.ip_forward=1`), automatically synced with `/etc/sysctl.conf`.

### 3. Visual Network & Cluster Topology Map GUI
- **Interactive Architecture Map:** Access via the **Topology** button in the Top Bar or Bottom Dock.
- **5-Tier Interactive Visual Architecture:**
  1. *Local Host (`linux-box • 10.0.0.2`):* User session, mounted disks (`sda1`, `sdb1`), and UFW firewall status badge.
  2. *Systemd Services Layer:* Live cards for `nginx:80`, `ssh:22`, `postgresql:5432`, `redis:6379`.
  3. *Docker Bridge (`docker0 • 172.17.0.1/16`):* Connected containers with live port forwardings.
  4. *Kubernetes Cluster (`k8s-default • 10.244.0.0/16`):* Deployments, replica counts, and pod badges.
  5. *Remote Production Host (`prod-node • 10.0.0.5`):* Network link with `/etc/hosts` DNS aliases and SSH status.
- **Node Inspector Card:** Inspect selected nodes and execute quick live actions: *"Run curl check"*, *"Restart Service"*, *"Scale +1 Pod"*, *"SSH Connect"*.

### 4. Custom Mission / Lab Builder & Session Recorder
- **Custom Lab Builder Modal:** Click **"+ Custom"** in the Missions Sidebar to author no-code practice challenges:
  - Configure Title, Tier, Description, Hint, and rule conditions (*File Exists*, *File Contains Text*, *Command in History*, *Service is Active*).
  - Saved in `localStorage` (`linuxsim_custom_missions`) with **Export JSON** and **Import JSON** support.
- **Terminal Session Recorder (`script` / `replay`):**
  - `script <filename.cast>`: Records terminal commands, outputs, and timestamps into asciicast format.
  - `replay <filename.cast>`: Sequentially replays recorded sessions in real-time with typing cadence.

### 5. Command Palette (`Ctrl+K`) & Web Audio SFX
- **Spotlight Search (`Ctrl+K`):** Global spotlight search dialog to trigger actions (Split H/V, Reset VFS, Toggle Panels), switch themes, or jump directly to any mission.
- **Procedural Web Audio API Sound Engine:** Pure browser-synthesized audio effects (zero external audio files):
  - Subtle mechanical keyboard click on typing.
  - Classic terminal bell on error.
  - Ascending two-tone success chime on mission and incident completion.
  - Toggle mute/unmute via volume button in the Top Bar.

---

## 📸 Existing Core Capabilities (Phases 1–4)

### Split-Pane Terminal Multiplexing (`tmux`)
- Split terminal tabs horizontally or vertically with shared live VFS state.
- Live streaming commands: `watch [-n seconds] <cmd>` and `tail -f <file>`.
- Full process job control: `&`, `jobs`, `fg`, `bg`, `sleep`, `nohup`, `kill`.

### Dynamic `/etc/hosts` DNS & Cryptography
- Hostname resolution for `ping`, `curl`, `wget`, `ssh`, `dig`, `nslookup`, `traceroute`.
- Integrity and crypto tools: `sha256sum`, `md5sum`, `base64`, `openssl`, `ssh-keygen`, `ssh-copy-id`.

### Embedded Client-Side Runtimes
- **Node.js (`node`):** Run JS with bridged VFS `fs` file operations.
- **Python 3 (`python3`):** Run Python code with built-in bridged file `open()`.
- **SQLite 3 (`sqlite3`):** In-memory relational database querying `/var/lib/app.db`.

### Interactive Editors & Version Control
- **Modal Vim Editor (`vim` / `vi`):** Authentic NORMAL, INSERT, VISUAL, and COMMAND modes (`:w`, `:q`, `:wq`, `:set nu`, `/<search>`).
- **Nano Editor (`nano`):** In-terminal text editor with bottom shortcuts.
- **Local Git Engine (`git`):** `init`, `status`, `add`, `commit`, `log`, `branch`, `checkout`, `clone`.

### System Daemons & Security
- Systemd manager: `systemctl start|stop|restart|status|enable|disable`.
- Multi-user management: `useradd`, `userdel`, `su`, `passwd`, `groups`.
- Firewall: `ufw enable|disable|status|allow|deny`.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm`

### Installation & Launch

1. Navigate to the project directory:
   ```bash
   cd linux_clone
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## 🎯 55 Progressive Missions Curriculum

### Tier 1: Beginner (Missions 1–5)
1. **Hello Terminal:** Run `whoami`.
2. **Where Am I?:** Check directory with `pwd` and list files with `ls`.
3. **Explorer:** Change directory to `/var/log` with `cd` and list files.
4. **Secret Agent:** List hidden files with `ls -a`.
5. **Reading Secrets:** Read `/home/user/readme.txt` with `cat`.

### Tier 2: Intermediate (Missions 6–10)
6. **Making Directories:** Create `~/workspace` using `mkdir`.
7. **Creating Files:** Create `~/workspace/test.txt` using `touch`.
8. **Writing Notes:** Redirect text using `echo "Hello Linux" > test.txt`.
9. **Copying Files:** Copy file with `cp test.txt notes.txt`.
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
26. **Vim Mastery:** Open `~/Documents/notes.txt` in `vim`, append text, and `:wq`.
27. **Git Initialization & First Commit:** Initialize Git in `~/projects`, stage, and commit.
28. **Git Branching:** Create and switch to branch `feature/login` with `git checkout -b`.
29. **Clone & Inspect:** Clone `https://git.linuxsim.local/devops/webapp.git` into `~/webapp`.
30. **Docker Deployment:** Run detached `nginx` container named `web-proxy` on port `8080:80`.
31. **User Provisioning:** Create a new user named `devops` with home dir via `sudo useradd -m devops`.
32. **Firewall Hardening:** Enable `ufw`, allow SSH (22), allow HTTP (80), and deny Telnet (23).
33. **Remote SCP Transfer:** Copy `admin@10.0.0.5:/home/admin/flag.txt` into `~/flag.txt` with `scp`.
34. **Cron Automation:** Schedule a job in `/etc/crontab` and ensure `cron` service is running.
35. **Full DevOps Pipeline:** Clone webapp, archive backup with `tar`, start `nginx`, and output verification.

### Tier 6: Architect & CTF (Missions 36–45)
36. **Terminal Multiplexing:** Split the terminal window into multiple panes using `tmux` or `tmux split-window -h`.
37. **Background Job Control:** Run `sleep 10 &`, inspect it with `jobs`, and bring to foreground with `fg`.
38. **DNS Resolution & Hosts:** Add custom host `192.168.1.100 internal.corp` to `/etc/hosts` and query with `dig internal.corp`.
39. **Cryptographic Integrity:** Generate SHA-256 hash of `/etc/passwd` and save to `~/passwd.sha256`.
40. **SSH Keypair Infrastructure:** Generate a keypair with `ssh-keygen -t rsa` and install it via `ssh-copy-id admin@10.0.0.5`.
41. **CTF: Secret Flag Decryption:** Decode the secret flag in `/var/secret_flag.b64` using `base64 -d` to `~/decoded_flag.txt`.
42. **Embedded Node.js Engine:** Run `node -e` or a script with bridged `fs` to write `{"status":"ok"}` to `~/node_output.json`.
43. **Embedded Python Data Pipeline:** Run Python 3 via `python3 -c` or script to write `"PYTHON_PIPELINE_OK"` to `~/py_output.txt`.
44. **Relational Database SQL Queries:** Execute `sqlite3 /var/lib/app.db "SELECT * FROM employees"` and export to `~/db_report.txt`.
45. **Break-Fix Incident Resolution:** Open the Incidents modal from the Top Bar, resolve an outage, and verify in the incident console.

### Tier 7: Cloud-Native & Kernel (Missions 46–55) (Phase 5)
46. **Block Device Discovery:** Inspect block devices with `lsblk` and save output to `~/disks.txt`.
47. **Mounting External Storage:** Create `/mnt/external` and mount `/dev/sdb1` with `sudo mount /dev/sdb1 /mnt/external`.
48. **Systemd Journal Auditing:** Extract Nginx unit service logs with `journalctl -u nginx` to `~/nginx_journal.log`.
49. **Kernel Parameter Tuning:** Enable IPv4 packet forwarding using `sudo sysctl -w net.ipv4.ip_forward=1`.
50. **Docker Compose Stack:** Navigate to `~/projects` and launch the multi-container stack with `docker-compose up -d`.
51. **Kubernetes Manifest Deployment:** Apply deployment manifest `/home/user/projects/k8s/deployment.yaml` with `kubectl apply -f`.
52. **Kubernetes Horizontal Scaling:** Scale webapp deployment to 4 replicas using `kubectl scale deployment webapp --replicas=4`.
53. **Kubernetes Self-Healing Test:** Delete a pod with `kubectl delete pod <name>`, verify auto-respawn, and save `kubectl get pods` to `~/k8s_pods.txt`.
54. **Terminal Session Recording:** Record a session using `script ~/demo.cast`, execute commands, and stop with `exit`.
55. **The Ultimate Cloud Architect:** Mount `/dev/sdb1`, enable `net.ipv4.ip_forward=1`, start `nginx`, and maintain 3+ running Kubernetes pods!

---

## 💻 Tech Stack & Architecture

- **UI Framework:** React 19 + TypeScript + Vite
- **Audio Engine:** Pure Web Audio API synthesizers (oscillators + gain envelopes)
- **Styling:** Tailwind CSS + Lucide React icons
- **Virtual File System (VFS):** In-memory tree with path normalization, symlink resolution, permissions matrix, block device mounting, and `localStorage` debounced persistence.
- **Shell Engine:** Lexer, Parser, Pipeline executor, Environment variable expansion, Script runner, Command Registry, Multiplexing engine, Terminal Session Recorder.
- **Cloud-Native Engines:** Kubernetes (`kubectl`) cluster simulation with replica controller and self-healing pods; Docker Compose stack engine.
- **Embedded Engines:** JavaScript/Node sandbox with bridged `fs`, Python interpreter mapping with file I/O, SQLite SQL parser and table renderer.
- **Architecture Highlights:** 100% Client-Side, Zero External APIs, Zero Tracking, Zero Audio Assets.


---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm`

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
| `ls` | `ls [-a] [-l] [path]` | List files. Supports `-a` (hidden dotfiles), `-l` (long format with permissions, owner, size, timestamp, symlink targets `->`) |
| `cd` | `cd [dir]` | Change directory (`cd ~`, `cd ..`, `cd -`, symlinks, absolute & relative paths) |
| `tree` | `tree [path]` | Render an ASCII directory tree hierarchy |
| `find` | `find <path> -name <glob>` | Recursively search for files matching name patterns |

### 2. File Operations, Archives & Symlinks
| Command | Usage | Description |
| :--- | :--- | :--- |
| `mkdir` | `mkdir [-p] <dir...>` | Create directories (`-p` creates missing parents) |
| `touch` | `touch <file...>` | Create new empty files or update timestamps |
| `rm` | `rm [-r] [-f] <target...>` | Remove files or directories (`-r` / `-rf`) |
| `cp` | `cp [-r] <src> <dest>` | Copy files or directories recursively |
| `mv` | `mv <src> <dest>` | Move or rename files and directories |
| `ln` | `ln -s <target> <link_name>` | Create symbolic links |
| `tar` | `tar -czvf <archive.tar.gz> <files...>` / `-xzvf` / `-tvf` | Create, extract, or list gzip tar archives |
| `zip` | `zip <archive.zip> <files...>` | Compress files into a ZIP archive |
| `unzip` | `unzip [-l] <archive.zip>` | Extract or list files in a ZIP archive |

### 3. Text Processing & Editors
| Command | Usage | Description |
| :--- | :--- | :--- |
| `cat` | `cat [file...]` | Concatenate and display file content |
| `echo` | `echo [text...]` | Print text (supports `>` and `>>` redirection) |
| `grep` | `grep [-i] [-v] [-n] [-c] <pattern> [file...]` | Search text using regular expressions |
| `head` | `head [-n count] [file...]` | Output first lines of a file |
| `tail` | `tail [-n count] [-f] [file...]` | Output last lines of a file (`-f` follows file in real-time) |
| `wc` | `wc [-l] [-w] [-c] [file...]` | Word, line, and character count |
| `sort` | `sort [-r] [-n] [-u] [file...]` | Sort lines of text files |
| `uniq` | `uniq [-c] [-d] [file...]` | Filter adjacent duplicate lines |
| `sed` | `sed -i 's/find/replace/g' <file>` | Stream editor for inline string substitution |
| `awk` | `awk '{print $1, $3}' <file>` | Pattern scanning and column processing language |
| `cut` | `cut -d':' -f1,3 <file>` | Remove sections from each line of files |
| `tr` | `tr 'a-z' 'A-Z'` | Translate or delete characters |
| `diff` | `diff [-u] <file1> <file2>` | Compare files line by line |
| `jq` | `jq '.path' <file.json>` | Command-line JSON processor |
| `nano` | `nano <file>` | In-terminal interactive visual text editor |
| `vim` / `vi` | `vim <file>` | Interactive modal text editor (Normal, Insert, Visual, Command) |

### 4. Multiplexing, Live Views & Background Jobs (Phase 4)
| Command | Usage | Description |
| :--- | :--- | :--- |
| `tmux` | `tmux [split-window -h \| -v]` | Split terminal view into multiplexed interactive panes |
| `watch` | `watch [-n seconds] <command>` | Periodically re-execute command and display output |
| `jobs` | `jobs [-l]` | Display status and PIDs of active background jobs |
| `fg` | `fg [%job_id]` | Bring a background job to foreground |
| `bg` | `bg [%job_id]` | Resume a suspended job in the background |
| `sleep` | `sleep <seconds>` | Delay for specified amount of time (interruptible via Ctrl+C) |
| `nohup` | `nohup <command> &` | Run command immune to hangups, logging to `nohup.out` |
| `kill` | `kill [%job_id \| pid]` | Terminate background jobs or processes |

### 5. Embedded Runtimes & Relational SQL (Phase 4)
| Command | Usage | Description |
| :--- | :--- | :--- |
| `node` | `node [-e "code"] [script.js]` | Execute JavaScript with bridged VFS `fs` file operations |
| `python3` / `python` | `python3 [-c "code"] [script.py]` | Execute Python scripts with VFS `open()` file I/O |
| `sqlite3` | `sqlite3 <db_file> [SQL_QUERY]` | Query or modify VFS SQLite relational databases |

### 6. DNS, Cryptography & Security (Phase 4)
| Command | Usage | Description |
| :--- | :--- | :--- |
| `ip` | `ip [addr \| link \| route]` | Show network interfaces and IP routing table |
| `dig` | `dig <domain>` | Query DNS server for domain resource records |
| `nslookup` | `nslookup <domain>` | Query Internet name servers interactively |
| `traceroute` | `traceroute <host>` | Print the route packets trace to network host |
| `base64` | `base64 [-d] [file]` | Base64 encode or decode data |
| `sha256sum` | `sha256sum [file...]` | Compute and check SHA-256 message digest |
| `md5sum` | `md5sum [file...]` | Compute and check MD5 message digest |
| `openssl` | `openssl rand [-hex \| -base64] <bytes>` | Cryptographic toolkit and pseudo-random byte generator |
| `ssh-keygen` | `ssh-keygen [-t rsa\|ed25519]` | Generate SSH authentication keypair in `~/.ssh/` |
| `ssh-copy-id` | `ssh-copy-id <user@host>` | Copy local public key to remote authorized_keys |

### 7. Git Version Control
| Command | Usage | Description |
| :--- | :--- | :--- |
| `git init` | `git init` | Create an empty Git repository in the current directory |
| `git status` | `git status` | Show working tree status (staged, modified, untracked) |
| `git add` | `git add <file... \| .>` | Stage file contents for the next commit |
| `git commit` | `git commit -m "message"` | Record changes to the repository |
| `git log` | `git log [--oneline]` | Show commit logs and commit history |
| `git diff` | `git diff` | Show changes between commits, commit and working tree |
| `git branch` | `git branch [-d] [name]` | List, create, or delete branches |
| `git checkout` | `git checkout [-b] <branch \| file>` | Switch branches or restore working tree files |
| `git merge` | `git merge <branch>` | Join two development histories together |
| `git clone` | `git clone <url> [dir]` | Clone a repository into a new directory |

### 8. Docker Containers
| Command | Usage | Description |
| :--- | :--- | :--- |
| `docker images` | `docker images` | List available container images |
| `docker pull` | `docker pull <image>` | Pull an image from simulated registry |
| `docker run` | `docker run [-d] [-p host:cont] [--name name] <image>` | Run a container from an image |
| `docker ps` | `docker ps [-a]` | List containers (`-a` shows all stopped containers) |
| `docker stop` / `start` | `docker stop/start <id/name>` | Stop or start containers |
| `docker rm` | `docker rm [-f] <id/name>` | Remove one or more containers |
| `docker logs` | `docker logs <id/name>` | Fetch the logs of a container |
| `docker exec` | `docker exec <id/name> <cmd>` | Run a command in a running container |

### 9. SysAdmin, Services & Remote Administration
| Command | Usage | Description |
| :--- | :--- | :--- |
| `systemctl` | `systemctl [start\|stop\|restart\|status] <service>` | Control systemd services (`nginx`, `ssh`, `redis`, `postgresql`, `cron`) |
| `netstat` / `ss` | `netstat -tuln` / `ss -tuln` | Print network connections and active listening sockets |
| `curl` / `wget` | `curl [-s] [-O] <url>` / `wget <url>` | Transfer data from or to simulated web services |
| `apt` / `apt-get` | `sudo apt update && sudo apt install <pkg>` | Install simulated packages (`jq`, `tree`, `htop`, `git`, `cowsay`) |
| `sudo ufw` | `sudo ufw [enable\|disable\|allow\|deny\|status]` | Manage uncomplicated firewall rules |
| `ssh` | `ssh <user@host>` | Connect to simulated remote production node (`10.0.0.5`) |
| `scp` | `scp <src> <dest>` | Secure copy files between local and remote hosts |
| `crontab` | `crontab [-l\|-e]` | Maintain crontab files for scheduled tasks |

---

## 🎯 45-Mission Curriculum Roadmap

### Tier 1: Beginner (Missions 1–5)
1. **Hello Terminal:** Run `whoami`.
2. **Where Am I?:** Check `pwd` and list with `ls`.
3. **Explorer:** Navigate to `/var/log` and inspect files.
4. **Reading Notes:** Display `/home/user/Documents/notes.txt` with `cat`.
5. **Home Sweet Home:** Return to home directory via `cd ~`.

### Tier 2: Intermediate (Missions 6–10)
6. **Making Directories:** Create `~/workspace` using `mkdir`.
7. **Creating Files:** Create `~/workspace/test.txt` using `touch`.
8. **Writing Notes:** Redirect text using `echo "Hello Linux" > test.txt`.
9. **Copying Files:** Copy file with `cp test.txt notes.txt`.
10. **Removing Files:** Remove `~/workspace/notes.txt` using `rm`.

### Tier 3: Advanced (Missions 11–15)
11. **Text Searching:** Search for `ERROR` in `/var/log/syslog` using `grep`.
12. **Counting Lines:** Count total lines in `/var/log/syslog` with `wc -l`.
13. **Inspecting Log Head:** Read first 5 lines of `/var/log/syslog` with `head -n 5`.
14. **Piping & Redirection:** Extract `WARN` lines to `~/warnings.txt` with `grep \| cat >`.
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
26. **Vim Mastery:** Open `~/Documents/notes.txt` in `vim`, append text, and `:wq`.
27. **Git Initialization & First Commit:** Initialize Git in `~/projects`, stage, and commit.
28. **Git Branching:** Create and switch to branch `feature/login` with `git checkout -b`.
29. **Clone & Inspect:** Clone `https://git.linuxsim.local/devops/webapp.git` into `~/webapp`.
30. **Docker Deployment:** Run detached `nginx` container named `web-proxy` on port `8080:80`.
31. **User Provisioning:** Create a new user named `devops` with home dir via `sudo useradd -m devops`.
32. **Firewall Hardening:** Enable `ufw`, allow SSH (22), allow HTTP (80), and deny Telnet (23).
33. **Remote SCP Transfer:** Copy `admin@10.0.0.5:/home/admin/flag.txt` into `~/flag.txt` with `scp`.
34. **Cron Automation:** Schedule a job in `/etc/crontab` and ensure `cron` service is running.
35. **Full DevOps Pipeline:** Clone webapp, archive backup with `tar`, start `nginx`, and output verification.

### Tier 6: Architect & CTF (Missions 36–45) (Phase 4)
36. **Terminal Multiplexing:** Split the terminal window into multiple panes using `tmux` or `tmux split-window -h`.
37. **Background Job Control:** Run `sleep 10 &`, inspect it with `jobs`, and bring to foreground with `fg`.
38. **DNS Resolution & Hosts:** Add custom host `192.168.1.100 internal.corp` to `/etc/hosts` and query with `dig internal.corp`.
39. **Cryptographic Integrity:** Generate SHA-256 hash of `/etc/passwd` and save to `~/passwd.sha256`.
40. **SSH Keypair Infrastructure:** Generate a keypair with `ssh-keygen -t rsa` and install it via `ssh-copy-id admin@10.0.0.5`.
41. **CTF: Secret Flag Decryption:** Decode the secret flag in `/var/secret_flag.b64` using `base64 -d` to `~/decoded_flag.txt`.
42. **Embedded Node.js Engine:** Run `node -e` or a script with bridged `fs` to write `{"status":"ok"}` to `~/node_output.json`.
43. **Embedded Python Data Pipeline:** Run Python 3 via `python3 -c` or script to write `"PYTHON_PIPELINE_OK"` to `~/py_output.txt`.
44. **Relational Database SQL Queries:** Execute `sqlite3 /var/lib/app.db "SELECT * FROM employees"` and export to `~/db_report.txt`.
45. **Break-Fix Incident Resolution:** Open the Incidents modal from the Top Bar, resolve an outage, and verify in the incident console.

---

## 💻 Tech Stack & Architecture

- **UI Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS + Lucide React icons
- **Virtual File System (VFS):** In-memory tree with path normalization, symlink resolution, permissions matrix, relational database stubs, and `localStorage` debounced persistence.
- **Shell Engine:** Lexer, Parser, Pipeline executor, Environment variable expansion, Script runner, Command Registry, Multiplexing engine.
- **Embedded Engines:** JavaScript/Node sandbox with bridged `fs`, Python interpreter mapping with file I/O, SQLite SQL parser and table renderer.
- **Architecture Highlights:** 100% Client-Side, Zero External APIs, Zero Tracking, Zero Telemetry.
