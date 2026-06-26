import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SCANNER_SHEET_CLASS, SCANNER_BRAND, SCANNER_BRAND_HOVER } from "./scannerTheme";

interface ScannerManualEntrySheetProps {
  open: boolean;
  token: string;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onTokenChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ScannerManualEntrySheet({
  open,
  token,
  submitLabel,
  onOpenChange,
  onTokenChange,
  onSubmit,
  onCancel,
}: ScannerManualEntrySheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      {open ? (
      <DrawerContent className={SCANNER_SHEET_CLASS}>
        <DrawerHeader className="px-5 pb-2 pt-1 text-left">
          <DrawerTitle className="text-base font-semibold tracking-tight text-white">
            Manual entry
          </DrawerTitle>
          <p className="text-sm text-[#737373]">Paste the secure token from the ticket</p>
        </DrawerHeader>
        <div className="px-5 pb-2">
          <Input
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="h-12 border-[#2A2A2A] bg-[#0A0A0A] text-white font-mono text-sm"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <DrawerFooter className="flex-row gap-2 border-t border-[#2A2A2A]/60 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <Button
            variant="outline"
            className="h-11 flex-1 border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="h-11 flex-1 font-semibold text-white"
            style={{ backgroundColor: SCANNER_BRAND }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = SCANNER_BRAND_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = SCANNER_BRAND;
            }}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
      ) : null}
    </Drawer>
  );
}
