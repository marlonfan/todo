package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Vary", "Origin")
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, Depth, Destination, Overwrite, If-Match, If-None-Match, X-Client-Op-Id, X-Client-Submitted-At, X-Client-Submit-Source")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE, PROPFIND, REPORT")

		isBrowserPreflight := c.Request.Method == http.MethodOptions &&
			origin != "" && c.GetHeader("Access-Control-Request-Method") != ""
		if isBrowserPreflight && !isDAVPath(c.Request.URL.Path) {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isDAVPath(path string) bool {
	return path == "/dav" || strings.HasPrefix(path, "/dav/") || path == "/.well-known/caldav"
}
