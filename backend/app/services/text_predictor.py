import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# Remote HuggingFace model — fine-tuned MentalBERT on 4-class mental health dataset
# Labels: 0=Anxiety, 1=Depression, 2=Normal, 3=Suicidal
MODEL_NAME = "ourafla/mental-health-bert-finetuned"

print(f"Loading BERT model from HuggingFace: {MODEL_NAME}")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.eval()
print("BERT model loaded successfully.")


# Label mapping — alphabetical order matching the training dataset:
# 0=Anxiety, 1=Depression, 2=Normal, 3=Suicidal
CLASS_NAMES = ['Anxiety', 'Depression', 'Normal', 'Suicidal']


def predict_mental_health(text: str) -> dict:
    """
    Predict mental health category from input text using local BERT model.

    Args:
        text: String content to classify.

    Returns:
        dict with keys 'label' (str) and 'probability' (float).
    """
    if not text.strip():
        raise ValueError("Input text cannot be empty.")

    # Tokenize — max 512 tokens (BERT limit), truncate if needed
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.softmax(outputs.logits, dim=1)
    predicted_class_idx = torch.argmax(probabilities, dim=1).item()
    predicted_label = CLASS_NAMES[predicted_class_idx]
    confidence = probabilities[0][predicted_class_idx].item()

    return {
        "label": predicted_label,
        "probability": confidence
    }
