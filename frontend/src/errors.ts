export const FheErrorCode = {
  INVALID_INPUT: "INVALID_INPUT",
  ENCRYPTION_FAILED: "ENCRYPTION_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  NETWORK_ERROR: "NETWORK_ERROR",
  SDK_NOT_READY: "SDK_NOT_READY",
  INVALID_CIPHERTEXT: "INVALID_CIPHERTEXT",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type FheErrorCode = (typeof FheErrorCode)[keyof typeof FheErrorCode];

export const getErrorMessage = (code: any): string => {
  const normalized = String(code).toUpperCase();

  if (String(code).toLowerCase().includes("user rejected")) {
    return "Transaction was rejected by the user";
  }

  switch (normalized) {
    case FheErrorCode.INVALID_INPUT:
      return "Invalid input provided";
    case FheErrorCode.ENCRYPTION_FAILED:
      return "Failed to encrypt data";
    case FheErrorCode.DECRYPTION_FAILED:
      return "Failed to decrypt data";
    case FheErrorCode.INSUFFICIENT_BALANCE:
      return "Insufficient balance";
    case FheErrorCode.NETWORK_ERROR:
      return "Network error occurred";
    case FheErrorCode.SDK_NOT_READY:
      return "FHE SDK is not ready";
    case FheErrorCode.INVALID_CIPHERTEXT:
      return "Invalid ciphertext format";
    default:
      return "An unknown error occurred";
  }
};
