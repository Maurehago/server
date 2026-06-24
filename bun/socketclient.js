// ======================
//   Websocket Client
// ======================
// @ts-check


// RealtimeSync.js - Wiederverwendbares Client-Modul
export class RealtimeSync {
    /**
     * 
     * @param {string} serverUrl - ServerPfad 
     */
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.ws = null;
        // this.onLock = null;       // Callback: Datensatz wurde gesperrt
        // this.onUnlock = null;     // Callback: Datensatz wurde freigegeben
        // this.onDashboard = null;  // Callback: Dashboard-Daten erhalten
        // this.onExpired = null;    // Callback: Sitzung abgelaufen
    }

    connect(token, currentUserId) {
        this.currentUserId = currentUserId;
        this.ws = new WebSocket(`${this.serverUrl}?token=${token}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "INITIAL_STATE") {
                if (this.onDashboard) this.onDashboard(data.locks);
                // Gibt Initialdaten (Texte) an die Applikation zurück
                if (this.onInitialData) this.onInitialData(data);
            }
            else if (data.type === "RECORD_LOCKED") {
                if (this.onLock && data.userId !== this.currentUserId) {
                    this.onLock(data.recordId, data.username);
                }
            }
            else if (data.type === "RECORD_SAVED_AND_UNLOCKED") {
                if (this.onUnlock) this.onUnlock(data.recordId, data.text);
            }
            else if (data.type === "RECORD_UNLOCKED") {
                if (this.onUnlock) this.onUnlock(data.recordId, null);
            }
            else if (data.type === "SESSION_EXPIRED") {
                if (this.onExpired) this.onExpired();
            }
            else if (data.type === "DASHBOARD_UPDATE") {
                if (this.onDashboard) this.onDashboard(data.locks);
            }
        };
    }

    startEdit(recordId) {
        this._send({ type: "LOCK_RECORD", recordId });
    }

    // In deinem Client-Modul 'RealtimeSync.js' sieht die Methode dann so aus:
    stopEdit(recordId, savePayload) {
        this._send({
            type: "SAVE_AND_UNLOCK",
            recordId: recordId,
            tableName: savePayload.tableName,
            changedFields: savePayload.changedFields
        });
    }

    kickUser(recordId) {
        this._send({ type: "KICK_USER_FROM_LOCK", recordId });
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }

    _send(obj) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }
}

