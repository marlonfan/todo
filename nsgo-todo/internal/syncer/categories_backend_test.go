package syncer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
)

// Run against the actual backend without requiring an unlocked desktop:
// TODO_CATEGORY_TEST_SERVER=/absolute/path/bin/todo-app go test -race ./internal/syncer -run TestCategoryBackend -v
func TestCategoryBackendOfflineLifecycle(t *testing.T) {
	binary := os.Getenv("TODO_CATEGORY_TEST_SERVER")
	if binary == "" {
		t.Skip("set TODO_CATEGORY_TEST_SERVER to a built Todo server")
	}
	binary, err := filepath.Abs(binary)
	if err != nil {
		t.Fatal(err)
	}
	work := t.TempDir()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	upstream := fmt.Sprintf("http://127.0.0.1:%d", port)
	config, _ := json.Marshal(map[string]any{
		"server":   map[string]any{"host": "127.0.0.1", "port": port},
		"database": map[string]any{"driver": "sqlite", "dsn": filepath.Join(work, "test.db")},
		"jwt":      map[string]any{"secret": "isolated-category-integration-test-secret", "expire": "24h"},
	})
	configPath := filepath.Join(work, "server.yaml")
	if err := os.WriteFile(configPath, config, 0600); err != nil {
		t.Fatal(err)
	}
	log, err := os.Create(filepath.Join(work, "server.log"))
	if err != nil {
		t.Fatal(err)
	}
	server := exec.Command(binary, "-config", configPath)
	server.Dir, server.Stdout, server.Stderr = work, log, log
	if err := server.Start(); err != nil {
		log.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = server.Process.Signal(os.Interrupt)
		done := make(chan error, 1)
		go func() { done <- server.Wait() }()
		select {
		case <-done:
		case <-time.After(8 * time.Second):
			_ = server.Process.Kill()
			<-done
		}
		log.Close()
		if t.Failed() {
			data, _ := os.ReadFile(log.Name())
			if len(data) > 6000 {
				data = data[len(data)-6000:]
			}
			t.Log(string(data))
		}
	})
	healthClient := &http.Client{Timeout: 200 * time.Millisecond}
	ready := false
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); {
		if response, err := healthClient.Get(upstream + "/health"); err == nil {
			response.Body.Close()
			if response.StatusCode == 200 {
				ready = true
				break
			}
		}
		time.Sleep(30 * time.Millisecond)
	}
	if !ready {
		t.Fatal("isolated backend did not start")
	}
	ctx := context.Background()
	direct, _ := api.New(upstream, "")
	if err := direct.Do(ctx, "POST", "/auth/register", map[string]string{"username": "category-integration", "password": "isolated-password", "email": "categories@example.test"}, nil, 0); err != nil {
		t.Fatal(err)
	}
	session, err := direct.Login(ctx, "category-integration", "isolated-password")
	if err != nil {
		t.Fatal(err)
	}
	var drop atomic.Bool
	var mu sync.Mutex
	type requestRecord struct {
		ID   string
		Body string
	}
	var records []requestRecord
	proxyClient := &http.Client{Timeout: 10 * time.Second}
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "read failed", 502)
			return
		}
		if r.URL.Path == "/api/categories/sync" {
			mu.Lock()
			records = append(records, requestRecord{r.Header.Get("X-Client-Op-Id"), string(body)})
			mu.Unlock()
		}
		request, err := http.NewRequestWithContext(r.Context(), r.Method, upstream+r.URL.RequestURI(), bytes.NewReader(body))
		if err != nil {
			http.Error(w, "request failed", 502)
			return
		}
		request.Header = r.Header.Clone()
		response, err := proxyClient.Do(request)
		if err != nil {
			http.Error(w, "upstream failed", 502)
			return
		}
		defer response.Body.Close()
		data, err := io.ReadAll(response.Body)
		if err != nil {
			http.Error(w, "response failed", 502)
			return
		}
		var payload struct {
			Method string `json:"method"`
		}
		_ = json.Unmarshal(body, &payload)
		if response.StatusCode == 200 && r.URL.Path == "/api/categories/sync" && payload.Method == "POST" && drop.CompareAndSwap(true, false) {
			connection, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Error(err)
				return
			}
			connection.Close()
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(response.StatusCode)
		_, _ = w.Write(data)
	}))
	defer proxy.Close()
	client, _ := api.New(proxy.URL, session.Token)
	store := storage.Store{Dir: filepath.Join(work, "profile")}
	create := func(name string) api.Category {
		t.Helper()
		var category api.Category
		if err := direct.Do(ctx, "POST", "/categories", map[string]string{"name": name, "emoji": "📁", "color": "#3788d8"}, &category, 0); err != nil {
			t.Fatal(err)
		}
		return category
	}
	remoteCategories := func() []api.Category {
		t.Helper()
		categories, err := direct.Categories(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return categories
	}
	remoteTasks := func() []api.Task {
		t.Helper()
		tasks, err := direct.Tasks(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return tasks
	}
	existing := create("已有分类")
	state := storage.Cache{Server: proxy.URL, UserID: session.User.ID, Categories: []api.Category{existing}}
	existing.Name = "离线重命名"
	state = categoryQueue(t, state, "PUT", existing)
	state = categoryQueue(t, state, "POST", api.Category{Name: "离线新分类", Emoji: "📁", Color: "#3788d8"})
	local := state.CategoryOutbox[1].Local
	firstID := state.CategoryOutbox[1].ID
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "依赖离线分类", "category_ids": []int64{local.ID}}, 0)
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	state, err = store.Cache(proxy.URL, session.User.ID)
	if err != nil || state.CategoryOutbox[1].ID != firstID {
		t.Fatal(state, err)
	}
	state, err = Flush(ctx, client, store, state)
	if err != nil || len(remoteTasks()) != 0 {
		t.Fatal("task did not wait for category", err)
	}
	t.Log("PASS: offline category/task intent survives restart and unresolved IDs never reach the task API")

	drop.Store(true)
	state, err = FlushCategories(ctx, client, store, state, false)
	if err == nil || len(state.CategoryOutbox) != 1 || !state.CategoryOutbox[0].Sent {
		t.Fatal("lost response not retained", state, err)
	}
	if categories := remoteCategories(); len(categories) != 2 {
		t.Fatal("upstream did not commit", categories)
	}
	state, err = store.Cache(proxy.URL, session.User.ID)
	if err != nil || state.CategoryOutbox[0].ID != firstID {
		t.Fatal("uncertain operation changed across restart", err)
	}
	local.Name = "送达未确认后的新名称"
	state = categoryQueue(t, state, "PUT", local)
	state, err = FlushCategories(ctx, client, store, state, false)
	if err != nil || len(state.CategoryOutbox) != 0 || state.CategoryAliases[local.ID] <= 0 {
		t.Fatal(state, err)
	}
	mapped := state.CategoryAliases[local.ID]
	mu.Lock()
	var replay []requestRecord
	for _, record := range records {
		if record.ID == firstID {
			replay = append(replay, record)
		}
	}
	mu.Unlock()
	if len(replay) != 2 || replay[0].Body != replay[1].Body || len(remoteCategories()) != 2 {
		t.Fatal("create replay was not exact or duplicated category", replay)
	}
	state, err = Flush(ctx, client, store, state)
	tasks := remoteTasks()
	if err != nil || len(state.Outbox) != 0 || len(tasks) != 1 || len(tasks[0].Categories) != 1 || tasks[0].Categories[0].ID != mapped || tasks[0].Categories[0].Name != local.Name {
		t.Fatal(state, tasks, err)
	}
	t.Log("PASS: committed create with dropped response replays once across restart; subsequent edits and task category IDs map correctly")

	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "删除分类后保留任务", "category_ids": []int64{existing.ID}}, 0)
	state = categoryQueue(t, state, "DELETE", existing)
	state, err = FlushCategories(ctx, client, store, state, true)
	if err != nil || len(state.CategoryOutbox) != 1 || len(remoteCategories()) != 2 {
		t.Fatal("delete did not wait", state, err)
	}
	state, err = Flush(ctx, client, store, state)
	if err != nil {
		t.Fatal(err)
	}
	state, err = FlushCategories(ctx, client, store, state, true)
	tasks = remoteTasks()
	if err != nil || len(state.CategoryOutbox) != 0 || len(tasks) != 2 || len(remoteCategories()) != 1 {
		t.Fatal(state, tasks, err)
	}
	for _, task := range tasks {
		if task.Title == "删除分类后保留任务" && len(task.Categories) != 0 {
			t.Fatal(task)
		}
	}
	t.Log("PASS: task writes precede category deletion; deleting category preserves tasks and removes joins")

	state = categoryQueue(t, state, "POST", api.Category{Name: "跨设备同名", Emoji: "📁", Color: "#3788d8"})
	duplicate := state.CategoryOutbox[0].Local
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "等待分类修正", "category_ids": []int64{duplicate.ID}}, 0)
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "独立任务继续"}, 0)
	create(duplicate.Name)
	state, err = FlushCategories(ctx, client, store, state, false)
	if err != nil || len(state.CategoryOutbox) != 1 || state.CategoryOutbox[0].State != "rejected" {
		t.Fatal(state, err)
	}
	state, err = Flush(ctx, client, store, state)
	if err != nil || len(state.Outbox) != 1 || len(remoteTasks()) != 3 {
		t.Fatal(state, err)
	}
	duplicate.Name = "修正后的分类"
	state = categoryQueue(t, state, "PUT", duplicate)
	state, err = FlushCategories(ctx, client, store, state, false)
	if err != nil {
		t.Fatal(err)
	}
	state, err = Flush(ctx, client, store, state)
	if err != nil || len(state.Outbox) != 0 || len(remoteTasks()) != 4 {
		t.Fatal(state, err)
	}
	t.Log("PASS: server rejection retains dependent task, independent tasks continue, and correcting name resumes synchronization")

	state = categoryQueue(t, state, "POST", api.Category{Name: "放弃本机分类", Emoji: "📁", Color: "#3788d8"})
	abandoned := state.CategoryOutbox[0].CategoryID
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "放弃分类保留任务与其他分类", "category_ids": []int64{abandoned, mapped}}, 0)
	state = DiscardCategory(state, abandoned)
	if len(state.CategoryOutbox) != 0 || !slices.Equal(categoryIDs(state.Outbox[0].Body), []int64{mapped}) {
		t.Fatal(state)
	}
	state, err = Flush(ctx, client, store, state)
	if err != nil || len(state.Outbox) != 0 || len(remoteTasks()) != 5 {
		t.Fatal(state, err)
	}
	t.Log("PASS: abandoning a local category retains task and all other category associations")
}
