import Link from "next/link";
import { Fragment } from "react";

const EXPRESSAO=/([@#$])\[([^\]]+)\]\((pessoa|chamado|pedido):(\d+)\)/g;
export default function TextoComReferencias({texto,className}:{texto:string;className?:string}) {
  const partes=[]; let ultimo=0; let resultado:RegExpExecArray|null;
  while((resultado=EXPRESSAO.exec(texto))!==null){
    partes.push(texto.slice(ultimo,resultado.index));
    const [,gatilho,nome,tipo,id]=resultado;
    const href=tipo==="pessoa"?`/pessoas/${id}`:tipo==="chamado"?`/ocorrencias#chamado-${id}`:`/pedidos-compra#pedido-${id}`;
    partes.push(<Link key={`${resultado.index}-${id}`} href={href} className="rounded bg-blue-50 px-1 font-semibold text-blue-700 hover:underline">{gatilho}{nome}</Link>);
    ultimo=EXPRESSAO.lastIndex;
  }
  partes.push(texto.slice(ultimo));
  return <span className={`whitespace-pre-wrap ${className??""}`}>{partes.map((p,i)=><Fragment key={i}>{p}</Fragment>)}</span>;
}
