// =========================================================================
//   TREIBER-ARCHITEKTUR (db_drivers.js)
// =========================================================================
// @ts-check

import { join } from "path";
import { mkdir } from "fs/promises";

/**
 * @typedef {Array<string|number|boolean|null>} DataRow
 * @typedef {Array<DataRow>} DataRows - Erste Zeile ist IMMER der Spalten-Header
 */

/**
 * @typedef {Object} DBDriverInterface
 * @property {string} id - Eindeutige ID des Treibers (z.B. "json_kunden")
 * @property {string} type - Typ des Treibers ("JSON" | "SQLITE" | "HTML_FRAGMENTS")
 * @property {string} name - Menschenlesbarer Name
 * @property {(tableName: string) => Promise<DataRows>} getRows - Holt alle Zeilen
 * @property {(tableName: string, recordId: string) => Promise<DataRows>} getRecord - Holt einen spezifischen Datensatz (Header + 1 Zeile)
 * @property {(tableName: string, deltaRows: DataRows, idColName: string) => Promise<{success: boolean, affected: number}>} saveRows - Schreibt nur geänderte Zellen/Zeilen
 */

/**
 * Performanter, nativer JSON-Dateien-Treiber für Bun
 * @implements {DBDriverInterface}
 */
export class JsonFileDriver {
    /**
     * @param {string} id 
     * @param {string} name 
     * @param {string} baseFolder - Absoluter oder relativer Pfad zum Datenverzeichnis
     */
    constructor(id, name, baseFolder) {
        this.id = id;
        this.type = "JSON";
        this.name = name;
        this.baseFolder = baseFolder;
    }

    /**
     * @private
     * @param {string} tableName 
     * @returns {string}
     */
    _getPath(tableName) {
        return join(this.baseFolder, `${tableName}.json`);
    }

    /**
     * @param {string} tableName 
     * @returns {Promise<DataRows>}
     */
    async getRows(tableName) {
        const file = Bun.file(this._getPath(tableName));
        if (await file.exists()) {
            /** @type {DataRows} */
            const parsed = await file.json();
            return parsed;
        }
        return [["gsid"]]; // Fallback-Minimum, falls Datei leer/neu
    }

    /**
     * @param {string} tableName 
     * @param {string} recordId 
     * @returns {Promise<DataRows>}
     */
    async getRecord(tableName, recordId) {
        const rows = await this.getRows(tableName);
        const headers = rows[0];
        const idIdx = headers.indexOf("gsid"); // Fallback auf gsid, falls nicht anders definiert
        
        const recordRow = rows.slice(1).find(row => String(row[idIdx]) === String(recordId));
        if (!recordRow) {
            throw new Error(`Datensatz mit ID ${recordId} in Tabelle ${tableName} nicht gefunden.`);
        }
        return [headers, recordRow];
    }

    /**
     * @param {string} tableName 
     * @param {DataRows} deltaRows - Enthält [ [Header], [Geänderte Zeile mit ID] ]
     * @param {string} idColName 
     * @returns {Promise<{success: boolean, affected: number}>}
     */
    async saveRows(tableName, deltaRows, idColName) {
        const currentData = await this.getRows(tableName);
        const currentHeaders = currentData[0];
        const currentContentRows = currentData.slice(1);
        
        const deltaHeaders = deltaRows[0];
        const deltaContentRows = deltaRows.slice(1);
        
        const idDeltaIdx = deltaHeaders.indexOf(idColName);
        const idCurrentIdx = currentHeaders.indexOf(idColName);

        if (idDeltaIdx === -1 || idCurrentIdx === -1) {
            throw new Error(`ID-Spalte '${idColName}' wurde in den übermittelten Headern nicht gefunden.`);
        }

        let affectedCounter = 0;

        // Iteration über die geänderten Daten vom Client
        for (const dRow of deltaContentRows) {
            const rowId = dRow[idDeltaIdx];
            // Suche den bestehenden Datensatz in der "Datenbank"
            const matchIdx = currentContentRows.findIndex(cRow => String(cRow[idCurrentIdx]) === String(rowId));

            if (matchIdx !== -1) {
                // UPDATE: Selektives Überschreiben der geänderten Spalten
                deltaHeaders.forEach((headerName, dIdx) => {
                    if (headerName === idColName) return; // ID wird nicht überschrieben
                    const targetColIdx = currentHeaders.indexOf(headerName);
                    if (targetColIdx !== -1) {
                        currentContentRows[matchIdx][targetColIdx] = dRow[dIdx];
                    }
                });
                affectedCounter++;
            } else {
                // INSERT: Wenn der Datensatz neu ist, bauen wir eine vollständige Zeile konform zum Haupt-Header
                /** @type {DataRow} */
                const newRow = currentHeaders.map(() => null);
                deltaHeaders.forEach((headerName, dIdx) => {
                    const targetColIdx = currentHeaders.indexOf(headerName);
                    if (targetColIdx !== -1) {
                        newRow[targetColIdx] = dRow[dIdx];
                    }
                });
                currentContentRows.push(newRow);
                affectedCounter++;
            }
        }

        // Zurückschreiben der fusionierten Gesamttabelle
        await mkdir(this.baseFolder, { recursive: true });
        await Bun.write(this._getPath(tableName), JSON.stringify([currentHeaders, ...currentContentRows], null, 2));

        return { success: true, affected: affectedCounter };
    }
}
