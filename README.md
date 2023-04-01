# GO HTTP und File Server

## Einleitung

Ein Einfacher HTTP Server für Web-APPS.  

Die Apps müssen sich in einem Unterordner "app" befinden.

Daten können in den Ordner "data" geschrieben und gelesen werden.


## Startparameter

| Parameter | Beschreibung                             |
| --------- | ---------------------------------------- |
| -p        | Portnummer                               |
| -s        | Ordner as dem die Dateien gelesen werden |

**Beispiel**
```
go run server.go -p 8081 -s c:/temp/
```

## Sourcecode Ausführen

```
go run server.go
```
