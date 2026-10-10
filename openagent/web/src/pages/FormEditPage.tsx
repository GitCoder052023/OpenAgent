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

import * as React from "react";
import i18next from "i18next";
import {Link2} from "lucide-react";
import {useNavigate, useParams} from "react-router-dom";
import * as FormBackend from "@/backend/FormBackend";
import {Input} from "@/components/ui/input";
import {FormItemTable} from "@/components/common/FormItemTable";
import {Loading} from "@/components/common/Loading";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {UnauthorizedPage} from "@/components/common/UnauthorizedPage";
import {EditPageShell} from "@/components/crud/EditPageShell";
import {FormRow, FormSection} from "@/components/crud/FormRow";
import {useAccount} from "@/hooks/use-account";
import {useEditRecord} from "@/hooks/use-edit-record";
import {submitEdit} from "@/lib/crud";
import {getFormTypeItems, getFormTypeOptions} from "@/lib/form-types";
import * as Setting from "@/lib/setting";

// "Table" borrows general:Table: the i18n dedup check allows a word in one namespace only
const CategoryLabelKeys: Record<string, string> = {
  "Table": "general:Table",
  "iFrame": "form:iFrame",
  "List Page": "form:List Page",
};

// the list pages a "List Page" Form customizes, previewed with the columns being edited
const listPageModules = import.meta.glob("./*ListPage.tsx");
const listPageNames: Record<string, string> = {records: "RecordListPage", stores: "StoreListPage", vectors: "VectorListPage", tasks: "TaskListPage"};
const listPageCache = new Map<string, React.LazyExoticComponent<React.ComponentType<{formItems?: any[]}>>>();

function getListPage(type: string) {
  const name = listPageNames[type];
  const loader = name ? listPageModules[`./${name}.tsx`] : undefined;
  if (!loader) {
    return null;
  }
  if (!listPageCache.has(name)) {
    listPageCache.set(name, React.lazy(loader as () => Promise<{default: React.ComponentType<{formItems?: any[]}>}>));
  }
  return listPageCache.get(name)!;
}

/** The list page as the Form would show it: dimmed and inert, and a click opens the real one. */
function ListPagePreview({type, formItems}: {type: string; formItems: any[]}) {
  const navigate = useNavigate();
  const Page = getListPage(type);
  return (
    <button type="button" className="relative block h-[600px] w-full overflow-hidden rounded-md border text-left" onClick={() => navigate(`/${type}`)}>
      <div className="pointer-events-none h-full overflow-auto p-4">
        {Page ? (
          <React.Suspense fallback={<Loading />}>
            <Page formItems={formItems} />
          </React.Suspense>
        ) : <span className="text-sm text-muted-foreground">{type}</span>}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
    </button>
  );
}

export default function FormEditPage() {
  const {formName = ""} = useParams();
  const navigate = useNavigate();
  const {account} = useAccount();
  const [saving, setSaving] = React.useState(false);
  // bumped after each save so the data preview reloads with the saved columns
  const [previewVersion, setPreviewVersion] = React.useState(0);
  const {record: form, updateField, updateFields, loading, denied} = useEditRecord<any>({
    fetch: () => FormBackend.getForm(account?.owner, formName),
    deps: [formName, account?.owner],
  });

  if (denied) {
    return <UnauthorizedPage />;
  }
  if (loading || form === null) {
    return <Loading />;
  }

  const save = async(exitAfterSave: boolean) => {
    setSaving(true);
    const ok = await submitEdit({
      mode: "edit",
      record: Setting.deepCopy(form),
      add: FormBackend.addForm,
      update: (record) => FormBackend.updateForm(record.owner, formName, record),
      onSaved: (saved) => {
        setPreviewVersion((v) => v + 1);
        if (exitAfterSave) {
          navigate("/forms");
        } else if (saved.name !== formName) {
          navigate(`/forms/${saved.name}`, {replace: true});
        }
      },
    });
    setSaving(false);
    return ok;
  };

  const text = (name: string, labelKey: string) => (
    <FormRow labelKey={labelKey}>
      <Input value={form[name] ?? ""} onChange={(e) => updateField(name, e.target.value)} />
    </FormRow>
  );

  let content: React.ReactNode = null;
  if (form.category === "Table") {
    content = (
      <FormRow labelKey="form:Form items" block>
        <FormItemTable items={form.formItems} onChange={(items) => updateField("formItems", items)} category="Table" />
      </FormRow>
    );
  } else if (form.category === "iFrame") {
    content = (
      <FormRow labelKey="general:URL" block>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={form.url ?? ""} onChange={(e) => updateField("url", e.target.value)} />
        </div>
      </FormRow>
    );
  } else if (form.category === "List Page") {
    content = (
      <>
        <FormRow labelKey="general:Type">
          <SearchableSelect
            value={form.type ?? ""}
            options={getFormTypeOptions().map((option) => ({value: option.id, label: i18next.t(option.name)}))}
            // a list page's Form is found by the page's name, so the type names it
            onChange={(type) => updateFields({type, name: type, displayName: type, formItems: getFormTypeItems(type)})}
          />
        </FormRow>
        <FormRow labelKey="general:Tag">
          <Input
            value={form.tag ?? ""}
            onChange={(e) => updateFields({tag: e.target.value, name: e.target.value ? `${form.type}-tag-${e.target.value}` : form.type})}
          />
        </FormRow>
        <FormRow labelKey="form:Form items" block>
          <FormItemTable items={form.formItems} onChange={(items) => updateField("formItems", items)} category="List Page" formType={form.type} />
        </FormRow>
      </>
    );
  }

  return (
    <EditPageShell
      title={`${i18next.t("form:Edit Form")} - ${form.displayName || form.name}`}
      mode="edit"
      backTo="/forms"
      onSave={save}
      remove={() => FormBackend.deleteForm(form)}
      saving={saving}
    >
      <div className="space-y-6">
        <FormSection title={i18next.t("general:General Settings")} description={i18next.t("general:General Settings desc")}>
          {text("name", "general:Name")}
          {text("displayName", "general:Display name")}
          {text("position", "form:Position")}
          <FormRow labelKey="general:Category" tooltip={i18next.t("provider:Category - Tooltip")}>
            <SearchableSelect
              value={form.category ?? ""}
              options={Object.entries(CategoryLabelKeys).map(([category, labelKey]) => ({value: category, label: i18next.t(labelKey)}))}
              onChange={(category) => updateField("category", category)}
            />
          </FormRow>
        </FormSection>

        {content ? <FormSection title={i18next.t("general:Content")}>{content}</FormSection> : null}

        <FormSection title={i18next.t("general:Preview")}>
          <div className="xl:col-span-2">
            {form.category === "List Page" ? (
              <ListPagePreview type={form.type} formItems={form.formItems ?? []} />
            ) : (
              <iframe
                key={previewVersion}
                title="formData"
                src={`/forms/${formName}/data`}
                className="h-[700px] w-full rounded-lg border shadow-sm"
              />
            )}
          </div>
        </FormSection>
      </div>
    </EditPageShell>
  );
}
