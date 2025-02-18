// ========================
//   Bun Fileserver
// 2024-09-05
// ========================
// @ts-check

import Bun from "bun";

let port = 8080;

// CLI Variablen Parameter lesen
for (let i= 0; i < Bun.argv.length; i++) {
  // -p | --port
  if (Bun.argv[i] == "-p" || Bun.argv[i] == "--port") {
    port = parseInt(Bun.argv[i +1]) || 8080;
  }
}

//   Server erstellen
let isPost = false;
const server = Bun.serve({
  port: port,

  // Request prüfen
  //fetch(req: Request): Response | Promise<Response> {
  /**
   * 
   * @param {Request} req - Request an Server
   * @returns 
   */
  fetch(req) {
    let filePath = new URL(req.url).pathname;

    // wenn Pfad auf einen Ordner zeigt dann immer "index.html" anfügen
    if (filePath.endsWith("/")) {
      filePath += "index.html";
    }
    if (filePath.indexOf(".") < 0) {
      filePath += "/index.html";
    }

    // Wenn "POST" Methode
    if (req.method == "POST") {
      isPost = true;
      // prüfen ob der Post in den Data Ordner geht
      if (filePath.startsWith("/data") || filePath.startsWith("/_build")) {
        // Daten aus Request
        req.text().then((data) => {
          // Daten schreiben
          Bun.write("./" + filePath, data).then(() => {
            return new Response("OK");
          //}).catch((err: Error) => {
          }).catch((/** @type {Error} */ err) => {
            console.log("POST err:", err);
            return new Response(err.message, { status: 500 });
          });
        });
      } else {
        // Pfad zeigt nicht auf den Data Ordner
        return new Response("Posts go only in /data/ or /_build/ folder", { status: 400 });
      }
    }
    // Datei von Platte lesen und zurückgeben
    console.log(filePath);
    const file = Bun.file("./" + filePath);
    return new Response(file);
  },
  error() {
    if (isPost) {
      return new Response(null, { status: 200 });
    } else {
      return new Response(null, { status: 404 });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
console.log(`stop with CTRL+C`);
