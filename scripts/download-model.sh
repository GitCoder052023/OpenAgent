#!/bin/sh
set -eu
model="${1:-base}"
case "$model" in base|small|base.en|small.en) ;; *) echo 'Allowed: base, small, base.en, small.en' >&2; exit 2;; esac
mkdir -p models
# Upstream downloader; inspect the official script before executing if preferred.
curl --fail --location --show-error "https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/models/download-ggml-model.sh" -o models/download-ggml-model.sh
(cd models && sh ./download-ggml-model.sh "$model")
