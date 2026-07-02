"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

export function LocationQr({
  locationId,
  locationName,
}: {
  locationId: string;
  locationName: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const target = `${base}/intake/${locationId}`;
    QRCode.toDataURL(target, { width: 240, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [locationId]);

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
      <span className="font-medium">{locationName}</span>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`QR code for ${locationName}`} className="size-40" />
      ) : (
        <div className="size-40 animate-pulse rounded bg-muted" />
      )}
      {dataUrl && (
        <a href={dataUrl} download={`fixflow-${locationName}.png`}>
          <Button variant="outline" size="sm">
            Download
          </Button>
        </a>
      )}
    </div>
  );
}
