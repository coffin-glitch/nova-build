"use client";
import { motion } from "framer-motion";
import { User as UserIcon } from "lucide-react";
import BookSheet from "./BookSheet";

type LoadCardProps = {
  rr: string;
  equipment?: string | null;
  tag?: string | null;
  origin: { city: string | null; state: string | null };
  dest: { city: string | null; state: string | null };
  pickup_window?: string | null;
  pickup_date?: string | null;
  miles?: number | null;
  revenue?: number | null;
  customer?: string | null;
  ctaHref: string;
};

export default function LoadCard(p: LoadCardProps) {
  return (
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:-translate-y-1 hover:shadow-lg transition-all"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {p.equipment ? (
              <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">{p.equipment}</span>
            ) : null}
            <span className="text-xs text-gray-500">#{p.rr}</span>
            {p.tag ? <span className="text-xs text-gray-500">· {p.tag}</span> : null}
          </div>
          <h4 className="text-lg font-semibold text-gray-800">
            {(p.origin.city || "-")}, {p.origin.state || "-"} → {(p.dest.city || "-")}, {p.dest.state || "-"}
          </h4>
          {p.pickup_date || p.pickup_window ? (
            <p className="text-sm text-gray-500 mt-1">
              Pickup: {p.pickup_date ?? "-"}{p.pickup_window ? `, ${p.pickup_window}` : ""}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">
            {p.revenue != null ? `$${Number(p.revenue).toLocaleString()}` : "—"}
          </p>
          <p className="text-sm text-gray-500">{p.miles != null ? `${p.miles.toLocaleString()} miles` : "—"}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
            <UserIcon className="text-gray-500 h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{p.customer ?? "—"}</p>
            <p className="text-xs text-gray-500">Trusted Shipper</p>
          </div>
        </div>
        <BookSheet rr={p.rr} />
      </div>
    </motion.div>
  );
}
