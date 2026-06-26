import { memo, forwardRef } from "react";

export const SCANNER_QR_READER_ID = "scanner-qr-reader";

/**
 * Isolated camera mount — memoized so parent re-renders (stats, role, etc.)
 * do not reconcile this node while html5-qrcode owns its children.
 */
export const ScannerQrViewport = memo(
  forwardRef<HTMLDivElement>(function ScannerQrViewport(_props, ref) {
    return (
      <div
        ref={ref}
        id={SCANNER_QR_READER_ID}
        className="h-full w-full min-h-[200px] [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />
    );
  })
);

ScannerQrViewport.displayName = "ScannerQrViewport";
