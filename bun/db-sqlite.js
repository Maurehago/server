// ==============================
//  SQLite  Datenbank Teiber
//  für Bun Server
// ===============================
// @ts-check

import { Database } from "bun:sqlite";

/** @typedef {Array<string|number|bigint|boolean|Uint8Array<ArrayBufferLike>>} DataRow */
/** @typedef {Array<DataRow>} DataRows */

const tableNameRegex = /^(?!sqlite_)[a-z_][a-z0-9_]*$/;


export class SQLiteDriver {
    constructor(dbPath = "app.db") {
        this.db = new Database(dbPath);
        this._initTables();
    }

    _initTables() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS users (gsid TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT);
      CREATE TABLE IF NOT EXISTS passkeys (gsid TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL, counter INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS records (gsid TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT);
      CREATE TABLE IF NOT EXISTS audit_log (gsid TEXT PRIMARY KEY, table_name TEXT, row_id TEXT, action TEXT, changed_fields TEXT, changed_by TEXT, changed_at TEXT);
    `);
    }

    // --- NATIVE AUTH-METHODEN (Bleiben wie im Interface definiert) ---
    /**
     * Liefert einen Benutzer Datensatz zurück 
     * @param {string} username - Benutzername nach dem gesucht wird
     * @returns {Promise<DataRows>} Benutzer
     */
    async getUserByUsername(username) { 
        const q = this.db.query("SELECT * FROM users WHERE username = ?");
        return [q.columnNames, ...q.values(username)]; 
    }

    /**
     * Fügt einen neuen Benutzer in die Datenbank ein
     * @param {string} gsid - Eindeutige ID
     * @param {string} username - Benutzername
     * @param {string} passwordHash - gehashtes Passwort
     */
    async createUser(gsid, username, passwordHash) { 
        this.db.query("INSERT OR IGNORE INTO users (gsid, username, password_hash) VALUES (?, ?, ?)").run(gsid, username, passwordHash); 
    }
    
    
    // Passkey noch nicht implementieren
    // async savePasskey(id, userId, publicKey, counter) { this.db.query("INSERT INTO passkeys (id, user_id, public_key, counter) VALUES (?, ?, ?, ?)").run(id, userId, publicKey, counter); }
    // async getPasskeysByUsername(username) { return this.db.query("SELECT p.* FROM passkeys p JOIN users u ON p.user_id = u.id WHERE u.username = ?").all(username); }
    // async getPasskeyById(id) { return this.db.query("SELECT * FROM passkeys WHERE id = ?").get(id); }
    // async updatePasskeyCounter(id, newCounter) { this.db.query("UPDATE passkeys SET counter = ? WHERE id = ?").run(newCounter, id); }

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
     * Liest aus einer Tabelle Datensätze mit flexiblen Filtern und Sortierung.
     * 
     * @param {string} tableName - Name der Tabelle
     * @param {string|Array<string>|null} [selector] - "*", "ALL", {GSID}, Liste mit GSIDs oder null
     * @param {string} [whereClause] - Optionale zusätzliche WHERE-Bedingung (z.B. "username = ? AND status = ?")
     * @param {Array<any>} [whereParams] - Parameter-Werte für die Fragezeichen in der whereClause
     * @param {string} [orderBy] - Optionale Sortierung (z.B. "changed_at DESC")
     * @returns {Promise<DataRows>} [Spaltennamen, ...Datenzeilen]
     */
    async getRows(tableName, selector = "*", whereClause = "", whereParams = [], orderBy = "") {
        // Check gegen SQL-Injection bei Tabellennamen
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");

        // Spaltennamen vorab ermitteln todo: Notwendig ????
        const qColumns = this.db.query(`SELECT * FROM ${tableName} WHERE 0`);
        const columnNames = qColumns.columnNames;

        let baseSql = `SELECT * FROM ${tableName}`;
        let conditions = [];
        let queryParams = [];

        // 1. Selector auswerten (GSID-Logik)
        if (selector && selector !== "*" && selector !== "ALL") {
            if (Array.isArray(selector)) {
                if (selector.length === 0) return [columnNames]; // Leere ID-Liste -> Keine Daten
                const placeholders = selector.map(() => "?").join(",");
                conditions.push(`gsid IN (${placeholders})`);
                queryParams.push(...selector);
            } else {
                conditions.push(`gsid = ?`);
                queryParams.push(selector);
            }
        }

        // 2. Eigene Where-Bedingung anhängen
        if (whereClause) {
            conditions.push(`(${whereClause})`);
            if (Array.isArray(whereParams)) {
                queryParams.push(...whereParams);
            }
        }

        // WHERE-Statements im SQL zusammenführen
        if (conditions.length > 0) {
            baseSql += ` WHERE ${conditions.join(" AND ")}`;
        }

        // 3. Sortierung anhängen (Sicherheits-Check gegen SQL-Injection bei Spaltennamen)
        if (orderBy) {
            if (!/^[a-zA-Z0-9_\s,]+$/.test(orderBy)) {
                throw new Error("Invalid ORDER BY clause!");
            }
            baseSql += ` ORDER BY ${orderBy}`;
        }

        // Query vorbereiten und mit gesammelten Parametern ausführen
        const q = this.db.query(baseSql);
        return [columnNames, ...q.values(...queryParams)];
    }

// // Beispiel 1: Alle Datensätze sortiert nach Datum
// const auditLogs = await driver.getRows("audit_log", "ALL", "", [], "changed_at DESC");

// // Beispiel 2: Nur bestimmte IDs, die zusätzlich von "Admin" geändert wurden
// const specificLogs = await driver.getRows(
//     "audit_log", 
//     ["id-1", "id-2"],        // selector
//     "changed_by = ?",        // custom whereClause
//     ["Admin"]                // whereParams
// );

// // Beispiel 3: Kein Selector (null/*), aber eine komplett eigene WHERE-Bedingung mit Sortierung
// const users = await driver.getRows(
//     "users",
//     null,                    // Selector ignorieren
//     "username LIKE ? AND password_hash IS NOT NULL", // custom whereClause
//     ["%jan%"],               // whereParams
//     "username ASC"           // orderBy
// );


    /**
     * Updatet einen oder Mehrere Datensätze mit einer Liste mit der ID und den geänderten Feldern.  
     * In der 1. Zeile stehen die Feldnamen
     * @param {string} tableName - Name der Tabelle
     * @param {DataRows} rows - Datenzeilen. 1. Zeile enthält Feldnamen. Nur geänderte Spalten und die ID Spalte müssen angegeben werden.
     * @param {string} [conflictKey] - Optional ID-Feldname oder Feldname mit eindeutigem Wert für die Identifikation vom Datensatz
     * @returns {Promise<number>}
     */
    async saveRows(tableName, rows, conflictKey = "gsid") {
        // Check gegen SQL-Injection bei Tabellennamen
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");
        if (!Array.isArray(rows)) { return 0; }

        const headers = rows[0];
        //const dataRows = rows.slice(1);

        // 1. Spalten filtern, die aktualisiert werden sollen (alle außer der ID)
        const updateFields = headers.filter(col => col !== conflictKey);

        // SOFORTIGER ABBRUCH: Wenn nur die ID (oder gar nichts) übergeben wurde
        if (updateFields.length === 0 || rows.length <= 1) {
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
            for (let i = 1; i < allRows.length; i++) { // ab 2. Datenzeile, 1. Zeile enthält Spaltennamen
                const row = allRows[i];
                stmt.run(...row);
            }
            return allRows.length;
        });

        return transaction(rows);
    }
}
