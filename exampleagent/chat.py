from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import List, Literal
import sys
import os
from pymongo import MongoClient
from datetime import datetime

# Use absolute import assuming backend root is in PYTHONPATH (added in index_context.py)
# If running directly or issues arise, adjust path:
# import sys
# from pathlib import Path
# sys.path.append(str(Path(__file__).resolve().parent.parent))
from services.chat_service import get_rag_chain, get_guided_chat_chain # Import both chain functions
from langchain_core.messages import AIMessage, HumanMessage, BaseMessage

# Pydantic Models for Request and Response
class ChatMessageInput(BaseModel):
    role: Literal["human", "ai", "system"] # Ensure role matches LangChain expectations
    content: str

class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Unique identifier for this chat session")
    messages: List[ChatMessageInput] = Field(..., description="List of chat messages, ordered oldest to newest.")
    current_state: dict | None = Field(None, description="Current state of the guided conversation.")

class ChatResponse(BaseModel):
    session_id: str = Field(..., description="Echoed session identifier for this chat session")
    answer: str = Field(..., description="The AI-generated response.")
    state_updates: dict | None = Field(None, description="Updates to the conversation state based on the interaction.")
    is_final_step: bool = Field(False, description="Indicates if the guided conversation has reached its final step.")

# Create API Router
router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"], # Tag for API documentation
)

# Initialize MongoDB client and chat_history collection for logging
MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DATABASE_NAME")
HISTORY_COLLECTION_NAME = os.getenv("CHAT_HISTORY_COLLECTION", "chat_history")
_mongo_client = MongoClient(MONGO_URI)
_history_collection = _mongo_client[DB_NAME][HISTORY_COLLECTION_NAME]

# --- Implementation of Checklist Items 15-17 (adjusted for dual chain logic) ---

# Modify dependency or handle chain selection in the endpoint
# For simplicity, let's fetch both and decide in the endpoint
def get_chains_dependency():
    rag_chain = get_rag_chain()
    guided_chain = get_guided_chat_chain()
    # We might not need RAG if guided state is active, but load for potential fallback/future use
    if guided_chain is None: # RAG chain check is handled within its getter
        print("WARNING: Guided chat chain failed to load. Guided mode may not work.", file=sys.stderr)
        # Decide if this should be a hard failure
        # raise HTTPException(status_code=503, detail="Guided chat service unavailable.")
    return {"rag": rag_chain, "guided": guided_chain}

@router.post("/rag", response_model=ChatResponse)
async def handle_chat_request(request: ChatRequest, chains = Depends(get_chains_dependency)):
    # Allow empty messages ONLY if currentState is provided (for initial guided chat call)
    if not request.messages and request.current_state is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No messages provided and no initial state for guided chat."
        )
    # Ensure chat session document exists in history collection
    _history_collection.update_one(
        {"session_id": request.session_id},
        {"$setOnInsert": {
            "session_id": request.session_id,
            "started_at": datetime.utcnow(),
            "messages": []
        }},
        upsert=True
    )

    # Extract the latest question, history, and state
    current_state = request.current_state # Extract current state

    # Convert Pydantic models to LangChain BaseMessage objects for history
    chat_history = []
    latest_question = "" # Default to empty string for initial call

    if request.messages:
         latest_question = request.messages[-1].content
         for msg_input in request.messages[:-1]: # Exclude the last message (the question)
             if msg_input.role == "human":
                 chat_history.append(HumanMessage(content=msg_input.content))
             elif msg_input.role == "ai":
                 chat_history.append(AIMessage(content=msg_input.content))
         # System messages usually aren't part of the back-and-forth history for RAG prompt

    try:
        # Decide which chain to use
        if current_state is not None:
            # Use Guided Chat Chain
            print(f"Using Guided Chat Chain. State: {current_state}")
            guided_chain = chains.get("guided")
            if guided_chain is None:
                raise HTTPException(status_code=503, detail="Guided chat service is currently unavailable.")
            
            chain_input = {
                "question": latest_question,
                "chat_history": chat_history,
                "current_state": current_state
            }
            print(f"Invoking Guided chain with input: {chain_input}")
            # Invoke guided chain (assuming it returns a dict matching GuidedChatResponseSchema)
            response_data = guided_chain.invoke(chain_input)
            print(f"Guided chain response data: {response_data}")
            
            # Log this turn to chat_history collection
            _history_collection.update_one(
                {"session_id": request.session_id},
                {"$push": {"messages": {"$each": [
                    {"role": "human", "content": latest_question, "timestamp": datetime.utcnow()},
                    {"role": "ai", "content": response_data.get('reply'), "timestamp": datetime.utcnow()}
                ]}}},
                upsert=True
            )
            return ChatResponse(
                session_id=request.session_id,
                answer=response_data.get('reply', 'Error: Invalid response format from guided chat.'),
                state_updates=response_data.get('stateUpdates'),
                is_final_step=response_data.get('isFinalStep', False)
            )
        else:
            # Use RAG Chain (existing logic)
            print("Using RAG Chain (no state provided).")
            rag_chain = chains.get("rag")
            if rag_chain is None:
                 raise HTTPException(status_code=503, detail="RAG chat service is currently unavailable.")

            chain_input = {
                "question": latest_question,
                "chat_history": chat_history
                # RAG chain doesn't use current_state directly in its current form
            }
            print(f"Invoking RAG chain with input: {chain_input}")
            response_content = rag_chain.invoke(chain_input)
            print(f"RAG chain response: {response_content}")
            
            # Log this turn to chat_history collection
            _history_collection.update_one(
                {"session_id": request.session_id},
                {"$push": {"messages": {"$each": [
                    {"role": "human", "content": latest_question, "timestamp": datetime.utcnow()},
                    {"role": "ai", "content": response_content, "timestamp": datetime.utcnow()}
                ]}}},
                upsert=True
            )
            return ChatResponse(
                session_id=request.session_id,
                answer=response_content,
                state_updates=None,
                is_final_step=True
            )

    except Exception as e:
        print(f"Error invoking chat chain: {e}", file=sys.stderr)
        # Log the exception details for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process chat request: {e}"
        ) 