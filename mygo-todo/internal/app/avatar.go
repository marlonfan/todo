package app

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const avatarMaxBytes = 1 << 20

func validateAvatar(data []byte) error {
	if len(data) == 0 || len(data) > avatarMaxBytes {
		return errors.New("头像应为不超过 1 MB 的图片")
	}
	conf, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || conf.Width <= 0 || conf.Height <= 0 || int64(conf.Width)*int64(conf.Height) > 16000000 {
		return errors.New("无法读取头像，请使用不超过 1600 万像素的 PNG、JPEG、GIF 或 WebP 图片")
	}
	return nil
}
func avatarBitmap(data []byte) (*ui.Bitmap, error) {
	if err := validateAvatar(data); err != nil {
		return nil, err
	}
	return ui.DecodeBitmap(data)
}
func avatarDataURL(data []byte) (string, *ui.Bitmap, error) {
	if err := validateAvatar(data); err != nil {
		return "", nil, err
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", nil, errors.New("无法解码头像图片")
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > 256 || h > 256 {
		if w >= h {
			h = max(1, h*256/w)
			w = 256
		} else {
			w = max(1, w*256/h)
			h = 256
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Src, nil)
	var buf bytes.Buffer
	if err := png.Encode(&buf, dst); err != nil {
		return "", nil, err
	}
	preview, err := ui.DecodeBitmap(buf.Bytes())
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), preview, err
}
func readAvatarFile(path string) (string, *ui.Bitmap, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", nil, fmt.Errorf("无法打开头像文件：%w", err)
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, avatarMaxBytes+1))
	if err != nil {
		return "", nil, fmt.Errorf("无法读取头像文件：%w", err)
	}
	return avatarDataURL(data)
}
func avatarBytes(ctx context.Context, raw string) ([]byte, error) {
	if strings.HasPrefix(raw, "data:image/") {
		head, body, ok := strings.Cut(raw, ",")
		if !ok || !strings.HasSuffix(head, ";base64") || len(body) > base64.StdEncoding.EncodedLen(avatarMaxBytes) {
			return nil, errors.New("头像数据格式无效或超过 1 MB")
		}
		data, err := base64.StdEncoding.DecodeString(body)
		if err != nil {
			return nil, errors.New("头像图片的 Base64 数据无效")
		}
		return data, nil
	}
	valid := func(raw string) bool {
		u, err := url.Parse(raw)
		return err == nil && u.Host != "" && (u.Scheme == "https" || u.Scheme == "http") && u.User == nil && u.Fragment == ""
	}
	if !valid(raw) {
		return nil, errors.New("头像地址应为 http(s) 图片地址或图片数据")
	}
	// An avatar never receives the Todo token, cookies or an account HTTP client.
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 || !valid(req.URL.String()) {
			return errors.New("头像跳转地址无效")
		}
		return nil
	}}
	req, err := http.NewRequestWithContext(ctx, "GET", raw, nil)
	if err != nil {
		return nil, errors.New("头像地址无效")
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, errors.New("无法加载头像，请检查图片地址与网络后重试")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("头像服务返回 HTTP %d，请检查图片地址", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, avatarMaxBytes+1))
	if err != nil {
		return nil, errors.New("无法读取头像，请重试")
	}
	return data, nil
}
func (a *App) loadAvatar() {
	raw := a.session.User.AvatarURL
	if raw == a.avatarSource {
		return
	}
	a.avatarSource, a.avatarFailure, a.avatar = raw, "", nil
	if raw == "" || a.win == nil {
		return
	}
	epoch, win, ctx := a.epoch, a.win, a.ctx
	go func() {
		data, err := avatarBytes(ctx, raw)
		var bitmap *ui.Bitmap
		if err == nil {
			bitmap, err = avatarBitmap(data)
		}
		if win.IsDestroyed() {
			return
		}
		win.Update(func() {
			if a.epoch != epoch || a.avatarSource != raw {
				return
			}
			a.avatar = bitmap
			if err != nil {
				a.avatarFailure = err.Error()
			}
		})
	}()
}
func (a *App) chooseAvatar() {
	if a.busy {
		return
	}
	win := a.win
	a.run(func(context.Context) (func(), error) {
		paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{Parent: win, Title: "选择账户头像", Filters: []mygo.FileFilter{{Name: "图片", Extensions: []string{"png", "jpg", "jpeg", "gif", "webp"}}}})
		if err != nil {
			return nil, fmt.Errorf("选择头像失败：%w", err)
		}
		if len(paths) == 0 {
			return nil, nil
		}
		raw, preview, err := readAvatarFile(paths[0])
		if err != nil {
			return nil, err
		}
		return func() { a.accountDraft.AvatarURL, a.accountDraft.AvatarPreview = raw, preview }, nil
	})
}
func (a *App) saveAvatar() {
	if a.busy || a.client == nil {
		return
	}
	raw := strings.TrimSpace(a.accountDraft.AvatarURL)
	if raw == "" {
		a.saveAccountProfile(map[string]any{"avatar_url": ""}, "已移除账户头像", a.closeAccountEditor)
		return
	}
	a.run(func(ctx context.Context) (func(), error) {
		data, err := avatarBytes(ctx, raw)
		if err != nil {
			return nil, err
		}
		preview, err := avatarBitmap(data)
		if err != nil {
			return nil, err
		}
		if strings.HasPrefix(raw, "data:") {
			raw, preview, err = avatarDataURL(data)
			if err != nil {
				return nil, err
			}
		}
		return func() {
			a.accountDraft.AvatarURL, a.accountDraft.AvatarPreview = raw, preview
			a.saveAccountProfile(map[string]any{"avatar_url": raw}, "已保存账户头像", a.closeAccountEditor)
		}, nil
	})
}
