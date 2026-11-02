'use client';
import {PageError} from '@/components/PageError';
export default function PublicProgramError({reset}:{reset:()=>void}){return <PageError reset={reset} publicPage/>;}
