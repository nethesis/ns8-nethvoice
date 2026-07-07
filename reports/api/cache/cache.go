/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - info@nethesis.it
 *
 * This file is part of Yomi-Proxy project.
 *
 * Yomi-Proxy is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * Yomi-Proxy is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Yomi-Proxy. If not, see COPYING.
 *
 * author: Edoardo Spadoni <edoardo.spadoni@nethesis.it>
 */

package cache

import (
	"github.com/nethesis/nethvoice-report/api/configuration"

	"github.com/go-redis/redis"
)

var cacheConnection *redis.Client

func Instance() *redis.Client {
	if cacheConnection == nil {
		cacheConnection := InitCacheConnection()
		return cacheConnection
	}
	return cacheConnection
}

func InitCacheConnection() *redis.Client {
	// init client
	cacheConnection = redis.NewClient(&redis.Options{
		Network:  configuration.Config.RedisNetworkType,
		Addr:     configuration.Config.RedisAddress,
		Password: "",
		DB:       0, // cache database
	})

	return cacheConnection
}
