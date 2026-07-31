import { chamarApi } from "@/src/lib/backend";
export async function GET() { return chamarApi("/compras"); }
export async function POST(request: Request) { return chamarApi("/compras", { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() }); }
