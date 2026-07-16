// src/custom.d.ts

// This part should already be in your file
declare module "*.svg" {
  import React = require("react");
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

// --- ADD THIS NEW BLOCK ---
// This tells TypeScript that for any file ending in .png, .jpg, etc.,
// the default export is a string (which will be the image's path).
declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.gif" {
  const value: string;
  export default value;
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// Shim for Amplitude types during local dev to avoid TS2307
declare module '@amplitude/analytics-browser' {
  export const init: (...args: any[]) => void;
  export const track: (...args: any[]) => void;
  export const setUserId: (...args: any[]) => void;
  export const identify: (...args: any[]) => void;
  export class Identify { constructor(...args: any[]); set(...args: any[]): any; }
  export const reset: (...args: any[]) => void;
}

declare module 'date-fns-tz' {
  export function getTimezoneOffset(timeZone: string, date: Date | number): number;
}

// MSG91 OTP Widget types
declare global {
  interface Window {
    initSendOTP?: (config: {
      widgetId: string;
      tokenAuth: string;
      identifier?: string;
      exposeMethods?: boolean;
      captchaRenderId?: string;
      success?: (data: any) => void;
      failure?: (error: any) => void;
    }) => void;
    sendOtp?: (identifier: string, success?: (data: any) => void, failure?: (error: any) => void, reqId?: string) => void;
    verifyOtp?: (otp: string, success?: (data: any) => void, failure?: (error: any) => void, reqId?: string) => void;
    retryOtp?: (channel: string | null, success?: (data: any) => void, failure?: (error: any) => void, reqId?: string) => void;
    isCaptchaVerified?: () => boolean;
    getWidgetData?: () => any;
    msg91ScriptLoaded?: boolean;
  }
}
declare module "*.webp" {
  const value: string;
  export default value;
}
declare module "*.mp4" {
  const src: string;
  export default src;
}