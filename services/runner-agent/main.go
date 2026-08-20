package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const agentVersion = "0.5.0"

var managedRuntimeImages = []string{"node:24-alpine", "node:22-alpine", "python:3.13-alpine", "python:3.12-alpine"}

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
	RuntimeImages      []string `json:"runtimeImages"`
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
	go heartbeatLoop(cfg)
	jobLoop(cfg)
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
	return metrics{AgentVersion: agentVersion, Hostname: hostname, TotalCPUMillicores: runtime.NumCPU() * 1000, TotalMemoryMB: memoryMB(), TotalDiskMB: diskMB("/srv/beakohost"), RuntimeImages: availableRuntimeImages()}
}

func availableRuntimeImages() []string {
	images:=make([]string,0,len(managedRuntimeImages))
	for _,image:=range managedRuntimeImages { if exec.Command("docker","image","inspect",image).Run()==nil { images=append(images,image) } }
	return images
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

type jobFile struct {
	Path          string `json:"path"`
	ContentBase64 string `json:"contentBase64"`
}

type runnerJob struct {
	ID     string `json:"id"`
	Action string `json:"action"`
	Bot    struct {
		ID           string   `json:"id"`
		Entrypoint   string   `json:"entrypoint"`
		Image        string   `json:"image"`
		StartCommand []string `json:"startCommand"`
		Files        []jobFile `json:"files"`
		Limits       struct {
			CPUMillicores int `json:"cpuMillicores"`
			MemoryMB      int `json:"memoryMb"`
			PidsLimit     int `json:"pidsLimit"`
		} `json:"limits"`
	} `json:"bot"`
}

func jobLoop(cfg config) {
	for {
		var response struct {
			Job *runnerJob `json:"job"`
			PollAfterSeconds int `json:"pollAfterSeconds"`
			MonitorBotIDs []string `json:"monitorBotIds"`
		}
		if err := postJSON(cfg.PanelURL+"/api/agents/jobs/next", cfg.AgentToken, map[string]bool{}, &response); err != nil {
			log.Printf("job poll failed: %v", err)
			time.Sleep(5*time.Second)
			continue
		}
		if response.Job == nil {
			for _,botID:=range response.MonitorBotIDs { publishTelemetry(cfg,botID) }
			wait := response.PollAfterSeconds
			if wait < 1 || wait > 30 { wait = 3 }
			time.Sleep(time.Duration(wait)*time.Second)
			continue
		}
		output, containerID, err := executeJob(*response.Job)
		completion := map[string]any{"success":err==nil,"output":output,"containerId":containerID}
		if err != nil { completion["error"]=err.Error() }
		if completeErr := postJSON(cfg.PanelURL+"/api/agents/jobs/"+response.Job.ID+"/complete", cfg.AgentToken, completion, nil); completeErr != nil {
			log.Printf("cannot complete job %s: %v", response.Job.ID, completeErr)
		}
	}
}

func publishTelemetry(cfg config, botID string) {
	if !validID(botID){return}
	name:=containerName(botID)
	inspect,err:=exec.Command("docker","inspect","-f","{{.State.Running}}|{{.State.ExitCode}}",name).CombinedOutput()
	running:=false;exitCode:=0
	if err==nil {parts:=strings.Split(strings.TrimSpace(string(inspect)),"|");running=len(parts)>0&&parts[0]=="true";if len(parts)>1{exitCode,_=strconv.Atoi(parts[1])}}
	logs,_:=exec.Command("docker","logs","--tail","250","--timestamps",name).CombinedOutput()
	payload:=map[string]any{"running":running,"exitCode":exitCode,"logs":string(logs)}
	if err:=postJSON(cfg.PanelURL+"/api/agents/bots/"+botID+"/telemetry",cfg.AgentToken,payload,nil);err!=nil{log.Printf("telemetry failed for %s: %v",botID,err)}
}

func executeJob(job runnerJob) (string,string,error) {
	if !validID(job.Bot.ID) { return "","",errors.New("invalid bot id") }
	appDir:=filepath.Join("/srv/beakohost/bots",job.Bot.ID,"app")
	switch job.Action {
	case "SYNC":
		return syncFiles(appDir,job.Bot.Files)
	case "INSTALL":
		return runInstall(appDir,job)
	case "START":
		return syncAndStart(appDir,job)
	case "STOP":
		return dockerCommand("rm","-f",containerName(job.Bot.ID))
	case "RESTART":
		return syncAndStart(appDir,job)
	default:
		return "","",fmt.Errorf("unsupported action %q",job.Action)
	}
}

func syncAndStart(appDir string, job runnerJob) (string,string,error) {
	syncOutput,_,err:=syncFiles(appDir,job.Bot.Files)
	if err!=nil{return syncOutput,"",fmt.Errorf("falha ao sincronizar antes de iniciar: %w",err)}
	entrypoint:=filepath.Join(appDir,filepath.Clean(job.Bot.Entrypoint))
	if !strings.HasPrefix(filepath.Clean(entrypoint),filepath.Clean(appDir)+string(os.PathSeparator))||!fileExists(entrypoint){
		return syncOutput,"",fmt.Errorf("arquivo inicial %q não encontrado após sincronizar %d arquivo(s)",job.Bot.Entrypoint,len(job.Bot.Files))
	}
	startOutput,containerID,err:=startContainer(appDir,job)
	output:=syncOutput
	if startOutput!=""{output+="\n"+startOutput}
	return output,containerID,err
}

func syncFiles(appDir string, files []jobFile) (string,string,error) {
	root:=filepath.Clean(appDir)
	if !strings.HasPrefix(root,"/srv/beakohost/bots/") { return "","",errors.New("unsafe workspace") }
	if err:=os.MkdirAll(root,0750);err!=nil{return "","",err}
	entries,err:=os.ReadDir(root);if err!=nil{return "","",err}
	for _,entry:=range entries { if entry.Name()!="node_modules"&&entry.Name()!=".venv" { if err=os.RemoveAll(filepath.Join(root,entry.Name()));err!=nil{return "","",err} } }
	for _,file:=range files {
		clean:=filepath.Clean(file.Path)
		if clean=="."||filepath.IsAbs(clean)||strings.HasPrefix(clean,".."+string(os.PathSeparator))||clean==".." { return "","",fmt.Errorf("unsafe file path %q",file.Path) }
		target:=filepath.Join(root,clean)
		if !strings.HasPrefix(filepath.Clean(target),root+string(os.PathSeparator)){return "","",errors.New("path escaped workspace")}
		data,err:=base64.StdEncoding.DecodeString(file.ContentBase64);if err!=nil{return "","",err}
		if err=os.MkdirAll(filepath.Dir(target),0750);err!=nil{return "","",err}
		if err=os.WriteFile(target,data,0640);err!=nil{return "","",err}
	}
	return fmt.Sprintf("%d arquivo(s) sincronizado(s)",len(files)),"",nil
}

func runInstall(appDir string, job runnerJob) (string,string,error) {
	var command []string
	if strings.HasPrefix(job.Bot.Image,"node:") {
		if fileExists(filepath.Join(appDir,"package-lock.json")) { command=[]string{"sh","-lc","npm ci --omit=dev --no-audit --no-fund || (echo '[BeakoHost] npm falhou; tentando pnpm...' && corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --prod --no-frozen-lockfile)"} } else if fileExists(filepath.Join(appDir,"package.json")) { command=[]string{"sh","-lc","npm install --omit=dev --no-audit --no-fund || (echo '[BeakoHost] npm falhou; tentando pnpm...' && corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --prod --no-frozen-lockfile)"} } else { return "","",errors.New("package.json não encontrado") }
	} else {
		if fileExists(filepath.Join(appDir,"requirements.txt")) { command=[]string{"pip","install","--no-cache-dir","-r","requirements.txt"} } else if fileExists(filepath.Join(appDir,"pyproject.toml")) { command=[]string{"pip","install","--no-cache-dir","."} } else { return "","",errors.New("requirements.txt ou pyproject.toml não encontrado") }
	}
	args:=[]string{"run","--rm","--network","bridge","--security-opt","no-new-privileges","--cap-drop","ALL","-v",appDir+":/app","-w","/app",job.Bot.Image}
	args=append(args,command...)
	return dockerCommand(args...)
}

func startContainer(appDir string, job runnerJob) (string,string,error) {
	name:=containerName(job.Bot.ID)
	_,_,_=dockerCommand("rm","-f",name)
	cpu:=fmt.Sprintf("%.3f",float64(job.Bot.Limits.CPUMillicores)/1000)
	memory:=fmt.Sprintf("%dm",job.Bot.Limits.MemoryMB)
	pids:=strconv.Itoa(job.Bot.Limits.PidsLimit)
	args:=[]string{"run","-d","--name",name,"--restart","unless-stopped","--network","bridge","--cpus",cpu,"--memory",memory,"--pids-limit",pids,"--security-opt","no-new-privileges","--cap-drop","ALL","-v",appDir+":/app","-w","/app",job.Bot.Image}
	args=append(args,job.Bot.StartCommand...)
	output,_,err:=dockerCommand(args...)
	return output,strings.TrimSpace(output),err
}

func dockerCommand(args ...string)(string,string,error){
	ctx, cancel:=context.WithTimeout(context.Background(),10*time.Minute);defer cancel()
	cmd:=exec.CommandContext(ctx,"docker",args...)
	data,err:=cmd.CombinedOutput();output:=string(data)
	if ctx.Err()==context.DeadlineExceeded{return output,"",errors.New("comando excedeu 10 minutos")}
	if err!=nil{return output,"",fmt.Errorf("docker %s: %w: %s",args[0],err,strings.TrimSpace(output))}
	return output,"",nil
}
func containerName(id string)string{return "beako-"+strings.ReplaceAll(id,"-","")}
func fileExists(path string)bool{info,err:=os.Stat(path);return err==nil&&!info.IsDir()}
func validID(v string)bool{if len(v)!=36{return false};for _,c:=range v{if !(c=='-'||c>='0'&&c<='9'||c>='a'&&c<='f'){return false}};return true}

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
