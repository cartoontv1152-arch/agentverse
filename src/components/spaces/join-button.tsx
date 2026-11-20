"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api, ClientApiError } from "@/client/api";

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const { spaceId } = await api<{ spaceId: string }>(`/api/invites/${code}`, { method: "POST" });
            router.replace(`/app/s/${spaceId}`);
          } catch (err) {
            setError(err instanceof ClientApiError ? err.message : "Couldn't join. Try again.");
            setLoading(false);
          }
        }}
      >
        Join space
      </Button>
    </div>
  );
}
