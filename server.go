package main

// Pakete die zur Bearbeitung benötigt werden
import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
)

// mit ausgelieferte Dateien
//
//go:embed public
var public embed.FS

// Standard Einstellungen
const (
	Host   = "localhost"
	Port   = "8080"
	Static = "./"
	Open   = true
)

var port, static string

// im Browser öffenen
func open(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start"}
	case "darwin":
		cmd = "open"
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}
	args = append(args, url)
	return exec.Command(cmd, args...).Start()
}

// Test Handle Funktion
func test(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello Welt!")
}

// Handle Funktion die Requests abarbeitet
// wird mit "http.Handle("/data", http.HandlerFunc(dataHandle))" aufgerufen
func dataHandle(w http.ResponseWriter, r *http.Request) {
	// Pfad aus URL
	filePath := static + r.URL.Path
	fmt.Println(r.Method + " file: " + filePath)

	// Methode prüfen
	switch r.Method {
	case "GET":
		// nur die Datei ausliefern
		http.ServeFile(w, r, filePath)
		return

	case "HEAD":
		// todo: noch nicht implementiert
		return

	case "DELETE":
		// todo: noch nicht implementiert
		return

	case "PATCH":
		// todo: noch nicht implementiert
		return

	case "OPTIONS":
		// darf nichts machen
		return

	case "TRACE":
		// darf nichts machen
		return

	case "CONNECT":
		// darf nichts machen
		return
	}

	// ab hier POST (PUT????)

	f, err := os.Create(filePath)
	if err != nil {
		return
	}

	// Beim Beenden schliessen
	defer f.Close()

	// Daten lesen
	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	if len(data) > 0 {
		err2 := os.WriteFile(filePath, data, 0666)
		if err2 != nil {
			http.Error(w, err2.Error(), 500)
			return
		}
	}
}

// Ein Handler nur für Statische Dateien
func staticHandle(w http.ResponseWriter, r *http.Request) {
	// nur GET Requests erlaubt
	if r.Method != "GET" {
		return
	}
	// Pfad aus URL
	filePath := static + r.URL.Path
	fmt.Println("file: " + filePath)

	// nur die Datei ausliefern
	http.ServeFile(w, r, filePath)
}

// PublicHandler
func publicHandler() http.Handler {
	sub, err := fs.Sub(public, "public")
	if err != nil {
		panic(err)
	}

	return http.FileServer(http.FS(sub))
}

func redirectStatic(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/server/", http.StatusSeeOther)
}

// Haup (Start) Funktion
func main() {
	// Parameter prüfen
	// flag.StringVar(zeiger, name, default, beschreibung)
	flag.StringVar(&port, "p", Port, "Server Port")
	flag.StringVar(&static, "s", Static, "Static File Folder")
	flag.Parse() // muss nach dem deklarieren der Argumente ausgeführt werden

	// Test Handle
	http.Handle("/test", http.HandlerFunc(test))

	// Data Handle
	go http.Handle("/data/", http.HandlerFunc(dataHandle))

	// App Handle
	go http.Handle("/app/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Pfad aus URL
		filePath := static + r.URL.Path
		// nur die Datei ausliefern
		http.ServeFile(w, r, filePath)
	}))

	// Statische Seiten im unterOrdner "public"
	// werden mit in die .EXE compeliert
	go http.Handle("/", publicHandler())

	// http.Handle("/", fileServer)
	// http.Handle("/", http.HandlerFunc(staticHandle))

	//Create the server.
	serverURL := Host + ":" + port

	fmt.Println(runtime.GOOS)
	fmt.Println("Server running on http://" + serverURL)
	fmt.Println("stop with CTRL+C   or   STRG+C")
	fmt.Println("...")

	err := http.ListenAndServe(serverURL, nil)
	if err != nil {
		log.Fatal("Error Starting the HTTP Server :", err)
		return
	}

	if Open {
		open("http://" + serverURL)
	}
}
