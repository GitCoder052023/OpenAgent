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

// Package embedsupport wires up the optional embedded filesystems for conf,
// web/build, skills, the OCR service, and the PPTX worker. When the binary is
// built with -tags embed, the caller (main) passes the embedded fs.FS values
// here via Setup. At runtime, on-disk files always take priority; the embedded
// versions are used only when the corresponding directory is absent next to the
// executable.
package embedsupport

import (
	"io/fs"

	"github.com/the-open-agent/openagent/conf"
)

var (
	webFS        fs.FS
	skillsFS     fs.FS
	ocrServiceFS fs.FS
	pptxWorkerFS fs.FS
)

// Setup must be called at the very start of main(), before any config values
// are read or HTTP requests are served.
func Setup(confFS, web, skills, ocrService, pptxWorker fs.FS) {
	webFS = web
	skillsFS = skills
	ocrServiceFS = ocrService
	pptxWorkerFS = pptxWorker
	setupConf(confFS)
	conf.SetEmbeddedWebAssetsEnabled(web != nil)
}

// WebFS returns the embedded web/build filesystem, or nil if not available.
func WebFS() fs.FS { return webFS }

// SkillsFS returns the embedded skills filesystem, or nil if not available.
func SkillsFS() fs.FS { return skillsFS }

// OcrServiceFS returns the embedded OCR service filesystem, or nil if not available.
func OcrServiceFS() fs.FS { return ocrServiceFS }

// PptxWorkerFS returns the embedded PPTX worker filesystem, or nil if not available.
func PptxWorkerFS() fs.FS { return pptxWorkerFS }
