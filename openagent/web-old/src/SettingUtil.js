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

import {message} from "antd";
import i18next from "i18next";
import {isMobile as isMobileDevice} from "react-device-detect";
import xlsx from "xlsx";
import FileSaver from "file-saver";
import moment from "moment/moment";
import {v4 as uuidv4} from "uuid";

export function parseJson(s) {
  if (s === "") {
    return null;
  } else {
    return JSON.parse(s);
  }
}

/**
 * Reads a fetch Response body and returns parsed JSON, or a normalized {status: "error", msg}
 * when HTTP failed or the body is not JSON (e.g. HTML error pages).
 */
export async function handleFetchResponse(res) {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
        return {
          status: "error",
          msg: `HTTP ${res.status} ${res.statusText || ""}`.trim() + (preview ? `: ${preview}` : ""),
        };
      }
      throw new Error("Invalid JSON response");
    }
  }
  if (!res.ok) {
    const msg = (data && (data.msg || data.message)) || `HTTP ${res.status} ${res.statusText || ""}`.trim();
    return {status: "error", msg};
  }
  return data;
}

export function myParseInt(i) {
  const res = parseInt(i);
  return isNaN(res) ? 0 : res;
}

export function myParseFloat(f) {
  const res = parseFloat(f);
  return isNaN(res) ? 0.0 : res;
}

export function openLink(link) {
  // this.props.history.push(link);
  const w = window.open("about:blank");
  w.location.href = link;
}

export function goToLink(link) {
  window.location.href = link;
}

export function goToLinkSoft(ths, link) {
  ths.props.history.push(link);
}

export function showMessage(type, text) {
  if (type === "") {
    return;
  } else if (type === "success") {
    message.success(text);
  } else if (type === "error") {
    message.error(text);
  }
}

export function deepCopy(obj) {
  if (obj === null) {
    return null;
  }

  return Object.assign({}, obj);
}

export function insertRow(array, row, i) {
  return [...array.slice(0, i), row, ...array.slice(i)];
}

export function addRow(array, row) {
  return [...array, row];
}

export function prependRow(array, row) {
  return [row, ...array];
}

export function deleteRow(array, i) {
  // return array = array.slice(0, i).concat(array.slice(i + 1));
  return [...array.slice(0, i), ...array.slice(i + 1)];
}

export function swapRow(array, i, j) {
  return [...array.slice(0, i), array[j], ...array.slice(i + 1, j), array[i], ...array.slice(j + 1)];
}

export function trim(str, ch) {
  if (str === undefined) {
    return undefined;
  }

  let start = 0;
  let end = str.length;

  while (start < end && str[start] === ch) {++start;}

  while (end > start && str[end - 1] === ch) {--end;}

  return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}

export function isMobile() {
  // return getIsMobileView();
  return isMobileDevice;
}

export function getFormattedDate(date) {
  if (date === undefined || date === null) {
    return null;
  }

  date = date.replace("T", " ");
  date = date.replace("+08:00", " ");
  return date;
}

export function getFormattedDateShort(date) {
  return date.slice(0, 10);
}

export function getShortName(s) {
  return s.split("/").slice(-1)[0];
}

export function getShortText(s, maxLength = 35) {
  if (!s) {
    return "";
  }
  if (s.length > maxLength) {
    return `${s.slice(0, maxLength)}...`;
  } else {
    return s;
  }
}

export function getUrlParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

export function getPercentage(f) {
  if (f === undefined) {
    return 0.0;
  }

  return (100 * f).toFixed(1);
}

function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i !== s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xFF;
  }
  return buf;
}

export function workbook2blob(workbook) {
  const wopts = {
    bookType: "xlsx",
    bookSST: false,
    type: "binary",
  };
  const wbout = xlsx.write(workbook, wopts);
  return new Blob([s2ab(wbout)], {type: "application/octet-stream"});
}

export function sheet2blob(sheet, sheetName) {
  const workbook = {
    SheetNames: [sheetName],
    Sheets: {},
  };
  workbook.Sheets[sheetName] = sheet;
  return workbook2blob(workbook);
}

export function saveSheetToFile(sheet, sheetName, filename) {
  try {
    const blob = sheet2blob(sheet, sheetName);
    FileSaver.saveAs(blob, filename);
  } catch (error) {
    showMessage("error", `${i18next.t("general:Failed to save")}: ${error.message}`);
  }
}

export function json2sheet(data) {
  return xlsx.utils.json_to_sheet(data);
}

export function toggleElementFromSet(array, element) {
  if (!array) {
    array = [];
  }
  if (array.includes(element)) {
    return array.filter(e => e !== element);
  } else {
    return [...array, element];
  }
}

export function addElementToSet(set, newUser) {
  if (!set) {
    set = [];
  }
  if (!set.includes(newUser)) {
    set.push(newUser);
  }
  return set;
}

export function deleteElementFromSet(set, newUser) {
  if (!set) {
    return [];
  }
  return set.filter(user => user !== newUser);
}

export const redirectCatchJsonError = async(url) => {
  try {
    const response = await fetch(url);
    const data = await handleFetchResponse(response);
    if (response.ok) {
      this.props.history.push(url);
    } else {
      showMessage("error", `${i18next.t("general:Failed to redirect")}: ${(data && data.msg) || ""}`);
    }
  } catch (error) {
    showMessage("error", `${i18next.t("general:Failed to redirect")}: ${error.message}`);
  }
};

export function toFixed(f, n) {
  return parseFloat(f.toFixed(n));
}

export function getRandomName() {
  return Math.random().toString(36).slice(-6);
}

export function getFriendlyFileSize(size) {
  if (size < 1024) {
    return size + " B";
  }

  const i = Math.floor(Math.log(size) / Math.log(1024));
  let num = (size / Math.pow(1024, i));
  const round = Math.round(num);
  num = round < 10 ? num.toFixed(2) : round < 100 ? num.toFixed(1) : round;
  return `${num} ${"KMGTPEZY"[i - 1]}B`;
}

export function getTreeWithParents(tree) {
  const res = deepCopy(tree);
  res.children = tree.children.map((file, index) => {
    file.parent = tree;
    return getTreeWithParents(file);
  });
  return res;
}

export function getTreeWithSearch(tree, s) {
  const res = deepCopy(tree);
  res.children = tree.children.map((file, index) => {
    if (file.children.length === 0) {
      if (file.title.includes(s)) {
        return file;
      } else {
        return null;
      }
    } else {
      const tmpTree = getTreeWithSearch(file, s);
      if (tmpTree.children.length !== 0) {
        return tmpTree;
      } else {
        if (file.title.includes(s)) {
          return file;
        } else {
          return null;
        }
      }
    }
  }).filter((file, index) => {
    return file !== null;
  });
  return res;
}

export function getExtFromPath(path) {
  const filename = path.split("/").pop();
  if (filename.includes(".")) {
    return filename.split(".").pop().toLowerCase();
  } else {
    return "";
  }
}

export function getFileIconType(filename) {
  if (!filename) {
    return "icon-testdocument";
  }
  const ext = getExtFromPath(filename);
  if (ext === "pdf") {
    return "icon-testpdf";
  } else if (ext === "doc" || ext === "docx") {
    return "icon-testdocx";
  } else if (ext === "ppt" || ext === "pptx") {
    return "icon-testpptx";
  } else if (ext === "xls" || ext === "xlsx") {
    return "icon-testxlsx";
  } else if (ext === "txt") {
    return "icon-testdocument";
  } else if (ext === "png" || ext === "bmp" || ext === "jpg" || ext === "jpeg" || ext === "svg") {
    return "icon-testPicture";
  } else if (ext === "html") {
    return "icon-testhtml";
  } else if (ext === "js") {
    return "icon-testjs";
  } else if (ext === "css") {
    return "icon-testcss";
  } else {
    return "icon-testfile-unknown";
  }
}

export function getExtFromFile(file) {
  const res = file.title.split(".")[1];
  if (res === undefined) {
    return "";
  } else {
    return res;
  }
}

export function getFileCategory(file) {
  if (file.isLeaf) {
    return i18next.t("store:File");
  } else {
    return i18next.t("store:Folder");
  }
}

export function getDistinctArray(arr) {
  return [...new Set(arr)];
}

export function getCollectedTime(filename) {
  // 20220827_210300_CH~Logo.png
  const tokens = filename.split("~");
  if (tokens.length < 2) {
    return null;
  }

  const time = tokens[0].slice(0, -3);
  const m = new moment(time, "YYYYMMDD_HH:mm:ss");
  return m.format();
}

export function getSubject(filename) {
  // 20220827_210300_CH~Logo.png
  const tokens = filename.split("~");
  if (tokens.length < 2) {
    return null;
  }

  const subject = tokens[0].slice(tokens[0].length - 2);
  if (subject === "MA") {
    return i18next.t("store:Math");
  } else if (subject === "CH") {
    return i18next.t("store:Chinese");
  } else if (subject === "NU") {
    return null;
  } else {
    return subject;
  }
}

export function parseJsonFromText(text) {
  const regex = /\[\[(.*?)\]\]/;
  const match = regex.exec(text);

  if (match) {
    try {
      // const parsedJSON = JSON.parse(match[1]);
      const parsedJSON = match[1];
      return parsedJSON;
    } catch (error) {
      showMessage("error", error);
      return "";
    }
  }

  return "";
}

export function getSubdomain() {
  const url = window.location.origin;
  const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/;
  const matches = url.match(regex);
  if (matches && matches[1]) {
    const domainParts = matches[1].split(".");
    if (domainParts.length > 2) {
      return domainParts[0];
    }
  }
  return null;
}

export function getTimeFromSeconds(seconds) {
  const duration = moment.duration(seconds, "seconds");
  // const hours = Math.floor(duration.asHours()).toString().padStart(2, "0");
  const minutes = duration.minutes().toString().padStart(2, "0");
  const sec = duration.seconds().toString().padStart(2, "0");
  const millisec = duration.milliseconds().toString().padStart(3, "0").substring(0, 3);
  return `${minutes} : ${sec}.${millisec}`;
}

export function sumFields(chats, field) {
  if (!chats) {
    return 0;
  }

  if (field === "count") {
    return chats.reduce((sum, chat) => sum + 1, 0);
  } else {
    return chats.reduce((sum, chat) => sum + chat[field], 0);
  }
}

export function uniqueFields(chats, field) {
  if (!chats) {
    return 0;
  }

  const res = new Set(chats.map(chat => chat[field]));
  return res.size;
}

export function getRefinedErrorText(errorText) {
  if (errorText.startsWith("error, status code: 400, message: The response was filtered due to the prompt triggering")) {
    return i18next.t("chat:Your chat text involves sensitive content. This chat has been forcibly terminated.");
  } else if (errorText.startsWith("write tcp ")) {
    return i18next.t("chat:The response has been interrupted. Please do not refresh the page during responding.");
  } else if (errorText.includes("Please add a model provider first") || errorText.includes("请先添加模型提供商")) {
    return i18next.t("chat:No model configured - notice");
  } else {
    return errorText;
  }
}

export function formatSuggestion(suggestionText) {
  suggestionText = suggestionText.trim().replace(/^</, "").replace(/>$/, "");
  if (!suggestionText.endsWith("?") && !suggestionText.endsWith("？")) {
    suggestionText += "?";
  }
  return suggestionText;
}

export function GetIdFromObject(obj) {
  if (obj === undefined || obj === null) {
    return "";
  }
  return `${obj.owner}/${obj.name}`;
}

export function GenerateId() {
  return uuidv4();
}

export function formatJsonString(s) {
  if (s === "") {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch (error) {
    return s;
  }
}

export function getDeduplicatedArray(array, filterArray, key) {
  const res = array.filter(item => !filterArray.some(tableItem => tableItem[key] === item[key]));
  return res;
}

export function getFormattedSize(bytes) {
  if (bytes === 0) {return "0 Bytes";}
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

export const GradeOptions = [
  "一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "七年级", "八年级", "九年级",
  "高一", "高二", "高三",
];

export const SubjectOptions = [
  "语文", "数学", "英语", "道德与法治", "科学", "物理", "化学", "生物学", "历史", "地理", "体育与健康", "音乐", "美术",
];
