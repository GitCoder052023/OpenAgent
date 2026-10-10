// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** linear interpolation, which is plenty for speech going to a recognizer */
function resampleChannel(data: Float32Array, ratio: number, length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i / ratio;
    const index = Math.floor(position);
    const a = data[index] || 0;
    const b = data[index + 1] || a;
    out[i] = a + (position - index) * (b - a);
  }
  return out;
}

/** Encodes decoded audio as a 16-bit PCM WAV at `sampleRate`, which the speech-to-text providers accept. */
export function bufferToWav(buffer: AudioBuffer, sampleRate: number): ArrayBuffer {
  if (!buffer || !buffer.numberOfChannels || buffer.length === 0) {
    throw new Error("Invalid audio buffer");
  }

  const ratio = sampleRate / buffer.sampleRate;
  const frames = ratio === 1 ? buffer.length : Math.round(buffer.length * ratio);
  const channels = Array.from({length: buffer.numberOfChannels}, (_, c) =>
    ratio === 1 ? buffer.getChannelData(c) : resampleChannel(buffer.getChannelData(c), ratio, frames),
  );

  const numChannels = channels.length;
  const length = frames * numChannels * 2;
  const result = new ArrayBuffer(44 + length);
  const view = new DataView(result);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return result;
}

/** Decodes whatever MediaRecorder produced and re-encodes it as a 16 kHz WAV. */
export async function blobToWav(blob: Blob, sampleRate = 16000): Promise<Blob> {
  if (!blob || blob.size === 0) {
    throw new Error("Invalid audio data: empty or null blob");
  }
  if (blob.type === "audio/wav") {
    return blob;
  }
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const context: AudioContext = new AudioContextCtor({sampleRate});
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return new Blob([bufferToWav(decoded, sampleRate)], {type: "audio/wav"});
  } finally {
    context.close();
  }
}
