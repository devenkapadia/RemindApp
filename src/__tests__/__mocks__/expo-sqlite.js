// In-memory SQLite mock — supports the expo-sqlite async API used in db.js

const tables = {};
const sequences = {};

function getTable(name) {
  if (!tables[name]) tables[name] = [];
  return tables[name];
}

function nextId(name) {
  sequences[name] = (sequences[name] || 0) + 1;
  return sequences[name];
}

function runQuery(sql, params = []) {
  const s = sql.trim().replace(/\s+/g, ' ');

  // PRAGMA table_info(tableName)
  const pragmaMatch = s.match(/PRAGMA table_info\((\w+)\)/i);
  if (pragmaMatch) {
    const rows = getTable(pragmaMatch[1]);
    if (!rows.length) return [];
    return Object.keys(rows[0]).map((name, cid) => ({ cid, name }));
  }

  // PRAGMA foreign_keys
  if (/^PRAGMA foreign_keys/i.test(s)) return [];

  // CREATE TABLE / INDEX — no-op
  if (/^CREATE (TABLE|INDEX|UNIQUE)/i.test(s)) return { lastInsertRowId: 0, changes: 0 };

  // ALTER TABLE t ADD COLUMN col ...
  const alterMatch = s.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
  if (alterMatch) {
    getTable(alterMatch[1]).forEach(row => { if (!(alterMatch[2] in row)) row[alterMatch[2]] = null; });
    return { lastInsertRowId: 0, changes: 0 };
  }

  // INSERT INTO table (cols) VALUES (?, ...) or VALUES (?, ?, 'literal')
  const insertMatch = s.match(/^INSERT(?:\s+OR\s+\w+)?\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)/i);
  if (insertMatch) {
    const tbl = insertMatch[1];
    const cols = insertMatch[2].split(',').map(c => c.trim());
    // Parse value tokens: ? → next param, 'literal' → string literal, number → number
    const valueTokens = insertMatch[3].split(',').map(t => t.trim());
    let paramIdx = 0;
    const row = { id: nextId(tbl) };
    cols.forEach((col, i) => {
      const token = valueTokens[i] ?? '?';
      if (token === '?') {
        row[col] = params[paramIdx++] !== undefined ? params[paramIdx - 1] : null;
      } else if (/^'(.*)'$/.test(token)) {
        row[col] = token.slice(1, -1); // strip quotes
      } else if (!isNaN(Number(token))) {
        row[col] = Number(token);
      } else {
        row[col] = token;
      }
    });
    getTable(tbl).push(row);
    return { lastInsertRowId: row.id, changes: 1 };
  }

  // SELECT — handle the queries db.js actually issues
  if (/^SELECT/i.test(s)) {
    // Determine base table (handle aliases: "FROM tasks t" or "FROM tasks")
    const fromMatch = s.match(/FROM\s+(\w+)(?:\s+\w+)?/i);
    if (!fromMatch) return [];
    const tbl = fromMatch[1];
    let rows = getTable(tbl).map(r => ({ ...r }));

    // Apply simple WHERE col = ? (last param or first param)
    // Handle both "WHERE id = ?" and "WHERE t.id = ?" and "WHERE gm.user_id = ?"
    const whereMatches = [...s.matchAll(/WHERE\s+(?:\w+\.)?(\w+)\s*=\s*\?/gi)];
    if (whereMatches.length > 0) {
      whereMatches.forEach((m, i) => {
        const col = m[1];
        const val = params[i];
        rows = rows.filter(r => String(r[col]) === String(val));
      });
    }

    // AND conditions like "AND status = ?"
    const andMatches = [...s.matchAll(/AND\s+(?:\w+\.)?(\w+)\s*=\s*\?/gi)];
    andMatches.forEach((m, i) => {
      const col = m[1];
      const val = params[whereMatches.length + i];
      if (val !== undefined) rows = rows.filter(r => String(r[col]) === String(val));
    });

    // AND col IS NULL
    const isNullMatches = [...s.matchAll(/AND\s+(?:\w+\.)?(\w+)\s+IS\s+NULL/gi)];
    isNullMatches.forEach(m => {
      rows = rows.filter(r => r[m[1]] === null || r[m[1]] === undefined);
    });

    // LEFT JOIN users u ON t.assigned_to = u.id
    if (/LEFT JOIN users/i.test(s)) {
      const userRows = getTable('users');
      rows = rows.map(r => {
        const assignee = userRows.find(u => u.id === r.assigned_to) || {};
        return {
          ...r,
          assigned_to_username: assignee.username || null,
          assigned_to_display_name: assignee.display_name || null,
        };
      });
    }

    // JOIN group_members + JOIN users → getGroupMembers(groupId)
    // Query: SELECT gm.*, u.username, u.display_name FROM group_members gm JOIN users u ON ... WHERE gm.group_id = ?
    if (/JOIN group_members/i.test(s) && /JOIN users/i.test(s)) {
      const gmRows = getTable('group_members');
      const userRows = getTable('users');
      const groupId = params[0];
      rows = gmRows
        .filter(m => String(m.group_id) === String(groupId))
        .map(gm => {
          const u = userRows.find(u => u.id === gm.user_id) || {};
          return { ...gm, username: u.username || null, display_name: u.display_name || null };
        });
      return rows;
    }

    // JOIN group_members (no users) → getUserTaskGroups(userId)
    // Query: SELECT tg.*, gm.role FROM task_groups tg JOIN group_members gm ON ... WHERE gm.user_id = ?
    if (/JOIN group_members/i.test(s) && !/JOIN users/i.test(s)) {
      const gmRows = getTable('group_members');
      const tgRows = getTable('task_groups');
      const userId = params[0];
      rows = gmRows
        .filter(m => String(m.user_id) === String(userId))
        .map(gm => {
          const tg = tgRows.find(g => g.id === gm.group_id) || {};
          return { ...tg, role: gm.role };
        })
        .filter(r => r.id);
      return rows;
    }

    return rows;
  }

  // UPDATE table SET f=?,... WHERE id=?
  const updateMatch = s.match(/^UPDATE\s+(\w+)\s+SET\s+(.+)\s+WHERE/i);
  if (updateMatch) {
    const tbl = updateMatch[1];
    const setStr = updateMatch[2];
    const setCols = [...setStr.matchAll(/(\w+)\s*=\s*\?/g)].map(m => m[1]);
    const idVal = params[params.length - 1];
    getTable(tbl).forEach(row => {
      if (String(row.id) === String(idVal)) {
        setCols.forEach((col, i) => { row[col] = params[i]; });
      }
    });
    return { lastInsertRowId: 0, changes: 1 };
  }

  // DELETE FROM table WHERE col = ?
  const deleteMatch = s.match(/^DELETE FROM\s+(\w+)\s+WHERE\s+(?:\w+\.)?(\w+)\s*=\s*\?(?:\s+AND\s+(?:\w+\.)?(\w+)\s*=\s*\?)?/i);
  if (deleteMatch) {
    const tbl = deleteMatch[1];
    const col1 = deleteMatch[2];
    const col2 = deleteMatch[3];
    tables[tbl] = getTable(tbl).filter(r => {
      if (col2) return !(String(r[col1]) === String(params[0]) && String(r[col2]) === String(params[1]));
      return String(r[col1]) !== String(params[0]);
    });
    return { lastInsertRowId: 0, changes: 1 };
  }

  return { lastInsertRowId: 0, changes: 0 };
}

const mockDb = {
  execAsync: jest.fn(async (sql) => {
    // Split on semicolons but handle multi-line blocks
    sql.split(';').forEach(stmt => { const t = stmt.trim(); if (t) runQuery(t); });
  }),
  runAsync: jest.fn(async (sql, params = []) => runQuery(sql, params)),
  getFirstAsync: jest.fn(async (sql, params = []) => {
    const result = runQuery(sql, params);
    return Array.isArray(result) ? (result[0] || null) : null;
  }),
  getAllAsync: jest.fn(async (sql, params = []) => {
    const result = runQuery(sql, params);
    return Array.isArray(result) ? result : [];
  }),
  _reset() {
    Object.keys(tables).forEach(k => delete tables[k]);
    Object.keys(sequences).forEach(k => delete sequences[k]);
  },
};

const openDatabaseAsync = jest.fn(async () => mockDb);

module.exports = { openDatabaseAsync, mockDb };
