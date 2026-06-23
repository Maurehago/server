// ==============================
//  SQLite  Datenbank Teiber
//  für Bun Server
// ===============================
// @ts-check

import { Database } from "bun:sqlite";


const tableNameRegex = /^(?!sqlite_)[a-z_][a-z0-9_]*$/;


export class SQLiteDriver {
    constructor(dbPath = "app.db") {
        this.db = new Database(dbPath);
        this._initTables();
    }

    _initTables() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT);
      CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL, counter INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT);
      CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, table_name TEXT, row_id TEXT, action TEXT, changed_fields TEXT, changed_by TEXT, changed_at TEXT);
    `);
    }

    // --- NATIVE AUTH-METHODEN (Bleiben wie im Interface definiert) ---
    async getUserByUsername(username) { return this.db.query("SELECT * FROM users WHERE username = ?").get(username).values(); }
    async createUser(id, username, passwordHash) { this.db.query("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)").run(id, username, passwordHash); }
    async savePasskey(id, userId, publicKey, counter) { this.db.query("INSERT INTO passkeys (id, user_id, public_key, counter) VALUES (?, ?, ?, ?)").run(id, userId, publicKey, counter); }
    async getPasskeysByUsername(username) { return this.db.query("SELECT p.* FROM passkeys p JOIN users u ON p.user_id = u.id WHERE u.username = ?").all(username); }
    async getPasskeyById(id) { return this.db.query("SELECT * FROM passkeys WHERE id = ?").get(id); }
    async updatePasskeyCounter(id, newCounter) { this.db.query("UPDATE passkeys SET counter = ? WHERE id = ?").run(newCounter, id); }

    // --- NEU: DYNAMISCHES LADEN VON DATEN ---
    // Unterstützt: Einzelauswahl, ID-Liste oder "ALL"

    /**
     * Liefert alle Spaltennamen in einer Tabelle zurück.
     * @param {string} tableName - Name der Tabelle in Kleinbuchstaben 
     * @returns {Promise<Array<string>>} Namen der Tabellenspalten in der Reihenfolg in der Datentabelle
     */
    async getColumns(tableName) {
        if (!tableNameRegex.test(tableName)) {
            throw new Error("Table not allowed!");
        }

        // Spaltennamen zurückgeben
        return this.db.query(`SELECT * FROM ${tableName} WHERE 0`).columnNames;
    }

    /**
     * Liest aus einer Tabelle Alle Datensätze oder Datensätze mit angegebenen GSID's
     * @param {string} tableName - Name der Tabelle
     * @param {string|Array<string>} [selector] - "*", "ALL", {GSID} oder Liste mit GSID's
     * @returns {Promise<Array<Array<string|number|bigint|boolean|Uint8Array<ArrayBufferLike>>>>}
     */
    async getRows(tableName, selector) {
        // Check gegen SQL-Injection bei Tabellennamen
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");

        if (selector == undefined || selector == "*" || selector === "ALL") {
            const q = this.db.query(`SELECT * FROM ${tableName}`);
            return [q.columnNames, ...q.values()];
        }

        if (Array.isArray(selector)) {
            // Erzeugt z.B. SELECT * FROM table WHERE gsid IN (?, ?, ?)
            const placeholders = selector.map(() => "?").join(",");
            const q = this.db.query(`SELECT * FROM ${tableName} WHERE gsid IN (${placeholders})`);
            return [q.columnNames, ...q.values(...selector)];
        }

        // Standard: Einzelne ID abrufen
        const q = this.db.query(`SELECT * FROM ${tableName} WHERE gsid = ?`);
        return [q.columnNames, ...q.values(selector)];
    }


    /**
     * Updatet einen oder Mehrere Datensätze mit einer Liste mit der ID und den geänderten Feldern.  
     * In der 1. Zeile stehen die Feldnamen
     * @param {string} tableName - Name der Tabelle
     * @param {Array<Array<any>>} rows - Datenzeilen. 1. Zeile enthält Feldnamen. Nur geänderte Spalten und die ID Spalte müssen angegeben werden.
     * @param {string} [conflictKey] - Optional ID-Feldname oder Feldname mit eindeutigem Wert für die Identifikation vom Datensatz
     * @returns {Promise<number>}
     */
    async saveRows(tableName, rows, conflictKey = "gsid") {
        // Check gegen SQL-Injection bei Tabellennamen
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");
        if (!Array.isArray(rows)) { return 0; }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        // 1. Spalten filtern, die aktualisiert werden sollen (alle außer der ID)
        const updateFields = headers.filter(col => col !== conflictKey);

        // SOFORTIGER ABBRUCH: Wenn nur die ID (oder gar nichts) übergeben wurde
        if (updateFields.length === 0 || dataRows.length === 0) {
            return 0; // 0 Zeilen verarbeitet, keine DB-Aktion nötig
        }

        // 2. SQL-Statement generieren (da updateFields > 0, ist DO UPDATE SET immer sicher)
        const columnsStr = headers.join(", ");
        const placeholdersStr = headers.map(() => "?").join(", ");
        const updateStr = updateFields
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(", ");

        const sql = `
    INSERT INTO ${tableName} (${columnsStr}) 
    VALUES (${placeholdersStr})
    ON CONFLICT(${conflictKey}) 
    DO UPDATE SET ${updateStr}
  `;
        // 3. Ausführung in einer schnellen Transaktion
        const stmt = this.db.prepare(sql);
        const transaction = this.db.transaction((allRows) => {
            for (const row of allRows) {
                stmt.run(...row);
            }
            return allRows.length;
        });

        return transaction(dataRows);
    }
}
