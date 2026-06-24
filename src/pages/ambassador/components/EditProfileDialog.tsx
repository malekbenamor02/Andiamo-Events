import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Phone, Save } from "lucide-react";

const saveButtonClass =
  "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40";

export interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "en" | "fr";
  phone: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSave: () => void;
  onCancel: () => void;
  title: string;
  currentPhoneLabel: string;
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  cancelLabel: string;
  saveLabel: string;
}

function getCopy(language: "en" | "fr") {
  return language === "en"
    ? {
        description: "Update your password. Your phone number cannot be changed.",
        newPasswordPlaceholder: "Enter new password",
        confirmPasswordPlaceholder: "Confirm new password",
      }
    : {
        description: "Modifiez votre mot de passe. Votre numéro ne peut pas être modifié.",
        newPasswordPlaceholder: "Entrez le nouveau mot de passe",
        confirmPasswordPlaceholder: "Confirmez le nouveau mot de passe",
      };
}

function EditProfileForm({
  copy,
  phone,
  currentPhoneLabel,
  newPasswordLabel,
  confirmPasswordLabel,
  password,
  confirmPassword,
  showPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  autoFocus,
}: {
  copy: ReturnType<typeof getCopy>;
  phone: string;
  currentPhoneLabel: string;
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background">
            <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{currentPhoneLabel}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{phone}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-profile-password">{newPasswordLabel}</Label>
        <div className="relative">
          <Input
            id="edit-profile-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={copy.newPasswordPlaceholder}
            className="bg-background pr-10"
            autoFocus={autoFocus}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={onToggleShowPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-profile-confirm-password">{confirmPasswordLabel}</Label>
        <Input
          id="edit-profile-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder={copy.confirmPasswordPlaceholder}
          className="bg-background"
        />
      </div>
    </div>
  );
}

function EditProfileActions({
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
  className,
}: {
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      <Button type="button" variant="outline" onClick={onCancel} className="sm:min-w-[7rem]">
        {cancelLabel}
      </Button>
      <Button type="button" onClick={onSave} className={cn("sm:min-w-[9rem]", saveButtonClass)}>
        <Save className="mr-2 h-4 w-4" aria-hidden />
        {saveLabel}
      </Button>
    </div>
  );
}

export function EditProfileDialog({
  open,
  onOpenChange,
  language,
  phone,
  password,
  confirmPassword,
  showPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onSave,
  onCancel,
  title,
  currentPhoneLabel,
  newPasswordLabel,
  confirmPasswordLabel,
  cancelLabel,
  saveLabel,
}: EditProfileDialogProps) {
  const isMobile = useIsMobile();
  const copy = getCopy(language);

  const form = (
    <EditProfileForm
      copy={copy}
      phone={phone}
      currentPhoneLabel={currentPhoneLabel}
      newPasswordLabel={newPasswordLabel}
      confirmPasswordLabel={confirmPasswordLabel}
      password={password}
      confirmPassword={confirmPassword}
      showPassword={showPassword}
      onPasswordChange={onPasswordChange}
      onConfirmPasswordChange={onConfirmPasswordChange}
      onToggleShowPassword={onToggleShowPassword}
      autoFocus={!isMobile}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] border-border/60">
          <DrawerHeader className="px-5 pb-2 text-left">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">
              {copy.description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-5 pb-2">{form}</div>

          <DrawerFooter className="border-t border-border/50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <EditProfileActions
              cancelLabel={cancelLabel}
              saveLabel={saveLabel}
              onCancel={onCancel}
              onSave={onSave}
            />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <DialogHeader className="space-y-2 border-b border-border/50 px-6 py-5 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">{form}</div>

        <DialogFooter className="border-t border-border/50 px-6 py-4">
          <EditProfileActions
            cancelLabel={cancelLabel}
            saveLabel={saveLabel}
            onCancel={onCancel}
            onSave={onSave}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
