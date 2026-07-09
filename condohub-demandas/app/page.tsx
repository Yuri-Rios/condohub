export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-gray-900">
        Camila Barbosa Chamados
      </h1>

      {/* <p className="mt-2 text-gray-600">
        Sistema simples para registrar ocorrências do condomínio.
      </p> */}

      <div className="mt-6 rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Ocorrências</h2>

        <p className="mt-2 text-gray-500">
          Nenhuma ocorrência cadastrada ainda.
        </p>
      </div>
    </main>
  );
}