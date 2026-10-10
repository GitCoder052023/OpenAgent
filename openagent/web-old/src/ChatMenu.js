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

import React from "react";
import {Button, Dropdown, Input, Menu, Popconfirm, Tooltip} from "antd";
import {CloseOutlined, DeleteOutlined, EditOutlined, LayoutOutlined, LoadingOutlined, PlusOutlined, SaveOutlined} from "@ant-design/icons";
import i18next from "i18next";
import * as Setting from "./Setting";
import {ThemeDefault} from "./Conf";

class ChatMenu extends React.Component {
  constructor(props) {
    super(props);

    const items = this.chatsToItems(this.props.chats);
    const selectedKey = this.getSelectedKeyOfCurrentChat(this.props.chats, this.props.chatName);
    const openKeys = items.map((item) => item.key);

    this.state = {
      openKeys: openKeys,
      selectedKeys: selectedKey ? [selectedKey] : [],
      editingKey: null,
      editChatName: "",
      hoveredKey: null,
      popconfirmOpenKey: null,
    };
  }

  renderIndicator(chat) {
    const isDark = Setting.getIsDark();
    const themeColor = ThemeDefault.colorPrimary || "#262626";
    const readBorderColor = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";

    if (chat.isGenerating) {
      return (
        <span className="chat-status-indicator">
          <LoadingOutlined spin style={{
            width: "1em",
            height: "1em",
            fontSize: "1em",
            lineHeight: 1,
            color: themeColor,
          }} />
        </span>
      );
    }

    return (
      <span className="chat-status-indicator">
        <span style={{
          width: "0.625em",
          height: "0.625em",
          borderRadius: "50%",
          display: "block",
          backgroundColor: chat.isUnread ? themeColor : "transparent",
          border: chat.isUnread ? `0.0625em solid ${themeColor}` : `0.0625em solid ${readBorderColor}`,
        }} />
      </span>
    );
  }

  getChatItemKey(chat) {
    return `chat:${chat.owner}/${chat.name}`;
  }

  chatsToItems(chats) {
    const categories = {};
    chats.forEach((chat) => {
      if (chat.isHidden === true) {
        return;
      }
      if (!categories[chat.category]) {
        categories[chat.category] = [];
      }
      categories[chat.category].push(chat);
    });

    return Object.keys(categories).map((category) => {
      return {
        key: `category:${category}`,
        icon: <LayoutOutlined />,
        label: category,
        children: categories[category].map((chat) => {
          const globalChatIndex = chats.indexOf(chat);
          const itemKey = this.getChatItemKey(chat);
          const isHovered = this.state !== undefined && this.state.hoveredKey === itemKey;
          const popconfirmOpenKey = this.state !== undefined ? this.state.popconfirmOpenKey : null;
          const showActionButtons = popconfirmOpenKey === itemKey || (isHovered && popconfirmOpenKey === null);
          const handleIconMouseEnter = (e) => {
            e.currentTarget.style.color = ThemeDefault.colorPrimary;
            e.currentTarget.style.opacity = 0.6;
          };

          const handleIconMouseLeave = (e) => {
            e.currentTarget.style.color = "inherit";
            e.currentTarget.style.opacity = 1;
          };

          const handleIconMouseDown = (e) => {
            e.currentTarget.style.color = ThemeDefault.colorPrimary;
            e.currentTarget.style.opacity = 0.4;
          };

          const handleIconMouseUp = (e) => {
            e.currentTarget.style.color = ThemeDefault.colorPrimary;
            e.currentTarget.style.opacity = 0.6;
          };

          const onSave = (e) => {
            e.stopPropagation();
            this.props.onUpdateChatName(globalChatIndex, this.state.editChatName);
            this.setState({editingKey: null});
          };

          return {
            key: itemKey,
            index: globalChatIndex,
            className: "chat-menu-item",
            label: (
              this.state?.editingKey === itemKey ? (
                <div className="menu-item-container">
                  <Input style={{width: "70%"}} value={this.state.editChatName}
                    onChange={(event) => {this.setState({editChatName: event.target.value});}}
                    onBlur={onSave}
                    onPressEnter={onSave} />
                  <SaveOutlined className="menu-item-icon"
                    onMouseEnter={handleIconMouseEnter}
                    onMouseLeave={handleIconMouseLeave}
                    onMouseDown={handleIconMouseDown}
                    onMouseUp={handleIconMouseUp}
                    onClick={onSave}
                  />
                  <CloseOutlined className="menu-item-icon"
                    onMouseEnter={handleIconMouseEnter}
                    onMouseLeave={handleIconMouseLeave}
                    onMouseDown={handleIconMouseDown}
                    onMouseUp={handleIconMouseUp}
                    onClick={(e) => {
                      e.stopPropagation();
                      this.setState({editingKey: null});
                    }}
                  />
                </div>) : (
                <div className="menu-item-container"
                  onMouseEnter={() => this.setState({hoveredKey: itemKey})}
                  onMouseLeave={() => this.setState({hoveredKey: null})}
                  style={{width: "100%"}}
                >
                  {this.renderIndicator(chat)}
                  <div style={{flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                    <Tooltip title={chat.displayName}>
                      <span style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                        {chat.displayName}
                      </span>
                    </Tooltip>
                  </div>
                  {showActionButtons && (
                    <div>
                      <EditOutlined className="menu-item-icon"
                        onMouseEnter={handleIconMouseEnter}
                        onMouseLeave={handleIconMouseLeave}
                        onMouseDown={handleIconMouseDown}
                        onMouseUp={handleIconMouseUp}
                        onClick={(e) => {
                          e.stopPropagation();
                          this.setState({
                            editChatName: this.props.chats[globalChatIndex].displayName,
                            editingKey: itemKey,
                          });
                        }} />
                      <Popconfirm
                        title={`${i18next.t("general:Sure to delete")}: ${chat.displayName} ?`}
                        onOpenChange={(open) => {
                          this.setState({popconfirmOpenKey: open ? itemKey : null});
                        }}
                        onConfirm={() => {
                          if (this.props.onDeleteChat) {
                            this.props.onDeleteChat(globalChatIndex);
                          }
                        }}
                        okText={i18next.t("general:OK")}
                        cancelText={i18next.t("general:Cancel")}
                        okButtonProps={{"data-preview-allow": true}}
                      >
                        <DeleteOutlined className="menu-item-icon"
                          onMouseEnter={handleIconMouseEnter}
                          onMouseLeave={handleIconMouseLeave}
                          onMouseDown={handleIconMouseDown}
                          onMouseUp={handleIconMouseUp}
                        />
                      </Popconfirm>
                    </div>
                  )}
                </div>)
            ),
          };
        }),
      };
    });
  }

  onSelect = (info) => {
    const selectedItem = this.chatsToItems(this.props.chats)
      .flatMap(item => item.children || [])
      .find(item => item.key === info.key);
    if (!selectedItem) {
      return;
    }
    this.setState({
      selectedKeys: [selectedItem.key],
      editingKey: null,
      editChatName: this.props.chats[selectedItem.index].displayName,
    });

    if (this.props.onSelectChat) {
      this.props.onSelectChat(selectedItem.index);
    }
  };

  getRootSubmenuKeys(items) {
    return items.map((item, index) => `${index}`);
  }

  clearSelectedKey() {
    this.setState({
      selectedKeys: [],
      editingKey: null,
    });
  }

  setSelectedKeyToChat(chats, chatName) {
    const items = this.chatsToItems(chats);
    const openKeys = items.map((item) => item.key);
    const selectedKey = this.getSelectedKeyOfCurrentChat(chats, chatName);

    this.setState({
      openKeys: openKeys,
      selectedKeys: selectedKey ? [selectedKey] : [],
    });
  }

  getSelectedKeyOfCurrentChat(chats, chatName) {
    if (!chatName) {
      return null;
    }
    const chat = chats.find(chat => chat.name === chatName);
    return chat ? this.getChatItemKey(chat) : null;
  }

  onOpenChange = (keys) => {
    const items = this.chatsToItems(this.props.chats);
    const rootSubmenuKeys = this.getRootSubmenuKeys(items);
    const latestOpenKey = keys.find((key) => this.state.openKeys.indexOf(key) === -1);

    if (rootSubmenuKeys.indexOf(latestOpenKey) === -1) {
      this.setState({openKeys: keys});
    } else {
      this.setState({openKeys: latestOpenKey ? [latestOpenKey] : []});
    }
  };

  renderAddChatButton(stores = [], currentStoreName = null) {
    if (!stores) {
      stores = [];
    }

    const defaultStore = stores.find(store => store.isDefault);
    let hasChildStores = false;

    if (currentStoreName) {
      const currentStore = stores.find(store => store.name === currentStoreName);
      if (currentStore) {
        stores = [];
        hasChildStores = false;
      }
    } else if (defaultStore) {
      if (!defaultStore.childStores || defaultStore.childStores.length === 0) {
        stores = [];
      } else {
        // Otherwise filter to show only the child stores
        stores = stores.filter(store => defaultStore.childStores.includes(store.name));
        hasChildStores = true;
      }
    }

    let hasEmptyChat = this.props.chats.some(chat => chat.messageCount === 0);
    hasEmptyChat = false;

    const items = stores.map((store, index) => {
      return {
        key: store.name,
        label: <p onClick={() => {
          this.props.onAddChat(store);
        }}>
          {store.displayName || store.name}
        </p>,
      };
    });

    const getNewChatButton = () => {
      return (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{
            width: "calc(100% - 16px)",
            height: "38px",
            margin: "8px",
            borderRadius: "8px",
            fontWeight: 500,
            fontSize: "14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
          disabled={hasEmptyChat}
          onClick={() => {
            if (currentStoreName) {
              const currentStore = this.props.stores.find(store => store.name === currentStoreName);
              this.props.onAddChat(currentStore);
            } else if (!hasChildStores) {
              this.props.onAddChat(defaultStore);
            }
          }}
        >
          {i18next.t("chat:New Chat")}
        </Button>
      );
    };

    if (stores.length === 0) {
      return getNewChatButton();
    }

    return (
      <Dropdown menu={{items}} disabled={hasEmptyChat}>
        {getNewChatButton()}
      </Dropdown>
    );
  }

  render() {
    const items = this.chatsToItems(this.props.chats, this.props.currentStoreName);

    return (
      <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
        {this.renderAddChatButton(this.props.stores, this.props.currentStoreName)}
        <div style={{flex: 1, overflow: "hidden", paddingRight: "4px"}}>
          <Menu
            className="chat-sidebar-menu"
            style={{
              maxHeight: "calc(100vh - 140px - 40px - 8px)",
              overflowY: "auto",
              background: "transparent",
              border: "none",
            }}
            mode="inline"
            openKeys={this.state.openKeys}
            selectedKeys={this.state.selectedKeys}
            onOpenChange={this.onOpenChange}
            onSelect={this.onSelect}
            items={items}
          />
        </div>
      </div>
    );
  }
}

export default ChatMenu;
