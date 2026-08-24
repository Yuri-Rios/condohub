import { chamarApi } from "@/src/lib/backend";
export async function POST(request:Request){return chamarApi("/documentos/pastas",{method:"POST",headers:{"Content-Type":"application/json"},body:await request.text()})}
