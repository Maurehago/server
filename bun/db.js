// ==============================
//   Datenbank Treiber Template
// ==============================
// @ts-check

import { Database } from "bun:sqlite"; // Ausbessern auf Andere Datenbank

// ============================
//   Typen
// ----------

/**
 * Eine einzelne Datenzeile. Kann primitive Werte oder Binärdaten enthalten.
 * @typedef {Array<string | number | bigint | boolean | Uint8Array | null>} DataRow
 */

/**
 * Das universelle, zweidimensionale Tabellenformat für alle Treiber und Schichten.
 * Die ERSTE Zeile (Index 0) enthält IMMER die Spaltennamen (Header).
 * @typedef {Array<DataRow>} DataRows
 */


/**
 * Beschreibt eine registrierte Datenquelle (Datenbank oder Datei-Verzeichnis).
 * Diese Struktur wird in der lokalen config.json persistiert.
 * @typedef {Object} DriverConfig
 * @property {string} id - Eindeutige ID des Treibers innerhalb dieser App (z.B. "lokale_kunden_db")
 * @property {"SQLITE" | "FIREBIRD" | "JSON_FILES" | "HTML_FRAGMENTS"} type - Die technologische Art des Treibers
 * @property {string} name - Menschenlesbarer Anzeigename für das UI-Hauptmenü
 * @property {string} connectionString - Pfad zur Datei (SQLite/JSON) oder Server-Verbindungsdaten (Firebird)
 */

/**
 * Die globale Konfigurationsdatei der Anwendung, abgelegt im Benutzer-Appdata-Ordner.
 * @typedef {Object} ApplicationConfig
 * @property {string} appName - Der Name der App (aus Startparameter oder Default)
 * @property {boolean} isNewSystem - Flag; "true" wenn das System im Zustand "NULL" ist (keine Treiber konfiguriert)
 * @property {Array<DriverConfig>} drivers - Liste aller vom Benutzer eingerichteten Datenquellen
 * @property {string | null} defaultDriverId - Optionaler Standard-Treiber, der beim Start direkt geöffnet wird
 */

/**
 * Repräsentiert eine aktive Bearbeitungssperre eines Datensatzes (Concurrency Management).
 * Existiert rein In-Memory auf dem Server.
 * @typedef {Object} LockData
 * @property {string} lockKey - Zusammengesetzter Key aus `driverId_tableName_recordId`
 * @property {string} driverId - ID des betroffenen Treibers
 * @property {string} tableName - Name der editierten Tabelle
 * @property {string} recordId - Eindeutige ID des Datensatzes (Wert der ID-Spalte)
 * @property {string} username - Name des Benutzers, der den Datensatz aktuell sperrt
 * @property {string} lockTime - Uhrzeit des Sperr-Zeitpunkts (LocaleTimeString)
 */

/**
 * Definiert die Schnittstelle, die JEDER Datenbank- oder Dateitreiber implementieren MUSS.
 * @typedef {Object} DBDriverInterface
 * @property {string} id - Entspricht DriverConfig.id
 * @property {string} type - Entspricht DriverConfig.type
 * @property {(tableName: string) => Promise<DataRows>} getRows - Holt alle Zeilen einer Tabelle inkl. Header
 * @property {(tableName: string, recordId: string, idColName: string) => Promise<DataRows>} getRecord - Holt genau eine Zeile + Header für die Detailansicht
 * @property {(tableName: string, deltaRows: DataRows, idColName: string) => Promise<boolean>} saveRows - Schreibt nur die geänderten Spalten (Delta-Array) in die DB
 * @property {(tableName: string, recordId: string, idColName: string) => Promise<boolean>} deleteRow - Löscht einen spezifischen Datensatz aus der Tabelle
 * @property {(newSchemaJson: string) => Promise<{success: boolean, message: string}>} [migrateSchema] - Optional: Führt Tabellen-Migrationen bei Schema-Updates aus
 */

/**
 * Das einheitliche WebSocket-Nachrichtenformat für die Kommunikation zwischen Client und Server.
 * @typedef {Object} ClientServerMessage
 * @property {"GET_NEXT_COLUMN" | "REQUEST_LOCK" | "RELEASE_LOCK" | "SAVE_DATA" | "DELETE_DATA" | "SAVE_CONFIG"} type - Aktionstyp
 * @property {string} [driverId] - Ziel-Treiber für die Aktion
 * @property {string} [tableName] - Ziel-Tabelle für die Aktion
 * @property {string} [recordId] - Ziel-Datensatz-ID (falls anwendbar)
 * @property {string} [idColName] - Name der Primärschlüssel-Spalte (Standard meist "gsid")
 * @property {string} [targetType] - Für Navigation: Welcher UI-Typ wird erwartet ("MENU" | "TABLE" | "FORM" | "DETAIL" | "WIZARD")
 * @property {string} [payload] - Freitext-Feld für Payloads (z.B. komplettes Config-JSON oder Schema-JSON)
 * @property {DataRows} [rows] - Das Datenpaket (entweder gesamte Tabelle oder Delta-Array bei SAVE)
 */




// ================================
//   Parameter
// -------------

const tableNameRegex = /^(?!sqlite_)[a-z_][a-z0-9_]*$/;


// ============================
//   Klasse
// ----------

export class DBDriver {
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

    /**
     * Stellt die Verbindung bereit (Schnittstellenkompatibilität)
     * @returns {Promise<void>}
     */
    async connect() {
        return Promise.resolve(); 
    }

    /**
     * Schließt die Datenbank
     * @returns {Promise<void>}
     */
    async disconnect() {
        this.db.close();
        return Promise.resolve();
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
     * Liest aus einer Tabelle Alle Datensätze oder Datensätze mit angegebenen GSID's
     * @param {string} tableName - Name der Tabelle
     * @param {string|Array<string>} [selector] - "*", "ALL", {GSID} oder Liste mit GSID's
     * @returns {Promise<DataRows>}
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
     * @param {DataRows} rows - Datenzeilen. 1. Zeile enthält Feldnamen. Nur geänderte Spalten und die ID Spalte müssen angegeben werden.
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
