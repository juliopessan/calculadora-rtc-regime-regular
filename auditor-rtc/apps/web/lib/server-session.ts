import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lerSessaoDeToken, NOME_COOKIE, type Sessao } from "./session";

/** Para Server Components: devolve a sessão ou redireciona ao login. */
export async function sessaoOuLogin(): Promise<Sessao> {
  const s = await lerSessaoDeToken((await cookies()).get(NOME_COOKIE)?.value);
  if (!s) redirect("/login");
  return s;
}
