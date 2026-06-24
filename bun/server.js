// ============================
//   Bun RealtimeServer
// ----------------------

import { SQLiteDriver } from "./db-sqlite.js";
import { RealtimeServer } from "./socketserver.js";

// 1. Instanziierung des gewünschten Datenbank-Treibers
const dbDriver = new SQLiteDriver("app.db");

// 2. Übergabe des Treibers an den Server (Dependency Injection)
const server = new RealtimeServer(dbDriver, {
  port: 3000,
  rpName: "Mein Firmen Echtzeit-System",
  rpId: "localhost"
});

// 3. Anwendung starten
server.start();
