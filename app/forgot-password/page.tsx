import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Recuperare parolă · SongApp BCBgiroc"};

export default function ForgotPasswordPage(){return <main className="password-access-page"><ForgotPasswordForm/></main>;}
