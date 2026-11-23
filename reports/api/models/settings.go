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

type Settings struct {
	StartHour    string        `json:"start_hour"`
	EndHour      string        `json:"end_hour"`
	QueryLimit   string        `json:"query_limit"`
	NullCallTime string        `json:"null_call_time"`
	Destinations []string      `json:"destinations"`
	CallPatterns []CallPattern `json:"call_patterns"`
	Currency     string        `json:"currency"`
	Costs        []Cost        `json:"costs"`
}

type CallPattern struct {
	Prefix      string `json:"prefix"`
	Destination string `json:"destination"`
}

type Cost struct {
	ChannelId   string `json:"channel_id"`
	Destination string `json:"destination"`
	Cost        string `json:"cost"`
}
