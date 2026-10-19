#!/bin/sh
set -eu
# Fetches a whisper.cpp ggml model into models/. Default is the Large V3 Turbo
# model OpenAgent transcribes with when the mlx engine is unavailable.
model="${1:-large-v3-turbo}"
case "$model" in
  large-v3-turbo|large-v3-turbo-q5_0|large-v3-turbo-q8_0|base|small|base.en|small.en) ;;
  *) echo 'Allowed: large-v3-turbo, large-v3-turbo-q5_0, large-v3-turbo-q8_0, base, small, base.en, small.en' >&2; exit 2;;
esac
mkdir -p models
# Upstream downloader; inspect the official script before executing if preferred.
curl --fail --location --show-error "https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/models/download-ggml-model.sh" -o models/download-ggml-model.sh
(cd models && sh ./download-ggml-model.sh "$model")
