import { chamarApi } from "@/src/lib/backend";
export async function GET() { return chamarApi("/estoque"); }
export async function POST(request: Request) { return chamarApi("/estoque", { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() }); }
