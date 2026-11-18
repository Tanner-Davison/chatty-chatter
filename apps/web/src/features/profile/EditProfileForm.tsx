import { useState, type FormEvent } from "react";
import { BookOpen, Briefcase, GraduationCap } from "lucide-react";
import type { User } from "@chatty/shared";
import { Button, Field, Input, Textarea } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useUpdateProfile } from "./api";

const EDUCATION_OPTIONS = ["highschool", "2+ years", "4+ years"] as const;

export function EditProfileForm({ user, onDone }: { user: User; onDone: () => void }) {
  const update = useUpdateProfile();
  const [profileBio, setBio] = useState(user.profileBio ?? "");
  const [profession, setProfession] = useState(user.profession ?? "");
  const [education, setEducation] = useState(user.education ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ profileBio, profession, education }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field
        label="Your story"
        icon={<BookOpen className="size-3.5" />}
        error={update.error?.message}
      >
        {(props) => (
          <Textarea
            {...props}
            value={profileBio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            placeholder="I work as a software engineer at…"
          />
        )}
      </Field>
      <Field label="Profession" icon={<Briefcase className="size-3.5" />}>
        {(props) => (
          <Input
            {...props}
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            maxLength={100}
            placeholder="Developer"
          />
        )}
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-fg-muted uppercase">
          <GraduationCap className="size-3.5" /> Education
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {EDUCATION_OPTIONS.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-xl py-2.5 text-sm ring-1 transition has-focus-visible:ring-2 has-focus-visible:ring-primary",
                education === option
                  ? "bg-primary-soft text-primary ring-primary/50"
                  : "text-fg-muted ring-line-strong hover:text-fg",
              )}
            >
              <input
                type="radio"
                name="education"
                value={option}
                checked={education === option}
                onChange={() => setEducation(option)}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={update.isPending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
