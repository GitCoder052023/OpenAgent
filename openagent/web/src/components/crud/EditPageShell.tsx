import * as React from "react";
import i18next from "i18next";
import {ArrowLeft} from "lucide-react";
import {useLocation, useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {FormGrid} from "@/components/crud/FormRow";
import {PageHeader} from "@/components/crud/PageHeader";
import type {CasdoorResponse, EditMode} from "@/lib/crud";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

interface EditPageShellProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  mode: EditMode;
  backTo: string;
  /** resolving to `false` means the save failed */
  onSave: (exitAfterSave: boolean) => void | boolean | Promise<void | boolean>;
  /** in "add" mode Cancel simply leaves the page, dropping the unsaved object */
  onCancel?: () => void;
  /**
   * Deletes the record. A list that creates the record before opening it marks the
   * visit with `isNew`; until the first save, Cancel then deletes it again, as the
   * antd pages do, so backing out of "Add" leaves nothing behind.
   */
  remove?: () => Promise<CasdoorResponse>;
  extraActions?: React.ReactNode;
  /** lay a flat run of `FormRow` children out in the two-column `FormGrid` */
  grid?: boolean;
  children: React.ReactNode;
  saving?: boolean;
  className?: string;
}

export function EditPageShell({
  title,
  description,
  mode,
  backTo,
  onSave,
  onCancel,
  remove,
  extraActions,
  grid,
  children,
  saving,
  className,
}: EditPageShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isNew, setIsNew] = React.useState(Boolean((location.state as any)?.isNew));
  const [cancelling, setCancelling] = React.useState(false);

  const save = async(exitAfterSave: boolean) => {
    const ok = await onSave(exitAfterSave);
    if (ok !== false) {
      setIsNew(false);
    }
  };

  const discard = async() => {
    if (!remove) {
      return;
    }
    setCancelling(true);
    try {
      const res = await remove();
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Cancelled successfully"));
        navigate(backTo);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to cancel")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    } finally {
      setCancelling(false);
    }
  };

  // a read-only page offers no way to save; the antd pages hide the same buttons
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {extraActions}
      {mode !== "view" ? (
        <>
          {/* Save is the one people press over and over, so it is the filled one */}
          <Button variant="outline" loading={saving} onClick={() => save(true)}>
            {i18next.t("general:Save & Exit")}
          </Button>
          <Button loading={saving} onClick={() => save(false)}>
            {i18next.t("general:Save")}
          </Button>
        </>
      ) : null}
      {mode === "add" ? (
        <Button variant="ghost" onClick={() => (onCancel ? onCancel() : navigate(backTo))}>
          {i18next.t("general:Cancel")}
        </Button>
      ) : isNew && remove ? (
        <Button variant="ghost" loading={cancelling} onClick={discard}>
          {i18next.t("general:Cancel")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* One action bar, not two. It used to render the identical Save / Save & Exit
          pair above and below the card; sticking the single bar to the top of the
          scroll area keeps it reachable on a long form without the duplicate.
          The negative insets cancel AppLayout's page padding so the bar spans the
          full width and nothing shows through above it. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b bg-background px-4 py-3 md:-mx-6 md:-mt-6 md:px-6">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Button variant="ghost" size="iconSm" onClick={() => navigate(backTo)} aria-label={i18next.t("general:Go back")}>
                <ArrowLeft />
              </Button>
              {title}
            </span>
          }
          description={description}
          actions={actions}
        />
      </div>
      <Card>
        <CardContent className="pt-6">{grid ? <FormGrid>{children}</FormGrid> : children}</CardContent>
      </Card>
    </div>
  );
}

export {CardHeader};
