package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/nsgotest"

	"nsgo-todo/internal/api"
)

func TestMain(m *testing.M) {
	nsgotest.Main(m)
}

type fakeTodoServer struct {
	mu         sync.Mutex
	nextTaskID int64
	nextCatID  int64
	seq        int64
	tasks      []api.Task
	categories []api.Category
	user       api.User
}

func newFakeTodoServer(t *testing.T) (*httptest.Server, *fakeTodoServer) {
	t.Helper()
	now := time.Date(2026, 11, 22, 6, 0, 0, 0, time.UTC)
	todayDue := time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC) // 18:00 Asia/Shanghai on 2026-11-22

	f := &fakeTodoServer{
		nextTaskID: 10,
		nextCatID:  10,
		seq:        1,
		user: api.User{
			ID:       1,
			Username: "marlon",
			Email:    "marlon@example.com",
			Timezone: "Asia/Shanghai",
		},
		categories: []api.Category{
			{ID: 1, Name: "工作", Emoji: "💼", Color: "#C46849"},
		},
		tasks: []api.Task{
			{
				ID:        1,
				Title:     "发布 NSGo 安卓初版",
				Status:    "pending",
				Priority:  3,
				Revision:  1,
				DueDate:   &todayDue,
				AllDay:    true,
				CreatedAt: now,
				UpdatedAt: now,
				Categories: []api.Category{
					{ID: 1, Name: "工作", Emoji: "💼", Color: "#C46849"},
				},
			},
			{
				ID:          2,
				Title:       "整理周报草稿",
				Description: "### 本周进展\n- [x] 完成架构设计\n- [ ] 发送给团队审阅",
				Status:      "pending",
				Priority:    1,
				Revision:    1,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		var req map[string]string
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req["username"] != "marlon" || req["password"] != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "用户名或密码错误"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"token": "test-jwt-token",
			"user":  f.user,
		})
	})

	mux.HandleFunc("/api/auth/me", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		_ = json.NewEncoder(w).Encode(f.user)
	})

	mux.HandleFunc("/api/ai/config", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"configured": true,
			"config": api.AIConfig{
				Protocol: api.AIProtocolOpenAI,
				BaseURL:  "https://api.openai.com/v1",
				APIKey:   "sk-demo",
				ModelID:  "gpt-4o-mini",
			},
		})
	})

	mux.HandleFunc("/api/categories", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		switch r.Method {
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(f.categories)
		case http.MethodPost:
			var c api.Category
			_ = json.NewDecoder(r.Body).Decode(&c)
			f.nextCatID++
			c.ID = f.nextCatID
			f.categories = append(f.categories, c)
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(c)
		}
	})

	mux.HandleFunc("/api/categories/sync", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		var req struct {
			Method string       `json:"method"`
			Name   string       `json:"name"`
			Emoji  string       `json:"emoji"`
			Color  string       `json:"color"`
			ID     int64        `json:"id"`
			Cat    api.Category `json:"category"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Name != "" {
			f.nextCatID++
			c := api.Category{ID: f.nextCatID, Name: req.Name, Emoji: req.Emoji, Color: req.Color}
			f.categories = append(f.categories, c)
			_ = json.NewEncoder(w).Encode(map[string]any{"category": c})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	mux.HandleFunc("/api/tasks/sync", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		cursor := r.URL.Query().Get("cursor")
		if cursor == "" || cursor == "v1:0" {
			_ = json.NewEncoder(w).Encode(api.TaskChanges{
				Tasks:      f.tasks,
				NextCursor: "v1:" + strconv.FormatInt(f.seq, 10),
				HasMore:    false,
			})
			return
		}
		_ = json.NewEncoder(w).Encode(api.TaskChanges{
			NextCursor: "v1:" + strconv.FormatInt(f.seq, 10),
			HasMore:    false,
		})
	})

	mux.HandleFunc("/api/tasks/next-occurrences", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]api.Occurrence{})
	})

	mux.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		switch r.Method {
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(f.tasks)
		case http.MethodPost:
			var body struct {
				Title       string     `json:"title"`
				Description string     `json:"description"`
				Status      string     `json:"status"`
				Priority    int        `json:"priority"`
				AllDay      bool       `json:"all_day"`
				DueDate     *time.Time `json:"due_date"`
				StartTime   *time.Time `json:"start_time"`
				CategoryIDs []int64    `json:"category_ids"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			f.nextTaskID++
			f.seq++
			now := time.Now().UTC()
			created := api.Task{
				ID:          f.nextTaskID,
				Title:       body.Title,
				Description: body.Description,
				Status:      "pending",
				Priority:    body.Priority,
				AllDay:      body.AllDay,
				DueDate:     body.DueDate,
				StartTime:   body.StartTime,
				Revision:    1,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			for _, cid := range body.CategoryIDs {
				for _, c := range f.categories {
					if c.ID == cid {
						created.Categories = append(created.Categories, c)
					}
				}
			}
			f.tasks = append(f.tasks, created)
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(created)
		}
	})

	mux.HandleFunc("/api/tasks/", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		rest := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
		parts := strings.Split(rest, "/")
		id, _ := strconv.ParseInt(parts[0], 10, 64)
		idx := -1
		for i := range f.tasks {
			if f.tasks[i].ID == id {
				idx = i
				break
			}
		}
		if idx < 0 {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if len(parts) == 2 && parts[1] == "status" && r.Method == http.MethodPatch {
			var body struct {
				Status string `json:"status"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			f.tasks[idx].Status = body.Status
			f.tasks[idx].Revision++
			f.seq++
			_ = json.NewEncoder(w).Encode(f.tasks[idx])
			return
		}
		if len(parts) == 1 && r.Method == http.MethodPut {
			var body struct {
				Title       string `json:"title"`
				Description string `json:"description"`
				Status      string `json:"status"`
				Priority    int    `json:"priority"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			f.tasks[idx].Title = body.Title
			f.tasks[idx].Description = body.Description
			if body.Status != "" {
				f.tasks[idx].Status = body.Status
			}
			f.tasks[idx].Priority = body.Priority
			f.tasks[idx].Revision++
			f.seq++
			_ = json.NewEncoder(w).Encode(f.tasks[idx])
			return
		}
		if len(parts) == 1 && r.Method == http.MethodDelete {
			f.tasks = append(f.tasks[:idx], f.tasks[idx+1:]...)
			f.seq++
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, f
}

func TestMobileEndToEndFlow(t *testing.T) {
	srv, _ := newFakeTodoServer(t)

	app := nsgotest.Start(
		t,
		RootWithOptions(Options{DefaultServer: srv.URL}),
		nsgotest.Size(390, 844),
		nsgotest.WallTime(time.Date(2026, 11, 22, 8, 0, 0, 0, time.UTC)), // 16:00 Asia/Shanghai
	)

	// 1. Login screen renders and logs in
	app.WaitFor("id:auth-username", 2*time.Second)
	app.Type("id:auth-username", "marlon")
	app.Type("id:auth-password", "secret")
	app.Press("id:auth-submit")

	// 2. Tasks tab loads with today's task from fake server
	app.WaitFor("text:发布 NSGo 安卓初版", 3*time.Second)

	// 3. Quick-add a new task via FAB -> bottom sheet
	app.Press("id:tasks-fab-add")
	app.WaitFor("id:quick-title-input", 2*time.Second)
	app.Type("id:quick-title-input", "买咖啡豆")
	app.Press("id:quick-submit-btn")
	app.WaitFor("text:买咖啡豆", 3*time.Second)

	// 4. Open left navigation drawer, switch to All filter, and verify inbox task appears
	app.Press("id:tasks-drawer-btn")
	app.WaitFor("id:drawer-filter-all", 2*time.Second)
	app.Press("id:drawer-filter-all")
	app.WaitFor("text:整理周报草稿", 2*time.Second)

	// 5. Open task detail, verify native Markdown preview renders & bottom tab bar hides, then edit & save
	app.Press("label:整理周报草稿")
	app.WaitFor("id:detail-markdown-preview", 2*time.Second)
	app.WaitFor("text:本周进展", 2*time.Second)
	app.WaitFor("text:完成架构设计", 2*time.Second)
	app.Press("id:detail-desc-mode-toggle")
	app.WaitFor("id:detail-desc-input", 2*time.Second)
	app.Clear("id:detail-title-input")
	app.Type("id:detail-title-input", "整理周报并发送")
	app.Press("id:detail-save-btn")
	app.WaitFor("text:整理周报并发送", 3*time.Second)

	// 6. Toggle completion (with celebration animation) and verify it moves to Completed filter via left drawer
	app.Press("label:切换完成 发布 NSGo 安卓初版")
	app.Advance(400 * time.Millisecond)
	app.Press("id:tasks-drawer-btn")
	app.WaitFor("id:drawer-filter-completed", 2*time.Second)
	app.Press("id:drawer-filter-completed")
	app.WaitFor("text:发布 NSGo 安卓初版", 3*time.Second)

	// 7. Navigate to Categories tab, create a new category
	app.Press("role:tab 分类")
	app.WaitFor("id:categories-add-btn", 2*time.Second)
	app.Press("id:categories-add-btn")
	app.WaitFor("id:category-name-input", 2*time.Second)
	app.Type("id:category-name-input", "阅读")
	app.Press("id:category-save-btn")
	app.WaitFor("text:阅读", 3*time.Second)

	// 8. Navigate to Sync tab
	app.Press("role:tab 同步")
	app.WaitFor("id:sync-now-btn", 2*time.Second)

	// 9. Navigate to Settings tab, verify AI config synced & save Doubao ASR settings
	app.Press("role:tab 我的")
	app.WaitFor("id:theme-dark", 2*time.Second)
	app.Press("id:theme-dark")
	app.Press("id:theme-light")
	app.WaitFor("text:已同步 · gpt-4o-mini", 3*time.Second)
	app.Press("id:settings-voice-asr-row")
	app.WaitFor("id:doubao-appid-input", 2*time.Second)
	app.Type("id:doubao-appid-input", "685343")
	app.Type("id:doubao-appkey-input", "secret-key")
	app.Type("id:doubao-deviceid-input", "1234567890123")
	app.Press("id:doubao-save-btn")
	app.WaitFor("text:已配置 · 长按 + 可语音新建", 3*time.Second)
}

func TestAndroidWarmTabBarAndDefaultServer(t *testing.T) {
	// Verify default server is https://todo.marlon.life
	if api.DefaultServer != "https://todo.marlon.life" {
		t.Fatalf("expected DefaultServer https://todo.marlon.life, got %q", api.DefaultServer)
	}

	srv, _ := newFakeTodoServer(t)

	app := nsgotest.Start(
		t,
		RootWithOptions(Options{DefaultServer: srv.URL}),
		nsgotest.Size(390, 844),
		nsgotest.WallTime(time.Date(2026, 11, 22, 8, 0, 0, 0, time.UTC)),
		nsgotest.Environment(core.Environment{
			OS:    core.OSAndroid,
			Idiom: core.IdiomPhone,
		}),
	)

	app.WaitFor("id:auth-username", 2*time.Second)
	app.Type("id:auth-username", "marlon")
	app.Type("id:auth-password", "secret")
	app.Press("id:auth-submit")
	app.WaitFor("text:发布 NSGo 安卓初版", 3*time.Second)

	// Verify our bespoke compact warm tab bar (<= 56pt height) is mounted and works on Android
	bar := app.Find("id:tab-bar")
	if h := bar.Bounds().Size.Height; h <= 0 || h > 56 {
		t.Fatalf("expected compact warm tab bar height <= 56pt, got %v", h)
	}
	app.Press("role:tab 分类")
	app.WaitFor("id:categories-add-btn", 2*time.Second)
}
