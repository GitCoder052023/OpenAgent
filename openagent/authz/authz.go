// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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

package authz

import (
	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
	stringadapter "github.com/qiangmzsx/string-adapter/v2"
)

var Enforcer *casbin.Enforcer

const modelText = `
[request_definition]
r = sub, method, urlPath

[policy_definition]
p = sub, method, urlPath, eft

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub, p.sub) && (r.method == p.method || p.method == "*") && (keyMatch(r.urlPath, p.urlPath) || p.urlPath == "*")
`

// policyText defines access control rules, everything not allowed is denied.
// Roles: admin, store-admin > user > anonymous. store-admin is denied the global-only endpoints.
const policyText = `
p, admin, *, *, allow

p, store-admin, *, *, allow
p, store-admin, *, /api/get-global-sites, deny
p, store-admin, *, /api/get-sites, deny
p, store-admin, *, /api/get-site, deny
p, store-admin, *, /api/update-site, deny
p, store-admin, *, /api/add-site, deny
p, store-admin, *, /api/delete-site, deny
p, store-admin, *, /api/get-sessions, deny
p, store-admin, *, /api/get-session, deny
p, store-admin, *, /api/update-session, deny
p, store-admin, *, /api/add-session, deny
p, store-admin, *, /api/delete-session, deny
p, store-admin, *, /api/get-snapshots, deny
p, store-admin, *, /api/get-snapshot, deny
p, store-admin, *, /api/rollback-snapshot, deny
p, store-admin, *, /api/get-migration-sources, deny
p, store-admin, *, /api/upload-migration-file, deny
p, store-admin, *, /api/preview-migration, deny
p, store-admin, *, /api/start-migration, deny
p, store-admin, *, /api/get-migration-progress, deny
p, store-admin, *, /api/get-migrations, deny
p, store-admin, *, /api/get-migration, deny
p, store-admin, *, /api/rollback-migration, deny
p, store-admin, *, /api/update-permission, deny
p, store-admin, *, /api/add-permission, deny
p, store-admin, *, /api/delete-permission, deny
p, store-admin, *, /api/get-records, deny
p, store-admin, *, /api/get-record, deny
p, store-admin, *, /api/update-record, deny
p, store-admin, *, /api/add-record, deny
p, store-admin, *, /api/add-records, deny
p, store-admin, *, /api/delete-record, deny
p, store-admin, *, /api/commit-record, deny
p, store-admin, *, /api/commit-record-second, deny
p, store-admin, *, /api/query-record, deny
p, store-admin, *, /api/query-record-second, deny
p, store-admin, *, /api/get-system-info, deny
p, store-admin, *, /api/get-version-info, deny
p, store-admin, *, /api/get-prometheus-info, deny
p, store-admin, *, /api/metrics, deny
p, store-admin, *, /api/get-usages, deny
p, store-admin, *, /api/get-range-usages, deny
p, store-admin, *, /api/get-users, deny
p, store-admin, *, /api/get-user-table-infos, deny
p, store-admin, *, /api/get-usage-providers, deny
p, store-admin, *, /api/get-usage-heatmap, deny
p, store-admin, *, /api/get-visitors, deny
p, store-admin, *, /api/add-resource, deny
p, store-admin, *, /api/update-resource, deny

p, user, *, /api/update-account, allow
p, user, *, /api/get-chats, allow
p, user, *, /api/get-forms, allow
p, user, *, /api/get-messages, allow
p, user, *, /api/delete-welcome-message, allow
p, user, *, /api/get-message-answer, allow
p, user, *, /api/cancel-message-answer, allow
p, user, *, /api/get-answer, allow
p, user, *, /api/get-store, allow
p, user, *, /api/get-vector, allow
p, user, *, /api/get-providers, allow
p, user, *, /api/get-provider, allow
p, user, *, /api/get-global-stores, allow
p, user, *, /api/get-store-names, allow
p, user, *, /api/get-chat, allow
p, user, *, /api/get-chat-status, allow
p, user, *, /api/get-message, allow
p, user, *, /api/get-tasks, allow
p, user, *, /api/get-task, allow
p, user, *, /api/get-public-scales, allow
p, user, *, /api/update-chat, allow
p, user, *, /api/add-chat, allow
p, user, *, /api/delete-chat, allow
p, user, *, /api/update-message, allow
p, user, *, /api/add-message, allow
p, user, *, /api/update-task, allow
p, user, *, /api/add-task, allow
p, user, *, /api/delete-task, allow
p, user, *, /api/upload-task-document, allow
p, user, *, /api/generate-text-to-speech-audio, allow
p, user, *, /api/generate-text-to-speech-audio-stream, allow
p, user, *, /api/process-speech-to-text, allow
p, user, *, /api/speech-stream, allow
p, user, *, /api/analyze-task, allow
p, user, *, /api/claim-store, allow
p, user, *, /api/get-store-insights-summary, allow
p, user, *, /api/get-store-contributors, allow
p, user, *, /api/get-store-traffic, allow
p, user, *, /api/get-store-cost-series, allow
p, user, *, /api/get-store-security, allow
p, user, *, /api/get-comments, allow
p, user, *, /api/add-comment, allow
p, user, *, /api/delete-comment, allow
p, user, *, /api/get-issues, allow
p, user, *, /api/get-issue, allow
p, user, *, /api/add-issue, allow
p, user, *, /api/update-issue, allow
p, user, *, /api/delete-issue, allow
p, user, *, /api/get-store-favorite-status, allow
p, user, *, /api/toggle-store-favorite, allow
p, user, *, /api/get-favored-stores, allow
p, user, *, /api/get-hub-stores, allow
p, user, *, /api/fork-store, allow
p, user, *, /api/get-user-info, allow

p, anonymous, *, /api/signin, allow
p, anonymous, *, /api/signout, allow
p, anonymous, *, /api/health, allow
p, anonymous, *, /api/chrome-connect, allow
p, anonymous, *, /api/get-account, allow
p, anonymous, *, /api/get-signin-options, allow
p, anonymous, *, /api/get-built-in-site, allow
p, anonymous, *, /api/is-session-duplicated, allow
p, anonymous, *, /api/chat-webhook/*, allow

g, admin, user
g, store-admin, user
g, user, anonymous
`

func InitEnforcer() {
	m, err := model.NewModelFromString(modelText)
	if err != nil {
		panic(err)
	}

	sa := stringadapter.NewAdapter(policyText)
	e, err := casbin.NewEnforcer(m, sa)
	if err != nil {
		panic(err)
	}

	Enforcer = e
}

func IsAllowed(role, method, urlPath string) bool {
	allowed, err := Enforcer.Enforce(role, method, urlPath)
	if err != nil {
		return false
	}
	return allowed
}
