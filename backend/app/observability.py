from langfuse import get_client
from langfuse.langchain import CallbackHandler

from dotenv import load_dotenv
load_dotenv()

langfuse = get_client()

def langchain_config(run_name: str) -> dict:
    return {
        "run_name": run_name,
        "callbacks": [CallbackHandler()],
    }