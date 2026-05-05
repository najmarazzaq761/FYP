import os
from flask import current_app
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

SYSTEM_PROMPT = """You are a helpful, friendly, and empathetic depression support chatbot.
If the user greets you, greet them back in a friendly way and ask 'How can I help you today?'.
Your primary goal is to help users who ask about depression based on the knowledge base provided.

IMPORTANT RULE: Answer the user's question ONLY based on the provided context from the knowledge base. 
If the answer is NOT contained in the context, you may use your own knowledge to provide a helpful, empathetic, and practical response.

Context:
{context}

Always maintain a compassionate, non-judgmental, and supportive tone.
Disclaimer: Always include a brief note that your advice does not replace professional medical help.
If the user talks about self-harm or severe crisis, gently advise them to seek immediate professional help or contact an emergency hotline.
"""

_rag_chain = None

def get_rag_chain(api_key):
    global _rag_chain
    if _rag_chain is not None:
        return _rag_chain
        
    # Initialize LLM
    llm = ChatGroq(
        api_key=api_key,
        model="llama-3.1-8b-instant"
    )
    
    # Initialize Embeddings
    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2"
    )
    
    # Initialize Chroma Vector Store
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    chroma_db_dir = os.path.join(base_dir, 'chroma_db')
    
    # Check if DB exists, otherwise fallback to simple LLM
    if not os.path.exists(chroma_db_dir):
        raise FileNotFoundError("Chroma DB not found. Please run the ingestion script first.")
        
    vectorstore = Chroma(
        persist_directory=chroma_db_dir,
        embedding_function=embeddings
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    
    # Create Prompt Template
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
    ])
    
    # Create LCEL Chain
    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)
        
    _rag_chain = (
        {"context": retriever | format_docs, "input": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    return _rag_chain

def get_chat_response(user_message):
    try:
        api_key = current_app.config.get("GROQ_API_KEY")

        if not api_key:
            return "API key missing"

        try:
            chain = get_rag_chain(api_key)
            response = chain.invoke(user_message)
            return response
        except FileNotFoundError as fnf:
            # Fallback if DB doesn't exist
            print(f"RAG Error: {fnf}")
            return "I am currently updating my knowledge base. Please try again later."

    except Exception as e:
        print(f"Chatbot error: {e}")
        return "I'm having trouble processing that right now. Could you try again later?"
