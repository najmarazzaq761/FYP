with open('app/services/chatbot_service.py', 'r') as f:
    content = f.read()

# Replace the imports
content = content.replace(
    'from langchain.chains import create_retrieval_chain\nfrom langchain.chains.combine_documents import create_stuff_documents_chain\nfrom langchain_core.prompts import ChatPromptTemplate',
    'from langchain_core.prompts import ChatPromptTemplate\nfrom langchain_core.runnables import RunnablePassthrough\nfrom langchain_core.output_parsers import StrOutputParser'
)

# Replace the chain creation
old_chain_code = '''    # Create Prompt Template
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
    ])
    
    # Create Chains
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    _rag_chain = create_retrieval_chain(retriever, question_answer_chain)
    
    return _rag_chain'''

new_chain_code = '''    # Create Prompt Template
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
    ])
    
    # Create LCEL Chain
    def format_docs(docs):
        return "\\n\\n".join(doc.page_content for doc in docs)
        
    _rag_chain = (
        {"context": retriever | format_docs, "input": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    return _rag_chain'''

content = content.replace(old_chain_code, new_chain_code)

# Replace the invocation
content = content.replace('response = chain.invoke({"input": user_message})\n            return response["answer"]', 'response = chain.invoke(user_message)\n            return response')

with open('app/services/chatbot_service.py', 'w') as f:
    f.write(content)
