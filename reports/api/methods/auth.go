/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - info@nethesis.it
 *
 * This file is part of NethVoice Report project.
 *
 * NethVoice Report is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethVoice Report is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with NethVoice Report.  If not, see COPYING.
 *
 * author: Edoardo Spadoni <edoardo.spadoni@nethesis.it>
 */

package methods

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"time"

	"github.com/pkg/errors"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/api/utils"
)

func PamAuth(username string, password string) error {
	// execute pam login
	cmd := exec.Command("ldap-authenticate", username, password)
	return cmd.Run()
}

func ParseUserAuthorizationsFile() ([]models.UserAuthorizations, error) {
	file, err := ioutil.ReadFile(configuration.Config.UserAuthorizationsFile)
	if err != nil {
		utils.LogError(errors.Wrap(err, "error reading user authorizations file"))
		return []models.UserAuthorizations{}, err
	}

	userAuthorizationsList := []models.UserAuthorizations{}
	err = json.Unmarshal([]byte(file), &userAuthorizationsList)
	if err != nil {
		utils.LogError(errors.Wrap(err, "error unmarshalling user authorizations file"))
		return []models.UserAuthorizations{}, err
	}
	return userAuthorizationsList, nil
}

func GetUserAuthorizations(username string) (models.UserAuthorizations, error) {
	userAuthorizations := models.UserAuthorizations{}
	userAuthorizationsList, err := ParseUserAuthorizationsFile()
	if err != nil {
		return userAuthorizations, err
	}

	for _, ua := range userAuthorizationsList {
		if ua.Username == username {
			userAuthorizations.Username = ua.Username
			userAuthorizations.Queues = ua.Queues
			userAuthorizations.Groups = ua.Groups
			userAuthorizations.Agents = ua.Agents
			userAuthorizations.Users = ua.Users
			userAuthorizations.Cdr = ua.Cdr
			userAuthorizations.Privacy = ua.Privacy
			return userAuthorizations, nil
		}
	}
	return userAuthorizations, errors.New("username not found in authorizations file")
}

func GetClaims(c *gin.Context) jwt.MapClaims {
	// extract claims from jwt gin context
	claims := jwt.ExtractClaims(c)

	// return claims
	return claims
}

func GetAdminHashPass() string {
	// init hash var
	var hash string

	// read hash from db
	db := source.FreePBXInstance()
	row := db.QueryRow("SELECT password_sha1 FROM ampusers WHERE username = 'admin'")
	errQuery := row.Scan(&hash)

	// check error
	if errQuery != nil {
		utils.LogError(errors.Wrap(errQuery, "error in admin pass query execution"))
	}

	return hash
}

func ParseAuthFileStats() (models.AuthStats, error) {
	// get authorizations file stats
	fileInfo, err := os.Stat(configuration.Config.UserAuthorizationsFile)
	if err != nil {
		utils.LogError(errors.Wrap(err, "error reading user authorizations file stats"))
		return models.AuthStats{}, err
	}
	authStats := models.AuthStats{
		FileName: fileInfo.Name(),
		ModTime:  fileInfo.ModTime().Unix(),
	}
	// return authorization file stats
	return authStats, nil
}

func GetAuthFileStats(c *gin.Context) {
	// parse authorizations file stats
	fileStats, err := ParseAuthFileStats()
	if err != nil {
		// return not found status
		c.JSON(http.StatusNotFound, gin.H{"message": "error reading user authorizations file stats"})
		return
	}
	// return modification time and file name
	c.JSON(http.StatusOK, fileStats)
	return
}

func ParseAuthMap(c *gin.Context, username string) (models.AuthMap, error) {
	// init auth map
	authMap := models.AuthMap{}
	var user string
	// get current user
	if username != "" {
		user = username
	} else {
		user = GetClaims(c)["id"].(string)
	}
	// grant auths to admin or X
	if user == "admin" || user == "X" {
		authMap.Queues = true
		authMap.CdrGlobal = true
		authMap.CdrPbx = true
		authMap.CdrPersonal = true
		return authMap, nil
	}
	// get user auths
	auths, err := GetUserAuthorizations(user)
	if err != nil {
		return models.AuthMap{}, err
	}
	// parse authorizations
	if len(auths.Queues) > 0 {
		authMap.Queues = true
	}
	if len(auths.Users) > 0 {
		if auths.Cdr == "global" {
			authMap.CdrGlobal = true
			authMap.CdrPbx = true
			authMap.CdrPersonal = true
		} else if auths.Cdr == "group" {
			authMap.CdrPbx = true
			authMap.CdrPersonal = true
		} else if auths.Cdr == "personal" {
			authMap.CdrPersonal = true
		}
	}
	return authMap, nil
}

func GetAuthMap(c *gin.Context) {
	// parse authorizations map
	authMap, err := ParseAuthMap(c, "")
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "error parsing user authorizations file"})
		return
	}
	// return authorizations map
	c.JSON(http.StatusOK, authMap)
	return
}

func CacheHasValidAuth(ttl time.Duration, modTime int64) bool {
	// check if cached data has valid authorizations
	now := time.Now().Unix()
	ttlTime := int64(ttl.Seconds())
	ttlCache := int64((time.Duration(configuration.Config.TTLCache) * time.Minute).Seconds())
	// return true when time passed from the data insert in chache
	// is lower than time passed from the authorizations modify time
	if (ttlCache - ttlTime) < (now - modTime) {
		return true
	}
	return false
}
