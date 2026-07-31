import { chamarApi } from "@/src/lib/backend";
export async function GET() { return chamarApi("/prestadores"); }
export async function POST(request: Request) { return chamarApi("/prestadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() }); }
