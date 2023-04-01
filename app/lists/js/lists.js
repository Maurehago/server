// =========================
//   Listen JS
// build:2023-03-14
// =========================

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

