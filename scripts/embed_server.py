"""
scripts/embed_server.py

Tiny FastAPI embedding microservice.
Loads jinaai/jina-embeddings-v2-small-en once at startup and serves
POST /embed requests. Used by retriever.ts for query embedding.

Start with:
  python3 scripts/embed_server.py

Listens on http://127.0.0.1:8001
"""

from fastapi import FastAPI
from pydantic import BaseModel
import os
os.environ["OMP_NUM_THREADS"] = "1"
import torch
torch.set_num_threads(1)
from sentence_transformers import SentenceTransformer
import uvicorn

app = FastAPI(title="Nutrition Bot Embedding Server")

# Load once at startup — same model used during build_index.py
model = SentenceTransformer("jinaai/jina-embeddings-v2-small-en", trust_remote_code=True)
model.max_seq_length = 1024


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    dimensions: int


@app.get("/health")
def health():
    return {"status": "ok", "model": "jinaai/jina-embeddings-v2-small-en"}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    vec = model.encode(req.text, normalize_embeddings=True).tolist()
    return EmbedResponse(embedding=vec, dimensions=len(vec))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
