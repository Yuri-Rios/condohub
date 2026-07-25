import { chamarApiPublica } from "@/src/lib/backend";

export async function GET() {
  return chamarApiPublica("/");
}
