"use server";

import { headers } from "next/headers";
import { findPublicSurvey } from "@/lib/publish";
import { hashSecret, getMailer } from "@/lib/mailer-runtime";
import { RespondError, requestCode, verifyCode } from "@/lib/respond";
import { createAdminClient } from "@/lib/supabase/admin";

export type CodeState = { step: "email" | "code"; email?: string; error?: string };
export type VerifyState = { token?: string; error?: string };

function messageOf(error: unknown) {
  if (error instanceof RespondError) return error.message;
  if (error instanceof Error && error.name === "LimitExceededError") return "오늘은 응답을 더 받을 수 없어요. 내일 다시 시도해 주세요.";
  console.error(error);
  return "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function openSurvey(slug: string) {
  const survey = await findPublicSurvey(createAdminClient(), slug);
  if (!survey) throw new RespondError("설문을 찾을 수 없어요.", "closed");
  return survey;
}

export async function sendCode(slug: string, _prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "");
  try {
    await requestCode(createAdminClient(), getMailer(), hashSecret(), {
      survey: await openSurvey(slug),
      email,
      consent: formData.get("consent") === "on",
      honeypot: String(formData.get("website") ?? ""),
      ip: await clientIp(),
    });
    return { step: "code", email };
  } catch (error) {
    return { step: "email", email, error: messageOf(error) };
  }
}

export async function checkCode(slug: string, email: string, _prev: VerifyState, formData: FormData): Promise<VerifyState> {
  try {
    const token = await verifyCode(createAdminClient(), hashSecret(), { survey: await openSurvey(slug), email, code: String(formData.get("code") ?? "") });
    return { token };
  } catch (error) {
    return { error: messageOf(error) };
  }
}
