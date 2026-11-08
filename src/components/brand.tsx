import Link from "next/link";
import { AudioLines } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Mockmate home">
      <span className="brand-mark">
        <AudioLines size={24} strokeWidth={2} />
      </span>
      {!compact && (
        <span>
          Mockmate<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
