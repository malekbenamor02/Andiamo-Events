import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Ambassador, AmbassadorErrors } from "../types";
import { AmbassadorExtraVillesPicker } from "./AmbassadorExtraVillesPicker";
import type { AmbassadorsTabTranslation } from "./AmbassadorsTab";

interface EditAmbassadorFormProps {
  language: "en" | "fr";
  t: AmbassadorsTabTranslation;
  ambassador: Ambassador;
  setAmbassador: (value: Ambassador | ((prev: Ambassador | null) => Ambassador | null)) => void;
  errors: AmbassadorErrors;
  setErrors: (updater: (prev: AmbassadorErrors) => AmbassadorErrors) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
}

function FieldGroup({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-normal text-muted-foreground">
        {label}
        {required && <span className="text-foreground/60"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function EditAmbassadorForm({
  language,
  t,
  ambassador,
  setAmbassador,
  errors,
  setErrors,
  showPassword,
  setShowPassword,
}: EditAmbassadorFormProps) {
  const showNeighborhood =
    ambassador.city === "Sousse" || ambassador.city === "Tunis";

  const copy =
    language === "en"
      ? {
          profile: "Profile",
          contact: "Contact",
          location: "Location",
          account: "Account",
          age: "Age",
          neighborhood: "Neighborhood",
          instagram: "Instagram",
          passwordHint: "Leave empty to keep the current password",
          instagramHint:
            "Must start with https://www.instagram.com/ or https://instagram.com/",
          selectCity: "Select a city",
          selectNeighborhood: "Select a neighborhood",
        }
      : {
          profile: "Profil",
          contact: "Contact",
          location: "Localisation",
          account: "Compte",
          age: "Âge",
          neighborhood: "Quartier",
          instagram: "Instagram",
          passwordHint: "Laisser vide pour garder le mot de passe actuel",
          instagramHint:
            "Doit commencer par https://www.instagram.com/ ou https://instagram.com/",
          selectCity: "Sélectionner une ville",
          selectNeighborhood: "Sélectionner un quartier",
        };

  const fieldClass = (hasError?: boolean) =>
    cn(hasError && "border-destructive");

  return (
    <div className="space-y-6">
      <Section title={copy.profile}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup
            label={t.ambassadorName}
            htmlFor="ambassadorName"
            required
            error={errors.full_name}
          >
            <Input
              id="ambassadorName"
              value={ambassador.full_name || ""}
              onChange={(e) => {
                setAmbassador((prev) =>
                  prev ? { ...prev, full_name: e.target.value } : prev
                );
                if (errors.full_name) {
                  setErrors((prev) => ({ ...prev, full_name: undefined }));
                }
              }}
              className={fieldClass(!!errors.full_name)}
              required
            />
          </FieldGroup>
          <FieldGroup label={copy.age} htmlFor="ambassadorAge" required>
            <Input
              id="ambassadorAge"
              type="number"
              min={16}
              max={99}
              value={ambassador.age ?? ""}
              onChange={(e) => {
                const ageValue = e.target.value;
                setAmbassador((prev) =>
                  prev
                    ? {
                        ...prev,
                        age: ageValue ? parseInt(ageValue, 10) : undefined,
                      }
                    : prev
                );
              }}
              required
            />
          </FieldGroup>
        </div>
      </Section>

      <Section title={copy.contact}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup
            label={t.ambassadorPhone}
            htmlFor="ambassadorPhone"
            required
            error={errors.phone}
          >
            <Input
              id="ambassadorPhone"
              value={ambassador.phone || ""}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 8);
                setAmbassador((prev) =>
                  prev ? { ...prev, phone: digitsOnly } : prev
                );
                if (errors.phone) {
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              placeholder="24951234"
              className={fieldClass(!!errors.phone)}
              required
            />
          </FieldGroup>
          <FieldGroup
            label={t.ambassadorEmail}
            htmlFor="ambassadorEmail"
            required
            error={errors.email}
          >
            <Input
              id="ambassadorEmail"
              type="email"
              value={ambassador.email || ""}
              onChange={(e) => {
                setAmbassador((prev) =>
                  prev ? { ...prev, email: e.target.value } : prev
                );
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              className={fieldClass(!!errors.email)}
              required
            />
          </FieldGroup>
        </div>
      </Section>

      <Section title={copy.location}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup
            label={t.ambassadorCity}
            required
            error={errors.city}
          >
            <Select
              value={ambassador.city || ""}
              onValueChange={(value) => {
                setAmbassador((prev) =>
                  prev
                    ? {
                        ...prev,
                        city: value,
                        ville:
                          value === "Sousse" || value === "Tunis"
                            ? prev.ville ?? ""
                            : "",
                        extra_villes: [],
                      }
                    : prev
                );
                if (errors.city) {
                  setErrors((prev) => ({ ...prev, city: undefined }));
                }
              }}
            >
              <SelectTrigger className={fieldClass(!!errors.city)}>
                <SelectValue placeholder={copy.selectCity} />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>

          {showNeighborhood && (
            <FieldGroup
              label={copy.neighborhood}
              required
              error={errors.ville}
            >
              <Select
                value={ambassador.ville || ""}
                onValueChange={(value) => {
                  setAmbassador((prev) =>
                    prev
                      ? {
                          ...prev,
                          ville: value,
                          extra_villes: (prev.extra_villes ?? []).filter(
                            (v) => v !== value
                          ),
                        }
                      : prev
                  );
                  if (errors.ville) {
                    setErrors((prev) => ({ ...prev, ville: undefined }));
                  }
                }}
              >
                <SelectTrigger className={fieldClass(!!errors.ville)}>
                  <SelectValue placeholder={copy.selectNeighborhood} />
                </SelectTrigger>
                <SelectContent>
                  {ambassador.city === "Sousse" &&
                    SOUSSE_VILLES.map((ville) => (
                      <SelectItem key={ville} value={ville}>
                        {ville}
                      </SelectItem>
                    ))}
                  {ambassador.city === "Tunis" &&
                    TUNIS_VILLES.map((ville) => (
                      <SelectItem key={ville} value={ville}>
                        {ville}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FieldGroup>
          )}
        </div>

        {showNeighborhood && (
          <AmbassadorExtraVillesPicker
            city={ambassador.city}
            primaryVille={ambassador.ville}
            value={ambassador.extra_villes ?? []}
            onChange={(extra_villes) =>
              setAmbassador((prev) => (prev ? { ...prev, extra_villes } : prev))
            }
            language={language}
          />
        )}
      </Section>

      <Section title={copy.account}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup
            label={copy.instagram}
            htmlFor="ambassadorSocialLink"
            error={errors.social_link}
            hint={copy.instagramHint}
          >
            <Input
              id="ambassadorSocialLink"
              type="url"
              value={ambassador.social_link || ""}
              onChange={(e) => {
                setAmbassador((prev) =>
                  prev ? { ...prev, social_link: e.target.value } : prev
                );
                if (errors.social_link) {
                  setErrors((prev) => ({ ...prev, social_link: undefined }));
                }
              }}
              placeholder="https://www.instagram.com/username"
              className={fieldClass(!!errors.social_link)}
            />
          </FieldGroup>
          <FieldGroup
            label={t.ambassadorPassword}
            htmlFor="ambassadorPassword"
            error={errors.password}
            hint={copy.passwordHint}
          >
            <div className="relative">
              <Input
                id="ambassadorPassword"
                type={showPassword ? "text" : "password"}
                value={ambassador.password || ""}
                onChange={(e) => {
                  setAmbassador((prev) =>
                    prev ? { ...prev, password: e.target.value } : prev
                  );
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                className={cn("pr-9", fieldClass(!!errors.password))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showPassword
                    ? language === "en"
                      ? "Hide password"
                      : "Masquer le mot de passe"
                    : language === "en"
                      ? "Show password"
                      : "Afficher le mot de passe"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </FieldGroup>
        </div>
      </Section>
    </div>
  );
}
