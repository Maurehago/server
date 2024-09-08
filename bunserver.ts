// ========================
//   Bun Fileserver
// 2024-09-05
// ========================

//   Server erstellen
const server = Bun.serve({
  port: 8090,

  // Request prüfen
  fetch(req: Request): Response | Promise<Response> {
    let filePath = new URL(req.url).pathname;

    // wenn Pfad auf einen Ordner zeigt dann immer "index.html" anfügen
    if (filePath.endsWith("/")) {
      filePath += "index.html";
    }

    // Wenn "POST" Methode
    if (req.method == "POST") {
      // prüfen ob der Post in den Data Ordner geht
      if (filePath.startsWith("/data")) {
        // Daten aus Request
        req.text().then((data) => {
          // Daten schreiben
          Bun.write("./" + filePath, data).then(() => {
            return new Response("OK");
          }).catch((err: Error) => {
            return new Response(err.message, { status: 500 });
          });
        });
      } else {
        // Pfad zeigt nicht auf den Data Ordner
        return new Response("Posts go only in /data/ folder", { status: 400 });
      }
    }

    // Datei von Platte lesen und zurückgeben
    console.log(filePath);
    const file = Bun.file("./" + filePath);
    return new Response(file);
  },
  error() {
    return new Response(null, { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
