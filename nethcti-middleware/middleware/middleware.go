/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package middleware

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"
	"github.com/nqd/flat"
	"golang.org/x/time/rate"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/appleboy/gin-jwt/v3/core"
	gojwt "github.com/golang-jwt/jwt/v5"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/methods"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

type login struct {
	Username string `form:"username" json:"username" binding:"required"`
	Password string `form:"password" json:"password" binding:"required"`
}

var jwtMiddleware *jwt.GinJWTMiddleware
var identityKey = "id"

// ErrPasswordExpired is returned by the login when the credentials are
// right but the password must be changed before logging in
var ErrPasswordExpired = errors.New("password_expired")

// Context key of the password policy returned with ErrPasswordExpired
const passwordPolicyKey = "password_policy"

// ResetJWTMiddleware clears the cached JWT middleware instance.
// Used primarily in tests to force reinitialization with a different configuration.
func ResetJWTMiddleware() {
	jwtMiddleware = nil
}

func InstanceJWT() *jwt.GinJWTMiddleware {
	if jwtMiddleware == nil {
		jwtMiddleware = InitJWT()
	}
	return jwtMiddleware
}

// proxyTrusted reports whether the SSO mint request actually came through the
// Traefik forwardAuth chain: Traefik injects SsoProxySecret into SsoProxyHeader
// after forwardAuth, so a direct local call (bypassing the SP check) lacks it.
// When no proxy secret is configured the check is disabled (backward compatible).
func proxyTrusted(c *gin.Context) bool {
	want := configuration.Config.SsoProxySecret
	if want == "" {
		return true
	}
	got := c.GetHeader(configuration.Config.SsoProxyHeader)
	return subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

func InitJWT() *jwt.GinJWTMiddleware {
	// define jwt middleware
	authMiddleware, errDefine := jwt.New(&jwt.GinJWTMiddleware{
		Realm:       "nethcti",
		Key:         []byte(configuration.Config.Secret_jwt),
		Timeout:     time.Duration(configuration.Config.JwtTimeoutHours) * time.Hour, // default 2 weeks, configurable
		IdentityKey: identityKey,
		Authenticator: func(c *gin.Context) (interface{}, error) {
			// Ensure jwtMiddleware is initialized before using it
			if jwtMiddleware == nil {
				jwtMiddleware = InitJWT()
			}

			// Trusted SSO login: the forwardAuth-guarded front-end injected the
			// pre-authenticated username header, no user password is required.
			var username, password string
			useSso := false
			if configuration.Config.SsoTrustedSecret != "" && proxyTrusted(c) {
				ssoUser := strings.TrimSpace(c.GetHeader(configuration.Config.SsoUserHeader))
				if ssoUser != "" {
					useSso = true
					username = strings.ToLower(ssoUser)
					logs.Log("[INFO][AUTH] trusted SSO login for user " + username)
				}
			}
			if !useSso {
				// check login credentials exists
				var loginVals login
				if err := c.ShouldBind(&loginVals); err != nil {
					logs.Log("[AUTH] Missing login values")
					return "", jwt.ErrMissingLoginValues
				}
				username = loginVals.Username
				password = loginVals.Password
			}

			// Perform login on the old NetCTI server
			loginMode := methods.LoginPassword
			if useSso {
				loginMode = methods.LoginSSO
			}
			// the session is keyed by the account username, whatever name
			// (extension, case) the user logged in with
			accountUsername, NethCTIToken, err := methods.LoginV1(username, password, loginMode)
			if err != nil {
				// the V1 server rejects an expired password like a wrong one
				if !useSso && errors.Is(err, methods.ErrV1LoginRefused) {
					if expired, policy := methods.IsPasswordExpired(c.Request.Context(), username, password); expired {
						logs.Log("[INFO][AUTH] password expired for user " + username)
						c.Set(passwordPolicyKey, policy)
						return nil, ErrPasswordExpired
					}
				}
				return nil, jwt.ErrFailedAuthentication
			}

			// Login is successful. Middleware returns a JWT.

			// Cache the password expiration info, the user portal needs the password
			if !useSso {
				methods.RefreshPasswordInfo(accountUsername, password)
			}

			return methods.UpsertUserSession(accountUsername, NethCTIToken), nil
		},
		PayloadFunc: func(data any) gojwt.MapClaims {
			// read current user
			if userSession, ok := data.(*models.UserSession); ok {
				// Note: otp_verified is always false on initial login.
				// It will be set to true only after OTP verification via regenerateUserToken.
				claims := methods.BuildUserJWTClaims(methods.UserJWTOptions{
					Username:    userSession.Username,
					OTPVerified: false,
					IssuedAt:    time.Now(),
				})
				return gojwt.MapClaims(claims)
			}

			// return empty claims map
			return gojwt.MapClaims{}
		},
		IdentityHandler: func(c *gin.Context) interface{} {
			// handle identity and extract claims
			claims := jwt.ExtractClaims(c)

			username := claims[identityKey].(string)

			// return username
			return username
		},
		Authorizer: func(c *gin.Context, data any) bool {
			// Extract claims and session info
			claims := jwt.ExtractClaims(c)
			username := claims[identityKey].(string)

			reqMethod := c.Request.Method
			// path only: the query string may carry the token (?jwt=)
			reqURI := c.Request.URL.Path
			JWTToken := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")

			// Check if session exists and token is valid
			if !store.SessionHasToken(username, JWTToken) {
				logs.Log("[ERROR][AUTH] authorization failed for user " + username + " (session not found or invalid token). " + reqMethod + " " + reqURI)
				return false
			}

			// match the exact route of the OTP verification endpoint
			isOTPVerifyEndpoint := c.FullPath() == "/2fa/verify-otp"

			// Check 2FA requirement (only for JWT token authentication, not API key)
			// Use the otp_verified claim from the JWT token (not from session)
			if !isOTPVerifyEndpoint {
				// If 2FA is enabled but OTP claim doesn't exist or is false, deny access
				if methods.OTPPending(claims) {
					logs.Log("[ERROR][AUTH] authorization failed for user " + username + " (2FA required but OTP not verified in token). " + reqMethod + " " + reqURI)
					return false
				}
			}

			reqBody := ""
			if reqMethod == "POST" || reqMethod == "PUT" {
				// extract body
				var buf bytes.Buffer
				tee := io.TeeReader(c.Request.Body, &buf)
				body, _ := io.ReadAll(tee)
				c.Request.Body = io.NopCloser(&buf)

				// convert to map and flat it
				var jsonDyn map[string]interface{}
				json.Unmarshal(body, &jsonDyn)
				in, _ := flat.Flatten(jsonDyn, nil)

				// search for sensitve data, in sensitive list
				for k := range in {
					for _, s := range configuration.Config.SensitiveList {
						if strings.Contains(strings.ToLower(k), strings.ToLower(s)) {
							in[k] = "XXX"
						}
					}
				}

				// unflat the map
				out, _ := flat.Unflatten(in, nil)

				// convert to json string
				jsonOut, _ := json.Marshal(out)

				// compose string
				reqBody = string(jsonOut)
			}

			logs.Log("[INFO][AUTH] authorization success for user " + claims["id"].(string) + ". " + reqMethod + " " + reqURI + " " + reqBody)

			return true
		},
		LoginResponse: func(c *gin.Context, token *core.Token) {
			// Extract the JWT token from the Authorization header
			tokenObj, _ := InstanceJWT().ParseTokenString(token.AccessToken)
			claims := jwt.ExtractClaimsFromToken(tokenObj)

			// Store the JWT token in the UserSession
			username, _ := claims[identityKey].(string)
			stored := false
			store.ModifySessions(func(userSessions map[string]*models.UserSession) {
				if userSession := userSessions[username]; userSession != nil {
					userSession.JWTTokens = append(userSession.JWTTokens, token.AccessToken)
					stored = true
				}
			})
			if !stored {
				// the session has been revoked while logging in
				logs.Log("[ERROR][AUTH] session not found after login for user " + username)
				c.JSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "session not found"})
				return
			}

			// Save sessions to disk immediately
			if err := store.SaveSessions(); err != nil {
				logs.Log("[ERROR][AUTH] Failed to save sessions after login: " + err.Error())
			}

			c.JSON(200, gin.H{"code": 200, "expire": time.Unix(token.ExpiresAt, 0), "token": token.AccessToken})
		},
		LogoutResponse: func(c *gin.Context) {
			// Extract the JWT token from the Authorization header
			JWTToken := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
			tokenObj, _ := InstanceJWT().ParseTokenString(JWTToken)
			claims := jwt.ExtractClaimsFromToken(tokenObj)
			username := claims[identityKey].(string)

			store.RemoveJWTToken(username, JWTToken)

			c.JSON(200, gin.H{"code": 200})
		},
		Unauthorized: func(c *gin.Context, code int, message string) {
			var data interface{}
			if policy, ok := c.Get(passwordPolicyKey); ok {
				// policy of the new password, for the expired password form
				data = gin.H{"policy": policy}
			}
			c.JSON(code, structs.Map(models.StatusUnauthorized{
				Code:    code,
				Message: message,
				Data:    data,
			}))
		},
		TokenLookup:   "header: Authorization, query: jwt",
		TokenHeadName: "Bearer",
		TimeFunc:      time.Now,
	})

	// check middleware errors
	if errDefine != nil {
		logs.Log("[AUTH] middleware definition error")
	}

	// init middleware
	errInit := authMiddleware.MiddlewareInit()

	// check error on initialization
	if errInit != nil {
		logs.Log("[AUTH] middleware initialization error")
	}

	// return object
	return authMiddleware
}

// RequireSuperAdmin middleware validates super admin bearer token with constant-time comparison
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Step 1: Check IP whitelist first
		clientIP := c.ClientIP()
		isIPAllowed := false

		for _, allowed := range configuration.Config.SuperAdminAllowedIPs {
			// Check if it's a CIDR range
			if strings.Contains(allowed, "/") {
				_, ipnet, err := net.ParseCIDR(allowed)
				if err != nil {
					logs.Log("[WARNING][AUTH] Invalid CIDR notation in allowed IPs: " + allowed)
					continue
				}
				if ipnet.Contains(net.ParseIP(clientIP)) {
					isIPAllowed = true
					break
				}
			} else {
				// Direct IP comparison
				if clientIP == allowed {
					isIPAllowed = true
					break
				}
			}
		}

		if !isIPAllowed {
			logs.Log("[ERROR][AUTH] super admin access denied: IP " + clientIP + " not in allowed list")
			c.AbortWithStatusJSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
				Code:    http.StatusForbidden,
				Message: "access denied: IP not in allowed list",
				Data:    nil,
			}))
			return
		}

		// Step 2: Check bearer token
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")

		// Extract bearer token
		var providedToken string
		if authHeader != "" {
			const bearerScheme = "Bearer "
			if len(authHeader) > len(bearerScheme) && strings.HasPrefix(authHeader, bearerScheme) {
				providedToken = authHeader[len(bearerScheme):]
			}
		}

		// Get expected super admin token from configuration
		expectedToken := configuration.Config.SuperAdminToken

		// Perform constant-time comparison to prevent timing attacks
		// If either is empty, comparison will return false
		if expectedToken == "" || providedToken == "" {
			logs.Log("[ERROR][AUTH] super admin authentication failed: missing or empty token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
				Code:    http.StatusUnauthorized,
				Message: "super admin authentication required",
				Data:    nil,
			}))
			return
		}

		// Constant-time comparison prevents timing attacks
		if subtle.ConstantTimeCompare([]byte(providedToken), []byte(expectedToken)) != 1 {
			logs.Log("[ERROR][AUTH] super admin authentication failed: invalid token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
				Code:    http.StatusUnauthorized,
				Message: "super admin authentication required",
				Data:    nil,
			}))
			return
		}

		logs.Log(fmt.Sprintf("[INFO][INTERNAL] super admin request authorized from %s. %s %s", clientIP, c.Request.Method, c.Request.URL.Path))
		c.Next()
	}
}

// RequireCapabilities ensures the current user has the requested capability server-side.
func RequireCapabilities(capability string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract claims from JWT
		claims := jwt.ExtractClaims(c)
		username, ok := claims["id"].(string)
		if !ok || username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid user"})
			return
		}

		caps, err := store.GetUserCapabilities(username)
		if err != nil {
			logs.Log("[AUTH][ERROR] authorization failed for user " + username + ": failed to resolve user capabilities: " + err.Error())
			c.AbortWithStatusJSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
				Code:    http.StatusForbidden,
				Message: "forbidden: missing capability",
				Data:    nil,
			}))
			return
		}

		if allowed, ok := caps[capability]; ok && allowed {
			c.Next()
			return
		}

		logs.Log("[AUTH][ERROR] authorization failed for user " + username + ": missing or insufficient capability " + capability)
		c.AbortWithStatusJSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
			Code:    http.StatusForbidden,
			Message: "forbidden: missing capability",
			Data:    nil,
		}))
	}
}

// BodyLimit rejects requests whose body exceeds maxBytes before any downstream
// binding reads it, so unauthenticated or semi-trusted routes cannot be used
// to exhaust memory with oversized payloads.
func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

const rateLimiterStaleAfter = 3 * time.Minute
const rateLimiterCleanupInterval = time.Minute

type rateLimiterVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter throttles requests per client IP with a token-bucket limiter, as a
// coarse safety net across every route (BodyLimit bounds one request's body,
// not how many requests run at once). rps is the sustained rate, burst the
// number of requests allowed instantly.
func RateLimiter(rps rate.Limit, burst int) gin.HandlerFunc {
	visitors := make(map[string]*rateLimiterVisitor)
	var mu sync.Mutex

	go func() {
		for {
			time.Sleep(rateLimiterCleanupInterval)
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > rateLimiterStaleAfter {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		v, exists := visitors[ip]
		if !exists {
			v = &rateLimiterVisitor{limiter: rate.NewLimiter(rps, burst)}
			visitors[ip] = v
		}
		v.lastSeen = time.Now()
		limiter := v.limiter
		mu.Unlock()

		if !limiter.Allow() {
			logs.Log("[INFO][AUTH] rate limit exceeded for " + ip + " on " + c.Request.URL.Path)
			c.JSON(http.StatusTooManyRequests, gin.H{"code": http.StatusTooManyRequests, "message": "too many requests", "data": nil})
			c.Abort()
			return
		}

		c.Next()
	}
}
