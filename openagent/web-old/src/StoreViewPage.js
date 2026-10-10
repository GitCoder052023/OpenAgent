// Copyright 2026 The OpenAgent Authors. All Rights Reserved.
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

import React from "react";
import {Spin} from "antd";
import * as StoreBackend from "./backend/StoreBackend";
import * as Setting from "./Setting";
import i18next from "i18next";
import {getChatUrl} from "./StoreHubDrawer";
import StoreHubAgentDetail from "./StoreHubAgentDetail";

const VALID_TABS = new Set(["overview", "chat", "files", "issues", "security", "insights", "settings"]);
const VALID_INSIGHTS_SUBS = new Set(["pulse", "contributors", "traffic", "wordcloud", "cost", "stargazers", "watchers", "forks"]);

function resolveActiveTab(match) {
  const {tab, sub, issueName} = match.params;
  // /agents/:owner/:storeName/insights/:sub → activeTab = "insights"
  if (sub && VALID_INSIGHTS_SUBS.has(sub)) {return "insights";}
  // /agents/:owner/:storeName/issues/:issueName → activeTab = "issues"
  if (issueName) {return "issues";}
  if (tab && VALID_TABS.has(tab)) {return tab;}
  return "overview";
}

function resolveActiveSub(match) {
  const {sub} = match.params;
  if (sub && VALID_INSIGHTS_SUBS.has(sub)) {return sub;}
  return "pulse";
}

function resolveActiveIssueName(match) {
  return match.params.issueName || null;
}

function buildTabUrl(owner, storeName, tab, sub) {
  if (tab === "insights") {
    return `/agents/${owner}/${storeName}/insights/${sub || "pulse"}`;
  }
  if (!tab || tab === "overview") {
    return `/agents/${owner}/${storeName}`;
  }
  return `/agents/${owner}/${storeName}/${tab}`;
}

function buildIssueUrl(owner, storeName, issueName) {
  if (!issueName) {
    return `/agents/${owner}/${storeName}/issues`;
  }
  return `/agents/${owner}/${storeName}/issues/${issueName}`;
}

class StoreViewPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      owner: props.match.params.owner,
      storeName: props.match.params.storeName,
      store: null,
      loading: true,
      forking: false,
      favoriteStatus: {starCount: 0, watchCount: 0, starred: false, watched: false, hasForked: false, isOwner: false},
      starLoading: false,
      watchLoading: false,
    };
  }

  componentDidMount() {
    this.getStore();
  }

  componentDidUpdate(prevProps) {
    // Route changed to a different store — refetch. Sub-tab / tab changes
    // reuse the already-loaded store, so we only refetch when the store
    // coordinates in the URL actually change.
    const {owner: prevOwner, storeName: prevName} = prevProps.match.params;
    const {owner, storeName} = this.props.match.params;
    if (owner !== prevOwner || storeName !== prevName) {
      this.setState({owner, storeName, store: null, loading: true},
        () => this.getStore(owner, storeName));
    }
  }

  // Page-view logging runs entirely on the backend (see routers/TrackStoreVisit).
  // getStore only fetches; the AfterExec filter records the visit if the response
  // was ok — no separate frontend call, no forgeable endpoint.
  getStore(owner = this.state.owner, storeName = this.state.storeName) {
    StoreBackend.getStore(owner, storeName)
      .then((res) => {
        if (res.status === "ok") {
          const store = res.data;
          if (store && typeof res.data2 === "string" && res.data2 !== "") {
            store.error = res.data2;
          }
          this.setState({store, loading: false});
          this.getFavoriteStatus(owner, storeName, store?.hubDbName);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
          this.setState({loading: false});
        }
      });
  }

  getFavoriteStatus(owner = this.state.owner, storeName = this.state.storeName, hubDbName = this.state.store?.hubDbName) {
    StoreBackend.getStoreFavoriteStatus(owner, storeName, hubDbName)
      .then((res) => {
        if (res.status === "ok" && res.data) {
          this.setState({favoriteStatus: res.data});
        }
      });
  }

  handleStartChat() {
    const {store} = this.state;
    if (!store) {return;}
    if (store.endpoint) {
      window.open(getChatUrl(store), "_blank", "noopener,noreferrer");
    } else {
      this.props.history.push(`/stores/${store.owner}/${store.name}/chat`);
    }
  }

  handleToggleFavorite(favoriteType) {
    const {store} = this.state;
    const {account} = this.props;
    if (!store) {return;}
    if (!account || Setting.isAnonymousUser(account)) {
      Setting.showMessage("info", i18next.t("store:Please sign in to continue"));
      return;
    }

    const loadingKey = favoriteType === "star" ? "starLoading" : "watchLoading";
    this.setState({[loadingKey]: true});
    StoreBackend.toggleStoreFavorite(favoriteType, store.owner, store.name)
      .then((res) => {
        if (res.status === "ok" && res.data) {
          const {favorited, count} = res.data;
          const favoriteStatus = {...this.state.favoriteStatus};
          if (favoriteType === "star") {
            favoriteStatus.starred = favorited;
            favoriteStatus.starCount = count;
          } else {
            favoriteStatus.watched = favorited;
            favoriteStatus.watchCount = count;
          }
          this.setState({favoriteStatus});
        } else {
          Setting.showMessage("error", res.msg);
        }
      })
      .catch(error => Setting.showMessage("error", error.message || String(error)))
      .finally(() => this.setState({[loadingKey]: false}));
  }

  handleFork() {
    const {store, forking} = this.state;
    if (!store || forking) {return;}

    this.setState({forking: true});
    // Keep the loading state visible for at least ~1.2s so the user perceives
    // the fork happening, even when the request returns almost instantly.
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    Promise.all([StoreBackend.forkStore(store.owner, store.name), minDelay])
      .then(([res]) => {
        if (res.status === "ok") {
          const forkedStore = res.data;
          Setting.showMessage("success", i18next.t("store:Forked successfully"));
          // Route change picks up in componentDidUpdate → refetch happens there.
          this.props.history.push(`/agents/${forkedStore.owner}/${forkedStore.name}`);
        } else {
          Setting.showMessage("error", `${i18next.t("store:Fork failed")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("store:Fork failed")}: ${error}`);
      })
      .finally(() => this.setState({forking: false}));
  }

  canManageStore(store) {
    const {account} = this.props;
    if (!account || !store) {
      return false;
    }
    return account.name === store.owner || Setting.isAdminUser(account);
  }

  handleTabChange(key) {
    const {store} = this.state;
    if (!store) {return;}
    this.props.history.push(buildTabUrl(store.owner, store.name, key));
  }

  handleSubTabChange(sub) {
    const {store} = this.state;
    if (!store) {return;}
    this.props.history.push(buildTabUrl(store.owner, store.name, "insights", sub));
  }

  handleIssueChange(issueName) {
    const {store} = this.state;
    if (!store) {return;}
    this.props.history.push(buildIssueUrl(store.owner, store.name, issueName));
  }

  render() {
    const {store, loading, forking, favoriteStatus, starLoading, watchLoading} = this.state;

    if (loading) {
      return (
        <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "calc(100vh - 120px)"}}>
          <Spin size="large" tip={i18next.t("general:Loading...")} />
        </div>
      );
    }

    if (!store) {
      return null;
    }

    const canManage = this.canManageStore(store);
    const activeTab = resolveActiveTab(this.props.match);
    const activeSub = resolveActiveSub(this.props.match);
    const activeIssueName = resolveActiveIssueName(this.props.match);

    return (
      <StoreHubAgentDetail
        account={this.props.account}
        history={this.props.history}
        store={store}
        activeTab={activeTab}
        activeSub={activeSub}
        activeIssueName={activeIssueName}
        canManage={canManage}
        onTabChange={(key) => this.handleTabChange(key)}
        onSubTabChange={(sub) => this.handleSubTabChange(sub)}
        onIssueChange={(issueName) => this.handleIssueChange(issueName)}
        onStartChat={() => this.handleStartChat()}
        onFork={() => this.handleFork()}
        forking={forking}
        favoriteStatus={favoriteStatus}
        starLoading={starLoading}
        watchLoading={watchLoading}
        onToggleFavorite={(favoriteType) => this.handleToggleFavorite(favoriteType)}
        onStoreUpdate={(updatedStore) => {
          this.setState({store: updatedStore});
          Setting.submitStoreEdit(updatedStore);
        }}
        onRefresh={() => this.getStore()}
        onOpenAnalysis={() => this.props.history.push(`/analysis/${store.owner}/${store.name}`)}
      />
    );
  }
}

export default StoreViewPage;
