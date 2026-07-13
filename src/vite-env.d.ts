/// <reference types="vite/client" />

declare module "qrcode" {
  type QrCodeToDataUrlOptions = {
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
  };

  const QRCode: {
    toDataURL(text: string, options?: QrCodeToDataUrlOptions): Promise<string>;
  };

  export default QRCode;
}
