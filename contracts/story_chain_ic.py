# { "Depends": "py-genlayer:test" }

from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class Sentence:
    text: str
    author: Address
    created_at: str  # GenLayer has no wall-clock; contract leaves this ""


@allow_storage
@dataclass
class StoryChain:
    chain_id: str
    title: str
    premise: str
    created_by: Address
    created_at: str


def _parse_coherence(raw) -> dict:
    """Turn an LLM verdict string into {coherent: bool, reason: str}.

    Defaults to coherent=False on anything unparseable, so a controversial
    sentence is rejected rather than silently appended.
    """
    if isinstance(raw, (int, float)):
        return {"coherent": False, "reason": f"numeric output: {raw}"}
    if not isinstance(raw, str):
        return {"coherent": False, "reason": "non-string output"}

    text = raw.strip()
    # strip a leading ``` / ```json fence
    if text.startswith("```"):
        nl = text.find("\n")
        if nl != -1:
            text = text[nl + 1:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # extract the outermost {...}
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        obj = json.loads(text)
    except Exception:
        return {"coherent": False, "reason": "json parse failed"}

    coherent = obj.get("coherent")
    reason = str(obj.get("reason", ""))
    if isinstance(coherent, bool):
        return {"coherent": coherent, "reason": reason}
    if isinstance(coherent, str) and coherent.lower() in ("true", "false"):
        return {"coherent": coherent.lower() == "true", "reason": reason}
    return {"coherent": False, "reason": "missing coherent field"}


class StoryChainIC(gl.Contract):
    """Collaborative story chains with AI-gated sentence appending."""

    chains: TreeMap[str, StoryChain]
    chain_sentences: TreeMap[str, DynArray[Sentence]]
    chain_counter: u256

    def __init__(self):
        self.chain_counter = u256(0)

    @gl.public.write
    def create_chain(self, chain_json: str):
        """
        Create a new story chain.

        Expected JSON: {"title": "...", "premise": "...", "created_at": "..."}
        """
        try:
            data = json.loads(chain_json)
        except Exception as e:
            print(f"create_chain JSON error: {e}")
            return

        title = str(data.get("title", "")).strip()
        premise = str(data.get("premise", "")).strip()
        if not title or not premise:
            print("create_chain: title and premise are required")
            return

        self.chain_counter = self.chain_counter + u256(1)
        chain_id = f"chain_{int(self.chain_counter)}"

        self.chains[chain_id] = StoryChain(
            chain_id=chain_id,
            title=title[:200],
            premise=premise[:1000],
            created_by=gl.message.sender_address,
            created_at=str(data.get("created_at", "")),
        )
        self.chain_sentences.get_or_insert_default(chain_id)
        print(f"chain created: {chain_id}")

    @gl.public.write
    def add_sentence(self, chain_id: str, sentence: str):
        """Append a sentence after it passes the coherence equivalence principle."""
        if chain_id not in self.chains:
            raise Exception(f"chain not found: {chain_id}")

        sentence = str(sentence or "").strip()
        if not sentence or len(sentence) > 500:
            raise Exception("sentence must be 1..500 chars")

        chain = self.chains[chain_id]

        # build the story-so-far as validator context
        parts = [f"[Premise] {chain.premise}"]
        for s in self.chain_sentences.get_or_insert_default(chain_id):
            parts.append(s.text)
        story_so_far = "\n".join(parts)

        def judge():
            prompt = (
                "You are checking story coherence.\n"
                f"Story so far:\n{story_so_far}\n\n"
                f'New sentence to add: "{sentence}"\n\n'
                "Does the new sentence fit the story's flow, tone, and established facts?\n"
                'Return ONLY JSON: {"coherent": true|false, "reason": "<short>"}'
            )
            return gl.nondet.exec_prompt(prompt)

        verdict_raw = gl.eq_principle.prompt_non_comparative(
            judge,
            task="Decide whether the new sentence is coherent with the existing story.",
            criteria="Two answers are equivalent if they agree on the 'coherent' boolean.",
        )

        verdict = _parse_coherence(verdict_raw)
        if not verdict["coherent"]:
            raise Exception(f"sentence rejected by AI consensus: {verdict['reason']}")

        self.chain_sentences.get_or_insert_default(chain_id).append(Sentence(
            text=sentence,
            author=gl.message.sender_address,
            created_at="",
        ))
        print(f"sentence added to {chain_id}")

    @gl.public.view
    def get_chain(self, chain_id: str) -> dict:
        if chain_id not in self.chains:
            return {}
        c = self.chains[chain_id]
        return {
            "chain_id": c.chain_id,
            "title": c.title,
            "premise": c.premise,
            "created_by": str(c.created_by),
            "created_at": c.created_at,
        }

    @gl.public.view
    def get_story(self, chain_id: str) -> list:
        result = []
        if chain_id in self.chain_sentences:
            for s in self.chain_sentences[chain_id]:
                result.append({
                    "text": s.text,
                    "author": str(s.author),
                    "created_at": s.created_at,
                })
        return result

    @gl.public.view
    def get_all_chains(self) -> list:
        return [cid for cid in self.chains.keys()]
