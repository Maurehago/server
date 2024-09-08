import { serveFile } from "jsr:@std/http/file-server";
import * as path from "jsr:@std/path";

// Server starten
Deno.serve({ port: 8080 }, (req: Request) => {
  let pathname = new URL(req.url).pathname;

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  // POST in Data
  if (req.method == "POST") {
    // prüfen auf /data/ Ordner
    if (!pathname.startsWith("/data/")) {
      return new Response("400: send Data only in data/ folder", {
        status: 400,
      });
    }

    // Dateiname in eine absolute URL
    pathname = path.join(Deno.cwd(), pathname);
    
    // Text von Request Body lesen
    return req.text().then((data) => {
      // Text von Body in Datei speichern
      Deno.writeTextFileSync(pathname, data);
      
      // OK
      return new Response("200: OK", {
        status: 200,
      });
    }).catch((err) => {
      // UPS ein Fehler beim Speichern vom Request
      return new Response(err, {
        status: 500,
      });      
    });
  } // if Method == POST

  // Datei ausliefern wenn vorhanden
  if (pathname) {
    //console.log("pathname:", pathname);
    pathname = path.join(Deno.cwd(), pathname);
    const fileInfo = Deno.statSync(pathname);
    //console.log("fullpath:", pathname);
    if (fileInfo.isFile) {
      return serveFile(req, pathname, { fileInfo: fileInfo });
    }
  }

  return new Response("404: Not Found", {
    status: 404,
  });
});

