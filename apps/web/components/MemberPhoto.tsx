"use client";

import { useRef, useState } from "react";
import { fileToPhotoDataUrl } from "../lib/api";

/** Member photo picker: camera/file capture, downscaled preview, and clear.
 *  The value is a data URL stored on the member record (photoUrl). */
export function MemberPhoto({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await fileToPhotoDataUrl(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read the image");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <label className="label">Photo</label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Member photo"
            className="h-16 w-16 shrink-0 rounded-full border border-stone-200 object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-stone-300 text-xs text-stone-400">
            None
          </span>
        )}
        <div className="space-y-1.5">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="input !py-1.5 text-xs"
            disabled={disabled || busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {value && (
            <button
              type="button"
              className="btn-ghost px-2 py-0.5 text-xs"
              disabled={disabled || busy}
              onClick={() => onChange("")}
            >
              Clear photo
            </button>
          )}
        </div>
      </div>
      {busy && <p className="hint mt-1">Resizing image…</p>}
      {err && <p className="field-err mt-1">{err}</p>}
      <p className="hint">Auto-resized before upload — stored on the member record.</p>
    </div>
  );
}
