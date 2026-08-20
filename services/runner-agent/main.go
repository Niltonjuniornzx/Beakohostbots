package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const agentVersion = "0.2.0"

type config struct {
	PanelURL      string `json:"panelUrl"`
	NodeID        string `json:"nodeId"`
	AgentToken    string `json:"agentToken"`
	AllowInsecure bool   `json:"allowInsecure"`
}

type metrics struct {
	AgentVersion       string `json:"agentVersion"`
	Hostname           string `json:"hostname"`
	TotalCPUMillicores int    `json:"totalCpuMillicores"`
	TotalMemoryMB      int    `json:"totalMemoryMb"`
	TotalDiskMB        int    `json:"totalDiskMb"`
}

type enrollmentRequest struct {
	Token string `json:"token"`
	metrics
}

type enrollmentResponse struct {
	NodeID     string `json:"nodeId"`
	NodeName   string `json:"nodeName"`
	AgentToken string `json:"agentToken"`
}

func main() {
	var enroll bool
	var panelURL, enrollmentToken, configPath string
	var allowInsecure bool
	flag.BoolVar(&enroll, "enroll", false, "register this runner using a one-time token")
	flag.StringVar(&panelURL, "panel", os.Getenv("BEAKO_PANEL_URL"), "panel base URL")
	flag.StringVar(&enrollmentToken, "token", os.Getenv("BEAKO_ENROLLMENT_TOKEN"), "one-time enrollment token")
	flag.StringVar(&configPath, "config", "/etc/beakohost/runner.json", "configuration file")
	flag.BoolVar(&allowInsecure, "allow-insecure", false, "allow plain HTTP (development only)")
	flag.Parse()

	if enroll {
		if err := enrollAgent(panelURL, enrollmentToken, configPath, allowInsecure); err != nil {
			log.Fatal(err)
		}
		return
	}

	cfg, err := readConfig(configPath)
	if err != nil {
		log.Fatalf("cannot read configuration: %v", err)
	}
	if err := validatePanelURL(cfg.PanelURL, cfg.AllowInsecure); err != nil {
		log.Fatal(err)
	}
	log.Printf("runner %s connected to node %s", agentVersion, cfg.NodeID)
	heartbeatLoop(cfg)
}

func enrollAgent(panelURL, token, configPath string, allowInsecure bool) error {
	panelURL = strings.TrimRight(strings.TrimSpace(panelURL), "/")
	if err := validatePanelURL(panelURL, allowInsecure); err != nil {
		return err
	}
	if len(token) < 32 {
		return errors.New("the enrollment token is missing or invalid")
	}
	payload := enrollmentRequest{Token: token, metrics: collectMetrics()}
	var response enrollmentResponse
	if err := postJSON(panelURL+"/api/agents/enroll", "", payload, &response); err != nil {
		return fmt.Errorf("enrollment failed: %w", err)
	}
	if response.AgentToken == "" || response.NodeID == "" {
		return errors.New("panel returned an incomplete enrollment response")
	}
	cfg := config{PanelURL: panelURL, NodeID: response.NodeID, AgentToken: response.AgentToken, AllowInsecure: allowInsecure}
	if err := saveConfig(configPath, cfg); err != nil {
		return err
	}
	log.Printf("node %q enrolled successfully", response.NodeName)
	return nil
}

func heartbeatLoop(cfg config) {
	for {
		var response struct{ NextHeartbeatSeconds int `json:"nextHeartbeatSeconds"` }
		err := postJSON(cfg.PanelURL+"/api/agents/heartbeat", cfg.AgentToken, collectMetrics(), &response)
		if err != nil {
			log.Printf("heartbeat failed: %v", err)
		} else {
			log.Printf("heartbeat sent")
		}
		interval := response.NextHeartbeatSeconds
		if interval < 10 || interval > 300 {
			interval = 30
		}
		time.Sleep(time.Duration(interval) * time.Second)
	}
}

func collectMetrics() metrics {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" { hostname = "runner-desconhecido" }
	return metrics{AgentVersion: agentVersion, Hostname: hostname, TotalCPUMillicores: runtime.NumCPU() * 1000, TotalMemoryMB: memoryMB(), TotalDiskMB: diskMB("/srv/beakohost")}
}

func memoryMB() int {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil { return 64 }
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "MemTotal:" {
			kb, _ := strconv.ParseInt(fields[1], 10, 64)
			return max(64, int(kb/1024))
		}
	}
	return 64
}

func diskMB(path string) int {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil { return 1024 }
	return max(1024, int((stat.Blocks*uint64(stat.Bsize))/(1024*1024)))
}

func postJSON(url, token string, input, output any) error {
	body, err := json.Marshal(input)
	if err != nil { return err }
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil { return err }
	req.Header.Set("Content-Type", "application/json")
	if token != "" { req.Header.Set("Authorization", "Bearer "+token) }
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil { return err }
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("panel returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	if output != nil && len(data) > 0 { return json.Unmarshal(data, output) }
	return nil
}

func validatePanelURL(url string, allowInsecure bool) error {
	if strings.HasPrefix(url, "https://") { return nil }
	if allowInsecure && strings.HasPrefix(url, "http://") { return nil }
	return errors.New("the panel URL must use HTTPS; use --allow-insecure only for temporary HTTP testing")
}

func readConfig(path string) (config, error) {
	var cfg config
	data, err := os.ReadFile(path)
	if err != nil { return cfg, err }
	err = json.Unmarshal(data, &cfg)
	return cfg, err
}

func saveConfig(path string, cfg config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil { return fmt.Errorf("cannot create config directory: %w", err) }
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil { return err }
	if err := os.WriteFile(path, data, 0600); err != nil { return fmt.Errorf("cannot save runner credentials: %w", err) }
	return nil
}
