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

package models

type UserAuthorizations struct {
	Username string   `json:"username"`
	Queues   []string `json:"queues"`
	Groups   []string `json:"groups"`
	Agents   []string `json:"agents"`
	Users    []string `json:"users"`
	Cdr      string   `json:"cdr"`
	Privacy  bool     `json:"privacy"`
}

type AuthStats struct {
	FileName      string `json:"file_name"`
	ModTime       int64  `json:"mod_time"`
}

type AuthMap struct {
	Queues        bool   `json:"queues"`
	CdrGlobal     bool   `json:"cdr_global"`
	CdrPbx        bool   `json:"cdr_pbx"`
	CdrPersonal   bool   `json:"cdr_personal"`
}
