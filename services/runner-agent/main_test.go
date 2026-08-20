package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSecretFileLifecycle(t *testing.T) {
	old := secretDirectory
	secretDirectory = t.TempDir()
	t.Cleanup(func() { secretDirectory = old })
	botID := "123e4567-e89b-12d3-a456-426614174000"
	path, err := writeSecretFile(botID, []jobEnv{{Key: "BOT_TOKEN", Value: "abc = 'quoted'"}, {Key: "MODE", Value: "production"}})
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("expected 0600, got %o", info.Mode().Perm())
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "BOT_TOKEN=abc = 'quoted'\nMODE=production\n" {
		t.Fatalf("unexpected content: %q", content)
	}
	cleanupSecretFiles(botID)
	if _, err = os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("temporary secret was not removed")
	}
}

func TestSecretValidationDoesNotLeakValue(t *testing.T) {
	old := secretDirectory
	secretDirectory = t.TempDir()
	t.Cleanup(func() { secretDirectory = old })
	secret := "never-print-this"
	_, err := writeSecretFile("123e4567-e89b-12d3-a456-426614174000", []jobEnv{{Key: "BOT_TOKEN", Value: secret + "\n"}})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatal("error leaked secret")
	}
	files, _ := filepath.Glob(filepath.Join(secretDirectory, "*"))
	if len(files) != 0 {
		t.Fatal("failed write left a secret file")
	}
}
