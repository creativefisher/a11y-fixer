import { AuditLanding } from "@/components/audit/audit-workspace";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [
    { title: `Audits - ${APP_TITLE}` },
    {
      name: "description",
      content:
        "Audit a public URL with axe-core and propose accessibility fixes.",
    },
  ];
}

export default function AuditIndexRoute() {
  return <AuditLanding />;
}
