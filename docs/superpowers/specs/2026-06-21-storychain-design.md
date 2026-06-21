# StoryChain — Design Spec

- **Ngày:** 2026-06-21
- **Loại:** Dự án demo GenLayer + genlayer-js (mới, độc lập)
- **Mục tiêu:** Một intelligent contract đơn giản minh hoạ năng lực **LLM consensus** của GenLayer, kèm frontend Next.js tương tác qua genlayer-js.
- **Ràng buộc:** Không trùng domain với các dự án GenLayer đã có trong repo (Grant-Judge, JobApplication, SLAProof, Verdict, ConsentVault, Pact, news-verification, Prediction, betting-dapp, ai-governance-oracle, GEN-ETHOS).

---

## 1. Ý tưởng & lý do chọn

**StoryChain** — cộng tác viết truyện từng câu: ai cũng tạo một "chuỗi truyện"; người khác vào thêm câu nối tiếp. Trước khi câu mới được ghi vào chuỗi, contract dùng **equivalence principle** (cơ chế đồng thuận validator LLM của GenLayer) để kiểm tra câu đó **có hợp mạch truyện không**. Hợp → append; lệch → từ chối (revert giao dịch).

**Lý do chọn (YAGNI):**
- Thể hiện đúng năng lực cốt lõi của GenLayer: nhiều validator LLM chạy độc lập và đồng thuận qua equivalence principle. Đây là điều mà smart-contract truyền thống không làm được.
- Khác hẳn họ "AI chấm điểm X" (grant/job/SLA/verdict): không phải bài toán phân loại hay chấm điểm, mà là **cổng kiểm tra nội suy luận** cho nội dung do người dùng tạo.
- Phạm vi nhỏ: 1 contract + vài view + 1 frontend tối giản. Phù hợp demo/học.

**Loại bỏ (YAGNI):** tip/reward, lượt viết luân phiên, moderation tay, gợi ý câu tiếp theo, chấm điểm sáng tạo. Không có trong bản này.

---

## 2. Kiến trúc & cấu trúc dự án

```
E:\StoryChain\
├─ contracts/
│  └─ story_chain_ic.py        # intelligent contract (Python, GenLayer)
├─ app/                        # Next.js App Router (frontend)
│  ├─ page.tsx                 # danh sách chuỗi + form tạo chuỗi
│  └─ chain/[id]/page.tsx      # đọc truyện + form thêm câu
├─ lib/
│  ├─ genlayerClient.ts        # wrapper genlayer-js (write/read/wait)
│  └─ schemas.ts               # Zod schemas + TypeScript types
├─ .env.example                # NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS
└─ README.md
```

**Luồng dữ liệu:**
```
Trình duyệt (Next.js)
   │  genlayer-js (createClient -> studionet)
   ▼
Intelligent Contract (story_chain_ic.py)
   │  gl.eq_principle.prompt_non_comparative(...)
   ▼
GenLayer Studio consensus (các validator LLM)
```

Frontend → genlayer-js (mạng `studionet`) → intelligent contract chạy trên GenLayer Studio. Mỗi lượt thêm câu, contract gọi equivalence principle; các validator LLM chấm độc lập rồi đồng thuận.

---

## 3. Contract — API & data model

Ngôn ngữ: Python (py-genlayer). Tuân thủ convention đã xác nhận trong repo (`GenLayer-Grant-Judge/contracts/bounty_task_ic.py`):
- `from genlayer import *` (dùng namespace `gl`)
- Dataclass đánh dấu `@allow_storage`
- Collection: `TreeMap`, `DynArray`
- Method công khai: `@gl.public.write` / `@gl.public.view`
- Tham số đầu vào nhận dạng JSON string (frontend `JSON.stringify` trước khi gọi)
- AI qua `gl.eq_principle.prompt_non_comparative(fn, task=..., criteria=...)` với `fn` gọi `gl.nondet.exec_prompt(prompt)`
- Định danh người gửi: `gl.message.sender_address`

### Dataclasses

```python
@allow_storage
@dataclass
class Sentence:
    text: str
    author: Address
    created_at: str

@allow_storage
@dataclass
class StoryChain:
    chain_id: str
    title: str
    premise: str          # câu mở đầu / định hướng bối cảnh
    created_by: Address
    created_at: str
```

### Storage (trên class `StoryChainIC(gl.Contract)`)

```python
chains: TreeMap[str, StoryChain]                 # chain_id -> StoryChain
chain_sentences: TreeMap[str, DynArray[Sentence]] # chain_id -> danh sách câu
chain_counter: u256                               # bộ đếm sinh chain_id
```

### Methods

| Method | Loại | Mô tả |
|---|---|---|
| `create_chain(chain_json: str)` | `@gl.public.write` | Tạo chuỗi mới. JSON: `{title, premise, created_at}`. Tăng `chain_counter`, sinh `chain_id = f"chain_{int(chain_counter)}"`, lưu vào `chains`. |
| `add_sentence(chain_id: str, sentence: str)` | `@gl.public.write` | **Lõi AI.** Kiểm tra coherence rồi append (xem §4). |
| `get_chain(chain_id: str) -> dict` | `@gl.public.view` | Trả metadata chuỗi. |
| `get_story(chain_id: str) -> list[dict]` | `@gl.public.view` | Trả danh sách câu của chuỗi. |
| `get_all_chains() -> list[str]` | `@gl.public.view` | Trả tất cả `chain_id`. |

---

## 4. Logic coherence (Approach A — inline)

`add_sentence` là nơi thể hiện năng lực consensus của GenLayer.

```python
@gl.public.write
def add_sentence(self, chain_id: str, sentence: str):
    # 1. Validate cơ bản
    #    - chain_id phải tồn tại trong self.chains (không thì raise)
    #    - sentence sau .strip() phải khác rỗng
    #    - độ dài sentence trong khoảng [1, 500] ký tự (clamping chống lạm dụng)
    #
    # 2. Ghép ngữ cảnh: premise + các câu đã có trong chain_sentences[chain_id]
    #    -> chuỗi "story_so_far"
    #
    # 3. Định nghĩa hàm nondet:
    def judge():
        prompt = (
            f"You are checking story coherence.\n"
            f"Story so far:\n{story_so_far}\n\n"
            f"New sentence to add: \"{sentence}\"\n\n"
            f"Does the new sentence fit the story's flow, tone and established facts?\n"
            f"Return ONLY JSON: {{\"coherent\": true|false, \"reason\": \"<short>\"}}"
        )
        return gl.nondet.exec_prompt(prompt)

    verdict_json = gl.eq_principle.prompt_non_comparative(
        judge,
        task="Decide whether the new sentence is coherent with the existing story.",
        criteria="Two answers are equivalent if they agree on the 'coherent' boolean.",
    )
    #
    # 4. Phân tích verdict_json (xoá markdown fence, trích JSON, json.loads).
    #    - Đa số validator trả coherent=True -> append Sentence vào chain_sentences[chain_id]
    #    - Đa số trả coherent=False -> raise Exception -> giao dịch REVERT, không lưu gì.
```

**Điểm consensus:** `gl.eq_principle.prompt_non_comparative` chạy `judge` trên nhiều validator LLM độc lập. Mỗi validator trả `{coherent, reason}`; equivalence principle quy hai kết quả là "tương đương" nếu cùng `coherent`. Kết quả đa số thắng. Append hay revert phụ thuộc kết quả này — chính là cơ chế đồng thuận của GenLayer.

**Xử lý đầu ra AI:** Bọc logic parse giống `bounty_task_ic.py` — xoá code fence ``` ` `` `, trích đoạn giữa `{` đầu và `}` cuối, `json.loads`; nếu không parse được hoặc kiểu lạ thì mặc định `coherent=False` (an toàn: câu gây tranh cãi sẽ bị từ chối thay vì thêm).

---

## 5. Frontend + genlayer-js

Tuân thủ convention đã xác nhận (`GenLayer-Grant-Judge/lib/genlayerClient.ts`):

- `createClient({ chain: studionet, account })` → `await client.initializeConsensusSmartContract()` trước khi gọi.
- Ghi: `writeContract({ address, functionName, args: [JSON.stringify(...)], value: 0n })`.
- Đọc: `readContract({ address, functionName, args })`.
- Chờ + phát hiện revert: `waitForTransactionReceipt({ hash, status: "FINALIZED" })` trả về `{ txExecutionResultName }`. Nếu `txExecutionResultName` thuộc tập thành công (`FINISHED_WITH_RETURN`, `FINALIZED_WITH_RETURN`, `Successful` — theo pattern `ConsentVault/lib/genlayer/genlayer-trial-engine.ts`) → câu được chấp nhận; ngược lại → câu bị AI từ chối (tx revert). Đây là pattern duy nhất dùng cho mọi write, vì `add_sentence` cần phát hiện revert.

**Cấu trúc:**

`lib/schemas.ts` — Zod schemas (`CreateChainRequestSchema`, `AddSentenceRequestSchema`) + types (`StoryChain`, `Sentence`).

`lib/genlayerClient.ts` — các hàm:
- `createChain(input, account)` → `{txHash}`
- `addSentence(chainId, sentence, account)` → `{txHash}`
- `getChain(chainId)` → `StoryChain | null`
- `getStory(chainId)` → `Sentence[]`
- `getAllChains()` → `string[]`
- `waitForTx(txHash, opts)` → `TransactionStatus`

Đọc biến môi trường `NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS` (contract đã deploy trên GenLayer Studio).

**UI (App Router):**
- `app/page.tsx`: kết nối ví → danh sách chuỗi (`getAllChains` rồi `getChain`) + form tạo chuỗi (`createChain` → `waitForTx` → refresh).
- `app/chain/[id]/page.tsx`: đọc truyện (`getStory`) + form thêm câu (`addSentence` → `waitForTx` → refresh).

---

## 6. Error handling

- **Câu bị AI từ chối:** giao dịch `add_sentence` revert trên GenLayer. Frontend phát hiện qua `txExecutionResultName` không thuộc tập thành công (`FINISHED_WITH_RETURN`, `FINALIZED_WITH_RETURN`, `Successful` — theo pattern `ConsentVault/lib/genlayer/genlayer-trial-engine.ts`) → hiện thông báo *"Câu bị AI consensus từ chối — hãy viết nối mạch truyện hơn."* Không crash.
- **Parse JSON lỗi / output AI lạ:** contract mặc định `coherent=False` (an toàn). Frontend vẫn hiển thị lỗi thân thiện nếu giao dịch revert vì lý do khác.
- **Lỗi mạng / người dùng reject giao dịch:** bắt lỗi `writeContract`, hiện thông báo, không crash. Trả `null`/mảng rỗng cho các hàm read khi lỗi (giống `genlayerClient.ts`).

---

## 7. Testing

Dự án demo đơn giản → không thêm framework test tự động (YAGNI).

- **Contract:** test tay trên **GenLayer Studio** — deploy `story_chain_ic.py` → gọi `create_chain` → thử `add_sentence` với câu hợp lệ (xác nhận append) và câu lệch bối cảnh (xác nhận revert).
- **Frontend:** smoke test thủ công — tạo chuỗi, thêm câu hợp lệ, thêm câu lệch (xác nhận thông báo từ chối), refresh lại xem state đúng.

---

## 8. Phạm vi & không nằm trong bản này

**Có (bản 1):** 1 intelligent contract (`create_chain`, `add_sentence`, 3 view) + frontend Next.js 2 trang + wrapper genlayer-js + Zod schemas.

**Không có:** tip/reward, danh sách người tham gia, lượt viết, moderation tay, gợi ý AI, leaderboard, pytest/CI. (Có thể thêm sau nếu cần.)
