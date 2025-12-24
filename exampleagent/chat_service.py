import os
import sys
from pathlib import Path
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pymongo import MongoClient
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema.runnable import RunnablePassthrough, RunnableLambda
from langchain.schema.output_parser import StrOutputParser
from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel as LangchainBaseModel, Field as LangchainField

# Ensure OpenAI API key is loaded (might be redundant if main app loads it, but safe)
env_path = Path(__file__).resolve().parent.parent / '.env.development'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"Chat Service: Loaded environment variables from {env_path.name}.")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Service Error: OPENAI_API_KEY not found. Chat functionality may fail.", file=sys.stderr)

# Constants
EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4.1-mini" # Use the requested model

# --- MongoDB Atlas Configuration ---
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DATABASE_NAME", "SmartWifi")
COLLECTION_NAME = os.getenv("MONGODB_VECTOR_COLLECTION", "readme_vectors")
INDEX_NAME = os.getenv("MONGODB_VECTOR_INDEX_NAME", "vector_index")

# Global cache for retriever to avoid reloading on every request
_retriever = None
_vector_search_instance = None # Cache the vector search instance as well

# Global cache for the RAG chain
_rag_chain = None

# --- Guided Interaction Prompt and State ---
# Define the expected sequence of questions and state keys
EXPECTED_STATE_KEYS = ["userName", "serviceInterest", "locationType", "needsWifi", "needsCCTV", "needsNetworkDesign", "additionalInfo"]
GUIDED_QUESTIONS = [
    "Hello! I'm a Smart Wifi Access agent. To start, what's your name?",
    "Thanks, {userName}! What type of service are you interested in? (e.g., PBX installs, low voltage installations, network design, CCTV, A/V systems, or something else?)",
    "Nice to meet you, {userName}! What type of location are you setting up? (e.g., Home, Office, Store, Warehouse)",
    "Got it ({locationType}). Are you primarily looking for Wi-Fi installation services? (Yes/No)",
    "How about CCTV or security cameras? (Yes/No)",
    "Do you require network design services (e.g., planning cable runs, equipment placement)? (Yes/No)",
    "Is there any other specific requirement or information you'd like to share? (Type \'None\' if not)",
    "Thanks, {userName}! I've gathered the basic requirements. I'll summarize shortly. Is this the final step? (This is a system check, the final response will confirm)"
]

# Create the formatted lists for the prompt
formatted_questions = "\n".join([f'{idx}: {q}' for idx, q in enumerate(GUIDED_QUESTIONS)])
formatted_keys = ", ".join(EXPECTED_STATE_KEYS)
last_question_index = len(GUIDED_QUESTIONS) - 1

GUIDED_SYSTEM_PROMPT = f"""
You are the Smart Wifi Access setup assistant, a world-class AI consultant and marketing expert infused with over 40 years of real-world success. Your mission is to not only guide each user through a personalized setup experience but also to showcase the unparalleled benefits, proven ROI, and case studies from our extensive portfolio.
Speak with authority, empathy, and conviction, using persuasive language, compelling statistics, and social proof (e.g., "over 500 satisfied clients", "industry-leading uptime guarantees", "rapid deployment in as little as 24 hours"). Infuse every relevant answer with context from our website, FAQs, and service descriptions.
Your responses must always be concise yet comprehensive, delivering maximum value. When upselling or cross-selling, frame offers as solutions to their needs, highlighting exclusive benefits and guarantees.
Maintain the JSON-only format for guided setup responses. If a user digresses to ask any question about our services, answer fully with enriched detail, then seamlessly resume the guided setup flow.
Follow these instructions strictly:
1. Use the provided 'Current State' to determine the next question to ask from the sequence below.
2. Maintain the conversation state by extracting relevant information from the user's response.
3. Ask only ONE question at a time.
4. Address the user by name if available in the state.
5. When asking a question, refer to the 'Guided Questions' list below using the 'currentQuestionIndex' from the state.
6. When the user responds, extract the information relevant to the *previous* question asked and update the state (e.g., after asking for name, update userName; after asking for service interest, update serviceInterest).
7. **IMPORTANT**: Respond ONLY with a JSON object containing three keys: 'reply' (your conversational response including the *next* question), 'stateUpdates' (a dictionary containing *only* the updated state values based on the user's answer to the *previous* question), and 'isFinalStep' (boolean, set to true ONLY after the *last* question has been answered).
8. Do not add any text outside the JSON object.
9. If the user provides unclear information, ask for clarification before proceeding.
10. If the user asks a question unrelated to the current setup step but related to our website or services, answer it accurately and thoroughly using available website context, then resume the guided setup flow by asking the pending question.
11. When answering such questions, draw upon the website's content, service descriptions, FAQs, and any relevant details to provide clear and helpful responses.
12. Ensure you ask for the user's primary service interest right after getting their name.

Guided Questions Sequence (Indices):
{formatted_questions}

Expected State Structure (Keys to update in stateUpdates):
{formatted_keys}

Example Interaction:
User Message: "My name is Bob."
Current State: {{'currentQuestionIndex': 0}}
Your JSON Response: {{ "reply": "Thanks, Bob! What type of service are you interested in? (e.g., PBX installs, low voltage installations, network design, CCTV, A/V systems, or something else?)", "stateUpdates": {{ "userName": "Bob" }}, "isFinalStep": false }}

Current State (for next turn): {{'currentQuestionIndex': 1, 'userName': 'Bob'}}
User Message: "I need network design"
Your JSON Response: {{ "reply": "Nice to meet you, Bob! What type of location are you setting up? (e.g., Home, Office, Store, Warehouse)", "stateUpdates": {{ "serviceInterest": "network design" }}, "isFinalStep": false }}

Handle yes/no questions by updating the corresponding boolean state key (e.g., needsWifi: true/false).
If the user says 'None' for additional info, update additionalInfo to null or an empty string.
Set isFinalStep to true only when responding *after* the user has answered the question at the last index ({last_question_index}).
"""

# Global cache for the Guided Chat chain
_guided_chat_chain = None

# --- Guided Chat Chain Implementation ---

# Define Pydantic model for the expected JSON output structure
class GuidedChatResponseSchema(LangchainBaseModel):
    reply: str = LangchainField(description="The conversational response to the user, including the next question.")
    stateUpdates: dict | None = LangchainField(description="Dictionary of state keys and their updated values based on the user's last message.")
    isFinalStep: bool = LangchainField(description="True if the conversation's final question has been answered.")

def format_state_for_prompt(state_dict: dict | None) -> str:
    """Formats the state dictionary into a string for the prompt."""
    if state_dict is None:
        # Initial state for the very first message
        return str({"currentQuestionIndex": 0}) 
    return str(state_dict)

def get_guided_chat_chain():
    """Initializes and returns a LangChain Runnable for guided chat interaction."""
    global _guided_chat_chain
    if _guided_chat_chain is not None:
        return _guided_chat_chain

    if not OPENAI_API_KEY:
        print("Error: Cannot create Guided Chat chain because OPENAI_API_KEY is not set.", file=sys.stderr)
        return None

    try:
        # Define the prompt template for guided chat
        guided_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", GUIDED_SYSTEM_PROMPT),
                MessagesPlaceholder(variable_name="chat_history"),
                # Format current state into the prompt
                ("system", "Current State: {current_state_str}"), 
                ("human", "{question}"),
            ]
        )

        # Initialize the chat model configured for JSON output
        llm = ChatOpenAI(model_name="gpt-4.1-mini").bind(
            response_format={"type": "json_object"}
        )

        # Initialize the JSON parser with our schema
        parser = JsonOutputParser(pydantic_object=GuidedChatResponseSchema)

        # Explicit extraction for each input
        _guided_chat_chain = (
            {
                "question": RunnableLambda(lambda inputs: inputs["question"]),
                "chat_history": RunnableLambda(lambda inputs: inputs["chat_history"]),
                "current_state_str": RunnableLambda(lambda inputs: format_state_for_prompt(inputs.get("current_state")))
            }
            | guided_prompt
            | llm
            | parser
        )

        print("Guided Chat chain created successfully.")
        return _guided_chat_chain

    except Exception as e:
        print(f"Error creating Guided Chat chain: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None

# --- Implementation Changes ---

def get_vector_search():
    """Initializes and returns a MongoDBAtlasVectorSearch instance."""
    global _vector_search_instance
    if _vector_search_instance is not None:
        return _vector_search_instance

    if not all([MONGODB_URI, DB_NAME, COLLECTION_NAME, INDEX_NAME]):
        print("Service Error: MongoDB connection details not fully configured.", file=sys.stderr)
        return None

    try:
        print("Service: Connecting to MongoDB Atlas...")
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        print(f"Service: Connected to MongoDB: {DB_NAME}, Collection: {COLLECTION_NAME}")

        embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

        _vector_search_instance = MongoDBAtlasVectorSearch(
            collection=collection,
            embedding=embeddings,
            index_name=INDEX_NAME,
            text_key='text', # Must match the key used during indexing
            embedding_key='embedding' # Must match the key used during indexing
            # Optional: Specify fields to retrieve from metadata
            # retrieval_args={"search": {"returnStoredSource": True, "path": ["metadata.source", "metadata.row"]}}
        )
        print(f"Service: Initialized MongoDBAtlasVectorSearch using index: {INDEX_NAME}")
        return _vector_search_instance
    except Exception as e:
        print(f"Service Error: Failed to initialize MongoDBAtlasVectorSearch: {e}", file=sys.stderr)
        return None

def get_retriever():
    """Gets a retriever from the initialized MongoDBAtlasVectorSearch instance."""
    global _retriever
    if _retriever is not None:
        return _retriever

    vector_search = get_vector_search()
    if not vector_search:
        print("Service Error: Vector search instance not available, cannot create retriever.", file=sys.stderr)
        return None # Indicate failure

    try:
        # Configure retriever
        _retriever = vector_search.as_retriever(
            search_type="similarity", # Or "mmr"
            search_kwargs={
                "k": 15, # Retrieve top 15 relevant chunks
                # Optional: Add pre-filtering based on metadata if needed
                # "pre_filter": {"metadata.source": {"$eq": "some_source.md"}}
            }
        )
        print("Service: Retriever created successfully.")
        return _retriever
    except Exception as e:
        print(f"Service Error: Failed to create retriever from vector search instance: {e}", file=sys.stderr)
        return None

def format_docs(docs):
    # Now includes metadata if retrieved
    formatted = []
    for doc in docs:
        content = doc.page_content
        source = doc.metadata.get('source', 'Unknown')
        # Add other metadata if needed
        formatted.append(f"Source: {source}\nContent: {content}")
    return "\n\n---\n\n".join(formatted)

def get_rag_chain():
    global _rag_chain
    if _rag_chain is not None:
        return _rag_chain

    retriever = get_retriever()
    if not retriever:
        print("Error: Cannot create RAG chain because retriever failed to load.", file=sys.stderr)
        return None

    template = """
You are an assistant for question-answering tasks for the Smart Wifi Access web application.
Always answer as a member of the Smart Wifi Access team, using 'we' and 'our' to refer to the company and its services. Never refer to Smart Wifi Access in the third person.
Use the following pieces of retrieved context to answer the user's question. If the context does not fully answer the question, use your own knowledge to provide a complete and helpful response, but clearly indicate which parts are based on your general expertise and which are from the provided context. If the context provides examples or lists, include them in your answer. If not, but you know typical offerings for such services, provide a representative list and note that it is based on general industry knowledge.
If the context contains specific details about the requested service (including how to inquire or contact us), provide those details directly from the context. If the context mentions the service but lacks the specific details needed to answer the question fully, state what the context *does* say and advise the user to contact support at (816) 896-6989 or support@smartwifiaccess.com for more information.
Prioritize providing contact information or specific service details found in the context when the user asks about acquiring or learning more about a service mentioned (e.g., PBX, CCTV, Network Design, AV Systems, Low Voltage).

**IMPORTANT:** If the user asks when they can call, contact us, or about our availability/business hours, you MUST respond that we are available 24/7 via phone at (816) 896-6989 and email at support@smartwifiaccess.com. Ignore any retrieved context mentioning specific business hours for this type of question.

Context:
{context}

Chat History:
{chat_history}

Question: {question}

Answer:
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", template),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    )

    llm = ChatOpenAI(model_name=CHAT_MODEL)

    # Explicit extraction for each input
    _rag_chain = (
        {
            "context": RunnableLambda(lambda inputs: retriever.invoke(inputs["question"])) | RunnableLambda(lambda docs: format_docs(docs)),
            "question": RunnableLambda(lambda inputs: inputs["question"]),
            "chat_history": RunnableLambda(lambda inputs: inputs["chat_history"]),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    print("RAG chain created successfully.")
    return _rag_chain

# Example usage (for testing or direct call)
if __name__ == '__main__':
    # This part is for testing the service directly if needed
    print("Testing chat service components...")
    test_retriever = get_retriever()
    if test_retriever:
        print("Retriever loaded.")
        # test_docs = test_retriever.invoke("What is Panduit?")
        # print(f"Retrieved docs: {test_docs}")
    else:
        print("Failed to load retriever.")

    rag_chain = get_rag_chain()
    if rag_chain:
        print("RAG chain created.")
        # Example invocation:
        # response = rag_chain.invoke({
        #     "chat_history": [HumanMessage(content="Hi"), AIMessage(content="Hello!")],
        #     "question": "Tell me about network designs"
        # })
        # print(f"Test Response: {response}")
    else:
        print("Failed to create RAG chain.") 