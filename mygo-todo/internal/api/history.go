package api

import (
	"context"
	"errors"
)

// OccurrenceHistoryThrough refreshes at least the previously loaded depth.
// A failed later page never returns a partial replacement for the offline cache.
func (c *Client) OccurrenceHistoryThrough(ctx context.Context, through int) (OccurrencePage, error) {
	var result OccurrencePage
	for cursor := 0; ; {
		page, err := c.OccurrenceHistory(ctx, cursor)
		if err != nil {
			return OccurrencePage{}, err
		}
		if page.NextCursor < cursor || (page.HasMore && page.NextCursor <= cursor) {
			return OccurrencePage{}, errors.New("服务器未返回有效的历史分页位置")
		}
		result.Items = MergeOccurrenceItems(result.Items, page.Items)
		result.NextCursor, result.HasMore = page.NextCursor, page.HasMore
		if !page.HasMore || page.NextCursor >= through {
			return result, nil
		}
		cursor = page.NextCursor
	}
}

// The API currently uses offsets. Updates between pages can repeat a row; keep
// one identity and let the newer response win, without changing the raw cursor.
func MergeOccurrenceItems(old, next []Occurrence) []Occurrence {
	type key struct {
		task     int64
		instance string
	}
	result := make([]Occurrence, 0, len(old)+len(next))
	positions := make(map[key]int, len(old)+len(next))
	for _, pool := range [][]Occurrence{old, next} {
		for _, item := range pool {
			k := key{item.TaskID, item.InstanceID}
			if index, ok := positions[k]; ok {
				result[index] = item
			} else {
				positions[k] = len(result)
				result = append(result, item)
			}
		}
	}
	return result
}
