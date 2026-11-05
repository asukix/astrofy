import { useState } from "preact/hooks";
import { isRegistered } from "../data/children";
import type { ChildProfile, Person } from "../model";
import { S } from "../strings";
import { Avatar } from "./components";
import { EditorField } from "./WishEditorScreen";

/** Adding a child ([existing] null) or editing one (ChildDialog in the app). */
export function ChildEditorScreen({
  existing,
  onSave,
}: {
  existing: ChildProfile | null;
  /** Returns an error message to show, or null when it was saved. */
  onSave: (name: string, email: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailLocked = existing !== null && isRegistered(existing);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      setError(await onSave(name, email));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} class="flex flex-col gap-4" noValidate>
      <EditorField label={S.childName}>
        <input
          class="input input-bordered w-full"
          value={name}
          maxLength={100}
          autoComplete="off"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
      </EditorField>
      <EditorField label={S.childEmail} hint={emailLocked ? S.childEmailLocked : S.childHint}>
        <input
          class="input input-bordered w-full"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          disabled={emailLocked}
          onInput={(e) => {
            setEmail(e.currentTarget.value);
            setError(null);
          }}
        />
      </EditorField>
      {error && (
        <p class="sp-alert sp-alert--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {busy && <span class="loading loading-spinner loading-sm" />}
        {S.save}
      </button>
    </form>
  );
}

/** Choosing the other parent among my accepted connections (CoParentDialog in the app). */
export function CoParentScreen({
  child,
  candidates,
  onAdd,
}: {
  child: ChildProfile;
  candidates: Person[];
  onAdd: (person: Person) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const person = candidates.find((p) => p.id === selected) ?? null;

  return (
    <div class="flex flex-col gap-4">
      <p class="text-base-content/80">
        <span class="font-semibold">{child.name}</span> · {S.coParentHint}
      </p>
      {candidates.length === 0 ? (
        <p class="sp-empty">{S.coParentEmpty}</p>
      ) : (
        <>
          <ul class="sp-card flex flex-col py-2" role="radiogroup" aria-label={S.coParentTitle}>
            {candidates.map((p) => (
              <li key={p.id}>
                <label class="flex items-center gap-3 px-4 py-2 cursor-pointer">
                  <input
                    type="radio"
                    name="coparent"
                    class="radio radio-primary radio-sm"
                    checked={selected === p.id}
                    onChange={() => setSelected(p.id)}
                  />
                  <Avatar person={p} />
                  <span class="min-w-0">
                    <span class="block font-semibold truncate">{p.displayName}</span>
                    <span class="block text-sm text-base-content/60 truncate">{p.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            class="btn btn-primary"
            disabled={!person || busy}
            onClick={async () => {
              if (!person) return;
              setBusy(true);
              try {
                await onAdd(person);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <span class="loading loading-spinner loading-sm" />}
            {S.coParentAdd}
          </button>
        </>
      )}
    </div>
  );
}
