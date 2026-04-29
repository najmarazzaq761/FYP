import os
from groq import Groq
from flask import current_app

SYSTEM_PROMPT = """You are a helpful, friendly, and empathetic depression support chatbot. 
If the user greets you, greet them back in a friendly way and ask 'How can I help you today?'. 
Your primary goal is to help users who ask about depression. You should be able to discuss its symptoms, provide treatment recommendations or suggestions in terms of therapy, diet, exercise, and offer practical advice on how they can reduce it. 
Always maintain a compassionate, non-judgmental, and supportive tone. 
Disclaimer: Always include a brief note that your advice does not replace professional medical help. 
If the user talks about self-harm or severe crisis, gently advise them to seek immediate professional help or contact an emergency hotline.
"""

def get_chat_response(user_message):
    try:
        api_key = current_app.config.get("GROQ_API_KEY")

        if not api_key:
            return "API key missing"

        client = Groq(api_key=api_key)

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": user_message,
                }
            ],
            model="llama-3.1-8b-instant",
        )

        response_text = chat_completion.choices[0].message.content

        if not response_text:
            return "No response from Groq"

        return response_text.strip()

    except Exception as e:
        current_app.logger.exception("GROQ ERROR: %s", str(e))
        print("GROQ ERROR:", str(e))
        return "Error: " + str(e)
