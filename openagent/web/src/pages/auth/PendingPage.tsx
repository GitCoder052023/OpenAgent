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

import {Construction} from "lucide-react";

/** Shown for routes whose page has not been ported from web-old yet. */
export default function PendingPage({name}: {name: string}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
      <Construction className="h-10 w-10" />
      <div className="text-base font-medium text-foreground">{name}</div>
      <div className="text-sm">This page has not been migrated to the new frontend yet.</div>
    </div>
  );
}
