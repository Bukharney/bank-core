"use client";

import React, { useEffect, useRef, useState } from "react";
import { Account, AccountPreview, TransferReceipt } from "@/lib/types";
import { useToast } from "@/context/ToastContext";
import { formatMoney, formatDate, formatAccountNumber } from "@/lib/currency";
import { getAccountMeta } from "@/lib/accountMeta";
import { toPng } from "html-to-image";
import {
  CheckCircle2,
  Copy,
  Check,
  X,
  ArrowDown,
  Printer,
  Download,
  Landmark,
  ShieldCheck,
  QrCode,
  Loader2,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ReceiptModalProps {
  receipt: TransferReceipt | null;
  senderAccount?: Account | null;
  receiverAccount?: Account | AccountPreview | null;
  onClose: () => void;
}

export default function ReceiptModal({
  receipt,
  senderAccount,
  receiverAccount,
  onClose,
}: ReceiptModalProps) {
  const { showToast } = useToast();
  const slipRef = useRef<HTMLDivElement>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedJournal, setCopiedJournal] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  useEffect(() => {
    if (receipt) {
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#0f172a", "#10b981", "#3b82f6"],
        });
      } catch {}
    }
  }, [receipt]);

  if (!receipt) return null;

  const senderMeta = senderAccount ? getAccountMeta(senderAccount.id) : null;
  const receiverMeta = receiverAccount ? getAccountMeta(receiverAccount.id) : null;

  const senderName =
    senderAccount?.account_holder_name ||
    senderMeta?.nickname ||
    `Account #${receipt.sender_account_id}`;

  const receiverName =
    receiverAccount?.account_holder_name ||
    receiverMeta?.nickname ||
    `Account #${receipt.receiver_account_id}`;

  const copyToClipboard = (text: string, isRef: boolean) => {
    navigator.clipboard.writeText(text);
    if (isRef) {
      setCopiedRef(true);
      showToast("Transfer reference copied!", "info");
      setTimeout(() => setCopiedRef(false), 2000);
    } else {
      setCopiedJournal(true);
      showToast("Journal UUID copied!", "info");
      setTimeout(() => setCopiedJournal(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    if (!slipRef.current) return;
    setSavingImage(true);
    try {
      const dataUrl = await toPng(slipRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `bank-core-slip-${receipt.reference_id.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      showToast("e-Slip image saved to Downloads!", "success");
    } catch (err) {
      showToast("Failed to save image. You can use Print / PDF instead.", "error");
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto print:bg-white print:p-0">
      <div className="relative w-full max-w-[440px] my-auto max-h-[95vh] overflow-y-auto space-y-4 print:max-h-none print:w-full print:max-w-[440px] print:mx-auto">
        {/* The Printable / Exportable e-Slip Card */}
        <div
          id="transfer-receipt-slip"
          ref={slipRef}
          className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-6 sm:p-7 shadow-2xl space-y-5 print:shadow-none print:border-none print:p-6 print:bg-white print:text-black"
        >
          {/* Close Button (Hidden on Print / Snapshot) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition print:hidden"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Slip Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-black tracking-wider text-slate-900">BANK CORE</div>
                <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>โอนเงินสำเร็จ / Successful</span>
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] font-mono text-slate-500">
              {formatDate(receipt.created_at)}
            </div>
          </div>

          {/* Amount Hero Box */}
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              จำนวนเงิน (Amount)
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1 tracking-tight">
              {formatMoney(receipt.amount, receipt.currency)}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              ค่าธรรมเนียม: <span className="text-emerald-600 font-bold">฿0.00</span>
            </div>
          </div>

          {/* Sender -> Receiver Transfer Flow */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-xs space-y-3.5">
            {/* Sender */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  จาก (From)
                </div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{senderName}</div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                  Bank Core • {senderAccount ? formatAccountNumber(senderAccount.account_number) : `#${receipt.sender_account_id}`}
                </div>
              </div>
              <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[9px] font-bold text-slate-700 uppercase font-mono">
                Sender
              </span>
            </div>

            {/* Divider Arrow */}
            <div className="flex items-center justify-center py-0.5">
              <div className="h-px bg-slate-200 flex-1" />
              <div className="mx-3 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <ArrowDown className="h-3 w-3" />
              </div>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Receiver */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  ถึง (To)
                </div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{receiverName}</div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                  Bank Core • {receiverAccount ? formatAccountNumber(receiverAccount.account_number) : `#${receipt.receiver_account_id}`}
                </div>
              </div>
              <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-bold uppercase font-mono">
                Receiver
              </span>
            </div>
          </div>

          {/* Reference Numbers & Verification QR */}
          <div className="flex items-center justify-between pt-1 text-[11px]">
            <div className="space-y-1 font-mono">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400">เลขที่อ้างอิง:</span>
                <span className="font-bold text-slate-900 truncate max-w-[130px] sm:max-w-[170px]">{receipt.reference_id}</span>
                <button
                  onClick={() => copyToClipboard(receipt.reference_id, true)}
                  className="text-slate-400 hover:text-slate-900 print:hidden"
                  title="Copy Reference"
                >
                  {copiedRef ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400">Journal ID:</span>
                <span className="text-slate-700 truncate max-w-[130px] sm:max-w-[170px]">{receipt.journal_id}</span>
                <button
                  onClick={() => copyToClipboard(receipt.journal_id, false)}
                  className="text-slate-400 hover:text-slate-900 print:hidden"
                  title="Copy Journal UUID"
                >
                  {copiedJournal ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {/* Mini Verification QR Pattern */}
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
              <div className="grid grid-cols-4 gap-0.5 h-10 w-10 p-1 bg-white rounded border border-slate-200">
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-300 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-emerald-600 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-300 rounded-xs" />
                <div className="bg-slate-300 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-emerald-600 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-300 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
                <div className="bg-slate-900 rounded-xs" />
              </div>
              <span className="text-[8px] font-mono font-bold text-slate-500 mt-1">E-SLIP VERIFIED</span>
            </div>
          </div>

          {/* Security Guarantee Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-mono text-center">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Settled via Double-Entry Core Banking Engine</span>
          </div>
        </div>

        {/* Action Buttons Bar (Hidden during Print) */}
        <div className="grid grid-cols-2 gap-2 print:hidden">
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={savingImage}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
          >
            {savingImage ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Image...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Save Slip Image</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span>Print / PDF</span>
          </button>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slate-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98] transition print:hidden"
        >
          Done
        </button>
      </div>
    </div>
  );
}
