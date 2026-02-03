from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-large")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-large")

prompt = """
Below is a summary of general health observations based on the provided data.

Patient data:
- Reported symptoms: fever, cough
- Oxygen saturation (SpO2): 96%
- Heart rate: 88 bpm

Write neutral, non-diagnostic observations in bullet points.
Indicate whether values fall within commonly observed ranges.
Suggest only general wellness precautions.
Do NOT provide medical advice or diagnosis.

Observations:
"""

inputs = tokenizer(prompt, return_tensors="pt")
outputs = model.generate(
    **inputs,
    max_new_tokens=200,
    do_sample=True,
    temperature=0.7,
    top_p=0.9
)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))