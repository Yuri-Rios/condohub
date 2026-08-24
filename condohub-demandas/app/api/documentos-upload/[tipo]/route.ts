import { chamarApi } from "@/src/lib/backend";
export async function POST(request:Request,{params}:{params:Promise<{tipo:string}>}){const{tipo}=await params;return chamarApi(`/documentos/${encodeURIComponent(tipo)}/arquivo`,{method:"POST",headers:{"Content-Type":request.headers.get("content-type")??"multipart/form-data"},body:await request.arrayBuffer()})}
