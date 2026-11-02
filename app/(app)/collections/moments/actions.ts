'use server';
import {requireProfile} from '@/lib/auth';
import {revalidatePath,refresh} from 'next/cache';
export async function updateMomentAction(data:FormData){
 const {supabase}=await requireProfile('editor');const id=String(data.get('id')||''),meeting=String(data.get('meeting_id')||''),title=String(data.get('title')||'').trim(),text=String(data.get('text')||'').trim(),color=String(data.get('color')||'');
 if(title.length>200||text.length>5000||!/^#[a-f0-9]{6}$/i.test(color))throw new Error('Verifică titlul, observațiile și culoarea.');
 const {error,data:updated}=await supabase.from('meeting_items').update({custom_title:title||null,custom_text:text||null,moment_color:color}).eq('id',id).eq('meeting_id',meeting).is('song_id',null).select('id').single();
 if(error||!updated)throw new Error('Momentul nu mai există sau nu poate fi modificat.');
 revalidatePath('/collections/moments');revalidatePath(`/meetings/${meeting}`);revalidatePath('/program','layout');refresh();
}
