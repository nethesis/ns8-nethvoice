/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"crypto/rand"
	"encoding/base32"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/dgryski/dgoogauth"
	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/utils"
)

// -------------------------------- exported methods --------------------------------

// GetUserStatus retrieves the 2FA status for the user
func GetUserStatus(username string) (string, error) {
	status, err := os.ReadFile(configuration.Config.SecretsDir + "/" + username + "/status")
	statusS := strings.TrimSpace(string(status[:]))

	return statusS, err
}

// Test2FAStatus checks if 2FA is enabled for the user
func Get2FAStatus(c *gin.Context) {
	// get claims from token
	claims := jwt.ExtractClaims(c)

	// get status
	twoFaStatus, _ := GetUserStatus(claims["id"].(string))

	// return response
	c.JSON(http.StatusOK, gin.H{"status": twoFaStatus == "1"})
}

// VerifyOTP verifies the OTP provided by the user
func VerifyOTP(c *gin.Context) {
	// get payload
	var jsonOTP models.OTPJson

	if err := c.ShouldBindBodyWith(&jsonOTP, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "request fields malformed",
			Data:    err.Error(),
		}))
		return
	}

	// get secret for the user
	username := jsonOTP.Username
	secret := getUserSecret(username)

	// check secret
	if len(secret) == 0 {
		c.JSON(http.StatusNotFound, structs.Map(models.StatusNotFound{
			Code:    404,
			Message: "user secret not found",
			Data:    "",
		}))
		return
	}

	// set OTP configuration
	otpc := &dgoogauth.OTPConfig{
		Secret:      secret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	// verifiy OTP
	result, err := otpc.Authenticate(jsonOTP.OTP)
	if err != nil || !result {

		// check if OTP is a recovery code
		recoveryCodes := getRecoveryCodes(username)

		if !utils.Contains(jsonOTP.OTP, recoveryCodes) {
			c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
				Code:    400,
				Message: "invalid_otp",
				Data:    nil,
			}))
			return
		}

		// remove used recovery OTP
		recoveryCodes = utils.Remove(jsonOTP.OTP, recoveryCodes)

		// update recovery codes file
		if !updateRecoveryCodes(username, recoveryCodes) {
			c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
				Code:    400,
				Message: "OTP recovery codes not updated",
				Data:    "",
			}))
			return
		}
	}

	// Check if this is initial 2FA setup (not login OTP verification)
	// If the current token has 2fa:false, it means user is setting up 2FA for the first time
	claims := jwt.ExtractClaims(c)
	currentHas2FA := false
	if val, exists := claims["2fa"]; exists {
		currentHas2FA = val.(bool)
	}

	// enable 2FA for user
	if !enable2FA(username) {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "failed to enable 2FA",
			Data:    "",
		}))
		return
	}

	// Extract the JWT token being used for this request
	currentJWTToken := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")

	// If this is initial 2FA setup (2fa was false before), invalidate all other tokens
	// to force all other clients to re-login with the new 2FA requirement
	if !currentHas2FA {
		userSession := store.UserSessions[username]
		if userSession != nil {
			// Keep only the current token, remove all others
			userSession.JWTTokens = []string{currentJWTToken}
			logs.Log("[INFO][2FA] All other JWT tokens invalidated for user " + username + " after enabling 2FA")
		}
	}

	// update user session to mark OTP as verified
	store.UserSessions[username].OTP_Verified = true

	// Regenerate JWT token with updated 2FA status, replacing the current token
	_, newToken, expire, err := regenerateUserToken(store.UserSessions[username], currentJWTToken)

	if err != nil {
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusBadRequest{
			Code:    500,
			Message: "failed to generate new token",
			Data:    err.Error(),
		}))
		return
	}

	// response with new token (the regenerated one that replaces currentJWTToken)
	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    200,
		Message: "OTP verified",
		Data:    gin.H{"token": newToken, "expire": expire},
	}))
}

// QRCode generates a QR code for the user to set up 2FA
func QRCode(c *gin.Context) {
	// generate random secret
	secret := make([]byte, 20)
	_, err := rand.Read(secret)
	if err != nil {
		logs.Log("[ERR][2FA] Failed to generate random secret for QRCode: " + err.Error())
	}

	// convert to string
	secretBase32 := base32.StdEncoding.EncodeToString(secret)

	// get claims from token
	claims := jwt.ExtractClaims(c)

	// define issuer
	account := claims["id"].(string)
	issuer := configuration.Config.Issuer2FA

	// set secret for user
	result, setSecret := setUserSecret(account, secretBase32)
	if !result {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "user secret set error",
			Data:    "",
		}))
		return
	}

	// define URL
	URL, err := url.Parse("otpauth://totp")
	if err != nil {
		logs.Log("[ERR][2FA] Failed to parse URL for QRCode: " + err.Error())
	}

	// add params
	URL.Path += "/" + issuer + ":" + account
	params := url.Values{}
	params.Add("secret", setSecret)
	params.Add("algorithm", "SHA1")
	params.Add("digits", "6")
	params.Add("period", "30")

	// print url
	URL.RawQuery = params.Encode()

	// response
	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    200,
		Message: "QR code string",
		Data:    gin.H{"url": URL.String(), "key": setSecret},
	}))
}

// Disable2FA disables two-factor authentication for the user
func Disable2FA(c *gin.Context) {
	// get payload
	var loginData models.LoginJson

	if err := c.ShouldBindBodyWith(&loginData, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "request fields malformed",
			Data:    err.Error(),
		}))
		return
	}

	// get claims from token
	claims := jwt.ExtractClaims(c)
	username := claims["id"].(string)

	// validate password is provided
	if loginData.Password == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "password is required to disable 2FA",
			Data:    "",
		}))
		return
	}

	// verify password using VerifyUserPassword from auth.go
	isValidPassword := VerifyUserPassword(username, loginData.Password)
	if !isValidPassword {
		c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
			Code:    401,
			Message: "invalid password",
			Data:    "",
		}))
		return
	}

	// revocate secret
	errRevocate := os.Remove(configuration.Config.SecretsDir + "/" + username + "/secret")
	if errRevocate != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    403,
			Message: "error in revocate 2FA for user",
			Data:    nil,
		}))
		return
	}

	// revocate recovery codes
	errRevocateCodes := os.Remove(configuration.Config.SecretsDir + "/" + username + "/codes")
	if errRevocateCodes != nil {
		// if the file does not exist, it is ok, skip the error
		if !os.IsNotExist(errRevocateCodes) {
			c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
				Code:    403,
				Message: "error in delete 2FA recovery codes",
				Data:    nil,
			}))
			return
		}
	}

	// set 2FA to disabled
	f, _ := os.OpenFile(configuration.Config.SecretsDir+"/"+username+"/status", os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	defer f.Close()

	// write file with tokens
	_, err := f.WriteString("0")

	// check error
	if err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "2FA not revocated",
			Data:    "",
		}))
		return
	}

	// Invalidate ALL tokens for this user when 2FA is disabled
	// This ensures that all clients (web, desktop, mobile) must re-authenticate
	userSession := store.UserSessions[username]

	if userSession != nil {
		// Clear all existing tokens - force all clients to re-login
		err := store.RemoveAllJWTTokens(username)
		if err != nil {
			logs.Log("[ERROR][2FA] Failed to remove all JWT tokens for user " + username + ": " + err.Error())
		}
		userSession.OTP_Verified = false

		logs.Log("[INFO][2FA] All JWT tokens invalidated for user " + username + " after disabling 2FA")

		// Don't generate a new token - return success without token
		// The client will need to login again
		c.JSON(http.StatusOK, structs.Map(models.StatusOK{
			Code:    200,
			Message: "2FA revocate successfully - all sessions invalidated, please login again",
			Data:    gin.H{"must_relogin": true},
		}))
		return
	}

	// response without new token if user session not found
	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    200,
		Message: "2FA revocate successfully",
		Data:    "",
	}))
}

// Get2FARecoveryCodes retrieves the recovery codes for the user
func Get2FARecoveryCodes(c *gin.Context) {
	claims := jwt.ExtractClaims(c)

	codes := getRecoveryCodes(claims["id"].(string))

	c.JSON(http.StatusOK, gin.H{"codes": codes})
}

// -------------------------------- private methods --------------------------------

// enable2FA enables two-factor authentication for the user
func enable2FA(username string) bool {
	// check if dir exists, otherwise create it
	if _, errD := os.Stat(configuration.Config.SecretsDir + "/" + username); os.IsNotExist(errD) {
		_ = os.MkdirAll(configuration.Config.SecretsDir+"/"+username, 0700)
	}

	// set 2FA to enabled
	f, _ := os.OpenFile(configuration.Config.SecretsDir+"/"+username+"/status", os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	defer f.Close()

	// write file with 2fa status
	_, err := f.WriteString("1")

	return err == nil
}

// regenerateUserToken creates a new JWT token for an existing user session, replacing the old token
func regenerateUserToken(userSession *models.UserSession, oldToken string) (*models.UserSession, string, time.Time, error) {
	now := time.Now()
	expire := now.Add(time.Hour * 24 * 14) // 2 weeks

	_, tokenString, err := IssueUserJWT(UserJWTOptions{
		Username:    userSession.Username,
		OTPVerified: userSession.OTP_Verified,
		IssuedAt:    now,
		ExpiresAt:   &expire,
	})
	if err != nil {
		return nil, "", time.Time{}, err
	}

	// Find and replace the old token in the array
	for i, t := range userSession.JWTTokens {
		if t == oldToken {
			userSession.JWTTokens[i] = tokenString
			break
		}
	}

	return userSession, tokenString, expire, nil
}

// getUserSecret retrieves the secret for the user
func getUserSecret(username string) string {
	// get secret
	secret, err := os.ReadFile(configuration.Config.SecretsDir + "/" + username + "/secret")

	// handle error
	if err != nil {
		return ""
	}

	// return string
	return string(secret[:])
}

// setUserSecret sets the secret for the user
func setUserSecret(username string, secret string) (bool, string) {
	// get secret
	secretB, _ := os.ReadFile(configuration.Config.SecretsDir + "/" + username + "/secret")

	// check error
	if len(string(secretB[:])) == 0 {
		// check if dir exists, otherwise create it
		if _, errD := os.Stat(configuration.Config.SecretsDir + "/" + username); os.IsNotExist(errD) {
			_ = os.MkdirAll(configuration.Config.SecretsDir+"/"+username, 0700)
		}

		// open file
		f, _ := os.OpenFile(configuration.Config.SecretsDir+"/"+username+"/secret", os.O_WRONLY|os.O_CREATE, 0600)
		defer f.Close()

		// write file with secret
		_, err := f.WriteString(secret)

		// check error
		if err != nil {
			return false, ""
		}

		return true, secret
	}

	return true, string(secretB[:])
}

// getRecoveryCodes retrieves the recovery codes for the user
func getRecoveryCodes(username string) []string {
	// create empty array
	var recoveryCodes []string

	// check if recovery codes exists
	savedCodes, _ := os.ReadFile(configuration.Config.SecretsDir + "/" + username + "/codes")

	// check length
	if len(string(savedCodes[:])) == 0 {

		// get secret
		secret := getUserSecret(username)

		// get recovery codes
		if len(string(secret)) > 0 {
			// generate new random recovery codes
			newCodes := generateRandomRecoveryCodes()

			// create codes string
			codesString := strings.Join(newCodes, "\n") + "\n"

			// open file
			f, _ := os.OpenFile(configuration.Config.SecretsDir+"/"+username+"/codes", os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
			defer f.Close()

			// write file with codes
			_, _ = f.WriteString(codesString)

			// assign codes
			return newCodes
		}
	}

	// parse output
	recoveryCodes = strings.Split(string(savedCodes[:]), "\n")

	// remove empty element, the last one
	if len(recoveryCodes) > 0 && recoveryCodes[len(recoveryCodes)-1] == "" {
		recoveryCodes = recoveryCodes[:len(recoveryCodes)-1]
	}

	// return codes
	return recoveryCodes
}

// updateRecoveryCodes updates the recovery codes for the user
func updateRecoveryCodes(username string, codes []string) bool {
	// open file
	f, _ := os.OpenFile(configuration.Config.SecretsDir+"/"+username+"/codes", os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	defer f.Close()

	// write file with secret
	codes = append(codes, "")
	_, err := f.WriteString(strings.Join(codes[:], "\n"))

	// check error
	return err == nil
}

// generateRandomRecoveryCodes generates random recovery codes
func generateRandomRecoveryCodes() []string {
	var codes []string

	// Generate 5 random recovery codes
	for i := 0; i < 5; i++ {
		// Generate 6-digit numeric recovery code
		code := ""
		for j := 0; j < 6; j++ {
			digit := make([]byte, 1)
			rand.Read(digit)
			code += string('0' + (digit[0] % 10))
		}
		codes = append(codes, code)
	}

	return codes
}
