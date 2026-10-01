import type { HTMLAttributes } from "react";

export interface JobDetailsValues {
  jobNumber: string;
  jobName: string;
  clientName: string;
  clientCompany: string;
  address1: string;
  address2: string;
  date: string;
  inspector: string;
}

type Field = {
  key: keyof JobDetailsValues;
  label: string;
  type?: "text" | "date";
  autoCapitalize?: HTMLAttributes<HTMLInputElement>["autoCapitalize"];
  hint?: string;
};

const FIELDS: Field[] = [
  { key: "jobNumber", label: "Job number", autoCapitalize: "characters" },
  { key: "jobName", label: "Job name", autoCapitalize: "words" },
  { key: "clientName", label: "Client name", autoCapitalize: "words" },
  { key: "clientCompany", label: "Client company", autoCapitalize: "words" },
  { key: "address1", label: "Address line 1", autoCapitalize: "words" },
  { key: "address2", label: "Address line 2", autoCapitalize: "words" },
  { key: "date", label: "Date", type: "date" },
  { key: "inspector", label: "Inspector", autoCapitalize: "words" },
];

interface Props {
  values: JobDetailsValues;
  onChange: (key: keyof JobDetailsValues, value: string) => void;
  onBlur: () => void;
}

/** Job details, saved as you type by the parent (no Save button). */
export function JobDetailsForm({ values, onChange, onBlur }: Props) {
  return (
    <form
      className="form-grid"
      aria-label="Job details"
      onSubmit={(e) => e.preventDefault()}
    >
      {FIELDS.map((field) => (
        <label key={field.key} className="field">
          <span>{field.label}</span>
          <input
            name={field.key}
            type={field.type ?? "text"}
            value={values[field.key]}
            autoCapitalize={field.autoCapitalize}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            onChange={(e) => onChange(field.key, e.target.value)}
            onBlur={onBlur}
          />
        </label>
      ))}
    </form>
  );
}
