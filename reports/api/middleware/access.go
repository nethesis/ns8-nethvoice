package middleware

import (
	"net/http"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/methods"
)

// reportAccessStatus returns 200 when the user of the token has a report permission
func reportAccessStatus(claims map[string]interface{}) int {
	user, _ := claims[identityKey].(string)
	if user == "admin" || user == "X" {
		return http.StatusOK
	}
	if user == "" {
		return http.StatusUnauthorized
	}
	authMap, err := methods.ParseAuthMap(nil, user)
	if err == nil && (authMap.Queues || authMap.CdrGlobal || authMap.CdrPbx || authMap.CdrPersonal) {
		return http.StatusOK
	}
	// the authorizations file is rewritten in place: do not log the user out
	if _, errFile := methods.ParseUserAuthorizationsFile(); errFile != nil {
		return http.StatusServiceUnavailable
	}
	return http.StatusUnauthorized
}

// reportAccessDenied answers a status returned by reportAccessStatus
func reportAccessDenied(c *gin.Context, status int) {
	message := supportExpiredMessage
	if status == http.StatusServiceUnavailable {
		message = "authorizations not available"
	}
	c.AbortWithStatusJSON(status, gin.H{"message": message})
}

// ReportAccess rejects users without a report permission
func ReportAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		if status := reportAccessStatus(jwt.ExtractClaims(c)); status != http.StatusOK {
			reportAccessDenied(c, status)
			return
		}
		c.Next()
	}
}
