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

import React, {useState} from "react";
import {Button, Descriptions, Input, Modal, Spin, Tag, Typography} from "antd";
import * as SkillBackend from "./backend/SkillBackend";
import * as Setting from "./Setting";
import i18next from "i18next";
import moment from "moment";

const {Text} = Typography;

/**
 * LoadSkillModal — a self-contained modal that lets the user type a server-side
 * skill folder path, previews the parsed skill, and imports it into the database.
 *
 * Props:
 *   open        {boolean}            Whether the modal is visible.
 *   onClose     {() => void}         Called when the modal should close (cancel or after import).
 *   onImported  {(skillName) => void} Called after a successful import with the new skill's name.
 */
function LoadSkillModal({open, onClose, onImported}) {
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  function handleClose() {
    setPath("");
    setPreview(null);
    setLoading(false);
    onClose();
  }

  function handleLoad() {
    const trimmed = path.trim();
    if (!trimmed) {
      Setting.showMessage("error", i18next.t("skill:Please enter a path"));
      return;
    }
    setLoading(true);
    setPreview(null);
    SkillBackend.loadSkill(trimmed)
      .then((res) => {
        setLoading(false);
        if (res.status === "ok") {
          setPreview(res.data);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to load")}: ${res.msg}`);
        }
      })
      .catch((err) => {
        setLoading(false);
        Setting.showMessage("error", `${i18next.t("general:Failed to load")}: ${err}`);
      });
  }

  function handleImport() {
    if (!preview) {
      return;
    }
    const toSave = {
      ...preview,
      owner: "admin",
      createdTime: moment().format(),
    };
    SkillBackend.addSkill(toSave)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully added"));
          handleClose();
          onImported(toSave.name);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        }
      })
      .catch((err) => {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${err}`);
      });
  }

  return (
    <Modal
      title={i18next.t("skill:Load Existing Skill")}
      open={open}
      onCancel={handleClose}
      width={760}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {i18next.t("general:Cancel")}
        </Button>,
        <Button
          key="load"
          onClick={handleLoad}
          loading={loading}
          disabled={!path.trim()}
        >
          {i18next.t("skill:Load")}
        </Button>,
        <Button
          key="import"
          type="primary"
          disabled={!preview}
          onClick={handleImport}
        >
          {i18next.t("skill:Import to Database")}
        </Button>,
      ]}
    >
      {/* Path input */}
      <div style={{marginBottom: "12px"}}>
        <div style={{marginBottom: "6px", color: "rgba(0,0,0,0.65)"}}>
          {i18next.t("skill:Skill folder path")}
        </div>
        <Input
          placeholder={i18next.t("skill:Skill folder path placeholder")}
          value={path}
          onChange={(e) => {
            setPath(e.target.value);
            setPreview(null);
          }}
          onPressEnter={handleLoad}
          style={{fontFamily: "monospace"}}
        />
        <div style={{marginTop: "4px", fontSize: "12px", color: "rgba(0,0,0,0.45)"}}>
          {i18next.t("skill:Skill folder path hint")}
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div style={{textAlign: "center", padding: "24px 0"}}>
          <Spin tip={i18next.t("general:Loading")} />
        </div>
      )}

      {/* Preview card */}
      {preview && !loading && (
        <Descriptions
          title={
            <span>
              {preview.emoji && <span style={{marginRight: 8}}>{preview.emoji}</span>}
              {preview.name}
            </span>
          }
          bordered
          size="small"
          column={1}
        >
          <Descriptions.Item label={i18next.t("general:Description")}>
            <Text style={{whiteSpace: "pre-wrap"}}>{preview.description || "—"}</Text>
          </Descriptions.Item>
          {preview.homepage && (
            <Descriptions.Item label={i18next.t("skill:Homepage")}>
              <a href={preview.homepage} target="_blank" rel="noopener noreferrer">
                {preview.homepage}
              </a>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={i18next.t("skill:References")}>
            {(preview.references && preview.references.length > 0)
              ? preview.references.map((r) => (
                <Tag key={r.name} style={{fontFamily: "monospace"}}>{r.name}</Tag>
              ))
              : <Text type="secondary">—</Text>
            }
          </Descriptions.Item>
          <Descriptions.Item label={i18next.t("skill:Content preview")}>
            <pre style={{
              maxHeight: 160,
              overflow: "auto",
              background: "#f5f5f5",
              padding: "8px",
              borderRadius: "4px",
              fontSize: "12px",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {(preview.content || "").slice(0, 600)}
              {preview.content && preview.content.length > 600 ? "\n…" : ""}
            </pre>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}

export default LoadSkillModal;
