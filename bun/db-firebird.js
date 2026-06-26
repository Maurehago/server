//@ts-ignore
import Firebird from 'node-firebird';

const tableNameRegex = /^[a-zA-Z0-9_]+$/;

export class FirebirdDriver {
    /**
     * 
     * @param {Object<string,any>} options 
     */
    constructor(options = {}) {
        this.options = {
            host: options.host || '127.0.0.1',
            port: options.port || 3050,
            database: options.database || 'app.fdb',
            user: options.user || 'SYSDBA',
            password: options.password || 'masterkey',
        };
        this.db = null;
    }

    /**
     * Erstellt die Datenbank Verbindung
     * @returns {Promise<void>}
     */
    async connect() {
        return new Promise((resolve, reject) => {
            //@ts-ignore
            Firebird.attach(this.options, async (err, db) => {
                if (err) return reject(err);
                this.db = db;
                try {
                    await this._initTables();
                    resolve();
                } catch (initErr) {
                    reject(initErr);
                }
            });
        });
    }

    /**
     * Beendet die Datenbank Verbindung
     * @returns {Promise<void>}
     */
    async disconnect() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.detach();
                this.db = null;
            }
            resolve();
        });
    }

    // Nutzt jetzt db.execute() für direkte Daten-Arrays statt Objekten
    /**
     * Führt SQL Befehl aus
     * @param {string} sql - SQL Anweisung
     * @param {Array<any>} params - SQL Parameter
     * @returns 
     */
    _execute(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Datenbank nicht verbunden."));
            //@ts-ignore
            this.db.execute(sql, params, (err, result) => {
                if (err) return reject(err);
                resolve(result || []);
            });
        });
    }

    /**
     * @returns {Promise<void>}
     */
    async _initTables() {
        const tables = [
            `CREATE TABLE users (gsid VARCHAR(40) PRIMARY KEY, username VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255))`,
            `CREATE TABLE passkeys (gsid VARCHAR(40) PRIMARY KEY, user_id VARCHAR(40) NOT NULL, public_key VARCHAR(1000) NOT NULL, counter INTEGER DEFAULT 0)`,
            `CREATE TABLE records (gsid VARCHAR(40) PRIMARY KEY, title VARCHAR(255) NOT NULL, content BLOB SUB_TYPE TEXT)`,
            `CREATE TABLE audit_log (gsid VARCHAR(40) PRIMARY KEY, table_name VARCHAR(255), row_id VARCHAR(40), action VARCHAR(50), changed_fields BLOB SUB_TYPE TEXT, changed_by VARCHAR(255), changed_at VARCHAR(50))`
        ];

        for (const sql of tables) {
            try {
                await this._execute(sql);
            } catch (/** @type {Object<String,any>} */ err) {
                if (!err.message.includes("already exists") && !err.message.includes("335544351")) {
                    throw err;
                }
            }
        }
    }

    /**
     * Holt Spaltennamen über die Systemtabellen, da db.execute() keine Header liefert
     * @param {string} tableName - Name der Tabelle
     * @returns {Promise<Array<string>>}
     */
    async getColumns(tableName) {
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");

        const sql = `
            SELECT TRIM(RDB$FIELD_NAME) AS F 
            FROM RDB$RELATION_FIELDS 
            WHERE RDB$RELATION_NAME = ? 
            ORDER BY RDB$FIELD_POSITION
        `;
        // Hier nutzen wir ausnahmsweise query(), da wir Objekte für den Spaltennamen wollen
        return new Promise((resolve, reject) => {
            //@ts-ignore
            this.db.query(sql, [tableName.toUpperCase()], (err, result) => {
                if (err) return reject(err);
                //@ts-ignore
                resolve(result.map(r => r.F));
            });
        });
    }

    /**
     * Liefert einen Benutzer zurück
     * @param {string} username - Benutzername
     * @returns {Promise<Array<Array<any>>>}
     */
    async getUserByUsername(username) {
        const cols = await this.getColumns('users');
        const values = await this._execute("SELECT * FROM users WHERE username = ?", [username]);
        return [cols, ...values];
    }

    /**
     * Erstellt einen neuen Benutzer in der Datenbank oder legt diesen an
     * @param {string} gsid - Eindeutige ID
     * @param {string} username - Benutzername
     * @param {string} passwordHash - passwort
     */
    async createUser(gsid, username, passwordHash) {
        const sql = "UPDATE OR INSERT INTO users (gsid, username, password_hash) VALUES (?, ?, ?) MATCHING (username)";
        await this._execute(sql, [gsid, username, passwordHash]);
    }

    /**
     * Liest aus einer Tabelle Datensätze mit flexiblen Filtern und Sortierung.
     * 
     * @param {string} tableName - Name der Tabelle
     * @param {string|Array<string>|null} [selector] - "*", "ALL", {GSID}, Liste mit GSIDs oder null (wenn nur via whereClause gefiltert wird)
     * @param {string} [whereClause] - Optionale zusätzliche WHERE-Bedingung (z.B. "username = ? AND status = ?")
     * @param {Array<any>} [whereParams] - Parameter-Werte für die Fragezeichen in der whereClause
     * @param {string} [orderBy] - Optionale Sortierung (z.B. "changed_at DESC" oder "username")
     * @returns {Promise<Array<Array<any>>>} [Spaltennamen, ...Datenzeilen]
     */
    async getRows(tableName, selector = "*", whereClause = "", whereParams = [], orderBy = "") {
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");

        const cols = await this.getColumns(tableName);

        // Basis-Query aufbauen
        let baseSql = `SELECT * FROM ${tableName}`;
        let conditions = [];
        let queryParams = [];

        // 1. Selector auswerten (GSID-Logik beibehalten)
        if (selector && selector !== "*" && selector !== "ALL") {
            if (Array.isArray(selector)) {
                if (selector.length === 0) return [cols]; // Leere ID-Liste -> Keine Daten
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
            // Erlaubt nur Alphanumerisch, Leerzeichen (für ASC/DESC), Kommas und Unterstriche
            if (!/^[a-zA-Z0-9_\s,]+$/.test(orderBy)) {
                throw new Error("Invalid ORDER BY clause!");
            }
            baseSql += ` ORDER BY ${orderBy}`;
        }

        // Query ausführen
        const values = await this._execute(baseSql, queryParams);
        return [cols, ...values];
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
     * 
     * @param {string} tableName - Name der Tabelle
     * @param {Array<Array<any>>} rows - Datenzeilen. 1. Zeile enthält die Spaltennamen
     * @param {string} conflictKey - Name der ID Spalte oder Spalte mit eindeutiger Identifikation
     * @returns {Promise<number>}
     */
    async saveRows(tableName, rows, conflictKey = "gsid") {
        if (!tableNameRegex.test(tableName)) throw new Error("Table not allowed!");
        if (!Array.isArray(rows) || rows.length <= 1) return 0;

        const headers = rows[0];
        const updateFields = headers.filter(col => col.toLowerCase() !== conflictKey.toLowerCase());

        if (updateFields.length === 0) return 0;

        const columnsStr = headers.join(", ");
        const placeholdersStr = headers.map(() => "?").join(", ");

        const sql = `
            UPDATE OR INSERT INTO ${tableName} (${columnsStr}) 
            VALUES (${placeholdersStr}) 
            MATCHING (${conflictKey})
        `;

        return new Promise((resolve, reject) => {
            //@ts-ignore
            this.db.transaction((err, transaction) => {
                if (err) return reject(err);

                let processedCount = 0;
                const dataRows = rows.slice(1);

                /**
                 * 
                 * @param {number} index - Zeilennummer
                 * @returns 
                 */
                const executeRow = (index) => {
                    if (index >= dataRows.length) {
                        //@ts-ignore
                        transaction.commit((commitErr) => {
                            if (commitErr) return transaction.rollback(() => reject(commitErr));
                            resolve(processedCount);
                        });
                        return;
                    }

                    // @ts-ignore - Nutzt transaction.execute() für die Daten-Arrays aus rows
                    transaction.execute(sql, dataRows[index], (queryErr) => {
                        if (queryErr) {
                            return transaction.rollback(() => reject(queryErr));
                        }
                        processedCount++;
                        executeRow(index + 1);
                    });
                };

                executeRow(0);
            });
        });
    }
}
