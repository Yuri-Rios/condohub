type TituloProps = {
  texto: string;
};

export default function Titulo({ texto }: TituloProps) {
  return (
    <h1 className="text-4xl font-bold text-blue-700">
      {texto}
    </h1>
  );
}