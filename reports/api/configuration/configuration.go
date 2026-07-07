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

package configuration

import (
	"encoding/json"
	"os"

	"github.com/pkg/errors"

	"github.com/nethesis/nethvoice-report/api/models"
)

type Configuration struct {
	CDRDatabase struct {
		Host     string `json:"host"`
		Port     string `json:"port"`
		User     string `json:"user"`
		Name     string `json:"name"`
		Password string `json:"password"`
	} `json:"cdr_database"`
	PhonebookDatabase struct {
		Host     string `json:"host"`
		Port     string `json:"port"`
		User     string `json:"user"`
		Name     string `json:"name"`
		Password string `json:"password"`
	} `json:"phonebook_database"`
	FreePBXDatabase struct {
		Host     string `json:"host"`
		Port     string `json:"port"`
		User     string `json:"user"`
		Name     string `json:"name"`
		Password string `json:"password"`
	} `json:"freepbx_database"`
	ListenAddress          string          `json:"listen_address"`
	RedisNetworkType       string          `json:"redis_network_type"`
	RedisAddress           string          `json:"redis_address"`
	TTLCache               int             `json:"ttl_cache"`
	Secret                 string          `json:"secret"`
	QueryPath              string          `json:"query_path"`
	TemplatePath           string          `json:"template_path"`
	ValuesPath             string          `json:"values_path"`
	ViewsPath              string          `json:"views_path"`
	PhonebookPath          string          `json:"phonebook_path"`
	RrdPath                string          `json:"rrd_path"`
	UserAuthorizationsFile string          `json:"user_auth_file"`
	DefaultFilter          models.Filter   `json:"default_filter"`
	APIKey                 string          `json:"api_key"`
	APIEndpoint            string          `json:"api_endpoint"`
	Settings               models.Settings `json:"settings"`
}

var Config = Configuration{}

func Init(ConfigFilePtr *string) {
	// read configuration
	if _, err := os.Stat(*ConfigFilePtr); err == nil {
		file, _ := os.Open(*ConfigFilePtr)
		decoder := json.NewDecoder(file)
		// check errors or parse JSON
		err := decoder.Decode(&Config)
		if err != nil {
			os.Stderr.WriteString(errors.Wrap(err, "error decoding configuration file").Error() + "\n")
		}
	}
}
