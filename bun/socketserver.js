// ===================================
//   WEB-Socket Server
// ===================================
// @ts-check

const activeLocks = new Map();// 30 Minuten Inaktivitäts-Timeout (in Millisekunden)const SESSION_TIMEOUT = 30 * 60 * 1000; 

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);

    // [Passkey- oder Standard-Login stellt initiales JWT aus]
    if (url.pathname === "/socket") {
      const token = url.searchParams.get("token");
      try {
        const payload = JSON.parse(atob(token));
        
        // Initialer Check gegen das Token-Ablaufdatum
        if (payload.exp < Date.now()) return new Response("Expired", { status: 401 });
        
        return server.upgrade(req, { 
          data: { 
            userId: payload.userId, 
            username: payload.username,
            // NEU: Wir setzen den Ablaufzeitpunkt im Server-RAM auf "Jetzt + 30 Min"
            expiresAt: Date.now() + SESSION_TIMEOUT 
          } 
        });
      } catch (e) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
  },

  websocket: {
    open(ws) {
      ws.subscribe("records-room");
      ws.send(JSON.stringify({ type: "INITIAL_STATE", locks: Object.fromEntries(activeLocks) }));
    },
    async message(ws, message) {
      // SITZUNG VERLÄNGERN: Bei JEDER eingehenden Nachricht des Benutzers
      // setzen wir den Ablaufzeitpunkt im RAM wieder auf 30 Minuten in die Zukunft.
      ws.data.expiresAt = Date.now() + SESSION_TIMEOUT;
      console.log(`Sitzung für ${ws.data.username} verlängert bis: ${new Date(ws.data.expiresAt).toLocaleTimeString()}`);

      const data = JSON.parse(message);
      
      if (data.type === "LOCK_RECORD") {
        activeLocks.set(data.recordId, ws.data.userId);
        server.publish("records-room", JSON.stringify({ 
          type: "RECORD_LOCKED", recordId: data.recordId, userId: ws.data.userId, username: ws.data.username 
        }));
      } 
      else if (data.type === "SAVE_AND_UNLOCK") {
        if (activeLocks.get(data.recordId) === ws.data.userId) {
          // [Hier SQL-Speicherlogik für SQLite/Firebird]
          activeLocks.delete(data.recordId);
          server.publish("records-room", JSON.stringify({ 
            type: "RECORD_SAVED_AND_UNLOCKED", recordId: data.recordId, text: data.text 
          }));
        }
      }
    },
    close(ws) {
      // Locks aufräumen
      for (const [recordId, userId] of activeLocks.entries()) {
        if (userId === ws.data.userId) {
          activeLocks.delete(recordId);
          server.publish("records-room", JSON.stringify({ type: "RECORD_UNLOCKED", recordId }));
        }
      }
    }
  }
});

// NEU: Hintergrund-Wächter (Intervall), der jede Minute inaktive Sockets schließt
setInterval(() => {
  const jetzt = Date.now();
  // server.connections enthält alle aktuell offenen WebSockets
  for (const ws of server.connections) {
    if (ws.data && ws.data.expiresAt < jetzt) {
      console.log(`🔴 Sitzung von ${ws.data.username} wegen Inaktivität abgelaufen. Trenne Verbindung.`);
      
      // Client informieren, damit er die UI sperrt oder zum Login leitet
      ws.send(JSON.stringify({ type: "SESSION_EXPIRED" }));
      
      // Verbindung serverseitig hart schließen
      ws.close(); 
    }
  }
}, 60000); // Läuft alle 60 Sekunden

console.log("Server mit automatischer Sitzungsverlängerung läuft...");
