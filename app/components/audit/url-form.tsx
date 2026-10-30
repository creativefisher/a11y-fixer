import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UrlForm({
  onSubmit,
  isPending,
  defaultUrl = "",
}: {
  onSubmit: (url: string) => void;
  isPending?: boolean;
  defaultUrl?: string;
}) {
  const [url, setUrl] = useState(defaultUrl);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="audit-url">Page URL</Label>
        <Input
          id="audit-url"
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          disabled={isPending}
          autoComplete="url"
        />
      </div>
      <Button type="submit" disabled={isPending || !url.trim()}>
        {isPending ? "Auditing…" : "Run audit"}
      </Button>
    </form>
  );
}
