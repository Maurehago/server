// ======================
//   Websocket Client
// ======================
// @ts-check

/**
 * Muss wie in soketserver.js sein
 * @typedef {import("./socketserver.js").Token} Token
 */

/**
 * Muss wie in soketserver.js sein
 * @typedef {import("./socketserver.js").MessageData} MessageData
 */



// RealtimeSync.js - Wiederverwendbares Client-Modul
export class RealtimeSync {
    /**
     * @param {string} serverUrl - ServerPfad 
     */
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.ws = null;
    }

    /** Gesperrte Datensätze */
    lockedData = new Map();

    /** 
     * Callback Funktion wenn ein Datensatz gesperrt wird
     * @type {function|null} */
    onLock = null

    /** 
     * Callback Funktion wenn ein Datensatz entsperrt wird
     * @type {function|null} */
    onUnlock = null

    /** 
     * Callback Funktion wenn ein Datensatz bearbeitet wird
     * @type {function|null} */
    onEdit = null

    /** 
     * Callback Funktion wenn die Session abläuft
     * @type {function|null} */
    onSessionTimeout = null

    /** 
     * Callback Funktion wenn die Session abläuft
     * @type {function|null} */
    onDashboard = null


    /**
     * Stellt eine Verbindung mit dem Server her
     * @param {Token} token - Token für die Verbindung
     * @param {string} currentUserId - ID des aktuellen user
     */
    connect(token, currentUserId) {
        this.currentUserId = currentUserId;
        this.ws = new WebSocket(`${this.serverUrl}?token=${token}`);

        this.ws.onmessage = (event) => {
            /** @type {MessageData} */
            const data = JSON.parse(event.data);

            if (data.type === "INITIAL_STATE") {
                // gesperrte Datensätze merken
                if (data.locks) this.lockedData = data.locks;

                //if (this.onDashboard) this.onDashboard(data.locks);
                // Gibt Initialdaten (Texte) an die Applikation zurück
                //if (this.onInitialData) this.onInitialData(data);
            }
            else if (data.type === "RECORD_LOCKED") {
                if (this.onLock && data.userid !== this.currentUserId) {
                    this.lockedData.set(data.tablename + "_" + data.recordid, data);
                    this.onLock(data.tablename, data.recordid, data.username);
                } else if (this.onEdit && data.userid == this.currentUserId) {
                    // Bearbeiten Starten aufrufen
                    this.onEdit(data.tablename, data.recordid);
                }
            }
            else if (data.type === "RECORD_SAVED_AND_UNLOCKED") {
                if (this.onUnlock) this.onUnlock(data.tablename, data.recordid, data.text);
            }
            else if (data.type === "RECORD_UNLOCKED") {
                if (this.onUnlock) this.onUnlock(data.tablename, data.recordid);
            }
            else if (data.type === "SESSION_EXPIRED") {
                if (this.onSessionTimeout) this.onSessionTimeout();
            }
            else if (data.type === "DASHBOARD_UPDATE") {
                if (this.onDashboard) this.onDashboard(data.locks);
            }
        };
    }


    /**
     * Informiert den Server das ein Datensatz geändert wird
     * @param {string} tablename - Name der Tabelle
     * @param {string} recordid - DatensatzID
     */
    startEdit(tablename, recordid) {
        this._send({ type: "LOCK", tablename, recordid });
    }

    // In deinem Client-Modul 'RealtimeSync.js' sieht die Methode dann so aus:
    /**
     * Speichert die Datensatz Änderungen
     * @param {string} tablename  - Name der Tabelle
     * @param {string} recordid  - ID des Datensatzes
     * @param {Array<Array<any>>} rows - Daten zum Speichern: z.B. [ ["gsid", "name"], ["gadsfd", "Muster"] ] 
     */
    saveEdit(tablename, recordid, rows) {
        this._send({ type: "SAVE", recordid, tablename, rows });
    }

    /**
     * Entsperrt den Datensatz vom Bearbeiten
     * @param {string} tablename - TabellenName
     * @param {string} recordid - Datensatz ID
     */
    abortEdit(tablename, recordid) {
        this._send({ type: "UNLOCK", tablename, recordid });
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }

    /**
     * Sendet Daten an den Server
     * @param {MessageData} obj - Daten zum Senden
     */
    _send(obj) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }
}

