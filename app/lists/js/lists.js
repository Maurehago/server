// =========================
//   Listen JS
// build:2023-03-14
// =========================


// Global Short Identifier
function GSID () {
    return new Date().getTime().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
}


// Definition
var _def = {
    name: "_def"
    , list: {
        col: ["ID", "name", "type", "info"]
        , type: ["string", "string", "string", "string"]
        , format: ["GSID", , "@_type" , ]
        , size: ["14;", "1;", "@type"]
        , info: ["eindeutige ID", "Name der Spalte", "Typ der Spalte", "Informationen zu der Spalte"]
    }
    , data: []
}

// Liste vorlage
var List = {
  cols: []
  , types: []
  , rest: []
  , info: []
  , data: []

// Global Short Identifier
function GSID () {
    return new Date().getTime().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
}


// Definition
var _def = {
    name: "_def"
    , list: {
        col: ["ID", "name", "type", "info"]
        , type: ["string", "string", "string", "string"]
        , format: ["GSID", , "@_type" , ]
        , size: ["14;", "1;", "@type"]
        , info: ["eindeutige ID", "Name der Spalte", "Typ der Spalte", "Informationen zu der Spalte"]
    }
    , data: []
};


// Typen
var _type = ["string", "number", "bool", "array", "object"];
var _number_format = [
    "int8", "int16", "int32", "int64"
    , "uint8", "uint16", "uint32", "uint64"
    , "float32", "float64"
];
var _string_format = [
    "varchar"
    , "char"
    , "GSID"
    , "UUID"
    , "date"
    , "datetime"
    , "time"
    , "week"
    , "month"
    , "year"
    , "duration"
    , "range"
    , "password"
    , "email"
    , "tel"
    , "url"
    , "img"
    , "file"
    , "color"
];



// ```yaml
// kunde:
//   cols: [
//     ["g_nummer", "int32", "", ""]
//     , ["vorname", "string", "", ""]
//     , ["nachname", "string", "", ""]
//     , ["adresse_g_nummer", "int32", "", ""]
//   ]
//   join: [[3, "adresse", 0]]
//   uniq: [[0]]
//   data: [
//       [1, "Hugo", "Habich", 1]
//       [2, "Max", "Muster", 2]
//   ]

// adresse:
//   cols: [
//     ["g_nummer", "int32", "", ""]
//     , ["strasse", "string", "", ""]
//     , ["plz", "string", "", ""]
//     , ["ort", "string", "", ""]
//   ]
//   join: [[0, "kunde", 3]]
//   uniq: [[0]]
//   data: [
//     [1, "Vogelgasse 233", "4321", "Nest"]
//     , [2, "Musterstrasse 11", "1234", "Musterhausen"]
//   ]



// Sortierungs Index
function get_sort(list, field_index) {
    var data = list.data;
    if (!data) {return [];}

    // Index Tabelle als vorgabe
    var sort_table = data.sort(function(a, b) {
        // Wert von Spalte lesen
        var a_value = a[field_index];
        var b_value = b[field_index];

        // Werte prüfen und Sortierung zurückgeben
        if (a_value > b_value) { return 1; }
        if (a_value < b_value) { return -1; }

        // Werte sind gleich
        return 0;
    });

  return sort_table;
};

// Daten Filtern
function get_filter(list, field_index, filter_value) {
    var new_list = [];
    var data = list.data;
    if (!data) {return new_list;}

    data.forEach(function (row, index) {
        var value = row[field_index];
        if (value == filter_value) {
            new_list.push(row);
        }
    });
    return new_list;
};


// Gruppierung
function get_group(list, field_index) {
    var data_map = new Map();
    var data = list.data;
    if (!data) {return data_map;}

    // alle durchgehen
    data.forEach(function (row, index) {
        var new_key = row[field_index];

        if (data_map.has(new_key)) {
            data_map.get(new_key).push(row);
        } else {
            data_map.set(new_key, [row]);
        }
    });

  return data_map;
};

// Liste anzeigen
function show_list(colpos, listdoc) {
  var fixrow = document.querySelector("r-fix");
  var fixcols = document.querySelectorAll("c-fix");
  var fixcolscount = fixcols.length;

};

