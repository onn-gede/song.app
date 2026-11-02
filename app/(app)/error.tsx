'use client';
import {PageError} from '@/components/PageError';
export default function AppError({reset}:{reset:()=>void}){return <PageError reset={reset}/>;}
