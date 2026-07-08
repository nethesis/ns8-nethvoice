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
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/cache"
)

func GetPhonebook(c *gin.Context) {
	// init cache connection
	cacheConnection := cache.Instance()

	// check if settings is locally cached
	phonebook, errCache := cacheConnection.Get("phonebook_numbers").Result()

	// phonebook numbers not found
	if errCache != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "phonebook numbers not found", "status": errCache.Error()})
		return
	}

	// return phonebook numbers
	c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(phonebook))
}
