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

import i18next from "i18next";
import * as TtsBackend from "@/backend/TtsBackend";
import * as Setting from "@/lib/setting";

const BROWSER_BUILT_IN = "Browser Built-In";

function usesCloud(provider: string | undefined) {
  return !!provider && provider !== BROWSER_BUILT_IN;
}

export interface TtsState {
  readingMessage: string | null;
  isReading: boolean;
  isLoading: boolean;
}

/**
 * Reads answers aloud with the store's text-to-speech provider: streamed chunk by
 * chunk when the store enables it, as one file otherwise, and with the browser's
 * own voice when there is no provider or the provider fails.
 */
export class TtsPlayer {
  private synth = window.speechSynthesis;
  private audio: HTMLAudioElement | null = null;
  private source: EventSource | null = null;
  private context: AudioContext | null = null;
  private queue: (ArrayBuffer | "END")[] = [];
  private playing = false;
  private node: AudioBufferSourceNode | null = null;
  private mode: "browser" | "file" | "stream" | null = null;
  // bumped on every cancel, so audio still on its way for an earlier message is dropped
  private run = 0;
  private state: TtsState = {readingMessage: null, isReading: false, isLoading: false};

  constructor(private onChange: (state: TtsState) => void) {}

  private set(patch: Partial<TtsState>) {
    this.state = {...this.state, ...patch};
    this.onChange(this.state);
  }

  /** plays, pauses or resumes the given message, the way the read-aloud button toggles */
  toggle(message: any, store: any) {
    if (this.state.readingMessage === message.name) {
      if (this.state.isReading) {
        this.pause();
      } else {
        this.resume();
      }
      return;
    }
    this.read(message, store);
  }

  read(message: any, store: any) {
    this.cancel();
    if (!usesCloud(store?.textToSpeechProvider)) {
      this.readWithBrowser(message);
      return;
    }
    this.set({readingMessage: message.name, isReading: true});
    const storeId = `${store.owner}/${store.name}`;
    const messageId = `${message.owner}/${message.name}`;
    if (store.enableTtsStreaming) {
      this.readStreaming(message, storeId, messageId);
    } else {
      this.readFile(message, storeId, messageId);
    }
  }

  pause() {
    if (this.mode === "stream") {
      this.context?.suspend();
    } else if (this.mode === "file") {
      this.audio?.pause();
    } else {
      this.synth.pause();
    }
    this.set({isReading: false});
  }

  resume() {
    if (this.mode === "stream") {
      this.context?.resume();
    } else if (this.mode === "file") {
      this.audio?.play();
    } else {
      this.synth.resume();
    }
    this.set({isReading: true});
  }

  cancel() {
    this.run++;
    this.mode = null;
    this.synth?.cancel();
    this.source?.close();
    this.source = null;
    this.node?.stop();
    this.node = null;
    this.audio?.pause();
    this.audio = null;
    this.queue = [];
    this.playing = false;
    this.set({readingMessage: null, isReading: false, isLoading: false});
  }

  dispose() {
    this.cancel();
    this.context?.close();
    this.context = null;
  }

  private fallBack(message: any, detail?: string) {
    const text = i18next.t("general:Failed to call TTS API, will use default browser TTS instead");
    Setting.showMessage("error", detail ? `${text}: ${detail}` : text);
    this.readWithBrowser(message);
  }

  private readFile(message: any, storeId: string, messageId: string) {
    const run = this.run;
    this.mode = "file";
    this.set({isLoading: true});
    TtsBackend.generateTextToSpeechAudio(storeId, "", messageId, "").then((blob: Blob) => {
      if (run !== this.run) {
        return;
      }
      this.set({isLoading: false});
      const url = URL.createObjectURL(blob);
      this.audio = new Audio(url);
      this.audio.onended = () => {
        URL.revokeObjectURL(url);
        this.audio = null;
        this.set({isReading: false, readingMessage: null});
      };
      this.audio.play();
    }).catch((error: any) => {
      if (run !== this.run) {
        return;
      }
      this.set({isLoading: false});
      this.fallBack(message, error?.message);
    });
  }

  private readStreaming(message: any, storeId: string, messageId: string) {
    this.mode = "stream";
    this.source = TtsBackend.generateTextToSpeechAudioStream(storeId, messageId);
    this.context ??= new AudioContext();
    // a reading paused before this one left the context suspended
    if (this.context.state === "suspended") {
      this.context.resume();
    }
    this.queue = [];
    this.playing = false;

    this.source.addEventListener("chunk", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "audio") {
          this.queue.push(Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0)).buffer);
          if (!this.playing) {
            this.playNext();
          }
        }
      } catch {
        this.fallBack(message);
      }
    });
    this.source.addEventListener("end", () => {
      this.queue.push("END");
      if (!this.playing) {
        this.playNext();
      }
      this.source?.close();
      this.source = null;
    });
    this.source.addEventListener("error", (e: MessageEvent) => {
      let detail: string | undefined;
      try {
        detail = JSON.parse(e.data).error;
      } catch {
        detail = undefined;
      }
      this.source?.close();
      this.source = null;
      this.set({isReading: false, readingMessage: null});
      this.fallBack(message, detail);
    });
  }

  private playNext() {
    if (this.queue.length === 0 || !this.state.isReading || !this.context) {
      this.playing = false;
      return;
    }
    this.playing = true;
    const run = this.run;
    const item = this.queue.shift()!;
    if (item === "END") {
      this.playing = false;
      this.set({isReading: false, readingMessage: null});
      return;
    }
    this.context.decodeAudioData(item, (buffer) => {
      if (!this.context || run !== this.run) {
        return;
      }
      const node = this.context.createBufferSource();
      node.buffer = buffer;
      node.connect(this.context.destination);
      node.onended = () => run === this.run && this.playNext();
      node.start(0);
      this.node = node;
    }, () => run === this.run && this.playNext());
  }

  private readWithBrowser(message: any) {
    this.synth.cancel();
    const run = this.run;
    this.mode = "browser";
    const utterance = new SpeechSynthesisUtterance(message.correctedText || message.text);
    utterance.lang = Setting.getLanguage();
    utterance.addEventListener("end", () => {
      // cancelling fires "end" too, possibly after the next reading has started
      if (run !== this.run) {
        return;
      }
      this.synth.cancel();
      this.set({isReading: false, readingMessage: null});
    });
    this.synth.speak(utterance);
    this.set({readingMessage: message.name, isReading: true});
  }
}

// the browser recognizer ends on its own after this much silence; a websocket
// session with server-side VAD stops sending text once a sentence is done
const BROWSER_SILENCE_MS = 6000;
const STREAM_SILENCE_MS = 3000;

/**
 * Dictation into the chat input: the browser's own recognizer, or the store's
 * speech-to-text provider streamed over a websocket as 16 kHz PCM.
 * `onText` gets the whole transcript so far; `onEnd` fires however it stops.
 */
export class SpeechInput {
  private recognition: any = null;
  private silence: number | undefined;
  private ws: WebSocket | null = null;
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nodes: AudioNode[] = [];
  private onEnd: (() => void) | null = null;
  private lastText = "";

  constructor(private onText: (text: string) => void) {}

  async start(store: any, onEnd: () => void) {
    this.stop();
    this.onEnd = onEnd;
    this.lastText = "";
    if (usesCloud(store?.speechToTextProvider)) {
      await this.startStreaming(store);
    } else {
      this.startBrowser();
    }
  }

  /** ends dictation; the transcript so far stays in the input */
  stop() {
    window.clearTimeout(this.silence);
    if (this.recognition) {
      const recognition = this.recognition;
      this.recognition = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
      this.finish();
    }
    if (this.ws || this.stream) {
      this.stopStreaming();
    }
  }

  dispose() {
    this.onEnd = null;
    this.stop();
    this.teardownStreaming();
  }

  private finish() {
    const onEnd = this.onEnd;
    this.onEnd = null;
    onEnd?.();
  }

  private armSilence(ms: number, stop: () => void) {
    window.clearTimeout(this.silence);
    this.silence = window.setTimeout(stop, ms);
  }

  private startBrowser() {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      Setting.showMessage("error", i18next.t("chat:Speech recognition not supported in this browser"));
      this.finish();
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = Setting.getLanguage();
    recognition.onresult = (event: any) => {
      this.armSilence(BROWSER_SILENCE_MS, () => recognition.stop());
      this.lastText = Array.from(event.results as ArrayLike<any>).map((result: any) => result[0].transcript).join(" ");
      this.onText(this.lastText);
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        Setting.showMessage("error", `${i18next.t("chat:Failed to recognize speech")}: ${event.error}`);
      }
    };
    recognition.onend = () => {
      window.clearTimeout(this.silence);
      this.recognition = null;
      this.finish();
    };
    try {
      recognition.start();
      this.recognition = recognition;
      this.armSilence(BROWSER_SILENCE_MS, () => recognition.stop());
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("chat:Failed to recognize speech")}: ${error?.message}`);
      this.finish();
    }
  }

  private async startStreaming(store: any) {
    if (!navigator.mediaDevices || !window.AudioContext || !(window as any).AudioWorkletNode) {
      throw new Error(i18next.t("chat:Streaming speech recognition is not supported in this browser"));
    }
    this.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1}});
    this.context = new AudioContext();
    // the worklet downsamples the microphone to 16 kHz Int16 PCM in ~100 ms chunks
    await this.context.audioWorklet.addModule("/pcm-worklet.js");
    const source = this.context.createMediaStreamSource(this.stream);
    const worklet = new AudioWorkletNode(this.context, "pcm-processor");
    source.connect(worklet);
    this.nodes = [source, worklet];

    const base = new URL(Setting.ServerUrl || window.location.origin, window.location.origin);
    const protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${base.host}/api/speech-stream?storeId=${encodeURIComponent(`${store.owner}/${store.name}`)}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    // the first words arrive before the socket is open
    const pending: ArrayBuffer[] = [];
    worklet.port.onmessage = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      } else {
        pending.push(event.data);
      }
    };
    ws.onopen = () => {
      pending.splice(0).forEach((chunk) => ws.send(chunk));
      this.armSilence(STREAM_SILENCE_MS, () => this.stopStreaming());
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.error) {
          Setting.showMessage("error", `${i18next.t("chat:Failed to recognize speech")}: ${message.error}`);
        } else if (typeof message.text === "string") {
          this.armSilence(STREAM_SILENCE_MS, () => this.stopStreaming());
          this.lastText = message.text;
          this.onText(message.text);
        }
      } catch {
        // a malformed event is overwritten by the next one
      }
    };
    ws.onerror = () => {
      Setting.showMessage("error", i18next.t("chat:Speech recognition websocket failed"));
      this.teardownStreaming();
    };
    ws.onclose = () => this.teardownStreaming();
  }

  // sends the end-of-stream marker; the server closes the socket after its final transcript
  private stopStreaming() {
    window.clearTimeout(this.silence);
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(new ArrayBuffer(0));
      } catch {
        // best effort
      }
    }
    this.releaseMicrophone();
    if (!this.ws) {
      this.teardownStreaming();
    }
  }

  private releaseMicrophone() {
    this.nodes.forEach((node) => node.disconnect());
    this.nodes = [];
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private teardownStreaming() {
    window.clearTimeout(this.silence);
    this.releaseMicrophone();
    this.context?.close().catch(() => undefined);
    this.context = null;
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
    this.finish();
  }
}
