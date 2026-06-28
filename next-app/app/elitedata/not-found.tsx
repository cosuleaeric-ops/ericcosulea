import Link from "next/link";
import { Compass } from "lucide-react";

export default function AnalyticsNotFound() {
  return (
    <div className="dfa-empty" style={{ marginTop: 48 }}>
      <Compass size={28} className="dfa-faint" />
      <h3>Site negăsit</h3>
      <p>Site-ul căutat nu există sau a fost șters.</p>
      <Link href="/elitedata" className="dfa-btn dfa-btn-primary">
        ← Toate site-urile
      </Link>
    </div>
  );
}
