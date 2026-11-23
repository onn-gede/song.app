import type { Metadata } from "next";
import { PasswordRecoveryForm } from "@/components/PasswordRecoveryForm";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Parolă nouă · SongApp BCBgiroc"};

export default function ResetPasswordPage(){return <main className="password-access-page"><PasswordRecoveryForm/></main>;}
