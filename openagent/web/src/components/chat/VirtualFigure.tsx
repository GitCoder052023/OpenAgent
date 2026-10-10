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

import * as React from "react";
import i18next from "i18next";
import {Check, EyeOff, MoveHorizontal, Settings, X} from "lucide-react";
import {useNavigate} from "react-router-dom";
import * as StoreBackend from "@/backend/StoreBackend";
import * as Setting from "@/lib/setting";
import "./VirtualFigure.css";

type Status = "idle" | "typing" | "thinking" | "replying" | "error" | "done";
type Size = "small" | "medium" | "large";

const STORAGE_PREFIX = "openagent_virtual_figure";

function storageKey(store: any, suffix: string) {
  return `${STORAGE_PREFIX}:${store?.owner || "default"}/${store?.name || "default"}:${suffix}`;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  } catch {
    // the figure just forgets where it was
  }
}

function computeStatus(props: {messageError: boolean; loading: boolean; messages: any[]; inputValue: string; isVoiceInput: boolean}, override: Status | null): Status {
  if (props.messageError) {
    return "error";
  }
  if (props.loading) {
    const last = props.messages[props.messages.length - 1];
    return last?.isReasoningPhase || (last?.reasonText && !last?.text) ? "thinking" : "replying";
  }
  if (override) {
    return override;
  }
  return props.inputValue.trim() !== "" || props.isVoiceInput ? "typing" : "idle";
}

const STATUS_KEYS: Record<Status, string> = {
  idle: "figure:State - Idle",
  typing: "figure:State - Typing",
  thinking: "figure:State - Thinking",
  replying: "figure:State - Replying",
  error: "figure:State - Error",
  done: "figure:State - Done",
};

interface VirtualFigureProps {
  store: any;
  imageUrl: string;
  loading: boolean;
  messageError: boolean;
  messages: any[];
  inputValue: string;
  isVoiceInput: boolean;
  onStoreUpdate?: (store: any) => void;
}

/**
 * The store's animated assistant beside the chat. It shows what the chat is
 * doing, can be dragged anywhere in the pane, and remembers its place and size
 * per store; double-click folds it away.
 */
export function VirtualFigure(props: VirtualFigureProps) {
  const {store} = props;
  const navigate = useNavigate();
  const storeId = `${store?.owner}/${store?.name}`;
  const [collapsed, setCollapsed] = React.useState(false);
  const [position, setPosition] = React.useState<{left: number; top: number} | null>(null);
  const [size, setSize] = React.useState<Size>("medium");
  const [disabled, setDisabled] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [override, setOverride] = React.useState<Status | null>(null);
  const figure = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean} | null>(null);
  const suppressClick = React.useRef(false);
  const wasLoading = React.useRef(props.loading);

  // each store keeps its own figure placement
  React.useEffect(() => {
    setCollapsed(load(storageKey(store, "collapsed"), (store?.figureMode || "Expanded") === "Collapsed"));
    setPosition(load(storageKey(store, "position"), null));
    setSize(load<Size>(storageKey(store, "size"), "medium"));
    setDisabled(false);
    setMenuOpen(false);
    setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // a finished answer flashes "done" for a moment
  React.useEffect(() => {
    if (!wasLoading.current && props.loading) {
      setOverride(null);
    }
    if (wasLoading.current && !props.loading && !props.messageError) {
      setOverride("done");
      const timer = window.setTimeout(() => setOverride(null), 1600);
      wasLoading.current = props.loading;
      return () => window.clearTimeout(timer);
    }
    wasLoading.current = props.loading;
  }, [props.loading, props.messageError]);

  React.useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const close = (e: PointerEvent) => {
      if (!figure.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  // keeps the figure inside the pane when the window shrinks
  const clamp = React.useCallback((next: {left: number; top: number}) => {
    const el = figure.current;
    const parent = el?.offsetParent?.getBoundingClientRect();
    const rect = el?.getBoundingClientRect();
    if (!el || !parent || !rect || rect.width === 0) {
      return next;
    }
    return {
      left: Math.min(Math.max(8, next.left), Math.max(8, parent.width - rect.width - 8)),
      top: Math.min(Math.max(8, next.top), Math.max(8, parent.height - rect.height - 8)),
    };
  }, []);

  React.useEffect(() => {
    const onResize = () => setPosition((prev) => (prev ? clamp(prev) : prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !figure.current) {
      return;
    }
    const rect = figure.current.getBoundingClientRect();
    drag.current = {offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, startX: e.clientX, startY: e.clientY, moved: false};
    setDragging(true);
    let last: {left: number; top: number} | null = null;

    const onMove = (event: PointerEvent) => {
      const state = drag.current;
      const parent = figure.current?.offsetParent?.getBoundingClientRect();
      if (!state || !parent) {
        return;
      }
      event.preventDefault();
      state.moved = state.moved || Math.abs(event.clientX - state.startX) > 2 || Math.abs(event.clientY - state.startY) > 2;
      last = clamp({left: event.clientX - parent.left - state.offsetX, top: event.clientY - parent.top - state.offsetY});
      setPosition(last);
    };
    const onUp = () => {
      const moved = drag.current?.moved ?? false;
      if (moved && last) {
        save(storageKey(store, "position"), last);
      }
      suppressClick.current = moved;
      drag.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const changeSize = (next: Size) => {
    save(storageKey(store, "size"), next);
    setSize(next);
    setMenuOpen(false);
  };

  // switching the figure off is a store setting, so it sticks for everyone
  const disable = async() => {
    setMenuOpen(false);
    if (!store?.owner || !store?.name) {
      setDisabled(true);
      return;
    }
    const next = {...Setting.deepCopy(store), figureEnabled: false, fileTree: undefined};
    try {
      const res: any = await StoreBackend.updateStore(store.owner, store.name, next);
      if (res.status === "ok") {
        props.onStoreUpdate?.(next);
        setDisabled(true);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
    }
  };

  if (disabled) {
    return null;
  }

  const status = computeStatus(props, override);
  const statusText = i18next.t(STATUS_KEYS[status]);
  const className = [
    "chat-virtual-figure",
    `chat-virtual-figure--${status}`,
    `chat-virtual-figure--size-${size}`,
    collapsed ? "chat-virtual-figure--collapsed" : "",
    dragging ? "chat-virtual-figure--dragging" : "",
  ].filter(Boolean).join(" ");

  const menuItem = (key: string, label: string, onClick: () => void, icon?: React.ReactNode, active?: boolean) => (
    <button key={key} type="button" className={`chat-virtual-figure__menu-item${active ? " chat-virtual-figure__menu-item--active" : ""}`} onClick={onClick}>
      {icon ? <span className="chat-virtual-figure__menu-icon">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );

  return (
    <div ref={figure} className={className} style={position ? {left: position.left, top: position.top, right: "auto", bottom: "auto"} : undefined}>
      {menuOpen ? (
        <div className="chat-virtual-figure__menu" onPointerDown={(e) => e.stopPropagation()}>
          <div className="chat-virtual-figure__menu-status">{statusText}</div>
          {(["small", "medium", "large"] as Size[]).map((item) => menuItem(item, i18next.t(`figure:${item[0].toUpperCase()}${item.slice(1)}`), () => changeSize(item), size === item ? <Check className="h-3.5 w-3.5" /> : null, size === item))}
          {menuItem("settings", i18next.t("figure:Figure settings"), () => navigate(`/stores/${encodeURIComponent(store.owner)}/${encodeURIComponent(store.name)}`), <Settings className="h-3.5 w-3.5" />)}
          {menuItem("disable", i18next.t("figure:Disable figure"), disable, <EyeOff className="h-3.5 w-3.5" />)}
        </div>
      ) : null}
      <div className="chat-virtual-figure__controls">
        <button
          type="button"
          className="chat-virtual-figure__control-button flex items-center justify-center rounded-md hover:bg-black/5"
          aria-label={i18next.t("figure:Reset figure position")}
          onClick={() => {
            save(storageKey(store, "position"), null);
            setPosition(null);
          }}
        >
          <MoveHorizontal className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="chat-virtual-figure__control-button flex items-center justify-center rounded-md hover:bg-black/5" aria-label={i18next.t("figure:Disable figure")} onClick={disable}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className="chat-virtual-figure__body"
        role="button"
        tabIndex={0}
        aria-label={statusText}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          e.preventDefault();
          setMenuOpen((open) => !open);
        }}
        onDoubleClick={() => {
          save(storageKey(store, "collapsed"), !collapsed);
          setCollapsed(!collapsed);
        }}
      >
        <div className="chat-virtual-figure__halo" />
        <img className="chat-virtual-figure__image" src={props.imageUrl} alt={i18next.t("figure:AI virtual figure")} draggable={false} />
        <div className="chat-virtual-figure__screen">
          {status === "thinking" ? <span className="chat-virtual-figure__dots"><i /><i /><i /></span> : null}
          {status === "replying" ? <span className="chat-virtual-figure__wave"><i /><i /><i /></span> : null}
          {status === "error" ? <span className="chat-virtual-figure__mark">?</span> : null}
          {status === "done" ? <span className="chat-virtual-figure__mark"><Check className="h-4 w-4" /></span> : null}
        </div>
        <div className="chat-virtual-figure__bubble"><span>{statusText}</span></div>
        <div className="chat-virtual-figure__chat-icon"><span>...</span></div>
      </div>
    </div>
  );
}
