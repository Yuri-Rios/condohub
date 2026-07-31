import { chamarApi } from "@/src/lib/backend";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; return chamarApi(`/pessoas/${encodeURIComponent(id)}`); }
