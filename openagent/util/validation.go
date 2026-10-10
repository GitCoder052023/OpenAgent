// Copyright 2021 The OpenAgent Authors. All Rights Reserved.
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
	"regexp"
)

var (
	ReFieldWhiteList     *regexp.Regexp
	ReSortFieldWhiteList *regexp.Regexp
)

func init() {
	ReFieldWhiteList, _ = regexp.Compile(`^[A-Za-z0-9]+$`)
	ReSortFieldWhiteList, _ = regexp.Compile(`^[A-Za-z0-9_]+$`)
}

func FilterField(field string) bool {
	return ReFieldWhiteList.MatchString(field)
}

// FilterSortField reports whether sortField is a plain column name that is safe to put into an
// ORDER BY clause. The ORM does not escape identifiers, so anything else could inject SQL.
func FilterSortField(sortField string) bool {
	return ReSortFieldWhiteList.MatchString(sortField)
}
