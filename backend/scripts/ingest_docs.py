import os
import glob
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAG_DOCS_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'rag_docs'))
CHROMA_DB_DIR = os.path.join(BASE_DIR, 'chroma_db')

def ingest_documents():
    print(f"Looking for PDFs in: {RAG_DOCS_DIR}")
    pdf_files = glob.glob(os.path.join(RAG_DOCS_DIR, "*.pdf"))
    
    if not pdf_files:
        print("No PDF files found.")
        return

    documents = []
    for pdf_file in pdf_files:
        print(f"Loading {os.path.basename(pdf_file)}...")
        loader = PyPDFLoader(pdf_file)
        documents.extend(loader.load())

    print(f"Loaded {len(documents)} pages. Splitting text...")
    
    # Split text into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks.")

    # Initialize Embeddings
    print("Loading HuggingFace Embeddings (all-MiniLM-L6-v2)...")
    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2"
    )

    # Create ChromaDB
    print(f"Saving to Chroma DB at {CHROMA_DB_DIR}...")
    
    # Check if DB already exists to append or create new
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=CHROMA_DB_DIR
    )
    
    print("Ingestion complete!")

if __name__ == "__main__":
    ingest_documents()
