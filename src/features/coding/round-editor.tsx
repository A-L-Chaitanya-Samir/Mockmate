"use client";
import type { FormEvent } from "react";
import { Code2 } from "lucide-react";
import { codingConfig } from "@/config/coding";
import type { CodingLanguage } from "@/types/coding";
import { Panel } from "@/components/ui/primitives";
export function RoundEditor({
  language,
  value,
  disabled,
  onChange,
  onPasteAttempt,
  onLanguageChange,
}: {
  language: CodingLanguage;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onPasteAttempt: (detail: string) => void;
  onLanguageChange: (language: CodingLanguage) => void;
}) {
  function beforeInput(event: FormEvent<HTMLTextAreaElement>) {
    const native = event.nativeEvent as InputEvent;
    if (
      native.inputType === "insertFromPaste" ||
      native.inputType === "insertFromDrop"
    ) {
      event.preventDefault();
      onPasteAttempt("An editor insertion from paste or drop was blocked.");
    }
  }
  return (
    <Panel className="p-0! overflow-hidden">
      <div className="editor-bar">
        <span className="flex items-center gap-2 text-xs text-muted">
          <Code2 size={16} />
          solution · {language}
        </span>
        <label>
          <span className="sr-only">Coding language</span>
          <select
            value={language}
            disabled={disabled}
            onChange={(e) => onLanguageChange(e.target.value as CodingLanguage)}
          >
            {codingConfig.languages.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="sr-only">Code editor</span>
        <textarea
          className="code-editor w-full"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={value}
          readOnly={disabled}
          maxLength={codingConfig.maxCodeLength}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            if (!disabled) {
              e.preventDefault();
              onPasteAttempt("A paste into the code editor was blocked.");
            }
          }}
          onDrop={(e) => {
            if (!disabled) {
              e.preventDefault();
              onPasteAttempt("A drop into the code editor was blocked.");
            }
          }}
          onBeforeInput={beforeInput}
          onDragStart={(e) => e.preventDefault()}
        />
      </label>
      <p className="text-subtle text-[10px] border-t border-border px-4 py-3">
        Native editor · Typing, selection, undo, and deletion work normally. Use
        spaces to indent; Tab moves focus. No code execution.
      </p>
    </Panel>
  );
}
