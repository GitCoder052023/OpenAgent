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

import * as ProviderSetting from "@/lib/provider-setting";

/** A provider type (or name) with its logo in front, as the antd selects and tables show it. */
export function ProviderTypeLabel({category, type, text}: {category: string; type: string; text?: string}) {
  const logo = ProviderSetting.getProviderLogoURL({category, type});
  return (
    <span className="inline-flex items-center gap-1.5">
      {logo ? <img src={logo} alt={type} className="h-5 w-5 shrink-0 object-contain" /> : null}
      <span className="truncate">{text ?? type}</span>
    </span>
  );
}

/** The type options of a provider category, with logos, for a SearchableSelect. */
export function getProviderTypeSelectOptions(category: string) {
  return ProviderSetting.getProviderTypeOptions(category).map((item: any) => ({
    value: item.id ?? item.name,
    label: <ProviderTypeLabel category={category} type={item.name} />,
    keywords: item.name,
  }));
}

export function getProviderSubTypeSelectOptions(category: string, type: string) {
  return (ProviderSetting.getProviderSubTypeOptions(category, type) ?? []).map((item: any) => ({
    value: item.id,
    label: item.name,
  }));
}
