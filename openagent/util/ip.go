// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package util

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/beego/beego"
	"github.com/the-open-agent/openagent/conf"
)

// ipParsingMode holds the resolved config string: "" = disabled, "17monipdb" = 17monipdb, "MaxMind GeoIP2" = MaxMind.
var ipParsingMode string

// tryInitLocalDb tries to initialize the local IP database from different paths.
// Returns (found, error): found=false means the data file doesn't exist (caller should skip silently).
func tryInitLocalDb() (bool, error) {
	err := Init(conf.GetSharedPath("data/17monipdb.dat"))
	if err == nil {
		return true, nil
	}
	var pathError *os.PathError
	if errors.As(err, &pathError) {
		err = Init("../data/17monipdb.dat")
		if err == nil {
			return true, nil
		}
		if errors.As(err, &pathError) {
			return false, nil
		}
	}
	return true, err
}

// InitIpDb initializes the IP database based on configuration.
// ipParsingMode = ""              : IP parsing disabled entirely (no DB loaded, no download).
// ipParsingMode = "17monipdb"     : use local 17monipdb.
// ipParsingMode = "MaxMind GeoIP2": use MaxMind GeoIP2.
func InitIpDb() {
	ipParsingMode = beego.AppConfig.DefaultString("ipParsingMode", "")
	if ipParsingMode == "" {
		return
	}

	if ipParsingMode == "17monipdb" {
		found, err := tryInitLocalDb()
		if err != nil {
			panic(err)
		}
		if !found {
			// Data file absent — disable silently.
			ipParsingMode = ""
		}
	} else {
		// "MaxMind GeoIP2" — InitMaxmindFiles() is called from main before InitIpDb,
		// so the DB is already loaded or a background download is in progress.
		if err := InitMaxmindDb(); err != nil && !MaxmindDownloadInProgress {
			// MaxMind not available either — disable silently.
			ipParsingMode = ""
		}
	}
}

func GetInfoFromIP(ip string) (*LocationInfo, error) {
	if ipParsingMode == "" {
		return &LocationInfo{}, nil
	}

	if !IsInternetIp(ip) {
		return &LocationInfo{}, nil
	}

	var info *LocationInfo
	var err error
	if ipParsingMode == "17monipdb" {
		info, err = Find(ip)
	} else {
		info, err = FindMaxmind(ip)
	}
	if err != nil {
		return nil, err
	}

	return info, nil
}

// GetDescFromIP returns a string description of an IP address
func GetDescFromIP(ip string) string {
	info, err := GetInfoFromIP(ip)
	if err != nil {
		return ""
	}

	parts := []string{}
	if info.Country != "" {
		parts = append(parts, info.Country)
	}
	if info.Region != "" {
		parts = append(parts, info.Region)
	}
	if info.City != "" {
		parts = append(parts, info.City)
	}
	if info.Isp != Null && info.Isp != "" {
		parts = append(parts, info.Isp)
	}

	return strings.Join(parts, ", ")
}

func GetIPInfo(clientIP string) string {
	if clientIP == "" {
		return ""
	}

	ips := strings.Split(clientIP, ",")
	res := ""
	for i := range ips {
		ip := strings.TrimSpace(ips[i])
		// desc := GetDescFromIP(ip)
		ipstr := fmt.Sprintf("%s: %s", ip, "")
		if i != len(ips)-1 {
			res += ipstr + " -> "
		} else {
			res += ipstr
		}
	}

	return res
}

func GetIPFromRequest(req *http.Request) string {
	clientIP := req.Header.Get("x-forwarded-for")
	if clientIP == "" {
		ipPort := strings.Split(req.RemoteAddr, ":")
		if len(ipPort) >= 1 && len(ipPort) <= 2 {
			clientIP = ipPort[0]
		} else if len(ipPort) > 2 {
			idx := strings.LastIndex(req.RemoteAddr, ":")
			clientIP = req.RemoteAddr[0:idx]
			clientIP = strings.TrimLeft(clientIP, "[")
			clientIP = strings.TrimRight(clientIP, "]")
		}
	}

	return GetIPInfo(clientIP)
}
