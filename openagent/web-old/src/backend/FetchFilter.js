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
import {Button, Modal, Space, Typography} from "antd";
import {ArrowRightOutlined, LockOutlined} from "@ant-design/icons";
import * as Conf from "../Conf";
import * as Setting from "../Setting";

const {fetch: originalFetch} = window;
const {Text, Title} = Typography;

let demoModalVisible = false;

const demoModeCallback = (res, isWriteOperation) => {
  if (!isWriteOperation) {
    return;
  }
  Setting.handleFetchResponse(res).then(data => {
    if (data && Setting.isResponseDenied(data) && !demoModalVisible) {
      demoModalVisible = true;

      const tryUrl = `https://try.openagentai.org${location.pathname}${location.search}`;

      const modal = Modal.info({
        icon: null,
        title: null,
        closable: true,
        maskClosable: true,
        centered: true,
        width: 420,
        footer: null,
        afterClose: () => {
          demoModalVisible = false;
        },
        content: (
          <div style={{textAlign: "center", padding: "8px 0 4px"}}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 8px 24px rgba(102, 126, 234, 0.35)",
            }}>
              <LockOutlined style={{fontSize: 28, color: "#fff"}} />
            </div>
            <Title level={4} style={{margin: "0 0 10px", color: "#1a1a2e"}}>
              {"Read-Only Demo Site"}
            </Title>
            <Text type="secondary" style={{fontSize: 14, lineHeight: 1.6, display: "block", marginBottom: 24}}>
              {"This is a read-only demo — write operations are disabled here. Head over to the Try site to explore the full experience with all features unlocked."}
            </Text>
            <Space direction="vertical" style={{width: "100%"}} size={10}>
              <Button
                type="primary"
                size="large"
                block
                icon={<ArrowRightOutlined />}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: 8,
                  height: 44,
                  fontWeight: 600,
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                }}
                onClick={() => {
                  modal.destroy();
                  Setting.openLink(tryUrl);
                }}
              >
                {"Go to Try Site"}
              </Button>
              <Button
                size="large"
                block
                style={{borderRadius: 8, height: 44, color: "#888"}}
                onClick={() => modal.destroy()}
              >
                {"Stay Here"}
              </Button>
            </Space>
          </div>
        ),
      });
    }
  });
};

const requestFilters = [];
const responseFilters = [];

export function initDemoMode() {
  if (Conf.IsDemoMode && !responseFilters.includes(demoModeCallback)) {
    responseFilters.push(demoModeCallback);
  }
}

window.fetch = async(url, option = {}) => {
  requestFilters.forEach(filter => filter(url, option));

  const method = (option.method || "GET").toUpperCase();
  const isWriteOperation = method !== "GET" && method !== "HEAD";

  return new Promise((resolve, reject) => {
    originalFetch(url, option)
      .then(res => {
        responseFilters.forEach(filter => filter(res.clone(), isWriteOperation));
        resolve(res);
      })
      .catch(error => {
        reject(error);
      });
  });
};
