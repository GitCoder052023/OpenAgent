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
import {Loader2, Mic, Send, Square, Volume2} from "lucide-react";
import * as MessageBackend from "@/backend/MessageBackend";
import * as SttBackend from "@/backend/SttBackend";
import * as TtsBackend from "@/backend/TtsBackend";
import * as VectorBackend from "@/backend/VectorBackend";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {blobToWav} from "@/lib/audio";
import * as Setting from "@/lib/setting";
import {isComposing} from "@/lib/utils";

interface ProviderTestProps {
  provider: any;
  onUpdateProvider: (field: string, value: any) => void;
  /** saves the form first when it has unsaved edits, so the test runs against what is on screen */
  ensureSaved: () => Promise<boolean>;
}

const DEFAULT_TEST_CONTENT: Record<string, string> = {
  "Embedding": "This is a sample text for embedding generation.",
  "Text-to-Speech": "Hello, this is a test for text to speech conversion.",
};

function TestRow({input, button, children}: {input: React.ReactNode; button: React.ReactNode; children?: React.ReactNode}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex-1">{input}</div>
        {button}
      </div>
      {children}
    </div>
  );
}

function ModelTest({provider, ensureSaved}: ProviderTestProps) {
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const send = async() => {
    if (!(await ensureSaved())) {
      return;
    }
    setLoading(true);
    setAnswer("");
    try {
      const res = await MessageBackend.getAnswer(provider.name, question, "", "");
      if (res.status === "ok") {
        setAnswer(typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2));
      } else {
        Setting.showMessage("error", res.msg);
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error?.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TestRow
      input={
        <Textarea
          rows={2}
          value={question}
          placeholder={i18next.t("chat:Type message here")}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isComposing(e) && question.trim() !== "" && !loading) {
              e.preventDefault();
              send();
            }
          }}
        />
      }
      button={
        <Button onClick={send} disabled={loading || question.trim() === ""}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {i18next.t("pipe:Send")}
        </Button>
      }
    >
      {answer ? <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{answer}</div> : null}
    </TestRow>
  );
}

function EmbedTest({provider, onUpdateProvider, ensureSaved}: ProviderTestProps) {
  const [vector, setVector] = React.useState<number[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const run = async() => {
    if (!(await ensureSaved())) {
      return;
    }
    setLoading(true);
    setVector(null);
    // the embedding is computed when a vector's text is saved, so the test goes
    // through a throwaway vector named after the provider
    const testVector = {owner: "admin", name: `test_${provider.name}`, provider: provider.name, text: ""};
    try {
      await VectorBackend.deleteVector(testVector);
      const added = await VectorBackend.addVector(testVector);
      if (added.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${added.msg}`);
        return;
      }
      const updated = await VectorBackend.updateVector("admin", testVector.name, {...testVector, text: provider.testContent});
      if (updated.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${updated.msg}`);
        return;
      }
      const res = await VectorBackend.getVector("admin", testVector.name);
      if (res.status === "ok" && res.data?.data) {
        setVector(res.data.data);
      } else {
        Setting.showMessage("error", i18next.t("general:Failed to get"));
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error?.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TestRow
      input={<Textarea rows={2} value={provider.testContent ?? ""} onChange={(e) => onUpdateProvider("testContent", e.target.value)} />}
      button={
        <Button onClick={run} disabled={loading || !provider.testContent}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {i18next.t("general:Refresh Vectors")}
        </Button>
      }
    >
      {vector ? (
        <div className="space-y-1.5">
          <div className="text-sm font-medium">{i18next.t("general:Data")} ({vector.length})</div>
          <Textarea readOnly rows={6} className="font-mono text-xs" value={vector.join(", ")} />
        </div>
      ) : null}
    </TestRow>
  );
}

function TtsTest({provider, onUpdateProvider, ensureSaved}: ProviderTestProps) {
  const [loading, setLoading] = React.useState(false);
  const player = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => () => {
    player.current?.pause();
    player.current = null;
  }, []);

  const read = async() => {
    if (!(await ensureSaved())) {
      return;
    }
    player.current?.pause();
    player.current = null;
    setLoading(true);
    try {
      const blob: Blob = await TtsBackend.generateTextToSpeechAudio("", `${provider.owner}/${provider.name}`, "", provider.testContent);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      player.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => {
        Setting.showMessage("error", `${i18next.t("provider:Failed to play audio")}: ${audio.error?.message || "Unknown error"}`);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error?.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TestRow
      input={<Textarea rows={2} value={provider.testContent ?? ""} onChange={(e) => onUpdateProvider("testContent", e.target.value)} />}
      button={
        <Button onClick={read} disabled={loading || !provider.testContent}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {i18next.t("chat:Read it out")}
        </Button>
      }
    />
  );
}

const RECORDER_MIME_TYPES = ["audio/wav", "audio/webm;codecs=pcm", "audio/webm;codecs=opus", "audio/webm"];

function SttTest({provider, ensureSaved}: ProviderTestProps) {
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const recorder = React.useRef<MediaRecorder | null>(null);
  const stream = React.useRef<MediaStream | null>(null);

  const releaseMicrophone = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  React.useEffect(() => () => {
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    releaseMicrophone();
  }, []);

  const transcribe = async(audio: Blob) => {
    setTranscribing(true);
    try {
      if (!(await ensureSaved())) {
        return;
      }
      const wav = await blobToWav(audio);
      const res = await SttBackend.testSpeechToTextProvider(`${provider.owner}/${provider.name}`, wav);
      if (res.status === "ok") {
        setTranscript(typeof res.data === "string" ? res.data : res.data?.text ?? "");
        Setting.showMessage("success", i18next.t("provider:Speech recognition completed"));
      } else {
        Setting.showMessage("error", res.msg || i18next.t("general:Failed to get"));
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error?.message ?? error}`);
    } finally {
      setTranscribing(false);
    }
  };

  const start = async() => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      Setting.showMessage("error", i18next.t("provider:Failed to access microphone"));
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000},
      });
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("provider:Failed to access microphone")}: ${error?.message ?? error}`);
      return;
    }
    const mimeType = RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const next = mimeType ? new MediaRecorder(stream.current, {mimeType}) : new MediaRecorder(stream.current);
    const chunks: Blob[] = [];
    next.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        chunks.push(event.data);
      }
    };
    next.onstop = () => {
      releaseMicrophone();
      recorder.current = null;
      transcribe(new Blob(chunks, {type: chunks[0]?.type || next.mimeType || "audio/webm"}));
    };
    recorder.current = next;
    next.start(100);
    setTranscript("");
    setRecording(true);
  };

  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
  };

  return (
    <TestRow
      input={<Textarea rows={2} readOnly value={transcript} placeholder={i18next.t("chat:Speak")} />}
      button={
        <Button variant={recording ? "destructive" : "default"} onClick={recording ? stop : start} disabled={transcribing}>
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {recording ? i18next.t("chat:Stop") : transcribing ? i18next.t("general:Loading") : i18next.t("chat:Speak")}
        </Button>
      }
    />
  );
}

const TESTS: Record<string, (props: ProviderTestProps) => React.ReactNode> = {
  "Model": ModelTest,
  "Embedding": EmbedTest,
  "Text-to-Speech": TtsTest,
  "Speech-to-Text": SttTest,
};

/** Tries the provider out: a question for a model, a sentence to embed or read aloud, a recording to transcribe. */
export function ProviderTestWidget(props: ProviderTestProps) {
  const {provider, onUpdateProvider} = props;
  const defaultContent = DEFAULT_TEST_CONTENT[provider.category];

  React.useEffect(() => {
    if (defaultContent && !provider.testContent) {
      onUpdateProvider("testContent", defaultContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.category]);

  const Test = TESTS[provider.category];
  return Test ? <Test {...props} /> : null;
}

export function hasProviderTest(category: string) {
  return category in TESTS;
}
