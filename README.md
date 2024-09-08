# GO HTTP und File Server

## Einleitung
Einfache HTTP Server.  
Die auch das schreiben von text-basierenden Dateien,  
wie ".html, .json, .md, .csv, .txt, ...usw" unterstützen.

Die Server für 3 Sprachen implementiert
- go (goserver.go)
- deno (denoserver.ts)
- bun (bunserver.ts)

## Daten an Server schicken
Dateien können in den Ordner "data" oder "_build" geschrieben und gelesen werden.

Zum Beispiel:
```js
fetch("/data/test.json", {method: "POST", body:'{"name": "Max Muster", "alter": 42}'});
```

## Go-Server
### Installation von Go
Go kann von folgender Webseite installiert werden.  
Bitte den Anweisungen auf der Webseite folgen.

[Go Installation Webseite](https://go.dev/doc/install)


### Starten:
```
go run goserver.go
```

## Deno-Server
### Installation von Deno
Windows:
```
powershell -c "irm https://deno.land/install.ps1 | iex"
```

Linux & macOS
```
curl -fsSL https://deno.land/install.sh | sh
```

### Starten:
```
deno run --allow-net --allow-read --allow-write denoserver.ts
```

## Bun-Server

### Installation von Bun
Windows:
```
powershell -c "irm bun.sh/install.ps1 | iex"
```

Linux & macOS
```
curl -fsSL https://bun.sh/install | bash
```

### Starten:
```
bun run bunserver.ts
```

