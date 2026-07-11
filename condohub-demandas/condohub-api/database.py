import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Carrega o arquivo da API independentemente do diretório usado para iniciar o
# Uvicorn. No Render, a variável configurada no serviço continua tendo
# prioridade sobre o arquivo local.
load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL não configurada. Defina a connection string do Neon "
        "nas variáveis de ambiente do serviço."
    )

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": "-c timezone=America/Fortaleza"},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()
