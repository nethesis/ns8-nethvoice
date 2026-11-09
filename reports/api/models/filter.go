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

type Filter struct {
	Queues       []string `json:"queues"`
	Groups       []string `json:"groups"`
	Agents       []string `json:"agents"`
	UsersUi      []string `json:"usersUi"`
	Users        []string `json:"users"`
	IVRs         []string `json:"ivrs"`
	Phones       []string `json:"phones"`
	Trunks       []string `json:"trunks"`
	DIDs         []string `json:"dids"`
	Sources      []string `json:"sources"`
	Destinations []string `json:"destinations"`
	SourcesUi    struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		PhoneNumber string `json:"phoneNumber"`
		Value       string `json:"value"`
	} `json:"sourcesUi"`
	DestinationsUi struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		PhoneNumber string `json:"phoneNumber"`
		Value       string `json:"value"`
	} `json:"destinationsUi"`
	CallType   []string `json:"callType"`
	Duration   string   `json:"duration"`
	DurationUi struct {
		Title string `json:"title"`
		Value string `json:"value"`
	} `json:"durationUi"`
	CallDestinations []string `json:"callDestinations"`
	Patterns         []string `json:"patterns"`
	Devices          []string `json:"devices"`

	Reasons []string `json:"reasons"`
	Results []string `json:"results"`
	Choices []string `json:"choices"`
	Origins []string `json:"origins"`

	Time struct {
		Group             string `json:"group"`
		Division          string `json:"division"`
		Range             string `json:"range"`
		CdrDashboardRange string `json:"cdrDashboardRange"`
		Interval          struct {
			Start string `json:"start"`
			End   string `json:"end"`
		} `json:"interval"`
	} `json:"time"`

	CurrentUser    string   `json:"currentUser"`
	Privacy        bool     `json:"privacy"`
	UserExtensions []string `json:"userExtensions"`

	Caller      string   `json:"caller"`
	Name        string   `json:"contactName"`
	GeoGroup    string   `json:"geoGroup"`
	QueueAgents []string `json:"queueAgents"`
}

type Search struct {
	Name    string `json:"name"`
	Report  string `json:"report"`
	Section string `json:"section"`
	View    string `json:"view"`
	Filter  Filter `json:"filter"`
}
