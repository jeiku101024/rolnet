import { finalizeReceiptUpload, prepareReceiptUpload } from "@/app/actions/expenses";
import { prepareReceiptFile, removeReceiptObject, uploadReceipt } from "@/lib/uploads/receipts";
import { receiptFileProblem } from "@/lib/uploads/rules";

export type PreparedReceipt = Awaited<ReturnType<typeof prepareReceiptFile>>;

/** Checks and compresses a chosen receipt before anything is saved, so a bad file never leaves a half-saved expense. */
export async function prepareChosenReceipt(file: File | null): Promise<{ receipt: PreparedReceipt | null; problem?: string }> {
  if (!file || !file.size) return { receipt: null };
  const problem = receiptFileProblem(file);
  if (problem) return { receipt: null, problem };
  return { receipt: await prepareReceiptFile(file) };
}

/** Uploads a compressed receipt for a saved expense; removes the object if its metadata cannot be saved. */
export async function attachReceipt(expenseId: string, receipt: PreparedReceipt) {
  const prepared = await prepareReceiptUpload(expenseId, receipt.mimeType);
  if (!prepared.ok) return prepared;
  await uploadReceipt(receipt.file, prepared.data.objectPath, receipt.mimeType);
  const finalized = await finalizeReceiptUpload({ expenseId, objectPath: prepared.data.objectPath, mimeType: receipt.mimeType, sizeBytes: receipt.sizeBytes, sha256: receipt.sha256 });
  if (!finalized.ok) await removeReceiptObject(prepared.data.objectPath);
  return finalized;
}
