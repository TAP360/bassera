import axios from "axios";
import type { Language } from "@/localization/preferences";

const errors = {
  en: {
    INVALID_REFRESH_TOKEN: "Your session has expired. Please sign in again.",
    ACCOUNT_NOT_ACTIVE: "This account is not active. Please contact the account administrator.",
    IDENTITY_HTTPS_REQUIRED: "This HTTP server is for development only. Configure an HTTPS identity server for production.",
    IDENTITY_UNAVAILABLE: "The development identity server is unavailable. Please try again.",
    INVALID_EMAIL: "Enter a valid email address and password.",
    PASSWORD_TOO_SHORT: "Use at least 8 characters for your new password.",
    INVALID_CREDENTIALS: "The email or password is incorrect.",
    EMAIL_ALREADY_EXISTS: "This email is already registered. Sign in instead.",
    INVALID_MFA: "Enter a valid 6-digit authenticator code.",
    INVALID_RECOVERY_CODE: "That recovery code is invalid or has already been used.",
    SOCIAL_UNAVAILABLE: "Social sign-in is not connected yet. Please use email or mobile.",
    INVALID_PHONE: "Enter a valid mobile number and country calling code.",
    UNSUPPORTED_COUNTRY_CODE: "This country calling code is not supported.",
    INVALID_OTP: "That code is incorrect. Please try again.",
    OTP_EXPIRED: "This code has expired. Request a new code.",
    OTP_ATTEMPTS_EXHAUSTED: "No attempts remain. Request a new code.",
    NO_PENDING_OTP: "There is no active code for this number. Request a new code.",
    MFA_REQUIRED: "Complete the additional verification for this account.",
    INVALID_SESSION: "The server did not return a valid login session.",
    INVALID_PROFILE: "The server did not return your user profile.",
    INVALID_API_RESPONSE: "The server returned an unexpected response. Please try again.",
    SESSION_STORAGE_FAILED: "Unable to save or restore your session on this device. Please try again.",
    APP_STORAGE_FAILED: "Unable to unlock saved data. Your data has not been deleted.",
    RATE_LIMITED: "Too many requests. Please wait before requesting another code.",
    UNAUTHORIZED: "Your session has expired. Sign out and sign in again.",
    NETWORK: "Unable to connect to the sign-in server. Please try again.",
    UNKNOWN: "Unable to complete this request. Please try again.",
  },
  ar: {
    INVALID_REFRESH_TOKEN: "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.",
    ACCOUNT_NOT_ACTIVE: "هذا الحساب غير نشط. يرجى التواصل مع مسؤول الحساب.",
    IDENTITY_HTTPS_REQUIRED: "هذا الخادم غير المشفر للتطوير فقط. قم بإعداد خادم هوية HTTPS للإنتاج.",
    IDENTITY_UNAVAILABLE: "خادم الهوية للتطوير غير متاح. حاول مرة أخرى.",
    INVALID_EMAIL: "أدخل عنوان بريد إلكتروني وكلمة مرور صالحين.",
    PASSWORD_TOO_SHORT: "استخدم 8 أحرف على الأقل لكلمة المرور الجديدة.",
    INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحين.",
    EMAIL_ALREADY_EXISTS: "هذا البريد مسجّل بالفعل. سجّل الدخول بدلاً من ذلك.",
    INVALID_MFA: "أدخل رمزاً صالحاً من 6 أرقام من تطبيق المصادقة.",
    INVALID_RECOVERY_CODE: "رمز الاسترداد غير صالح أو تم استخدامه بالفعل.",
    SOCIAL_UNAVAILABLE: "تسجيل الدخول الاجتماعي غير متصل بعد. استخدم البريد الإلكتروني أو الهاتف.",
    INVALID_PHONE: "أدخل رقم هاتف محمول ورمز دولة صالحين.",
    UNSUPPORTED_COUNTRY_CODE: "رمز الدولة هذا غير مدعوم.",
    INVALID_OTP: "الرمز غير صحيح. حاول مرة أخرى.",
    OTP_EXPIRED: "انتهت صلاحية الرمز. اطلب رمزاً جديداً.",
    OTP_ATTEMPTS_EXHAUSTED: "نفدت محاولات التحقق. اطلب رمزاً جديداً.",
    NO_PENDING_OTP: "لا يوجد رمز نشط لهذا الرقم. اطلب رمزاً جديداً.",
    MFA_REQUIRED: "أكمل التحقق الإضافي لهذا الحساب.",
    INVALID_SESSION: "لم يُرجع الخادم جلسة تسجيل دخول صالحة.",
    INVALID_PROFILE: "لم يُرجع الخادم ملفك الشخصي.",
    INVALID_API_RESPONSE: "أرجع الخادم استجابة غير متوقعة. حاول مرة أخرى.",
    SESSION_STORAGE_FAILED: "تعذر حفظ أو استعادة جلستك على هذا الجهاز. حاول مرة أخرى.",
    APP_STORAGE_FAILED: "تعذر فتح البيانات المحفوظة. لم يتم حذف بياناتك.",
    RATE_LIMITED: "طلبات كثيرة جداً. انتظر قبل طلب رمز آخر.",
    UNAUTHORIZED: "انتهت جلستك. سجّل الخروج ثم سجّل الدخول مرة أخرى.",
    NETWORK: "تعذر الاتصال بخادم تسجيل الدخول. يرجى المحاولة مرة أخرى.",
    UNKNOWN: "تعذر إكمال هذا الطلب. حاول مرة أخرى.",
  },
};

export function getAuthErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    return body && typeof body === "object" && typeof body.code === "string" ? body.code : undefined;
  }
  return error instanceof Error ? error.message : undefined;
}

export function authErrorMessage(error: unknown, language: Language): string {
  const copy = errors[language];
  const code = getAuthErrorCode(error);
  let message = code && code in copy ? copy[code as keyof typeof copy] : copy.UNKNOWN;
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) message = copy.RATE_LIMITED;
    else if (error.response?.status === 401) message = copy.UNAUTHORIZED;
    else if (!error.response) message = copy.NETWORK;
    const remaining = error.response?.data?.remainingAttempts;
    if (code === "INVALID_OTP" && Number.isInteger(remaining) && remaining >= 0) {
      message += language === "ar" ? ` المحاولات المتبقية: ${remaining}.` : ` Attempts remaining: ${remaining}.`;
    }
  }
  return message;
}
