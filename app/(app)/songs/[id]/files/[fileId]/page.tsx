import {PresentationPdfViewer} from '@/components/PresentationPdfViewer';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireProfile} from '@/lib/auth';
export default async function PresentationFilePage({params}:{params:Promise<{id:string;fileId:string}>}){
 const {id,fileId}=await params;const {supabase}=await requireProfile();const {data:file}=await supabase.from('song_files').select('id,file_name,file_type,preview_path_v58,upload_complete_v58,presentation_only_v58,songs(title)').eq('id',fileId).eq('song_id',id).single();if(!file)notFound();
 const title=(Array.isArray(file.songs)?file.songs[0]:file.songs)?.title||file.file_name;let url:string|null=null;let error='';
 if(file.upload_complete_v58&&file.preview_path_v58){const result=await supabase.storage.from('song-files').createSignedUrl(file.preview_path_v58,900);if(result.error)error='Previzualizarea nu poate fi încărcată. Reîncarcă pagina sau descarcă originalul.';else url=result.data.signedUrl;}
 return <section className="presentation-file-page"><header><div><h1>{title}</h1><small>{file.file_name}</small></div><div className="inline-form"><Link className="btn secondary" href={`/songs/${id}`}>Înapoi la cântare</Link>{file.upload_complete_v58?<a className="btn" href={`/api/song-files/${fileId}/download`}>Descarcă {file.file_type.toUpperCase()}</a>:null}<a className="btn secondary" href={`/songs/${id}/files/${fileId}`}>Reîncarcă</a></div></header>{error?<p className="error" role="alert">{error}</p>:null}{url?<PresentationPdfViewer url={url} title={title}/>:<p className="muted">{file.upload_complete_v58?'Această prezentare are doar fișierul original. Descarcă-l pentru a-l deschide în PowerPoint.':'Fișierul este în curs de încărcare. Reia importul pentru a confirma încărcarea.'}</p>}</section>;
}
