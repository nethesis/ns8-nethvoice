/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package middleware

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"
	"github.com/nqd/flat"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/appleboy/gin-jwt/v3/core"
	gojwt "github.com/golang-jwt/jwt/v5"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/methods"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/utils"
)

type login struct {
	Username string `form:"username" json:"username" binding:"required"`
	Password string `form:"password" json:"password" binding:"required"`
}

var jwtMiddleware *jwt.GinJWTMiddleware
var identityKey = "id"

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

func InitJWT() *jwt.GinJWTMiddleware {
	// define jwt middleware
	authMiddleware, errDefine := jwt.New(&jwt.GinJWTMiddleware{
		Realm:       "nethcti",
		Key:         []byte(configuration.Config.Secret_jwt),
		Timeout:     time.Hour * 24 * 14, // 2 weeks
		IdentityKey: identityKey,
		Authenticator: func(c *gin.Context) (interface{}, error) {
			// Ensure jwtMiddleware is initialized before using it
			if jwtMiddleware == nil {
				jwtMiddleware = InitJWT()
			}

			// check login credentials exists
			var loginVals login
			if err := c.ShouldBind(&loginVals); err != nil {
				logs.Log("[AUTH] Missing login values")
				return "", jwt.ErrMissingLoginValues
			}

			// set login credentials
			username := loginVals.Username
			password := loginVals.Password

			// Perform login on the old NetCTI server
			netCtiLoginURL := configuration.Config.V1Protocol + "://" + configuration.Config.V1ApiEndpoint + configuration.Config.V1ApiPath + "/authentication/login"
			payload := map[string]string{"username": username, "password": password}
			payloadBytes, _ := json.Marshal(payload)

			req, err := http.NewRequest("POST", netCtiLoginURL, bytes.NewBuffer(payloadBytes))
			if err != nil {
				logs.Log("[AUTH] Failed to create HTTP request")
				return nil, err
			}
			req.Header.Set("Content-Type", "application/json")

			// Timeout avoids the client hanging indefinitely if the backend
			// leaves the response unfinished (e.g. an unhandled exception
			// that never calls resp.end() on the restify side).
			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				logs.Log("[AUTH] Failed to send request to NetCTI")
				return nil, jwt.ErrFailedAuthentication
			}
			defer resp.Body.Close()

			var NethCTIToken string

			if resp.StatusCode == http.StatusUnauthorized {
				wwwAuth := resp.Header.Get("Www-Authenticate")
				if wwwAuth != "" {
					// Generate NethCTIToken using the www-authenticate header
					NethCTIToken = utils.GenerateLegacyToken(resp, username, password)
					if NethCTIToken == "" {
						logs.Log("[AUTH] Failed to generate NethCTIToken")
						return nil, jwt.ErrFailedAuthentication
					}

					// Retry the request with the new Authorization header
					netCtiMeURL := configuration.Config.V1Protocol + "://" + configuration.Config.V1ApiEndpoint + configuration.Config.V1ApiPath + "/user/me"
					req, _ := http.NewRequest("GET", netCtiMeURL, nil) // Use GET for /user/me
					req.Header.Set("Authorization", NethCTIToken)
					// print request headers
					resp, err = client.Do(req)
					if err != nil {
						logs.Log("[AUTH] Failed to retry request to NetCTI")
						return nil, jwt.ErrFailedAuthentication
					}
					defer resp.Body.Close()
				}
			}

			if resp.StatusCode != http.StatusOK {
				logs.Log("[ERROR][AUTH] Authentication failed for user " + username + " with status: " + resp.Status)
				return nil, jwt.ErrFailedAuthentication
			}

			// Login is successful. Middleware returns a JWT.

			phoneIslandPayload := map[string]string{"subtype": "user"}
			phoneIslandPayloadBytes, _ := json.Marshal(phoneIslandPayload)
			req, err = http.NewRequest("POST", configuration.Config.V1Protocol+"://"+configuration.Config.V1ApiEndpoint+configuration.Config.V1ApiPath+"/authentication/phone_island_token_login", bytes.NewBuffer(phoneIslandPayloadBytes))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create request"})
				return nil, jwt.ErrFailedAuthentication
			}
			req.Header.Set("Authorization", NethCTIToken)
			req.Header.Set("Content-Type", "application/json")

			resp, err = client.Do(req)

			var v1Resp struct {
				Token string `json:"token"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&v1Resp); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to parse server v1 response"})
				return nil, jwt.ErrFailedAuthentication
			}

			NethCTIToken = username + ":" + v1Resp.Token

			// Check if user session already exists (multi-session support)
			existingSession, sessionExists := store.UserSessions[username]

			if sessionExists {
				// Reuse existing session (keep existing tokens, update NethCTIToken)
				// Note: New login does NOT inherit OTP_Verified status - each JWT token will be verified independently
				existingSession.NethCTIToken = NethCTIToken
				logs.Log("[INFO][AUTH] authentication success for user " + username + " (reusing existing session with " + fmt.Sprint(len(existingSession.JWTTokens)) + " existing tokens)")
				return existingSession, nil
			} else {
				// Create a new user session object
				store.UserSessions[username] = &models.UserSession{
					Username:     username,
					JWTTokens:    nil,
					NethCTIToken: NethCTIToken,
					OTP_Verified: false,
				}
				logs.Log("[INFO][AUTH] authentication success for user " + username + " (new session created)")
				return store.UserSessions[username], nil
			}
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
			reqURI := c.Request.RequestURI
			JWTToken := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
			userSession := store.UserSessions[username]

			// Check if session exists and token is valid
			if userSession == nil || !utils.Contains(JWTToken, userSession.JWTTokens) {
				logs.Log("[ERROR][AUTH] authorization failed for user " + username + " (session not found or invalid token). " + reqMethod + " " + reqURI)
				return false
			}

			isOTPVerifyEndpoint := strings.Contains(c.Request.RequestURI, "/verify-otp")

			// Check 2FA requirement (only for JWT token authentication, not API key)
			// Use the otp_verified claim from the JWT token (not from session)
			if !isOTPVerifyEndpoint {
				has2FA, has2FAExists := claims["2fa"].(bool)
				otpVerified, otpVerifiedExists := claims["otp_verified"].(bool)

				// If 2FA is enabled but OTP claim doesn't exist or is false, deny access
				if has2FAExists && has2FA && (!otpVerifiedExists || !otpVerified) {
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
			store.UserSessions[claims[identityKey].(string)].JWTTokens = append(store.UserSessions[claims[identityKey].(string)].JWTTokens, token.AccessToken)

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
			c.JSON(code, structs.Map(models.StatusUnauthorized{
				Code:    code,
				Message: message,
				Data:    nil,
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
