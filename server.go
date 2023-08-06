package main

// Pakete die zur Bearbeitung benötigt werden
import (
	"crypto/rand"
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"time"
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

var port, static, homedir string

// im Browser öffnen
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

// GSID Erstellen
func gsid() string {
	// Time
	t := time.Now()
	unixTime := t.UnixMilli()
	timestring := strconv.FormatInt(unixTime, 36)

	// Random
	r, err := rand.Int(rand.Reader, big.NewInt(10000000000))
	if err != nil {
		fmt.Println("error:", err)
		return err.Error()
	}
	randstring := strconv.FormatInt(r.Int64(), 36)

	// Time + Random
	return timestring + randstring
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
	data, err := io.ReadAll(r.Body)
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
	// UserHomeDir
	var err error
	homedir, err = os.UserHomeDir()
	if err != nil {
		log.Fatal("No User Home Directory:", err)
		return
	}

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

	// GSID Handle
	go http.Handle("/gsid/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// GSID ausliefern
		fmt.Fprintf(w, gsid())
	}))

	// Statische Seiten im unterOrdner "public"
	// werden mit in die .EXE compiliert
	go http.Handle("/", publicHandler())

	// http.Handle("/", fileServer)
	// http.Handle("/", http.HandlerFunc(staticHandle))

	//Create the server.
	serverURL := Host + ":" + port

	fmt.Println(runtime.GOOS)
	fmt.Println("Server running on http://" + serverURL)
	fmt.Println("stop with CTRL+C")
	fmt.Println("...")

	err = http.ListenAndServe(serverURL, nil)
	if err != nil {
		log.Fatal("Error Starting the HTTP Server :", err)
		return
	}

	if Open {
		open("http://" + serverURL)
	}
}
