package syncer

import (
	"context"
	"errors"
	"fmt"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func QueueProfile(state storage.Cache, user api.User, values api.ProfilePreferences) (storage.Cache, error) {
	if err := values.Validate(); err != nil {
		return state, err
	}
	if user.ID <= 0 || user.ID != state.UserID {
		return state, errors.New("账户与本地偏好所属账户不一致")
	}
	state = Clone(state)
	if state.ProfileChanges == nil {
		state.ProfileChanges = &storage.ProfileChanges{Values: api.ProfilePreferences{}, Base: api.ProfilePreferences{}}
	}
	change := state.ProfileChanges
	if change.Values == nil {
		change.Values = api.ProfilePreferences{}
	}
	if change.Base == nil {
		change.Base = api.ProfilePreferences{}
	}
	for key, original := range values.From(user) {
		if _, ok := change.Base[key]; !ok {
			change.Base[key] = original
		}
	}
	for key, value := range values {
		change.Values[key] = append([]byte(nil), value...)
	}
	change.Rejected, change.Failure = false, ""
	return state, nil
}

// PATCH preferences assigns absolute, non-secret values, so replay after an
// uncertain response is safe. No task operation IDs or passwords are reused.
func FlushProfile(ctx context.Context, client *api.Client, store storage.Store, state storage.Cache, session api.Session) (storage.Cache, api.User, error) {
	if state.ProfileChanges == nil || state.ProfileChanges.Rejected {
		return state, session.User, nil
	}
	if state.UserID <= 0 || state.UserID != session.User.ID || state.Server != session.Server {
		return state, session.User, errors.New("账户与本地偏好所属账户不一致")
	}
	state = Clone(state)
	change := state.ProfileChanges
	if err := change.Values.Validate(); err != nil {
		change.Rejected, change.Failure = true, err.Error()
		if saveErr := store.SaveCache(state); saveErr != nil {
			return state, session.User, saveErr
		}
		return state, session.User, err
	}
	var user api.User
	err := client.Do(ctx, "PATCH", "/auth/profile", change.Values, &user, 0)
	if err != nil {
		change.Failure = err.Error()
		var response *api.Error
		change.Rejected = errors.As(err, &response) && response.Status >= 400 && response.Status < 500 && response.Status != 401 && response.Status != 408 && response.Status != 429
		if saveErr := store.SaveCache(state); saveErr != nil {
			return state, session.User, saveErr
		}
		return state, session.User, err
	}
	if user.ID != state.UserID || user.ID != session.User.ID {
		return state, session.User, errors.New("服务端返回的账户不一致，本机偏好已保留")
	}
	session.User, session.Token = user, client.Token()
	// Save the acknowledged user first. If the following cache write fails,
	// the still-persisted intent can be safely replayed with the same values.
	if err := store.SaveSession(session); err != nil {
		return state, user, fmt.Errorf("服务器已保存设置，但本地会话写入失败，请恢复本机存储后刷新：%w", err)
	}
	confirmed := Clone(state)
	confirmed.ProfileChanges = nil
	if err := store.SaveCache(confirmed); err != nil {
		return state, user, fmt.Errorf("服务器已保存设置，但本机确认写入失败；将安全重试：%w", err)
	}
	return confirmed, user, nil
}
