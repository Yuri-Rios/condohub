type TituloProps = {
  texto: string;
  subtitulo?: string;
};

export default function Titulo({ texto, subtitulo }: TituloProps) {
  return (
    <header>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        {texto}
      </h1>
      {subtitulo && (
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
          {subtitulo}
        </p>
      )}
    </header>
  );
}
