import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

// ==================== SQLITE ENGINE ====================
interface SQLiteTable {
  columns: string[];
  rows: Record<string, any>[];
}

interface SQLiteDB {
  tables: Record<string, SQLiteTable>;
}

function loadDB(dbPath: string, vfs: VirtualFileSystem): SQLiteDB {
  const node = vfs.getNode(dbPath, true);
  if (node && node.content) {
    try {
      const parsed = JSON.parse(node.content);
      if (parsed.tables) return parsed;
    } catch {
      // ignore
    }
  }
  return { tables: {} };
}

function saveDB(dbPath: string, db: SQLiteDB, vfs: VirtualFileSystem) {
  vfs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

function executeSQLQuery(
  sql: string,
  db: SQLiteDB,
  headersOn: boolean = true,
  mode: 'column' | 'csv' | 'list' = 'column'
): { output: string; error?: string } {
  const trimmed = sql.trim().replace(/;$/, '');
  if (!trimmed) return { output: '' };

  // Dot commands
  if (trimmed === '.tables') {
    const tableNames = Object.keys(db.tables);
    return { output: tableNames.join('  ') };
  }

  if (trimmed.startsWith('.schema')) {
    const parts = trimmed.split(/\s+/);
    const targetTable = parts[1];
    let schemas: string[] = [];
    for (const [tName, table] of Object.entries(db.tables)) {
      if (!targetTable || targetTable === tName) {
        schemas.push(`CREATE TABLE ${tName} (${table.columns.join(', ')});`);
      }
    }
    return { output: schemas.join('\n') };
  }

  // CREATE TABLE
  const createMatch = trimmed.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z0-9_]+)\s*\((.*)\)/i);
  if (createMatch) {
    const tableName = createMatch[1];
    const colDefs = createMatch[2].split(',').map(c => {
      const parts = c.trim().split(/\s+/);
      return parts[0];
    });
    if (!db.tables[tableName]) {
      db.tables[tableName] = { columns: colDefs, rows: [] };
    }
    return { output: '' };
  }

  // DROP TABLE
  const dropMatch = trimmed.match(/^DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+([A-Za-z0-9_]+)/i);
  if (dropMatch) {
    const tableName = dropMatch[1];
    delete db.tables[tableName];
    return { output: '' };
  }

  // INSERT INTO
  const insertMatch = trimmed.match(/^INSERT\s+INTO\s+([A-Za-z0-9_]+)(?:\s*\((.*?)\))?\s*VALUES\s*\((.*)\)/i);
  if (insertMatch) {
    const tableName = insertMatch[1];
    const table = db.tables[tableName];
    if (!table) {
      return { output: '', error: `Error: no such table: ${tableName}` };
    }

    const explicitCols = insertMatch[2] ? insertMatch[2].split(',').map(c => c.trim()) : table.columns;
    const rawVals = insertMatch[3].split(',').map(v => {
      const t = v.trim().replace(/^['"]|['"]$/g, '');
      const num = Number(t);
      return !isNaN(num) && t !== '' ? num : t;
    });

    const newRow: Record<string, any> = {};
    explicitCols.forEach((col, idx) => {
      newRow[col] = rawVals[idx] !== undefined ? rawVals[idx] : null;
    });
    table.rows.push(newRow);
    return { output: '' };
  }

  // SELECT
  const selectMatch = trimmed.match(/^SELECT\s+(.*?)\s+FROM\s+([A-Za-z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/i);
  if (selectMatch) {
    const colSelect = selectMatch[1].trim();
    const tableName = selectMatch[2].trim();
    const whereClause = selectMatch[3]?.trim();
    const orderClause = selectMatch[4]?.trim();
    const limitClause = selectMatch[5]?.trim();

    const table = db.tables[tableName];
    if (!table) {
      return { output: '', error: `Error: no such table: ${tableName}` };
    }

    let rows = [...table.rows];

    // Simple WHERE filtering: col = 'val' or col > val
    if (whereClause) {
      const opMatch = whereClause.match(/^([A-Za-z0-9_]+)\s*(=|!=|>|<|LIKE)\s*(.*)$/i);
      if (opMatch) {
        const col = opMatch[1];
        const op = opMatch[2].toUpperCase();
        const val = opMatch[3].trim().replace(/^['"]|['"]$/g, '');
        rows = rows.filter(r => {
          const rowVal = String(r[col] ?? '');
          if (op === '=') return rowVal.toLowerCase() === val.toLowerCase();
          if (op === '!=') return rowVal.toLowerCase() !== val.toLowerCase();
          if (op === '>') return Number(r[col]) > Number(val);
          if (op === '<') return Number(r[col]) < Number(val);
          if (op === 'LIKE') return rowVal.toLowerCase().includes(val.replace(/%/g, '').toLowerCase());
          return true;
        });
      }
    }

    // ORDER BY
    if (orderClause) {
      const [orderCol, dir = 'ASC'] = orderClause.split(/\s+/);
      const isDesc = dir.toUpperCase() === 'DESC';
      rows.sort((a, b) => {
        const valA = a[orderCol];
        const valB = b[orderCol];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return isDesc ? valB - valA : valA - valB;
        }
        return isDesc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
      });
    }

    // LIMIT
    if (limitClause) {
      const limit = parseInt(limitClause, 10);
      if (!isNaN(limit)) rows = rows.slice(0, limit);
    }

    // Determine projected columns
    const cols = colSelect === '*' ? table.columns : colSelect.split(',').map(c => c.trim());

    if (rows.length === 0) {
      return { output: '' };
    }

    // Format output
    if (mode === 'csv') {
      let out = headersOn ? cols.join(',') + '\n' : '';
      for (const r of rows) {
        out += cols.map(c => r[c] !== undefined ? String(r[c]) : '').join(',') + '\n';
      }
      return { output: out.trimEnd() };
    }

    // Column table mode (classic sqlite3)
    const colWidths: Record<string, number> = {};
    for (const c of cols) {
      colWidths[c] = Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length));
    }

    let out = '';
    if (headersOn) {
      out += cols.map(c => c.padEnd(colWidths[c])).join(' | ') + '\n';
      out += cols.map(c => '-'.repeat(colWidths[c])).join('-+-') + '\n';
    }
    for (const r of rows) {
      out += cols.map(c => String(r[c] ?? '').padEnd(colWidths[c])).join(' | ') + '\n';
    }

    return { output: out.trimEnd() };
  }

  // UPDATE
  const updateMatch = trimmed.match(/^UPDATE\s+([A-Za-z0-9_]+)\s+SET\s+(.*?)(?:\s+WHERE\s+(.*))?$/i);
  if (updateMatch) {
    const tableName = updateMatch[1];
    const setClause = updateMatch[2];
    const whereClause = updateMatch[3];
    const table = db.tables[tableName];
    if (!table) return { output: '', error: `Error: no such table: ${tableName}` };

    const setPairs = setClause.split(',').map(s => {
      const [k, v] = s.split('=').map(x => x.trim().replace(/^['"]|['"]$/g, ''));
      return { col: k, val: !isNaN(Number(v)) && v !== '' ? Number(v) : v };
    });

    for (const row of table.rows) {
      let match = true;
      if (whereClause) {
        const [wCol, wVal] = whereClause.split('=').map(x => x.trim().replace(/^['"]|['"]$/g, ''));
        if (String(row[wCol]) !== String(wVal)) match = false;
      }
      if (match) {
        for (const pair of setPairs) {
          row[pair.col] = pair.val;
        }
      }
    }
    return { output: '' };
  }

  // DELETE
  const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+([A-Za-z0-9_]+)(?:\s+WHERE\s+(.*))?$/i);
  if (deleteMatch) {
    const tableName = deleteMatch[1];
    const whereClause = deleteMatch[2];
    const table = db.tables[tableName];
    if (!table) return { output: '', error: `Error: no such table: ${tableName}` };

    if (!whereClause) {
      table.rows = [];
    } else {
      const [wCol, wVal] = whereClause.split('=').map(x => x.trim().replace(/^['"]|['"]$/g, ''));
      table.rows = table.rows.filter(r => String(r[wCol]) !== String(wVal));
    }
    return { output: '' };
  }

  return { output: '', error: `Error: near "${trimmed.slice(0, 15)}": syntax error` };
}

// ==================== PYTHON INTERPRETER ====================
function runPythonCode(code: string, shellState: ShellState, vfs: VirtualFileSystem): { stdout: string; stderr: string; exitCode: number } {
  const outputs: string[] = [];
  const errors: string[] = [];

  // Python simulated execution environment
  const pythonContext: Record<string, any> = {
    print: (...args: any[]) => {
      outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    },
    len: (obj: any) => obj ? (obj.length !== undefined ? obj.length : Object.keys(obj).length) : 0,
    range: (start: number, stop?: number, step: number = 1) => {
      const from = stop === undefined ? 0 : start;
      const to = stop === undefined ? start : stop;
      const res: number[] = [];
      for (let i = from; i < to; i += step) res.push(i);
      return res;
    },
    int: (x: any) => parseInt(x, 10),
    float: (x: any) => parseFloat(x),
    str: (x: any) => String(x),
    bool: (x: any) => Boolean(x),
    open: (filePath: string, _mode: string = 'r') => {
      const fullPath = resolve(filePath, shellState);
      return {
        read: () => {
          const node = vfs.getNode(fullPath, true);
          if (!node || node.type !== 'file') throw new Error(`FileNotFoundError: [Errno 2] No such file: '${filePath}'`);
          return node.content ?? '';
        },
        write: (data: string) => {
          vfs.writeFile(fullPath, String(data));
          return String(data).length;
        },
        close: () => {},
      };
    },
    os: {
      environ: { ...shellState.env },
      getcwd: () => shellState.cwd,
      listdir: (p: string = '.') => {
        const fullPath = resolve(p, shellState);
        const node = vfs.getNode(fullPath, false);
        return node?.children ? Array.from(node.children.keys()) : [];
      },
    },
    sys: {
      argv: ['script.py'],
      exit: (code: number = 0) => { throw new Error(`__EXIT_${code}__`); },
    },
    math: Math,
    json: JSON,
  };

  try {
    // Transform simple Python constructs to JS for execution
    let transformed = code
      // comments
      .replace(/#.*$/gm, '')
      // True / False / None
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      // def func(args):
      .replace(/def\s+([A-Za-z0-9_]+)\s*\((.*?)\):/g, 'function $1($2) {')
      // elif condition:
      .replace(/elif\s+(.*?):/g, '} else if ($1) {')
      // if condition:
      .replace(/if\s+(.*?):/g, 'if ($1) {')
      // else:
      .replace(/else\s*:/g, '} else {')
      // for item in iterable:
      .replace(/for\s+([A-Za-z0-9_]+)\s+in\s+(.*?):/g, 'for (let $1 of $2) {')
      // with open(f, m) as var:
      .replace(/with\s+open\((.*?)\)\s+as\s+([A-Za-z0-9_]+):/g, '{ const $2 = open($1);');

    // Automatically append closing braces based on indentation or execution
    const keys = Object.keys(pythonContext);
    const values = Object.values(pythonContext);

    // If pure Python statements, execute directly with Function wrapper
    const fn = new Function(...keys, `
      try {
        ${transformed}
      } catch (e) {
        if (e.message && e.message.startsWith('__EXIT_')) {
          return;
        }
        throw e;
      }
    `);

    fn(...values);
    return { stdout: outputs.join('\n'), stderr: errors.join('\n'), exitCode: 0 };
  } catch (err: any) {
    if (err.message && err.message.startsWith('__EXIT_')) {
      const code = parseInt(err.message.replace(/[^0-9]/g, ''), 10) || 0;
      return { stdout: outputs.join('\n'), stderr: '', exitCode: code };
    }
    return {
      stdout: outputs.join('\n'),
      stderr: `Traceback (most recent call last):\n  File "<string>", line 1\n${err.message || String(err)}`,
      exitCode: 1,
    };
  }
}

// ==================== NODE.JS RUNTIME ====================
function runNodeCode(code: string, shellState: ShellState, vfs: VirtualFileSystem): { stdout: string; stderr: string; exitCode: number } {
  const outputs: string[] = [];
  const errors: string[] = [];

  const bridgedFs = {
    readFileSync: (filePath: string, _encoding?: string) => {
      const fullPath = resolve(filePath, shellState);
      const node = vfs.getNode(fullPath, true);
      if (!node || node.type !== 'file') {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      return node.content ?? '';
    },
    writeFileSync: (filePath: string, data: any) => {
      const fullPath = resolve(filePath, shellState);
      vfs.writeFile(fullPath, String(data));
    },
    existsSync: (filePath: string) => {
      const fullPath = resolve(filePath, shellState);
      return vfs.getNode(fullPath, false) !== null;
    },
    readdirSync: (dirPath: string) => {
      const fullPath = resolve(dirPath, shellState);
      const node = vfs.getNode(fullPath, false);
      return node?.children ? Array.from(node.children.keys()) : [];
    },
  };

  const bridgedProcess = {
    env: { ...shellState.env },
    argv: ['node', 'script.js'],
    cwd: () => shellState.cwd,
    exit: (code: number = 0) => { throw new Error(`__EXIT_${code}__`); },
  };

  const bridgedConsole = {
    log: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    info: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    warn: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    error: (...args: any[]) => errors.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
  };

  try {
    const fn = new Function('fs', 'process', 'console', 'require', `
      const localRequire = (mod) => {
        if (mod === 'fs') return fs;
        if (mod === 'path') return {
          join: (...p) => p.join('/').replace(/\\/\\/+/g, '/'),
          resolve: (...p) => p.join('/').replace(/\\/\\/+/g, '/'),
          basename: (p) => p.split('/').pop() || '',
        };
        if (mod === 'os') return { platform: () => 'linux', homedir: () => '/home/user' };
        return {};
      };
      ${code}
    `);

    fn(bridgedFs, bridgedProcess, bridgedConsole, (mod: string) => {
      if (mod === 'fs') return bridgedFs;
      return {};
    });

    return { stdout: outputs.join('\n'), stderr: errors.join('\n'), exitCode: 0 };
  } catch (err: any) {
    if (err.message && err.message.startsWith('__EXIT_')) {
      const code = parseInt(err.message.replace(/[^0-9]/g, ''), 10) || 0;
      return { stdout: outputs.join('\n'), stderr: errors.join('\n'), exitCode: code };
    }
    return {
      stdout: outputs.join('\n'),
      stderr: err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : String(err),
      exitCode: 1,
    };
  }
}

// ==================== REGISTER COMMANDS ====================

export function registerRuntimeCommands() {
  // --- node ---
  registry.register({
    name: 'node',
    description: 'Server-side JavaScript environment',
    usage: 'node [-e "<code>"] [<file.js>]',
    flags: [{ flag: '-e', description: 'Evaluate inline script' }],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return {
          stdout: `Welcome to Node.js v20.11.0.\nType ".help" for more information.\n(Use "node -e 'code'" or "node <file.js>" in LinuxSim)`,
          stderr: '',
          exitCode: 0,
        };
      }

      if (args[0] === '-e' || args[0] === '--eval') {
        const code = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
        return runNodeCode(code, shellState, vfs);
      }

      const filePath = resolve(args[0], shellState);
      const node = vfs.getNode(filePath, true);
      if (!node || node.type !== 'file') {
        return { stdout: '', stderr: `node: cannot find module '${args[0]}'`, exitCode: 1 };
      }

      return runNodeCode(node.content ?? '', shellState, vfs);
    },
  });

  // --- python3 and python ---
  const pythonHandler = (args: string[], _flags: any, shellState: ShellState, vfs: VirtualFileSystem): CommandResult => {
    if (args.length === 0) {
      return {
        stdout: `Python 3.10.12 (main, Nov 20 2026, 12:00:00) [GCC 11.4.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n(Use "python3 -c 'code'" or "python3 <file.py>" in LinuxSim)`,
        stderr: '',
        exitCode: 0,
      };
    }

    if (args[0] === '-c') {
      const code = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
      return runPythonCode(code, shellState, vfs);
    }

    const filePath = resolve(args[0], shellState);
    const node = vfs.getNode(filePath, true);
    if (!node || node.type !== 'file') {
      return { stdout: '', stderr: `python3: can't open file '${args[0]}': [Errno 2] No such file or directory`, exitCode: 2 };
    }

    return runPythonCode(node.content ?? '', shellState, vfs);
  };

  registry.register({
    name: 'python3',
    description: 'An interpreted, interactive, object-oriented programming language',
    usage: 'python3 [-c "<code>"] [<file.py>]',
    flags: [{ flag: '-c', description: 'Program passed in as string' }],
    handler: pythonHandler,
  });

  registry.register({
    name: 'python',
    description: 'Python 3 interpreter alias',
    usage: 'python [-c "<code>"] [<file.py>]',
    flags: [{ flag: '-c', description: 'Program passed in as string' }],
    handler: pythonHandler,
  });

  // --- sqlite3 ---
  registry.register({
    name: 'sqlite3',
    description: 'A command line interface for SQLite',
    usage: 'sqlite3 <database_file> ["<sql_query>"]',
    flags: [],
    handler: (args, _flags, shellState, vfs, stdin): CommandResult => {
      if (args.length === 0) {
        return {
          stdout: `SQLite version 3.37.2 2022-01-06 13:25:41\nEnter ".help" for usage hints.\nUsage: sqlite3 <db_file> "<query>"`,
          stderr: '',
          exitCode: 0,
        };
      }

      const dbPath = resolve(args[0], shellState);
      const db = loadDB(dbPath, vfs);

      const queriesToRun: string[] = [];
      if (stdin) {
        queriesToRun.push(...stdin.split(';').map(s => s.trim()).filter(Boolean));
      }
      if (args.length > 1) {
        const fullArgSql = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
        queriesToRun.push(...fullArgSql.split(';').map(s => s.trim()).filter(Boolean));
      }

      if (queriesToRun.length === 0) {
        return {
          stdout: `SQLite version 3.37.2\nConnected to ${args[0]} (use sqlite3 ${args[0]} "<SQL>")`,
          stderr: '',
          exitCode: 0,
        };
      }

      const outputs: string[] = [];
      for (const q of queriesToRun) {
        const res = executeSQLQuery(q, db);
        if (res.error) {
          saveDB(dbPath, db, vfs);
          return { stdout: outputs.join('\n'), stderr: res.error, exitCode: 1 };
        }
        if (res.output) outputs.push(res.output);
      }

      saveDB(dbPath, db, vfs);
      return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
    },
  });
}
