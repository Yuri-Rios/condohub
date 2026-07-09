from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware

from database import Base, SessionLocal, engine
from models import Ocorrencia
from schemas import OcorrenciaCriar, OcorrenciaResposta

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def pegar_banco():
    banco = SessionLocal()

    try:
        yield banco
    finally:
        banco.close()


@app.get("/")
def inicio():
    return {"mensagem": "API de ocorrências funcionando"}


@app.get("/ocorrencias", response_model=list[OcorrenciaResposta])
def listar_ocorrencias(banco: Session = Depends(pegar_banco)):
    ocorrencias = banco.query(Ocorrencia).order_by(Ocorrencia.id.desc()).all()
    return ocorrencias


@app.post("/ocorrencias", response_model=OcorrenciaResposta)
def criar_ocorrencia(
    dados: OcorrenciaCriar,
    banco: Session = Depends(pegar_banco)
):
    nova_ocorrencia = Ocorrencia(
        titulo=dados.titulo,
        local=dados.local,
        descricao=dados.descricao,
    )

    banco.add(nova_ocorrencia)
    banco.commit()
    banco.refresh(nova_ocorrencia)

    return nova_ocorrencia

@app.put("/ocorrencias/{ocorrencia_id}", response_model=OcorrenciaResposta)
def atualizar_ocorrencia(
    ocorrencia_id: int,
    dados: OcorrenciaCriar,
    banco: Session = Depends(pegar_banco)
):
    ocorrencia = banco.query(Ocorrencia).filter(Ocorrencia.id == ocorrencia_id).first()

    if ocorrencia is None:
        return {"erro": "Ocorrência não encontrada"}

    ocorrencia.titulo = dados.titulo
    ocorrencia.local = dados.local
    ocorrencia.descricao = dados.descricao

    banco.commit()
    banco.refresh(ocorrencia)

    return ocorrencia