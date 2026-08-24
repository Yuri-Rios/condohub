import { chamarApi } from "@/src/lib/backend";
export async function GET(_request:Request,{params}:{params:Promise<{tipo:string}>}){const{tipo}=await params;return chamarApi(`/documentos/${encodeURIComponent(tipo)}/estrutura`)}
