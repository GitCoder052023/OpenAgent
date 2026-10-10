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

export const TOOL_DELTA_PREVIEW_LIMIT = 6000;
export const TOOL_DELTA_FLUSH_INTERVAL = 80;

export function trimToolArguments(argumentsText, limit = TOOL_DELTA_PREVIEW_LIMIT) {
  if (!argumentsText || argumentsText.length <= limit) {
    return argumentsText || "";
  }
  return argumentsText.slice(argumentsText.length - limit);
}

function isPendingDeltaForTool(toolCall, toolEvent) {
  if (!toolCall.generatingArguments || toolCall.content) {
    return false;
  }
  if (!toolEvent.name) {
    return true;
  }
  return toolCall.name === toolEvent.name || toolCall.name === "tool";
}

export function applyToolDelta(toolCalls, jsonData, limit = TOOL_DELTA_PREVIEW_LIMIT) {
  const index = jsonData.index ?? 0;
  const argumentsDelta = jsonData.argumentsDelta || "";

  for (let i = toolCalls.length - 1; i >= 0; i--) {
    if (toolCalls[i].generatingArguments && toolCalls[i].index === index) {
      const nextArguments = `${toolCalls[i].arguments || ""}${argumentsDelta}`;
      toolCalls[i] = {
        ...toolCalls[i],
        id: jsonData.id || toolCalls[i].id,
        name: jsonData.name || toolCalls[i].name,
        arguments: trimToolArguments(nextArguments, limit),
      };
      return toolCalls[i];
    }
  }

  const toolCall = {
    index,
    id: jsonData.id,
    name: jsonData.name || "tool",
    arguments: trimToolArguments(argumentsDelta, limit),
    content: "",
    generatingArguments: true,
  };
  toolCalls.push(toolCall);
  return toolCall;
}

// createToolDeltaFlusher returns { scheduleFlush, flushNow } which manage a
// debounced timer around a caller-supplied flush function.
export function createToolDeltaFlusher(flushFn) {
  let timer = null;
  const scheduleFlush = () => {
    if (timer !== null) {
      return;
    }
    timer = window.setTimeout(() => {
      timer = null;
      flushFn();
    }, TOOL_DELTA_FLUSH_INTERVAL);
  };
  const flushNow = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    flushFn();
  };
  return {scheduleFlush, flushNow};
}

export function applyToolEvent(toolCalls, jsonData) {
  if (!jsonData.content) {
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (isPendingDeltaForTool(toolCalls[i], jsonData)) {
        toolCalls[i] = {
          ...toolCalls[i],
          name: jsonData.name || toolCalls[i].name,
          arguments: jsonData.arguments || toolCalls[i].arguments || "",
          content: "",
          isError: false,
          generatingArguments: false,
        };
        return toolCalls[i];
      }
    }

    const toolCall = {
      name: jsonData.name,
      arguments: jsonData.arguments || "",
      content: "",
      isError: false,
    };
    toolCalls.push(toolCall);
    return toolCall;
  }

  for (let i = toolCalls.length - 1; i >= 0; i--) {
    if (toolCalls[i].name === jsonData.name && !toolCalls[i].content) {
      toolCalls[i] = {
        ...toolCalls[i],
        name: jsonData.name,
        arguments: jsonData.arguments || toolCalls[i].arguments || "",
        content: jsonData.content,
        isError: !!jsonData.isError,
        generatingArguments: false,
      };
      return toolCalls[i];
    }
  }

  const toolCall = {
    name: jsonData.name,
    arguments: jsonData.arguments || "",
    content: jsonData.content,
    isError: !!jsonData.isError,
  };
  toolCalls.push(toolCall);
  return toolCall;
}
