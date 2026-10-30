import { useParams } from "react-router";

import { AuditDetail } from "@/components/audit/audit-workspace";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Audit - ${APP_TITLE}` }];
}

export default function AuditDetailRoute() {
  const { auditId } = useParams();
  if (!auditId) {
    return <p className="p-6 text-sm text-muted-foreground">Missing audit id.</p>;
  }
  return <AuditDetail auditId={auditId} />;
}
