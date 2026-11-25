"""Train and export the simulator's small transcript classifier with Python and NumPy."""
import argparse
import hashlib
import json
import re
import struct
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REVISION = "30b0a37ccaaa32f332884b96992754e246e48c5f"
BASE = "https://huggingface.co/google/bert_uncased_L-2_H-128_A-2/resolve/" + REVISION
FILE_HASHES = {
    "model.safetensors": "7fb69ad9f6866d8983183c930e33828f326470bf6ad8bbb2ad4ed957a92e9414",
    "vocab.txt": "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3",
}
NUMBER = set("zero oh one two three tree four five fife six seven eight nine niner ten eleven twelve twenty thirty forty fifty sixty seventy eighty ninety hundred thousand".split())


def source_file(cache, name):
    path = cache / name
    if not path.exists():
        cache.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(BASE + "/" + name, path)
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != FILE_HASHES[name]:
        raise ValueError("Unexpected upstream file checksum for " + name)
    return data


def words(text):
    normalized = []
    for word in re.findall("[a-z]+|[0-9]+", text.lower()):
        token = "number" if word in NUMBER or word.isdigit() else word
        if token == "number" and normalized[-1:] == ["number"]:
            continue
        normalized.append(token)
    return normalized


def load_embeddings(cache):
    archive = source_file(cache, "model.safetensors")
    header_size, = struct.unpack_from("<Q", archive)
    header = json.loads(archive[8:8 + header_size])
    key, = [key for key in header if key.endswith("word_embeddings.weight")]
    record = header[key]
    assert record["dtype"] == "F32"
    data_offset = 8 + header_size + record["data_offsets"][0]
    embedding = np.frombuffer(archive, dtype="<f4", offset=data_offset,
                              count=int(np.prod(record["shape"]))).reshape(record["shape"])
    vocab = source_file(cache, "vocab.txt").decode().splitlines()
    return embedding, {word: i for i, word in enumerate(vocab)}


def word_vector(word, embedding, vocab):
    ids = []
    start = 0
    while start < len(word):
        for end in range(len(word), start, -1):
            piece = ("" if start == 0 else "##") + word[start:end]
            if piece in vocab:
                ids.append(vocab[piece])
                start = end
                break
        else:
            return embedding[vocab["[UNK]"]]
    return embedding[ids].mean(axis=0)


def train(cache, out):
    data = json.loads((HERE / "phrases.json").read_text())
    groups = data["train"]
    labels = list(groups)
    examples = [(words(text), i) for i, label in enumerate(labels) for text in groups[label]]
    assert not {tuple(row) for row, _ in examples}.intersection(
        tuple(words(text)) for group in data["evaluation"].values() for text in group
    ), "Train and evaluation phrases overlap after normalization"
    vocabulary = sorted({word for row, _ in examples for word in row})
    embeddings, vocab = load_embeddings(cache)
    table = np.stack([word_vector(word, embeddings, vocab) for word in vocabulary]).astype(np.float64)
    table -= table.mean(axis=0)
    table /= np.linalg.norm(table, axis=1, keepdims=True)
    index = {word: i for i, word in enumerate(vocabulary)}
    features = np.stack([table[[index[w] for w in row]].mean(axis=0) for row, _ in examples])
    targets = np.eye(len(labels))[[label for _, label in examples]]
    # Each intent receives equal total training weight despite differing example counts.
    sample_weights = (targets / targets.sum(axis=0)).sum(axis=1, keepdims=True) / len(labels)
    weights = np.zeros((features.shape[1], len(labels)))
    bias = np.zeros(len(labels))
    for _ in range(3200):
        scores = features @ weights + bias
        probabilities = np.exp(scores - scores.max(axis=1, keepdims=True))
        probabilities /= probabilities.sum(axis=1, keepdims=True)
        gradient = (probabilities - targets) * sample_weights
        weights -= 2 * (features.T @ gradient + 0.00003 * weights)
        bias -= 2 * gradient.sum(axis=0)
    # Folding the linear head into the retained token vectors gives identical logits
    # before rounding, without shipping the encoder or doing matrix multiplication.
    model = {"labels": labels, "bias": bias.round(5).tolist(), "numeric": sorted(NUMBER),
             "tokens": dict(zip(vocabulary, (table @ weights).round(5).tolist()))}
    template = (HERE / "runtime.js.in").read_text(encoding="utf8")
    out.write_text(template.replace("/* MODEL */", json.dumps(model, separators=(",", ":"))),
                   encoding="utf8", newline="\n")
    print(f"{len(examples)} training calls, {len(vocabulary)} tokens, {out.stat().st_size} bytes")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(__doc__)
    cli.add_argument("--cache", type=Path, required=True)
    cli.add_argument("--out", type=Path, default=HERE.parents[1] / "packages/qgh-engine/rt-intent-model.js")
    args = cli.parse_args()
    train(args.cache, args.out)
