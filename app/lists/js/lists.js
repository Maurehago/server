// =========================
//   Listen JS
// build:2023-03-14
// =========================

// Liste vorlage
var List = {
    _cols: []
    , _idx: []
    , _table: {
        _default: "default"
        , default: []
    }
};

// Spalten
// type: ""
// data: []
// table: {tag: "", attr: "", class: ""}
// form: {tag: "", attr: "", class: ""}

// Sortierungs Index
function get_sort(list, field) {
    var list_field = list[field];

    // Index Tabelle als vorgabe
    var sort_table = list._idx.sort(function(a, b) {
        var a_value = list_field.data[a];
        var b_value = list_field.data[b];

        if (a_value > b_value) { return 1; }
        if (a_value < b_value) { return -1; }

        return 0;
    });

    return sort_table;
};

function get_filter(list, field, filter_value) {
    var new_list = [];
    list[field].data.forEach(function (value, index) {
        if (value == filter_value) {
            new_list.push(index);
        }
    });
    return new_list;
};


// Gruppierung
function get_group(list, field) {
    var list_field = list[field];
    var data_map = new Map();

    // alle durchgehen
    list._idx.forEach(function (id, index) {
        var new_key = list_field.data[index];

        if (data_map.has(new_key)) {
            data_map.get(new_key).push(index);
        } else {
            data_map.set(new_key, [index]);
        }
    });

    return data_map;
};



var menu_schema = {
    prop: {schema: "_def"}
    , list: {
        _cols: ["IDX","name","type","rest","info"]
        , IDX: [1,2,3]
        , name: ["IDX","name","list"]
        , type: ["int32","string","string"]
        , rest: ["","",""]
        , info: ["Index","Name des Menüpunktes","Pfad zu der Liste"]
    }
}

var menu_list = {
    prop: {
        schema: "menu_schema"
        ,width: 50
    }
    , list: {
        _cols: ["IDX","name","list"]
        , IDX: []
        , name: []
        , list: []
    }
};

var lists = {
    current: 0
    , cols: [{name: "Menü", list:"menu_list"}]
};


// Liste anzeigen
function show_list(colpos, listdoc){
    var fixrow = document.querySelector("r-fix");
    var fixcols = document.querySelectorAll("c-fix");
    var fixcolscount = fixcols.length;

};

