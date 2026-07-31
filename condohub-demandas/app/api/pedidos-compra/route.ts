import { chamarApi } from "@/src/lib/backend";
export async function GET() { return chamarApi("/pedidos-compra"); }
export async function POST(request: Request) { return chamarApi("/pedidos-compra", { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() }); }
