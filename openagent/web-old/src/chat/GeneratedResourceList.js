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
import {Button, Card, Flex, Tag, Typography} from "antd";
import {DownloadOutlined} from "@ant-design/icons";
import {saveAs} from "file-saver";
import i18next from "i18next";
import * as Setting from "../Setting";

const listStyle = {width: "100%", maxWidth: 760, marginBottom: 12};
const cardStyle = {width: "100%"};
const rowStyle = {width: "100%"};
const metaStyle = {flex: 1, minWidth: 0};
const tagStyle = {width: "fit-content", marginInlineEnd: 0};

function getFileExt(fileName, mimeType) {
  if (fileName) {
    const dot = fileName.lastIndexOf(".");
    if (dot >= 0 && dot < fileName.length - 1) {
      return fileName.substring(dot + 1).toUpperCase();
    }
  }
  if (mimeType) {
    const part = mimeType.split("/").pop();
    if (part && part !== mimeType) {
      return part.toUpperCase();
    }
  }
  return "FILE";
}

async function downloadResource(e, href, fileName) {
  e.preventDefault();
  try {
    const response = await fetch(href);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const blob = await response.blob();
    saveAs(blob, fileName);
  } catch (error) {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

/**
 * Extracts resource_link items from a message's toolCalls array.
 * Returns [] when no resources are present.
 */
export function extractGeneratedResources(toolCalls) {
  const resources = [];
  (toolCalls || []).forEach(toolCall => {
    if (!toolCall.content) {return;}
    let content;
    try {
      content = JSON.parse(toolCall.content);
    } catch (e) {
      return;
    }
    if (!Array.isArray(content)) {return;}
    content.forEach(item => {
      if (item && item.type === "resource_link" && typeof item.uri === "string" && item.uri !== "") {
        resources.push(item);
      }
    });
  });
  return resources;
}

/**
 * Renders a list of download cards for AI-generated resource files.
 * Each card shows the file name, type tag, and a download button.
 *
 * @param {Array} resources - Array of resource_link objects {uri, name, mimeType}
 */
const GeneratedResourceList = ({resources}) => {
  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <Flex vertical gap="small" style={listStyle}>
      {resources.map((resource, idx) => {
        const href = resource.uri;
        const fileName = resource.name || resource.uri;
        const ext = getFileExt(resource.name, resource.mimeType);
        return (
          <Card key={`${resource.uri}-${idx}`} size="small" style={cardStyle}>
            <Flex align="center" gap="middle" style={rowStyle}>
              <Setting.IconFont type={Setting.getFileIconType(fileName)} style={{fontSize: "48px", lineHeight: 1, flexShrink: 0}} />
              <Flex vertical gap={2} style={metaStyle}>
                <Typography.Text strong ellipsis={{tooltip: fileName}}>
                  {fileName}
                </Typography.Text>
                <Tag style={tagStyle}>{ext}</Tag>
              </Flex>
              <Button
                href={href}
                download={fileName}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => downloadResource(e, href, fileName)}
                icon={<DownloadOutlined />}
              >
                {i18next.t("general:Download")}
              </Button>
            </Flex>
          </Card>
        );
      })}
    </Flex>
  );
};

export default GeneratedResourceList;
