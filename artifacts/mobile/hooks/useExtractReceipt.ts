import { useMutation } from "@tanstack/react-query";
import type { ImagePickerAsset } from "expo-image-picker";

import { useAuthStore } from "@/stores/authStore";
import { httpClient } from "@/utils/httpClient";

export interface ReceiptExpense {
  amount: number;
  currency: string;
  category: string;
}

export interface ReceiptExtractionResponse {
  customer_id: string;
  input_type: string;
  transcript: string;
  expenses: ReceiptExpense[];
  has_expense: boolean;
  confidence: string;
  saved_path: string | null;
}

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  bmp: "image/bmp",
  tiff: "image/tiff",
  webp: "image/webp",
};

function getReceiptFile(asset: ImagePickerAsset): {
  name: string;
  mimeType: string;
  file: Blob | { uri: string; name: string; type: string };
} {
  const uriExtension = asset.uri
    .split(/[?#]/, 1)[0]
    .split(".")
    .pop()
    ?.toLowerCase();
  const fileExtension =
    asset.fileName?.split(".").pop()?.toLowerCase() ?? uriExtension;
  const defaultMimeType = fileExtension ? MIME_TYPES[fileExtension] : undefined;
  const providedMimeType = asset.mimeType?.toLowerCase();
  const mimeType = defaultMimeType;
  if (
    !fileExtension ||
    !defaultMimeType ||
    !mimeType ||
    (providedMimeType !== null &&
      providedMimeType !== undefined &&
      providedMimeType !== defaultMimeType &&
      !(providedMimeType === "image/jpg" && defaultMimeType === "image/jpeg"))
  ) {
    throw new Error("UNSUPPORTED_RECEIPT_FILE");
  }

  const name = asset.fileName || `receipt.${fileExtension}`;
  if (asset.file) {
    return { name, mimeType, file: asset.file };
  }

  return {
    name,
    mimeType,
    file: { uri: asset.uri, name, type: mimeType },
  };
}

export function useExtractReceipt() {
  const userId = useAuthStore((state) => state.tokens?.userId);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  return useMutation({
    mutationFn: async (asset: ImagePickerAsset) => {
      if (!sessionReady || !userId) {
        throw new Error("INVALID_SESSION");
      }

      const receiptFile = getReceiptFile(asset);
      const formData = new FormData();
      formData.append("customer_id", userId);
      formData.append("file", receiptFile.file as Blob, receiptFile.name);

      const response = await httpClient.post<ReceiptExtractionResponse>(
        "/v1/ai/transactions/extract/receipt",
        formData,
      );
      if (
        !response.data ||
        !Array.isArray(response.data.expenses) ||
        !response.data.expenses.every(
          (expense) =>
            expense !== null &&
            typeof expense === "object" &&
            Number.isFinite(expense.amount) &&
            typeof expense.currency === "string" &&
            expense.currency.trim().length > 0 &&
            typeof expense.category === "string" &&
            expense.category.trim().length > 0,
        )
      ) {
        throw new Error("INVALID_RECEIPT_RESPONSE");
      }
      return response.data;
    },
  });
}
