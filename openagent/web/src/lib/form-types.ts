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

export interface FormItem {
  name: string;
  label: string;
  visible?: boolean;
  width?: string;
  type?: string;
}

/** The list pages a "List Page" Form can customize, and the columns each one starts with. */
export function getFormTypeOptions() {
  return [
    {id: "records", name: "general:Records"},
    {id: "stores", name: "general:Stores"},
    {id: "vectors", name: "general:Vectors"},
    {id: "tasks", name: "general:Tasks"},
  ];
}

export function getFormTypeItems(formType: string): FormItem[] {
  if (formType === "records") {
    return [
      {name: "organization", label: "general:Organization", visible: true, width: "110"},
      {name: "id", label: "general:ID", visible: true, width: "90"},
      {name: "name", label: "general:Name", visible: true, width: "300"},
      {name: "clientIp", label: "general:Client IP", visible: true, width: "150"},
      {name: "createdTime", label: "general:Created time", visible: true, width: "150"},
      {name: "provider", label: "general:Provider", visible: true, width: "150"},
      {name: "provider2", label: "general:Provider 2", visible: true, width: "150"},
      {name: "user", label: "general:User", visible: true, width: "120"},
      {name: "method", label: "general:Method", visible: true, width: "110"},
      {name: "requestUri", label: "general:Request URI", visible: true, width: "200"},
      {name: "language", label: "general:Language", visible: true, width: "90"},
      {name: "query", label: "general:Query", visible: true, width: "90"},
      {name: "region", label: "general:Region", visible: true, width: "90"},
      {name: "city", label: "general:City", visible: true, width: "90"},
      {name: "unit", label: "general:Unit", visible: true, width: "90"},
      {name: "section", label: "general:Section", visible: true, width: "90"},
      {name: "response", label: "general:Response", visible: true, width: "90"},
      {name: "object", label: "general:Object", visible: true, width: "200"},
      {name: "errorText", label: "message:Error text", visible: true, width: "120"},
      {name: "isTriggered", label: "general:Is triggered", visible: true, width: "140"},
      {name: "action", label: "general:Action", visible: true, width: "150"},
      {name: "block", label: "general:Block", visible: true, width: "110"},
      {name: "block2", label: "general:Block 2", visible: true, width: "110"},
    ];
  } else if (formType === "stores") {
    return [
      {name: "name", label: "general:Name", visible: true, width: "120"},
      {name: "displayName", label: "general:Display name", visible: true},
      {name: "isDefault", label: "store:Is default", visible: true, width: "120"},
      {name: "chatCount", label: "store:Chat count", visible: true, width: "150"},
      {name: "messageCount", label: "chat:Message count", visible: true, width: "150"},
      {name: "vectorCount", label: "store:Vector count", visible: true, width: "150"},
      {name: "storageProvider", label: "store:Storage provider", visible: true, width: "250"},
      // { name: "splitProvider", label: "store:Split provider", visible: false, width: "200" },
      {name: "imageProvider", label: "store:Image provider", visible: true, width: "300"},
      {name: "modelProvider", label: "provider:Model provider", visible: true, width: "330"},
      {name: "embeddingProvider", label: "store:Embedding provider", visible: true, width: "300"},
      {name: "textToSpeechProvider", label: "store:Text-to-Speech provider", visible: true, width: "300"},
      {name: "speechToTextProvider", label: "store:Speech-to-Text provider", visible: true, width: "200"},
      {name: "mcpServer", label: "store:MCP server", visible: true, width: "250"},
      {name: "tools", label: "general:Tools", visible: true, width: "280"},
      {name: "memoryLimit", label: "store:Memory limit", visible: true, width: "120"},
      {name: "state", label: "general:State", visible: true, width: "90"},
    ];
  } else if (formType === "vectors") {
    return [
      {name: "name", label: "general:Name", visible: true, width: "140"},
      // { name: "displayName", label: "general:Display name", visible: false, width: "200" },
      {name: "store", label: "general:Store", visible: true, width: "130"},
      {name: "provider", label: "general:Provider", visible: true, width: "200"},
      {name: "file", label: "store:File", visible: true, width: "200"},
      {name: "index", label: "vector:Index", visible: true, width: "80"},
      {name: "text", label: "general:Text", visible: true, width: "200"},
      {name: "size", label: "general:Size", visible: true, width: "80"},
      {name: "data", label: "general:Data", visible: true, width: "200"},
      {name: "dimension", label: "vector:Dimension", visible: true, width: "80"},
    ];
  } else if (formType === "tasks") {
    return [
      {name: "name", label: "general:Name", visible: true, width: "160"},
      {name: "displayName", label: "general:Display name", visible: true, width: "200"},
      {name: "createdTime", label: "general:Created time", visible: true, width: "160"},
      {name: "provider", label: "provider:Model provider", visible: true, width: "250"},
      {name: "type", label: "general:Type", visible: true, width: "90"},
      {name: "subject", label: "store:Subject", visible: true, width: "200"},
      {name: "topic", label: "store:Topic", visible: true, width: "200"},
      {name: "result", label: "general:Result", visible: true, width: "200"},
      {name: "activity", label: "task:Activity", visible: true, width: "200"},
      {name: "grade", label: "store:Grade", visible: true, width: "200"},
      // { name: "application", label: "task:Application", visible: false, width: "180" },
      // { name: "path", label: "general:Path", visible: false },
      {name: "text", label: "general:Text", visible: true},
      {name: "labels", label: "task:Labels", visible: true, width: "250"},
      {name: "example", label: "task:Example", visible: true},
    ];
  } else {
    return [];
  }
}
