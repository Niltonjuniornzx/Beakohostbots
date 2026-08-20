package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Agent struct{ dataRoot string }
type Health struct { Status string `json:"status"`; Version string `json:"version"`; Time time.Time `json:"time"` }

func main() {
	root := env("BEAKO_DATA_ROOT", "/srv/beakohost/bots")
	if !filepath.IsAbs(root) { log.Fatal("BEAKO_DATA_ROOT must be absolute") }
	agent := &Agent{dataRoot: filepath.Clean(root)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", agent.health)
	mux.HandleFunc("POST /v1/bots/{botID}/prepare", agent.authorize(agent.prepare))
	server := &http.Server{Addr: env("BEAKO_AGENT_ADDR", "127.0.0.1:9443"), Handler: mux, ReadHeaderTimeout: 5*time.Second, IdleTimeout: 30*time.Second}
	log.Printf("runner agent listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe()) // Development only; production unit requires mTLS.
}

func (a *Agent) health(w http.ResponseWriter, _ *http.Request) { writeJSON(w, http.StatusOK, Health{"ok", "0.1.0", time.Now().UTC()}) }
func (a *Agent) authorize(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		expected := os.Getenv("BEAKO_AGENT_TOKEN")
		if expected == "" || r.Header.Get("Authorization") != "Bearer "+expected { writeJSON(w, http.StatusUnauthorized, map[string]string{"error":"unauthorized"}); return }
		next(w,r)
	}
}
func (a *Agent) prepare(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("botID")
	if !validID(id) { writeJSON(w, http.StatusBadRequest, map[string]string{"error":"invalid bot id"}); return }
	dir := filepath.Join(a.dataRoot, id, "app")
	if !strings.HasPrefix(filepath.Clean(dir), a.dataRoot+string(os.PathSeparator)) { writeJSON(w, 400, map[string]string{"error":"invalid path"}); return }
	if err := os.MkdirAll(dir, 0750); err != nil { writeJSON(w, 500, map[string]string{"error":"cannot prepare workspace"}); return }
	writeJSON(w, http.StatusCreated, map[string]string{"workspace":dir})
}
func validID(v string) bool { if len(v)<8 || len(v)>64{return false}; for _,c:=range v { if !(c=='-'||c>='0'&&c<='9'||c>='a'&&c<='f'){return false} }; return true }
func env(k,d string) string { if v:=os.Getenv(k);v!=""{return v};return d }
func writeJSON(w http.ResponseWriter, status int, v any) { w.Header().Set("Content-Type","application/json");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(v) }
