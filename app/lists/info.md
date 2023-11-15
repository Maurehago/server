# Lists Definition

## Json Objekt
```json
{
    "name": "ListenName"
    , "version": "1.0.0-alpha1"
    , "idcol": 0
    , "list": {
        "col": ["ID", "spalte1", "spalte2"]
        , "type": ["string", "string", "string"]
    },
    "data": [
        ["ID1", "Spalte1 von Data 1", "Spalte2 von Data1"]
        , ["ID2", "Spalte1 von Data 2", "Spalte2 von Data2"]
        , ["ID3", "Spalte1 von Data 3", "Spalte2 von Data3"]
    ]
}
```

"list" kann erweitert werden, Value muss aber immer ein Array sein, mit der selben Anzahl an Spalten wie in "list.col" angegeben.
Dabei gehört der Wert in dem Array immer zu der Spalte mit dem selben Index.

Somit können für eine Spalte belibige Eigenschaften hinzugefügt werden.
wie zum Beispiel "domain" für die Domain Namen in einer Firebird Datenbank

### Typen (type)
- object
- array
- string
- number
- bool

### Daten Format (format)
- number
    - int8
    - int16
    - int32 (rune)
    - int64
    - uint8 (byte)
    - uint32
    - uint64
    - float32
    - float64
- string
    - text, varchar
    - char
    - date
    - datetime (local)
    - time
    - week
    - month
    - year
    - range
    - password
    - email
    - tel
    - url
    - img
    - file
    - color


### Größen (size)
Die Größen sind mit "min;max" anzugeben (inkl min und max)
oder mit "|min;|max" wenn größer "min" (exclusive min) und kleiner "max" (exclusive max)
oder eine Kombination von beiden "min;|max"
 


### Eingabe Formate
- button
- checkbox
- color
- date
- datetime-local
- email
- file
- hidden
- image
- month
- number
- password
- radio
- range
- reset
- search
- submit
- tel
- text
- time
- url
- week

